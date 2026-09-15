import test from 'node:test'
import assert from 'node:assert/strict'

import { leseZahl } from '../kern/zahlen.js'
import { leseSchein } from '../kern/parser.js'
import { rechne } from '../kern/rechnung.js'

/**
 * Zwei Zahlen in einem Feld: der teuerste Fund des 15.09.2026.
 *
 * WAS PASSIERT IST
 *
 * Bei Stake liegen vier Wetten in ZWEI Spalten nebeneinander. Die Bildzerlegung
 * trennt die Spalten nicht, also steht in einer Karte alles doppelt. Die
 * Texterkennung liefert die Geldzeile dann so:
 *
 *     Einsatz 5,000.00000000 2,000.00000000 @
 *
 * Zwischen den beiden Betraegen steht genau EIN Leerzeichen. Genau ein
 * Leerzeichen ist in leseZahl ein erlaubter Tausenderraum ("1 181,50" gibt es
 * wirklich), also fiel es weg, und uebrig blieb
 *
 *     5,000.000000002,000.00000000
 *
 * Daraus wurde der Einsatz 5.000.000.000.002.000. Die Reparatur ueber den
 * Pruefstein machte daraus noch 5.000.000.000.002.004, weil unter
 * vierhundert Ziffernvarianten eine zufaellig passte. Der Schein trug am
 * Ende den Stand "gewonnen" und wanderte mit diesem Einsatz in die Summe:
 * fuenf Billiarden neben einem echten Einsatz von fuenfhundert.
 *
 * WARUM DIE ALTE PRUEFUNG NICHT GEGRIFFEN HAT
 *
 * Die Gruppenlaengen werden nur geprueft, wenn DASSELBE Trennzeichen mehrfach
 * vorkommt. Hier kommen Punkt UND Komma vor, und dieser Zweig hat nur
 * entschieden, welches von beiden das Dezimaltrennzeichen ist, ohne je
 * nachzusehen, ob die Ziffern dazwischen ueberhaupt eine Zahl ergeben.
 *
 * DIE REGEL, DIE JETZT GILT
 *
 * Stehen Punkt und Komma zusammen in einer Zahl, ist das letzte von beiden das
 * Dezimaltrennzeichen. Ein Dezimaltrennzeichen gibt es in einer Zahl genau
 * EINMAL. Kommt es zweimal vor, sind es zwei Zahlen, und dann wird nichts
 * geraten: der Wert bleibt leer, der Grund steht dabei. Lieber eine Luecke mit
 * Warnung als ein erfundener Wert (Projektregel 1).
 */

const w = (e, f) => (e[f] && typeof e[f] === 'object' && 'wert' in e[f] ? e[f].wert : e[f])

const STAKE = { gebiet: 'en', waehrung: 'UNBEKANNT', quotenformat: 'dezimal' }

/** Die Rohzeilen, wie die Texterkennung sie am 15.09.2026 wirklich geliefert hat. */
const VERSCHMOLZENE_KARTE = [
  'Uber 82.5 Rushing Yards  Gewonnen  Uber 82.5 Rushing Yards  Verust',
  'Jahmyr Gibbs  Jahmyr Gibbs',
  '156  156',
  'So., 13. Sept.  19:00  So., 13. Sept.  19:00',
  'Detroit Lions  31  Detroit Lions  31',
  'New Orleans Saints  30  New Orleans Saints  30',
  'Stake  Stake',
  'Quoten  184 @  Quoten  19 @®',
  'Einsatz 5,000.00000000 2,000.00000000 @',
  'Auszahlung  9,175.99550000 @  Auszahlung  0.00000000',
]

test('zwei zusammengeklebte Betraege ergeben keinen Wert, sondern einen Grund', () => {
  const r = leseZahl('5,000.00000000 2,000.00000000')
  assert.equal(r.wert, null, `es darf kein Wert entstehen, wurde: ${r.wert}`)
  assert.equal(r.mehrdeutig, true)
  assert.match(r.grund, /zwei zahlen/i, `der Grund muss es benennen, war: "${r.grund}"`)
})

