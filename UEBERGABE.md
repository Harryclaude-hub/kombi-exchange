# Uebergabe an die naechste Sitzung

Stand: 13.09.2026. Diese Datei ist so geschrieben, dass jemand ohne jede
Vorgeschichte weiterarbeiten kann. Zuerst lesen, dann anfangen.

**Auftrag der naechsten Sitzung: das Leseprogramm an echten Fotos trainieren.**
Karam bringt 20 bis 100 Bildschirmfotos von Wettscheinen mit.

---

## In einem Satz

Karam setzt dieselbe Kombiwette bei bis zu sechzig Anbietern gleichzeitig,
zusammen zwanzigtausend Euro und mehr. Er fotografiert die Scheine ab. Dieses
Programm liest die Bilder, fuehrt gleiche Wetten zu einem Riesenschein
zusammen und gibt ein Blatt und eine Excel-Mappe aus.

---

## Wo alles liegt

| | |
|---|---|
| Quelltext | `https://github.com/Harryclaude-hub/kombi-exchange` (oeffentlich) |
| Seite | `https://harryclaude-hub.github.io/kombi-exchange/` |
| Datenbank | Supabase, Projekt `appload`, Kennung `eybwhnvjavovcxvimtxr` |
| Zugangscode | **steht nirgends im Quelltext.** Karam fragen. |

Der Code liegt nur als Einwegwert in `kombi.zugangscodes`. Niemals in eine
Datei schreiben. Im Programm gibt es oben rechts "Code wechseln".

---

## Sofort loslegen

```bash
npm test                      # 148 Tests
node werkzeug/pruefe.mjs      # Aufbaupruefung ueber 59 Dateien
node werkzeug/messe_lesen.mjs # Wie gut wird gelesen
node werkzeug/server.mjs      # Server auf http://localhost:4173
```

`npm test` meldet einen uebersprungenen Test, solange es noch keine echten
Fotos gibt. Das ist richtig so, siehe "Der Auftrag: trainieren".

`messe_lesen` gibt zwei Zahlen aus. Die erste gilt fuer **nachgebaute** Bilder
und steht bei 100 Prozent. Die zweite gilt fuer **echte Fotos**, und solange
dort nichts steht, sagt die erste nichts ueber echte Fotos aus. Das steht auch
so im Ausdruck.

Es gibt **keinen Bauschritt**. Reine ES-Module, Bibliotheken liegen fertig in
`lib/`. `npm install` wird nicht gebraucht und ist in diesem Container schon
einmal gescheitert.

---

## Der Auftrag: trainieren

### So laeuft es

1. Fotos nach `.arbeit/fotos/` legen. Der Ordner steht in `.gitignore`, die
   Bilder koennen also nicht ins oeffentliche Repo wandern.
2. Server starten, `http://localhost:4173/werkzeug/training/` oeffnen.
3. **Aus dem Ordner holen.** Bei hundert Fotos ist das der bequemere Weg als
   der Auswahldialog. Der Dialog geht weiter.
4. **Alles lesen.** Rechne mit etwa fuenf Sekunden je Schein. Ein zweiter
   Druck liest nur neue Bilder und fragt vorher, wenn doch alles noch einmal
   soll.
5. Durchgehen. Scheine mit Fehler oder Warnung zuerst, dann die Zeilen mit
   niedriger Sicherheit.
   - Falsches rechts richtig eintragen. Komma und Punkt gehen beide.
   - Was auf dem Schein gar nicht steht, bekommt den Haken **steht nicht
     drauf**. Ohne das wird ein erfundener Wert fuer immer zum Sollwert.
   - Jeden Schein **abhaken**. Nur durchgesehene Faelle werden geprueft.
6. **Als Pruefaelle sichern** legt `korpus_echt.mjs` ab. Die Datei ersetzt
   `test/korpus_echt.mjs` (die liegt leer im Repo).
7. Ab dann prueft `test/korpus_echt.test.mjs` jeden Fall mit, und
   `messe_lesen` zeigt die Zahl fuer echte Fotos.
8. Dann die Fehler beheben, die dabei auftauchen. **Jeden Fehler zuerst zu
   einem Test machen, dann reparieren.**

