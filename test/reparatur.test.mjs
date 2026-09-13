import test from 'node:test'
import assert from 'node:assert/strict'

import { repariereBetraege, ziffernvarianten } from '../kern/reparatur.js'

test('Ziffernvarianten tauschen nur, was wirklich verwechselt wird', () => {
  const varianten = ziffernvarianten(200, 1).map((v) => v.wert)
  // 2 wird mit 3 und 7 verwechselt.
  assert.ok(varianten.includes(300), '300 muss dabei sein')
  assert.ok(varianten.includes(700), '700 muss dabei sein')
  // 0 wird mit 8, 6 und 9 verwechselt.
  assert.ok(varianten.includes(280), '280 muss dabei sein')
  // 1 wird nicht mit 2 verwechselt, also gibt es kein 100 aus 200.
  assert.ok(!varianten.includes(100), '100 darf nicht dabei sein')
})

test('Ziffernvarianten lassen die Kommastelle stehen', () => {
  const varianten = ziffernvarianten(296.84, 1).map((v) => v.wert)
  assert.ok(varianten.includes(206.84), '206.84 muss dabei sein')
  assert.ok(varianten.includes(296.34), '296.34 muss dabei sein')
  for (const v of varianten) {
    assert.ok(v > 10 && v < 1000, `${v} liegt in einer ganz anderen Groessenordnung`)
  }
})

test('Ziffernvarianten erzeugen keine fuehrende Null', () => {
  const varianten = ziffernvarianten(492, 1).map((v) => v.wert)
  for (const v of varianten) {
    assert.ok(v >= 100, `${v} hat eine Stelle verloren`)
  }
})

test('der echte Fall aus dem Durchlauf wird berichtigt', () => {
  // Gelesen wurde Einsatz 200 und Auszahlung 402 bei angezeigter Quote -157.
  // Richtig waren 300 und 492.
  const r = repariereBetraege({ einsatz: 200, auszahlung: 402, amerikanisch: -157 })
  assert.equal(r.gelungen, true, r.begruendung)
  assert.equal(r.einsatz, 300)
  assert.equal(r.auszahlung, 492)
  assert.equal(r.aenderungen, 2)
  assert.ok(r.begruendung.includes('berichtigt'))
})

test('eine einzelne verlesene Ziffer wird berichtigt', () => {
  // 181 und 206.84 statt 296.84, bei -157.
  const r = repariereBetraege({ einsatz: 181, auszahlung: 206.84, amerikanisch: -157 })
  assert.equal(r.gelungen, true, r.begruendung)
  assert.equal(r.einsatz, 181)
  assert.equal(r.auszahlung, 296.84)
  assert.equal(r.aenderungen, 1)
})

test('stimmige Zahlen werden nicht angefasst', () => {
  const r = repariereBetraege({ einsatz: 181, auszahlung: 296.84, amerikanisch: -157 })
  assert.equal(r.gelungen, false)
  assert.equal(r.einsatz, 181)
  assert.equal(r.auszahlung, 296.84)
  assert.ok(r.begruendung.includes('bereits'))
})

test('ohne eindeutige Loesung wird NICHTS geaendert', () => {
  // Eine Quote mit grosser Spanne laesst viele Kombinationen zu.
  const r = repariereBetraege({ einsatz: 100, auszahlung: 111, amerikanisch: -900, hoechstensJeZahl: 2 })
  if (r.gelungen) {
    // Wenn doch eindeutig, muss es wirklich passen.
    assert.ok(r.auszahlung / r.einsatz > 1.1 && r.auszahlung / r.einsatz < 1.12)
  } else {
    assert.equal(r.einsatz, 100, 'bei Uneindeutigkeit bleibt der gelesene Wert stehen')
    assert.equal(r.auszahlung, 111)
  }
})

test('unbrauchbare Eingaben werden abgewiesen', () => {
  assert.equal(repariereBetraege({ einsatz: null, auszahlung: 100, amerikanisch: -157 }).gelungen, false)
  assert.equal(repariereBetraege({ einsatz: 100, auszahlung: null, amerikanisch: -157 }).gelungen, false)
  assert.equal(repariereBetraege({ einsatz: 100, auszahlung: 200, amerikanisch: null }).gelungen, false)
  assert.equal(repariereBetraege({ einsatz: 0, auszahlung: 200, amerikanisch: -157 }).gelungen, false)
})

test('eine Auszahlung unter dem Einsatz wird nie als Loesung angeboten', () => {
  const r = repariereBetraege({ einsatz: 300, auszahlung: 100, amerikanisch: -157 })
  if (r.gelungen) {
    assert.ok(r.auszahlung > r.einsatz, 'Die Auszahlung muss ueber dem Einsatz liegen')
  }
})

test('wenn gar nichts passt, wird das gesagt und nichts geaendert', () => {
  // Quote 2.5, aber die Betraege ergeben 1.1. Keine Ziffernverwechslung hilft.
  const r = repariereBetraege({ einsatz: 1000, auszahlung: 1100, amerikanisch: 150 })
  assert.equal(r.gelungen, false)
  assert.equal(r.einsatz, 1000)
  assert.equal(r.auszahlung, 1100)
  assert.ok(r.begruendung.length > 0)
})
