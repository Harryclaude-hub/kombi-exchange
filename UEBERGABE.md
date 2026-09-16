# Uebergabe an die naechste Sitzung

Stand: 16.09.2026, Fassung 2026-09-16-f. Diese Datei ist so geschrieben, dass
jemand ohne jede Vorgeschichte weiterarbeiten kann. Zuerst lesen, dann anfangen.

**Auftrag der naechsten Sitzung: Design und Bedienung.** Was am Programm
gerechnet wird, bleibt unberuehrt (Regel 5).

**Zuerst pushen, dann arbeiten.** Am 16.09. lagen neun Commits nur oertlich, und
Karam sah auf der oeffentlichen Seite tagelang den alten Stand. Nach JEDEM
Arbeitsgang: `git push origin main`. Und: GitHub Pages sagt dem Browser
`max-age=600`, also zehn Minuten ohne Nachfrage. Die Fassung steht deshalb oben
rechts in der Kopfzeile; steht dort nicht die neueste, ein Klick darauf laedt
erzwungen neu.

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
| Karams Fotos | `FOTOS_KARAM.md`: alle 36 Scheine aus seinen 13 Bildschirmfotos, nachgerechnet. Die BILDDATEIEN gibt es nicht auf der Platte. |

Der Code liegt nur als Einwegwert in `kombi.zugangscodes`. Niemals in eine
Datei schreiben. Im Programm gibt es oben rechts "Code wechseln".

**Ist der Code weg: `NOTFALL.md`.** Dort steht der eine SQL-Befehl, mit dem
Karam sich selbst einen neuen setzt. Er steht auch im Programm am
Anmeldefenster unter "Code verloren?". Ein Wert steht an keiner der beiden
Stellen und darf dort nie stehen: das Repository ist oeffentlich.

---

## Sofort loslegen