Berichtigungen ueberstehen ein Neuladen der Seite (localStorage) und haengen
an Bild plus Position, nicht an der Schein-Kennung: ein zweiter Lesedurchgang
wirft sie deshalb nicht weg.

### Was am Trainingsweg am 13.09. repariert wurde

Der Weg sah fertig aus und war es nicht. Das Wichtigste, damit niemand es
wieder einbaut:

- **`korpus_echt.mjs` wurde von keinem Test geladen.** `npm test` fuehrt
  `test/*.test.mjs` aus, die Datei heisst anders, und kein Test hat
  `KORPUS_ECHT` je importiert. Stunden Handarbeit waeren wirkungslos
  geblieben, und alles haette nach Erfolg ausgesehen. Jetzt gibt es
  `test/korpus_echt.test.mjs` und `test/korpus_pruefer.mjs`, den EINEN
  Rechenweg fuer beide Korpora und die Messlatte.
- **Die Berichtigungsfelder waren `input type="number"`.** "250,50" kommt dort
  je nach Spracheinstellung als leere Zeichenkette an: die Korrektur
  verschwand still, der falsch gelesene Wert wurde als Wahrheit gesichert, und
  im Feld stand sichtbar 250,50. Jetzt Textfeld mit eigener Umwandlung ueber
  `kern/zahlen.js`, und was sich nicht deuten laesst, bleibt rot stehen.
- **Die Umgebung des Laufs wird mitgesichert.** Vorher stand in jedem Pruefall
  `gebiet: 'en'` (das Feld gibt es am Schein gar nicht) und
  `quotenformat: 'amerikanisch'` (die amerikanische Quote wird zu JEDER
  Dezimalquote mitberechnet). Der Fall lief also unter anderen Bedingungen als
  der Lauf, dessen Ergebnis als Wahrheit bestaetigt wurde.
- **Berechnete Werte sind keine Wahrheit.** Steht auf dem Foto keine
  Auszahlung, rechnet der Parser Einsatz mal Quote. Diese Zahl steht auf dem
  Bild nirgends, erfuellt den Pruefstein immer und kann ihn nie verletzen. Sie
  wandert nicht mehr in den Korpus, und in der Karte steht "ausgerechnet,
  steht nicht auf dem Bild".
- **Warnungen filterten auf `schwere !== 'hinweis'`.** Die Schweregrade heissen
  `info`, `warnung`, `fehler`. Damit galt JEDER Hinweis als Warnung, und der
  Zeiger zeigte auf alles, also auf nichts.
- **Meldungen und Bild-Hinweise stehen jetzt auf der Seite**, und die Bilanz
  ist vollstaendig: so viele Karten gefunden, so viele gelesen, so viele ohne
  Text. "0 Fehler" bei fuenf verschwundenen Karten war die falsche gute
  Nachricht.

### Karams fuenf echte Anbieter (13.09.2026)

Er setzt bei **BetOnline, PS3838, Betway, bet365 und Stake**. Von allen fuenf
gibt es Bildschirmfotos. Die Zeilen daraus stehen als Test in
`test/echte_anbieter.test.mjs`, mit nachgerechneten Sollwerten.

**Achtung, das sind nicht dieselben Tests wie der Bildkorpus.** Hier stehen
Zeilen, die vom Bild ABGELESEN wurden. Sie pruefen Beschriftungen,
Schreibweisen und Anordnung. Die Texterkennung selbst ist damit NICHT
geprueft, dafuer braucht es die Bilddateien in `.arbeit/fotos/`.

Was bei diesen fuenf anders ist als bei allem bisher Gebauten:

