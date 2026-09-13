import test from 'node:test'
import assert from 'node:assert/strict'

import { KORPUS } from './scheinkorpus.mjs'
import { leseSchein, findeScheinnummer } from '../kern/parser.js'

/**
 * Der Korpus als Test.
 *
 * werkzeug/messe_lesen.mjs zeigt die Zahl, dieser Test haelt sie fest. Sobald
 * eine Aenderung am Leseprogramm einen Fall verschlechtert, wird es hier rot,
 * und zwar mit Name des Scheins und Name des Feldes.
 */

const CENT = 0.005
const QUOTE = 0.0015

function wert(ergebnis, feld) {
  const roh = ergebnis[feld]
  if (roh && typeof roh === 'object' && 'wert' in roh) return roh.wert
  return roh
}

for (const fall of KORPUS) {
  test(`liest: ${fall.name}`, () => {
    const ergebnis = leseSchein(fall.zeilen, fall.umgebung)

    for (const [feld, soll] of Object.entries(fall.erwartet)) {
      const ist = wert(ergebnis, feld)
      if (typeof soll === 'number') {
        const spielraum = feld === 'quoteDezimal' ? QUOTE : CENT
        assert.ok(
          typeof ist === 'number' && Math.abs(ist - soll) <= spielraum,
          `${feld}: erwartet ${soll}, gelesen ${JSON.stringify(ist)}`
        )
      } else {
        assert.equal(ist, soll, `${feld}: erwartet ${soll}, gelesen ${JSON.stringify(ist)}`)
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Fallen fuer die nackte Scheinnummer
//
// Die Regel "lange Ziffernfolge am Zeilenanfang ist die Scheinnummer" ist die
// gefaehrlichste im ganzen Parser. Diese Faelle versuchen absichtlich, ihr
// einen Geldbetrag unterzuschieben. Keiner davon darf durchgehen.
// ---------------------------------------------------------------------------

test('ein Betrag am Zeilenanfang wird NICHT zur Scheinnummer', () => {
  const faelle = [
    ['1234567.89'],            // Punkt dahinter
    ['1234567,89'],            // Komma dahinter
    ['$ 1234567'],             // Waehrungszeichen davor
    ['1234567 EUR'],           // Waehrungscode dahinter
    ['Stake 1234567'],         // Beschriftung in derselben Zeile
    ['Einsatz: 9876543'],      // dasselbe auf deutsch
  ]
  for (const zeilen of faelle) {
    const treffer = findeScheinnummer(zeilen)
    assert.equal(treffer.wert, null, `"${zeilen[0]}" haette nicht genommen werden duerfen`)
  }
})

test('eine zu kurze Zahl wird nicht zur Scheinnummer', () => {
  // 20000 ist ein Betrag, den Karam wirklich setzt. Fuenf Stellen.
  assert.equal(findeScheinnummer(['20000']).wert, null)
  assert.equal(findeScheinnummer(['123456']).wert, null)
})

test('ein Datum in Ziffernform wird nicht zur Scheinnummer', () => {
  assert.equal(findeScheinnummer(['20260913 Bayern - Dortmund']).wert, null)
  assert.equal(findeScheinnummer(['13092026 Bayern - Dortmund']).wert, null)
})

test('weiter unten im Schein wird keine nackte Zahl mehr genommen', () => {
  // Ab der vierten Zeile ist eine nackte Zahl eher ein Wert als eine Kopfzeile.
  const zeilen = ['Kopf', 'Spiel', 'Markt', '396228612']
  assert.equal(findeScheinnummer(zeilen).wert, null)
})

test('die echte BetOnline-Zeile wird dagegen erkannt', () => {
  const treffer = findeScheinnummer(['396228612    Sep 10, 10:45 PM'])
  assert.equal(treffer.wert, '396228612')
  assert.ok(treffer.sicherheit < 0.95, 'ohne Beschriftung darf die Sicherheit nicht hoechster Stufe sein')
})

test('eine beschriftete Nummer schlaegt die nackte', () => {
  // Steht beides da, gewinnt die mit Beschriftung. Sie ist die sicherere
  // Quelle, deshalb laeuft ihre Regel vor der nackten.
  const treffer = findeScheinnummer(['396228612 Sep 10', 'Bet ID: 8842019773'])
  assert.equal(treffer.wert, '8842019773')
  assert.ok(treffer.sicherheit > 0.8, 'mit Beschriftung ist die Sicherheit hoeher')
})

test('die Scheinnummer taucht nie als Geldbetrag wieder auf', () => {
  // Der eigentliche Sinn der ganzen Uebung.
  const e = leseSchein(
    ['396228612    Sep 10, 10:45 PM', 'Deebo Samuel', 'Odds: -157  Stake: $ 181  Returns: $ 296.84'],
    { gebiet: 'us', quotenformat: 'amerikanisch' }
  )
  assert.equal(e.einsatz.wert, 181)
  assert.equal(e.auszahlung.wert, 296.84)
  assert.equal(e.scheinNr.wert, '396228612')
})
