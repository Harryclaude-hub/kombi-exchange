# Kombi Exchange

Riesenschein-Terminal. Wettscheine aus Bildschirmfotos lesen, gleiche Wetten zu einer
Grosskombi zusammenfuehren, als ein Blatt und als Excel-Mappe ausgeben.

Die Texterkennung laeuft vollstaendig im Browser. Es wird kein Dienst gefragt, keine
kuenstliche Intelligenz von aussen aufgerufen und kein Bild hochgeladen.

---

## Was es macht

Du setzt dieselbe Wette bei vielen Buchmachern, oft zwanzig Mal und mehr. Danach hast du
zwanzig Bildschirmfotos und keine Uebersicht. Dieses Programm macht daraus eine Zahl.

1. **Bilder hochladen.** Bildschirmfotos deiner Wettuebersicht, gern schon zugeschnitten.
2. **Schnitte pruefen.** Das Programm erkennt die einzelnen Wettkarten und zeigt die
   Schnittkanten. Jede Kante laesst sich ziehen, jede Karte laesst sich herausnehmen
   oder teilen. Die Wette ganz unten, die nicht dazugehoert, nimmst du hier weg.
3. **Lesen.** Aus jeder Karte werden Anbieter, Konto, Scheinnummer, Zeitpunkt, Status,
   Einsatz, Quote, Auszahlung und alle Auswahlen gelesen.
4. **Pruefen und berichtigen.** Jedes Feld ist aenderbar. Die Farbe hinter einem Feld sagt,
   wie sicher die Erkennung war. Was von Hand gesetzt wurde, wird nie wieder ueberschrieben.
5. **Riesenschein.** Gleiche Wetten werden automatisch zu einer Position zusammengefasst,
   auch wenn zwei Anbieter verschieden schreiben.
6. **Ausgeben.** Ein Blatt mit allen Scheinen untereinander plus Kopfzeile mit den Summen,
   und dieselbe Sache als Excel-Mappe mit lebenden Formeln zum Nachrechnen.

---

## Loslegen

Es gibt keinen Bauschritt. Die Seite besteht aus Dateien und laeuft direkt.

```bash
node werkzeug/server.mjs
```

Dann `http://localhost:4173` oeffnen. Fuer den Betrieb reicht jeder Webspeicher, der
statische Dateien ausliefert, zum Beispiel GitHub Pages.

### Pruefen

```bash
node --test test/*.test.mjs
node werkzeug/pruefe.mjs
```

Der erste Aufruf rechnet die Mathematik durch, der zweite prueft Importpfade,
Bibliotheken und die Trennung von Design und Funktion.

---

## Wie es aufgebaut ist

```
index.html          Einstieg. Laedt die Designschicht und startet das Programm.

kern/               Reine Logik. Kein Browser noetig, mit node testbar.
  typen.js          Form der Daten. Keine Logik.
  zahlen.js         Zahlen aus Texterkennung lesen. Trennzeichen, verlesene Ziffern.
  quoten.js         Quoten-Mathematik und die zentrale Gegenrechnung.
  status.js         Was ein Status bedeutet. Einzige Stelle dafuer.
  geld.js           Geldbetraege, gerechnet in ganzen Cent.
  zeitpunkt.js      Datum und Uhrzeit aus dem Schein.
  etiketten.js      Die Woerter, an denen die Felder haengen. Reine Liste.
  buchmacher.js     Anbieter und Konto erkennen.
  parser.js         Aus Textzeilen wird ein Schein.
  kennung.js        Sind zwei Scheine dieselbe Wette.
  gruppierung.js    Scheine zu Riesenscheinen buendeln, Doppelte zusammenfuehren.
  rechnung.js       Alle Summen. Werden immer neu gerechnet, nie gespeichert.

bild/               Bildverarbeitung auf der Leinwand.
  vorverarbeitung.js  Vergroessern, Graustufen, Kontrast. Foto anders als Bildschirmfoto.
  segmentierung.js    Das Bild in einzelne Wettkarten zerlegen.
  mosaik.js           Der Riesenschein als ein Blatt.

lesen/ocr.js        Texterkennung in zwei Durchgaengen.
ausgabe/            Excel, CSV, Datei anbieten.
daten/              Datenbank, lokale Ablage, Einstellungen.
oberflaeche/        Die Ansichten. Setzen Klassennamen, keine Farben.
stil/               DESIGNSCHICHT. Darf komplett geloescht werden.
lib/                Mitgelieferte Bibliotheken. Kein Internet noetig.
supabase/           Das Datenbankschema.
test/               Tests fuer die Logik.
werkzeug/           Server zum Ausprobieren und die Gegenprobe.
```

### Design und Funktion sind getrennt

Der ganze Ordner `stil/` und die Datei `stil/buehne.js` duerfen geloescht werden.
Danach sieht die Seite nackt aus und funktioniert vollstaendig weiter. Im JavaScript
ausserhalb von `stil/` und `bild/` steht keine einzige Farbe. `werkzeug/pruefe.mjs`
prueft das bei jedem Durchlauf nach.

Bewegung laesst sich in drei Stufen schalten, siehe `stil/buehne.js`.
Stufe 1 ist die Vorgabe. Stufe 0 schaltet jede Bewegung ab.

---

## Die Rechnung

Die drei Zahlengruppen sind streng getrennt und duerfen sich nie widersprechen.

| Gruppe | Zahlen |
|---|---|
| Was eingesetzt wurde | Gesamteinsatz, davon offen, davon entschieden |
| Was schon passiert ist | Bisher zurueck, Ergebnis bisher |
| Was noch passieren kann | Noch im Risiko, bestenfalls, schlimmstenfalls |

