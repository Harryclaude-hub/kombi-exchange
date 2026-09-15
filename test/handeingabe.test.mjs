import test from 'node:test'
import assert from 'node:assert/strict'

import { leseGeldEingabe, leseQuoteEingabe } from '../kern/handeingabe.js'

/**
 * Was der Mensch tippt, darf nicht um den Faktor hundert danebenliegen.
 *
 * WAS PASSIERT IST
 *
 * Die Felder im Reiter "Scheine" hatten ihre eigene Umwandlung: sie strichen
 * ALLE Punkte, bevor sie die Zahl lasen.
 *
 *     "5000.00"   wurde  500000     Faktor hundert zu viel
 *     "5,000.00"  wurde       5     Faktor tausend zu wenig
 *     "296.84"    wurde   29684
 *
 * Der Wert bekam danach Sicherheit 1 und die Herkunft "hand". Was von Hand
 * kommt, wird nie wieder ueberschrieben: der Tippfehler stand fuer immer in der
 * Summe. "5,000.00" ist keine erfundene Schreibweise, genau so steht der
 * Einsatz auf jedem Stake-Schein.
 *
 * Gefunden am 15.09.2026 bei der Gegenpruefung, hier festgehalten.
 */

test('deutsche und englische Schreibweise ergeben denselben Betrag', () => {
  for (const [text, soll] of [
    ['5000.00', 5000],
    ['5000,00', 5000],
    ['5.000,00', 5000],
    ['5,000.00', 5000],
    ['2.211,55', 2211.55],
    ['250,50', 250.5],
    ['296.84', 296.84],
    ['5000', 5000],
  ]) {
    const r = leseGeldEingabe(String(text), 'de')
    assert.equal(r.wert, soll, `"${text}" ergab ${r.wert}, erwartet ${soll}. Grund: ${r.grund}`)
  }
})

test('kein Betrag wird um Faktor hundert oder tausend verschoben', () => {
  // Die drei Faelle, die der alte Weg wirklich falsch gemacht hat.
  assert.notEqual(leseGeldEingabe('5000.00', 'de').wert, 500000)
  assert.notEqual(leseGeldEingabe('5,000.00', 'de').wert, 5)
  assert.notEqual(leseGeldEingabe('296.84', 'de').wert, 29684)
})

test('was unklar bleibt, wird NICHT gespeichert', () => {
  // "1 181" ohne Gebiet: deutsch 1181, englisch 1,181. Faktor tausend, und es
  // gibt keinen Pruefstein, der entscheidet. Also entscheidet der Mensch
  // (Projektregel 1).
  const r = leseGeldEingabe('1,181', null)
  assert.equal(r.wert, null, `es darf nichts gespeichert werden, wurde: ${r.wert}`)
  assert.equal(r.mehrdeutig, true)
  assert.ok(r.grund.length > 0, 'der Grund muss dastehen')
})

test('Unsinn ergibt null mit Grund, nicht null ohne Grund', () => {
  for (const text of ['abc', '---', '']) {
    const r = leseGeldEingabe(text, 'de')
    assert.equal(r.wert, null)
    assert.ok(r.grund.length > 0, `"${text}" braucht einen Grund`)
  }
})

test('Quoten: beide Schreibweisen ergeben dieselbe Quote', () => {
  for (const [text, soll] of [
    ['1,90', 1.9],
    ['1.90', 1.9],
    ['2,30', 2.3],
    ['1,854', 1.854],
    ['1.854', 1.854],
  ]) {
    const r = leseQuoteEingabe(String(text), 'de')
    assert.ok(
      r.wert !== null && Math.abs(r.wert - soll) < 0.0005,
      `"${text}" ergab ${r.wert}, erwartet ${soll}. Grund: ${r.grund}`
    )
  }
})

test('aus 1.854 wird nie die Quote 1854', () => {
  // Deutsch gelesen waere der Punkt ein Tausendertrenner. 1854 ist aber keine
  // Quote. Genau das ist der Pruefstein, der die Mehrdeutigkeit aufloest, und
  // er wird auch als solcher gekennzeichnet.
  const r = leseQuoteEingabe('1.854', 'de')
  assert.notEqual(r.wert, 1854)
  assert.ok(Math.abs((r.wert ?? 0) - 1.854) < 0.0005)
  assert.equal(r.ausPlausibilitaet, true, 'der Pruefstein muss ausgeloest haben')
})

test('was keine gueltige Quote ist, wird nicht gespeichert', () => {
  for (const text of ['0,5', '0', '-157', 'abc']) {
    const r = leseQuoteEingabe(text, 'de')
    assert.equal(r.wert, null, `"${text}" ergab ${r.wert}`)
    assert.ok(r.grund.length > 0, `"${text}" braucht einen Grund`)
  }
})
