import test from 'node:test'
import assert from 'node:assert/strict'

import { baueZeilentext } from '../lesen/ocr.js'
import { leseSchein } from '../kern/parser.js'

/**
 * Die Spaltengrenze aus den Wortkaesten.
 *
 * WARUM ES DIESEN TEST GIBT
 *
 * Am 14.09.2026 waren 202 Tests gruen, und trotzdem konnte keine einzige
 * Tabellenregel an einem echten Bild greifen. In lesen/ocr.js stand eine Zeile:
 *
 *     String(zeile.text).replace(/\s+/g, ' ')
 *
 * Damit wurde jede Folge von Leerzeichen zu genau einer. Der Parser erkennt
 * eine Spaltengrenze an ZWEI Leerzeichen, und die gab es nach dieser Zeile nie
 * mehr. Alle Tests liefen auf Zeilen, die von Hand mit zwei Leerzeichen
 * geschrieben waren, also auf einer Annahme, die die Texterkennung nicht
 * erfuellte.
 *
 * Gefunden wurde das erst beim echten Durchlauf im Browser. Genau davor warnt
 * Projektregel 2: gruene Tests sind nicht fertig.
 *
 * DIE ZAHLEN HIER SIND GEMESSEN, NICHT ERFUNDEN. Aus einer PS3838-Tabellenzeile
 * mit 38 Bildpunkten Zeilenhoehe, im Browser am 14.09.2026:
 *
 *     Woerter innerhalb einer Spalte     6, 7, 7, 8      etwa 0,2 Zeilenhoehen
 *     Spaltengrenzen                     89 bis 286      2,3 Zeilenhoehen und mehr
 *
 * Zwischen 8 und 89 liegt nichts. Deshalb ist die Schwelle von 0,6
 * Zeilenhoehen, also hier 22,8 Bildpunkte, nach beiden Seiten weit weg von
 * jedem gemessenen Wert.
 */

/** Baut Wortkaesten aus Text und x-Position. Hoehe und Breite wie gemessen. */
const wort = (text, x, breite) => ({
  text,
  sicherheit: 0.9,
  kasten: { x, y: 0, breite, hoehe: 38 },
})

test('gemessene Luecken: Wort bleibt Wort, Spalte wird Spalte', () => {
  // Die echte Zeile, mit den echten Luecken aus der Messung.
  //   Detroit(7)Lions-vs-New(6)Orleans(7)Saints ... dann 127 zur naechsten Spalte
  const woerter = [
    wort('Detroit', 0, 100),
    wort('Lions-vs-New', 107, 160),
    wort('Orleans', 273, 90),
    wort('Saints', 370, 80),
    wort('1854', 577, 60), // Luecke 127
    wort('(500.00)', 758, 110), // Luecke 121
    wort('427.00', 1028, 90), // Luecke 160
    wort('0.00', 1238, 50), // Luecke 120
    wort('WIN', 1449, 60), // Luecke 161
  ]

  const text = baueZeilentext('', woerter, 38)
  assert.equal(
    text,
    'Detroit Lions-vs-New Orleans Saints  1854  (500.00)  427.00  0.00  WIN',
    text
  )

  // Und das ist der Punkt: der Parser sieht jetzt acht Spalten statt einer
  // Wortkette.
  // Sechs Spalten: die Begegnung, die Quote, der Einsatz in Klammern, der
  // Gewinn, die Gebuehr und der Stand.
  const spalten = text.split(/\s{2,}/)
  assert.equal(spalten.length, 6, spalten.join(' | '))
  assert.equal(spalten[0], 'Detroit Lions-vs-New Orleans Saints')
  assert.equal(spalten[1], '1854')
  assert.equal(spalten[2], '(500.00)')
  assert.equal(spalten[3], '427.00')
})

test('eine kleine Luecke wird nie zur Spaltengrenze', () => {
  // Acht Bildpunkte bei 38 Zeilenhoehe: das ist ein gewoehnlicher Wortabstand.
  const text = baueZeilentext('', [wort('Los', 0, 50), wort('Angeles', 58, 110), wort('Rams', 175, 70)], 38)
  assert.equal(text, 'Los Angeles Rams')
})

test('kleine Schrift: die Schwelle waechst mit der Zeilenhoehe mit', () => {
  // Dieselbe Zeile halb so gross. Was vorher ein Wortabstand war, bleibt einer,
  // und was eine Spalte war, bleibt eine. Eine feste Pixelzahl koennte das nicht.
  const klein = [
    { text: 'Risk:', sicherheit: 0.9, kasten: { x: 0, y: 0, breite: 30, hoehe: 12 } },
    { text: '500.00', sicherheit: 0.9, kasten: { x: 33, y: 0, breite: 40, hoehe: 12 } },
    { text: '427.00', sicherheit: 0.9, kasten: { x: 110, y: 0, breite: 40, hoehe: 12 } },
  ]
  // 3 Bildpunkte zwischen Risk: und 500.00, 37 zwischen 500.00 und 427.00.
  // Schwelle: 0,6 mal 12 gleich 7,2.
  assert.equal(baueZeilentext('', klein, 12), 'Risk: 500.00  427.00')
})

test('ohne Wortkaesten bleibt der alte Weg', () => {
  // Die Texterkennung liefert nicht immer Kaesten. Dann ist ein platter Text
  // besser als gar keiner.
  assert.equal(baueZeilentext('Risk:   500.00   427.00', [], 38), 'Risk: 500.00 427.00')
  assert.equal(baueZeilentext(null, [], 0), '')
})

