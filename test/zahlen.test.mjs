import test from 'node:test'
import assert from 'node:assert/strict'

import {
  leseZahl,
  leseAmerikanischeQuote,
  erkenneWaehrung,
  ziffernRetten,
  runde,
} from '../kern/zahlen.js'

test('einfache Betraege aus dem echten Schein', () => {
  assert.equal(leseZahl('$ 181').wert, 181)
  assert.equal(leseZahl('$ 296.84').wert, 296.84)
  assert.equal(leseZahl('Stake: $ 300').wert, 300)
  assert.equal(leseZahl('Returns: $ 492').wert, 492)
})

test('deutsche und englische Schreibweise', () => {
  assert.equal(leseZahl('1.181,50', { gebiet: 'de' }).wert, 1181.5)
  assert.equal(leseZahl('1,181.50', { gebiet: 'en' }).wert, 1181.5)
  // Ohne Gebietshinweis entscheidet das letzte Trennzeichen.
  assert.equal(leseZahl('1.181,50').wert, 1181.5)
  assert.equal(leseZahl('1,181.50').wert, 1181.5)
  assert.equal(leseZahl('20.000,00', { gebiet: 'de' }).wert, 20000)
  assert.equal(leseZahl('20,000.00', { gebiet: 'en' }).wert, 20000)
})

test('Tausenderraeume in verschiedenen Schreibweisen', () => {
  assert.equal(leseZahl('1 181,50', { gebiet: 'de' }).wert, 1181.5)
  assert.equal(leseZahl("1'181.50", { gebiet: 'en' }).wert, 1181.5)
})

test('mehrfach vorkommendes Trennzeichen ist immer der Tausendertrenner', () => {
  assert.equal(leseZahl('1.234.567', { gebiet: 'de' }).wert, 1234567)
  assert.equal(leseZahl('1,234,567', { gebiet: 'en' }).wert, 1234567)
})

test('der wirklich mehrdeutige Fall wird gemeldet, nicht stillschweigend geraten', () => {
  const ohneHinweis = leseZahl('1,181')
  assert.equal(ohneHinweis.mehrdeutig, true)
  assert.equal(ohneHinweis.wert, 1181)

  const deutsch = leseZahl('1,181', { gebiet: 'de' })
  assert.equal(deutsch.wert, 1.181)
  assert.equal(deutsch.mehrdeutig, false)

  const englisch = leseZahl('1,181', { gebiet: 'en' })
  assert.equal(englisch.wert, 1181)
  assert.equal(englisch.mehrdeutig, false)
})

test('zwei Nachkommastellen sind nie ein Tausendertrenner', () => {
  assert.equal(leseZahl('1,50', { gebiet: 'de' }).wert, 1.5)
  assert.equal(leseZahl('1.50', { gebiet: 'en' }).wert, 1.5)
  assert.equal(leseZahl('1,50').mehrdeutig, false)
})

test('Klammern bedeuten einen negativen Betrag', () => {
  assert.equal(leseZahl('(12,50)', { gebiet: 'de' }).wert, -12.5)
  assert.equal(leseZahl('(1,234.56)', { gebiet: 'en' }).wert, -1234.56)
})

test('Zeichen werden nur im Zahlenumfeld als Ziffern gedeutet', () => {
  const gerettet = leseZahl('O.64')
  assert.equal(gerettet.wert, 0.64)
  assert.equal(gerettet.ersetzt, true)

  // Komplett verlesene Zahl: jedes Zeichen ist entweder Ziffer oder bekannte Verwechslung.
  const mitBuchstaben = leseZahl('l8l')
  assert.equal(mitBuchstaben.wert, 181)
  assert.equal(mitBuchstaben.ersetzt, true)

  assert.equal(leseZahl('29G.84').wert, 296.84)
  assert.equal(leseZahl('49Z').wert, 492)
})

test('Woerter werden nie zu Zahlen verbogen', () => {
  for (const wort of ['Stake', 'Returns', 'Odds', 'Einsatz', 'Quote', 'won', 'Deebo']) {
    const r = ziffernRetten(wort)
    assert.equal(r.ersetzt, false, `${wort} wurde faelschlich umgedeutet`)
    assert.equal(r.text, wort)
  }
})

