import test from 'node:test'
import assert from 'node:assert/strict'

import { leseZahl } from '../kern/zahlen.js'
import { leseSchein } from '../kern/parser.js'

/**
 * Was die Texterkennung an echten Wettscheinen wirklich falsch macht.
 *
 * Gefunden am 13.09.2026 bei der Gegenpruefung des Leseprogramms, bevor Karams
 * echte Fotos liefen. Jeder Fall hier war nachgerechnet falsch im Programm und
 * haette echtes Geld falsch gezaehlt.
 *
 * Die Reihenfolge ist die Reihenfolge des Schadens: zuerst die Faelle, die um
 * den Faktor hundert danebenliegen, dann die, die eine Quote erfinden.
 *
 * Alle Faelle sind so gebaut, dass sie in node laufen. Es braucht kein Bild.
 */

const US = { gebiet: 'en', quotenformat: 'amerikanisch' }

/** @param {any} e @param {string} f */
function w(e, f) {
  const roh = e[f]
  return roh && typeof roh === 'object' && 'wert' in roh ? roh.wert : roh
}

// ---------------------------------------------------------------------------
// 1. Wiederholtes Trennzeichen
//
// Der Punkt vor den Cent wird als Komma verlesen: aus "1,000.00" wird
// "1,000,00". Die alte Regel sagte: mehr als ein gleiches Trennzeichen heisst
// Tausendertrenner, also 100000. Das ist der Faktor hundert.
//
// Die Gegenregel ist beweisbar, dieselbe wie beim verschluckten Punkt in
// test/luecken.test.mjs: eine Tausendergruppe hat in jeder Sprache genau drei
// Ziffern. Eine Gruppe am Ende mit ein oder zwei Ziffern kann deshalb keine
// Tausendergruppe sein.
//
// Besonders boesartig: Einsatz UND Auszahlung sind um denselben Faktor
// daneben, das Verhaeltnis stimmt weiter, und der Pruefstein Einsatz mal Quote
// gleich Auszahlung schlaegt deshalb NICHT an.
// ---------------------------------------------------------------------------

test('wiederholtes Komma mit zweistelliger Endgruppe ist ein Dezimalkomma', () => {
  assert.equal(leseZahl('1,000,00', { gebiet: 'en' }).wert, 1000)
  assert.equal(leseZahl('1,636,94', { gebiet: 'en' }).wert, 1636.94)
  assert.equal(leseZahl('20,000,00', { gebiet: 'en' }).wert, 20000)
})

test('wiederholter Punkt mit zweistelliger Endgruppe ist ein Dezimalpunkt', () => {
  assert.equal(leseZahl('1.234.56', { gebiet: 'de' }).wert, 1234.56)
  assert.equal(leseZahl('12.345.6', { gebiet: 'de' }).wert, 12345.6)
})

test('lauter Dreiergruppen bleiben Tausender', () => {
  assert.equal(leseZahl('1,234,567', { gebiet: 'en' }).wert, 1234567)
  assert.equal(leseZahl('1.234.567', { gebiet: 'de' }).wert, 1234567)
  // Karams groesster Fall darf nicht kippen.
  assert.equal(leseZahl('20,000,000', { gebiet: 'en' }).wert, 20000000)
})

test('der ganze Schein mit verlesenem Punkt kommt richtig heraus', () => {
  const e = leseSchein(
    ['#396228612 Sep 10, 10:42 PM', 'Deebo Samuel', 'Odds: -157 Stake: $1,000,00 Returns: $1,636,94'],
    US
  )
  assert.equal(w(e, 'einsatz'), 1000, 'Einsatz war um den Faktor hundert daneben')
  assert.equal(w(e, 'auszahlung'), 1636.94)
})

// ---------------------------------------------------------------------------
// 2. Ziffern, die als Buchstaben gelesen wurden
//
// kern/zahlen.js rettet "2QQ" zu 200. Der Parser hatte dafuer eine ZWEITE,
// kuerzere Buchstabenliste und schnitt stattdessen ab: 2 statt 200, und zwar
// mit Sicherheit 0,9, weil nichts als ersetzt vermerkt wurde.
//
// Das ist Projektregel 8: Logik lebt an genau einer Stelle. Es gab zwei.
// ---------------------------------------------------------------------------

test('verlesene Ziffern im Betrag werden gerettet, nicht abgeschnitten', () => {
  const e = leseSchein(
    ['#396228612 Sep 10, 10:42 PM', 'Deebo Samuel', 'Odds: -157 Stake: $2QQ Returns: $328.03'],
    US
  )
  assert.equal(w(e, 'einsatz'), 200, '"2QQ" heisst 200, nicht 2')
})

test('die uebrigen Verwechslungen ebenso', () => {
  assert.equal(leseZahl('T50', { gebiet: 'en' }).wert, 750)
  assert.equal(leseZahl('1D0', { gebiet: 'en' }).wert, 100)
  for (const [text, soll] of [
    ['$2QQ', 200],
    ['$T50', 750],
    ['$1D0', 100],
  ]) {
    const e = leseSchein(['Odds: -157', `Stake: ${text}`], US)
    assert.equal(w(e, 'einsatz'), soll, `"${text}" haette ${soll} ergeben muessen`)
  }
})

// ---------------------------------------------------------------------------
// 3. Das Vorzeichen der amerikanischen Quote
//
// Es gibt viele Striche, die wie ein Minus aussehen. kern/zahlen.js kennt sie,
// der Parser kannte nur vier. Kippt das Vorzeichen, wird aus -157 die Quote
// 2,57 statt 1,64: ein Aufschlag von siebenundfuenfzig Prozent auf die
// erwartete Auszahlung.
//
// Steht auf dem Schein keine Auszahlung, gibt es keinen Pruefstein, der das
// faengt.
// ---------------------------------------------------------------------------