| Anbieter | Besonderheit |
|---|---|
| **Stake** | Krypto mit acht Nachkommastellen, in der Anzeige abgeschnitten: `5,000.000000...`. Quote deutsch (`1,90`), Betrag englisch (`2,000.00`), im selben Schein. Beschriftung `Quoten`, Status `Verlust`. |
| **PS3838** | TABELLE statt Karten. Spaltenueberschriften stehen ausserhalb der Zeile. Einsatz als `Risk: 500.00 (500.00)`, Quote nackt als `1.854 D`, Spalte Win/Loss ist der GEWINN, nicht die Auszahlung. |
| **Betway** | Deutsch. `Umsetzen` statt Einsatz, `DU HAST GEWONNEN` ueber der Auszahlung, `UNGUELTIG` und `Erstattet` bei einer Annullierung. Beschriftung und Wert stehen in getrennten Zeilen. |
| **bet365** | Deutsch, dunkler Modus. `Gewinn` heisst hier die Auszahlung MIT Einsatz (250 mal 1,80 gleich 450). Im Englischen waere `win` der reine Gewinn: das Wort entscheidet nicht, die Gegenrechnung entscheidet. |
| **BetOnline** | Der bekannte Fall. Verlorene Scheine haben gar keine Returns-Spalte. |

**Zwei Dinge, bei denen das Programm recht hatte und der Mensch falsch lag:**

- Die angezeigte Quote ist nicht die echte. Stake zeigt 1,84, aus 5000 und
  9175,9955 ergeben sich 1,8351991. Der Buchmacher rundet, das Programm
  rechnet den genauen Multiplikator zurueck. 5000 mal 1,84 waeren 9200.
- Bei einem verlorenen Schein sind `auszahlung` (was moeglich gewesen waere)
  und `ausgezahlt` (was wirklich zurueckkam, also null) zwei verschiedene
  Zahlen. Beide werden gebraucht.

**OFFENE FRAGE AN KARAM:** Geldbetraege werden auf den Cent gerundet
(`kern/quoten.js`). Bei Stake stehen acht Nachkommastellen, aus 9175,9955 wird
9176,00. Bei sechzig Scheinen sind das hoechstens dreissig Cent. Soll die
Rundung bleiben? Sie haengt an Excel und an der Summenpruefung, deshalb nicht
eigenmaechtig geaendert.

**Gemischte Waehrungen werden zuschlagen.** Karam setzt EUR bei PS3838,
Betway und bet365, USD bei BetOnline und Krypto bei Stake. Der Riesenschein
meldet das als FEHLER und rechnet NICHT um. Das ist richtig so, aber er muss
entscheiden, wie er damit umgeht.

### Die Ablage (14.09.2026)

Karams Auftrag: "Ein System wie beim Explorer, wo man all die Scheine und die
Kombis hat. Man kann hin und her verschieben, es soll uebersichtlich sein, man
soll Sachen anpinnen koennen, alles ist mit Datum beschriftet und man kann es
umbenennen."

`oberflaeche/ansicht_ablage.js`, Reiter "Ablage".

- Links die Ordner ("Alle", "Angepinnt", "Ohne Ordner", dann jeder Ordner mit
  Anzahl), rechts die Projekte, darunter der Inhalt des offenen Projekts.
- Umbenennen per Doppelklick auf den Namen oder ueber den Knopf.
- Anpinnen: Angepinntes steht IMMER oben, egal wie sortiert wird.
- Verschieben: ein Projekt mit der Maus auf einen Ordner ziehen.
- Suchen ueber Name, Ordner und Notiz. Sortieren nach Datum oder Name.
- Je Kombination: Einsatz, moeglicher Gewinn, Multiplikator, zurueck, und
  darunter jeder einzelne Schein mit Anbieter, Einsatz, Quote und Stand.

**Ein Ordner ist nur ein Textfeld am Projekt, keine eigene Tabelle.**
Verschieben heisst: das Feld aendern. Ein Ordner besteht, solange ein Projekt
darin liegt, und verschwindet sonst von selbst. Begruendung in
`supabase/migrations/0008_ablage_ordner_und_anpinnen.sql`. Die Migration ist
angewandt, die Spalten `ordner` und `angepinnt` stehen in `kombi.projekte`.

**Zwei Dinge, die beim Bauen aufgefallen sind:**

- Die Ansicht wird bei jeder Aenderung komplett neu gebaut. Damit war das
  Suchfeld nach jedem getippten Zeichen ein anderes Element, und der Fokus war
  weg: man konnte genau einen Buchstaben eingeben. `zeichne()` merkt sich jetzt
  den Fokus und stellt ihn samt Schreibzeiger wieder her.