```bash
npm test                      # 212 Tests
node werkzeug/pruefe.mjs      # Aufbaupruefung ueber 68 Dateien
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
4. **Alles lesen.** Rechne mit etwa zwei Sekunden je Schein auf acht Kernen.
   Ein zweiter Druck liest nur neue Bilder und fragt vorher, wenn doch alles
   noch einmal soll.
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

### Karams echte Fotos, durchgearbeitet (14.09.2026)

Er hat dreizehn Bildschirmfotos geschickt: **36 Scheine von fuenf Anbietern**.
Jeder wurde von Hand abgelesen, jeder Sollwert nachgerechnet, und alle stehen
als Test in `test/echte_fotos.test.mjs`.

**Die Bilddateien liegen weiterhin NICHT auf dem Rechner.** Sie kamen im
Gespraech an, nicht als Datei. `.arbeit/fotos/` ist leer. Geprueft ist also
alles VOR der Texterkennung: Beschriftungen, Schreibweisen, Spalten,
Zuordnung, Rechnung. Die Texterkennung selbst ist damit nach wie vor nicht an
echten Pixeln gemessen.

Der Unterschied zu `test/echte_anbieter.test.mjs`: dort stand die Quote sauber
allein auf einer Zeile (`1.854 D`). So sieht ein echtes Bild nie aus. Die
Texterkennung liest quer ueber alle Spalten, eine Bildzeile nach der anderen.
Beim ersten Durchlauf mit echten Zeilen waren **26 von 36 Scheinen richtig**.

#### Was dabei herauskam

**1. PS3838 hatte bei neun von neun Scheinen GAR KEINE Quote.**
Die Quote steht in der Tabellenzeile, ihr Formatbuchstabe D rutscht in die
naechste. Die alte Regel verlangte, dass die ganze Zeile aus `1.854 D`
besteht. Neu ist Abschnitt 4d in `kern/parser.js`: irgendwo muss eine Spalte
stehen, die nur aus D oder A besteht, dann wird unter den reinen Zahlenspalten
genau ein Kandidat im Quotenbereich gesucht. Bei mehreren wird nichts genommen.
Die `84.5` aus `Over 84.5 Rushing Yards` faellt heraus, weil sie in einer
TEXTspalte steht.

Dazu die Gegenrechnung auf derselben Zeile: die Spalte Win/Loss ist der
GEWINN, also muss Einsatz mal (Quote minus eins) genau diese Zahl ergeben.
500 mal 0,854 sind 427,00. Trifft das zu, ist die Quote belegt und nicht
geraten.

**2. Der Riesenschein warf verschiedene Wetten zusammen. Der teuerste Fund.**
In einer Tabelle steht die Wette in derselben Bildzeile wie das Geld. Wegen
`Risk:` wurde diese Zeile ganz als Beschriftungszeile verbraucht, die Zeile
mit dem Spielernamen ebenfalls. Uebrig blieben nur Zeitstempel und die Worte
`Player Props` und `Specials`, und die stehen auf JEDER PS3838-Zeile.

Damit trug jeder PS3838-Schein dieselbe Wettkennung, Uebereinstimmung 1,0.
Vier Gibbs-Scheine (Over 84.5 Rushing Yards, Detroit gegen New Orleans)
landeten mit zwei Williams-Scheinen (Over 226.5 Passing Yards, Carolina gegen
Chicago) in EINER Gruppe. Anderer Spieler, anderes Spiel, andere Linie,
ein sinnloser Multiplikator ueber 9.000 Euro Einsatz.

Abschnitt 5 liest eine verbrauchte Zeile jetzt spaltenweise nach: was dort an
Text steht und nicht zum Geld gehoert, ist die Wette. Das kann keine Zahl
verderben, Einsatz und Quote sind an der Stelle laengst vergeben.

**3. Die Wortgrenze vor einem Umlaut hat nie getroffen.**
`\b` ist in JavaScript rein englisch. Vor einem grossen U-Umlaut steht deshalb
nie eine Wortgrenze: links ein Leerzeichen, rechts ein Buchstabe, den die
englische Regel nicht kennt, beide Seiten gelten als Nichtwortzeichen.

    /\büber\b/.test("Über 2.5 Annahmen")   ->   false

Folge: **jeder deutsche Schein verlor Marktart UND Linie**, also genau die zwei
Merkmale, die ueber die Zuordnung zum Riesenschein entscheiden. Unsichtbar,
weil englische Scheine sauber durchliefen. Jetzt mit `\p{L}` statt `\b`, in
`kern/parser.js` und `kern/kennung.js`. Dazu: die Marktart wird aus Markt UND
Tipp bestimmt, und die Linie ebenso. Welches Feld die Wettart traegt,
entscheidet der Aufbau des Anbieters, nicht die Wette.

**4. Ein verlorener Schein zahlte nichts aus, und das stand nirgends.**
Stake schreibt die Null hin, PS3838 nicht: dort steht in der Gewinnspalte der
Einsatz mit Minus, und das ist etwas anderes. `ausgezahlt` blieb leer, und ein
verlorener Schein sah in der Summe aus wie ein offener. Nur `verloren` bekommt
die Null, `halb_verloren` und `cashout` nicht.

**5. Die Scheinnummer stand mitten in der Tabellenzeile.**
Regel drei verlangte den Zeilenanfang und dass keine Geldbeschriftung in der
Zeile steht. Eine Tabellenzeile kann das nie erfuellen. Neue Regel vier: eine
Spalte aus mindestens ACHT reinen Ziffern, kein Waehrungszeichen daneben,
keine Geldbeschriftung in der Spalte davor, kein Datum.

Das ist kein Schoenheitsfehler. In Bild 10 stehen 396228581 und 396228545
nebeneinander: beide Deebo Samuel, beide 300 Dollar, beide -157. Nur die
Nummer unterscheidet sie. Ohne sie waeren sie ein doppelt hochgeladener
Schein, und 300 Dollar Einsatz und 492 Dollar Auszahlung fehlten in der Summe.

#### Was die Anbieter an Fallstricken mitbringen

| Anbieter | Der Fallstrick, nachgerechnet |
|---|---|
| **BetOnline** | Die angezeigte amerikanische Quote ist GERUNDET. -157 ergibt umgerechnet 1,63694, die Auszahlung verlangt aber genau 1,64. -121 ergibt 1,82645, verlangt wird 1,83. Wo Returns dasteht, gilt Einsatz mal X gleich Returns. Wer die Anzeige umrechnet, liegt bei jedem Schein daneben. |
| **Stake** | Angezeigt 1,84, wahr 1,8351991. Bei 5.000 Einsatz waeren 5.000 mal 1,84 gleich 9.200, ausgezahlt wurden 9.175,9955. Vierundzwanzig daneben auf EINEM Schein. |
| **Betway** | Angezeigt 1.74, wahr 1,7407. Quote hinter einem At-Zeichen in der Kopfzeile, Abschnitt 4c. Auf demselben Schein steht das At-Zeichen auch zwischen zwei Mannschaften und vor einem Datum. |
| **bet365** | `Gewinn` ist die Auszahlung MIT Einsatz: 250 mal 1,80 gleich 450. Deutscher Tausenderpunkt in `ö2.211,55`. |
| **PS3838** | `Win/Loss` ist der GEWINN, nicht die Auszahlung. Die Auszahlung steht nirgends und wird gerechnet. |

Der rote Faden: **die angezeigte Quote ist bei vier von fuenf Anbietern nicht
die echte.** Wo Einsatz und Auszahlung beide dastehen, rechnet das Programm
den genauen Multiplikator zurueck und schlaegt die Anzeige. Das ist Regel 1.

#### Der Stand nach der Arbeit

36 von 36 Scheinen vollstaendig richtig. Kein Schein ohne Einsatz, keiner ohne
Multiplikator, **kein einziger Fehlerhinweis**.

| | Scheine | Einsatz | moegl. Auszahlung | Multiplikator |
|---|---|---|---|---|
| PS3838 | 9 | 17.717,48 | 20.223,42 | 1,1414 |
| Betway | 2 | 365,80 | 423,80 | 1,1586 |
| bet365 | 5 | 2.135,04 | 4.242,65 | 1,9872 |
| BetOnline | 8 | 1.925,00 | 2.357,88 | 1,2249 |
| Stake | 12 | 40.266,00 | 37.950,83 | 0,9425 |

Je Waehrung, und es wird NICHT umgerechnet: EUR 20.218,32 Einsatz gegen
24.889,87, USD 1.925,00 gegen 2.357,88, Krypto 40.266,00 gegen 37.950,83.
Beide Summen wurden auf einem zweiten Weg ohne `kern/rechnung.js` gegengerechnet
und stimmen auf den Cent.

Achtung beim Lesen: `auszahlungMoeglich` ist NICHT die Summe aller moeglichen
Auszahlungen. Bei einem entschiedenen Schein zaehlt, was wirklich zurueckkam,
und nur bei einem offenen das, was noch kommen kann. Wer alle
`auszahlung`-Felder addiert, zaehlt die Auszahlungen verlorener Scheine mit,
die es nie gab. Genau diese Verwechslung sah beim Gegenrechnen zuerst wie ein
Programmfehler aus und war keiner.

#### Was beim Riesenschein noch fehlt

Derselbe Schein bei mehreren Anbietern wird **innerhalb** eines Anbieters
richtig zusammengefasst, **ueber Anbieter hinweg noch nicht**. Gemessen an
Deebo Samuel, mehr als 2.5 Annahmen, bei BetOnline, Stake und Betway:

    vorher                    0,00   0,26   0,225
    nach der Umlautreparatur  0,20   0,46   0,38
    Schwelle fuer Vorschlag   0,60

Marktart und Linie stimmen jetzt bei allen dreien ueberein. Es fehlen zwei
Dinge: die uebersetzten Marktbegriffe (`receptions` gegen `Annahmen`) und die
Paarung bei Stake, die im Thema statt bei den Beteiligten landet.

**Nicht zusammenfassen ist SICHER, falsch zusammenfassen waere es nicht.**
Deshalb wurde die Schwelle nicht gesenkt. Der Stand ist als Test festgehalten.

#### Wichtig fuer den taeglichen Gebrauch

Karam setzt bei den Anbietern NICHT dieselbe Linie. Gibbs steht bei PS3838 auf
Over 84.5 und bei Stake auf Ueber 82.5, Williams auf 226.5, 227.5 und 229.5.
Das sind verschiedene Wetten mit verschiedenem Risiko, und das Programm haelt
sie zu Recht auseinander. Nur wo die Linie wirklich gleich ist, gehoeren sie
zusammen.

### Der erste echte Durchlauf durch die Texterkennung (14.09.2026)

Bis hierher waren 202 Tests gruen, und **keine einzige Tabellenregel konnte an
einem echten Bild greifen.** Gefunden wurde das erst beim Durchlauf im Browser.
Genau davor warnt Regel 2.

Dafuer gibt es jetzt `werkzeug/probe/anbieter.html`: Zerlegung, Texterkennung
und Auswertung an nachgebauten Ansichten aller fuenf Anbieter, mit den
ROHZEILEN unter jedem Fall. `werkzeug/probe/anbieter_bilder.js` lag vorher als
Waise da, von nichts eingebunden.

#### Der Fund: eine einzige Zeile machte alle Spaltenregeln wirkungslos

In `lesen/ocr.js` stand:

    String(zeile.text).replace(/\s+/g, ' ')

Jede Folge von Leerzeichen wurde zu genau einer. Die Texterkennung laeuft zwar
mit `preserve_interword_spaces`, aber danach wurde der Text wieder platt
gemacht. Der Parser erkennt eine Spaltengrenze an ZWEI Leerzeichen, und die
gab es nach dieser Zeile nie mehr.

Eine PS3838-Tabellenzeile kam so an:

    1 Sportsbook 2026-09-13 15:57:21 Detroit Lions-vs-New Orleans Saints 1854 (500.00) 427.00 0.00 WIN

Aus einer Tabelle mit acht Spalten wurde eine Wortkette. Alle Tests liefen auf
Zeilen, die von Hand mit zwei Leerzeichen geschrieben waren, also auf einer
Annahme, die die Texterkennung nicht erfuellte.

**Die Luecken stehen in den Wortkaesten.** `baueZeilentext` in `lesen/ocr.js`
misst sie jetzt aus. Die Schwelle ist gemessen, nicht geschaetzt, an einer
Zeile mit 38 Bildpunkten Hoehe:

    Wörter innerhalb einer Spalte     6, 7, 7, 8      etwa 0,2 Zeilenhöhen
    Spaltengrenzen                       89 bis 286      2,3 Zeilenhöhen und mehr

Dazwischen liegt nichts. Die Schwelle von 0,6 Zeilenhoehen hat nach beiden
Seiten viel Luft und waechst mit der Schriftgroesse mit. Danach:

    1  Sportsbook  2026-09-13 15:57:21  Detroit Lions-vs-New Orleans Saints  1854  (500.00)  427.00  0.00  WIN

#### Der zweite Fund: die Texterkennung verliert den Punkt in der Quote

Bei der echten Schriftgroesse von dreizehn Bildpunkten:

    auf dem Bild steht   1.854
    gelesen wird         1854      (auf einer Karte sogar "tase")

Damit ist der Quotentext unbrauchbar. Auf derselben Zeile stehen aber
`Risk: 500.00` und die Gewinnspalte `427.00`, und 427 geteilt durch 500 plus
eins ergibt genau 1,854.

Das allein waere zu wenig: auf der Zeile steht auch die 1854 selbst, und
1854 geteilt durch 500 plus eins ergaebe 4,708, ebenfalls eine moegliche
Quote. Abschnitt 4e verlangt deshalb einen ZWEITEN Beleg: die Ziffern der
gerechneten Quote muessen als Baustein auf dem Schein vorkommen.

    1,854 hat die Ziffern 1854, und "1854" steht da    ->  belegt
    4,708 hat die Ziffern 4708, die steht nirgends     ->  verworfen

Zwei unabhaengige Angaben sagen dasselbe. Das ist Regel 1.

#### Was jetzt durchlaeuft und was nicht

    bet365      2 von 2 Karten     alles richtig
    BetOnline   3 von 3 Karten     alles richtig, auch die amerikanischen Quoten
    PS3838      2 von 3 Karten     die verlorene Zeile bleibt offen
    Betway      0 von 2 Karten     die Zerlegung schneidet die Karte durch
    Stake       2 statt 4 Karten   die zwei Spalten werden nicht getrennt

Vorher waren es 5 von 10 gepruefte Karten, jetzt 7 von 10.

**Die verlorene PS3838-Zeile.** Dort ist die Texterkennung wirklich kaputt:
die Gewinnspalte wurde zu `22D`, daneben steht `bool`, `Egat`, `oC`. Ohne
Gewinnspalte gibt es keinen Pruefstein, also wird nichts genommen. Die Quote
bleibt leer, der Hinweis steht sichtbar da, der Mensch traegt sie ein. Einsatz
und Stand werden richtig gelesen, und bei einem verlorenen Schein bewegt die
Quote kein Geld: sie sagt nur, was moeglich gewesen waere.

**Betway.** Die Zerlegung schneidet die Karte an ihrer Spielstandsbox durch.
Der Kopf landet auf der einen Haelfte, das Geld auf der naechsten. Wichtig:
das faellt LAUT auf. Die halbe Karte ohne Geld erzeugt
`FEHLER einsatz_fehlt`, und ein Schein ohne Einsatz geht nicht in die Summe.
Kein stiller Verlust.

**Nicht an den Nachbauten nachgestellt.** Die Schwellwerte der Zerlegung
haengen an der Frage, wie stark die innere Trennlinie im ECHTEN Bild ist. Mein
Nachbau ist meine Zeichnung. Wer daran dreht, stellt auf das eigene Artefakt
ein. Das wartet weiter auf die Dateien in `.arbeit/fotos/`.

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
  handeingabe.js Was der Mensch tippt, ueber zahlen.js gelesen. Neu 16.09.
  quoten.js      Amerikanisch, dezimal, Bruch. Und versoehne().
  parser.js      Aus Textzeilen einen Schein machen.
  reparatur.js   Verlesene Ziffern anhand der Rechnung berichtigen.
  rechnung.js    Summen, jede auf zwei Wegen gegengerechnet.
  gruppierung.js Gleiche Wetten zu einem Riesenschein zusammenfuehren.
  kennung.js     Erkennen, ob zwei Scheine dieselbe Wette sind.
  etiketten.js   Beschriftungen der Buchmacher, mehrsprachig.
  buchmacher.js  Anbieterliste, plus schluesselFuerName und kuerzelFuer.
  status.js      Was ein Stand bedeutet. EINZIGE Stelle dafuer.
bild/          Bildzerlegung. segmentierung.js ist das Herzstueck.
lesen/         Texterkennung (tesseract.js).
oberflaeche/   Anzeige und Bedienung.
  app.js             Zusammenbau, Kopfzeile, Reiter, Speichern.
  zustand.js         Der eine Arbeitsstand.
  werkzeug.js        el(), fuelle(), anbieterzeichen().
  fotoknoepfe.js     Die drei Aufnahmewege. EINZIGE Stelle. Neu 16.09.
  ansicht_*.js       Je Reiter eine Datei, dazu ansicht_hilfe.js (neu 16.09).
ausgabe/       Excel und CSV.
stil/          NUR Design. Loeschbar.
  marken.css     Alle Farben, Groessen, Abstaende.
  grund.css      Aufbau der Seite.
  bauteile.css   Aussehen der einzelnen Bausteine.
  logos.css      Hausfarben der Anbieter. Neu 16.09.
  buehne.js      Optionale Bewegung.
daten/         Datenbank und oertliche Ablage.
werkzeug/      Pruefskript, Server, Messwerkzeug, Probe- und Trainingsseiten.
  probe/anbieter.html         Der ganze Leseweg an nachgebauten Bildern.
  probe/hilfe.html            Vorschau der Hilfeseite, ohne Zugangscode.
  probe/anbieterzeichen.html  Alle sechzig Anbieterzeichen. Neu 16.09.
supabase/migrations/  Der Datenbankaufbau, 0001 bis 0008.
test/          236 Tests.
```

