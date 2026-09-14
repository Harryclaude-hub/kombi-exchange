# Karams echte Bildschirmfotos

**Stand 14.09.2026. Dreizehn Bildschirmfotos, 36 Scheine, fuenf Anbieter.**

---

## Warum es diese Datei gibt

Karam hat die Fotos im Gespraech geschickt, nicht als Datei. Sie liegen
**nirgends auf der Festplatte** und lassen sich von einer Sitzung aus auch
nicht dorthin schreiben. `.arbeit/fotos/` ist leer. Gesucht wurde am
14.09.2026 in Temp, Downloads, Bilder und Screenshots: nichts davon.

Damit waere das Wissen aus den Fotos beim naechsten Sitzungswechsel weg.
Diese Datei haelt es fest: **jeder Schein, jede Zahl, jede Nachrechnung.**

Wer die Bilddateien doch noch bekommt, legt sie nach `.arbeit/fotos/` und
faehrt mit `werkzeug/training/` fort. Dann und nur dann ist auch die
Texterkennung an echten Pixeln gemessen.

**Die Zahlen hier sind von den Bildern ABGELESEN und nachgerechnet.** Sie
stehen als lauffaehige Tests in `test/echte_fotos.test.mjs`.

---

## Die fuenf Anbieter auf einen Blick

| Anbieter | Aufbau | Sprache | Waehrung | Der Fallstrick |
|---|---|---|---|---|
| **PS3838** | TABELLE, keine Karten | englisch | EUR | `Win/Loss` ist der GEWINN, nicht die Auszahlung. Quote nackt mit Buchstaben `D`. Einsatz als `Risk: 500.00 (500.00)`. |
| **Betway** | helle Karten | deutsch | EUR | `Umsetzen` statt Einsatz, `DU HAST GEWONNEN` ueber der Auszahlung, `UNGUELTIG` und `Erstattet` bei Annullierung. Quote hinter `@` in der Kopfzeile. |
| **bet365** | dunkle Karten | deutsch | EUR | `Gewinn` ist die Auszahlung MIT Einsatz. Deutscher Tausenderpunkt. |
| **Stake** | dunkle Karten, teils ZWEI Spalten | deutsch | Krypto | Acht Nachkommastellen, abgeschnitten: `5,000.000000...`. Quote deutsch (`1,90`), Betrag englisch (`2,000.00`), im selben Schein. `Quoten`, `Verlust`, `Gewonnen`. |
| **BetOnline** | helle Liste | englisch | USD | Amerikanische Quoten, und **die Anzeige ist gerundet**. Verlorene Scheine haben GAR KEINE Returns-Spalte. |

---

## Bild 1: PS3838, vier Tabellenzeilen ohne Kopfzeile

Alle vier: `Over 84.5 Rushing Yards`, `Jahmyr Gibbs Total Rushing Yards`,
`Detroit Lions-vs-New Orleans Saints`, `Player Props / Specials`,
`NFL @ 2026-09-13`, Stand `Settled WIN`.

| Scheinnr. | Quote | Risk | Win/Loss | Nachgerechnet |
|---|---|---|---|---|
| 3778262388 | 1.826 D | 2,315.98 | 1,913.00 | 2315,98 mal 0,826 = 1912,99 |
| 3778262278 | 1.833 D | 2,583.54 | 2,152.09 | 2583,54 mal 0,833 = 2152,09 |
| 3778261196 | 1.840 D | 2,560.00 | 2,150.40 | 2560 mal 0,840 = 2150,40 |
| 3778259370 | 1.847 D | 2,540.48 | 2,151.79 | 2540,48 mal 0,847 = 2151,79 |

Die Auszahlung steht NIRGENDS auf dem Schein und wird gerechnet:
Einsatz mal Quote.

---

## Bild 2: PS3838 mit Kopfzeile, fuenf Zeilen

Kopfzeile: `# | Product | Detail | Selection | Odds | Stake (EUR) | Win/Loss |
Commission | Status`

