import test from 'node:test'
import assert from 'node:assert/strict'

import {
  leseSchein,
  findeEtikettstellen,
  findeScheinnummer,
  findeStatus,
  teileInBeine,
  istBegegnung,
  deuteQuote,
  leseLinie,
  leseBeinQuote,
} from '../kern/parser.js'

/** Standardumgebung fuer die Tests. */
function umgebung(zusatz = {}) {
  return {
    id: 'S1',
    projektId: 'P1',
    bildId: 'B1',
    ausschnitt: { x: 0, y: 0, breite: 100, hoehe: 100 },
    positionImBild: 0,
    gebiet: 'en',
    waehrung: 'USD',
    quotenformat: 'amerikanisch',
    bezugsjahr: 2026,
    bezugsmonat: 9,
    zeitstempel: '2026-09-13T00:00',
    ocrSicherheit: 0.9,
    ...zusatz,
  }
}

function nahe(a, b, genauigkeit = 1e-8) {
  assert.ok(a !== null, 'Wert ist null')
  assert.ok(Math.abs(a - b) < genauigkeit, `erwartet ${b}, bekommen ${a}`)
}

// Die drei echten Karten aus dem Screenshot von BetOnline.
const KARTE_181 = [
  '#396228612 Sep 10, 10:42 PM won',
  'Deebo Samuel',
  'San Francisco 49ers @ Los Angeles Rams',
  'WILL HAVE OVER 2.5 RECEPTIONS',
  'FINAL PLAYER SCORE: 4',
  'Odds: -157        Stake: $ 181        Returns: $ 296.84',
]

const KARTE_300 = [
  '#396228581 Sep 10, 10:41 PM won',
  'Deebo Samuel',
  'San Francisco 49ers @ Los Angeles Rams',
  'WILL HAVE OVER 2.5 RECEPTIONS',
  'FINAL PLAYER SCORE: 4',
  'Odds: -157        Stake: $ 300        Returns: $ 492',
]

test('echte BetOnline Karte wird vollstaendig gelesen', () => {
  const schein = leseSchein(KARTE_181, umgebung())

  assert.equal(schein.scheinNr.wert, '396228612')
  assert.equal(schein.gesetztAm.wert, '2026-09-10T22:42')
  assert.equal(schein.status, 'gewonnen')
  assert.equal(schein.waehrung.wert, 'USD')
  nahe(schein.einsatz.wert, 181)
  nahe(schein.auszahlung.wert, 296.84)
  // Die Dezimalquote kommt aus Einsatz und Auszahlung und ist damit genau.
  nahe(schein.quoteDezimal.wert, 1.64, 1e-10)
  // Die amerikanische Quote bleibt der Wert, der im Bild stand. Sie ist gerundet,
  // aber genau so findet Karam sie beim Buchmacher wieder. Die genaue Umrechnung
  // waere minus 156.25 und steckt in der Dezimalquote.
  nahe(schein.quoteAmerikanisch.wert, -157, 1e-8)
  assert.equal(schein.art, 'einzel')

  // Keine Fehler, hoechstens Hinweise.
  const fehler = schein.hinweise.filter((h) => h.schwere === 'fehler')
  assert.deepEqual(fehler, [], `unerwartete Fehler: ${JSON.stringify(fehler)}`)
})

test('die Auswahl der echten Karte wird richtig zerlegt', () => {
  const schein = leseSchein(KARTE_181, umgebung())
  assert.equal(schein.auswahlen.length, 1)
  const bein = schein.auswahlen[0]
  assert.equal(bein.tipp.wert, 'Deebo Samuel')
  assert.equal(bein.ereignis.wert, 'San Francisco 49ers @ Los Angeles Rams')
  assert.ok(bein.markt.wert.includes('WILL HAVE OVER 2.5 RECEPTIONS'))
  assert.ok(bein.ergebnis.wert.includes('FINAL PLAYER SCORE: 4'))
  nahe(bein.linie.wert, 2.5)
  assert.equal(bein.status, 'gewonnen')
  // Die 2.5 aus dem Markt darf NIEMALS als Quote landen.
  nahe(bein.quoteDezimal.wert, 1.64, 1e-10)
})

test('zweite echte Karte mit glatter Auszahlung', () => {
  const schein = leseSchein(KARTE_300, umgebung())
  assert.equal(schein.scheinNr.wert, '396228581')
  nahe(schein.einsatz.wert, 300)
  nahe(schein.auszahlung.wert, 492)
  nahe(schein.quoteDezimal.wert, 1.64, 1e-10)
  assert.equal(schein.status, 'gewonnen')
})