**Probeseiten brauchen KEINEN Zugangscode.** Alles andere schon. Wer ohne Code
arbeitet, kann die Reiter Aufnahme, Scheine, Riesenscheine, Ausgabe und Ablage
nicht selbst ansehen und muss das ehrlich sagen (Regel 2).

## Was am 16.09.2026 gebaut wurde

Alles veroeffentlicht, Fassung 2026-09-16-f.

**Fuenf Geldfehler, alle mit Test zuerst:**

1. Zwei Zahlen in einem Feld ergaben einen Einsatz von fuenf Billiarden.
   `5,000.00000000 2,000.00000000` mit EINEM Leerzeichen dazwischen: das
   Leerzeichen galt als Tausenderraum und fiel weg. Jetzt gilt: kommt das
   Dezimaltrennzeichen zweimal vor, sind es zwei Zahlen, und dann wird nichts
   geraten. Dazu Regel 8b im Parser: steht dasselbe Geldetikett zweimal mit
   einer Zahl dahinter auf einer Zeile, liegen zwei Karten nebeneinander
   (`zwei_karten_in_einer`, Schwere fehler).
2. Ein Schein mit einem Hinweis der Schwere fehler ging trotzdem in die Summe.
   Jetzt bleibt er draussen und steht im neuen Feld `mitFehler` mit Anzahl und
   Gruenden. Eine Ausnahme: `einsatz_fehlt` behaelt seine alte, sanftere
   Behandlung.