test('alle Minuszeichen gelten als Minus', () => {
  // Als Fluchtfolgen geschrieben, nicht woertlich: der lange Gedankenstrich
  // ist im Projekt verboten, und werkzeug/pruefe.mjs prueft auch test/.
  // Ausserdem sieht man so, welches Zeichen wirklich gemeint ist.
  const striche = [
    '\u2010', // Bindestrich
    '\u2011', // geschuetzter Bindestrich
    '\u2012', // Ziffernstrich
    '\u2013', // Halbgeviertstrich
    '\u2014', // Geviertstrich, der im Projekt verbotene lange Gedankenstrich
    '\u2015', // waagerechter Strich
    '\u2212', // Minuszeichen
    '-', // einfacher Bindestrich
  ]
  for (const strich of striche) {
    const e = leseSchein(['Deebo Samuel', `Odds: ${strich}157 Stake $181`], US)
    const quote = w(e, 'quoteDezimal')
    assert.ok(
      typeof quote === 'number' && Math.abs(quote - 1.637) < 0.01,
      `Strich U+${strich.charCodeAt(0).toString(16)}: Quote ${quote}, erwartet rund 1,64`
    )
  }
})

// ---------------------------------------------------------------------------
// 4. "Win Amount" ist kein Einsatz
//
// In kern/etiketten.js stand "amount" allein als Einsatz-Etikett. Damit
// schluckte es "Win Amount" und "Payout Amount", also genau die Gegenseite.
// Ergebnis: der Gewinn wurde zum Einsatz, und die aufgedruckte Auszahlung
// verschwand ohne einen einzigen Hinweis.
// ---------------------------------------------------------------------------

test('Win Amount ist die Auszahlung, nicht der Einsatz', () => {
  const e = leseSchein(['Win Amount $296.84', 'Odds: -157', 'Stake $181'], US)
  assert.equal(w(e, 'einsatz'), 181, 'der Einsatz steht in der Stake-Zeile')
})

test('Risk Amount ist dagegen der Einsatz', () => {
  const e = leseSchein(['Risk Amount $181.00', 'Odds: -157'], US)
  assert.equal(w(e, 'einsatz'), 181)
})

// ---------------------------------------------------------------------------
// 5. Quotenboost: der Pruefstein gilt dort nicht
//
// kern/reparatur.js darf Ziffern nur berichtigen, wenn GENAU EINE Loesung zur
// Rechnung passt. Bei einem Quotenboost stimmt die Rechnung Einsatz mal Quote
// gleich Auszahlung aber gar nicht, denn der Anbieter legt etwas drauf. Die
// Reparatur hat daraufhin einen fehlerfrei gelesenen Einsatz von 200 auf 206
// umgeschrieben und dazu behauptet, nur diese eine Kombination passe.
//
// Wo der Pruefstein nicht gilt, darf die Automatik nicht entscheiden.
// ---------------------------------------------------------------------------

test('bei einem Quotenboost wird kein Betrag umgeschrieben', () => {
  const e = leseSchein(
    [
      '#8812004417 Sep 10, 10:42 PM',
      'Jalen Hurts',
      'ANYTIME TOUCHDOWN SCORER',
      'PROFIT BOOST APPLIED 10%',
      'Odds: -200 Wager: $200.00 Total Payout: $310.00',
    ],
    US
  )
  assert.equal(w(e, 'einsatz'), 200, 'der Einsatz stand richtig auf dem Schein')
  assert.equal(w(e, 'auszahlung'), 310)
  assert.ok(
    !e.hinweise.some((h) => h.code === 'ziffern_berichtigt'),
    'bei einem Boost darf nichts berichtigt werden, der Pruefstein gilt dort nicht'
  )
})

// ---------------------------------------------------------------------------
// 6. Ein erstatteter Schein ist kein Gewinn
//
// Stand das Statuswort nicht in der Liste, blieb der Status unbekannt. Dann
// galt Einsatz gleich Auszahlung als reiner Gewinn, und daraus wurde eine
// Quote von 2,0 gerechnet, obwohl auf dem Schein 1,64 steht. Der Schein bringt
// dann 362 in die Summe statt der 181, die wirklich zurueckflossen.
// ---------------------------------------------------------------------------

test('Refunded wird als Erstattung erkannt, nicht als Gewinn', () => {
  const e = leseSchein(
    ['#396228612 Sep 10', 'Deebo Samuel', 'Odds: -157', 'Refunded', 'Stake: $181.00 Returns: $181.00'],
    US
  )
  assert.notEqual(w(e, 'quoteDezimal'), 2, 'die gedruckte Quote 1,64 darf nicht durch 2,0 ersetzt werden')
  assert.ok(
    Math.abs(w(e, 'quoteDezimal') - 1.637) < 0.01,
    `Quote ${w(e, 'quoteDezimal')}, erwartet die gedruckte 1,64`
  )
  assert.equal(w(e, 'ausgezahlt'), 181, 'zurueckgeflossen sind 181')
})

test('die uebrigen Worte fuer Annullierung ebenso', () => {
  for (const wort of ['No Action', 'Erstattet', 'Refund']) {
    const e = leseSchein(['Odds: -157', wort, 'Stake: $181.00 Returns: $181.00'], US)
    assert.notEqual(w(e, 'quoteDezimal'), 2, `"${wort}": Quote wurde erfunden`)
  }
})
