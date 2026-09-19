# Text zum Abkopieren in einen neuen Chat

## Die Kurzfassung. Diesen Kasten kopieren, mehr nicht.

Der neue Chat liest den Rest selbst aus dem Projekt.

```
Ich heisse Karam. Wir arbeiten an Kombi Exchange unter
C:\Users\Home\kombi-exchange

ZUERST, BEVOR DU IRGENDETWAS TUST: lies START_NEUER_CHAT.md ganz durch, dann
UEBERGABE.md. Wenn du an die Datenbank gehst, zusaetzlich
supabase/TRENNUNG.md. Fang nicht an, bevor du sie gelesen hast.

Bis dahin gelten diese fuenf, auch ungelesen:
1. Jede Antwort an mich beginnt mit "Passt, Karam."
2. Kein langer Gedankenstrich, nirgends, auch nicht im Quelltext.
3. In der Datenbank nur kombi.* und public.kombi_*. Dort liegen zwei weitere
   Programme von mir, die fasst du nie an.
4. Gruene Tests sind nicht fertig. Immer wirklich im Browser nachsehen.
5. Kein Zugangscode und kein API-Schluessel in eine Datei, eine Commit-
   Nachricht oder das Repository. Das Repository ist oeffentlich.

Sag mir zuerst, was du gelesen hast und womit du anfangen wuerdest.
```

Dasselbe steht in `KURZSTART.txt` daneben, zum Aufmachen und Markieren.

---

## Die lange Fassung

Sie muss nicht kopiert werden. Der neue Chat liest sie sich selbst, sobald
er den Kasten oben bekommen hat. Sie steht hier, damit sie da ist.

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
| Datenbank | Supabase, Projekt `immo-check und kombi Tafel`, Kennung `mqmevpyatjsambervgtu` |
| Zugangscode | **steht nirgends im Quelltext.** Frag mich. |
| Stand heute | Fassung `2026-09-19-h`, oeffentlich ausgeliefert |
| Trennung in der Datenbank | **`supabase/TRENNUNG.md` lesen, bevor du irgendetwas an der Datenbank machst.** |

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
11. **Kombi Exchange fasst in der Datenbank NUR `kombi.*` und `public.kombi_*`
    an.** In derselben Supabase-Datenbank liegen zwei weitere Programme von
    mir: Kombi Tafel (`public.kt_*`) und immo-check (`public`, ohne Vorsilbe).
    Nichts davon wird von hier aus gelesen, geschrieben oder auch nur erwaehnt.
    Die ganze Begruendung und der Umzugsweg stehen in `supabase/TRENNUNG.md`.

```
npm test                  (377 Faelle, 376 gruen, 1 uebersprungen)
node werkzeug/pruefe.mjs  (125 Dateien)
git add -A
git commit -F -           (lange deutsche Nachricht: Problem, Grund, Messung)
git push origin main
gh run list --limit 1
curl -s "https://harryclaude-hub.github.io/kombi-exchange/fassung.json?t=$(date +%s%N)"
```

**ALLE DREI Fassungskennungen hochsetzen**, sonst beanstandet es
`pruefe.mjs`: `fassung.json`, `PROGRAMM_FASSUNG` in `daten/einstellungen.js`
und `const FASSUNG` in `dienstarbeiter.js`. Die dritte ist seit dem 18.09.2026
dazugekommen: der Browser vergleicht beim Dienstarbeiter die BYTES, und ohne
eine Aenderung darin wird der alte nie ersetzt.

## Der Zugangscode. Bitte genau lesen.

Ich habe am 16.09.2026 gesagt, woertlich: *"Bitte lass ihn nie wieder aendern,
okay? Der soll einfach gleich bleiben. Ausser ich schreibe das in diesen Chat,
ich muss diesen Code aendern."*

Also: **den Code NICHT wechseln, NICHT neu setzen, `update kombi.zugangscodes`
NICHT ausfuehren**, solange ich es nicht selbst im Gespraech verlange.

Der Code liegt nur als Einwegwert (bcrypt) in der Datenbank. **Er darf niemals
in eine Datei, in eine Commit-Nachricht oder sonstwohin geschrieben werden.**
Das Repository ist oeffentlich.

**Die Datenbank gehoert mir.** Fuehr nichts gegen die Datenbank aus, ohne dass
ich es sage.

Alle zehn Wanderungen sind ausgefuehrt, im Projekt `mqmevpyatjsambervgtu`,
Schema `kombi`. **Der Code ist seit dem 19.09.2026 gesetzt und zugesperrt:**
Wanderung `0010` entzieht `anon` das Recht auf `public.kombi_code_wechseln`,
der Wechseldialog im Programm ist entfernt, und im Kopf steht stattdessen
"Code gesperrt". Aendern geht nur noch im SQL-Editor, also nur durch mich.

Gegen `kombi.zugangscodes` wird nur dann etwas ausgefuehrt, wenn ich es
ausdruecklich im Gespraech verlange.

## Was gerade ansteht

**GANZ OBEN: der Anthropic-Schluessel.** Ich habe am 19.09.2026 gesagt: das
Einzige, was noch uebrig ist, ist der API-Key, damit wir ein richtig gutes
Leseprogramm haben. Der ganze Weg ist gebaut und wartet nur darauf. Die
Anleitung zum Besorgen steht in `API_SCHLUESSEL.md`.

