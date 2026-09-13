-- Ein Projekt leeren, ohne es zu loeschen.
--
-- Scheine, Riesenscheine und Bildangaben gehen weg, das Projekt selbst bleibt.
--
-- Warum in einem Aufruf und nicht Schein fuer Schein: anonyme Aufrufe haben bei
-- Supabase nur drei Sekunden Rechenzeit, und jeder einzelne Aufruf kostet eine
-- eigene Runde durch das Netz. Bei hunderten Scheinen wuerde das nie fertig.

drop function if exists public.kombi_projekt_leeren(text, uuid);
create function public.kombi_projekt_leeren(p_token text, p_id uuid)
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

  delete from kombi.scheine where projekt_id = p_id;
  get diagnostics anzahl = row_count;

  delete from kombi.riesenscheine where projekt_id = p_id;
  delete from kombi.bilder where projekt_id = p_id;

  return anzahl;
end;
$$;

revoke all on function public.kombi_projekt_leeren(text, uuid) from public;
grant execute on function public.kombi_projekt_leeren(text, uuid) to anon, authenticated;
