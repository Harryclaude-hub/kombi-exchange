-- Zwei Luecken schliessen, die im Betrieb Geld oder Zugang kosten koennen.
--
-- 1. UEBERSCHREIBSCHUTZ
--    Bisher gewann beim Speichern immer der Letzte. Zwei Leute mit demselben
--    Code am selben Projekt haben sich gegenseitig ueberschrieben, ohne dass es
--    jemand gemerkt hat. Das ist genau die Sorte stiller Fehler, die spaeter
--    niemand mehr nachvollziehen kann.
--
--    Jedes Projekt bekommt jetzt eine Fassungsnummer. Wer speichert, sagt dazu,
--    welche Fassung er gelesen hat. Stimmt sie nicht mehr, wird NICHT
--    geschrieben, sondern ein Widerspruch gemeldet.
--
--    Wer die Fassung weglaesst, schreibt wie bisher ohne Pruefung. Damit
--    bleiben aeltere Browserfenster benutzbar, statt mit einem Fehler
--    stehenzubleiben.
--
-- 2. CODEWECHSEL
--    Der Zugangscode liess sich nur von Hand in der Datenbank aendern. Wenn er
--    einmal weitergegeben wird, gibt es keinen Weg zurueck. Jetzt gibt es einen,
--    und er wirft beim Wechsel alle anderen Sitzungen hinaus.

-- ---------------------------------------------------------------------------
-- 1. Fassungsnummer
-- ---------------------------------------------------------------------------

alter table kombi.projekte
  add column if not exists fassung integer not null default 1;

