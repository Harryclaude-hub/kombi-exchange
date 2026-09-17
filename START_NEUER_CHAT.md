# Text zum Abkopieren in einen neuen Chat

Alles ab der Linie kopieren und als erste Nachricht in den neuen Chat einfuegen.

---

Ich heisse Karam. Wir arbeiten an **Kombi Exchange**, das liegt bei mir unter
`C:\Users\Home\kombi-exchange`.

**ZUERST, BEVOR DU IRGENDETWAS ANDERES TUST: lies `UEBERGABE.md` im Projekt
ganz durch.** Da steht alles drin: was das Programm ist, wie es aufgebaut ist,
welche Regeln gelten, was schon gefunden wurde und was noch offen ist. Die
Datei ist knapp 2000 Zeilen lang und mit Absicht so ausfuehrlich. Fang nicht
an zu arbeiten, bevor du sie gelesen hast.

## Worum es geht, in drei Saetzen

1. Ich setze **dieselbe Kombiwette bei bis zu sechzig Buchmachern
   gleichzeitig**, ueber 20.000 EUR je Spieltag, eine ganze NFL-Saison lang.
   Ich fotografiere jeden Schein; das Programm liest die Zahlen aus den Bildern
   und fasst gleiche Wetten zu einem **Riesenschein** zusammen.
2. Es gibt genau **einen Zugang**. Kein Login, keine Benutzer. Mein Kollege und
   ich arbeiten am selben Bestand, zeitgleich. Das ist Absicht.
3. **Wo eine Zahl falsch werden kann, ist das der einzige Fehler, der zaehlt.**
   Bei sechzig Scheinen je Wette faellt eine falsche Zahl nicht auf, bis sie
   Geld gekostet hat.

## Wo alles liegt

| | |
|---|---|
| Quelltext | `https://github.com/Harryclaude-hub/kombi-exchange` (**oeffentlich**) |
| Die Seite, die ich benutze | `https://harryclaude-hub.github.io/kombi-exchange/` |
| Datenbank | Supabase, Projekt `appload`, Kennung `eybwhnvjavovcxvimtxr` |
| Zugangscode | **steht nirgends im Quelltext.** Frag mich. |
| Stand heute | Fassung `2026-09-17-k`, oeffentlich ausgeliefert |

## Meine Regeln. Die sind nicht verhandelbar.

1. **Jede Antwort an mich beginnt mit "Passt, Karam."** Bei einer reinen
   Designaufgabe stattdessen mit "Jawohl, Chef."
2. **Wo es einen Pruefstein gibt** (Einsatz mal Quote gleich Auszahlung),
   **darf die Automatik entscheiden. Wo keiner ist, entscheide ich.** Lieber
   eine Luecke mit Warnung als ein erfundener Wert.
3. **Gruene Tests sind nicht fertig.** Immer auch wirklich im Browser
   nachsehen. Am 17.09.2026 hat der Browserlauf einen Fehler gefunden, den
   286 gruene Tests nicht hatten.
4. **Eine Sicherung zaehlt erst, wenn sie ausgeloest hat.** Schreib den Test
   so, dass er die Warnung wirklich ausloest.
5. **Jede Zahl auf einem zweiten Weg gegenrechnen.**
6. `stil/` ist reines Design und muss loeschbar bleiben. **Farben und Groessen
   NIE in JavaScript**, nur ueber `stil/marken.css`.
7. **Kein langer Gedankenstrich** (U+2014) irgendwo. `werkzeug/pruefe.mjs`
   prueft das.
8. **Logik lebt an genau einer Stelle.** Die Tabelle dazu steht in
   `UEBERGABE.md`.
9. **Verworfenes bleibt sichtbar.**
10. **Nach JEDEM Arbeitsschritt veroeffentlichen.** Ich sehe ausschliesslich
    die Seite bei GitHub Pages. Was nicht dort ist, gibt es fuer mich nicht.

