# Uebergabe an die naechste Sitzung

**Stand: 17.09.2026, Fassung 2026-09-17-k, oeffentlich ausgeliefert.**

Diese Datei ist so geschrieben, dass jemand ohne jede Vorgeschichte weiterarbeiten
kann. Zuerst lesen, dann anfangen. Sie ist lang; die ersten fuenf Abschnitte
reichen fuer den Anfang, der Rest ist Nachschlagewerk.

**Wer sofort etwas zu tun sucht: der Abschnitt "DIE FEHLERSUCHE VOM 17.09.2026".**
Dort stehen 47 gegengepruefte Funde mit Datei und Zeilennummer, nach Schaden
geordnet. Die sechs unter "A. Wo Geld falsch wird" sind die einzigen, die
wirklich zaehlen.

---

## Die drei Saetze, die alles andere erklaeren

1. **Karam setzt DIESELBE Kombiwette bei bis zu sechzig Buchmachern gleichzeitig.**
   Ueber 20.000 EUR je Spieltag, eine ganze NFL-Saison lang. Er fotografiert jeden
   Schein; das Programm liest die Zahlen und fasst gleiche Wetten zu einem
   "Riesenschein" zusammen.

2. **Es gibt genau EINEN Zugang.** Kein Login, keine Benutzer. Wer den Code hat,
   sieht alles: Karam und sein Kollege arbeiten am selben Bestand, zeitgleich.
   Das ist Absicht und keine Luecke.

3. **Wo eine Zahl falsch werden kann, ist das der einzige Fehler, der zaehlt.**
   Alles andere ist Kosmetik. Bei sechzig Scheinen je Wette faellt eine falsche
   Zahl nicht auf, bis sie Geld gekostet hat.

---

## Zuerst dies, dann alles andere

**Jede Antwort an Karam beginnt mit "Passt, Karam."** Bei einer reinen
Designaufgabe stattdessen mit "Jawohl, Chef."

**Nach JEDEM Arbeitsschritt veroeffentlichen.** Karam sieht ausschliesslich
`https://harryclaude-hub.github.io/kombi-exchange/`. Was nicht dort ist,
existiert fuer ihn nicht.

```
git add -A
git commit -F -   (lange deutsche Nachricht: Problem, Grund, Messung)
git push origin main
gh run list --limit 1
curl -s "https://harryclaude-hub.github.io/kombi-exchange/fassung.json?t=$(date +%s%N)"
```

**BEIDE Fassungskennungen hochsetzen**, sonst beanstandet es `werkzeug/pruefe.mjs`:
`fassung.json` und `PROGRAMM_FASSUNG` in `daten/einstellungen.js`.

**Vor jedem Commit:**
```
npm test                 (das sind 274 Faelle)
node werkzeug/pruefe.mjs (96 Dateien)
```

**Und dann im Browser nachsehen.** Gruene Tests sind nicht fertig (Regel 2).
`werkzeug/probe/oberflaeche.html` zeigt die ganze Oberflaeche mit echten
Scheinen aus dem Testkorpus, ohne Zugangscode.

---

## Wo die Daten liegen. Das ist die wichtigste Tabelle in dieser Datei.

Karam hat an einem einzigen Tag DREIMAL nachfragen muessen, weil das Programm
eine Luecke wie eine Entscheidung aussehen liess. Wer hier etwas aendert, prueft
diese Tabelle nach.

| Was | Wo | Geteilt? | Ueberlebt Neuladen? |
|---|---|---|---|
| Projekte, Scheine, Riesenscheine | Supabase | ja | ja |
| Namen, Notizen, Ausgaenge | Supabase | ja | ja |
| Ordner am Riesenschein | Supabase, **nach Migration 0009** | nach 0009 | nach 0009 |
| Reihenfolge der Scheine | Supabase (`schein_ids`) | ja | ja |
| **Bildschirmfotos** | **Browser + Ordner auf der Platte** | **nein** | ja |
| Ordner der Projekte, Anpinnen | Supabase | ja | ja |
| Sortierung, "zuletzt geoeffnet", Panel | Browser | nein, absichtlich | ja |

**Die Fotos sind der Sonderfall.** `kombi.bilder` speichert Dateiname, Groesse
und Pruefsumme, NICHT das Bild. In 0001 steht das woertlich so. Der Grund ist
Geld: Supabase gibt kostenlos 1 GB Dateispeicher, das sind rund tausend Fotos,
und Karam rechnet mit 10.000 bis 100.000 in einer Saison. Pro kostet 25 USD im
Monat, und das will er nicht.

Stattdessen liegen die Fotos zweimal auf seinem Geraet:

- **Browserdatenbank** (`daten/ablage.js`), und das Programm bittet den Browser
  ueber `sorgeFuerDauer()`, sie nicht von selbst aufzuraeumen.
- **Ein Ordner auf der Platte** (`daten/plattenspeicher.js`), den er einmal
  aussucht. Jedes neue Foto geht sofort mit dorthin, als ganz normale Datei.

Das Programm ZEIGT diesen Stand an, in der Uebersicht, gemessen statt behauptet:
`oberflaeche/geteilt.js`.

---

## Wo alles liegt

| | |
|---|---|
| Quelltext | `https://github.com/Harryclaude-hub/kombi-exchange` (oeffentlich!) |
| Seite | `https://harryclaude-hub.github.io/kombi-exchange/` |
| Datenbank | Supabase, Projekt `appload`, Kennung `eybwhnvjavovcxvimtxr` |
| Zugangscode | **steht nirgends im Quelltext.** Karam fragen. |
| Karams Fotos | `FOTOS_KARAM.md`: 36 Scheine aus 13 Bildschirmfotos, nachgerechnet. Die BILDDATEIEN gibt es nicht auf der Platte. |

Der Code liegt nur als Einwegwert (bcrypt) in `kombi.zugangscodes`. **Niemals in
eine Datei schreiben, niemals in eine Commit-Nachricht.** Das Repository ist
oeffentlich.

**Karam am 16.09.2026, woertlich:** "Bitte lass ihn nie wieder aendern, okay?
Der soll einfach gleich bleiben. Ausser ich schreibe das in diesen Chat, ich muss
diesen Code aendern." Also: den Code NICHT wechseln, NICHT neu setzen,
`update kombi.zugangscodes` NICHT ausfuehren, solange Karam es nicht selbst im
Gespraech verlangt.

**Ist der Code weg: `NOTFALL.md`**, und im Programm `werkzeug/code_setzen.html`.
Dort wuerfelt sein Browser einen neuen und baut den SQL-Befehl darum; der Wert
laeuft nirgends durch, wo er nicht hingehoert.

**Die Datenbank gehoert Karam.** In dieser Sitzung wurde NICHTS gegen sie
ausgefuehrt. Der MCP-Zugang dieser Umgebung fuehrt auf ein anderes Konto,
`eybwhnvjavovcxvimtxr` ist von hier nicht erreichbar. Migrationen werden
geschrieben und von Karam ausgefuehrt, ueber `werkzeug/datenbank_erweitern.html`.

---

## Wie das Programm fuer den Nutzer aufgebaut ist

Vier Stufen, von aussen nach innen. Der Text dazu steht EINMAL, in
`oberflaeche/aufbau.js`, und wird von der Uebersicht, der Ausgabe und der Ablage
gezeigt.

```
Projekt        Ein eigener Arbeitsplatz. Eine Saison, eine Sportart.
  |            Teilt NICHTS mit anderen Projekten.
  v
Ordner         Nur zum Ordnen. Rechnet seine Riesenscheine zusammen.
  |            Ein Riesenschein muss in keinem liegen.
  v
Riesenschein   EINE Wette, bei vielen Anbietern gesetzt.
  |            Gesamteinsatz, Durchschnittsquote, hoechstmoeglicher Gewinn.
  v
Scheine        Die einzelnen Wettscheine. Hunderte je Riesenschein.
               Jeder aus einem Bildschirmfoto, das Bild bleibt daneben.
```

**ACHTUNG, ZWEI VERSCHIEDENE ORDNER.** In der Ablage ordnen Ordner PROJEKTE, bei
den Riesenscheinen ordnen sie RIESENSCHEINE. Dasselbe Wort, zwei Ebenen. Karam
hatte ausdruecklich Angst vor dieser Verwechslung; deshalb steht in der Ablage
ein Satz, der sagt, welche Stufe dort gemeint ist.

### Die Reiter

`Uebersicht` `Riesenscheine` `Scheine` `Aufnahme` `Ausgabe` `Ablage` `Erklaerung`

### Die drei Ebenen bei den Riesenscheinen

Sie stehen NICHT eigens im Zustand, sie folgen aus zwei Feldern:

| Ebene | Bedingung | Mitte | Spalte links |
|---|---|---|---|
| 1 | `auswahl` ist null | Ordner und lose Riesenscheine, Suche | alle Riesenscheine |
| 1b | `ordnerFilter` gesetzt | nur dieser Ordner, mit seinen drei Summen | nur seine |
| 2 | `auswahl` gesetzt | der Riesenschein und seine Scheine | die Scheine darin |
| 3 | `scheinAuswahl` gesetzt | ein Schein, gross und aenderbar | die Scheine darin |

Eine dritte Angabe koennte mit diesen beiden auseinanderlaufen (Regel 8).

---

## Sofort loslegen

```bash
npm test                      # 274 Faelle
node werkzeug/pruefe.mjs      # Aufbaupruefung ueber 96 Dateien
node werkzeug/messe_lesen.mjs # Wie gut wird gelesen
node werkzeug/server.mjs      # Server auf http://localhost:4173
```

