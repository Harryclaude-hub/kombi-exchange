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
npm test                      # 131 Tests
node werkzeug/pruefe.mjs      # Aufbaupruefung ueber 53 Dateien
node werkzeug/messe_lesen.mjs # Wie gut wird gelesen: derzeit 100 Prozent
node werkzeug/server.mjs      # Server auf http://localhost:4173
```

Es gibt **keinen Bauschritt**. Reine ES-Module, Bibliotheken liegen fertig in
`lib/`. `npm install` wird nicht gebraucht und ist in diesem Container schon
einmal gescheitert.

---

## Der Auftrag: trainieren

### So laeuft es

1. Server starten, `http://localhost:4173/werkzeug/training/` oeffnen.
2. Karams Fotos auswaehlen. Zwanzig oder hundert, beides geht.
3. **Alles lesen.** Rechne mit etwa fuenf Sekunden je Schein.
4. Durchgehen. Zeilen mit niedriger Sicherheit und Scheine mit Warnung zuerst.
5. Falsches rechts richtig eintragen.
6. **Als Pruefaelle sichern** legt `korpus_echt.mjs` ab. Die Datei gehoert nach
   `test/korpus_echt.mjs`.
7. Einen Test danebenlegen, der diesen Korpus so abprueft wie
   `test/korpus.test.mjs` den nachgebauten.
8. Dann die Fehler beheben, die dabei auftauchen. **Jeden Fehler zuerst zu
   einem Test machen, dann reparieren.**

### Was "trainieren" hier heisst

Kein neuronales Netz wird nachtrainiert. Jeder Fehler, den ein echtes Bild
zeigt, wird zu einem Pruefall, der ab dann fuer immer mitgeprueft wird. Das
Programm wird dadurch messbar besser und kann nicht unbemerkt schlechter
werden.

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

1. **Karams echte Fotos.** Der eigentliche Auftrag der naechsten Sitzung.
2. **Werden die Bilder gespeichert?** Derzeit nein: in der Datenbank stehen nur
   Dateiname, Groesse, Pruefsumme, Anbieter und Konto. Die Fotos liegen allein
   auf dem Geraet. Damit ist der Riesenschein nach einem Geraetewechsel ohne
   Bilder. Karam wollte "eigene Projekte, in denen alle Fotos drin sind". Das
   waere Supabase Storage, heisst aber, dass die Bilder das Geraet verlassen.
   **Karam muss das entscheiden, nicht der Entwickler.**
3. **`public.app_pages` und `public.app_chunks`** in derselben Supabase haben
   den Zeilenschutz aus. Sie sind NICHT Teil dieses Projekts und waren vorher
   da. Nicht eigenmaechtig anfassen.
4. **Waehrungen werden nicht umgerechnet.** Gemischte Waehrungen erzeugen eine
   Warnung, keine Umrechnung.
5. **Dauer bei vielen Bildern.** Etwa fuenf Sekunden je Schein. Bei sechzig
   Scheinen sind das mehrere Minuten. Auf einem Handy noch nicht gemessen.

---

## Zahlen zum Stand

| | |
|---|---|
| Tests | 131, alle gruen |
| Lesekorpus | 19 Formate, 73 Felder, 100 Prozent |
| Massstab geprueft | 60 Scheine, 18 Anbieter, 19.812 $, eine Gruppe |
| Excel | 60 Zeilen, Summe auf den Cent gleich dem Programm |
| Aufbaupruefung | 53 Dateien, keine Beanstandung |

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