```
npm test                  (287 Faelle, 286 gruen, 1 uebersprungen)
node werkzeug/pruefe.mjs  (99 Dateien)
git add -A
git commit -F -           (lange deutsche Nachricht: Problem, Grund, Messung)
git push origin main
gh run list --limit 1
curl -s "https://harryclaude-hub.github.io/kombi-exchange/fassung.json?t=$(date +%s%N)"
```

**BEIDE Fassungskennungen hochsetzen**, sonst beanstandet es `pruefe.mjs`:
`fassung.json` und `PROGRAMM_FASSUNG` in `daten/einstellungen.js`.

## Der Zugangscode. Bitte genau lesen.

Ich habe am 16.09.2026 gesagt, woertlich: *"Bitte lass ihn nie wieder aendern,
okay? Der soll einfach gleich bleiben. Ausser ich schreibe das in diesen Chat,
ich muss diesen Code aendern."*

Also: **den Code NICHT wechseln, NICHT neu setzen, `update kombi.zugangscodes`
NICHT ausfuehren**, solange ich es nicht selbst im Gespraech verlange.

Der Code liegt nur als Einwegwert (bcrypt) in der Datenbank. **Er darf niemals
in eine Datei, in eine Commit-Nachricht oder sonstwohin geschrieben werden.**
Das Repository ist oeffentlich.

**Die Datenbank gehoert mir.** Migrationen werden als Dateien geschrieben, und
**ich** fuehre sie aus, ueber `werkzeug/datenbank_erweitern.html`. Fuehr nichts
gegen die Datenbank aus, ohne dass ich es sage.

## Was gerade ansteht

**Ganz oben: Migration 0009 ist geschrieben, aber noch nicht gelaufen.**
`supabase/migrations/0009_riesenschein_ordner.sql`. Das Programm ist darauf
vorbereitet. Erinnere mich daran, sie auszufuehren.

**Dann: am 17.09.2026 abends hat eine Fehlersuche mit 63 Agenten 57 Fehler
gefunden, 47 davon haben eine Gegenpruefung ueberstanden.** Die zum
Speicherplatz sind erledigt. Alles andere steht in `UEBERGABE.md` im Abschnitt
**"DIE FEHLERSUCHE VOM 17.09.2026"**, mit Datei und Zeilennummer, nach Schaden
geordnet.

**Fang mit Abschnitt A an, "Wo Geld falsch wird".** Sechs Stueck, alle
nachgerechnet, keiner davon erzeugt eine Meldung. Das schlimmste Beispiel: der
Knopf "Gewonnen" verspricht 1.800,00 zurueck und zahlt 900,00, weil ein als
verloren gelesener Schein auf null Euro stehen bleibt.

Danach Abschnitt B, "Wo Arbeit verlorengeht". Besonders:
- Zwei Berichtigungen in derselben Minute: die zweite wird nie gespeichert.
- Ein abgebrochener Speicherlauf sperrt alle weiteren.
- Ein geloeschter Schein kommt nach dem Neuladen zurueck.

**Was noch fehlt und nur ich liefern kann: meine echten Fotos.** Der Lesekorpus
ist leer, die OCR-Ausbildung ist nie mit echten Bildern gelaufen. Frag mich
danach.

## Stolpersteine in meiner Umgebung

- `npm install` scheitert an esbuild. Wird nicht gebraucht, die Bibliotheken
  liegen in `lib/`.
- `node --test test/` scheitert. Richtig ist `node --test "test/*.test.mjs"`.
- **Bash-Heredocs scheitern an Umlauten, Anfuehrungszeichen und `${...}`.**
  Fuer jede Aenderung an einer Quelldatei: ein Python-Skript mit dem
  Schreibwerkzeug schreiben und ausfuehren, und darin mit `count(alt) == 1`
  pruefen, dass es genau eine Stelle trifft.
- Git auf Windows braucht `git config core.longpaths true`.
- `werkzeug/probe/oberflaeche.html` zeigt die ganze Oberflaeche mit echten
  Scheinen aus dem Testkorpus, ohne Zugangscode. Zum Nachsehen im Browser:
  `node werkzeug/server.mjs 4173`.

---

Sag mir zuerst, was du in `UEBERGABE.md` gelesen hast und womit du anfangen
wuerdest. Dann leg los.