test('leere Woerter erzeugen keine Geisterspalte', () => {
  // Ein leeres Wort mit Kasten wuerde sonst zwei Leerzeichen nebeneinander
  // setzen und eine Spaltengrenze vortaeuschen, die es nicht gibt.
  const text = baueZeilentext('', [wort('Einsatz', 0, 90), wort('   ', 95, 10), wort('250,00', 110, 70)], 38)
  assert.equal(text, 'Einsatz 250,00')
})

test('die Woerter werden nach x sortiert, nicht nach Reihenfolge', () => {
  const text = baueZeilentext('', [wort('427.00', 1028, 90), wort('Saints', 370, 80)], 38)
  assert.equal(text, 'Saints  427.00')
})

// ---------------------------------------------------------------------------
// Und der Beweis, dass es zusammen wirkt: die echte Zeile, wie sie am
// 14.09.2026 aus der Texterkennung kam, durch den ganzen Parser.
// ---------------------------------------------------------------------------

test('die echte PS3838-Zeile aus dem Browser wird richtig ausgewertet', () => {
  // Genau so kam sie an, mitsamt dem verlorenen Dezimalpunkt in der Quote:
  // auf dem Bild steht 1.854, gelesen wurde 1854.
  const e = leseSchein(
    [
      '3777854081  Over 84.5  Rushing Yards',
      'Football  Jahmyr Gibbs Total Rushing Yards  Risk: 500.00  Settled',
      '1  Sportsbook  2026-09-13 15:57:21  Detroit Lions-vs-New Orleans Saints  1854  (500.00)  427.00  0.00  WIN',
      '2026-09-13 11:35:43  Player Props  D',
      'NFL @ 2026-09-13',
    ],
    { gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' }
  )

  assert.equal(e.einsatz.wert, 500)
  assert.equal(e.status, 'gewonnen')

  // 427 geteilt durch 500 plus eins ergibt 1,854. Belegt durch die
  // Ziffernfolge 1854, die als Baustein auf derselben Zeile steht.
  assert.ok(Math.abs(e.quoteDezimal.wert - 1.854) < 0.0005, `Quote ${e.quoteDezimal.wert}`)
  assert.ok(Math.abs(e.auszahlung.wert - 927) < 0.011, `Auszahlung ${e.auszahlung.wert}`)

  // Die Schutzmassnahme muss wirklich ausgeloest haben.
  assert.ok(
    e.hinweise.some((h) => h.code === 'quote_rueckgerechnet' || h.code === 'quote_durch_gewinn_belegt'),
    `kein Beleg fuer die Quote: ${e.hinweise.map((h) => h.code).join(', ')}`
  )

  // Die 84,5 aus "Over 84.5" darf nie die Quote werden, auch nicht die 1854.
  assert.notEqual(e.quoteDezimal.wert, 84.5)
  assert.notEqual(e.quoteDezimal.wert, 1854)
  assert.notEqual(e.quoteDezimal.wert, 4.708)
})

test('die 1854 allein ergibt keine Quote von 4,708', () => {
  // Auf derselben Zeile steht 1854. 1854 geteilt durch 500 plus eins waeren
  // 4,708, und das ist eine voellig moegliche Quote. Nur weil die Ziffernfolge
  // 4708 nirgends auf dem Schein steht, wird sie verworfen. Ohne diesen zweiten
  // Beleg waere die Rueckrechnung ein Ratespiel.
  const e = leseSchein(
    [
      'Football  Risk: 500.00  Settled',
      '1  Sportsbook  1854  (500.00)  427.00  0.00  WIN',
      'Player Props  D',
    ],
    { gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.ok(Math.abs(e.quoteDezimal.wert - 1.854) < 0.0005, `Quote ${e.quoteDezimal.wert}`)
})

test('eine verlorene Zeile ohne Gewinnspalte bekommt KEINE Quote', () => {
  // So kam die dritte PS3838-Karte wirklich aus der Texterkennung. Die
  // Gewinnspalte wurde zu "22D", die Quote zu Kauderwelsch. Es gibt keinen
  // Pruefstein, also wird nichts genommen: lieber nichts als falsch.
  const e = leseSchein(
    [
      '3778381351  Over 84.5  Rushing Yards',
      'Football Jahmyr Gibbs Total Rushing Yards Risk: 2,540.48',
      'bool  =  1.847  gi  =',
      'Egat  2026-09-13 15:57:21  Detroit Lions-vs-New Orleans Saints  he  (2,540.48)  22D  oC  LOSE',
      'NFL @ 2026-09-13',
    ],
    { gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(e.einsatz.wert, 2540.48, 'der Einsatz steht sauber da und wird gelesen')
  assert.equal(e.status, 'verloren')
  assert.equal(e.quoteDezimal.wert, null, 'ohne Pruefstein keine Quote')
  assert.ok(
    e.hinweise.some((h) => h.code === 'quote_fehlt'),
    'die fehlende Quote muss sichtbar sein'
  )
})

test('eine halbierte Betway-Karte meldet FEHLER und geht nicht in die Summe', () => {
  // Die Bildzerlegung schneidet eine Betway-Karte an ihrer Spielstandsbox
  // durch. Der Kopf landet auf der einen Karte, das Geld auf der naechsten.
  // Wichtig ist, dass das LAUT auffaellt und nicht als leerer Schein durchgeht.
  const e = leseSchein(
    ['Einzeiwetite @ 1.74  | ||', 'Los Angeles Rams - San Francisco 49ers', '7  Los Angeles Rams'],
    { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(e.einsatz.wert, null)
  assert.ok(
    e.hinweise.some((h) => h.code === 'einsatz_fehlt' && h.schwere === 'fehler'),
    'ein Schein ohne Einsatz muss ein Fehler sein, keine Warnung'
  )
})