| Nr. | Scheinnr. | Auswahl | Quote | Risk | Win/Loss | Stand |
|---|---|---|---|---|---|---|
| 1 | 3777854081 | Over 226.5 Passing Yards, Caleb Williams, Carolina-vs-Chicago | 1.854 D | 500.00 | 427.00 | WIN |
| 2 | 3777852309 | dieselbe Wette | 1.862 D | 499.00 | 430.14 | WIN |
| 3 | 3778381351 | Over 230.5 Passing Yards, Baker Mayfield, Cincinnati-vs-Tampa Bay | 1.847 D | 2,540.48 | -2,540.48 | LOSE |
| 4 | 3778380366 | dieselbe Wette | 1.854 D | 2,518.00 | -2,518.00 | LOSE |
| 5 | 3778379679 | dieselbe Wette | 1.833 D | 1,660.00 | -1,660.00 | LOSE |

Nachgerechnet: 500 mal 0,854 = 427,00 und 499 mal 0,862 = 430,14.
**Bei einem verlorenen Schein steht in der Gewinnspalte der Einsatz mit
Minus.** Das ist keine Auszahlung, und `ausgezahlt` ist 0.

---

## Bild 3: Betway, zwei Karten, deutsch

**Karte 1, GEWONNEN**

```
Einzelwette @ 1.74                              GEWONNEN
Los Angeles Rams - San Francisco 49ers
   7 Los Angeles Rams
  27 San Francisco 49ers
Deebo Samuel Sr. (SF) Ueber 2.5: Erfolgreiche Annahmen gesamt
Umsetzen                        DU HAST GEWONNEN
78,30 EUR                       136,30 EUR
```

**Die angezeigte Quote stimmt nicht.** 136,30 geteilt durch 78,30 sind
1,7407, angezeigt wird 1.74.

**Karte 2, UNGUELTIG**

```
Einzelwette @ 1.87                              UNGUELTIG
Seattle Seahawks - New England Patriots
  13 Seattle Seahawks
  10 New England Patriots
Elijah Arroyo (SEA) Ueber 8.5: Gesamtanzahl Receiving Yards
Umsetzen                        Erstattet
287,50 EUR                      287,50 EUR
```

Annulliert. Der Einsatz kommt unveraendert zurueck, kein Gewinn, kein Verlust.
Hier gibt es KEINEN Pruefstein: 287,50 zurueck aus 287,50 ergibt den Faktor 1
und sagt ueber die Quote nichts.

---

## Bild 4 und 5: bet365, fuenf Karten, deutsch, dunkel

Alle auf **Nahshon Wright, NY Jets gegen TEN Titans, 23 zu 10**, alle GEWONNEN.

| Auswahl | Markt | Quote | Einsatz | Gewinn | Nachgerechnet |
|---|---|---|---|---|---|
| Weniger als 2.5 | Tackles Ue/U | 1.80 | 250,00 | 450,00 | 250 mal 1,80 = 450 genau |
| Weniger als 3.5 | Tackles und Assists | 1.73 | 273,97 | 473,97 | 273,97 mal 1,73 = 473,9681 |
| Weniger als 3.5 | Tackles und Assists | 2.15 | 224,00 | 481,60 | 224 mal 2,15 = 481,60 genau |
| Weniger als 3.5 | Tackles und Assists | 2.30 | 961,54 | **2.211,55** | 961,54 mal 2,30 = 2211,542 |
| Weniger als 1.5 | Assists Ue/U | 1.47 | 425,53 | 625,53 | 425,53 mal 1,47 = 625,5291 |

**`Gewinn` ist hier die Auszahlung MIT Einsatz.** Im Englischen waere `win`
der reine Gewinn. Das Wort entscheidet nicht, die Rechnung entscheidet.

Der vierte Schein traegt den **deutschen Tausenderpunkt**: `2.211,55`.

---

## Bild 6 und 7: Stake, vier Karten, EINE Spalte

Alle: `Ueber 8.5 Receiving Yards`, `Elijah Arroyo`, Ergebnis `0`,
`Do., 10. Sept. 02:20`, `Seattle Seahawks 13 / New England Patriots 10`,
Stand **`Verlust`**.

