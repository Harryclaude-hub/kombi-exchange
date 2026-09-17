import test from 'node:test'
import assert from 'node:assert/strict'
import { rechne } from '../kern/rechnung.js'

/**
 * Wie weit die Quoten desselben Riesenscheins auseinanderliegen.
 *
 * WARUM DAS EINE ZAHL UND KEINE WARNUNG IST
 *
 * Dieselbe Wette hat bei verschiedenen Buchmachern aehnliche Quoten. Die
 * Warnung "quote_reisst_aus" schlaegt bei Faktor 1,5 an, also bei 50 Prozent
 * Abstand vom Median. An Karams einzigem echten anbieteruebergreifenden
 * Riesenschein gemessen (Deebo Samuel, sechs Scheine bei drei Anbietern) sind
 * es in Wirklichkeit 4,52 Prozent.
 *
 * Dazwischen liegt eine grosse Luecke, und in dieser Luecke kostet ein
 * Lesefehler Geld, ohne dass irgendetwas anschlaegt.
 *
 * Die Grenze wird trotzdem NICHT enger gestellt: sechs Scheine sind kein
 * Beleg, und eine Warnung bei jedem zweiten Schein liest niemand mehr
 * (Projektregel 1: keine Automatik ohne Beleg). Stattdessen wird die Streuung
 * gemessen und angezeigt.
 */

const feld = (wert) => ({ wert, sicherheit: 0.95, quelle: 'ocr' })

/** @param {number} quote @param {number} i */
function schein(quote, i) {
  return {
    id: 's' + i,
    bildId: 'b',
    gruppeId: 'g',
    scheinNr: feld(String(i)),
    buchmacher: feld(['BetOnline', 'Stake', 'Betway'][i % 3]),
    konto: feld(''),
    einsatz: feld(333),
    quoteDezimal: feld(quote),
    auszahlung: feld(333 * quote),
    ausgezahlt: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
    waehrung: feld('EUR'),
    status: 'offen',
    gratiswette: false,
    eachWay: false,
    auswahlen: [{ text: 'Deebo Samuel Ueber 2,5 Annahmen' }],
    ausschnitt: null,
    geaendertAm: '2026-09-17 21:00',
    vonHand: false,
  }
}

/** Karams echte sechs Quoten aus FOTOS_KARAM.md. */
const ECHT = [1.64, 1.64, 1.64, 1.690903, 1.690903, 1.740741]

test('die Streuung stimmt mit der Handrechnung ueberein', () => {
  const r = rechne(ECHT.map(schein))
  assert.ok(r.quotenstreuung, 'es gibt eine Streuung')

  // Gegenrechnung auf einem zweiten Weg (Projektregel 4).
  const sortiert = [...ECHT].sort((a, b) => a - b)
  const median = (sortiert[2] + sortiert[3]) / 2
  const groesster = Math.max(...ECHT.map((q) => (q > median ? q / median : median / q)))

  assert.equal(r.quotenstreuung.median, Math.round(median * 10000) / 10000)
  assert.equal(r.quotenstreuung.groessterAbstand, Math.round(groesster * 10000) / 10000)
  assert.equal(r.quotenstreuung.anzahl, 6)

  // Und die Zahl, um die es geht: 4,52 Prozent echte Streuung.
  const prozent = (r.quotenstreuung.groessterAbstand - 1) * 100
  assert.ok(prozent > 4.4 && prozent < 4.6, `${prozent} Prozent`)
})

test('DIE LUECKE: ein verlesenes 1,69 als 1,89 loest KEINE Warnung aus', () => {
  /*
    Das ist der eigentliche Grund fuer diese Datei. Der Fall kostet Geld und
    bleibt still. Solange die Grenze bei 1,5 steht, MUSS die Zahl sichtbar
    sein, sonst merkt es niemand.
  */
  const falsch = [1.64, 1.64, 1.64, 1.89, 1.690903, 1.740741]
  const r = rechne(falsch.map(schein))

  assert.equal(
    r.hinweise.some((h) => h.code === 'quote_reisst_aus'),
    false,
    'die Warnung schweigt, und genau deshalb braucht es die Zahl'
  )

  // Sichtbar ist es trotzdem: die Streuung springt von 4,5 auf ueber 13 Prozent.
  const prozent = (r.quotenstreuung.groessterAbstand - 1) * 100
  assert.ok(prozent > 13, `${prozent} Prozent, erwartet ueber 13`)

  // Und was es kostet: 333 mal der Quotenunterschied.
  const zuviel = 333 * (1.89 - 1.690903)
  assert.ok(zuviel > 66 && zuviel < 67, `${zuviel} EUR`)
})

test('bei weniger als drei Quoten wird nichts behauptet', () => {
  // Bei zweien gibt es keine Mitte, der eine Wert ist so gut wie der andere.
  assert.equal(rechne([1.64, 1.9].map(schein)).quotenstreuung, null)
  assert.equal(rechne([1.64].map(schein)).quotenstreuung, null)
})

test('gleiche Quoten ergeben null Streuung, nicht null', () => {
  const r = rechne([1.64, 1.64, 1.64].map(schein))
  assert.equal(r.quotenstreuung.groessterAbstand, 1)
  assert.equal(r.quotenstreuung.median, 1.64)
})

test('die Grenze fuer die Warnung bleibt, wo sie war', () => {
  // Ein echter Ausreisser, wie ihn ein verlesener Punkt erzeugt: 16,4 statt
  // 1,64. Dafuer ist die Warnung gemacht, und sie schlaegt weiter an.
  const r = rechne([1.64, 1.64, 1.64, 16.4].map(schein))
  assert.ok(r.hinweise.some((h) => h.code === 'quote_reisst_aus'))
  assert.ok(r.quotenstreuung.groessterAbstand > 9)
})
