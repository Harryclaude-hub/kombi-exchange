-- Die Sitzungspruefung darf beim Lesen NICHT schreiben.
--
-- Gefunden beim ersten echten Durchlauf im Browser, nicht im Test.
--
-- Die lesenden Funktionen sind als "stable" deklariert. PostgREST fuehrt sie deshalb
-- in einer Nur-Lese-Transaktion aus. kombi.sitzung_gueltig hat darin den Zeitstempel
-- des letzten Zugriffs fortgeschrieben. Die Folge war, dass JEDES Lesen mit
--   cannot execute UPDATE in a read-only transaction
-- abbrach. Und zwar erst im Betrieb, weil in der Datenbankkonsole ohnehin
-- schreibend gearbeitet wird.
--
-- Ab jetzt ist Pruefen reines Lesen. Der Zeitstempel wird nur noch beim Schreiben
-- nachgezogen, wo ohnehin eine Schreibtransaktion laeuft.

create or replace function kombi.sitzung_gueltig(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(p_token) < 32 then
    return false;
  end if;

  return exists (
    select 1
      from kombi.sitzungen
     where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       and laeuft_ab_am > now()
  );
end;
$$;

create or replace function kombi.sitzung_beruehren(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update kombi.sitzungen
     set letzter_zugriff = now()
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and laeuft_ab_am > now();
end;
$$;

create or replace function kombi.verlange_sitzung(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not kombi.sitzung_gueltig(p_token) then
    raise exception 'Kein gueltiger Zugang. Bitte den Code erneut eingeben.'
      using errcode = '28000';
  end if;
  perform kombi.sitzung_beruehren(p_token);
end;
$$;

drop function if exists public.kombi_sitzung_pruefen(text);
create function public.kombi_sitzung_pruefen(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return kombi.sitzung_gueltig(p_token);
end;
$$;

revoke all on function public.kombi_sitzung_pruefen(text) from public;
grant execute on function public.kombi_sitzung_pruefen(text) to anon, authenticated;
