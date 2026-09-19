# Die Grenze zwischen den Programmen

Karam am 18.09.2026:

> Mach klare Trennungen zwischen den Projekten in der Datenbank. Ich will nie,
> dass sich irgendwas mischt. Weder Daten noch irgendwas. Und auch fuer die
> neuen Chats, wenn ich da was arbeite und mit der Datenbank mache, muss das
> wirklich klar getrennt sein, keine Fehler, kein Durcheinander. So dass wenn
> ich mich vielleicht entscheide, 10 Dollar mehr zu zahlen, dass ich die
> Moeglichkeit haette, diese Projekte ganz gut und ohne Probleme in
> unterschiedliche Projekte in Supabase aufzuteilen. Das ist sehr wichtig.

Diese Datei ist die Antwort darauf. Sie gilt fuer jeden kuenftigen Chat.

---

## 1. Wer wem gehoert

In dem einen Supabase-Projekt `mqmevpyatjsambervgtu` liegen drei Programme
nebeneinander:

| Programm | Wohnt in | Umfang |
|---|---|---|
| **Kombi Exchange** (dieses) | Schema `kombi` + Tueren `public.kombi_*` | 7 Tabellen, 25 Funktionen |
| **Kombi Tafel** | `public.kt_*` | 22 Tabellen, 15 Funktionen |
| **immo-check** | `public`, ohne Vorsilbe | 13 Tabellen, 6 Funktionen |

Dazu drei Speichereimer, die **alle drei nicht** Kombi Exchange gehoeren:
`kt-medien`, `check-fotos`, `app`.

**Die Regel in einem Satz:** Kombi Exchange fasst ausschliesslich `kombi.*` und
`public.kombi_*` an. Alles andere ist fremd, auch wenn es erreichbar ist.

Das gilt in beide Richtungen. `kt_` ist nicht "auch von Karam und deshalb okay",
sondern ein anderes Programm mit eigenem Lebenslauf.

---

## 2. Wie die Grenze gehalten wird

Zwei Waende, keine Anleitung. Anleitungen werden ueberlesen.

### Wand 1: im Programm

`daten/datenbank.js`, Funktion `rufe()`. Das ist der **einzige** Ort, an dem
dieses Programm die Datenbank beruehrt: jeder Aufruf geht durch ihn hindurch.
Er nimmt nur Namen an, die **beides** erfuellen: die Form
`^kombi_[a-z][a-z0-9_]*$` und einen Eintrag in der Liste `TUEREN` in
`daten/grenze.js`.

Beide Tore werden gebraucht. Die Form faengt Pfadausbrueche ab, also
Schraegstrich, Punkt und Fragezeichen, bevor eine Adresse zusammengebaut wird.
Die Liste faengt den Tippfehler: `kombi_scheine_lsen` hat die richtige Form und
stuerbe sonst erst draussen als 404, was im Browser aussieht wie ein
Netzproblem.

```js
rufe('kombi_scheine_lesen', ...)   // geht
rufe('kt_wetten_archivieren', ...) // wirft sofort, mit Erklaerung
```

Bewiesen in `test/trennung.test.mjs`: die vierzehn eigenen Tueren gehen auf,
zehn echte fremde Namen aus derselben Datenbank werden abgewiesen, und keiner
davon landet im Netz.

### Wand 2: vor den Wanderungen

`werkzeug/pruefe.mjs`, Abschnitt "Die Grenze zwischen den Programmen". Die
Wanderungen laufen **nicht** durch `rufe()`, sondern werden von Hand in den
SQL-Editor eingefuegt. Dort ist der Schaden am groessten, weil ein
`drop table scheine` ohne Schema in `public` landet und dort etwas Fremdes
trifft.

Sieben Fragen, vier an jede Datei in `supabase/migrations/`:

1. Kommt ein Name eines fremden Programms vor?
2. Wird etwas in `public` angelegt, das nicht `kombi_` heisst?
3. Wird ein Objekt **ohne Schema** angesprochen?
4. Wird ein fremdes Schema angefasst?