| Quoten | Einsatz | Auszahlung |
|---|---|---|
| 1,90 | 2,000.000000... | 0.00000000 |
| 1,90 | 5,000.000000... | 0.00000000 |
| 1,90 | 3,000.000000... | 0.00000000 |
| 1,90 | 1,000.000000... | 0.00000000 |

**Der gefaehrlichste Fall im ganzen Satz.** Die drei Punkte am Ende wurden
einmal als Trennzeichen gelesen, und aus 5.000 wurden 5.000.000.000. Faktor
eine Million, ohne jede Warnung.

Die `0` unter Auszahlung ist der TATSAECHLICHE Rueckfluss, nicht der moegliche
Gewinn. Beide Zahlen werden gebraucht: 2000 mal 1,9 = 3800 waere moeglich
gewesen, zurueck kam 0.

---

## Bild 8: Stake, vier Karten in ZWEI Spalten

| Position | Auswahl | Stand | Quoten | Einsatz | Auszahlung | Echter Multiplikator |
|---|---|---|---|---|---|---|
| links oben | Ueber 227.5 Passing Yards, Baker Mayfield (216), Cincinnati 33 / Tampa Bay 27 | Verlust | 1,83 | 700.00000000 | 0.00000000 | keiner ableitbar |
| rechts oben | unentschieden oder Kanada, Doppelte Chance, Tanzania 0 / Kanada 6 | Gewonnen | 1,01 | 5,100.000000... | 5,151.000000... | **1,01 genau** |
| links unten | Ueber 2.5 Annahmen, Deebo Samuel Sr. (6), LA Rams 7 / SF 49ers 27 | Gewonnen | 1,69 | 2,165.000000... | 3,660.804995... | 1,690903 |
| rechts unten | dieselbe Wette | Gewonnen | 1,69 | 5,000.000000... | 8,454.515000... | 1,690903 |

**Ein schoener Gegenbeweis:** zwei voellig verschiedene Einsaetze auf
dieselbe Wette ergeben denselben echten Multiplikator 1,690903. Wenn das
Programm richtig rechnet, muss das herauskommen.

---

## Bild 9: Stake, vier Karten in ZWEI Spalten

| Position | Auswahl | Stand | Quoten | Einsatz | Auszahlung | Echter Multiplikator |
|---|---|---|---|---|---|---|
| links oben | Ueber 82.5 Rushing Yards, Jahmyr Gibbs (156), Detroit 31 / New Orleans 30 | Gewonnen | 1,84 | 5,000.000000... | 9,175.995500... | **1,8351991** |
| rechts oben | dieselbe Wette | Gewonnen | 1,84 | 500.00000000 | 920.81035000 | 1,8416207 |
| links unten | Ueber 227.5 Passing Yards, Caleb Williams (269), Carolina 37 / Chicago 59 | Gewonnen | 1,83 | 5,801.002500... | 10,587.70319... | 1,8251506 |
| rechts unten | Ueber 227.5 Passing Yards, Baker Mayfield (216), Cincinnati 33 / Tampa Bay 27 | Verlust | 1,83 | 5,000.000000... | 0.00000000 | keiner ableitbar |

**Angezeigt 1,84, wahr 1,8351991.** 5000 mal 1,84 waeren 9200, ausgezahlt
wurden 9175,9955. **Vierundzwanzig Euro daneben auf EINEM Schein.**

Der Einsatz `5,801.0025` zeigt die Rundung auf den Cent: das Programm legt
5.801,00 ab. Ein Viertelcent, offene Frage an Karam.

---

## Bild 10 bis 13: BetOnline, acht Scheine, englisch

Aufbau je Schein:

```
#396228612  Sep 10, 10:42 PM                              won
Deebo Samuel
San Francisco 49ers @ Los Angeles Rams
WILL HAVE OVER 2.5 RECEPTIONS
FINAL PLAYER SCORE: 4
Odds: -157        Stake: $ 181        Returns: $ 296.84
```

