-- Die Bremse gegen Durchprobieren hat nie funktioniert.
--
-- Der Fehler steckte seit 0001 drin und sah voellig unauffaellig aus:
--
--     insert into kombi.versuche (herkunft, erfolg) values (woher, treffer);
--     if not treffer then
--       raise exception 'Der Code stimmt nicht.' using errcode = '28P01';
--     end if;
--
-- Die Ausnahme bricht die Transaktion ab. Damit wird auch das insert davor
-- zurueckgerollt. Ergebnis: ein Fehlversuch wurde nie gespeichert, die Zaehlung
-- stand immer auf null, und die Sperre nach zehn Versuchen konnte nie greifen.
-- Der Code liess sich unbegrenzt durchprobieren.
--
-- Nachgewiesen am 13.09.2026: ueber die gesamte Lebenszeit der Datenbank
-- standen 5 Versuche in der Tabelle, davon 0 Fehlversuche. Obwohl es
-- nachweislich Fehlversuche gab.
--
-- Genau die Sorte Fehler, die am teuersten ist: die Schutzmassnahme ist da, sie
-- sieht richtig aus, sie meldet nichts, und sie tut nichts.
--
-- DIE LOESUNG: nicht mehr mit einer Ausnahme antworten, sondern mit einem
-- Ergebnis. Dann bleibt der Zaehler stehen. Die Funktionen geben jetzt ein Feld
-- "fehler" zurueck. Ist es gefuellt, ist etwas schiefgegangen.

-- ---------------------------------------------------------------------------
-- Einloesen
-- ---------------------------------------------------------------------------

drop function if exists public.kombi_code_einloesen(text);

create function public.kombi_code_einloesen(p_code text)
returns table (token text, laeuft_ab timestamptz, fehler text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  woher text;
  fehlversuche integer;
  treffer boolean := false;
  neuer_token text;
  ablauf timestamptz;
begin
  woher := kombi.herkunft();

  select count(*) into fehlversuche
    from kombi.versuche
   where herkunft = woher
     and erfolg = false
     and zeitpunkt > now() - interval '15 minutes';

  if fehlversuche >= 10 then
    -- Auch das wird gezaehlt. Wer weiter klopft, verlaengert seine eigene Sperre.
    insert into kombi.versuche (herkunft, erfolg) values (woher, false);
    return query select null::text, null::timestamptz,
      'Zu viele Fehlversuche. Bitte in 15 Minuten noch einmal probieren.'::text;
    return;
  end if;

  -- Immer genau einen Vergleich rechnen, auch wenn es gar keinen Code gibt.
  -- Sonst liesse sich an der Antwortzeit ablesen, ob ein Code existiert.
  select exists (
    select 1
      from kombi.zugangscodes z
     where z.aktiv
       and z.code_hash = extensions.crypt(coalesce(p_code, ''), z.code_hash)
  ) into treffer;

  insert into kombi.versuche (herkunft, erfolg) values (woher, treffer);

  if not treffer then
    -- Kein raise. Sonst faellt der Eintrag oben wieder weg, und wir haetten
    -- den alten Fehler zurueck.
    return query select null::text, null::timestamptz, 'Der Code stimmt nicht.'::text;
    return;
  end if;

  perform kombi.aufraeumen();

  neuer_token := encode(extensions.gen_random_bytes(32), 'hex');
  ablauf := now() + interval '30 days';

  insert into kombi.sitzungen (token_hash, laeuft_ab_am)
  values (encode(extensions.digest(neuer_token, 'sha256'), 'hex'), ablauf);

  return query select neuer_token, ablauf, null::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Codewechsel, gleiche Behandlung
-- ---------------------------------------------------------------------------

drop function if exists public.kombi_code_wechseln(text, text, text);

create function public.kombi_code_wechseln(p_token text, p_alt text, p_neu text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  woher text;
  fehlversuche integer;
  treffer boolean;
  mein_fingerabdruck text;
  hinaus integer := 0;
begin
  -- Ein ungueltiger Sitzungsschluessel ist kein Rateversuch, sondern ein
  -- abgelaufenes Fenster. Der darf weiter eine Ausnahme sein.
  perform kombi.verlange_sitzung(p_token);

  woher := kombi.herkunft();

  select count(*) into fehlversuche
    from kombi.versuche
   where herkunft = woher
     and erfolg = false
     and zeitpunkt > now() - interval '15 minutes';

  if fehlversuche >= 10 then
    insert into kombi.versuche (herkunft, erfolg) values (woher, false);
    return jsonb_build_object('gelungen', false,
      'fehler', 'Zu viele Fehlversuche. Bitte in 15 Minuten noch einmal probieren.');
  end if;

  if p_neu is null or length(btrim(p_neu)) < 12 then
    -- Eine zu kurze Eingabe ist ein Bedienfehler, kein Rateversuch. Nicht zaehlen.
    return jsonb_build_object('gelungen', false,
      'fehler', 'Der neue Code muss mindestens 12 Zeichen haben.');
  end if;

  if btrim(p_neu) <> p_neu or p_neu ~ '\s' then
    return jsonb_build_object('gelungen', false,
      'fehler', 'Der neue Code darf keine Leerzeichen enthalten.');
  end if;

  select exists (
    select 1
      from kombi.zugangscodes z
     where z.aktiv
       and z.code_hash = extensions.crypt(coalesce(p_alt, ''), z.code_hash)
  ) into treffer;

  insert into kombi.versuche (herkunft, erfolg) values (woher, treffer);

  if not treffer then
    return jsonb_build_object('gelungen', false, 'fehler', 'Der bisherige Code stimmt nicht.');
  end if;

  if p_neu = p_alt then
    return jsonb_build_object('gelungen', false,
      'fehler', 'Der neue Code ist derselbe wie der alte.');
  end if;

  update kombi.zugangscodes
     set code_hash = extensions.crypt(p_neu, extensions.gen_salt('bf', 12))
   where aktiv;

  mein_fingerabdruck := encode(extensions.digest(p_token, 'sha256'), 'hex');
  delete from kombi.sitzungen where token_hash <> mein_fingerabdruck;
  get diagnostics hinaus = row_count;

  return jsonb_build_object('gelungen', true, 'fehler', null, 'hinausgeworfen', hinaus);
end;
$$;

revoke all on function public.kombi_code_einloesen(text) from public;
revoke all on function public.kombi_code_wechseln(text, text, text) from public;
grant execute on function public.kombi_code_einloesen(text) to anon, authenticated;
grant execute on function public.kombi_code_wechseln(text, text, text) to anon, authenticated;
