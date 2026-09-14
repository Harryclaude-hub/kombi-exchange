-- Ablage: Ordner und Anpinnen fuer Projekte
--
-- Karam am 14.09.2026: "Ein System wie beim Explorer, wo man all die Scheine
-- und die Kombis hat. Man kann hin und her verschieben, es soll uebersichtlich
-- sein, man soll Sachen anpinnen koennen, alles ist mit Datum beschriftet und
-- man kann es umbenennen."
--
-- Dafuer braucht ein Projekt zwei Felder mehr: in welchem Ordner es liegt und
-- ob es angepinnt ist. Name und Datum gibt es schon.
--
-- ORDNER SIND EIN TEXTFELD, KEINE EIGENE TABELLE.
--
-- Bewusst so. Ein Ordner ist hier nur ein Name, unter dem Projekte
-- zusammenstehen, und Verschieben heisst: das Textfeld aendern. Eine eigene
-- Tabelle mit Elternbeziehung braeuchte Fremdschluessel, Loeschregeln und eine
-- Pruefung auf Kreise. Das waere mehr Maschinerie als Nutzen, solange es keine
-- Ordner in Ordnern gibt. Kommt das spaeter, wird aus dem Textfeld ein Pfad
-- mit Schraegstrichen, ohne dass die Tabelle sich aendern muss.
--
-- Ein leerer Ordner heisst: liegt ganz oben, in keinem Ordner.

alter table kombi.projekte
  add column if not exists ordner text not null default '',
  add column if not exists angepinnt boolean not null default false;

create index if not exists projekte_ordner_idx on kombi.projekte (ordner);

-- ---------------------------------------------------------------------------
-- Speichern muss die zwei neuen Felder mitschreiben.
--
-- Die Funktion bleibt sonst genau wie in 0004: dieselbe Signatur, dieselbe
-- Fassungspruefung ueber kombi.fassung_weiter. Nur die zwei Zeilen kommen
-- dazu. Nichts nachbauen, was es schon gibt.
--
-- WICHTIG ist das coalesce auf den VORHANDENEN Wert: fehlt das Feld im Aufruf,
-- bleibt der alte stehen. Sonst wuerde ein Speichern aus einem anderen Grund
-- (Umbenennen, Waehrung) das Projekt stillschweigend aus seinem Ordner werfen
-- und den Pin loeschen. Genau so sind die Felder name und notiz schon gebaut.
-- ---------------------------------------------------------------------------

drop function if exists public.kombi_projekt_speichern(text, jsonb, integer);

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
       set name      = coalesce(p_projekt ->> 'name', name),
           notiz     = coalesce(p_projekt ->> 'notiz', notiz),
           waehrung  = coalesce(p_projekt ->> 'waehrung', waehrung),
           ordner    = coalesce(p_projekt ->> 'ordner', ordner),
           angepinnt = coalesce((p_projekt ->> 'angepinnt')::boolean, angepinnt)
     where id = kennung
    returning * into heraus;
  else
    insert into kombi.projekte (
      id, name, notiz, waehrung, ordner, angepinnt, angelegt_am, geaendert_am, fassung
    )
    values (
      kennung,
      coalesce(p_projekt ->> 'name', 'Ohne Namen'),
      coalesce(p_projekt ->> 'notiz', ''),
      coalesce(p_projekt ->> 'waehrung', 'UNBEKANNT'),
      coalesce(p_projekt ->> 'ordner', ''),
      coalesce((p_projekt ->> 'angepinnt')::boolean, false),
      coalesce((p_projekt ->> 'angelegtAm')::timestamptz, now()),
      now(),
      1
    )
    returning * into heraus;
  end if;

  return heraus;
end;
$$;

revoke all on function public.kombi_projekt_speichern(text, jsonb, integer) from public;
grant execute on function public.kombi_projekt_speichern(text, jsonb, integer) to anon, authenticated;