Und drei, die erst am 18.09.2026 dazukamen, weil ein Gegenleser gezeigt hat,
dass die ersten vier sie durchlassen:

5. **Verbotene Zeilen.** `grant ... on all ... in schema public`,
   `drop extension`, `grant ... to public`, `alter role`. Keine davon enthaelt
   ein fremdes Wort, und jede einzelne wuerde alle drei Programme in einem Zug
   vermischen oder aufschliessen.
6. **Eine neue Funktion ohne `set search_path = ''`.** Ohne leeren Suchpfad
   laesst sich eine Funktion mit `security definer` auf eine fremde Tabelle
   umlenken.
7. **Der Abgleich der vierzehn Tueren ueber drei Orte:** `daten/grenze.js`, die
   Wanderungen und die Aufrufe in `daten/datenbank.js`. Gemeldet wird mit
   Richtung, also vergessener Eintrag, Tippfehler oder tote Tuer.

### Wand 3: es gibt genau eine Tuer

Die Wand in `rufe()` prueft NAMEN. Sie haelt niemanden davon ab, in einer neuen
Datei selbst ein `fetch` auf `/rest/v1/` zu bauen und damit an ihr vorbeizugehen.

Deshalb darf ausser `daten/datenbank.js` und `daten/einstellungen.js` **keine
Datei die Adresse der Datenbank auch nur erwaehnen.** Proben sind ausgenommen:
eine Probe, die beweist, dass die Wand haelt, muss nennen koennen, was sie
aussperrt.

### Nachgewiesen

Mit absichtlich falschen Dateien: **zwoelf von zwoelf Verstoessen gefangen**,
die richtig geschriebenen Zeilen unbehelligt, und Beispiele in Kommentaren
loesen nichts aus. Das war noetig: zwei der Regeln haben beim ersten Lauf ihre
eigenen Erklaerungstexte beanstandet.

---

## 3. Der Stand, gemessen

Am 18.09.2026 in der laufenden Datenbank nachgesehen:

| Frage | Antwort |
|---|---|
| Greift eine `kombi`-Funktion nach draussen? | keine einzige |
| Greift eine fremde Funktion nach `kombi`? | keine einzige |
| Laeuft ein Fremdschluessel ueber die Schemagrenze? | keiner aus `kombi` heraus |
| Hat jede `kombi`-Funktion einen leeren Suchpfad? | alle elf |
| Benutzt Kombi Exchange `auth.users`? | nein, es hat den eigenen Sperrcode |
| Benutzt Kombi Exchange einen Speichereimer? | nein |

Die letzten beiden sind der Grund, warum ein Umzug einfach ist: es haengt
nichts an der Supabase-Anmeldung und nichts am Dateispeicher.

Zum Nachmessen, im SQL-Editor:

```sql
-- Was gehoert wem?
select case
         when n.nspname = 'kombi' then 'Kombi Exchange'
         when p.proname like 'kombi\_%' then 'Kombi Exchange'
         when p.proname like 'kt\_%' then 'Kombi Tafel'
         else 'immo-check'
       end as gehoert_zu,
       count(*) as funktionen
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'kombi')
 group by 1 order by 1;

-- Greift jemand ueber die Grenze?
select n.nspname || '.' || p.proname as greift_nach_draussen
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'kombi' and p.prosrc ~ '\y(kt_|public\.)';

select n.nspname || '.' || p.proname as greift_nach_kombi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname not like 'kombi\_%'
   and p.prosrc ~ '\ykombi\.';
```

Beide letzten Abfragen muessen **null Zeilen** liefern.

---

## 4. Der Umzug in ein eigenes Projekt

Wenn Karam die 10 Dollar zahlt und Kombi Exchange ein eigenes Supabase-Projekt
bekommt. Dauer: rund zwanzig Minuten.