`npm test` meldet EINEN uebersprungenen Test, solange es keine echten Fotos
gibt. Das ist richtig so, siehe "Der Auftrag: trainieren".

`messe_lesen` gibt zwei Zahlen aus. Die erste gilt fuer **nachgebaute** Bilder
und steht bei 100 Prozent. Die zweite gilt fuer **echte Fotos**, und solange
dort nichts steht, sagt die erste nichts ueber echte Fotos aus. Das steht auch
so im Ausdruck.

Es gibt **keinen Bauschritt**. Reine ES-Module, Bibliotheken liegen fertig in
`lib/`. `npm install` wird nicht gebraucht und ist in diesem Container schon
einmal an esbuild gescheitert.

### Die Probeseiten brauchen KEINEN Zugangscode

| | |
|---|---|
| `werkzeug/probe/oberflaeche.html` | die ganze Oberflaeche, echte Scheine aus dem Korpus |
| `werkzeug/probe/anbieter.html` | der ganze Leseweg an nachgebauten Bildern |
| `werkzeug/probe/hilfe.html` | die Erklaerungsseite |
| `werkzeug/probe/anbieterzeichen.html` | alle sechzig Anbieterzeichen |
| `werkzeug/datenbank_erweitern.html` | der SQL-Befehl fuer Migration 0009 |
| `werkzeug/code_setzen.html` | einen neuen Zugangscode wuerfeln |

Alles andere liegt hinter dem Code. Wer ihn nicht hat, kann die Reiter Aufnahme,
Scheine, Riesenscheine, Ausgabe und Ablage nicht selbst ansehen und muss das
ehrlich sagen (Regel 2).

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

## DIE FALLEN. Wenn du nur einen Abschnitt liest, dann diesen.

Jede davon hat in diesem Projekt schon einmal zugeschlagen, meistens ohne dass
ein Test es gemerkt haette.

### 1. Was am Riesenschein haengt, ueberlebt ordneNeu nur, wenn es dort steht

`kern/gruppierung.js` baut die Riesenscheine bei jedem Lauf NEU. `ordneNeu` in
`oberflaeche/zustand.js` rettet danach von der alten Zeile auf die neue:
**Name, Notiz, Anlagedatum, Ordner, Reihenfolge der Scheine**.

Steht etwas nicht in dieser Liste, ist es nach dem naechsten Neuordnen weg. Neu
geordnet wird nach JEDER berichtigten Zahl, nach jedem Ausgang, nach jedem Foto.

Am 17.09.2026 zweimal passiert: die Ordner (vormittags), die Reihenfolge der
Scheine (abends). Beide Male ohne Meldung, beide Male erst durch eine
Gegenpruefung gefunden.

**Wer dem Riesenschein ein Feld hinzufuegt, hat ZWEI Stellen zu bedienen, und die
zweite ist ordneNeu.**

Dazu: verlass dich nicht auf die KENNUNG eines Riesenscheins. Sie bleibt nur,
solange die Scheine ihre `gruppeId` tragen; entsteht eine Gruppe frisch, ist sie
neu. Stabil ist die SIGNATUR.

### 2. Eine offene Huelle haengt die Gruppierung aus

Wer "Neuer Riesenschein" drueckt, macht eine Huelle auf. Danach bekommt JEDER
neu gelesene Schein deren `gruppeId`, und `kern/gruppierung.js` bricht eine
Gruppe mit gesetzter `gruppeId` NIE wieder auf.

Am 16.09.2026 hat das drei verschiedene Wetten zu einer Position von
17.717,48 EUR verschmolzen. Aufgebrochen wird trotzdem nichts: Karam legt die
Scheine selbst dorthin. Stattdessen gibt es die Warnung `gewonnen_und_verloren`
und die Marke "nimmt neue Fotos auf" an der Karte.

### 3. Die Merkmale --auf-gut, --auf-offen, --auf-schlecht

Sie sind die SCHRIFT, die AUF der gleichnamigen Flaeche liegt. Dunkel sind sie
fast schwarz, hell reines Weiss. Auf der normalen Flaeche ergibt das 1,3 bis
2,6 zu 1, also unlesbar. Warnender Text auf normaler Flaeche nimmt `--schlecht`
oder `--offen`. Landet das auf der Grenze, traegt die KANTE das Signal und die
Schrift bleibt `--schrift`.

Fuenf von neun Farbfehlern eines Tages kamen genau daher.

### 4. Kein Uebergang auf Farben

Ein `transition` auf `background` oder `border-color` laeuft NICHT neu an, wenn
sich nur das CSS-Merkmal dahinter aendert. Beim Umschalten von Dunkel auf Hell
blieb jeder Knopf dunkel, waehrend die Schrift hell wurde: 1,08 zu 1. Der
Merksatz steht oben in `stil/bauteile.css`.

### 5. Suchen und Ersetzen in Zeichenketten

Am 16.09.2026 hat ein Umlaut-Durchgang dreimal Code beschaedigt: Bezeichner
umbenannt, Ausdruecke in `${...}` zerschnitten. Der Durchgang steht jetzt als
PRUEFUNG in `werkzeug/pruefe.mjs` und geht Zeichen fuer Zeichen durch, mit
Kenntnis von Kommentar, Zeichenkette und Code. Er MELDET und ersetzt nicht.

Wer trotzdem ersetzt: danach `git diff` ansehen und pruefen, dass JEDE geaenderte
Zeile wirklich das Gewollte enthaelt. Bei 105 Aenderungen war das die einzige
Sicherung, die gegriffen hat.

### 6. Die Migrationen 0001 bis 0009 zusammen lesen

Die schreibende Funktion fuer Riesenscheine hiess in 0001
`public.kombi_riesenscheine_speichern(text, uuid, jsonb)`. In **0004** ist sie
nach `kombi.riesenscheine_schreiben` umgezogen, in **0005** wurde die Huelle in
`public` noch einmal ersetzt, jetzt mit vier Parametern.

Wer nur 0001 liest und die alte Signatur neu anlegt, bekommt eine ZWEITE
Funktion, die niemand ruft. Es haette gespeichert ausgesehen und waere nie
angekommen.

### 7. Eine Luecke ist keine Entscheidung

Karam hat an einem Tag DREIMAL nachfragen muessen, weil im Programm ein Satz
stand wie "liegt nur auf diesem Geraet". Jeder dieser Saetze war WAHR und las
sich trotzdem wie eine Entscheidung statt wie etwas, das noch fehlt.

**Wenn eine Einschraenkung im Programm steht, muss dabeistehen, WORAN sie liegt
und WAS sie aufhebt.** Sonst richtet der Besitzer seine Arbeit danach ein.

### 8. Bash-Heredocs in diesem Container

Sie scheitern an Umlauten, an Anfuehrungszeichen und an `${...}`. Fuer jede
Aenderung an einer Quelldatei: ein Python-Skript mit dem Write-Werkzeug
schreiben und das ausfuehren. Das Skript prueft mit `count(alt) == 1`, dass es
genau eine Stelle trifft, und bricht sonst ab.

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
kern/          Reine Logik, keine Anzeige. HIER WIRD GERECHNET, sonst nirgends.
  zahlen.js      Text zu Zahl. EINZIGE Stelle dafuer.
  handeingabe.js Was der Mensch tippt, ueber zahlen.js gelesen.
  quoten.js      Amerikanisch, dezimal, Bruch. Und versoehne().
  parser.js      Aus Textzeilen einen Schein machen.
  reparatur.js   Verlesene Ziffern anhand der Rechnung berichtigen.
  rechnung.js    Summen, jede auf zwei Wegen gegengerechnet.
  gruppierung.js Gleiche Wetten zu einem Riesenschein zusammenfuehren.
  kennung.js     Erkennen, ob zwei Scheine dieselbe Wette sind.
  etiketten.js   Muster, an denen gelesener Text erkannt wird. NICHT ANFASSEN
                 ohne zu verstehen, dass dort "moegliche" NEBEN "moegliche"
                 stehen muss, beide Schreibweisen (siehe pruefe.mjs).
  buchmacher.js  Anbieterliste, schluesselFuerName, kuerzelFuer.
  status.js      Was ein Stand bedeutet. EINZIGE Stelle dafuer.
  geld.js        formatiere(), formatiereQuote().
  typen.js       Alle Typen als JSDoc.

bild/          Bildzerlegung. segmentierung.js ist das Herzstueck.
lesen/         Texterkennung (tesseract.js, vendorisiert in lib/).

oberflaeche/   Anzeige und Bedienung. HIER WIRD NICHT GERECHNET.
  app.js             Zusammenbau, Kopfzeile, Reiter, Panel links, Speichern.
  zustand.js         Der EINE Arbeitsstand. ordneNeu() ist die heikelste
                     Funktion des ganzen Programms, siehe "Die Fallen".
  werkzeug.js        el(), fuelle(), anbieterzeichen(), ausschnittbild().
  dialog.js          sag/bestaetige/frage. EINZIGE Stelle fuer Rueckfragen.
                     Es gibt KEIN window.confirm mehr im Programm.
  aufbau.js          Projekt > Ordner > Riesenschein > Scheine. EINZIGE Stelle
                     fuer diesen Text.
  geteilt.js         Was geteilt wird, was gespeichert bleibt, wie viel Platz.
  ordner.js          Ordner fuer Riesenscheine. Liest nur, schreibt nie.
  reihenfolge.js     Filtern, Suchen, Anordnen, Ordnersumme. EINZIGE Stelle.
  scheinfelder.js    Die Eingabefelder eines Scheins. EINZIGE Stelle.
  fotoknoepfe.js     Die drei Aufnahmewege. EINZIGE Stelle.
  bildspeicher.js    Die entpackten Bilder, hoechstens 24. EINZIGE Stelle, an
                     der ein Foto in den Arbeitsspeicher kommt.
  nadeln.js          Angeheftete Riesenscheine.
  anleitung.js       Die gefuehrte Anleitung in neun Schritten.
  aufnahme.js        Bild lesen, Scheine daraus machen, beides ablegen.
  bildschirmfoto.js  Bildschirmfoto direkt aufnehmen.
  ansicht_*.js       Je Reiter eine Datei.