- Gemischte Waehrungen werden in einer Kombination NICHT summiert. 181 Dollar
  plus 750 Euro sind nicht 931. Stattdessen steht dort ein Strich und eine
  Warnung. Der Multiplikator bleibt, er ist ein Verhaeltnis und kuerzt sich.

**Die Ansicht speichert nichts selbst.** Sie meldet zwei Ereignisse
(`kombi-projekt-oeffnen`, `kombi-projekt-speichern`), und `app.js` laedt und
speichert. Sonst gaebe es zwei Stellen, die Projekte schreiben, und die
driften auseinander.

### Was "trainieren" hier heisst

Kein neuronales Netz wird nachtrainiert. Jeder Fehler, den ein echtes Bild
zeigt, wird zu einem Pruefall, der ab dann fuer immer mitgeprueft wird. Das
Programm wird dadurch messbar besser und kann nicht unbemerkt schlechter
werden.

### Bildschirmfoto direkt aufnehmen (Clipping-Tool)

Karams Auftrag vom 13.09.: beim Hinzufuegen einer Wette nicht nur Dateien
hochladen koennen, sondern das Bildschirmfoto direkt am Rechner machen.

`oberflaeche/bildschirmfoto.js` (neu, loeschbar). Drei Wege, und der dritte
ist Absicht: `getDisplayMedia` kann der Browser verweigern, und dann stuende
man sonst ohne alles da.

1. **Bildschirmfoto aufnehmen.** Der Browser fragt, welches Fenster. Danach
   kommt der Zuschnitt. Braucht https oder localhost. Der Datenstrom wird
   sofort wieder beendet: ein einziges Bild, nichts wird aufgezeichnet.
2. **Aus der Zwischenablage**, und **Strg+V** irgendwo auf der Seite. Das ist
   der Weg, der immer geht, er braucht keine Erlaubnis. Passt zu
   Windows-Taste + Umschalt + S.
3. Datei hochladen, wie bisher.

**Der Zuschnitt ist Handarbeit, und das bleibt so.** Eine automatische Suche
nach dem Wettlisten-Bereich wurde nach vier Anlaeufen wieder entfernt, die
Begruendung steht in `bild/segmentierung.js`. Der Ausschnitt kommt IMMER aus
den Originalpunkten, nie aus der verkleinerten Anzeige: unscharfe Ziffern sind
genau das, woran die Texterkennung scheitert. Danach laeuft alles durch
dasselbe `nimmAuf` wie eine hochgeladene Datei.

**Zwei Fallen, die dabei aufgetaucht sind und wiederkommen werden:**

- `img.decode()` gibt sein Versprechen in einem verdeckten oder minimierten
  Fenster nie zurueck. Kein Fehler, keine Meldung, Strg+V tat einfach nichts.
  Dieselbe Fehlerklasse wie der `requestAnimationFrame`-Fall von frueher.
  Jetzt `createImageBitmap`, mit Rueckweg ueber `onload` und Zeitgrenze.
  **Merksatz: nichts an der Sichtbarkeit des Fensters aufhaengen.**
- Eine Anweisung, die mit einer Klammer beginnt, haengt sich an die Zeile
  davor, weil der Quelltext ohne Strichpunkte auskommt. Aus
  `/** @type {X} */ (knopf).disabled = true` nach einer `const`-Zeile wurde
  `el(...)(knopf)`, und die Fehlermeldung lautete "el(...) is not a function".
  Immer erst eine eigene `const`-Zeile.

### Woran es bisher scheitert

Beim ersten echten Durchlauf am 13.09.2026 kamen sofort zwei Dinge heraus:

- **Verschluckte Dezimalpunkte.** Aus "296.84" wurde "296 84" und daraus 29684.
  Behoben, siehe `test/luecken.test.mjs`. Rechne mit weiteren Formen davon.
- **Verlesene Ziffern in Scheinnummern.** "396228610" wurde zu "390226610".
  Dafuer gibt es keinen Pruefstein, also bleibt es Handarbeit. Nicht versuchen,
  das zu automatisieren, siehe die Regel unten.

Zu erwarten sind ausserdem: Anbieter, die nicht erkannt werden (dann in
`kern/buchmacher.js` ergaenzen), und Beschriftungen, die noch fehlen (dann in
`kern/etiketten.js`).