3. Das Geldfeld im Reiter Scheine strich ALLE Punkte: aus `5000.00` wurde
   500000, aus `5,000.00` wurde 5, und der Wert war mit Sicherheit 1 und
   Herkunft hand fuer immer festgeschrieben. Jetzt ueber `kern/handeingabe.js`,
   das `leseZahl` und `deuteQuote` aufruft. Was unklar bleibt, wird NICHT
   gespeichert: das Feld wird rot und der Grund steht im Titel.
4. Eine amerikanische Quote im Dezimalfeld wird abgelehnt statt umgerechnet.
   Die Anzeige ist gerundet, umgerechnet liegt sie bei jedem Schein daneben.
5. Die Probeseite fuehrte den Stake-Fall als "OFFEN" und verschwieg damit genau
   die Karte mit dem Muell-Einsatz. Jetzt zaehlt jeder Hinweis der Schwere
   fehler und jeder Einsatz ueber einer Million als FEHLER.

**Bedienung:** Bilder klein nebeneinander statt gross untereinander, per Klick
gross. Loeschen fuer einzelne Fotos, einzelne Scheine, einzelne und mehrere
Projekte, und Ordner (die Projekte darin bleiben). Notizen an Schein und
Riesenschein. Meldungen verschwinden von selbst, Fehler bleiben stehen.