daten/
  datenbank.js       Supabase, ausschliesslich ueber RPC.
  ablage.js          Browserdatenbank fuer Bilder. bildmass(), platz(),
                     sorgeFuerDauer().
  plattenspeicher.js Der Ordner auf der Platte. Neu 17.09. abends.
  einstellungen.js   PROGRAMM_FASSUNG und Schluessel.
  fassung.js         Sorgt dafuer, dass der Browser die neue Fassung holt.

ausgabe/       Excel und CSV.
stil/          NUR Design. Loeschbar, ohne dass etwas aufhoert zu arbeiten.
  marken.css     Alle Farben, Groessen, Abstaende. NUR HIER.
  grund.css      Aufbau der Seite.
  bauteile.css   Aussehen der einzelnen Bausteine.
  logos.css      Hausfarben der Anbieter.
  buehne.css     Optionale Bewegung.

werkzeug/      Pruefskript, Server, Messwerkzeug, Probe- und Hilfsseiten.
supabase/migrations/  0001 bis 0009. 0009 ist GESCHRIEBEN, NICHT AUSGEFUEHRT.
test/          28 Testdateien, 287 Faelle.
```

### Die Stellen, die man nur EINMAL anfassen darf

Regel 8 ist im Programm ernst gemeint. Wer eine dieser Sachen an einer zweiten
Stelle nachbaut, baut die naechste Drift ein:

| Sache | Lebt in |
|---|---|
| Text zu Zahl | `kern/zahlen.js` |
| Was ein Stand bedeutet | `kern/status.js` |
| Alle Summen | `kern/rechnung.js` |
| Filtern, Suchen, Anordnen | `oberflaeche/reihenfolge.js` |
| Eingabefelder eines Scheins | `oberflaeche/scheinfelder.js` |
| Rueckfragen an den Menschen | `oberflaeche/dialog.js` |
| Aufnahmewege | `oberflaeche/fotoknoepfe.js` |
| Der Aufbau als Text | `oberflaeche/aufbau.js` |
| Farben und Groessen | `stil/marken.css` |
| Entpackte Bilder | `oberflaeche/bildspeicher.js` |

## DIE FEHLERSUCHE VOM 17.09.2026. Hier steht die Arbeit fuer die naechste Sitzung.

Am Abend des 17.09.2026 hat eine Fehlersuche mit 63 Agenten das ganze Programm
durchgekaemmt, in sechs Richtungen: Geld, Bildverlust, halbfertige Wege, tote
Knoepfe, falsche Aussagen, Datenverlust. **57 Funde, davon 47 nach einer
Gegenpruefung bestaetigt**, jeder mit Stelle und nachgestelltem Ablauf.

**Die Speicherfunde sind erledigt** (Fassung 2026-09-17-k, siehe unten). Alles
Uebrige steht hier, nach Schaden geordnet. Es ist mit Absicht so ausfuehrlich:
jede Zeile nennt die Datei und die Zeilennummer, damit niemand zweimal suchen
muss.

**Der Befund war jedes Mal derselbe: KEINER dieser Fehler erzeugt eine
Meldung.** Von aussen sieht alles richtig aus.

---

### A. Wo Geld falsch wird. Das ist die einzige Liste, die wirklich zaehlt.

Projektregel: bei sechzig Scheinen je Wette faellt eine falsche Zahl nicht auf,
bis sie Geld gekostet hat. Alle sechs sind bestaetigt und mit `node` gegen die
echten Rechenmodule nachgestellt.

**A1. Der Knopf "Gewonnen" verspricht mehr, als er auszahlt.**
`kern/rechnung.js:78`, `kern/parser.js:1585`, `oberflaeche/ansicht_positionen.js:1806`

Ein Schein, den der Parser als verloren gelesen hat, bekommt `ausgezahlt = 0`.
Der Knopftext rechnet ueber `offenePotenzialauszahlung({...sch, status: 'offen'})`
und sieht dieses Feld gar nicht an. `setzeAusgangFuerRiesenschein`
(`oberflaeche/zustand.js:661`) setzt danach nur den Status, nicht `ausgezahlt`.
`realisierterRueckfluss` greift dann bei Zeile 78, weil `0 !== null` ist, und
liefert null Euro mit dem Grund "Aus dem Bild gelesen".

Nachgerechnet: zwei Scheine je 500 zu 1,8, einer als verloren gelesen. Der
Knopf verspricht 1.800,00 zurueck. Heraus kommen 900,00 und ein Ergebnis von
minus 100,00 statt plus 800,00. **Abweichung 900,00 bei zwei Scheinen.**
Und `bekannt: true` sorgt dafuer, dass der Hinweis `realisiert_unklar` gerade
NICHT ausloest.

Derselbe Weg trifft die Statuskorrektur von Hand im Aufklappmenue
(`oberflaeche/scheinfelder.js:211`).

**A2. Each Way zahlt offen das Doppelte, gewonnen das Einfache.**
`kern/rechnung.js:104` gegen `kern/status.js:98`

`offenePotenzialauszahlung` verdoppelt bei `eachWay`, `erwarteterRueckfluss` in
`kern/status.js` kennt `eachWay` ueberhaupt nicht. `kern/rechnung.js:43`
verdoppelt den Aufwand dagegen in beiden Faellen.

Nachgerechnet: Einsatz 1000, Quote 2,0, Each Way. Offen: moegliche Auszahlung
4.000,00, bestenfalls plus 2.000,00. Nach dem Umstellen auf gewonnen: 2.000,00
zurueck, Ergebnis 0,00. **Der Gewinn von 2.000,00 verschwindet beim Klick**,
ohne Hinweis, und keine der vier Gegenproben in `rechne()` schlaegt an, weil
beide Seiten in sich stimmig sind.

**A3. Halb gewonnene Gratiswette verbucht den Einsatz als Rueckfluss.**
`kern/status.js:102-115`

Bei `halb_gewonnen` rechnet es `einsatz / 2 + (einsatz / 2) * dezimal`, bei
`halb_verloren` `einsatz / 2`. Der Parameter `einsatzWirdZurueckgezahlt` wird in
beiden Zweigen nicht abgefragt, obwohl `kern/rechnung.js:85` ihn mit
`!schein.gratiswette` uebergibt. Bei einer Gratiswette war der Einsatz nie
eigenes Geld; er darf nicht zurueckkommen.

**A4. Excel rechnet "Moeglicher Gewinn" anders als das Programm.**
`ausgabe/excel.js:350` und `:629` gegen `kern/rechnung.js:280`

Die Formel ist `I-E`, also moegliche Auszahlung minus GESAMTeinsatz. Das
Programm zieht `einsatzEntschieden` ab. Sobald ein Schein vorzeitig ausgezahlt
wurde, laufen die beiden auseinander, und in der Mappe steht eine Zahl, die das
Programm nie gezeigt hat.

**A5. Excel ueberschreibt die Spalte, auf der eine Formel sitzt.**
`ausgabe/excel.js:243`

Die Abweichungsformel `N-O` steht schon, dann wird `auszahlungGelesen` noch
einmal gesetzt. Nach dem ersten Neuberechnen in Excel zeigt die
Abweichungsspalte eine Abweichung, die es nicht gibt.

**A6. Ein Schein ohne erkannte Waehrung wandert in die Summe der anderen.**
`kern/rechnung.js:173-176`

Direkt unter der Ueberschrift `// ---- Waehrung. Es wird niemals ueber
Waehrungen hinweg summiert. ----` filtert die Zeile `UNBEKANNT` aus der Menge
heraus. Damit gilt der Bestand als einwaehrig, und der Schein ohne Waehrung
zaehlt stillschweigend mit. **Genau die Zusage, die zwei Zeilen darueber
gegeben wird.**

---

### B. Wo Arbeit verlorengeht

**B1. Zwei Berichtigungen in derselben Minute: die zweite wird nie
gespeichert.** `oberflaeche/app.js:1972`, `oberflaeche/werkzeug.js:166`,
`oberflaeche/zustand.js:608`

Der Waechter vergleicht einen Stempel aus `geaendertAm`. `jetzt()` liefert nur
Minuten. Wer eine Zahl berichtigt und innerhalb derselben Minute noch einmal,
hat denselben Stempel: `if (stempel === letzterStempel) return`. Die zweite
Korrektur geht nicht hinaus. Beim Nachlesen von sechzig Scheinen ist eine
Minute gar nichts.

**B2. Die Widerspruchsmeldung raet zum Neuladen, und das Neuladen wirft die
Arbeit weg.** `oberflaeche/app.js:1958-1966` gegen `:1741-1794`

Der Text sagt: "Deine Arbeit liegt hier auf dem Geraet. Am besten diese Angaben
notieren und die Seite neu laden, dann sind beide Staende zusammen sichtbar."
`ladeAlles` ruft `Zustand.ordneNeu(scheine.daten)` mit dem Stand AUS DER
DATENBANK. Die Arbeit auf dem Geraet ist danach fort. Der Rat fuehrt genau in
den Verlust, gegen den er warnt.

**B3. Ein abgebrochener Speicherlauf sperrt alle weiteren.**
`oberflaeche/app.js:1911-1920`

Bricht das Speichern zwischen zwei Haeppchen ab, kehrt der Ablauf um, ohne
`fassung = scheine.fassung` zu setzen. Die Datenbank hat aber weitergezaehlt.
Ab dann wird JEDER weitere Speicherlauf als "zweites Fenster" abgelehnt. Die
Fehlerantwort traegt die neue Fassung mit; sie wird nur nicht uebernommen.

**B4. Ein neuer, noch leerer Riesenschein verschwindet spurlos.**
`oberflaeche/zustand.js:495-507`

Er lebt nur in `stand.huelle`, und `huelle` steht in keinem `merkeStand`-Aufruf.
Wer "Neuer Riesenschein" drueckt, ihn benennt und dann neu laedt oder den
naechsten anlegt, findet ihn nicht wieder.

**B5. Was am Foto von Hand eingestellt wird, ueberlebt kein Neuladen.**
`oberflaeche/app.js:1862-1869` gegen `oberflaeche/aufnahme.js:605-612`

Beim Wiederherstellen werden `karten: []`, `hinweise: []` und `buchmacher:
{wert: null}` gesetzt. Abgelegt wird in `daten/ablage.js` nur
`{id, projektId, dateiname, pruefsumme, breite, hoehe, inhalt}`. Der von Hand
gesetzte Anbieter, der Rahmen und die Kartengrenzen sind danach weg, und aus
dem Foto laesst sich ohne sie nichts mehr lesen.

**B6. Ein geloeschter Schein kommt nach dem Neuladen zurueck.**
`daten/datenbank.js:316`, `oberflaeche/ansicht_scheine.js:404`,
`oberflaeche/zustand.js:784`

`loescheSchein` ist gebaut, die RPC steht, **kein einziger Aufrufer im ganzen
Projekt**. Der Loeschweg endet im oertlichen Stand.

**B7. Die Bildangaben gehen nie in die Datenbank.**
`daten/datenbank.js:346` und `:355`

`holeBilder` und `speichereBilder` sind gebaut, die Tabelle `kombi.bilder` steht
seit Migration 0001, die beiden RPCs und die Rechte auch. Niemand ruft sie.
(Der TEXT, der das Gegenteil behauptete, ist am 17.09. berichtigt; der
Mechanismus fehlt weiter.)

---

### C. Knoepfe und Wege, die nicht tun, was draufsteht

**C1. "trotzdem mitzaehlen" im Resttopf zaehlt nie mit.**
`oberflaeche/ansicht_scheine.js:176-181`

Der Knopf haengt `-b` an die Scheinnummer und meldet Erfolg. Der Schein bleibt
im Resttopf, zaehlt in keine Summe, und die Scheinnummer ist jetzt falsch.

**C2. "Foto hinzufuegen" ausserhalb des Reiters Aufnahme tut sichtbar nichts.**
`oberflaeche/fotoknoepfe.js:114`, `oberflaeche/aufnahme.js:103-238`

`nimmAuf` bereitet nur vor und meldet bei Erfolg nichts. `leseBilder()` wird im
ganzen Programm nur an EINER Stelle gerufen: `ansicht_aufnahme.js:670`. Wer den
Knopf auf einer anderen Seite drueckt, laedt hoch und sieht nichts: kein
Schein, keine Meldung, kein Wechsel.

**C3. Der Haken "Geldfelder einzeln nachlesen" wirkt nur beim allerersten Mal.**
`oberflaeche/aufnahme.js:46-48`

`holeLeser()` liest die Einstellung nur beim Start und haelt den Leser fuer die
ganze Sitzung. `beendeLeser()` wird im Programm nirgends gerufen.

**C4. Die Erklaerung springt immer zum Abschnitt des ERSTEN Aufrufs.**
`oberflaeche/app.js:427`, `oberflaeche/ansicht_hilfe.js:37` und `:52-60`

`hilfeZu` wird nur geleert, wenn man den Knopf drueckt, waehrend man schon auf
der Erklaerung steht. `scrollIntoView` laeuft bei JEDEM Neuzeichnen.

**C5. Die Beschriftung "Sperrcode" zeigt ins Leere.**
`oberflaeche/app.js:238` gegen `:191`

`for: 'torfeld'` gegen ein Feld mit der KLASSE `torfeld` und ohne `id`. Ein
Klick auf die Beschriftung setzt den Schreibzeiger nicht ins Feld.

**C6. Die Ablageflaeche schuetzt sich mit einem toten Klassennamen.**
`oberflaeche/ansicht_aufnahme.js:99`

`.aufnahmeknopf` kommt in keiner `.js`-Datei mehr vor, nur noch in
`stil/bauteile.css`. Die Knoepfe heissen seit `fotoknoepfe.js` anders. Dadurch
loest der versteckte Dateiwaehler der Knopfreihe zusaetzlich den zweiten
Dateiwaehler der Flaeche aus.

---

### D. Saetze, die etwas anderes versprechen, als das Programm tut

**D1. Bei nicht erreichbarer Datenbank sagt "Was dein Kollege sieht" weiter,
alles liege in der Datenbank.** `oberflaeche/geteilt.js:69` -- `sachen()` liest
`stand.ordnerGeteilt`, aber nie `stand.datenbankErreichbar`.

**D2. Die Anleitung verspricht zu viel.** `oberflaeche/anleitung.js:121` --
"Der Schein wird gelesen und faellt in diesen Riesenschein." Das gilt nur,
solange genau dieser die offene Huelle ist.

**D3. Die Erklaerungsseite beschreibt eine Ausgabeseite von gestern.**
`oberflaeche/ansicht_hilfe.js:359` und `:366` -- eine "Vorschau der Tabelle",
die es nie gab, und kein Wort vom Blatt mit Bild.

---

### E. Fertig gebaut, nie angeschlossen

- `kern/quoten.js:80` **`anzeigeAmerikanisch`** rundet wie der Buchmacher
  (1,64 wird zu -157 statt -156). Kein Aufrufer, kein Test. Angezeigt wird
  kaufmaennisch, und `kern/typen.js` behauptet das Gegenteil.
- `kern/geld.js:118` **`excelFormat`** ist eine tote Zweitfassung der
  Zahlenformate und weicht schon heute von `ausgabe/excel.js:24-34` ab.
  **Loeschen**, sonst nimmt sie irgendwann jemand (Projektregel 8).
- `oberflaeche/ordner.js:106` **`brueckenreste()`** soll anzeigen, dass
  Ordnerzuordnungen noch nur im Browser liegen. Kein Aufrufer, und die Bruecke
  wandert von selbst nie in die Datenbank.
- `stil/buehne.js:15` und `:41` **`STUFEN` und `setzeStufe`**: die
  Bewegungsstufen 0 und 2 sind in Code und Stil fertig, es gibt keinen Schalter.
- `werkzeug/probe/anbieter.html` laeuft an der Spaltentrennung vorbei und meldet
  als "bekannte Luecke", was das Programm laengst kann.

---

### F. Zwei Stellen, an denen DIESE Datei falsch lag

Die Fehlersuche hat auch `UEBERGABE.md` gelesen. Beides ist unten berichtigt:

- Der alte Punkt 7 ("Kein einziger Test fasst `oberflaeche/` an") war falsch.
  Tests fassen `oberflaeche/` an, und die dort genannte Testzahl widersprach
  der eigenen Tabelle zwei Seiten weiter.
- Die nie freigegebenen Blob-Adressen standen als offen, obwohl sie inzwischen
  freigegeben werden.

**Wer diese Datei fortschreibt, prueft die eigenen Behauptungen mit.** Eine
Uebergabe, die etwas Falsches als erledigt fuehrt, ist schlimmer als eine
Luecke.

---

### Wo die vollstaendigen Funde liegen

Jeder Fund traegt einen nachgestellten Ablauf mit Zahlen und ein
Gegenpruefungsurteil. Das Tagebuch des Laufs:

```
.claude/projects/C--Users-Home-kombi-exchange/
  82cdad1d-640e-45e2-a9c4-a4a3893e1900/subagents/workflows/
  wf_c31007c6-346/journal.jsonl
