# Hierher gehoeren die Logodateien der Anbieter

Karam am 17.09.2026: *"Ich will, dass ab jetzt bei jedem Anbieter statt Namen
immer das Original-Logo der Anbieter dabei ist."*

## So heissen die Dateien

    stil/logos/<schluessel>.<endung>

Der Schluessel ist der technische Name aus `kern/buchmacher.js`, nicht der
Anzeigename. Also `ps3838.png` und nicht `PS3838.png`, `betathome.svg` und
nicht `bet-at-home.svg`.

Erlaubte Endungen: `.png`, `.svg`, `.webp`, `.jpg`, `.jpeg`, `.gif`, `.avif`.

**Welche Schluessel es gibt, sagt das Werkzeug selbst:**

```
node werkzeug/logos_eintragen.mjs
```

Es zaehlt am Ende jeden Anbieter auf, der noch kein Bild hat, mit Schluessel
und Anzeigename.

## So werden sie eingetragen

Dateien hierher legen, dann einmal:

```
node werkzeug/logos_eintragen.mjs
```

Das Werkzeug sieht nach, welche Dateien wirklich da sind, und schreibt genau
dafuer die Regeln in `stil/logos.css`. **Von Hand eintragen soll das niemand.**
Eine Regel ohne Datei hinterlaesst ein LEERES Kaestchen, weil sie das Kuerzel
unsichtbar macht, damit das Bild darueber liegen kann. Genau der leere Fleck,
den Karam nicht wollte.

`node werkzeug/pruefe.mjs` faengt so einen Fall zusaetzlich ab und sagt, welche
Datei fehlt.

## Was passiert, solange ein Anbieter kein Bild hat

Nichts Schlimmes. Er traegt sein farbiges Kuerzel, und seit dem 17.09.2026 ist
das Kuerzel bei allen sechzig verschieden und jede Hausfarbe gemessen lesbar.
Vorher trugen sechs Anbieter dasselbe graue "BE".

Das Bild ist also eine Verbesserung, keine Voraussetzung. Es muessen nicht
alle sechzig auf einmal da sein.

## Wie gross

Das Zeichen ist 24 mal 24 Bildpunkte gross und zeigt das Bild auf 80 Prozent
davon, also rund 19 Punkte. Eine Datei mit 48 oder 64 Punkten Kantenlaenge
reicht vollkommen; groesser macht die Seite nur schwerer.

Am besten ein Bild mit durchsichtigem Hintergrund und heller Zeichnung: es
liegt auf der Hausfarbe des Anbieters.

## Woher die Dateien kommen

**Die besorgt Karam.** Sie werden nicht von den Webseiten der Buchmacher
heruntergeladen und hier abgelegt, ohne dass er das entschieden hat: das
Repository ist oeffentlich, und Anbieterlogos sind fremde Bildmarken. Er hat
sich am 17.09.2026 fuer diesen Weg entschieden; die Dateien selbst legt er
hinein.
