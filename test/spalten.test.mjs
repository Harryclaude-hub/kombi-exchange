import test from 'node:test'
import assert from 'node:assert/strict'

import { leseZahl } from '../kern/zahlen.js'
import { leseSchein, ersteZahl } from '../kern/parser.js'

/**
 * Zwei Betraege nebeneinander sind nicht ein Betrag.
 *
 * GEFUNDEN AM 14.09.2026 beim ersten Durchlauf ueber nachgebaute Ansichten von
 * Karams fuenf Anbietern. Bei Betway und bet365 stehen Beschriftung und Wert in
 * einer Fusszeile NEBENEINANDER:
 *
 *     Umsetzen                      DU HAST GEWONNEN
 *     78,30                                   136,24
 *
 * Die Texterkennung liefert daraus eine Zeile "78,30     136,24". Das Programm
 * hat die Luecke als Tausendertrenner genommen und daraus 783.013.624 gemacht.
 * Bei bet365 aus 250,00 und 450,00 die Zahl 2.500.045.000.
 *
 * Das ist derselbe Schaden wie beim abgeschnittenen Stake-Betrag, nur aus
 * einer anderen Richtung, und er traf zwei von fuenf Anbietern.
 *
 * DIE REGEL DAGEGEN, und sie ist beweisbar, nicht geraten:
 *
 *   EIN Leerzeichen kann ein Tausendertrenner sein. "1 234,56" gibt es
 *   wirklich, in der Schweiz und in Frankreich.
 *
 *   ZWEI oder mehr Leerzeichen sind eine Spaltengrenze. Keine Sprache der Welt
 *   trennt Tausender mit zwei Leerzeichen. Was danach kommt, ist eine andere
 *   Zahl.
 *
 * Damit die Regel greifen kann, darf leseSchein die Leerzeichen nicht mehr
 * platt machen. Es behaelt jetzt die Unterscheidung: ein Leerzeichen bleibt
 * eines, zwei oder mehr werden zu genau zwei.
 */

const w = (e, f) => (e[f] && typeof e[f] === 'object' && 'wert' in e[f] ? e[f].wert : e[f])

test('zwei Leerzeichen trennen zwei Betraege', () => {
  assert.equal(leseZahl('78,30   136,24', { gebiet: 'de' }).wert, 78.3)
  assert.equal(leseZahl('250,00      450,00', { gebiet: 'de' }).wert, 250)
  assert.equal(leseZahl('961,54   2.211,54', { gebiet: 'de' }).wert, 961.54)
  assert.equal(leseZahl('181   296.84', { gebiet: 'en' }).wert, 181)
})

test('EIN Leerzeichen bleibt ein moeglicher Tausendertrenner', () => {
  // Diese Schreibweise gibt es wirklich. Sie darf nicht kaputtgehen.
  assert.equal(leseZahl('1 234,56', { gebiet: 'de' }).wert, 1234.56)
  assert.equal(leseZahl('20 000', { gebiet: 'en' }).wert, 20000)
  assert.equal(leseZahl('5 000 00', { gebiet: 'en' }).wert, 5000)
  assert.equal(leseZahl('296 84', { gebiet: 'en' }).wert, 296.84)
})

test('ersteZahl hoert an der Spaltengrenze auf', () => {
  assert.equal(ersteZahl('78,30   136,24', { gebiet: 'de' })?.wert, 78.3)
  assert.equal(ersteZahl('$ 181   $ 296.84', { gebiet: 'en' })?.wert, 181)
  // Mit nur einem Leerzeichen bleibt es eine Zahl.
  assert.equal(ersteZahl('1 234,56', { gebiet: 'de' })?.wert, 1234.56)
})

// ---------------------------------------------------------------------------
// Die echten Fusszeilen der beiden Anbieter
// ---------------------------------------------------------------------------

test('Betway: Fusszeile mit zwei Spalten', () => {
  const e = leseSchein(
    [
      'Einzelwette @ 1.74',
      'GEWONNEN',
      'Los Angeles Rams - San Francisco 49ers',
      'Umsetzen                              DU HAST GEWONNEN',
      '€78,30                                          €136,24',
    ],
    { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(w(e, 'einsatz'), 78.3, 'Einsatz war 783 Millionen')
  assert.equal(w(e, 'auszahlung'), 136.24, 'Auszahlung')
})

test('bet365: Fusszeile mit zwei Spalten', () => {
  const e = leseSchein(
    [
      '€250,00 Einzelwetten',
      'GEWONNEN',
      'Nahshon Wright - Weniger als 2.5   1.80',
      'Einsatz:                      Gewinn',
      '€250,00                     €450,00',
    ],
    { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(w(e, 'einsatz'), 250, 'Einsatz waren 2,5 Milliarden')
  assert.equal(w(e, 'auszahlung'), 450, 'Auszahlung')
})

test('bet365 mit Tausenderpunkt in der zweiten Spalte', () => {
  const e = leseSchein(
    [
      '€961,54 Einzelwetten',
      'GEWONNEN',
      'Nahshon Wright (NY Jets) - Weniger als 3.5   2.30',
      'Einsatz:                      Gewinn',
      '€961,54                   €2.211,54',
    ],
    { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(w(e, 'einsatz'), 961.54)
  assert.equal(w(e, 'auszahlung'), 2211.54)
})

test('BetOnline: drei Spalten in einer Zeile bleiben getrennt', () => {
  // Hier retten heute noch die Beschriftungen. Ohne sie waere es derselbe
  // Fehler, deshalb steht der Fall hier mit drin.
  const e = leseSchein(
    [
      '#396228612 Sep 10, 10:42 PM',
      'won',
      'Odds: -157        Stake: $ 181        Returns: $ 296.84',
    ],
    { gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' }
  )
  assert.equal(w(e, 'einsatz'), 181)
  assert.equal(w(e, 'auszahlung'), 296.84)
})