**Am 13.09. abends kamen sechs weitere dazu, alle mit Test und Reparatur**
(`test/verlesen.test.mjs`). Jeder war nachgerechnet falsch und haette Geld
falsch gezaehlt:

1. **Wiederholtes Trennzeichen, Faktor hundert.** "1,000.00" wird als
   "1,000,00" verlesen und war 100000. Besonders boesartig: Einsatz UND
   Auszahlung sind um denselben Faktor daneben, das Verhaeltnis stimmt weiter,
   und der Pruefstein schlaegt deshalb NICHT an. Jetzt entscheiden die
   Gruppenlaengen, und was nicht passt, gilt als mehrdeutig.
2. **Zweite Buchstabenliste im Parser.** "2QQ" ergab 2 statt 200. Die Liste
   wird jetzt aus `kern/zahlen.js` gebaut.
3. **Vorzeichen der amerikanischen Quote.** Der Parser kannte vier
   Minuszeichen, `zahlen.js` kennt elf. Bei einem anderen Strich wurde aus
   -157 die Quote 2,57 statt 1,64.
4. **"amount" allein war ein Einsatz-Etikett** und schluckte "Win Amount".
5. **Quotenboost.** Dort gilt Einsatz mal Quote gleich Auszahlung nicht, und
   die Reparatur hat einen richtig gelesenen Einsatz umgeschrieben.
6. **"Refunded" fehlte in den Statusworten.** Der Schein galt als Gewinn, und
   es wurde eine Quote von 2,0 erfunden.

Merke fuer Nummer 3: `[+-‐]` ist ein BEREICH von U+002B bis U+2010 und
enthaelt alle Ziffern. Der Bindestrich gehoert in einer Zeichenklasse
maskiert, sonst faellt genau das beim Einbauen erst durch einen roten
Alt-Test auf.

---

## Die Regeln, nach denen hier gearbeitet wird

Diese sind aus echten Fehlern in diesem Projekt entstanden. Sie sind nicht
verhandelbar.

### 1. Wo ein Pruefstein ist, darf die Automatik entscheiden. Wo keiner ist, entscheidet der Mensch.

Einsatz mal Quote muss die Auszahlung ergeben. Das ist ein Pruefstein. Deshalb
darf `kern/reparatur.js` verlesene Ziffern selbst berichtigen, aber nur wenn
**genau eine** Loesung passt.

Bei Scheinnummern und Datum gibt es keinen Pruefstein. Dort wird nichts
geraten. Eine Automatik, die in der Haelfte der Faelle selbstbewusst
danebenliegt, ist schlechter als keine: sie sieht aus wie Erfolg, niemand
prueft nach, und der Fehler wandert still in die Zahlen.

Genau deshalb wurde die automatische Erkennung des Wettlisten-Bereichs in
Vollbild-Screenshots nach vier Anlaeufen **wieder entfernt**. Der Nutzer zieht
den Rahmen jetzt mit der Maus. Siehe den Kommentarblock in
`bild/segmentierung.js`. Nicht wieder einbauen.

### 2. Gruene Tests sind nicht fertig.

Bei Karam gilt nichts als fertig, bevor es im laufenden Browser an echten
Daten lief. Jeder groessere Fehler dieses Projekts wurde im Betrieb gefunden,
nicht im Test.

### 3. Eine Schutzmassnahme zaehlt erst, wenn sie einmal ausgeloest wurde.

Die Sperre nach zehn Fehlversuchen war ueber Monate wirkungslos: das `insert`
in den Zaehler stand vor einem `raise`, und die Ausnahme hat es
zurueckgerollt. Null Fehlversuche in der ganzen Lebenszeit der Datenbank, und
der Zugangscode liess sich unbegrenzt durchprobieren. Der Code sah richtig aus.

Wer in derselben Transaktion erst protokolliert und dann eine Ausnahme wirft,
protokolliert nichts.

### 4. Zahlen immer auf einem zweiten Weg gegenrechnen.

Ein auffaellig gutes Ergebnis ist ein Warnsignal, kein Grund zur Freude.

### 5. Design und Funktion sind strikt getrennt.

