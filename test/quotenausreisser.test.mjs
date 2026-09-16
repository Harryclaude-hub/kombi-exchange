import test from 'node:test'
import assert from 'node:assert/strict'

import { rechne } from '../kern/rechnung.js'

/**
 * Eine ausreissende Quote im Riesenschein wird gemeldet.
 *
 * Karam am 16.09.2026: "da wird sehr viel gesetzt, taeglich wirklich ueber 100.
 * Und da muss einfach wirklich fehlerfrei immer die Quote erkannt werden. Die
 * Quoten sind natuerlich auch immer aehnlich bei jedem Riesenschein."
 *
 * Der zweite Satz ist der wertvolle. Ein Riesenschein ist DIESELBE Wette bei
 * vielen Buchmachern. Die Quoten unterscheiden sich, weil Buchmacher sich
 * unterscheiden, aber sie liegen beieinander. Eine Quote von 184 zwischen
 * sechzig Quoten um 1,9 herum ist kein Buchmacherunterschied, das ist ein
 * verlesener Punkt.
 *
 * DAS IST EIN ZWEITER PRUEFSTEIN, unabhaengig von Einsatz mal Quote gleich
 * Auszahlung. Er greift genau dort, wo der erste nicht greifen kann: wenn auf
 * dem Schein gar keine Auszahlung steht, oder wenn Einsatz UND Auszahlung um
 * denselben Faktor danebenliegen und das Verhaeltnis deshalb weiter stimmt.
 *
 * ER BERICHTIGT NICHTS. Projektregel 1: wo kein Beweis ist, entscheidet der
 * Mensch. Aus sechzig Quoten laesst sich nicht beweisen, wie die einundsechzigste
 * lauten muss, nur dass sie nicht passt. Also wird gewarnt und nicht gerechnet.
 */

/**
 * @param {string} id
 * @param {number} einsatz
 * @param {number|null} quote
 * @returns {any}
 */
function schein(id, einsatz, quote) {
  const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'gelesen', roh: '' })
  return {
    id,
    bildId: 'b',
    buchmacher: feld('Testhaus'),
    konto: feld(null),
    scheinNr: feld(null),
    gesetztAm: feld(null),
    einsatz: feld(einsatz),
    auszahlung: feld(quote === null ? null : einsatz * quote),
    ausgezahlt: feld(null),
    quoteDezimal: feld(quote),
    quoteAmerikanisch: feld(null),
    waehrung: feld('EUR'),
    status: 'offen',
    gratiswette: false,
    eachWay: false,
    ausgeschlossen: false,
    beine: [],
    hinweise: [],
    zeilen: [],
    notiz: '',
    geaendertAm: '2026-09-16T12:00:00.000Z',
    vonHand: false,
  }
}

/**
 * @param {any} rechnung
 * @returns {any|undefined}
 */
function ausreisser(rechnung) {
  return rechnung.hinweise.find((h) => h.code === 'quote_reisst_aus')
}

test('der verlorene Punkt bei Stake wird gemeldet', () => {
  // Der echte Fall aus der Probeseite: 1.84 wurde als 184 gelesen.
  const scheine = [
    schein('a', 5000, 1.9),
    schein('b', 5000, 1.88),
    schein('c', 5000, 1.92),
    schein('d', 5000, 184),
  ]
  const r = rechne(scheine)
  const h = ausreisser(r)
  assert.ok(h, 'der Ausreisser muss gemeldet werden')
  assert.equal(h.schwere, 'warnung')
  assert.match(h.text, /184/, 'die auffaellige Quote steht im Text')
})

test('die Quote wird dabei NICHT berichtigt', () => {
  const scheine = [schein('a', 100, 1.9), schein('b', 100, 1.9), schein('c', 100, 190)]
  const r = rechne(scheine)
  assert.ok(ausreisser(r), 'gemeldet wird')
  // Regel 1: aus zwei Quoten folgt nicht, wie die dritte lauten muss.
  assert.equal(scheine[2].quoteDezimal.wert, 190, 'der Wert bleibt unangetastet')
})

test('echte Buchmacherunterschiede loesen KEINE Warnung aus', () => {
  // So sieht es bei Karam wirklich aus: dieselbe Wette, leicht andere Quoten.
  const scheine = [
    schein('a', 500, 1.83),
    schein('b', 500, 1.9),
    schein('c', 500, 1.86),
    schein('d', 500, 1.95),
    schein('e', 500, 1.88),
    schein('f', 500, 2.02),
  ]
  const r = rechne(scheine)
  assert.equal(ausreisser(r), undefined, 'normale Streuung ist kein Ausreisser')
})

test('bei weniger als drei Quoten wird nicht gewarnt', () => {
  // Aus zwei Werten laesst sich keine Mitte bilden, der eine ist so gut wie der
  // andere. Eine Warnung waere hier geraten.
  const r = rechne([schein('a', 100, 1.9), schein('b', 100, 19)])
  assert.equal(ausreisser(r), undefined)
})

test('die 3.5 aus "OVER 3.5" faellt auf', () => {
  // Karams echte Zeile vom 16.09.2026 traegt eine Linie, die aussieht wie eine
  // Quote. Wird sie faelschlich als Quote genommen, steht sie zwischen lauter
  // Werten um 1,9.
  const scheine = [
    schein('a', 200, 1.91),
    schein('b', 200, 1.9),
    schein('c', 200, 1.89),
    schein('d', 200, 3.5),
  ]
  const h = ausreisser(rechne(scheine))
  assert.ok(h, 'auch das Doppelte faellt auf, nicht nur das Hundertfache')
})

test('ein einzelner Schein ohne Quote stoert die Pruefung nicht', () => {
  const scheine = [
    schein('a', 100, 1.9),
    schein('b', 100, 1.92),
    schein('c', 100, null),
    schein('d', 100, 1.88),
  ]
  const r = rechne(scheine)
  assert.equal(ausreisser(r), undefined, 'eine fehlende Quote ist kein Ausreisser')
})

test('bei hundert Scheinen bleibt die Pruefung ruhig', () => {
  // Karams Menge. Eine Warnung, die bei jedem Durchlauf kommt, wird ignoriert,
  // und dann hilft sie beim einen Mal auch nicht mehr.
  const scheine = []
  for (let i = 0; i < 100; i++) {
    // Streuung wie bei echten Buchmachern, zwischen 1,80 und 2,00.
    const quote = 1.8 + (i % 21) / 100
    scheine.push(schein(`s${i}`, 500, Math.round(quote * 100) / 100))
  }
  assert.equal(ausreisser(rechne(scheine)), undefined)
})