Der Schluessel liegt NUR in `localStorage`, ich trage ihn selbst ein.
**Niemals in eine Datei, eine Nachricht oder einen Commit.** Frag mich nie nach
dem `service_role`-Schluessel von Supabase.

**Was daran noch nie gelaufen ist:** der echte Aufruf. Alles davor ist mit
nachgestellten Antworten geprueft, der letzte Schritt nicht.

**Danach: ich teste das Snipping-Werkzeug** an meinen drei Monitoren mit einem
echten Buchmacherfenster. Es ist gebaut und im Browser durchgemessen, aber noch
nie von mir benutzt. Was dabei auffaellt, gehoert als Erstes behoben.

**Die Fehlersuche vom 17.09.2026 (63 Agenten, 47 bestaetigte Funde) ist seit
dem 19.09.2026 abends KOMPLETT abgearbeitet:** alle Abschnitte A (Geld),
B (Arbeitsverlust), C (tote Knoepfe), D (falsche Saetze) und E, jeder Punkt
mit einem Test, der gegen den alten Stand ausloest. Dabei kam ein weiterer
Fund heraus und wurde behoben: das Speichern von Scheinen warf nach dem
ersten Haeppchen einen stillen ReferenceError
(`test/datenbank_speichern.test.mjs`). Die Begruendungen stehen weiter in
`UEBERGABE.md` im Abschnitt **"DIE FEHLERSUCHE VOM 17.09.2026"**.

**Was noch fehlt und nur ich liefern kann, und ich habe mich am 17.09.2026
dafuer entschieden, es als Naechstes zu tun: MEINE ECHTEN FOTOS.**

Der Lesekorpus (`test/korpus_echt.mjs`) ist leer. Solange er leer ist, ist
JEDE Aussage ueber die Leseguete ungedeckt, auch die hundert Prozent, die
`node werkzeug/messe_lesen.mjs` heute meldet: die gelten nur fuer nachgebaute
Bilder. Man kann nicht einmal sagen, wie viel ueberhaupt an eine KI muesste.

Der Weg, wenn ich die Fotos gelegt habe:

```
Fotos nach .arbeit/fotos/   (ist in .gitignore, verlaesst das Geraet nicht)
node werkzeug/server.mjs
http://localhost:4173/werkzeug/training/
```

Dort: alles lesen lassen, durchgehen, berichtigen, jeden Schein abhaken, dann
"Als Pruefaelle sichern". Die Datei gehoert nach `test/korpus_echt.mjs`.

**Zweitens, ebenfalls am 17.09.2026 entschieden: die Anbieterlogos kommen als
Dateien ins Repository.** Der Weg steht fertig, ich lege die Dateien hinein:
`stil/logos/<schluessel>.png`, dann `node werkzeug/logos_eintragen.mjs`. Die
Anleitung steht in `stil/logos/LIESMICH.md`.

**Drittens, noch offen und wichtig:** die Quotenpruefung zwischen Buchmachern
laesst Faktor 1,5 durch, waehrend meine echte Streuung 4,5 Prozent betraegt.
Ein verlesenes 1,69 als 1,89 kostet auf einem Schein 66 EUR und loest nichts
aus. Die Streuung wird seit Fassung r ANGEZEIGT; die Grenze soll aus meinen
echten Zahlen abgeleitet werden, nicht geraten.

## Stolpersteine in meiner Umgebung

- `npm install` scheitert an esbuild. Wird nicht gebraucht, die Bibliotheken
  liegen in `lib/`.
- `node --test test/` scheitert. Richtig ist `node --test "test/*.test.mjs"`.
- **DREI Fassungskennungen hochsetzen, nicht zwei:** `fassung.json`,
  `PROGRAMM_FASSUNG` in `daten/einstellungen.js` und `const FASSUNG` in
  `dienstarbeiter.js`.
- GitHub Pages haelt Dateien zehn Minuten fest. Direkt nach dem Hochladen sehe
  ich manchmal noch die alte Fassung. Der Fassungschip oben im Kopf laedt
  daran vorbei.
- **Bash-Heredocs scheitern an Umlauten, Anfuehrungszeichen und `${...}`.**
  Fuer jede Aenderung an einer Quelldatei: ein Python-Skript mit dem
  Schreibwerkzeug schreiben und ausfuehren, und darin mit `count(alt) == 1`
  pruefen, dass es genau eine Stelle trifft.
- Git auf Windows braucht `git config core.longpaths true`.
- `werkzeug/probe/oberflaeche.html` zeigt die ganze Oberflaeche mit echten
  Scheinen aus dem Testkorpus, ohne Zugangscode. Zum Nachsehen im Browser:
  `node werkzeug/server.mjs 4173`.

---

## Der Stand in einem Satz

Das Programm laeuft seit dem 19.09.2026 vollstaendig, die ganze Fehlersuche
vom 17.09. ist behoben, der KI-Lesebereich wartet eingerichtet (Sonnet 5) auf
den Schluessel, und Kennfarben samt Symbolen sind gebaut. Was fehlt, ist der
Anthropic-Schluessel und meine echten Fotos.

---

Sag mir zuerst, was du in `UEBERGABE.md` gelesen hast und womit du anfangen
wuerdest. Dann leg los.