**Riesenscheine in drei Spalten:** links die Auswahl, in der Mitte die Zahlen,
rechts die einzelnen Scheine nummeriert plus die Fotoknoepfe. Ein Riesenschein
laesst sich in der Scheineliste von Hand aufmachen.

**Anbieterzeichen:** jeder der sechzig Anbieter steht mit Hausfarbe und Kuerzel
da. Echte Logos passen ohne Codeaenderung hinein: Datei nach
`stil/logos/<schluessel>.png`, eine Zeile in `stil/logos.css`. Die Schluessel
stehen auf `werkzeug/probe/anbieterzeichen.html`.

**Reiter Hilfe:** erklaert den Weg in fuenf Schritten, dann jeden Reiter mit
Schaubild, Liste und Achtung-Kasten, dazu die Woerter und sechs Faelle
"wenn etwas nicht stimmt".

**Aussehen:** Kopfzeile 88 Pixel mit der Navigation darin, hellere und
kontrastreichere dunkle Fassung, ein Umschalter System/Hell/Dunkel, groessere
Projekt- und Ordnerzeilen, jeder Knopf sieht aus wie ein Knopf.

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
6. **Dauer bei vielen Bildern: gemessen, nicht mehr geschaetzt.** Im Browser
   auf acht Kernen, 4 Bilder mit je 4 Scheinen:

   | | 16 Karten | je Karte |
   |---|---|---|
   | vorher: ein Leser, Bildkopf zuerst | ~92 s | 5,74 s |
   | Leser-Gruppe (`starteLeserGruppe`) | 39,6 s | 2,47 s |
   | Bildkopf gleichzeitig | 33,4 s | 2,09 s |

   Auf hundert Scheine hochgerechnet: **9,6 Minuten werden 3,5 Minuten.**
   16 von 16 richtig gelesen, und der Lauf ging auch bei verdecktem Fenster
   durch.

   **Wichtig, warum das erlaubt war:** der zweite, gruendliche Durchgang
   frisst 65 Prozent der Zeit. Ihn abzuschalten waere der billige Weg gewesen,
   also weniger pruefen, um schneller zu sein. Bei Karams Betraegen ist das
   genau falsch herum. Stattdessen laufen mehrere Leser gleichzeitig: gleicher
   Quelltext, gleiche Einstellungen, gleicher zweiter Durchgang, nur mehrere
   Karten auf einmal. Deshalb kann diese Aenderung kein Ergebnis
   verschlechtern. Die Zahl der Leser bleibt unter der Zahl der Kerne,
   min(4, Kerne minus 2), damit der Rechner bedienbar bleibt.

   **Auf einem Handy noch nicht gemessen.** Dort gibt es weniger Kerne, also
   weniger Leser. Mit zwei Kernen laeuft es wieder einspurig.