| Scheinnr. | Zeit | Spieler | Markt | Odds | Stake | Returns | Echter Multiplikator |
|---|---|---|---|---|---|---|---|
| 396376584 | Sep 13, 1:28 PM | Caleb Williams | OVER 229.5 PASSING YARDS (268) | -115 | $ 300 | $ 561 | **1,87 genau** |
| 396228612 | Sep 10, 10:42 PM | Deebo Samuel | OVER 2.5 RECEPTIONS (4) | -157 | $ 181 | $ 296.84 | **1,64 genau** |
| 396228581 | Sep 10, 10:41 PM | Deebo Samuel | OVER 2.5 RECEPTIONS (4) | -157 | $ 300 | $ 492 | 1,64 |
| 396228545 | Sep 10, 10:41 PM | Deebo Samuel | OVER 2.5 RECEPTIONS (4) | -157 | $ 300 | $ 492 | 1,64 |
| 396376613 | Sep 13, 1:29 PM | Caleb Williams | OVER 229.5 PASSING YARDS (268) | -115 | $ 274 | $ 512.38 | 1,87 |
| 396418815 | Sep 13, 6:39 PM | Baker Mayfield | OVER 231.5 PASSING YARDS (216) | -114 | $ 268 | **fehlt** | keiner ableitbar |
| 396418628 | Sep 13, 6:39 PM | Baker Mayfield | OVER 231.5 PASSING YARDS (216) | -114 | $ 300 | **fehlt** | keiner ableitbar |
| 381217420 | Feb 8, 11:37 PM | Kenneth Walker III | LONGEST RUSH OVER 14.5 (SEA @ NE) | -121 | $ 2 | $ 3.66 | 1,83 |

### Der teuerste Fallstrick im ganzen Satz

**Die angezeigte amerikanische Quote ist gerundet, und zwar vom Betrag her
nach oben.** Wer sie umrechnet, liegt bei jedem Schein daneben:

```
-157   umgerechnet 1,63694     die Auszahlung verlangt 1,64
       auf 300 Dollar:  491,08  statt der wirklichen 492,00
-121   umgerechnet 1,82645     die Auszahlung verlangt 1,83
       auf 2 Dollar:      3,65  statt der wirklichen 3,66
-115   umgerechnet 1,86957     die Auszahlung verlangt 1,87
```

Wo `Returns` dasteht, ist **Einsatz mal X gleich Returns** der Pruefstein.
Dort darf die Automatik entscheiden. Wo `Returns` fehlt (verlorene Scheine),
bleibt nur die Anzeige.

### Zwei getrennte Scheine mit identischen Zahlen

**396228581 und 396228545** stehen in Bild 10 direkt nebeneinander: gleicher
Spieler, gleicher Markt, gleiche 300 Dollar, gleiche -157. **Nur die
Scheinnummer unterscheidet sie.** Wuerden sie als Doppelupload zusammengefasst,
fehlten 300 Dollar Einsatz und 492 Dollar Auszahlung in der Summe.

Bild 12 und 13 zeigen dasselbe Fenster als ganzen Browser-Bildschirm mit dem
Fenster "My Bets", also BetOnline mit Menue, Kopfleiste und Kontostand
5.600,66 Dollar.

---

## Die Endabrechnung ueber alle 36 Scheine

Umgerechnet wird NICHT. Euro, Dollar und Krypto bleiben getrennt.

| Anbieter | Scheine | Einsatz | Moegl. Auszahlung | Multiplikator | Zurueck |
|---|---|---|---|---|---|
| PS3838 | 9 | 17.717,48 EUR | 20.223,42 | 1,1414 | 20.223,42 |
| bet365 | 5 | 2.135,04 EUR | 4.242,65 | 1,9872 | 3.761,05 |
| Betway | 2 | 365,80 EUR | 423,80 | 1,1586 | 423,80 |
| BetOnline | 8 | 1.925,00 USD | 2.357,88 | 1,2249 | 2.357,88 |
| Stake | 12 | 40.266,00 Krypto | 37.950,83 | 0,9425 | 37.950,83 |

