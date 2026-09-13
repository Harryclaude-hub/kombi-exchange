import test from 'node:test'
import assert from 'node:assert/strict'

import { leseZahl } from '../kern/zahlen.js'
import { leseSchein } from '../kern/parser.js'

/**
 * Luecken zwischen Ziffern.
 *
 * Gefunden am 13.09.2026 mit werkzeug/training/ an einem echten Durchlauf:
 * die Texterkennung hat aus "296.84" ein "296 84" gemacht, und daraus wurde
 * 29684. Ein Fehler um den Faktor hundert.
 *
 * Die Regel dagegen ist beweisbar, nicht geraten: eine Tausendergruppe hat in
 * jeder Sprache immer genau drei Ziffern. Eine zweistellige Gruppe am Ende kann
 * deshalb nirgendwo eine Tausendergruppe sein.
 */

function zahl(text, gebiet = 'en') {
  return leseZahl(text, { gebiet }).wert
}

test('eine zweistellige Gruppe am Ende ist der Dezimalteil', () => {
  assert.equal(zahl('296 84'), 296.84)
  assert.equal(zahl('1 234 56'), 1234.56)
  assert.equal(zahl('5 000 00'), 5000)
})

test('eine einstellige Gruppe am Ende ist ebenfalls der Dezimalteil', () => {
  assert.equal(zahl('296 8'), 296.8)
  assert.equal(zahl('7 5'), 7.5)
})

test('lauter Dreiergruppen bleiben Tausender', () => {
  assert.equal(zahl('1 234 567'), 1234567)
  assert.equal(zahl('12 345'), 12345)
  assert.equal(zahl('20 000'), 20000)
  // Karams groesster Fall: zwanzigtausend darf nicht zu 20 werden.
  assert.equal(zahl('20 000 00'), 20000)
})

test('Komma und Punkt behalten Vorrang vor der Lueckenregel', () => {
  assert.equal(zahl('1 234,56', 'de'), 1234.56)
  assert.equal(zahl('1 234.56', 'en'), 1234.56)
  assert.equal(zahl('296.84'), 296.84)
})

test('geschuetzte und schmale Leerzeichen zaehlen genauso', () => {
  assert.equal(zahl('296 84'), 296.84)
  assert.equal(zahl('296 84'), 296.84)
  assert.equal(zahl('1 234 567'), 1234567)
})

test('der echte Fall aus dem Durchlauf wird richtig gelesen', () => {
  // Genau die Zeile, die die Texterkennung am 13.09.2026 geliefert hat.
  const e = leseSchein(
    [
      '#396228612 Sep 10, 10:42 PM',
      'Deebo Samuel',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157 Stake § 181 Returns: $ 296 84',
    ],
    { gebiet: 'us', quotenformat: 'amerikanisch' }
  )

  assert.equal(e.einsatz.wert, 181)
  assert.equal(e.auszahlung.wert, 296.84, 'die Auszahlung darf nicht 29684 sein')
  assert.ok(Math.abs(e.quoteDezimal.wert - 1.64) < 0.002)

  const widerspruch = e.hinweise.filter((h) => h.code.startsWith('quote_widerspruch'))
  assert.deepEqual(widerspruch, [], 'wenn richtig gelesen wird, darf kein Widerspruch uebrigbleiben')
})

test('eine unklare Lueckenform wird NICHT geraten', () => {
  // Zwei Luecken, Gruppen 2 und 2: dafuer gibt es keine beweisbare Deutung.
  // Dann bleibt der alte Weg, und die Gegenrechnung muss es auffangen.
  const wert = zahl('12 34 56')
  assert.ok(wert !== null, 'es soll trotzdem eine Zahl herauskommen')
  assert.equal(wert, 123456, 'ohne beweisbare Deutung wird nichts umgedeutet')
})