```

Zehn der siebenundfuenfzig Funde haben die Gegenpruefung NICHT ueberstanden.
Sie stehen hier nicht, und das mit Absicht: ein Fund, der sich nicht halten
liess, ist kein Fund.

---

## Der Speicherplatz, Fassung 2026-09-17-k. Das Wichtigste des Tages.

Karam: "Du musst wirklich sicherstellen, dass der Speicherplatz immer optimal
gespeichert wird. Dass der User immer seine Fotos irgendwo hat. Also am besten
noch auf dem Desktop, den er gerade nutzt."

Die Fehlersuche hat gezeigt, dass genau das an drei Stellen nicht galt.

### Drei Wege, auf denen ein Foto still verschwand

**1. Die Reihenfolge beim Aufnehmen war falsch herum.**
`oberflaeche/aufnahme.js` -- `legeBildAb` stand VOR `Platte.sichere`. Lief die
Browserdatenbank voll, warf `legeBildAb`, der Ablauf sprang in den `catch` am
Ende der Schleife, und **das Schreiben auf die Platte wurde nie erreicht**. Das
Foto war dann nirgends, obwohl auf der Platte hunderte Gigabyte frei waren.

Jetzt zuerst die Platte (`sichere()` wirft nie), dann der Browser in einem
EIGENEN Versuch. Ein voller Browser darf kein Foto mehr aus der Hand geben, das
drei Zeilen vorher sicher abgelegt wurde.

**2. Die Browserdatenbank meldete Erfolg, bevor sie fertig war.**
`daten/ablage.js`, `imLager` -- es hing an `anfrage.onsuccess`. Das kommt,
sobald die Anfrage in der REIHE steht, nicht wenn sie auf der Platte liegt. Ist
der Speicher voll, bricht der Browser den ganzen Vorgang **erst beim Abschluss**
ab, mit `QuotaExceededError`. Das Programm hatte da laengst "gespeichert"
gemeldet.

Jetzt haengt jedes Schreiben an `vorgang.oncomplete`, mit `onerror` und
`onabort` daneben. Beim LESEN bleibt es bei `onsuccess`: dort ist das Ergebnis
das Ziel. `fehlerVon()` macht aus `QuotaExceededError` einen Satz, der sagt, was
zu tun ist.

**3. Beim Loeschen eines Projekts blieben alle seine Bilder liegen.**
`oberflaeche/app.js` setzte nur `bilder = new Map()`. Die Bilder blieben in der
Browserdatenbank: ohne Projekt, ohne Anzeige, ohne Weg sie je wiederzufinden.
Bei Karams Mengen Gigabyte an Waisen je geloeschtem Projekt, und der Platz, den
die naechste Saison braucht, waere von der vorletzten belegt.

Neu: `loescheBilderZuProjekt` in `daten/ablage.js`, ueber den Index `projekt`,
der dafuer immer schon da war. **Der Ordner auf der Platte bleibt unangetastet.**

### Was bei zehntausend Fotos gebrochen waere

`oberflaeche/bildspeicher.js` (neu).

Beim Start hat das Programm JEDES Bild des Projekts entpackt. Ein
Bildschirmfoto vom Telefon ist 1170 mal 2532 Punkte gross, entpackt vier Byte je
Punkt, also **11,85 MB je Foto**, gleich ob die Datei 300 KB hat.

| | |
|---|---|
| 60 Fotos, ein Spieltag | 711 MB |
| 300 Fotos | 3,3 GB, der Reiter stirbt beim Laden |
| Karams Erwartung | 10.000 bis 100.000 je Saison |

Der Blob dagegen kostet fast nichts, er bleibt auf der Platte liegen. Teuer ist
allein das Entpacken. Also wird erst entpackt, was jemand wirklich ansieht oder
lesen laesst, und es bleiben **hoechstens 24 Stueck** gleichzeitig entpackt.
Wer dazukommt, schiebt das aelteste hinaus; wer benutzt wird, rutscht ans Ende
und faellt nicht heraus.

**Die DATEI wird nie weggeraeumt, nur das Entpackte.** Was hinausgeschoben
wurde, wird beim naechsten Ansehen neu entpackt. Es geht nichts verloren, es
dauert einen Wimpernschlag laenger.

Angeschlossen an vier Stellen: `oberflaeche/werkzeug.js` (`ausschnittbild` holt
sich das Bild selbst nach und zeichnet, sobald es da ist),
`oberflaeche/aufnahme.js` (`leseBilder`, `setzeBereich`) und
`oberflaeche/ansicht_ausgabe.js`. `app.js` entpackt beim Start nichts mehr und
leert den Bildspeicher bei jedem Projektwechsel.

**Im Browser nachgemessen**, nicht nur im Test:

```
60 Fotos in Karams Groesse hintereinander hineingegeben
  entpackt geblieben:     24 von 60
  aeltestes noch da:      nein
  juengstes da:           ja