**Schritt 1.** Neues Projekt anlegen. Kennung und Regionsangabe notieren.

**Schritt 2.** Die zehn Wanderungen aus `supabase/migrations/` der Reihe nach
im SQL-Editor des **neuen** Projekts ausfuehren, 0001 bis 0010. Sie sind
vollstaendig: Schema, Tabellen, Indizes, Rechte, alle vierzehn Tueren, und
0010 sperrt den Zugangscode wieder zu.

**Schritt 3.** Die Daten mitnehmen. Im **alten** Projekt:

```sql
select 'insert into kombi.projekte (id,name,notiz,waehrung,ordner,angepinnt,angelegt_am,fassung) values ('
       || quote_literal(id) || ',' || quote_literal(name) || ',' || quote_literal(notiz) || ','
       || quote_literal(waehrung) || ',' || quote_literal(ordner) || ',' || angepinnt || ','
       || quote_literal(angelegt_am) || ',' || fassung || ');'
  from kombi.projekte;
```

Dasselbe Muster fuer `kombi.scheine`, `kombi.riesenscheine` und `kombi.bilder`.
Das Ergebnis herauskopieren und im neuen Projekt ausfuehren.

Reihenfolge einhalten: erst `projekte`, dann der Rest. Die anderen drei haengen
per Fremdschluessel daran.

**Schritt 4.** Den Sperrcode neu setzen, ueber `werkzeug/code_setzen.html`.
Der alte Code wird **nicht** mitgenommen: in `kombi.zugangscodes` steht nur
ein bcrypt-Fingerabdruck, und daraus kommt niemand zum Code zurueck. Das ist
kein Mangel, sondern der Sinn der Sache.

**Schritt 5.** In `daten/einstellungen.js` `adresse` und `schluessel` auf das
neue Projekt umstellen, `PROGRAMM_FASSUNG` und `fassung.json` hochzaehlen,
`npm test` und `node werkzeug/pruefe.mjs` laufen lassen, hochladen.

**Schritt 6.** Erst wenn im neuen Projekt alles steht und geprueft ist:
im alten `drop schema kombi cascade;`. Nicht frueher.

### Die gefaehrlichste Stelle

Schritt 6. Ein `drop schema` im **falschen** Projekt, oder zu frueh, ist nicht
rueckholbar.

Absicherung: vor dem `drop` im alten Projekt nachzaehlen, dass das neue
dieselben Zahlen hat.

```sql
select (select count(*) from kombi.projekte)     as projekte,
       (select count(*) from kombi.scheine)      as scheine,
       (select count(*) from kombi.riesenscheine) as riesenscheine,
       (select count(*) from kombi.bilder)       as bilder;
```

Beide Projekte muessen dieselbe Zeile liefern. Stimmt eine Zahl nicht, wird
nichts geloescht.

---

## 5. Fuer den naechsten Chat

Wer in diesem Projekt an der Datenbank arbeitet, haelt sich an drei Saetze:

1. **Nur `kombi.*` und `public.kombi_*`.** Nichts sonst, auch nicht lesend,
   auch nicht "nur kurz nachsehen".
2. **Jede Wanderung schreibt das Schema hin.** Nie `create table scheine`,
   immer `create table kombi.scheine`. Im SQL-Editor zeigt der Suchpfad auf
   `public`, und dort wohnt ein anderes Programm.
3. **`node werkzeug/pruefe.mjs` vor jedem Hochladen.** Die Grenzregel laeuft
   dort mit und meldet jeden Verstoss mit Datei und Namen.

Wer den Sperrcode betrifft: `kombi.zugangscodes` wird **von keinem Chat
angefasst**, weder angelegt noch geaendert. Das macht Karam selbst ueber
`werkzeug/code_setzen.html`. Sein Wort vom 16.09.2026: "Bitte lass ihn nie
wieder aendern. Der soll einfach gleich bleiben. Ausser ich schreibe das in
diesen Chat, ich muss diesen Code aendern."
