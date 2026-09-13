-- Ein doppelt hochgeladener Schein darf nicht den ganzen Stapel kippen.
--
-- DER FEHLER
--
-- Auf kombi.scheine liegt ein Eindeutigkeitsschluessel:
--   (projekt_id, buchmacher, konto, waehrung, schein_nr)
-- Er ist richtig und soll bleiben. Er verhindert, dass derselbe Schein zweimal
-- in der Summe landet.
--
-- Das Speichern faengt aber nur Konflikte auf der id ab ("on conflict (id)").
-- Kommt derselbe Schein mit einer NEUEN id noch einmal an, schlaegt der
-- Eindeutigkeitsschluessel zu, und weil alle Scheine in einer einzigen
-- Anweisung geschrieben werden, faellt der GANZE Stapel um.
--
-- Beobachtet mit sechzig Scheinen: "0 von 60 waren schon gespeichert". Ein
-- einziger doppelter Schein, und nichts wird gesichert.
--
-- Wann das passiert: dasselbe Bildschirmfoto ein zweites Mal hochgeladen, aus
-- einem anderen Fenster oder nach einem Geraetewechsel. Bei sechzig Scheinen
-- ueber achtzehn Anbieter passiert genau das dauernd.
--
-- DIE LOESUNG
--
-- Vor dem Schreiben bekommen Scheine, die es unter derselben Kennung schon
-- gibt, deren id. Damit werden sie aktualisiert statt eingefuegt, und der
-- Eindeutigkeitsschluessel wird gar nicht erst verletzt.
--
-- Bewusst NICHT gewaehlt: die alte Zeile loeschen und neu einfuegen. Dabei
-- wechselt die id, und alles, was an dieser id haengt, zeigt ins Leere.

create or replace function kombi.ids_auf_vorhandene_umbiegen(p_projekt uuid, p_scheine jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  heraus jsonb;
begin
  if jsonb_typeof(p_scheine) <> 'array' then
    return p_scheine;
  end if;

  select coalesce(jsonb_agg(angepasst order by ord), '[]'::jsonb)
    into heraus
  from (
    select
      t.ord,
      case
        when vorhanden.id is not null and vorhanden.id::text <> (t.e ->> 'id')
          then jsonb_set(t.e, '{id}', to_jsonb(vorhanden.id::text))
        else t.e
      end as angepasst
    from jsonb_array_elements(p_scheine) with ordinality as t(e, ord)
    left join lateral (
      select s.id
        from kombi.scheine s
       where s.projekt_id = p_projekt
         and nullif(t.e -> 'scheinNr' ->> 'wert', '') is not null
         and s.schein_nr = nullif(t.e -> 'scheinNr' ->> 'wert', '')
         and lower(coalesce(s.buchmacher, '')) =
             lower(coalesce(nullif(t.e -> 'buchmacher' ->> 'wert', ''), ''))
         and lower(coalesce(s.konto, '')) =
             lower(coalesce(nullif(t.e -> 'konto' ->> 'wert', ''), ''))
         and s.waehrung = coalesce(t.e -> 'waehrung' ->> 'wert', 'UNBEKANNT')
       limit 1
    ) vorhanden on true
  ) as umgebogen;

  return heraus;
end;
$$;

comment on function kombi.ids_auf_vorhandene_umbiegen(uuid, jsonb) is
  'Gibt Scheinen, die es unter derselben Kennung schon gibt, deren id, damit sie aktualisiert statt eingefuegt werden.';

-- Zwei Eintraege im selben Stapel duerfen nicht auf dieselbe id zeigen.
-- Postgres kann eine Zeile in EINER Anweisung nur einmal treffen, sonst bricht
-- das Schreiben ab. Der letzte Eintrag gewinnt, weil er der zuletzt gelesene ist.
create or replace function kombi.nach_id_entdoppeln(p_scheine jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
    from (
      select distinct on (e ->> 'id') e, ord
        from jsonb_array_elements(p_scheine) with ordinality as t(e, ord)
       order by e ->> 'id', ord desc
    ) as letzte;
$$;

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
  vorbereitet jsonb;
begin
  perform kombi.verlange_sitzung(p_token);
  neue := kombi.fassung_weiter(p_projekt, p_fassung);

  vorbereitet := kombi.nach_id_entdoppeln(
    kombi.ids_auf_vorhandene_umbiegen(p_projekt, p_scheine)
  );

  anzahl := kombi.scheine_schreiben(p_token, p_projekt, vorbereitet);
  return jsonb_build_object('fassung', neue, 'anzahl', anzahl);
end;
$$;

revoke all on function public.kombi_scheine_speichern(text, uuid, jsonb, integer) from public;
grant execute on function public.kombi_scheine_speichern(text, uuid, jsonb, integer) to anon, authenticated;
