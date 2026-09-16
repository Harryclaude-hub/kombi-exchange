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

## Der einfache Fall: du bist noch irgendwo angemeldet

Auf einem anderen Rechner, einem anderen Browser, dem Handy. Eine Sitzung
haelt **30 Tage** (`supabase/migrations/0001_kombi_grundgeruest.sql`, `ablauf
:= now() + interval '30 days'`).

Dort oben in der Kopfzeile auf **"Code wechseln"**. Das Programm wuerfelt einen
neuen, zeigt ihn dir einmal, und meldet alle anderen Fenster ab.

## Der andere Fall: du kommst nirgends mehr hinein

Dann setzt du den Code direkt in der Datenbank neu.

1. Supabase oeffnen, Projekt **`appload`** (Kennung `eybwhnvjavovcxvimtxr`).
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

Die Funktion `kombi_code_wechseln` verlangt das, und dieselben Regeln gelten
sinnvollerweise auch hier:

- mindestens **zwoelf Zeichen**
- **keine Leerzeichen**, auch nicht am Anfang oder Ende

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
