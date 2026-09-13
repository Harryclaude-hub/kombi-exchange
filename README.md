# Kombi Exchange

Riesenschein-Terminal. Wettscheine aus Bildschirmfotos lesen, gleiche Wetten zu einer
Grosskombi zusammenfuehren, als ein Blatt und als Excel-Mappe ausgeben.

Die Texterkennung laeuft vollstaendig im Browser. Es wird kein Dienst gefragt, keine
kuenstliche Intelligenz von aussen aufgerufen und kein Bild hochgeladen.

---

## Was es macht

Du setzt dieselbe Wette bei vielen Buchmachern, oft zwanzig Mal und mehr. Danach hast du
zwanzig Bildschirmfotos und keine Uebersicht. Dieses Programm macht daraus eine Zahl.

1. **Bilder hochladen.** Bildschirmfotos deiner Wettuebersicht. Zugeschnitten geht,
   ein ganzes Browserfenster geht auch.
2. **Bei einem ganzen Fenster: Rahmen ziehen.** Ein Klick auf "Rahmen ziehen", dann
   mit der Maus ein Rechteck um die Wettliste. Das dauert drei Sekunden und ist
   immer richtig. Der Anbieter und das Konto werden trotzdem aus dem Kopf des
   ganzen Bildes gelesen, der Rahmen aendert daran nichts.
3. **Schnitte pruefen.** Das Programm erkennt die einzelnen Wettkarten und zeigt die
   Schnittkanten. Jede Kante laesst sich ziehen, jede Karte laesst sich herausnehmen
   oder teilen. Die Wette ganz unten, die nicht dazugehoert, nimmst du hier weg.
4. **Lesen.** Aus jeder Karte werden Anbieter, Konto, Scheinnummer, Zeitpunkt, Status,
   Einsatz, Quote, Auszahlung und alle Auswahlen gelesen.
5. **Pruefen und berichtigen.** Jedes Feld ist aenderbar. Die Farbe hinter einem Feld sagt,
   wie sicher die Erkennung war. Was von Hand gesetzt wurde, wird nie wieder ueberschrieben.
6. **Riesenschein.** Gleiche Wetten werden automatisch zu einer Position zusammengefasst,
   auch wenn zwei Anbieter verschieden schreiben.
7. **Ausgeben.** Ein Blatt mit allen Scheinen untereinander plus Kopfzeile mit den Summen,
   und dieselbe Sache als Excel-Mappe mit lebenden Formeln zum Nachrechnen.

### Die Rechnung berichtigt die Texterkennung

Auf einem Schein muessen Einsatz, Quote und Auszahlung zusammenpassen. Wenn die
Texterkennung eine Ziffer verliest, passt es nicht mehr, und dann laesst sich
ausrechnen, welche Ziffer es gewesen sein muss.

Echter Fall aus dem Durchlauf: gelesen wurden Einsatz 200 und Auszahlung 402 bei
angezeigter Quote -157. Daraus ergaebe sich Quote 2.01, die angezeigte bedeutet
aber 1.64. Von allen ueblichen Ziffernverwechslungen passt genau eine Kombination:
Einsatz 300 und Auszahlung 492. Sie wird uebernommen und als berichtigt markiert.

Zwei Regeln machen das sicher:

- Es werden nur Ziffern getauscht, die eine Texterkennung wirklich verwechselt.
  Aus einer 2 kann eine 3 werden, aus einer 1 keine 6.
- Berichtigt wird nur, wenn es GENAU EINE Loesung gibt. Bei mehreren bleibt der
  Widerspruch als Warnung stehen und du entscheidest. Eine geratene Berichtigung
  waere schlimmer als eine sichtbare Warnung.

---

> **Weiterarbeiten?** Dann zuerst [UEBERGABE.md](UEBERGABE.md) lesen. Dort stehen
> Zugaenge, Arbeitsregeln, offene Entscheidungen und der naechste Schritt.

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

Die Bildzerlegung braucht eine Leinwand und laesst sich deshalb nicht mit node
pruefen. Dafuer gibt es eine eigene Seite. Nach jeder Aenderung an
`bild/segmentierung.js` bitte oeffnen:

```
http://localhost:4173/werkzeug/probe/
```

Sie baut zehn Faelle nach, die bei echten Buchmachern vorkommen, und sagt zu
jedem, ob die Zerlegung stimmt.

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

Im Kopf der Seite auf **Code wechseln**. Das Programm wuerfelt einen neuen Code,
verlangt zur Sicherheit den bisherigen und meldet danach alle anderen Fenster ab.
Das eigene bleibt offen.

Der neue Code wird nur dieses eine Mal angezeigt. In der Datenbank steht auch von
ihm nur ein Fingerabdruck.

Von Hand geht es weiterhin:

```sql
update kombi.zugangscodes
   set code_hash = extensions.crypt('DEIN-NEUER-CODE', extensions.gen_salt('bf', 12))
 where aktiv;

-- Ohne diese Zeile laufen alle bestehenden Zugaenge noch dreissig Tage weiter.
delete from kombi.sitzungen;
```

---

## Zwei Leute am selben Projekt

Alle teilen sich einen Code, also koennen zwei Leute dasselbe Projekt offen haben.
Frueher gewann dabei der Letzte, und der andere hat es nie erfahren.

Jedes Projekt hat jetzt eine Fassungsnummer. Wer speichert, sagt dazu, welche Fassung
er gelesen hat. Stimmt sie nicht mehr, wird **nichts geschrieben**, und das Fenster
sagt es.

Was dabei absichtlich NICHT passiert: es wird nicht von selbst neu geladen. Das wuerde
genau die Arbeit wegwerfen, die der Schutz retten soll. Die Arbeit liegt weiterhin auf
dem Geraet, und der Mensch entscheidet, was damit geschieht.

---

## Wenn der Browser alte Dateien festhaelt

Das Programm besteht aus vielen einzelnen Dateien, die der Browser einzeln
zwischenspeichert. Nach einer Aktualisierung kann er deshalb neue und alte mischen,
und die Seite laeuft mit einer Kombination, die es nie gegeben hat.

Deshalb steht dieselbe Fassungskennung an zwei Stellen: in `daten/einstellungen.js`,
fest in den Programmdateien, und in `fassung.json` daneben. Beim Start wird
`fassung.json` ohne Zwischenspeicher geholt und verglichen. Weichen sie ab, laedt die
Seite sich **einmal** neu. Hilft das nicht, sagt sie es, statt sich weiter neu zu laden.

**Beim Aendern des Programms beide Werte hochsetzen.** `node werkzeug/pruefe.mjs`
beanstandet es, wenn sie auseinanderlaufen.

## Eigene Datenbank

Nur `daten/einstellungen.js` anpassen und die Dateien in `supabase/migrations/` der
Reihe nach einspielen. Danach einen Code setzen, siehe oben.

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