-- Prueft die Fassung und zaehlt sie in einem Zug hoch.
--
-- Beides muss in derselben Anweisung passieren. Waere es erst ein select und
-- dann ein update, koennten zwei gleichzeitige Aufrufe beide die Pruefung
-- bestehen und sich doch ueberschreiben. Das update mit Bedingung erledigt
-- Pruefen und Setzen in einem Schritt, und die Zeilensperre macht den zweiten
-- Aufrufer warten.
--
-- p_fassung null bedeutet: keine Pruefung, nur hochzaehlen.
create or replace function kombi.fassung_weiter(p_projekt uuid, p_fassung integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  neue integer;
  vorhanden integer;
begin
  update kombi.projekte
     set fassung = fassung + 1,
         geaendert_am = now()
   where id = p_projekt
     and (p_fassung is null or fassung = p_fassung)
  returning fassung into neue;

  if neue is not null then
    return neue;
  end if;

  -- Nichts geschrieben. Jetzt die beiden Gruende auseinanderhalten, statt
  -- pauschal "ging nicht" zu melden.
  select fassung into vorhanden from kombi.projekte where id = p_projekt;

  if vorhanden is null then
    raise exception 'Dieses Projekt gibt es nicht mehr.' using errcode = 'K0404';
  end if;

  raise exception
    'Das Projekt wurde zwischenzeitlich an anderer Stelle geaendert (Fassung % statt %). Es wurde nichts ueberschrieben.',
    vorhanden, p_fassung
    using errcode = 'K0409';
end;
$$;

comment on function kombi.fassung_weiter(uuid, integer) is
  'Prueft die gelesene Fassung und zaehlt hoch. K0409 = jemand anderes war schneller, K0404 = Projekt weg.';

-- ---------------------------------------------------------------------------
-- Die vier schreibenden Funktionen bekommen die Fassung dazu.
--
-- Die alten Fassungen werden entfernt und nicht danebengestellt. Zwei
-- Funktionen mit gleichem Namen waeren mehrdeutig, und dann entscheidet der
-- Zufall, welche laeuft.
-- ---------------------------------------------------------------------------

drop function if exists public.kombi_projekt_speichern(text, jsonb);

create function public.kombi_projekt_speichern(p_token text, p_projekt jsonb, p_fassung integer default null)
returns kombi.projekte
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  kennung uuid;
  heraus kombi.projekte;
begin
  perform kombi.verlange_sitzung(p_token);

  kennung := (p_projekt ->> 'id')::uuid;

  -- Beim ersten Anlegen gibt es noch nichts zu ueberschreiben.
  if exists (select 1 from kombi.projekte where id = kennung) then
    perform kombi.fassung_weiter(kennung, p_fassung);

    update kombi.projekte
       set name     = coalesce(p_projekt ->> 'name', name),
           notiz    = coalesce(p_projekt ->> 'notiz', notiz),
           waehrung = coalesce(p_projekt ->> 'waehrung', waehrung)
     where id = kennung
    returning * into heraus;
  else
    insert into kombi.projekte (id, name, notiz, waehrung, angelegt_am, geaendert_am, fassung)
    values (
      kennung,
      coalesce(p_projekt ->> 'name', 'Ohne Namen'),
      coalesce(p_projekt ->> 'notiz', ''),
      coalesce(p_projekt ->> 'waehrung', 'UNBEKANNT'),
      coalesce((p_projekt ->> 'angelegtAm')::timestamptz, now()),
      now(),
      1
    )
    returning * into heraus;
  end if;

  return heraus;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheine, Riesenscheine und Bildangaben.
--
-- Ihre Schreiblogik ist lang und funktioniert. Sie wird deshalb NICHT
-- abgeschrieben, sondern umgehaengt: die vorhandene Funktion wandert
-- unveraendert ins Schema kombi, und davor kommt eine kurze Huelle, die die
-- Fassung prueft und dann durchreicht.
--
-- Damit gibt es die Schreiblogik weiterhin genau einmal. Haette ich sie
-- abgetippt, gaebe es ab heute zwei Fassungen, und in einem halben Jahr
-- rechnete eine davon anders.
-- ---------------------------------------------------------------------------

alter function public.kombi_scheine_speichern(text, uuid, jsonb) set schema kombi;
alter function kombi.kombi_scheine_speichern(text, uuid, jsonb) rename to scheine_schreiben;
revoke all on function kombi.scheine_schreiben(text, uuid, jsonb) from anon, authenticated;

create function public.kombi_scheine_speichern(
  p_token text, p_projekt uuid, p_scheine jsonb, p_fassung integer default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform kombi.verlange_sitzung(p_token);
  perform kombi.fassung_weiter(p_projekt, p_fassung);
  return kombi.scheine_schreiben(p_token, p_projekt, p_scheine);
end;
$$;

alter function public.kombi_riesenscheine_speichern(text, uuid, jsonb) set schema kombi;
alter function kombi.kombi_riesenscheine_speichern(text, uuid, jsonb) rename to riesenscheine_schreiben;
revoke all on function kombi.riesenscheine_schreiben(text, uuid, jsonb) from anon, authenticated;

create function public.kombi_riesenscheine_speichern(
  p_token text, p_projekt uuid, p_liste jsonb, p_fassung integer default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform kombi.verlange_sitzung(p_token);
  perform kombi.fassung_weiter(p_projekt, p_fassung);
  return kombi.riesenscheine_schreiben(p_token, p_projekt, p_liste);
end;
$$;

alter function public.kombi_bilder_speichern(text, uuid, jsonb) set schema kombi;
alter function kombi.kombi_bilder_speichern(text, uuid, jsonb) rename to bilder_schreiben;
revoke all on function kombi.bilder_schreiben(text, uuid, jsonb) from anon, authenticated;

create function public.kombi_bilder_speichern(
  p_token text, p_projekt uuid, p_liste jsonb, p_fassung integer default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform kombi.verlange_sitzung(p_token);
  perform kombi.fassung_weiter(p_projekt, p_fassung);
  return kombi.bilder_schreiben(p_token, p_projekt, p_liste);
end;
$$;

-- Auch das Leeren zaehlt die Fassung hoch. Sonst arbeitet ein zweites Fenster
-- nach dem Leeren mit einer Liste weiter, die es nicht mehr gibt.
create or replace function public.kombi_projekt_leeren(p_token text, p_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  anzahl integer := 0;
begin
  perform kombi.verlange_sitzung(p_token);

  delete from kombi.riesenscheine where projekt_id = p_id;
  delete from kombi.scheine where projekt_id = p_id;
  get diagnostics anzahl = row_count;
  delete from kombi.bilder where projekt_id = p_id;

  perform kombi.fassung_weiter(p_id, null);

  return anzahl;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Codewechsel
--
-- Wer wechseln will, muss den alten Code kennen. Ein gueltiger Sitzungsschluessel
-- allein reicht nicht. Sonst koennte jemand, der einmal an einem offenen Fenster
-- sass, den Code aendern und alle anderen aussperren.
--
-- Nach dem Wechsel fliegen alle anderen Sitzungen raus. Genau dafuer wechselt
-- man ja: der alte Code ist irgendwo gelandet, wo er nicht hingehoert.
-- ---------------------------------------------------------------------------

create or replace function public.kombi_code_wechseln(p_token text, p_alt text, p_neu text)
returns integer
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
  perform kombi.verlange_sitzung(p_token);

  woher := kombi.herkunft();

  -- Dieselbe Bremse wie beim Anmelden. Sonst waere der Codewechsel die
  -- offene Hintertuer zum Durchprobieren.
  select count(*) into fehlversuche
    from kombi.versuche
   where herkunft = woher
     and erfolg = false
     and zeitpunkt > now() - interval '15 minutes';

  if fehlversuche >= 10 then
    raise exception 'Zu viele Fehlversuche. Bitte in 15 Minuten noch einmal probieren.'
      using errcode = '53400';
  end if;

  if p_neu is null or length(btrim(p_neu)) < 12 then
    raise exception 'Der neue Code muss mindestens 12 Zeichen haben.' using errcode = '22023';
  end if;

  if btrim(p_neu) <> p_neu or p_neu ~ '\s' then
    raise exception 'Der neue Code darf keine Leerzeichen enthalten.' using errcode = '22023';
  end if;

  select exists (
    select 1
      from kombi.zugangscodes z
     where z.aktiv
       and z.code_hash = extensions.crypt(coalesce(p_alt, ''), z.code_hash)
  ) into treffer;

  insert into kombi.versuche (herkunft, erfolg) values (woher, treffer);

  if not treffer then
    raise exception 'Der bisherige Code stimmt nicht.' using errcode = '28P01';
  end if;

  if p_neu = p_alt then
    raise exception 'Der neue Code ist derselbe wie der alte.' using errcode = '22023';
  end if;

  update kombi.zugangscodes
     set code_hash = extensions.crypt(p_neu, extensions.gen_salt('bf', 12))
   where aktiv;

  -- Alle anderen hinaus, das eigene Fenster bleibt offen.
  mein_fingerabdruck := encode(extensions.digest(p_token, 'sha256'), 'hex');

  delete from kombi.sitzungen where token_hash <> mein_fingerabdruck;
  get diagnostics hinaus = row_count;

  return hinaus;
end;
$$;

comment on function public.kombi_code_wechseln(text, text, text) is
  'Wechselt den Zugangscode. Verlangt den alten Code und wirft alle anderen Sitzungen hinaus.';

-- ---------------------------------------------------------------------------
-- Rechte. Die neu angelegten Signaturen brauchen sie erneut, die alten sind
-- mit den alten Funktionen verschwunden.
-- ---------------------------------------------------------------------------

revoke all on function public.kombi_projekt_speichern(text, jsonb, integer) from public;
revoke all on function public.kombi_scheine_speichern(text, uuid, jsonb, integer) from public;
revoke all on function public.kombi_riesenscheine_speichern(text, uuid, jsonb, integer) from public;
revoke all on function public.kombi_bilder_speichern(text, uuid, jsonb, integer) from public;
revoke all on function public.kombi_code_wechseln(text, text, text) from public;

grant execute on function public.kombi_projekt_speichern(text, jsonb, integer) to anon, authenticated;
grant execute on function public.kombi_scheine_speichern(text, uuid, jsonb, integer) to anon, authenticated;
grant execute on function public.kombi_riesenscheine_speichern(text, uuid, jsonb, integer) to anon, authenticated;
grant execute on function public.kombi_bilder_speichern(text, uuid, jsonb, integer) to anon, authenticated;
grant execute on function public.kombi_code_wechseln(text, text, text) to anon, authenticated;
