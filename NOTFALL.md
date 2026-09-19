# Notfall: der Zugangscode ist weg

Diese Seite loest genau einen Fall: du kommst nicht mehr in Kombi Exchange
hinein, weil du den Code nicht mehr hast.

## Zuerst die schlechte Nachricht

**Der Code laesst sich nicht wiederherstellen.** In der Datenbank steht nur
sein Fingerabdruck (bcrypt), nicht er selbst:

```sql
create table kombi.zugangscodes (
  code_hash text not null,   -- nur der Fingerabdruck, nie der Code
  ...
);
```

Das ist mit Absicht so gebaut. Es heisst: **niemand** kann den Code
zurueckrechnen, auch nicht, wer vollen Zugriff auf die Datenbank hat. Der Preis
dafuer ist, dass es keine Frage "Code vergessen" gibt, die man beantworten
koennte. Es gibt nur den Weg, einen neuen zu setzen.

Wer dir anbietet, dir deinen alten Code zu nennen, hat entweder eine andere
Datenbank vor sich oder irrt sich.

## Seit dem 19.09.2026 gibt es nur noch EINEN Weg

Frueher stand oben in der Kopfzeile ein Knopf "Code wechseln". **Den gibt es
nicht mehr.**

Du hast es am 19.09.2026 so verlangt: "Ich will einen Code, den man nicht mehr
aendern kann, ausser in diesem Chat." Wanderung `0010` entzieht dem Programm
das Recht auf `public.kombi_code_wechseln`. Die Sperre sitzt in der Datenbank,
nicht im Knopf: die Funktion war ueber die Schnittstelle fuer jeden erreichbar,
der den oeffentlichen Schluessel hat, und der steht im oeffentlichen Quelltext.

An der Stelle des alten Knopfes steht jetzt **"Code gesperrt"** und erklaert
das.

Es bleibt also nur der Weg unten, und der braucht den SQL-Editor. Der ist
gewollt: dorthin kommt nur, wer das Supabase-Konto hat.

Eine offene Sitzung haelt uebrigens **30 Tage**
(`supabase/migrations/0001_kombi_grundgeruest.sql`,
`ablauf := now() + interval '30 days'`). Solange du irgendwo noch angemeldet
bist, hast du Zeit.

## Einen neuen Code setzen

### Der bequeme Weg: die Hilfsseite

`https://harryclaude-hub.github.io/kombi-exchange/werkzeug/code_setzen.html`

Sie wuerfelt einen Code **in deinem Browser** (crypto.getRandomValues), baut den
fertigen SQL-Befehl darum und hat zwei Knoepfe zum Kopieren sowie einen, der den
SQL-Editor deines Projekts oeffnet. Du musst nichts tippen.

Der Code wird dabei nirgendwohin geschickt. Er steht in keiner Datei, in keinem
Gespraech und auf keinem Server, nur auf deinem Bildschirm. **Schreib ihn auf,
bevor du die Seite zumachst.**

Die Seite ist auch vom Anmeldefenster aus erreichbar, unter
"Code verloren?".

### Der Weg von Hand

Dann setzt du den Code direkt in der Datenbank neu.

1. Supabase oeffnen, Projekt **`immo-check und kombi Tafel`** (Kennung `mqmevpyatjsambervgtu`).
2. Links auf **SQL Editor**.
3. Diese Zeile einfuegen, `DEIN-NEUER-CODE` durch deinen eigenen ersetzen, dann
   ausfuehren:

```sql
update kombi.zugangscodes
   set code_hash = extensions.crypt('DEIN-NEUER-CODE', extensions.gen_salt('bf', 12))
 where aktiv;
```

4. Auf `https://harryclaude-hub.github.io/kombi-exchange/` mit dem neuen Code
   hinein.

Der Befehl steht auch im Programm selbst, am Anmeldefenster unter
**"Code verloren?"**.

### Was der Code erfuellen muss

Die Datenbank prueft das beim Setzen von Hand NICHT nach. Halt dich trotzdem
daran, es sind dieselben Regeln, die die alte Wechselfunktion erzwungen hat:

- mindestens **zwoelf Zeichen**
- **keine Leerzeichen**, auch nicht am Anfang oder Ende

Am besten gar nicht selbst ausdenken, sondern von `werkzeug/code_setzen.html`
wuerfeln lassen. Selbst ausgedachte Codes sind erratbar.

### Wenn die Tabelle leer ist

Beim ganz frischen Aufsetzen gibt es noch keine Zeile, und dann trifft der
`update` oben nichts und meldet `UPDATE 0`. Das ist kein Fehler.
`werkzeug/code_setzen.html` baut deshalb zwei Befehle: einen, der aendert, und
einen, der anlegt, falls es nichts zu aendern gibt. Beide zusammen einfuegen.

### Alle anderen Fenster hinauswerfen

Der Befehl oben aendert nur den Code. Offene Sitzungen auf anderen Geraeten
bleiben gueltig, bis sie ablaufen. Willst du wirklich alle hinaus, zusaetzlich:

```sql
delete from kombi.sitzungen;
```

Danach muss sich jedes Geraet neu anmelden, auch deines.

## Damit es nicht wieder passiert

- **Schreib den Code dorthin, wo deine anderen Passwoerter liegen.** Er steht
  nirgends im Quelltext, in keiner Datei und in keinem Gespraech, und das soll
  auch so bleiben.
- **Der Knopf "Abmelden" oben rechts loescht die Sitzung dieses Browsers.** Er
  fragt vorher nach. Wenn du den Code nicht zur Hand hast, bleib angemeldet.
- **Auch das Loeschen der Browserdaten meldet dich ab**, denn der
  Sitzungsschluessel liegt im localStorage.

## Warum hier kein fertiger Code steht

Ein Zugangscode, der in einer Datei im oeffentlichen Repository steht, ist
keiner. Dieses Repository ist oeffentlich. Deshalb steht hier der Weg, einen zu
setzen, und nie ein Wert.

Dasselbe gilt fuer Gespraeche: ein Code, den du irgendwo hinschreibst, liegt ab
dann dort. Bei einem Terminal, das ueber zwanzigtausend Euro fuehrt, ist der
kurze Weg der teure.