`stil/` darf komplett geloescht werden, dann sieht die Seite nackt aus und
rechnet unveraendert weiter. Farben und Groessen nur ueber CSS-Variablen, nie
fest im JavaScript. Bei einem reinen Designauftrag wird an Rechenwegen,
Abfragen und Dateistruktur **nichts** angefasst.

Antwort auf einen Designauftrag beginnt mit "Jawohl, Chef."

### 6. Kein langer Gedankenstrich (U+2014).

In keinem Text, keinem Kommentar, keiner Datei. `werkzeug/pruefe.mjs` prueft
das. Ersatz: Komma, Doppelpunkt, zwei Saetze, Klammern.

### 7. Jede Antwort an Karam beginnt mit "Passt, Karam."

Das ist sein Kontrollsignal dafuer, dass die Regeln geladen sind.

### 8. Logik lebt an genau einer Stelle.

`kern/zahlen.js` ist die einzige Stelle, an der aus Text eine Zahl wird.
`kern/status.js` ist die einzige Stelle, die sagt, was ein Status bedeutet.
Wenn zwei Fassungen unvermeidlich sind, gehoert in beide oben ein Verweis auf
die andere, und sie werden im selben Arbeitsgang geaendert.

### 9. Aussortiertes bleibt sichtbar.

Was nicht ins Schema passt, kommt in den Restposten mit Grund, es wird nicht
weggeworfen. Was nie angezeigt wird, wird nie korrigiert.

---

## Wie das Programm aufgebaut ist

```
kern/          Reine Logik, keine Anzeige. Hier wird gerechnet.
  zahlen.js      Text zu Zahl. EINZIGE Stelle dafuer.
  quoten.js      Amerikanisch, dezimal, Bruch. Und versoehne().
  parser.js      Aus Textzeilen einen Schein machen.
  reparatur.js   Verlesene Ziffern anhand der Rechnung berichtigen.
  rechnung.js    Summen, jede auf zwei Wegen gegengerechnet.
  gruppierung.js Gleiche Wetten zu einem Riesenschein zusammenfuehren.
  kennung.js     Erkennen, ob zwei Scheine dieselbe Wette sind.
  etiketten.js   Beschriftungen der Buchmacher, mehrsprachig.
  buchmacher.js  Liste der Anbieter und ihrer Merkmale.
bild/          Bildzerlegung. segmentierung.js ist das Herzstueck.
lesen/         Texterkennung (tesseract.js).
oberflaeche/   Anzeige und Bedienung.
ausgabe/       Excel und CSV.
stil/          NUR Design. Loeschbar.
daten/         Datenbank und oertliche Ablage.
werkzeug/      Pruefskript, Server, Messwerkzeug, Probe- und Trainingsseiten.
supabase/migrations/  Der Datenbankaufbau, 0001 bis 0007.
test/          131 Tests.
```

---

## Was offen ist

1. **Karams echte Fotos.** Der eigentliche Auftrag. Der Weg dahin steht, ist
   im Browser durchgemessen und wartet nur noch auf die Bilder.