Ausschnitt aus einem Bild, das NUR als Datei vorlag
  vorher entpackt:        0
  gezeichnete Farbe:      0,0,255,255   (richtiger Bildbereich)
  nachher entpackt:       1
```

### Was behauptet wurde, ohne es zu wissen

**"Alle Bilder dieses Projekts liegen im Ordner"** stand da, sobald `offen` 0
war. Der ANFANGSWERT war 0, und ohne Erlaubnis wurde nie gemessen. Der Kasten
sagte also genau dann, es liege alles sicher, wenn gerade gar nichts
geschrieben wurde.

`offen` ist jetzt **null**, solange nicht nachgesehen wurde, und der Kasten hat
drei Lagen statt zwei: nachgesehen / nicht nachgesehen / keine Erlaubnis.

**"N Bild(er) liegen noch nicht im Ordner"** war die Gesamtzahl ALLER Bilder des
Projekts, auch der laengst gesicherten. Neu: `Platte.fehlende()` zaehlt die
Dateinamen IM ORDNER auf (`handle.keys()`) und vergleicht mit
`dateinameFuer()`. Findet es nichts heraus, kommt `null` zurueck.

**Der Knopf "Ordner wieder freigeben"** rief das Sichern auf, und das Sichern
scheitert genau an der fehlenden Erlaubnis. Der Browser vergisst die Erlaubnis
bei JEDEM Neustart. Es gab also keinen Weg zurueck ausser den Ordner neu
auszusuchen. Neu: `Platte.holeErlaubnis()` mit `requestPermission`, und der
Knopf ruft jetzt den, der zu seiner Aufschrift gehoert.

**"Alle Bilder verwerfen"** hat nichts geloescht, nur ausgeblendet. Nach dem
Neuladen waren alle wieder da, der Rueckfragetext war schlicht falsch, und beim
erneuten Hochladen wurde dasselbe Foto ein ZWEITES Mal abgelegt, weil die
Doppelpruefung nur den Arbeitsstand fragt. Jetzt wird geloescht, und die
Rueckfrage sagt, was das heisst.

**Die Speicherzahlen** wurden einmal je Sitzung gemessen und nie wieder. Nach
einem Projektwechsel standen dort die Zahlen des anderen Projekts. Jetzt wird
beim Wechsel neu gemessen.

**Drei Saetze gestrichen**, die etwas versprachen, das es nicht gibt:

- `daten/plattenspeicher.js` bot Browsern ohne Ordnerzugriff "alles in eine
  ZIP-Datei" an. **Einen solchen Weg gibt es nirgends.** Jetzt steht dort, dass
  es dort heute keinen Ersatz gibt.
- `oberflaeche/geteilt.js` sagte "Eine zweite Kopie gibt es nicht", zwei Kaesten
  unter dem Kasten, der den Ordner auf der Platte erklaert. Beides im selben
  Bild. Der Satz haengt jetzt am gemessenen Zustand.
- Die Liste behauptete, Dateiname und Groesse gingen in die Datenbank. Sie gehen
  nicht: `speichereBilder` ruft niemand (siehe B7 oben).

### Was dabei nachgemessen wurde

`test/speicher_haelt.test.mjs` (6 Faelle, nachgebauter Ordner) und
`test/bildspeicher_haelt.test.mjs` (6 Faelle, nachgebauter Browser). Alle sechs
Lagen, die am 17.09. wirklich zugeschlagen haben, loesen dort aus
(Projektregel 3).

Neue Regel in `werkzeug/pruefe.mjs`: der Probehaken
`__setzeGriffFuerProbe` in `daten/plattenspeicher.js` darf im PROGRAMM nicht
vorkommen. Ein Ordner, den sich das Programm selbst setzt, waere genau das, was
man nicht will. **Die Regel hat beim ersten Lauf ausgeloest**, auf drei Dateien,
weil sie unter Windows die Pfadtrenner falsch verglich.

Und der Browserlauf hat einen Fehler gefunden, den kein Test hatte:
`speicherblock()` bekam den Ordner nicht uebergeben und warf
`ordner is not defined`. Regel 2, woertlich: gruene Tests sind nicht fertig.

---

## Was am 17.09.2026 zuletzt gebaut wurde

Fassung 2026-09-17-j.

### Der Speicherplatz, und warum er so geloest ist

Karam: "Ich habe keinen Bock, so viel auf Supabase zu machen, wenn das dann Geld
kostet. Aber ich will wirklich, dass immer die Fotos gespeichert bleiben, dann
geht nichts verloren. Das ist mir sehr wichtig, sehr, sehr wichtig. Du musst
sicherstellen, dass bei Riesenmengen an Fotos noch immer alle Fotos gespeichert
werden koennen, langfristig. Also am besten noch auf dem Desktop, den er gerade
nutzt."

Er rechnet mit **10.000 bis 100.000 Fotos in einer Saison**. Meine erste
Schaetzung lag bei 140 und war damit um drei Groessenordnungen daneben; sie kam
daher, dass auf einem seiner Fotos neun Scheine nebeneinander standen.

**Die Zahlen aus der Supabase-Dokumentation, am 17.09.2026 abgefragt:**

| | Free | Pro (25 USD/Monat) |
|---|---|---|
| Datenbank | 500 MB je Projekt | 8 GB, dann 0,125 USD/GB |
| Dateispeicher | 1 GB | 100 GB, dann 0,021 USD/GB |
| Datenverkehr | 5 GB/Monat | 250 GB/Monat, dann 0,09 USD/GB |

Daraus folgt: **1 GB sind rund tausend Fotos.** Free traegt das nicht, und Pro
will Karam nicht bezahlen. Also liegen die Fotos auf seinem Geraet, und zwar
ZWEIMAL:

**1. Browserdatenbank** (`daten/ablage.js`). Kostenlos, gross, schnell. Seit dem
17.09. ruft das Programm `sorgeFuerDauer()`, also
`navigator.storage.persist()`: danach raeumt der Browser NICHTS mehr von selbst
weg. Chrome und Edge entscheiden still, Firefox fragt, ein Nein ist kein Fehler.
Das ERGEBNIS wird angezeigt, nicht behauptet.

**2. Ein Ordner auf der Platte** (`daten/plattenspeicher.js`, neu). Karam sucht
einmal einen Ordner aus; der Griff darauf liegt in der Browserdatenbank und
ueberlebt das Schliessen des Fensters. **Jedes neue Foto geht sofort mit
dorthin**, in `oberflaeche/aufnahme.js` direkt neben `legeBildAb`. Nicht spaeter:
ein Foto, das erst beim naechsten Sichern hinausgeht, ist bis dahin genau einmal
vorhanden.

Dazu ein Knopf, der alles Alte nachtraegt, mit Fortschritt. Er zeichnet nur alle
25 Bilder neu; bei zehntausend waeren es sonst zehntausend Neuzeichnungen.

**Die zwei Fallen am Dateinamen**, beide in `test/plattenspeicher.test.mjs`:

- **Ueberschreiben.** Bildschirmfotos heissen bei jedem "Screenshot.png".
  Sechzig davon in einen Ordner, und am Ende liegt EINES da. Jeder Name traegt
  deshalb die Kennung: `Screenshot__aaa-111.png`.
- **Pfad.** Ein Dateiname aus einem Bild ist fremder Text. Gemessen:
  `../../boese/pfad.jpg` wird zu `_b_se_pfad__ddd.jpg`. Kein Schraegstrich,
  kein Punktpunkt.

**Chrome und Edge koennen das, Firefox und Safari nicht**, auf dem Telefon
meistens auch nicht. Dort steht der Kasten mit genau diesem Satz, statt eines
Knopfes, der nichts tut.

**HIER WIRD NICHTS GELOESCHT.** Was einmal im Ordner liegt, bleibt dort, auch
wenn das Bild im Programm entfernt wird. Der Ordner ist die Sicherung, und eine
Sicherung, die mitloescht, ist keine.

### Die Suche

Karam: "Bitte bei der Uebersicht ein Suchpanel machen, wo man einfach etwas nach
Zahl, Name suchen kann, wie beim Explorer."

Gesucht wird in **Name, Ordnername, Notiz, Anbieter, Scheinnummer und
Gesamteinsatz**. Der Einsatz in ZWEI Schreibweisen, `5481` und `5.481,00`: wer
"5000" tippt, soll den mit 5.000,00 finden. Mehrere Woerter muessen alle
vorkommen, in beliebiger Reihenfolge.

**Eine Suche hebt den Ordner auf.** Wer sucht, weiss ja gerade nicht mehr, wo
etwas liegt. Die Ordnerkacheln verschwinden dabei, sonst bliebe offen, ob sie
die Treffer einschraenken.

**Die Falle**: jeder getippte Buchstabe aendert den Arbeitsstand, und danach ist
das Feld ein ANDERES Element. Ohne Zutun waere der Schreibzeiger nach dem ersten
Zeichen weg. Nachgemessen, indem Zeichen fuer Zeichen getippt wurde:

```
"spieltag"   1 Treffer   ueber den ORDNERNAMEN
"5000"       1 Treffer   ueber den Gesamteinsatz
"schein 12"  4 Treffer
"zzz"        Nichts gefunden
```

Waere der Fokus verlorengegangen, haette die Probe beim zweiten Zeichen
abgebrochen.

### Eigene Fenster statt Browser-Popups

`oberflaeche/dialog.js`. Es gibt KEIN `window.confirm`, `window.prompt` oder
`window.alert` mehr im ganzen Programm, an dreizehn Stellen ersetzt. Drei Wege:
`sag()`, `bestaetige()`, `frage()`, alle mit Versprechen, alle mit
Stichpunkten.

**Der Fehler darin, beim Messen gefunden**: zuerst hing das Ergebnis am Ereignis
`close`. Der Klick setzte `returnValue` auf "ja" und schloss das Fenster, aber
`close` kam nicht an. Das Versprechen loeste sich nie ein, und der neue
Riesenschein entstand NICHT. Von aussen ein Knopf, der nichts tut. Jetzt haengt
jeder Weg an seinem eigenen Ereignis: `submit`, `click`, `cancel`, alle drei
einzeln nachgemessen.

### Die Bilder auf jeder Ebene

| Wo | Groesse |
|---|---|
| Spalte links | Daumennagel, 34 Pixel hoch |
| Scheinzeile in der Ablage | Streifen, 56 mal 28 |
| Liste in der Mitte | bis 120 Pixel |
| Aufgemachter Schein | ohne Hoehenbegrenzung |

Ist kein Bild mehr da, bleibt der leere Rahmen stehen. Er sagt, dass hier ein
Bild hingehoert; nichts sagt gar nichts.

---

## Was am 17.09.2026 abends gebaut wurde

Fassung 2026-09-17-c.

### Der Satz, der falsch war

Im Programm stand unter den Ordnerkacheln: *"Die Ordner liegen bis auf Weiteres
nur in diesem Browser. Sie wandern nicht zu deinem Kollegen mit."*

Karam darauf, woertlich:

> "Kannst du mir bitte erklaeren, warum da steht, nur auf diesem Geraet? Du
> musst verstehen, dieses Programm ist ein Account. Es wird alles auf einer
> Datenbank gespeichert, in Supabase. Und ich sehe jedes Foto, jeden Schein,
> den eine Person macht, und die Person genauso bei mir. Da ist einfach alles
> so, ein Programm fuer jeden. Das ist kein eigenes Profil. Das ist einfach DAS
> Profil."

Er hat recht. Der Satz war technisch wahr und trotzdem irrefuehrend: er hat
eine fehlende SPALTE beschrieben, als waere sie eine Eigenschaft des Programms.
Es gibt genau einen Zugang; wer ihn hat, sieht alles. Ein Ordner, den nur ein
Geraet kennt, gehoert da nicht hinein.

**MERKSATZ.** Wenn eine Einschraenkung im Programm steht, muss dabeistehen,
WORAN sie liegt und WAS sie aufhebt. Sonst liest sie sich wie eine
Entscheidung, und der Besitzer richtet seine Arbeit danach ein.

### Der Ordner steht jetzt am Riesenschein

`kern/typen.js` kennt `Riesenschein.ordner`. `oberflaeche/ordner.js` liest nur
noch und rechnet nicht mehr mit Kennungen; geschrieben wird ueber
`Zustand.setzeOrdner`, dort wo auch Name und Notiz geschrieben werden
(Projektregel 8).

Damit faellt `Ordner.wandere` weg, die Umzugsliste vom Vormittag: der Ordner
wandert in `ordneNeu` dieselbe Zeile wie der Name, ueber die SIGNATUR. Eine
zweite Stelle, die man vergessen kann, gibt es nicht mehr.

**DIE BRUECKE.** Wer zwischen `2026-09-17-a` und dieser Fassung Ordner angelegt
hat, hat sie im Browserspeicher unter `kombi-riesenschein-ordner`. Sie werden
weiterhin GELESEN, aber nur dort, wo am Riesenschein selbst nichts steht, und
`setzeOrdner` loescht den alten Eintrag. Damit kann ein Ordner, den Karam
ausdruecklich entfernt hat, nicht wiederkommen. Die Bruecke ist eine
Einbahnstrasse und darf verschwinden, sobald Karam einmal ueberall neu
zugeordnet hat.

### supabase/migrations/0009_riesenschein_ordner.sql

Fuegt `ordner` an `kombi.riesenscheine`, einen Index darauf, und schreibt das
Feld in `kombi.riesenscheine_schreiben` mit. Nimmt nichts weg, ist zweimal
ausfuehrbar.

**DIE STELLE, AN DER ICH FAST DANEBENGEGRIFFEN HAETTE.** In 0001 hiess die
schreibende Funktion `public.kombi_riesenscheine_speichern(text, uuid, jsonb)`.
In **0004** ist sie nach `kombi.riesenscheine_schreiben` umgezogen, und in
`public` steht seither nur eine Huelle, die die Fassung hochzaehlt; **0005** hat
die Huelle noch einmal ersetzt, jetzt mit vier Parametern und `jsonb` als
Rueckgabe. Mein erster Entwurf haette die alte Signatur in `public` neu
angelegt: eine ZWEITE Funktion, die niemand ruft. Der Ordner waere gespeichert
worden, ohne dass je einer ankommt, und nichts haette sich beschwert.

**Wer an diesen Funktionen etwas aendert, liest vorher 0001 BIS 0009 durch und
nicht nur 0001.**

`kombi_riesenscheine_lesen` braucht nichts: es gibt `setof kombi.riesenscheine`
zurueck und waehlt mit `*`, traegt die neue Spalte also von selbst mit.

**DIE MIGRATION IST NICHT AUSGEFUEHRT.** Der MCP-Zugang dieser Sitzung fuehrt
auf ein anderes Supabase-Konto; `eybwhnvjavovcxvimtxr` ist von hier aus nicht
erreichbar, und ein lokales Postgres gibt es in diesem Container nicht. Das SQL
ist also **an keiner Datenbank gelaufen**. Karam fuehrt es selbst aus, ueber
`werkzeug/datenbank_erweitern.html`.

### werkzeug/datenbank_erweitern.html

Dieselbe Seite wie `code_setzen.html`, nur fuer diesen einen Befehl: erklaeren,
kopieren, SQL-Editor oeffnen, nachsehen. Der Befehl steht dort in einer Klammer
aus `begin` und `commit`, damit ein Abbruch in der Mitte gar nichts uebernimmt.

**DERSELBE BEFEHL STEHT DAMIT AN ZWEI STELLEN.** Deshalb hat `werkzeug/pruefe.mjs`
jetzt eine Sperre: es vergleicht, was wirklich ausgefuehrt wird, Kommentare und
die Klammer aussen vor. **Nachgewiesen, dass sie feuert**: ein `'notiz'` in der
Seite auf `'XX'` geaendert, und die Pruefung nannte die Abweichung bei Zeichen
914 mit beiden Textstellen daneben.

### Das Programm behauptet nicht mehr, es sieht nach

`stand.ordnerGeteilt` ist `true`, `false` oder `null`. Gesetzt wird es beim
Laden, aus den Zeilen selbst: bringt eine Zeile das Feld `ordner` mit, gibt es
die Spalte. Kommt keine einzige Zeile, bleibt es `null`, denn dann weiss es
niemand, und ein leeres Projekt beweist nichts.

Der Kasten "Ordner werden noch nicht geteilt" haengt genau daran. Er
verschwindet von selbst, sobald die Migration gelaufen ist, ohne dass jemand
etwas umstellt.

### Die Uebersicht ist ein Dateifenster geworden

Karam: *"Ich will, dass man bei der Uebersicht Ordner anlegen kann, dass man
Sachen in Ordner hinzufuegen kann. Man kann die Ordner separat aufmachen, und
dann kommen alle Riesenscheine, die im Ordner sind. Ich will einfach eine gute
Uebersicht."*

Oben stehen **Ordner und das, was in keinem Ordner liegt**, nicht Ordner UND
zusaetzlich alles: ein Riesenschein im Ordner stuende sonst zweimal auf
demselben Bildschirm. Eine Ordnerkachel MACHT AUF statt zu filtern; drinnen
stehen der Ordnername, seine drei Summen und ein "Zurueck zu allen Ordnern".
Ein neuer Riesenschein, den man in einem Ordner anlegt, landet darin, und der
Knopf sagt das auch.

Unerreichbar wird dabei nichts: die Spalte GANZ LINKS fuehrt weiterhin jeden
Riesenschein des Projekts, mit dem Ordnernamen an der Zeile (Projektregel 9).

`.riesenkarte` ist kein `<button>` mehr, sondern eine Karte mit Knoepfen
("Öffnen", "In Ordner legen"): ein Knopf in einem Knopf ist kein gueltiges
HTML, der Browser zieht ihn heraus.

### Das Pluszeichen unter dem Projekt

Karam: *"Runde vom 16.09.2026, darunter moechte ich ein Pluszeichen, da kann
man Projekte hinzufuegen."*

Den Knopf gab es, er hiess "Neu" und stand zwischen dem Auswahlfeld und
"Leeren". Anlegen und Ausraeumen nebeneinander, beide zwei Silben lang. Jetzt
steht "+ Neues Projekt" in einer eigenen Zeile darunter, und "Leeren" bleibt
klein und leise.

### Eine Berichtigung am Vormittagsbefund

Hier stand, `gruppiere()` vergebe "bei JEDEM Lauf" neue Kennungen. Das ist zu
weit gefasst. Abends nachgemessen:

    zweimal ordneNeu hintereinander            Kennungen unveraendert
    Scheine ohne gruppeId, Gruppe neu gebaut   neue Kennung

Der Fund im Browser war echt (auf der Probeseite kommen die Scheine roh
herein, also ohne `gruppeId`), die Begruendung war zu gross. Beides steht jetzt
in `test/ordner_am_riesenschein.test.mjs`, samt dem Gegenbeweis.

### Gemessen

  Uebersicht mit Ordnern    dunkel 0 Beanstandungen   hell 0
  Offener Ordner            dunkel 0                  hell 0
  Bei 375 Pixeln            dunkel 0                  hell 0, kein Ueberlauf
  Seite Datenbank erweitern dunkel 0                  hell 0

  Ordner "Spieltag 3"       5.000 + 300 + 181     = 5.481,00 $
                            8.200 + 492 + 296,84  = 8.988,84 $
                            Ergebnis 0 + 192 + 0  =   192,00 $
  Neuer Riesenschein im Ordner   landet darin, Feld und Marke stimmen
  Waehrungen gemischt            keine Summe, mit Grund

12 Faelle in `test/ordner_am_riesenschein.test.mjs`, 260 Faelle gruen,
90 Dateien ohne Beanstandung.

---

## Was am 17.09.2026 vormittags gebaut wurde

Alles veroeffentlicht, Fassung 2026-09-17-b, oeffentlich nachgeprueft.

### Drei Ebenen statt zwei Spalten

Karam: "Nummer 1, hier ist die Uebersicht, da sind alle Riesenscheine angezeigt
und Folder. Wenn man einen Riesenschein aufmacht, kommt der Riesenschein dann
in die Mitte, und ganz links werden dann alle Scheine angezeigt, die in diesem
Riesenschein sind. Kann man sie dann separat aufmachen, und dann sieht man im
grossen Bereich, welche Einsaetze man hat, da kann man die auch bearbeiten.
Man kann dann auch auf Zurueck druecken."

| Ebene | Bedingung | Mitte | Spalte links |
|---|---|---|---|
| 1 | `auswahl` ist null | Uebersicht: Ordner und alle Riesenscheine als Karten | Ordner, Anordnung, alle Riesenscheine |
| 2 | `auswahl` gesetzt | der Riesenschein mit seinen Zahlen und seinen Scheinen | die Scheine darin |
| 3 | `scheinAuswahl` gesetzt | ein einzelner Schein, gross und aenderbar | die Scheine darin |

**Die Ebene steht NICHT eigens im Zustand.** Sie folgt aus `auswahl` und
`scheinAuswahl`. Eine dritte Angabe koennte mit ihnen auseinanderlaufen
(Regel 8). Wer eine Ebene sucht, sucht diese beiden Felder.

**`ordneNeu` setzt die Auswahl nicht mehr.** Bis zum 17.09. sprang sie auf die
offene Huelle oder ersatzweise auf den ersten Riesenschein. Beides ist jetzt
falsch: die Huelle bleibt offen, also haette jede berichtigte Zahl die Ansicht
weggerissen, und `auswahl` null IST die Uebersicht. `ordneNeu` raeumt nur noch
auf, was ins Leere zeigt.

### Neuer Riesenschein ohne Zeremonie

Karam: "Ein neuer Riesenschein, wenn ich diesen Knopf druecke, komme ich auf
einen neuen Riesenschein. Das heisst, ich habe jetzt 10, dann bekomme ich 11.
Einen komplett neuen, keine Huelle schliessen, nichts."

Der Streifen mit "Huelle schliessen" ist weg. Ein Druck, und der neue
Riesenschein ist da und aufgeschlagen. Im Browser gemessen: 16 vorher, 17
nachher, ohne Rueckfrage.

**Die Huelle selbst ist geblieben, nur unsichtbar geworden.** Solange ein
Riesenschein der zuletzt aufgemachte ist, wandert jedes neu gelesene Bild
hinein, und die automatische Zuordnung ist dafuer abgeschaltet. Genau das hat
am 16.09. drei verschiedene Wetten zu einer Position von 17.717,48 EUR
verschmolzen (`test/huelle_mischt.test.mjs`). Deshalb steht die Marke "nimmt
neue Fotos auf" an der Karte und am Kopf des Riesenscheins, mit einem kleinen
Knopf, der es abstellt.

### Ordner fuer Riesenscheine

`oberflaeche/ordner.js` und `oberflaeche/reihenfolge.js` sind neu.

**Die Zuordnung lag zunaechst im Browser, NICHT in der Datenbank**, weil
`kombi.riesenscheine` keine Spalte `ordner` hatte. *(Am selben Abend abgeloest:
der Ordner steht seit `2026-09-17-c` am Riesenschein. Warum das von Anfang an
der richtige Ort war, steht im naechsten Abschnitt.)*

**Ordner werden zusammengerechnet.** Gemessen an drei echten Riesenscheinen aus
dem Testkorpus: 5.000,00 + 300,00 + 181,00 = 5.481,00 $ und 8.200,00 + 492,00 +
296,84 = 8.988,84 $. Beides stimmt auf den Cent, von Hand nachgerechnet.
Ueber Waehrungen hinweg wird NICHT summiert: kommt ein Euro-Riesenschein dazu,
steht "Waehrungen gemischt, deshalb keine Summe".

### Der teuerste Fund des Tages: Ordner gingen bei jedem Neuordnen verloren

Vier Riesenscheine in einen Ordner gelegt, einmal auf "Neuer Riesenschein"
gedrueckt: alle vier Ordner weg.

`gruppiere()` vergibt eine neue Kennung, sobald eine Gruppe FRISCH entsteht,
also wenn die Scheine darin keine `gruppeId` tragen. Tragen sie eine, bleibt
die Kennung stehen. **Am 17.09.2026 abends nachgemessen, weil diese Zeile hier
zuerst zu grob stand ("bei jedem Lauf"):**

    zweimal ordneNeu hintereinander            Kennungen unveraendert
    Scheine ohne gruppeId, Gruppe neu gebaut   neue Kennung

Verlassen kann man sich also nur auf die Signatur, nicht auf die Kennung;
deshalb rettet `ordneNeu` auch den Namen ueber `alteNachSignatur`. Der Fund im
Browser war echt (auf der Probeseite kommen die Scheine roh herein, also ohne
`gruppeId`), die Begruendung war zu weit gefasst.

Es ist derselbe Denkfehler, an dem am 16.09. schon `positionImBild` als Beweis
fuer Gleichheit gescheitert ist: **eine Kennung, die sich aendert, taugt nicht
als Gedaechtnis.** Wer kuenftig irgendetwas an einem Riesenschein festmacht,
das nicht IM Riesenschein steht, muss es in `ordneNeu` mitwandern lassen.
`Ordner.wandere()` zeigt, wie. Sieben Faelle in `test/ordner_wandern.test.mjs`.

### Ausgabe: drei Schritte statt fuenf Knoepfe

Vorher fuenf gleich laute Knoepfe in einer Reihe, einer davon ausgegraut ohne
Grund. Jetzt drei nummerierte Schritte: das Bild zum Verschicken, die Tabelle
zum Nachrechnen, die Rohdaten. Vor dem Knopf steht, zu wie vielen Scheinen das
Foto noch vorliegt: ohne Foto fehlt der Schein auf dem Bild, und das stand
bisher erst hinterher da.

"Blatt" steht nur noch im Code (es kommt aus `bild/mosaik.js`), auf dem
Bildschirm heisst es Bild.

### Ablage: ein Knopf, der oeffnet

Die ganze Zeile oeffnete schon immer beim Anklicken, nur stand es nirgends.
Jetzt steht "Oeffnen" da, beim offenen Projekt die Marke "Offen". Dazu "In
Ordner legen": verschoben wurde bisher NUR mit der Maus, und Karams Kollege
arbeitet am Telefon.

Der Knopf "Neuer Ordner" ist weg. Er legte das GERADE OFFENE Projekt in den
neuen Ordner, nicht das, in dessen Zeile man stand.

### Aufgeraeumt

`oberflaeche/scheinfelder.js` ist neu: die Eingabefelder eines Scheins standen
privat in `ansicht_scheine.js`, und Ebene 3 braucht dieselben. Zwei
Abschriften waeren zwei Stellen, an denen sich das Lesen einer Zahl anders
verhaelt; genau daran ist am 16.09. aus `5000.00` schon einmal 500000
geworden. Wortgleich umgezogen, nur die Klasse der Huelle ist ein Zusatz.

Aus `stil/` entfernt, weil kein Bauteil sie mehr traegt: `.scheinpanel`,
`.huellenleiste` samt Zubehoer, `.positionsspalten`.

### Neun Fehler, die dabei gefunden und gemessen wurden

1. **Ordner gingen bei jedem Neuordnen verloren.** Siehe oben.
2. **Zwei verschiedene Sachen hiessen `.projektkopf`:** die Zeile in einem
   Ablage-Eintrag und der Block mit den Projektsummen. Die Ablage-Regel stand
   in `bauteile.css` weiter unten und machte aus dem Raster eine Zeile.
   Gemessen bei 375 Pixeln: die drei Projektzahlen standen als 38 Pixel breite
   Saeulen nebeneinander, ein Buchstabe je Zeile. Breit fiel es nie auf. Die
   Ablage heisst jetzt `.projektzeilenkopf`.
3. **Die Projektzeile hatte drei Rasterspalten bei vier Kindern.** Der Name
   bekam 13 Pixel. Jetzt eine Zeile, die umbricht.
4. **Sechs Klassennamen trugen Umlaute**, seit dem Umlaut-Durchgang vom 16.09.:
   `.hüllenname`, `.hüllenhinweis`, `.kärtcheninhalt`, `.kärtchenzahl`,
   `.hilfeerklärung`, `.hilfewofür`. Fuenf davon haben in `stil/` eine Regel,
   die damit ins Leere lief.
5. **`--auf-schlecht` als Schriftfarbe auf der normalen Flaeche**, an drei
   neuen Stellen. Sie ist die Schrift, die AUF einer roten Flaeche liegt:
   dunkel fast schwarz, hell reines Weiss. Gemessen: rgb(26, 2, 6) auf dunklem
   Grund.
6. **Der gewaehlte Ordner im Panel: 1,35 zu 1 im hellen Schema.**
   `.panelknopf[data-offen]` setzt Flaeche UND Schrift, ich hatte nur die
   Flaeche ueberschrieben.
7. **"nimmt neue Fotos auf": 2,63 zu 1 im dunklen Schema.** `--betonung` als
   Flaeche mit `--knopf-haupt-schrift` darauf. Die alte Huellenmarke trug
   denselben Fehler, nur hat ihn nie jemand gemessen.
8. **`.panelprojektzahl` im Ordnerkasten: 4,25 zu 1 im hellen Schema.** Eine
   Klasse, die woanders gemessen wurde, ist hier nicht gemessen.
9. **`.kombiwarnung`: 4,39 zu 1 im hellen Schema.** Die Warnung war richtig,
   nur zu leise gesetzt.

**Merksatz aus 5 bis 9:** die Merkmale `--auf-gut`, `--auf-offen` und
`--auf-schlecht` gehoeren AUF die gleichnamige Flaeche und nirgendwo sonst.
Warnender Text auf der normalen Flaeche nimmt `--schlecht` oder `--offen`, und
wenn es auf der Grenze landet, traegt die Kante das Signal und die Schrift
bleibt `--schrift`.

### Wie gemessen wurde

Im Browser, jedes Textelement der Seite, Vorder- und Hintergrundfarbe mit Alpha
uebereinandergelegt, bevor die Leuchtdichte gerechnet wird. Abgeschaltete
Bedienelemente sind ausgenommen (so steht es in WCAG). Gemessen auf Ebene 1
mit Ordnern, Ebene 2, Ebene 3, in der Ausgabe und in der Ablage, jeweils hell
und dunkel, bei 1440 und bei 375 Pixeln Breite. Ueberall 0 Beanstandungen.

**Wer nur die Klasse misst, misst nicht die Stelle.** Fuenf der neun Fehler
oben sind genau so entstanden: eine Farbe, die anderswo passt, an einer neuen
Flaeche.

---

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
*(Am 17.09.2026 abgeloest, siehe unten: die Ansicht hat jetzt drei EBENEN statt
drei Spalten.)*

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

0. **Migration 0009 AUSFUEHREN.** Geschrieben ist sie
   (`supabase/migrations/0009_riesenschein_ordner.sql`), das Programm ist darauf
   vorbereitet, und die Seite `werkzeug/datenbank_erweitern.html` haelt den
   Befehl fertig zum Kopieren. **Gelaufen ist sie nicht**: der MCP-Zugang dieser
   Sitzung fuehrt auf ein anderes Supabase-Konto, `eybwhnvjavovcxvimtxr` ist von
   hier aus nicht erreichbar, und ein lokales Postgres gibt es im Container
   nicht. Das SQL ist also an keiner Datenbank geprueft worden, nur gelesen.
   Karam fuehrt es aus; bis dahin steht in der Uebersicht ein Kasten, der sagt,
   dass die Ordner noch nicht geteilt werden, und der von selbst verschwindet.

1. **Karams echte Fotos.** Der eigentliche Auftrag. Der Weg dahin steht, ist
   im Browser durchgemessen und wartet nur noch auf die Bilder.

   Gemessen am 16.09.2026: 3 von 19 Scheinen des Testkorpus landen im
   Restposten mit "keine Auswahl erkannt". Der Parser liest Geld nur, wenn es
   eine Beschriftung auf der eigenen Zeile traegt; eine reine Tabellenzeile mit
   Ueberschriften darueber ist unlesbar. An Karams echter Zeile nachgeprueft:
   nichts gefunden, und statt der Setzzeit wurde die Anstosszeit genommen.

1b. **Drei Bilanzen nebeneinander** statt einer, wenn mehrere Waehrungen
   vorkommen. Karam hat sich dafuer entschieden. Heute steht ueberall nur
   "Waehrungen gemischt, deshalb keine Summe". Das ist richtig, aber es ist
   eine Absage und keine Auskunft.

1c. **Der Bericht "dieses Foto traegt N Wetten".** Offen seit dem 16.09.

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
   - ~~**Bei hundert Bildern laeuft der Speicher voll.**~~ **ERLEDIGT, und die
     Zeile stand hier zu lange falsch.** Die Blob-Adressen werden inzwischen
     freigegeben; die Fehlersuche vom 17.09.2026 hat das nachgeprueft. Der
     Speicher lief aus einem ANDEREN Grund voll, naemlich weil beim Start
     jedes Bild entpackt wurde. Das ist seit Fassung 2026-09-17-k erledigt,
     siehe `oberflaeche/bildspeicher.js`.
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

7. **Die Ablage und das Zuschneidewerkzeug sind ungeprueft.**

   **BERICHTIGT AM 17.09.2026.** Hier stand bis dahin "Kein einziger Test fasst
   `oberflaeche/` an", und dazu eine Testzahl, die der eigenen Tabelle zwei
   Seiten weiter widersprach. Beides war falsch, und die Fehlersuche hat es an
   dieser Datei gefunden. Sechs Testdateien fassen `oberflaeche/` an:
   `anbieterzeichen`, `gebiet`, `huelle_mischt`, `ordner_am_riesenschein`,
   `reihenfolge_haelt` und `bildspeicher_haelt`.

   Wahr bleibt der Kern: **die Ablage (`ansicht_ablage.js`) und das
   Zuschneidewerkzeug (`bildschirmfoto.js`) hat kein Test je angefasst.** Wer
   die Gesamtzahl sieht und daraus schliesst, die Ablage sei geprueft, irrt
   sich.

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
| Tests | 287, davon 286 gruen und 1 uebersprungen (noch kein echter Korpus) |
| Lesekorpus nachgebaut | 19 Formate, 73 Felder, 100 Prozent |
| Lesekorpus echt | noch leer, die Fotos fehlen |
| Aufbaupruefung | 99 Dateien, keine Beanstandung |
| Fassung | 2026-09-17-k, oeffentlich ausgeliefert und nachgeprueft |
| Quelltext | rund 23.700 Zeilen JavaScript, ohne lib/ |
| Commits am 17.09.2026 | 12, jeder einzeln veroeffentlicht |
| Fehlersuche | 63 Agenten, 57 Funde, 47 nach Gegenpruefung bestaetigt |
| Davon erledigt | alle Speicherfunde; der Rest steht mit Zeilennummer in "Die Fehlersuche" |
| Farbkontrast | Ebene 1, 2, 3, Ausgabe und Ablage, hell und dunkel, bei 1440 und bei 375 Pixeln: 0 Beanstandungen |
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