Je Waehrung: **EUR 20.218,32** Einsatz gegen 24.889,87, **USD 1.925,00**
gegen 2.357,88, **Krypto 40.266,00** gegen 37.950,83.

Beide Summen wurden auf einem zweiten Weg ohne `kern/rechnung.js`
gegengerechnet und stimmen auf den Cent.

**Achtung beim Lesen:** `auszahlungMoeglich` ist NICHT die Summe aller
moeglichen Auszahlungen. Bei einem entschiedenen Schein zaehlt, was wirklich
zurueckkam, und nur bei einem offenen das, was noch kommen kann. Wer alle
`auszahlung`-Felder addiert, zaehlt die Auszahlungen verlorener Scheine mit,
die es nie gab. Diese Verwechslung sah beim Gegenrechnen zuerst wie ein
Programmfehler aus und war keiner.

---

## Der rote Faden: die angezeigte Quote ist meist nicht die echte

Bei **vier von fuenf** Anbietern weicht die Anzeige ab:

```
BetOnline   -157 angezeigt    ->  wahr 1,64
Stake       1,84 angezeigt    ->  wahr 1,8351991
Betway      1.74 angezeigt    ->  wahr 1,7407
PS3838      1.854 angezeigt   ->  wahr 1,854   (stimmt)
bet365      1.80 angezeigt    ->  wahr 1,80    (stimmt)
```

Wo Einsatz und Auszahlung beide dastehen, rechnet das Programm den genauen
Multiplikator zurueck und schlaegt die Anzeige. Das ist Projektregel 1.

---

## Karam setzt NICHT dieselbe Linie bei allen Anbietern

Das ist fuer den Riesenschein entscheidend:

```
Jahmyr Gibbs      PS3838 Over 84.5     Stake Ueber 82.5
Caleb Williams    PS3838 Over 226.5    Stake Ueber 227.5    BetOnline OVER 229.5
Baker Mayfield    PS3838 Over 230.5    Stake Ueber 227.5    BetOnline OVER 231.5
```

**Das sind verschiedene Wetten mit verschiedenem Risiko**, und das Programm
haelt sie zu Recht auseinander. Nur wo die Linie wirklich gleich ist, gehoeren
sie zusammen:

```
Deebo Samuel      Ueber 2.5 Annahmen     BetOnline, Stake, Betway
Elijah Arroyo     Ueber 8.5 Rec. Yards   Stake, Betway
```

Diese beiden sind die einzigen echten anbieteruebergreifenden Riesenscheine im
ganzen Satz.

---

## Was an diesen Fotos noch NICHT geloest ist

1. **Betway:** die Bildzerlegung schneidet eine Karte an ihrer Spielstandsbox
   durch. Der Kopf landet auf der einen Haelfte, das Geld auf der naechsten.
   Faellt laut auf (`FEHLER einsatz_fehlt`), aber die Karte ist unbrauchbar.
2. **Stake:** die zwei nebeneinanderliegenden Spalten werden nicht getrennt.
   Von vier Wetten werden zwei Karten gefunden.
3. **PS3838, verlorene Zeile:** dort ist die Texterkennung wirklich kaputt
   (`bool`, `Egat`, `22D`, `oC`). Ohne Gewinnspalte kein Pruefstein, also
   keine Quote. Einsatz und Stand stimmen.
4. **Anbieteruebergreifende Gruppierung** erreicht 0,20 bis 0,46 gegen eine
   Schwelle von 0,60. Es fehlen die uebersetzten Marktbegriffe
   (`receptions` gegen `Annahmen`) und die Paarung bei Stake.

Punkt 1 und 2 haengen an Schwellwerten der Zerlegung, und die haengen daran,
wie stark die Trennlinie im ECHTEN Bild ist. **Die Nachbauten in
`werkzeug/probe/anbieter_bilder.js` sind meine Zeichnung. Wer daran dreht,
stellt auf das eigene Artefakt ein.** Das wartet auf die Dateien.