2. **Befunde aus der Gegenpruefung vom 13.09., bestaetigt aber NICHT
   repariert.** Sie wurden von einem zweiten Pruefer am Quelltext bestaetigt.
   Reihenfolge nach Schaden:

   - **Doppelaufnahmen werden verschmolzen, und der Pruefall wird dadurch
     unspielbar.** Zwei Fotos desselben Scheins (etwa einmal offen, einmal
     entschieden) fuehrt `verschmelzeDoppelte` ohne Rueckfrage zusammen. Der
     Mischschein traegt die Zeilen der einen Aufnahme und die Werte der
     anderen. `leseSchein` kann aus diesen Zeilen diese Werte nie liefern: der
     Fall ist fuer immer rot, und die zweite Aufnahme existiert nirgends mehr.
     Schlimmer noch: das schlecht gelesene Foto, also der wertvolle Fall,
     faellt dabei aus dem Korpus. Vorschlag: der Trainingsweg arbeitet auf den
     Scheinen VOR dem Verschmelzen, oder `sichere()` erkennt den Hinweis
     `zusammengefuehrt` und meldet ihn sichtbar.
   - **Bei hundert Bildern laeuft der Speicher voll.** Jede
     Fortschrittsmeldung der Texterkennung zeichnet die Aufnahmeansicht neu
     und erzeugt dabei je Bild eine Blob-Adresse, die nie freigegeben wird.
   - **`leseBilder` sichert erst nach dem letzten Bild und laesst sich nicht
     abbrechen.** Wer nach achtzig von hundert Bildern abbricht, verliert
     alles. Bei drei Bildern faellt das nicht auf.
   - **Nach einem Neuladen kommen die Bilder ohne Kartengrenzen zurueck.**
     `karten`, `bereich` und `hinweise` werden nicht abgelegt. Danach steht
     bei jedem Bild "0 Scheine erkannt", und die ganze Handarbeit an den
     Grenzen ist weg.
   - **Feste Pixelgrenzen in der Zerlegung.** `KARTE_MINDESTHOEHE = 40` ist
     eine absolute Zahl. Bei einem Handybild mit dreifacher Pixeldichte ist
     schon eine einzelne Textzeile hoeher, der Schutz gegen Zerschneiden
     faellt aus, und aus einer Karte werden zwei halbe Scheine. Dasselbe Foto
     ueber einen Messenger verkleinert verhaelt sich anders.
   - **Ein als JPEG weitergereichtes Bildschirmfoto laeuft in den Fotoweg**
     und wird hart schwellwertbinarisiert. Aus 8 wird B, aus 0 wird O. Der
     Befund wird nirgends angezeigt, und es gibt keinen Schalter dagegen.

   Diese Punkte gehoeren angefasst, sobald die echten Fotos zeigen, WELCHE
   davon wirklich zuschlagen. Vorher waere es Bauen ins Blaue, und die Regel
   dazu steht oben.
3. **Werden die Bilder gespeichert?** Derzeit nein: in der Datenbank stehen nur
   Dateiname, Groesse, Pruefsumme, Anbieter und Konto. Die Fotos liegen allein
   auf dem Geraet. Damit ist der Riesenschein nach einem Geraetewechsel ohne
   Bilder. Karam wollte "eigene Projekte, in denen alle Fotos drin sind". Das
   waere Supabase Storage, heisst aber, dass die Bilder das Geraet verlassen.
   **Karam muss das entscheiden, nicht der Entwickler.**
4. **`public.app_pages` und `public.app_chunks`** in derselben Supabase haben
   den Zeilenschutz aus. Sie sind NICHT Teil dieses Projekts und waren vorher
   da. Nicht eigenmaechtig anfassen.
5. **Waehrungen werden nicht umgerechnet.** Gemischte Waehrungen erzeugen eine
   Warnung, keine Umrechnung.
6. **Dauer bei vielen Bildern.** Etwa fuenf Sekunden je Schein. Bei sechzig
   Scheinen sind das mehrere Minuten. Auf einem Handy noch nicht gemessen.

---

## Zahlen zum Stand

| | |
|---|---|
| Tests | 148, davon 147 gruen und 1 uebersprungen (noch kein echter Korpus) |
| Lesekorpus nachgebaut | 19 Formate, 73 Felder, 100 Prozent |
| Lesekorpus echt | noch leer, das ist der Auftrag |
| Massstab geprueft | 60 Scheine, 18 Anbieter, 19.812 $, eine Gruppe |
| Excel | 60 Zeilen, Summe auf den Cent gleich dem Programm |
| Aufbaupruefung | 59 Dateien, keine Beanstandung |
| Fassung | 2026-09-13-e |

---

## Bekannte Stolpersteine in diesem Container

- `npm install` scheitert an esbuild. Wird nicht gebraucht.
- `node --test test/` scheitert auf dieser Node-Fassung. Richtig ist
  `node --test "test/*.test.mjs"`, so steht es auch in `package.json`.
- Git auf Windows braucht `git config core.longpaths true`.
- Bash-Heredocs scheitern an Umlauten. Fuer groessere Dateien das
  Schreibwerkzeug nehmen, nicht `cat <<EOF`.
- Nach jeder Aenderung am Programm **beide** Fassungskennungen hochsetzen:
  `fassung.json` und `PROGRAMM_FASSUNG` in `daten/einstellungen.js`.
  `werkzeug/pruefe.mjs` beanstandet es, wenn sie auseinanderlaufen.