test('Statusabzeichen auf eigener Zeile wird sicherer erkannt', () => {
  const mitEigenerZeile = [
    '#396228612 Sep 10, 10:42 PM',
    'won',
    'Deebo Samuel',
    'San Francisco 49ers @ Los Angeles Rams',
    'WILL HAVE OVER 2.5 RECEPTIONS',
    'Odds: -157        Stake: $ 181        Returns: $ 296.84',
  ]
  const schein = leseSchein(mitEigenerZeile, umgebung())
  assert.equal(schein.status, 'gewonnen')
  // Das Abzeichen darf nicht als Auswahl auftauchen.
  const texte = schein.auswahlen.map((a) => `${a.tipp.wert} ${a.markt.wert}`).join(' ')
  assert.ok(!texte.toLowerCase().includes('won'))
})

test('die Scheinnummer wird nie als Einsatz gelesen', () => {
  const schein = leseSchein(KARTE_181, umgebung())
  assert.notEqual(schein.einsatz.wert, 396228612)
  nahe(schein.einsatz.wert, 181)
})

test('Bet ID als Beschriftung statt Raute', () => {
  const zeilen = [
    'Bet ID: 887766554  Sep 10, 10:42 PM',
    'won',
    'Team A @ Team B',
    'MONEYLINE',
    'Odds: +150   Risk: $ 100   To Win: $ 150',
  ]
  const schein = leseSchein(zeilen, umgebung())
  assert.equal(schein.scheinNr.wert, '887766554')
  nahe(schein.einsatz.wert, 100)
  // "To Win" ist der reine Gewinn. Die Auszahlung muss 250 sein, nicht 150.
  nahe(schein.auszahlung.wert, 250)
  nahe(schein.quoteDezimal.wert, 2.5)
  assert.ok(schein.hinweise.some((h) => h.code === 'gewinn_zu_auszahlung'))
})