test('nur Bausteine mit echter Ziffer werden angefasst', () => {
  // OSS besteht zwar nur aus ersetzbaren Zeichen, hat aber keine einzige echte Ziffer.
  const r = ziffernRetten('OSS')
  assert.equal(r.ersetzt, false)
  assert.equal(r.text, 'OSS')
})

test('in einem Satz bleibt der Text stehen und nur die Zahl wird gerettet', () => {
  const r = ziffernRetten('Stake: l8l')
  assert.equal(r.text, 'Stake: 181')
  assert.equal(r.ersetzt, true)
})

test('ein fuehrendes S wird nur bei bekannter Waehrung als Dollarzeichen gelesen', () => {
  // Ohne Hinweis bleibt es eine Fuenf, damit die Gegenrechnung anschlagen kann.
  assert.equal(leseZahl('S181').wert, 5181)
  // Mit Hinweis wird es als verlesenes Waehrungszeichen entfernt.
  assert.equal(leseZahl('S181', { waehrungBekannt: true }).wert, 181)
  // Eine echte Zahl bleibt auch mit Hinweis unversehrt.
  assert.equal(leseZahl('5181', { waehrungBekannt: true }).wert, 5181)
})

test('das Dollarzeichen wird nicht zur Fuenf', () => {
  assert.equal(leseZahl('$181').wert, 181)
  assert.equal(leseZahl('$ 5').wert, 5)
  assert.equal(leseZahl('US$ 2').wert, 2)
  assert.equal(leseZahl('12,50 EUR', { gebiet: 'de' }).wert, 12.5)
})

test('leerer oder unbrauchbarer Text ergibt null mit Grund', () => {
  assert.equal(leseZahl('').wert, null)
  assert.equal(leseZahl('').grund, 'leer')
  assert.equal(leseZahl('Stake:').wert, null)
  assert.equal(leseZahl('Stake:').grund, 'keine ziffern')
  assert.equal(leseZahl(null).wert, null)
})

test('amerikanische Quote mit Vorzeichen', () => {
  assert.equal(leseAmerikanischeQuote('-157').wert, -157)
  assert.equal(leseAmerikanischeQuote('+250').wert, 250)
  assert.equal(leseAmerikanischeQuote('Odds: -157').wert, -157)
  // Verschiedene Striche, die die Texterkennung liefert.
  assert.equal(leseAmerikanischeQuote('–157').wert, -157)
  assert.equal(leseAmerikanischeQuote('−157').wert, -157)
  // Verlesene Ziffer.
  assert.equal(leseAmerikanischeQuote('-1O9').wert, -109)
})

test('amerikanische Quote ohne Vorzeichen wird als mehrdeutig gemeldet', () => {
  const r = leseAmerikanischeQuote('157')
  assert.equal(r.mehrdeutig, true)
  assert.equal(r.wert, 157)
})

test('amerikanische Quote unter 100 gibt es nicht', () => {
  assert.equal(leseAmerikanischeQuote('98').wert, null)
  assert.equal(leseAmerikanischeQuote('-99').wert, null)
})

test('Waehrungserkennung', () => {
  assert.equal(erkenneWaehrung('Stake: $ 181'), 'USD')
  assert.equal(erkenneWaehrung('Einsatz: 12,50 €'), 'EUR')
  assert.equal(erkenneWaehrung('12.50 GBP'), 'GBP')
  assert.equal(erkenneWaehrung('CHF 20'), 'CHF')
  assert.equal(erkenneWaehrung('nur Text'), 'UNBEKANNT')
})

test('kaufmaennisches Runden auch bei krummen Gleitkommawerten', () => {
  assert.equal(runde(1.005, 2), 1.01)
  assert.equal(runde(2.675, 2), 2.68)
  assert.equal(runde(296.8400000001, 2), 296.84)
  assert.equal(runde(-1.005, 2), -1.01)
  assert.equal(runde(1.64499, 2), 1.64)
})
