import test from 'node:test'
import assert from 'node:assert/strict'

import {
  amerikanischNachDezimal,
  dezimalNachAmerikanisch,
  bruchNachDezimal,
  impliziteWahrscheinlichkeit,
  auszahlung,
  gewinn,
  dezimalAusBetraegen,
  kombiquote,
  kombiquoteMitAusfall,
  dezimalSpanneFuerAnzeige,
  passtZuAnzeige,
  versoehne,
  effektiveQuote,
  nahBei,
} from '../kern/quoten.js'

/** Vergleich mit fester Genauigkeit, damit Gleitkommareste nicht stoeren. */
function gleich(a, b, stellen = 9) {
  assert.ok(a !== null && b !== null, `null aufgetreten: ${a} / ${b}`)
  assert.ok(
    Math.abs(a - b) < Math.pow(10, -stellen),
    `erwartet ${b}, bekommen ${a}`
  )
}

test('amerikanisch nach dezimal, beide Vorzeichen und die Grenzen', () => {
  gleich(amerikanischNachDezimal(-157), 1 + 100 / 157)
  gleich(amerikanischNachDezimal(250), 3.5)
  gleich(amerikanischNachDezimal(100), 2)
  gleich(amerikanischNachDezimal(-100), 2)
  gleich(amerikanischNachDezimal(-110), 1 + 100 / 110)
  assert.equal(amerikanischNachDezimal(99), null)
  assert.equal(amerikanischNachDezimal(-99), null)
  assert.equal(amerikanischNachDezimal(0), null)
  assert.equal(amerikanischNachDezimal(NaN), null)
})

test('dezimal nach amerikanisch, Grenze bei genau 2.0', () => {
  gleich(dezimalNachAmerikanisch(2), 100)
  gleich(dezimalNachAmerikanisch(3.5), 250)
  gleich(dezimalNachAmerikanisch(1.64), -156.25)
  gleich(dezimalNachAmerikanisch(1.5), -200)
  assert.equal(dezimalNachAmerikanisch(1), null)
  assert.equal(dezimalNachAmerikanisch(0.5), null)
})

test('Hin und zurueck ergibt wieder denselben Wert', () => {
  // Minus 100 und plus 100 sind beide genau Dezimalquote 2.0. Der Rueckweg kann
  // deshalb nur einen der beiden liefern, per Festlegung plus 100. Dieser eine
  // Wert wird darum getrennt geprueft und hier ausgelassen.
  for (const a of [-10000, -500, -157, -110, -101, 100, 105, 250, 1500, 10000]) {
    const d = amerikanischNachDezimal(a)
    assert.ok(d !== null)
    const zurueck = dezimalNachAmerikanisch(d)
    assert.ok(zurueck !== null)
    gleich(zurueck, a, 6)
  }
})

test('minus 100 und plus 100 sind dieselbe Quote', () => {
  gleich(amerikanischNachDezimal(-100), 2)
  gleich(amerikanischNachDezimal(100), 2)
  // Der Rueckweg liefert per Festlegung die Plusform.
  gleich(dezimalNachAmerikanisch(2), 100)
})

test('Bruchquote und Wahrscheinlichkeit', () => {
  gleich(bruchNachDezimal(5, 2), 3.5)
  gleich(bruchNachDezimal(1, 1), 2)
  assert.equal(bruchNachDezimal(1, 0), null)
  gleich(impliziteWahrscheinlichkeit(2), 0.5)
  gleich(impliziteWahrscheinlichkeit(4), 0.25)
})

test('Auszahlung und Gewinn sind klar getrennt', () => {
  gleich(auszahlung(181, 1.64), 296.84, 8)
  gleich(auszahlung(300, 1.64), 492, 8)
  gleich(gewinn(181, 1.64), 115.84, 8)
  gleich(gewinn(300, 1.64), 192, 8)
  // Der Einsatz ist in der Auszahlung enthalten, im Gewinn nicht.
  gleich(auszahlung(300, 1.64) - gewinn(300, 1.64), 300, 8)
})

test('Quote aus den Betraegen ist der genaue Weg', () => {
  gleich(dezimalAusBetraegen(300, 492), 1.64, 10)
  gleich(dezimalAusBetraegen(181, 296.84), 1.64, 10)
  assert.equal(dezimalAusBetraegen(0, 100), null)
})

test('Kombiquote ist das Produkt der Beine', () => {
  const q = kombiquote([1.91, 1.83, 2.1, 1.55])
  gleich(q, 1.91 * 1.83 * 2.1 * 1.55, 10)
  gleich(q, 11.3772015, 6)
  assert.equal(kombiquote([]), null)
  assert.equal(kombiquote([1.5, 1]), null)
})

test('Annullierte Beine fallen aus der Kombiquote heraus', () => {
  const beine = [
    { quote: 1.91 },
    { quote: 1.83 },
    { quote: 2.1, status: 'storniert' },
    { quote: 1.55 },
  ]
  gleich(kombiquoteMitAusfall(beine), 1.91 * 1.83 * 1.55, 10)
  // Fallen alle aus, bleibt der Einsatz stehen, also Quote 1.
  assert.equal(
    kombiquoteMitAusfall([{ quote: 2, status: 'push' }]),
    1
  )
})

