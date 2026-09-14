import test from 'node:test'
import assert from 'node:assert/strict'

import { leseSchein } from '../kern/parser.js'

/**
 * Dieselben fuenf Formate, aber mit HUNDERTEN verschiedener Zahlen.
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * Karams Frage am 14.09.2026: "Die Fotos werden zwar die aehnlichen Anbieter
 * haben, aber die werden unterschiedliche Einsaetze haben. Bist du sicher?"
 *
 * Das ist die richtige Frage. test/echte_anbieter.test.mjs prueft genau die
 * Zahlen, die auf seinen Fotos standen. Wenn das Leseprogramm nur die kennt,
 * ist nichts gewonnen. Also wird hier dasselbe Format mit vielen verschiedenen
 * Betraegen und Quoten durchgerechnet: kleine, grosse, krumme, runde, mit und
 * ohne Tausendertrenner.
 *
 * Die Sollwerte entstehen NICHT aus dem Leseprogramm, sondern aus der
 * Rechnung. Ein Fall, bei dem das Programm sich selbst pruefen wuerde, waere
 * wertlos.
 */

const w = (e, f) => (e[f] && typeof e[f] === 'object' && 'wert' in e[f] ? e[f].wert : e[f])

/** Kaufmaennisch runden, ohne die Gleitkomma-Ueberraschungen. */
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/** Englische Schreibweise: 2540.48 wird zu "2,540.48". */
function en(n, stellen = 2) {
  const [ganz, teil] = n.toFixed(stellen).split('.')
  return (ganz ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (teil ? '.' + teil : '')
}

/** Deutsche Schreibweise: 2211.55 wird zu "2.211,55". */
function de(n, stellen = 2) {
  const [ganz, teil] = n.toFixed(stellen).split('.')
  return (ganz ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (teil ? ',' + teil : '')
}

/** Dezimalquote zu amerikanischer Quote, gerundet wie beim Buchmacher. */
function amerikanisch(dezimal) {
  return dezimal >= 2
    ? Math.round((dezimal - 1) * 100)
    : -Math.round(100 / (dezimal - 1))
}

/**
 * Die Einsaetze, mit denen wirklich gerechnet wird.
 * Absichtlich quer durch alle Groessenordnungen und Kommastellen.
 */
const EINSAETZE = [
  1, 2.5, 5, 9.99, 10, 25, 50, 78.3, 99.95, 100, 181, 250, 268, 287.5, 300,
  425.53, 500, 700, 961.54, 999.99, 1000, 1234.56, 1660, 2000, 2165, 2315.98,
  2518, 2540.48, 3000, 5000, 5801.0025, 9999.99, 10000, 12345.67, 20000,
]

/** Die Quoten, mit denen wirklich gerechnet wird. */
const QUOTEN = [1.01, 1.05, 1.47, 1.69, 1.73, 1.8, 1.826, 1.84, 1.847, 1.854, 1.9, 2.15, 2.3, 3.5, 5.0, 9.75]

/** Ein Paar aus Einsatz und Quote, breit gestreut, ohne Zufall. */
function* paare() {
  for (let i = 0; i < EINSAETZE.length; i++) {
    for (let j = 0; j < QUOTEN.length; j++) {
      // Nicht jede Kombination, sonst dauert es unnoetig. Jede dritte reicht,
      // und der Versatz sorgt dafuer, dass jede Quote auf jede Groessenordnung
      // trifft.
      if ((i + j) % 3 !== 0) continue
      yield { einsatz: EINSAETZE[i], quote: QUOTEN[j] }
    }
  }
}

const ANZAHL = [...paare()].length

test(`der Pruefsatz ist gross genug (${ANZAHL} Faelle je Anbieter)`, () => {
  assert.ok(ANZAHL >= 150, `nur ${ANZAHL} Faelle`)
})

// ---------------------------------------------------------------------------

test('BetOnline: amerikanische Quoten, Dollar, jede Groessenordnung', () => {
  let geprueft = 0
  for (const { einsatz, quote } of paare()) {
    const us = amerikanisch(quote)
    // Die echte Quote ist die aus der gerundeten amerikanischen Anzeige.
    const echteQuote = us > 0 ? 1 + us / 100 : 1 + 100 / -us
    const auszahlung = r2(einsatz * echteQuote)

    const e = leseSchein(
      [
        '#396228612 Sep 10, 10:42 PM',
        'won',
        'Deebo Samuel',
        `Odds: ${us > 0 ? '+' : ''}${us}    Stake: $ ${en(einsatz)}    Returns: $ ${en(auszahlung)}`,
      ],
      { gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' }
    )
    assert.equal(w(e, 'einsatz'), r2(einsatz), `Einsatz bei ${en(einsatz)} / ${us}`)
    assert.equal(w(e, 'auszahlung'), auszahlung, `Auszahlung bei ${en(einsatz)} / ${us}`)
    geprueft++
  }
  assert.ok(geprueft === ANZAHL)
})

test('PS3838: Tabellenzeile, Risk und nackte Quote mit D', () => {
  for (const { einsatz, quote } of paare()) {
    const e = leseSchein(
      [
        'Sportsbook',
        '3777854081',
        'Football',
        'Over 226.5 Passing Yards',
        `${quote.toFixed(3)} D`,
        `Risk: ${en(einsatz)} (${en(einsatz)})`,
        en(r2(einsatz * (quote - 1))),
        '0.00',
        'Settled WIN',
      ],
      { gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' }
    )
    assert.equal(w(e, 'einsatz'), r2(einsatz), `Einsatz bei ${en(einsatz)}`)
    assert.ok(
      Math.abs(w(e, 'quoteDezimal') - quote) < 0.0015,
      `Quote bei ${en(einsatz)}: ${w(e, 'quoteDezimal')} statt ${quote}`
    )
  }
})

test('Betway: deutsch, Umsetzen, Wert in der naechsten Zeile', () => {
  for (const { einsatz, quote } of paare()) {
    const auszahlung = r2(einsatz * quote)
    const e = leseSchein(
      [
        `Einzelwette @ ${quote.toFixed(2)}`,
        'GEWONNEN',
        'Los Angeles Rams - San Francisco 49ers',
        'Umsetzen',
        `€${de(einsatz)}`,
        'DU HAST GEWONNEN',
        `€${de(auszahlung)}`,
      ],
      { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
    )
    assert.equal(w(e, 'einsatz'), r2(einsatz), `Einsatz bei ${de(einsatz)}`)
    assert.equal(w(e, 'auszahlung'), auszahlung, `Auszahlung bei ${de(einsatz)} x ${quote}`)
  }
})

test('bet365: deutsch, Gewinn ist die Auszahlung', () => {
  for (const { einsatz, quote } of paare()) {
    const auszahlung = r2(einsatz * quote)
    const e = leseSchein(
      [
        `€${de(einsatz)} Einzelwetten`,
        'GEWONNEN',
        `Nahshon Wright - Weniger als 2.5   ${quote.toFixed(2)}`,
        'Einsatz:',
        `€${de(einsatz)}`,
        'Gewinn',
        `€${de(auszahlung)}`,
      ],
      { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
    )
    assert.equal(w(e, 'einsatz'), r2(einsatz), `Einsatz bei ${de(einsatz)}`)
    assert.equal(w(e, 'auszahlung'), auszahlung, `Auszahlung bei ${de(einsatz)} x ${quote}`)
  }
})

test('Stake: acht Nachkommastellen, abgeschnitten, Quote deutsch', () => {
  for (const { einsatz, quote } of paare()) {
    const auszahlung = r2(einsatz * quote)
    // Stake schneidet lange Betraege ab. Kurze bleiben stehen.
    const lang = (n) => {
      const voll = en(n, 8)
      return voll.length > 14 ? voll.slice(0, 14) + '...' : voll
    }
    const e = leseSchein(
      [
        'Über 82.5 Rushing Yards',
        'Gewonnen',
        'Jahmyr Gibbs',
        `Quoten                    ${quote.toFixed(2).replace('.', ',')}`,
        `Einsatz          ${lang(einsatz)}`,
        `Auszahlung       ${lang(auszahlung)}`,
      ],
      { gebiet: 'en', waehrung: 'UNBEKANNT', quotenformat: 'dezimal' }
    )
    // Abgeschnitten heisst: die hinteren Stellen sind weg. Der Sollwert ist
    // deshalb der abgeschnittene Wert, nicht der volle.
    const sollEinsatz = Number(lang(einsatz).replace(/,/g, '').replace(/\.\.\.$/, ''))
    const sollAuszahlung = Number(lang(auszahlung).replace(/,/g, '').replace(/\.\.\.$/, ''))
    assert.ok(
      Math.abs(w(e, 'einsatz') - sollEinsatz) < 0.005,
      `Einsatz bei "${lang(einsatz)}": ${w(e, 'einsatz')} statt ${sollEinsatz}`
    )
    assert.ok(
      Math.abs(w(e, 'auszahlung') - sollAuszahlung) < 0.005,
      `Auszahlung bei "${lang(auszahlung)}": ${w(e, 'auszahlung')} statt ${sollAuszahlung}`
    )
  }
})

// ---------------------------------------------------------------------------
// Kombis: mehrere Spiele auf einem Schein
//
// Karam am 14.09.: "Die Kombis haben ja auch mehrere Spiele, mehrere
// Einsaetze. Jeder Einsatz muss auch mit betrachtet werden."
//
// Auf EINEM Schein gibt es genau EINEN Einsatz, aber mehrere Beine mit je
// eigener Quote. Die Gesamtquote ist ihr Produkt. Mehrere Einsaetze entstehen
// dadurch, dass derselbe Tipp bei vielen Anbietern liegt, und das ist die
// Aufgabe der Gruppierung, nicht des Scheinlesers.
// ---------------------------------------------------------------------------

test('Kombi mit drei Beinen: die Gesamtquote ist das Produkt', () => {
  for (const { einsatz } of paare()) {
    const beine = [1.5, 1.8, 2.2]
    const gesamt = r2(beine.reduce((a, b) => a * b, 1) * 1000) / 1000
    const auszahlung = r2(einsatz * gesamt)

    const e = leseSchein(
      [
        `€${de(einsatz)} Kombiwette`,
        'GEWONNEN',
        `Los Angeles Rams - San Francisco 49ers   ${beine[0].toFixed(2)}`,
        `Detroit Lions - New Orleans Saints   ${beine[1].toFixed(2)}`,
        `Carolina Panthers - Chicago Bears   ${beine[2].toFixed(2)}`,
        'Einsatz:',
        `€${de(einsatz)}`,
        'Gesamtquote',
        gesamt.toFixed(3).replace('.', ','),
        'Gewinn',
        `€${de(auszahlung)}`,
      ],
      { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
    )
    assert.equal(w(e, 'einsatz'), r2(einsatz), `Einsatz bei ${de(einsatz)}`)
    assert.ok(
      Math.abs(w(e, 'quoteDezimal') - gesamt) < 0.01,
      `Gesamtquote: ${w(e, 'quoteDezimal')} statt ${gesamt}`
    )
    assert.equal(w(e, 'auszahlung'), auszahlung, `Auszahlung bei ${de(einsatz)}`)
  }
})
