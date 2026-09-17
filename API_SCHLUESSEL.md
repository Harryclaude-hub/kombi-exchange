# API-Schlüssel besorgen und eintragen

Karam am 17.09.2026: *"Sag mir, von wem ich das holen soll, wie viel mich das
circa kosten würde, und gib mir eine Schritt-für-Schritt-Anleitung."*

---

## Von wem

**Anthropic**, über `console.anthropic.com`. Das ist eine **andere Anmeldung**
als die Claude-App, auch wenn dieselbe E-Mail-Adresse geht.

**Es gibt keinen kostenlosen API-Schlüssel.** Der kostenlose Plan ist die
Chat-App. Die API wird pro Nutzung bezahlt. Das ist wichtig zu wissen, bevor du
anfängst.

---

## Was es kostet

Preise am 17.09.2026 auf `claude.com/pricing` nachgesehen, je Million Zeichen:

| Modell | gelesen | geschrieben |
|---|---|---|
| Haiku 4.5 | 1 USD | 5 USD |
| **Sonnet 5** | **2 USD** | **10 USD** |
| Opus 5 | 5 USD | 25 USD |

**Gerechnet auf deine Zahlen**, 100 Fotos am Tag, 22 Wochen Saison:

```
je Foto           0,015 USD  (Sonnet 5, Telefonfoto 1170 x 2532)
je Tag            1,50 USD
ganze Saison     33 bis 99 USD, je nachdem wie viele Spieltage je Woche
```

Bei über 20.000 EUR Einsatz je Spieltag sind das Nachkommastellen.

**Nimm Sonnet 5, nicht Haiku.** Haiku ist billiger, verkleinert das Foto aber
auf 724 Bildpunkte Breite. Genau die achtstelligen Stake-Beträge und der
einzelne Formatbuchstabe bei PS3838 verschwinden dabei.

---

## Schritt für Schritt

### 1. Konto anlegen

Auf `console.anthropic.com` gehen und anmelden oder registrieren.

### 2. Guthaben aufladen

Links **Billing**, dann **Add credits**. Fang mit **10 USD** an. Das reicht für
rund 650 Fotos, also mehrere Spieltage, und du siehst am echten Verbrauch, ob
die Rechnung oben stimmt.

### 3. AUSGABENLIMIT SETZEN. Diesen Schritt nicht überspringen.

Ebenfalls unter **Billing**, bei **Usage limits**: setz ein Monatslimit, zum
Beispiel **30 USD**. Dann kann dir nichts davonlaufen, egal was passiert.

### 4. Schlüssel erzeugen

Links **API keys**, dann **Create Key**. Nenn ihn zum Beispiel
`kombi-exchange`. Der Schlüssel fängt mit `sk-ant-` an.

**Er wird dir genau EINMAL gezeigt.** Kopier ihn sofort.

### 5. In das Programm eintragen

Auf `https://harryclaude-hub.github.io/kombi-exchange/`, Reiter **Aufnahme**.
Lad mindestens ein Foto hoch, dann erscheint der Kasten **"KI-Leser
einrichten"**. Schlüssel hineinkopieren, **Schlüssel speichern**.

Danach steht dort **"KI-Leser bereit"** und zeigt nur noch `sk-ant-...1234`.

### 6. Lesen

Fotos hochladen, dann **"Mit KI lesen"** statt **"Jetzt lesen"**.

Der Unterschied: **"Jetzt lesen"** zerlegt das Foto zuerst in Karten und liest
jede einzeln. Genau daran scheitert es bei mehreren Scheinen auf einem Foto.
**"Mit KI lesen"** schickt das ganze Bild und bekommt jeden Schein einzeln
zurück, auch vier nebeneinander in zwei Spalten.

---

## Was du dabei wissen musst

**Der Schlüssel liegt NUR in deinem Browser.** Er geht nicht in die Datenbank,
nicht in das Repository, nirgendwohin sonst. Dein Kollege sieht ihn nicht und
braucht einen eigenen, wenn er die KI benutzen will.

**Schreib ihn niemals in den Chat, in eine Datei oder in eine
Commit-Nachricht.** Das Repository ist öffentlich.

**Löschst du die Browserdaten, ist er weg.** Dann einen neuen erzeugen; das
kostet nichts.

**Die KI darf nichts entscheiden.** Jeder Wert läuft danach durch die
Gegenrechnung: Einsatz mal Quote gleich Auszahlung, und diese Rechnung steht
auf dem Schein selbst. Besteht die Antwort sie, hat die KI abgelesen. Besteht
sie sie nicht, bekommt der Schein einen Hinweis und wartet auf dich. **Du musst
ihr nie glauben.**

**Felder, bei denen die KI selbst gezögert hat**, bekommen eine niedrige
Sicherheit und werden in der Scheinliste warnend eingefärbt. Die sieh dir an.

---

## Wenn etwas nicht geht

Jede Fehlermeldung sagt, was zu tun ist:

| Was dasteht | Was zu tun ist |
|---|---|
| Der Schlüssel wurde nicht angenommen | In der Console einen neuen anlegen |
| Kein Guthaben mehr | Unter Billing nachlegen |
| Zu viele Anfragen auf einmal | Kurz warten, dann noch einmal |
| Anthropic meldet eine Störung | Nichts. Das Programm liest solange örtlich weiter |

**Ein Ausfall hält das Aufnehmen nie an.** Die Fotos sind abgelegt, bevor
irgendetwas an die KI geht.

---

## Was noch NICHT bewiesen ist

Der echte Aufruf. Alles davor und danach ist gemessen: dass ohne Schlüssel
keine Anfrage hinausgeht, dass der Schlüssel im Kopf und nicht in der Adresse
steht, dass jede Fehlerlage einen brauchbaren Satz bekommt, dass ein
Netzausfall nichts anhält.

**Der erste echte Lauf ist deiner.** Nimm zwei oder drei Fotos, am besten eines
von BetOnline mit mehreren Scheinen darauf, und sieh dir an, was herauskommt.
Erst dann wissen wir, wie gut es wirklich liest.