7. **Kein einziger Test fasst `oberflaeche/` an.** Nachgepruefte Tatsache:
   keine Datei in `test/` holt sich etwas aus diesem Ordner. Die 181 gruenen
   Tests decken `kern/`, `bild/` und `ausgabe/` ab, aber weder die Ablage noch
   das Clipping-Tool noch die Aufnahmeansicht. Wer die Zahl sieht und daraus
   schliesst, die Ablage sei geprueft, irrt sich.

   Beide brauchen ein Fenster: `getDisplayMedia`, Zwischenablage, Canvas,
   Ziehen mit der Maus. Unter `node --test` gibt es das nicht. Geprueft wurden
   sie stattdessen von Hand im Browser, Schritt fuer Schritt, und genau das
   verlangt Regel 2. Das ersetzt aber keinen Test: es faellt niemandem auf,
   wenn es spaeter kaputtgeht.

   Wer das schliessen will, braucht eine kleine Fensternachbildung fuer
   `zeichne()` und die Ereignisse. Der Aufwand lohnt erst, wenn sich die
   Ablage nicht mehr taeglich aendert.

---

## Zahlen zum Stand

| | |
|---|---|
| Tests | 236, davon 235 gruen und 1 uebersprungen (noch kein echter Korpus) |
| Lesekorpus nachgebaut | 19 Formate, 73 Felder, 100 Prozent |
| Lesekorpus echt | noch leer, die Fotos fehlen |
| Aufbaupruefung | 78 Dateien, keine Beanstandung |
| Fassung | 2026-09-16-i, oeffentlich ausgeliefert |
| Probeseite (nachgebaute Bilder) | bet365 und BetOnline sauber, PS3838 2 von 3, Betway und Stake melden ihre Fehler laut |

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
