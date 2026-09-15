import test from 'node:test'
import assert from 'node:assert/strict'

import { leseSchein } from '../kern/parser.js'
import { rechne } from '../kern/rechnung.js'

/**
 * Ein Schein mit einem Fehler gehoert nicht in die Summe, aber auch nicht in
 * den Papierkorb.
 *
 * WAS PASSIERT IST
 *
 * kern/rechnung.js nahm bisher jeden Schein, den der Mensch nicht ausdruecklich
 * ausgeschlossen hatte. Ein Hinweis der Schwere fehler aenderte daran nichts.
 * Damit ging die verschmolzene Stake-Doppelspalte mit einem Einsatz von
 * fuenf Billiarden in den Gesamteinsatz ein, und niemand sah es an der Zahl.
 *
 * DIE REGEL, DIE JETZT GILT
 *
 * Traegt ein Schein einen Hinweis der Schwere fehler, sind seine Zahlen nicht
 * belastbar. Er wird nicht mitgerechnet und nicht weggeworfen, sondern
 * gesondert gezaehlt und gemeldet (Projektregel 9: Aussortiertes bleibt
 * sichtbar).
 *
 * DIE EINE AUSNAHME
 *
 * einsatz_fehlt. Dafuer gibt es seit jeher eine eigene, sanftere Behandlung:
 * der Schein steuert keinen Einsatz bei, wird aber als einsatz_fehlt_in_summe
 * gezaehlt. Das bleibt so, sonst wuerde sich das Verhalten fuer jeden
 * verlorenen BetOnline-Schein ohne Returns aendern.
 */

const w = (e, f) => (e[f] && typeof e[f] === 'object' && 'wert' in e[f] ? e[f].wert : e[f])

const STAKE = { gebiet: 'en', waehrung: 'UNBEKANNT', quotenformat: 'dezimal' }

/** Die verschmolzene Doppelspalte, wie die Texterkennung sie geliefert hat. */
const ZWEI_KARTEN = [
  'Uber 82.5 Rushing Yards  Gewonnen  Uber 82.5 Rushing Yards  Verust',
  'Jahmyr Gibbs  Jahmyr Gibbs',
  'Stake  Stake',
  'Quoten  184 @  Quoten  19 @®',
  'Einsatz 5,000.00000000 2,000.00000000 @',
  'Auszahlung  9,175.99550000 @  Auszahlung  0.00000000',
]

/** Ein sauberer Schein derselben Wette, der weiter zaehlen muss. */
const SAUBER = [
  'Über 82.5 Rushing Yards', 'Gewonnen', 'Jahmyr Gibbs', 'Do., 10. Sept. 02:20',
  'Seattle Seahawks 13', 'New England Patriots 10', 'Stake',
  'Quoten                    1,84',
  'Einsatz          500.00000000',
  'Auszahlung       920.81035000',
]

const baue = (zeilen, id) => leseSchein(zeilen, { ...STAKE, id, projektId: 'p', bildId: `b${id}` })

test('ein Schein mit Fehler bleibt aus der Summe', () => {
  const kaputt = baue(ZWEI_KARTEN, 'a')
  const sauber = baue(SAUBER, 'b')

  assert.ok(
    kaputt.hinweise.some((h) => h.schwere === 'fehler'),
    'Voraussetzung: die verschmolzene Karte muss einen Fehler tragen'
  )

  const r = rechne([kaputt, sauber])
  assert.equal(
    r.einsatzGesamt,
    500,
    `nur der saubere Schein zaehlt. Gesamteinsatz war: ${r.einsatzGesamt}`
  )
  assert.equal(w(sauber, 'einsatz'), 500, 'der saubere Schein bleibt unveraendert')
})

test('der aussortierte Schein bleibt sichtbar, mit Grund', () => {
  const kaputt = baue(ZWEI_KARTEN, 'a')
  const sauber = baue(SAUBER, 'b')
  const r = rechne([kaputt, sauber])

  assert.ok(r.mitFehler, 'die Rechnung muss ein Feld mitFehler haben')
  assert.equal(r.mitFehler.anzahl, 1)
  assert.deepEqual(r.mitFehler.scheinIds, ['a'])

  const hinweis = r.hinweise.find((h) => h.code === 'scheine_mit_fehler')
  assert.ok(hinweis, `Hinweis scheine_mit_fehler fehlt. Da war: ${JSON.stringify(r.hinweise.map((h) => h.code))}`)
  assert.equal(hinweis.schwere, 'fehler')
  assert.match(hinweis.text, /1/, 'der Text muss die Anzahl nennen')
})

test('ohne fehlerhafte Scheine gibt es das Feld trotzdem, nur leer', () => {
  const r = rechne([baue(SAUBER, 'b')])
  assert.equal(r.mitFehler.anzahl, 0)
  assert.deepEqual(r.mitFehler.scheinIds, [])
  assert.ok(
    !r.hinweise.some((h) => h.code === 'scheine_mit_fehler'),
    'ohne Fehler darf der Hinweis nicht erscheinen'
  )
})

test('ein fehlender Einsatz bleibt die alte, sanftere Ausnahme', () => {
  // Ein verlorener BetOnline-Schein ohne Returns traegt einsatz_fehlt, wenn
  // gar kein Einsatz dasteht. Solche Scheine wurden schon immer als
  // einsatz_fehlt_in_summe gezaehlt und nicht ganz aussortiert. Das bleibt so,
  // sonst aendert sich das Verhalten fuer einen ganzen Anbieter.
  const ohneEinsatz = leseSchein(
    ['#396418815 Sep 13, 6:39 PM', 'lost', 'Baker Mayfield', 'WILL HAVE OVER 231.5 PASSING YARDS'],
    { gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch', id: 'c', projektId: 'p', bildId: 'bc' }
  )
  assert.ok(
    ohneEinsatz.hinweise.some((h) => h.code === 'einsatz_fehlt'),
    'Voraussetzung: dieser Schein traegt einsatz_fehlt'
  )

  const r = rechne([ohneEinsatz, baue(SAUBER, 'b')])
  assert.equal(r.mitFehler.anzahl, 0, 'einsatz_fehlt sortiert nicht aus')
  assert.ok(
    r.hinweise.some((h) => h.code === 'einsatz_fehlt_in_summe'),
    'die alte, sanftere Meldung bleibt'
  )
})