test('dieselben Betraege einzeln werden weiter richtig gelesen', () => {
  // Die Reparatur darf den Normalfall nicht kosten.
  assert.equal(leseZahl('5,000.00000000').wert, 5000)
  assert.equal(leseZahl('2,000.00000000 @').wert, 2000)
  assert.equal(leseZahl('9,175.99550000').wert, 9175.9955)
  assert.equal(leseZahl('5,000.000000...').wert, 5000)
})

test('weitere Formen zweier Zahlen in einem Feld', () => {
  for (const text of ['1,000.00 2,000.00', '296.84 5,000.00', '78,30 136,30']) {
    const r = leseZahl(text)
    assert.ok(
      r.wert === null || r.wert < 1_000_000,
      `"${text}" darf keine Riesenzahl ergeben, wurde: ${r.wert}`
    )
  }
})

test('echte Tausenderraeume und verschluckte Punkte bleiben unberuehrt', () => {
  // Das ist die Gegenprobe: genau diese Faelle SOLLEN weiterhin eine Zahl
  // ergeben, sonst waere die Reparatur teurer als der Fehler.
  assert.equal(leseZahl('1 181,50', { gebiet: 'de' }).wert, 1181.5)
  assert.equal(leseZahl("1'181.50", { gebiet: 'en' }).wert, 1181.5)
  assert.equal(leseZahl('296 84').wert, 296.84)
  assert.equal(leseZahl('5 000 00').wert, 5000)
  assert.equal(leseZahl('1.234.567', { gebiet: 'de' }).wert, 1234567)
  assert.equal(leseZahl('1,234,567', { gebiet: 'en' }).wert, 1234567)
  assert.equal(leseZahl('20.000,00', { gebiet: 'de' }).wert, 20000)
  assert.equal(leseZahl('20,000.00', { gebiet: 'en' }).wert, 20000)
  assert.equal(leseZahl('1,000,00', { gebiet: 'en' }).wert, 1000)
})

test('die verschmolzene Stake-Karte liefert keinen Muell-Einsatz', () => {
  const e = leseSchein(VERSCHMOLZENE_KARTE, STAKE)
  const einsatz = w(e, 'einsatz')
  assert.ok(
    einsatz === null || einsatz < 1_000_000,
    `Einsatz aus der Doppelspalte: ${einsatz}. Vor der Reparatur waren es 5.000.000.000.002.004.`
  )

  // Und der Mensch muss es sehen. Eine Schutzmassnahme zaehlt erst, wenn sie
  // einmal ausgeloest hat (Projektregel 3).
  assert.ok(
    e.hinweise.some((h) => h.schwere === 'fehler'),
    `die Karte muss einen Hinweis der Schwere fehler tragen, hat: ${JSON.stringify(e.hinweise.map((h) => `${h.schwere}:${h.code}`))}`
  )
})

test('ein Muell-Einsatz kann die Summe nicht mehr sprengen', () => {
  // Die Gegenrechnung ueber zwei Wege: was in rechne() ankommt, muss in der
  // Groessenordnung der echten Scheine bleiben.
  const kaputt = leseSchein(VERSCHMOLZENE_KARTE, { ...STAKE, id: 'a', projektId: 'p', bildId: 'b1' })
  const sauber = leseSchein(
    [
      'Über 82.5 Rushing Yards', 'Gewonnen', 'Jahmyr Gibbs', 'Do., 10. Sept. 02:20',
      'Seattle Seahawks 13', 'New England Patriots 10', 'Stake',
      'Quoten                    1,84',
      'Einsatz          500.00000000',
      'Auszahlung       920.81035000',
    ],
    { ...STAKE, id: 'b', projektId: 'p', bildId: 'b2' }
  )

  const r = rechne([kaputt, sauber])
  assert.ok(
    (r.einsatzGesamt ?? 0) < 1_000_000,
    `Gesamteinsatz: ${r.einsatzGesamt}. Vor der Reparatur waren es 5.000.000.000.002.513.`
  )
  assert.equal(w(sauber, 'einsatz'), 500, 'der saubere Schein muss unveraendert durchlaufen')
})
