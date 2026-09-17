-- Ordner fuer Riesenscheine: in die Datenbank, nicht in den Browser
--
-- Karam am 17.09.2026: "Du musst verstehen, dieses Programm ist ein Account.
-- Es wird alles auf einer Datenbank gespeichert, in Supabase. Und ich sehe
-- jedes Foto, jeden Schein, den eine Person macht, und die Person genauso bei
-- mir. Das ist kein eigenes Profil. Das ist einfach DAS Profil."
--
-- WARUM ES DIESE MIGRATION GIBT
--
-- Am 17.09.2026 habe ich die Ordner fuer Riesenscheine in den Browserspeicher
-- gelegt, weil kombi.riesenscheine keine Spalte dafuer hatte. Im Programm
-- stand daraufhin, die Ordner lagen "nur auf diesem Geraet" und wanderten
-- nicht zum Kollegen. Das klang wie eine Eigenschaft des Programms. Es war
-- eine fehlende Spalte, mehr nicht.
--
-- In diesem Programm gibt es genau einen Zugang. Wer den Code hat, sieht
-- alles: dieselben Projekte, dieselben Scheine, dieselben Bilder. Ein Ordner,
-- den nur einer sieht, passt da nicht hinein. Er gehoert an denselben Ort wie
-- Name und Notiz des Riesenscheins: in die Zeile.
--
-- EIN ORDNER IST EIN TEXTFELD, KEINE EIGENE TABELLE.
--
-- Genau wie bei den Projekten in 0008, und aus denselben Gruenden: ein Ordner
-- ist nur ein Name, unter dem Riesenscheine zusammenstehen. Verschieben heisst,
-- das Textfeld aendern. Leerer Text heisst: in keinem Ordner. Ein Ordner
-- besteht, solange ein Riesenschein darin liegt, und verschwindet sonst von
-- selbst. Es gibt keine Ordner in Ordnern; kaeme das, wird aus dem Textfeld ein
-- Pfad mit Schraegstrichen, ohne dass sich die Tabelle aendern muss.
--
-- WAS HIER ANGEFASST WIRD, UND WAS AUSDRUECKLICH NICHT
--
-- Angefasst:  die Spalte, ein Index, und kombi.riesenscheine_schreiben.
-- Nicht angefasst:  public.kombi_riesenscheine_speichern(text, uuid, jsonb,
--                   integer). Das ist die Funktion, die das Programm ruft, und
--                   sie bleibt Zeichen fuer Zeichen, wie sie ist.
--
-- DAS IST DIE STELLE, AN DER ICH BEIM SCHREIBEN FAST DANEBENGEGRIFFEN HAETTE.
-- In 0001 hiess die schreibende Funktion public.kombi_riesenscheine_speichern
-- (text, uuid, jsonb). In 0004 ist sie nach kombi.riesenscheine_schreiben
-- umgezogen, und in public steht seither nur noch eine Huelle, die die Fassung
-- hochzaehlt und dann die innere ruft. Wer die alte Signatur in public neu
-- anlegt, bekommt eine ZWEITE Funktion, die niemand ruft: der Ordner waere
-- gespeichert worden, ohne dass je ein Ordner ankommt, und nichts haette
-- gemeldet, dass etwas fehlt.
--
-- kombi_riesenscheine_lesen braucht KEINE Aenderung. Es gibt
-- "setof kombi.riesenscheine" zurueck und waehlt mit *, also traegt es die neue
-- Spalte von selbst mit.
--
-- DIESE MIGRATION NIMMT NICHTS WEG.
--
--   Die Spalte kommt mit Vorgabe hinzu, also aendert sich an keiner
--   bestehenden Zeile ein Wert.
--   Die Funktion wird durch dieselbe Funktion mit einem Feld mehr ersetzt.
--
-- Zweimal laufen lassen richtet nichts an: "if not exists" bei Spalte und
-- Index, "create or replace" bei der Funktion.

alter table kombi.riesenscheine
  add column if not exists ordner text not null default '';

create index if not exists riesenscheine_ordner_idx
  on kombi.riesenscheine (projekt_id, ordner);

-- ---------------------------------------------------------------------------
-- Schreiben muss das neue Feld mitnehmen.
--
-- Wortgleich die Fassung aus 0001, nur mit ordner in der Spaltenliste, im
-- select und im "on conflict".
--
-- WER DIESE FUNKTION AUFRUFT, MUSS DEN RIESENSCHEIN VOLLSTAENDIG UEBERGEBEN.
-- Fehlt ordner im Aufruf, wird daraus ein leerer Text, und der Riesenschein
-- liegt danach in keinem Ordner. Genau so verhalten sich name, signatur und
-- notiz hier seit 0001 auch, und das Programm schreibt immer die GANZE Liste
-- eines Projekts aus einem einzigen Arbeitsstand heraus.
--
-- Bei den PROJEKTEN (0008) steht deshalb ein coalesce auf den vorhandenen
-- Wert und hier nicht: dort wird EIN Projekt von vielen Stellen aus einzeln
-- geaendert (Umbenennen, Anpinnen, Waehrung). Hier gibt es keinen Teilaufruf.
-- Ein coalesce koennte hier ausserdem gar nicht ausdruecken, dass ein
-- Riesenschein aus seinem Ordner HERAUS soll: leer IST dieser Befehl.
-- ---------------------------------------------------------------------------

create or replace function kombi.riesenscheine_schreiben(p_token text, p_projekt uuid, p_liste jsonb)
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

  if jsonb_typeof(p_liste) <> 'array' then
    raise exception 'Es wurde keine Liste uebergeben.' using errcode = '22023';
  end if;

  insert into kombi.riesenscheine (id, projekt_id, name, signatur, schein_ids, notiz, ordner, geaendert_am)
  select
    (e ->> 'id')::uuid,
    p_projekt,
    coalesce(e ->> 'name', ''),
    coalesce(e ->> 'signatur', ''),
    coalesce(
      (select array_agg(x::uuid) from jsonb_array_elements_text(e -> 'scheinIds') as x),
      '{}'::uuid[]
    ),
    coalesce(e ->> 'notiz', ''),
    coalesce(e ->> 'ordner', ''),
    now()
  from jsonb_array_elements(p_liste) as e
  on conflict (id) do update
    set name = excluded.name,
        signatur = excluded.signatur,
        schein_ids = excluded.schein_ids,
        notiz = excluded.notiz,
        ordner = excluded.ordner,
        geaendert_am = now();

  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

-- Die innere Funktion bleibt von aussen unerreichbar, so wie seit 0004.
revoke all on function kombi.riesenscheine_schreiben(text, uuid, jsonb) from public, anon, authenticated;