test('deutscher Schein mit Komma als Dezimaltrennzeichen', () => {
  const zeilen = [
    'Wett-ID 12345678',
    '10.09.2026 22:42',
    'Kombiwette (2)',
    'FC Bayern Muenchen - Borussia Dortmund',
    'Ueber 2,5 Tore',
    'Real Madrid - FC Barcelona',
    'Doppelte Chance 1X',
    'Gesamtquote: 3,70',
    'Einsatz: 20,00 EUR',
    'Moegl. Gewinn: 74,00 EUR',
  ]
  const schein = leseSchein(
    zeilen,
    umgebung({ gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' })
  )
  assert.equal(schein.scheinNr.wert, '12345678')
  assert.equal(schein.gesetztAm.wert, '2026-09-10T22:42')
  nahe(schein.einsatz.wert, 20)
  nahe(schein.quoteDezimal.wert, 3.7, 1e-9)
  // 20 mal 3,70 ergibt 74. Die unklare Beschriftung wird als Gesamtauszahlung gedeutet.
  nahe(schein.auszahlung.wert, 74, 1e-8)
  assert.equal(schein.art, 'kombi')
  assert.equal(schein.auswahlen.length, 2)
})

test('deutscher Schein, bei dem Gewinn wirklich den Gewinn meint', () => {
  const zeilen = [
    'Wett-ID 999',
    '10.09.2026 20:00',
    'Team A - Team B',
    'Sieg Heim',
    'Quote: 2,00',
    'Einsatz: 50,00 EUR',
    'Gewinn: 50,00 EUR',
  ]
  const schein = leseSchein(
    zeilen,
    umgebung({ gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' })
  )
  nahe(schein.einsatz.wert, 50)
  nahe(schein.quoteDezimal.wert, 2)
  // 50 mal 2 ergibt 100 Auszahlung. Angezeigt sind 50, das ist der reine Gewinn.
  nahe(schein.auszahlung.wert, 100)
  assert.ok(schein.hinweise.some((h) => h.code === 'gewinn_erkannt'))
})

test('Mehrfachwette mit Quote je Bein', () => {
  const zeilen = [
    '#555111222 Sep 10, 8:00 PM',
    'pending',
    '3 Leg Parlay',
    'Team A',
    'Team A @ Team B',
    'MONEYLINE  -110',
    'Team C',
    'Team C @ Team D',
    'SPREAD -3.5  -110',
    'Team E',
    'Team E @ Team F',
    'MONEYLINE  +120',
    'Odds: +596   Stake: $ 50   Returns: $ 348',
  ]
  const schein = leseSchein(zeilen, umgebung())
  assert.equal(schein.art, 'kombi')
  assert.equal(schein.auswahlen.length, 3)
  assert.equal(schein.status, 'offen')
  nahe(schein.einsatz.wert, 50)
  nahe(schein.auszahlung.wert, 348)
  nahe(schein.quoteDezimal.wert, 6.96, 1e-9)

  // Die Handicap-Linie minus 3.5 darf nicht als Quote gelesen werden.
  const zweites = schein.auswahlen[1]
  nahe(zweites.quoteDezimal.wert, 1 + 100 / 110, 1e-9)
  nahe(zweites.linie.wert, -3.5)
})

test('Etiketten werden mit Wortgrenze erkannt', () => {
  const stellen = findeEtikettstellen('Odds: -157   Stake: $ 181   Returns: $ 296.84')
  const arten = stellen.map((s) => s.art)
  assert.deepEqual(arten, ['quote', 'einsatz', 'auszahlung'])
})

test('kein Etikett innerhalb eines laengeren Wortes', () => {
  // "Winner" enthaelt "win", darf aber kein Auszahlungsetikett ausloesen.
  const stellen = findeEtikettstellen('Winner: Team A')
  assert.equal(stellen.length, 0)
})

test('Scheinnummer aus der Rautenschreibweise', () => {
  const fund = findeScheinnummer(['#396228612 Sep 10, 10:42 PM'])
  assert.equal(fund.wert, '396228612')
  assert.ok(fund.sicherheit > 0.9)
})

test('Status wird nicht aus einer Beschriftung gelesen', () => {
  // "Win:" ist hier eine Beschriftung mit Betrag, kein Statusabzeichen.
  const fund = findeStatus(['Win: $ 250'])
  assert.equal(fund.status, 'unbekannt')
})

test('Begegnungen werden erkannt, Betragszeilen nicht', () => {
  assert.equal(istBegegnung('San Francisco 49ers @ Los Angeles Rams'), true)
  assert.equal(istBegegnung('Team A vs Team B'), true)
  assert.equal(istBegegnung('FC Bayern Muenchen - Borussia Dortmund'), true)
  assert.equal(istBegegnung('Odds: -157 Stake: $ 181'), false)
  assert.equal(istBegegnung('WILL HAVE OVER 2.5 RECEPTIONS'), false)
})

test('Beine werden an der Begegnungszeile geteilt', () => {
  const beine = teileInBeine([
    'Team A',
    'Team A @ Team B',
    'MONEYLINE',
    'Team C',
    'Team C @ Team D',
    'SPREAD -3.5',
  ])
  assert.equal(beine.length, 2)
  assert.equal(beine[0].tipp, 'Team A')
  assert.equal(beine[0].ereignis, 'Team A @ Team B')
  assert.equal(beine[0].markt, 'MONEYLINE')
  assert.equal(beine[1].tipp, 'Team C')
  assert.equal(beine[1].ereignis, 'Team C @ Team D')
  assert.equal(beine[1].markt, 'SPREAD -3.5')
})

test('Quotendeutung erkennt das Format aus dem Wert', () => {
  const us = deuteQuote('-157', 'amerikanisch')
  assert.equal(us.art, 'amerikanisch')
  nahe(us.dezimal, 1 + 100 / 157, 1e-9)

  const dez = deuteQuote('1.85', 'dezimal')
  assert.equal(dez.art, 'dezimal')
  nahe(dez.dezimal, 1.85)

  const bruch = deuteQuote('5/2', 'bruch')
  assert.equal(bruch.art, 'bruch')
  nahe(bruch.dezimal, 3.5)

  // Ohne Vorzeichen und dreistellig: das Profil entscheidet, aber es wird gemeldet.
  const unklar = deuteQuote('157', 'amerikanisch')
  assert.equal(unklar.mehrdeutig, true)
})

test('Linie aus dem Markttext', () => {
  nahe(leseLinie('WILL HAVE OVER 2.5 RECEPTIONS'), 2.5)
  nahe(leseLinie('SPREAD -3.5'), -3.5)
  nahe(leseLinie('Ueber 2,5 Tore'), 2.5)
  assert.equal(leseLinie('MONEYLINE'), null)
})

test('Beinquote nimmt niemals die Linie', () => {
  const ohne = leseBeinQuote(['WILL HAVE OVER 2.5 RECEPTIONS'], 'amerikanisch')
  assert.equal(ohne.dezimal, null)

  const mitAmerikanisch = leseBeinQuote(['MONEYLINE  -110'], 'amerikanisch')
  nahe(mitAmerikanisch.dezimal, 1 + 100 / 110, 1e-9)

  const mitEtikett = leseBeinQuote(['Ueber 2,5 Tore', 'Quote: 1,85'], 'dezimal')
  nahe(mitEtikett.dezimal, 1.85)
})

test('fehlender Einsatz wird als Fehler gemeldet, nicht verschwiegen', () => {
  const schein = leseSchein(['#1 Sep 10, 10:00 PM', 'Team A @ Team B', 'MONEYLINE'], umgebung())
  assert.ok(schein.hinweise.some((h) => h.code === 'einsatz_fehlt' && h.schwere === 'fehler'))
})