test('Spanne der angezeigten amerikanischen Quote deckt die echte Quote ab', () => {
  const spanne = dezimalSpanneFuerAnzeige(-157)
  assert.ok(spanne !== null)
  gleich(spanne.min, 1 + 100 / 158, 9)
  gleich(spanne.max, 1 + 100 / 156, 9)
  // Der reale Fall aus dem Schein von BetOnline.
  assert.ok(spanne.min <= 1.64 && 1.64 <= spanne.max)

  const plus = dezimalSpanneFuerAnzeige(250)
  assert.ok(plus !== null)
  gleich(plus.min, 3.49, 9)
  gleich(plus.max, 3.51, 9)

  // Direkt an der Grenze darf nicht in den ungueltigen Bereich gerutscht werden.
  const grenze = dezimalSpanneFuerAnzeige(-100)
  assert.ok(grenze !== null)
  gleich(grenze.max, 2, 9)
})

test('passtZuAnzeige akzeptiert die Rundung, aber keinen echten Fehler', () => {
  assert.equal(passtZuAnzeige(1.64, -157), true)
  assert.equal(passtZuAnzeige(1.6369, -157), true)
  assert.equal(passtZuAnzeige(1.7, -157), false)
  assert.equal(passtZuAnzeige(1.5, -157), false)
  assert.equal(passtZuAnzeige(3.5, 250), true)
  assert.equal(passtZuAnzeige(3.7, 250), false)
})

test('Gegenrechnung: der echte BetOnline Schein geht glatt auf', () => {
  const a = versoehne({ einsatz: 181, auszahlung: 296.84, amerikanisch: -157 })
  assert.equal(a.stimmig, true)
  gleich(a.dezimal, 1.64, 10)
  gleich(a.auszahlung, 296.84, 8)
  assert.equal(a.hinweise.length, 0)

  const b = versoehne({ einsatz: 300, auszahlung: 492, amerikanisch: -157 })
  assert.equal(b.stimmig, true)
  gleich(b.dezimal, 1.64, 10)
  assert.equal(b.hinweise.length, 0)
})

test('Gegenrechnung meldet einen echten Widerspruch', () => {
  const r = versoehne({ einsatz: 100, auszahlung: 150, amerikanisch: -157 })
  assert.equal(r.stimmig, false)
  assert.ok(r.hinweise.some((h) => h.code === 'quote_widerspruch_us'))
  // Der Wert aus den Betraegen gewinnt, weil er ungerundet ist.
  gleich(r.dezimal, 1.5, 10)
})

test('Gegenrechnung erkennt eine Gratiswette statt Fehlalarm zu schlagen', () => {
  // Einsatz 100, Quote 2.5. Normale Auszahlung waere 250, hier kommen nur 150 zurueck.
  const r = versoehne({ einsatz: 100, auszahlung: 150, dezimal: 2.5 })
  assert.ok(r.hinweise.some((h) => h.code === 'gratiswette'))
  assert.ok(!r.hinweise.some((h) => h.code === 'quote_widerspruch'))
})

test('Gegenrechnung fuellt fehlende Werte auf und sagt, dass sie gerechnet wurden', () => {
  const ohneAuszahlung = versoehne({ einsatz: 250, amerikanisch: 150 })
  gleich(ohneAuszahlung.dezimal, 2.5, 10)
  gleich(ohneAuszahlung.auszahlung, 625, 8)
  assert.equal(ohneAuszahlung.herkunft[1], 'berechnet')
  assert.ok(ohneAuszahlung.hinweise.some((h) => h.code === 'auszahlung_berechnet'))

  const ohneEinsatz = versoehne({ auszahlung: 625, dezimal: 2.5 })
  gleich(ohneEinsatz.einsatz, 250, 8)
  assert.equal(ohneEinsatz.herkunft[0], 'berechnet')
})

test('Gegenrechnung weist eine ungueltige amerikanische Quote zurueck', () => {
  const r = versoehne({ einsatz: 100, amerikanisch: 50 })
  assert.ok(r.hinweise.some((h) => h.code === 'quote_ungueltig'))
})

test('Effektive Quote ist einsatzgewichtet, nicht der Mittelwert', () => {
  // Die drei echten Scheine: alle dieselbe Quote, also bleibt sie stehen.
  const gleiche = effektiveQuote([
    { einsatz: 181, quote: 1.64 },
    { einsatz: 300, quote: 1.64 },
    { einsatz: 300, quote: 1.64 },
  ])
  gleich(gleiche, 1.64, 10)

  // Deutlicher Fall: der einfache Mittelwert waere 1.75, richtig sind 1.55.
  const gemischt = effektiveQuote([
    { einsatz: 100, quote: 2.0 },
    { einsatz: 900, quote: 1.5 },
  ])
  gleich(gemischt, 1.55, 10)
  assert.notEqual(Math.round(gemischt * 100) / 100, 1.75)

  assert.equal(effektiveQuote([]), null)
})

test('Effektive Quote mal Gesamteinsatz ergibt die moegliche Gesamtauszahlung', () => {
  const posten = [
    { einsatz: 181, quote: 1.64 },
    { einsatz: 300, quote: 1.7 },
    { einsatz: 300, quote: 1.58 },
  ]
  const einsatzSumme = posten.reduce((s, p) => s + p.einsatz, 0)
  const auszahlungSumme = posten.reduce((s, p) => s + p.einsatz * p.quote, 0)
  const eff = effektiveQuote(posten)
  gleich(eff * einsatzSumme, auszahlungSumme, 6)
})

test('nahBei arbeitet mit absoluter und relativer Grenze', () => {
  assert.equal(nahBei(100, 100.01, 0.02, 0), true)
  assert.equal(nahBei(100, 100.5, 0.02, 0), false)
  assert.equal(nahBei(1000, 1001, 0.02, 0.002), true)
})
