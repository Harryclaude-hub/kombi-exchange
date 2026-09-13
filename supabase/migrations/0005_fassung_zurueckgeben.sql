-- Nachtrag zu 0004.
--
-- Der Fehler: ein Speichervorgang schreibt nacheinander die Scheine UND die
-- Riesenscheine. Der erste Aufruf zaehlt die Fassung hoch. Der zweite kaeme
-- dann mit der inzwischen veralteten Fassung an und wuerde gegen den ersten
-- Aufruf desselben Nutzers laufen. Der Schutz haette also genau den blockiert,
-- den er schuetzen soll.
--
-- Die Loesung: jede schreibende Funktion gibt die neue Fassung zurueck. Der
-- Browser reicht sie an den naechsten Aufruf weiter und weiss am Ende, auf
-- welchem Stand er ist.
--
-- Zurueckgegeben wird jetzt jsonb statt einer blossen Zahl, damit die Anzahl
-- nicht verlorengeht.

drop function if exists public.kombi_scheine_speichern(text, uuid, jsonb, integer);

create function public.kombi_scheine_speichern(
  p_token text, p_projekt uuid, p_scheine jsonb, p_fassung integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  neue integer;
  anzahl integer;
begin
  perform kombi.verlange_sitzung(p_token);
  neue := kombi.fassung_weiter(p_projekt, p_fassung);
  anzahl := kombi.scheine_schreiben(p_token, p_projekt, p_scheine);
  return jsonb_build_object('fassung', neue, 'anzahl', anzahl);
end;
$$;

drop function if exists public.kombi_riesenscheine_speichern(text, uuid, jsonb, integer);

create function public.kombi_riesenscheine_speichern(
  p_token text, p_projekt uuid, p_liste jsonb, p_fassung integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  neue integer;
  anzahl integer;
begin
  perform kombi.verlange_sitzung(p_token);
  neue := kombi.fassung_weiter(p_projekt, p_fassung);
  anzahl := kombi.riesenscheine_schreiben(p_token, p_projekt, p_liste);
  return jsonb_build_object('fassung', neue, 'anzahl', anzahl);
end;
$$;

drop function if exists public.kombi_bilder_speichern(text, uuid, jsonb, integer);

create function public.kombi_bilder_speichern(
  p_token text, p_projekt uuid, p_liste jsonb, p_fassung integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  neue integer;
  anzahl integer;
begin
  perform kombi.verlange_sitzung(p_token);
  neue := kombi.fassung_weiter(p_projekt, p_fassung);
  anzahl := kombi.bilder_schreiben(p_token, p_projekt, p_liste);
  return jsonb_build_object('fassung', neue, 'anzahl', anzahl);
end;
$$;

drop function if exists public.kombi_projekt_leeren(text, uuid);

create function public.kombi_projekt_leeren(p_token text, p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  anzahl integer := 0;
  neue integer;
begin
  perform kombi.verlange_sitzung(p_token);

  delete from kombi.riesenscheine where projekt_id = p_id;
  delete from kombi.scheine where projekt_id = p_id;
  get diagnostics anzahl = row_count;
  delete from kombi.bilder where projekt_id = p_id;

  neue := kombi.fassung_weiter(p_id, null);

  return jsonb_build_object('fassung', neue, 'anzahl', anzahl);
end;
$$;

revoke all on function public.kombi_scheine_speichern(text, uuid, jsonb, integer) from public;
revoke all on function public.kombi_riesenscheine_speichern(text, uuid, jsonb, integer) from public;
revoke all on function public.kombi_bilder_speichern(text, uuid, jsonb, integer) from public;
revoke all on function public.kombi_projekt_leeren(text, uuid) from public;

grant execute on function public.kombi_scheine_speichern(text, uuid, jsonb, integer) to anon, authenticated;
grant execute on function public.kombi_riesenscheine_speichern(text, uuid, jsonb, integer) to anon, authenticated;
grant execute on function public.kombi_bilder_speichern(text, uuid, jsonb, integer) to anon, authenticated;
grant execute on function public.kombi_projekt_leeren(text, uuid) to anon, authenticated;