Die wichtigste Regel: **das realisierte Ergebnis rechnet nur mit entschiedenen Scheinen,
auf beiden Seiten.** Wer den Rueckfluss der entschiedenen Scheine gegen den Einsatz ALLER
Scheine rechnet, zieht den Einsatz der offenen Scheine als Verlust ab. Das Ergebnis sieht
plausibel aus und ist um genau das offene Risiko zu niedrig.

Weitere Festlegungen:

- **Auszahlung** enthaelt den Einsatz. **Gewinn** enthaelt ihn nicht.
  Buchmacher sind da uneinheitlich: "Returns" und "Auszahlung" meinen ueblicherweise
  die Auszahlung, "To Win" und "Profit" den Gewinn. Bei unklarer Beschriftung entscheidet
  die Probe, nicht das Wort.
- **Die Quote kommt aus Einsatz und Auszahlung**, nicht aus der angezeigten amerikanischen
  Quote. Die ist gerundet. Aus 181 und 296.84 ergibt sich genau 1.64, waehrend die
  angezeigte -157 nur 1.6369 ergaebe.
  **Aber nur bei offenen und gewonnenen Scheinen.** Bei einem verlorenen Schein steht in
  der Spalte 0, bei einem annullierten der Einsatz. Daraus eine Quote zu rechnen, gaebe
  0 oder 1 und wuerde den ganzen Riesenschein verderben.
- **Die effektive Gesamtquote ist einsatzgewichtet**, nicht der Mittelwert der Quoten.
  Bei 100 zu Quote 2.0 und 900 zu Quote 1.5 sind es 1.55, nicht 1.75.
- **Gratiswetten** kosten nichts und zahlen den Einsatz nicht mit aus.
- **Each Way** kostet den doppelten Einsatz.
- **Waehrungen werden nie vermischt.** Kommen zwei in einem Riesenschein vor, sagt das
  Programm das als Fehler und die Summen sind als nicht aussagekraeftig gekennzeichnet.
- **Geld wird in ganzen Cent gerechnet**, nie in Kommazahlen.

---

## Was das Programm NICHT still macht

Aus Erfahrung die wichtigste Eigenschaft.

- Ein Schein, der sich nicht zuordnen laesst, landet sichtbar im **Resttopf** mit Grund.
  Er wird nicht geloescht und nicht heimlich einsortiert.
- Ein doppelt erfasster Schein wird erkannt und zaehlt nur einmal. Wurde derselbe Schein
  einmal offen und spaeter entschieden fotografiert, werden beide Aufnahmen zu einem
  Schein zusammengefuehrt, nicht addiert.
- Jede Zahl, die berechnet statt gelesen wurde, ist als solche gekennzeichnet.
- Jeder Widerspruch zwischen Einsatz, Quote und Auszahlung wird gemeldet.
- Das Blatt "Hinweise" in der Excel-Mappe enthaelt alles, was aufgefallen ist.

---

## Zugang

Kein Login. Es gibt einen Sperrcode. Wer ihn hat, sieht alles, und alle sehen dasselbe.

So ist der Zugang gebaut:

1. Alle Tabellen liegen im Schema `kombi`, das der Programmierschnittstelle **nicht**
   bekannt gemacht ist. Von aussen ist keine Tabelle erreichbar.
2. Zusaetzlich ist auf jeder Tabelle der Zeilenschutz an, ohne eine einzige Regel.
3. Der einzige Weg hinein sind Funktionen, die mit den Rechten ihres Besitzers laufen
   und als erstes den Sitzungsschluessel pruefen.
4. Vom Code wird nur ein Fingerabdruck gespeichert, nie der Code selbst.
5. Nach zehn Fehlversuchen aus derselben Richtung ist fuenfzehn Minuten Ruhe.

**Ehrlich gesagt:** der Code ist eine Tuer, kein Tresor. Wer ihn hat, kann alles lesen
und alles aendern. Wer ihn weitergibt, gibt den vollen Zugang weiter. Fuer eine Gruppe,
die sich kennt, ist das genau richtig. Fuer alles andere braeuchte es echte Konten.

Die Bildschirmfotos verlassen das Geraet nie. In die Datenbank gehen nur die gelesenen
Zahlen. Wer das Blatt auf einem anderen Geraet bauen will, laedt die Bilder dort erneut hoch.

### Code wechseln

```sql
update kombi.zugangscodes set aktiv = false;
insert into kombi.zugangscodes (code_hash, name)
values (extensions.crypt('DEIN-NEUER-CODE', extensions.gen_salt('bf', 12)), 'Hauptcode');

-- Ohne diese Zeile laufen alle bestehenden Zugaenge noch dreissig Tage weiter.
delete from kombi.sitzungen;
```

---

## Eigene Datenbank

Nur `daten/einstellungen.js` anpassen und `supabase/migrations/0001_kombi_grundgeruest.sql`
einspielen. Danach einen Code setzen, siehe oben.

---

## Neuen Buchmacher ergaenzen

Zwei Stellen, beide reine Listen:

- `kern/buchmacher.js`: Name, Adresse, Schreibweise der Zahlen, Quotenformat.
- `kern/etiketten.js`: die Beschriftungen, falls sie noch nicht dabei sind.

An der Leselogik ist nichts zu aendern.

---

## Mitgelieferte Bibliotheken

Beide liegen im Ordner `lib` und werden nicht aus dem Netz nachgeladen.

| Was | Fassung | Lizenz |
|---|---|---|
| tesseract.js | 7.0.0 | Apache-2.0 |
| tesseract.js-core | 7.0.0 | Apache-2.0 |
| Sprachmodelle eng und deu | 4.0.0_best_int | Apache-2.0 |
| ExcelJS | 4.4.0 | MIT |
