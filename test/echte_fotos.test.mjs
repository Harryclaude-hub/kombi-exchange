import test from 'node:test'
import assert from 'node:assert/strict'

import { leseSchein } from '../kern/parser.js'
import { gruppiere } from '../kern/gruppierung.js'
import { bildeKennung, vergleicheKennung } from '../kern/kennung.js'

/**
 * Karams dreizehn echte Bildschirmfotos vom 14.09.2026: sechsunddreissig
 * Scheine von fuenf Anbietern, ueber 60.000 an Einsatz.
 *
 * WAS DIESE DATEI IST UND WAS NICHT
 *
 * Die Zeilen sind von den Bildern ABGELESEN, nicht von der Texterkennung
 * erzeugt. Sie pruefen also Beschriftungen, Schreibweisen und Anordnung, und
 * zwar so, wie die Texterkennung eine Karte oder eine Tabellenzeile wirklich
 * ausgibt: quer ueber die Spalten hinweg, eine Bildzeile nach der anderen.
 *
 * Genau das war der Unterschied zu test/echte_anbieter.test.mjs. Dort stand
 * die Quote sauber allein auf einer Zeile ("1.854 D"). So sieht ein echtes
 * Bild nie aus. Als die Zeilen hier zum ersten Mal durchliefen, hatten NEUN
 * VON NEUN PS3838-Scheinen gar keine Quote und damit auch keine Auszahlung.
 *
 * Die Texterkennung selbst ist damit weiterhin NICHT geprueft. Dafuer braucht
 * es die Bilddateien in .arbeit/fotos/, siehe test/korpus_echt.mjs.
 *
 * ALLE SOLLWERTE SIND NACHGERECHNET. Wo ein Pruefstein auf dem Schein steht,
 * ist er im Kommentar genannt.
 */

const w = (e, f) => (e[f] && typeof e[f] === 'object' && 'wert' in e[f] ? e[f].wert : e[f])

const PS3838 = { gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' }
const BETWAY = { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
const BET365 = { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
const STAKE = { gebiet: 'en', waehrung: 'UNBEKANNT', quotenformat: 'dezimal' }
const BETONLINE = { gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' }

/**
 * Eine PS3838-Tabellenzeile so, wie die Texterkennung sie quer ueber die
 * Spalten liest. Die Quote steht in der ersten Zeile, ihr Formatbuchstabe D
 * rutscht in die zweite: das ist der Kern des Problems.
 */
const ps = (nr, auswahl, spieler, paarung, quote, einsatz, winloss, stand) => [
  `Sportsbook  ${nr}  ${auswahl}  ${quote}  Risk: ${einsatz}  ${winloss}  0.00  Settled`,
  `Football  ${spieler}  D  (${einsatz})  ${stand}`,
  `2026-09-13 15:57:21  ${paarung}`,
  '2026-09-13 11:35:43  Player Props',
  'Specials',
  'NFL @ 2026-09-13',
]

/** Eine Stake-Karte. Betraege in Krypto mit acht Nachkommastellen. */
const stake = (auswahl, spieler, stand, quote, einsatz, auszahlung) => [
  auswahl,
  stand,
  spieler,
  'Do., 10. Sept. 02:20',
  'Seattle Seahawks 13',
  'New England Patriots 10',
  'Stake',
  `Quoten                    ${quote}`,
  `Einsatz          ${einsatz}`,
  `Auszahlung       ${auszahlung}`,
]

/** Eine BetOnline-Karte. Bei einem verlorenen Schein fehlt Returns ganz. */
const bo = (nr, zeit, stand, spieler, paarung, markt, punkte, quote, einsatz, returns) => [
  `#${nr} ${zeit}`,
  stand,
  spieler,
  paarung,
  markt,
  `FINAL PLAYER SCORE: ${punkte}`,
  returns === null
    ? `Odds: ${quote}  Stake: $ ${einsatz}`
    : `Odds: ${quote}  Stake: $ ${einsatz}  Returns: $ ${returns}`,
]

// ---------------------------------------------------------------------------
// PS3838: eine TABELLE, keine Karten.
//
// Die Spalte Win/Loss ist der GEWINN, nicht die Auszahlung. Damit steht auf
// derselben Zeile ein Pruefstein:
//
//     Einsatz mal (Quote minus eins) = Win/Loss
//     500 mal 0,854 = 427,00
//
// Die Auszahlung selbst steht nirgends und wird gerechnet: 500 mal 1,854.
// ---------------------------------------------------------------------------

const PS_FAELLE = [
  ['3778262388', 'Over 84.5 Rushing Yards', 'Jahmyr Gibbs Total Rushing Yards', 'Detroit Lions-vs-New Orleans Saints',
    '1.826', '2,315.98', '1,913.00', 'WIN', 2315.98, 1.826, 4228.98],
  ['3778262278', 'Over 84.5 Rushing Yards', 'Jahmyr Gibbs Total Rushing Yards', 'Detroit Lions-vs-New Orleans Saints',
    '1.833', '2,583.54', '2,152.09', 'WIN', 2583.54, 1.833, 4735.63],
  ['3778261196', 'Over 84.5 Rushing Yards', 'Jahmyr Gibbs Total Rushing Yards', 'Detroit Lions-vs-New Orleans Saints',
    '1.840', '2,560.00', '2,150.40', 'WIN', 2560, 1.84, 4710.4],
  ['3778259370', 'Over 84.5 Rushing Yards', 'Jahmyr Gibbs Total Rushing Yards', 'Detroit Lions-vs-New Orleans Saints',
    '1.847', '2,540.48', '2,151.79', 'WIN', 2540.48, 1.847, 4692.27],
  ['3777854081', 'Over 226.5 Passing Yards', 'Caleb Williams Total Passing Yards', 'Carolina Panthers-vs-Chicago Bears',
    '1.854', '500.00', '427.00', 'WIN', 500, 1.854, 927],
  ['3777852309', 'Over 226.5 Passing Yards', 'Caleb Williams Total Passing Yards', 'Carolina Panthers-vs-Chicago Bears',
    '1.862', '499.00', '430.14', 'WIN', 499, 1.862, 929.14],
]

test('PS3838: gewonnene Tabellenzeilen, Quote durch die Gewinnspalte belegt', () => {
  for (const [nr, auswahl, spieler, paarung, quote, einsatz, winloss, stand, sEinsatz, sQuote, sAuszahlung] of PS_FAELLE) {
    const e = leseSchein(ps(nr, auswahl, spieler, paarung, quote, einsatz, winloss, stand), PS3838)
    assert.equal(w(e, 'einsatz'), sEinsatz, `${nr} Einsatz`)
    assert.ok(Math.abs(w(e, 'quoteDezimal') - sQuote) < 0.0005, `${nr} Quote: ${w(e, 'quoteDezimal')}`)
    assert.ok(Math.abs(w(e, 'auszahlung') - sAuszahlung) < 0.011, `${nr} Auszahlung: ${w(e, 'auszahlung')}`)
    assert.equal(e.status, 'gewonnen', `${nr} Stand`)
    assert.equal(w(e, 'waehrung'), 'EUR', `${nr} Waehrung`)

    // Die Scheinnummer steht mitten in der Zeile, nicht am Zeilenanfang.
    // Ohne sie sehen zwei getrennt gesetzte Scheine mit gleichem Einsatz aus
    // wie ein einziger, doppelt hochgeladener.
    assert.equal(w(e, 'scheinNr'), nr, `${nr} Scheinnummer`)

    // Der Pruefstein muss auch wirklich gegriffen haben, nicht nur zufaellig
    // dasselbe ergeben. Eine Schutzmassnahme zaehlt erst, wenn sie ausgeloest hat.
    assert.ok(
      e.hinweise.some((h) => h.code === 'quote_durch_gewinn_belegt'),
      `${nr}: die Quote wurde nicht gegengerechnet`
    )
  }
})

const PS_VERLOREN = [
  ['3778381351', '1.847', '2,540.48', '-2,540.48', 2540.48, 1.847, 4692.27],
  ['3778380366', '1.854', '2,518.00', '-2,518.00', 2518, 1.854, 4668.37],
  ['3778379679', '1.833', '1,660.00', '-1,660.00', 1660, 1.833, 3042.78],
]

test('PS3838: verlorene Zeilen, in der Gewinnspalte steht der Einsatz mit Minus', () => {
  for (const [nr, quote, einsatz, winloss, sEinsatz, sQuote, sAuszahlung] of PS_VERLOREN) {
    const e = leseSchein(
      ps(nr, 'Over 230.5 Passing Yards', 'Baker Mayfield Total Passing Yards',
        'Cincinnati Bengals-vs-Tampa Bay Buccaneers', quote, einsatz, winloss, 'LOSE'),
      PS3838
    )
    assert.equal(w(e, 'einsatz'), sEinsatz, `${nr} Einsatz`)
    assert.ok(Math.abs(w(e, 'quoteDezimal') - sQuote) < 0.0005, `${nr} Quote`)
    assert.equal(e.status, 'verloren', `${nr} Stand`)

    // ZWEI VERSCHIEDENE ZAHLEN, und beide werden gebraucht:
    //   auszahlung = was moeglich gewesen waere
    //   ausgezahlt = was wirklich zurueckkam, bei einem verlorenen Schein nichts
    assert.ok(Math.abs(w(e, 'auszahlung') - sAuszahlung) < 0.011, `${nr} moegliche Auszahlung`)
    assert.equal(w(e, 'ausgezahlt'), 0, `${nr}: ein verlorener Schein zahlt nichts aus`)

    // Das Minus darf NICHT als Einsatz oder Auszahlung durchgehen.
    assert.ok(w(e, 'einsatz') > 0, `${nr}: der Einsatz darf nicht negativ werden`)
  }
})

test('PS3838: die 84,5 aus "Over 84.5 Rushing Yards" wird nie zur Quote', () => {
  // Sie liegt im Quotenbereich und steht auf derselben Zeile. Nur weil sie in
  // einer TEXTSPALTE steht und nicht in einer Zahlenspalte, faellt sie heraus.
  const e = leseSchein(
    ps('3778262388', 'Over 84.5 Rushing Yards', 'Jahmyr Gibbs Total Rushing Yards',
      'Detroit Lions-vs-New Orleans Saints', '1.826', '2,315.98', '1,913.00', 'WIN'),
    PS3838
  )
  assert.notEqual(w(e, 'quoteDezimal'), 84.5)
  assert.ok(Math.abs(w(e, 'quoteDezimal') - 1.826) < 0.0005)
})

// ---------------------------------------------------------------------------
// Betway: deutsch, die Quote steht hinter einem At-Zeichen in der Kopfzeile.
// ---------------------------------------------------------------------------

test('Betway: gewonnen, und die gerundete Anzeige darf nicht gewinnen', () => {
  const e = leseSchein(
    [
      'Einzelwette @ 1.74',
      'GEWONNEN',
      'Los Angeles Rams - San Francisco 49ers',
      '7 Los Angeles Rams',
      '27 San Francisco 49ers',
      'Deebo Samuel Sr. (SF) Über 2.5: Erfolgreiche Annahmen gesamt',
      'Umsetzen          DU HAST GEWONNEN',
      '€78,30            €136,30',
      'Wettdetails',
    ],
    BETWAY
  )
  assert.equal(w(e, 'einsatz'), 78.3)
  assert.equal(w(e, 'auszahlung'), 136.3)
  assert.equal(e.status, 'gewonnen')

  // Auf dem Schein steht 1.74. Der Pruefstein sagt etwas anderes:
  // 136,30 geteilt durch 78,30 sind 1,7407. Der Buchmacher rundet die Anzeige,
  // das Programm rechnet den genauen Multiplikator zurueck. Genau dieser Wert
  // zaehlt, wenn sechzig Scheine aufaddiert werden.
  assert.ok(
    Math.abs(w(e, 'quoteDezimal') - 1.740740740740741) < 0.0001,
    `Quote ${w(e, 'quoteDezimal')}, erwartet 1,7407`
  )
})

test('Betway: annulliert, der Einsatz kommt unveraendert zurueck', () => {
  const e = leseSchein(
    [
      'Einzelwette @ 1.87',
      'UNGÜLTIG',
      'Seattle Seahawks - New England Patriots',
      '13 Seattle Seahawks',
      '10 New England Patriots',
      'Elijah Arroyo (SEA) Über 8.5: Gesamtanzahl Receiving Yards',
      'Umsetzen          Erstattet',
      '€287,50           €287,50',
      'Wettdetails',
    ],
    BETWAY
  )
  assert.equal(w(e, 'einsatz'), 287.5)
  assert.equal(w(e, 'ausgezahlt'), 287.5)
  assert.equal(e.status, 'storniert')

  // Hier gibt es keinen Pruefstein: 287,50 zurueck aus 287,50 Einsatz ergibt
  // den Faktor 1 und sagt ueber die Quote nichts. Sie kommt aus der Kopfzeile.
  assert.ok(Math.abs(w(e, 'quoteDezimal') - 1.87) < 0.0005, `Quote ${w(e, 'quoteDezimal')}`)
})

test('Betway: das At-Zeichen zwischen zwei Mannschaften ist keine Quote', () => {
  // "San Francisco 49ers @ Los Angeles Rams" und "NFL @ 2026-09-13" stehen auf
  // denselben Scheinen. Haette die Regel nur nach "@" gesucht, waere aus einem
  // Datum eine Quote geworden.
  const e = leseSchein(
    [
      'San Francisco 49ers @ Los Angeles Rams',
      'NFL @ 2026-09-13',
      'Umsetzen          DU HAST GEWONNEN',
      '€100,00           €250,00',
    ],
    BETWAY
  )
  assert.ok(w(e, 'quoteDezimal') === null || Math.abs(w(e, 'quoteDezimal') - 2.5) < 0.0005,
    `aus einem Datum darf keine Quote werden, wurde: ${w(e, 'quoteDezimal')}`)
  assert.notEqual(w(e, 'quoteDezimal'), 2026)
})

// ---------------------------------------------------------------------------
// bet365: deutsch, dunkel. "Gewinn" ist die Auszahlung MIT Einsatz.
// 250 mal 1,80 sind 450, und 450 steht unter "Gewinn". Im Englischen waere
// "win" der reine Gewinn. Das Wort entscheidet nicht, die Rechnung entscheidet.
// ---------------------------------------------------------------------------

const B365 = [
  ['Nahshon Wright - Weniger als 2.5   1.80', 'Tackles Ü/U', '€250,00', '€450,00', 250, 1.8, 450],
  ['Nahshon Wright - Weniger als 3.5   1.73', 'Tackles und Assists Ü/U', '€273,97', '€473,97', 273.97, 1.73, 473.97],
  ['Nahshon Wright (NY Jets) - Weniger als 3.5   2.15', 'Tackles und Assists Ü/U', '€224,00', '€481,60', 224, 2.15, 481.6],
  ['Nahshon Wright (NY Jets) - Weniger als 3.5   2.30', 'Tackles und Assists Ü/U', '€961,54', '€2.211,55', 961.54, 2.3, 2211.55],
  ['Nahshon Wright - Weniger als 1.5   1.47', 'Assists Ü/U', '€425,53', '€625,53', 425.53, 1.47, 625.53],
]

test('bet365: "Gewinn" ist die Auszahlung mit Einsatz, auch mit Tausenderpunkt', () => {
  for (const [auswahl, markt, einsatz, gewinn, sEinsatz, sQuote, sAuszahlung] of B365) {
    const e = leseSchein(
      [
        `${einsatz}  Einzelwetten`,
        'GEWONNEN',
        auswahl,
        markt,
        'NY Jets 23',
        'TEN Titans 10',
        'Einsatz:          Gewinn:',
        `${einsatz}           ${gewinn}`,
      ],
      BET365
    )
    assert.equal(w(e, 'einsatz'), sEinsatz, `${auswahl} Einsatz`)
    assert.ok(Math.abs(w(e, 'auszahlung') - sAuszahlung) < 0.011, `${auswahl} Auszahlung: ${w(e, 'auszahlung')}`)
    assert.ok(Math.abs(w(e, 'quoteDezimal') - sQuote) < 0.005, `${auswahl} Quote: ${w(e, 'quoteDezimal')}`)
    assert.equal(e.status, 'gewonnen', `${auswahl} Stand`)

    // Der deutsche Tausenderpunkt in "€2.211,55" darf nicht zu 2,21155 werden
    // und auch nicht zu 221155.
    assert.ok(w(e, 'auszahlung') > sEinsatz, `${auswahl}: die Auszahlung muss ueber dem Einsatz liegen`)
  }
})

// ---------------------------------------------------------------------------
// Stake: Krypto mit acht Nachkommastellen, in der Anzeige abgeschnitten.
// Quote deutsch geschrieben (1,90), Betrag englisch (2,000.00), im selben Bild.
// ---------------------------------------------------------------------------

const STAKE_VERLOREN = [
  ['2,000.000000...', 2000, '1,90', 1.9, 3800],
  ['5,000.000000...', 5000, '1,90', 1.9, 9500],
  ['3,000.000000...', 3000, '1,90', 1.9, 5700],
  ['1,000.000000...', 1000, '1,90', 1.9, 1900],
  ['700.00000000', 700, '1,83', 1.83, 1281],
]

test('Stake: verlorene Scheine, abgeschnittene Betraege', () => {
  for (const [roh, sEinsatz, quote, sQuote, sAuszahlung] of STAKE_VERLOREN) {
    const e = leseSchein(
      stake('Über 8.5 Receiving Yards', 'Elijah Arroyo', 'Verlust', quote, roh, '0.00000000'),
      STAKE
    )
    // Der Faktor eine Million: "5,000.000000..." wurde einmal zu 5.000.000.000.
    assert.equal(w(e, 'einsatz'), sEinsatz, `"${roh}"`)
    assert.ok(Math.abs(w(e, 'quoteDezimal') - sQuote) < 0.0005, `Quote bei "${roh}"`)
    assert.ok(Math.abs(w(e, 'auszahlung') - sAuszahlung) < 0.011, `moegliche Auszahlung bei "${roh}"`)
    assert.equal(w(e, 'ausgezahlt'), 0, `zurueck kam nichts bei "${roh}"`)
    assert.equal(e.status, 'verloren')

    // Die Null in der Auszahlungsspalte darf nie zu einer Quote 0 werden.
    assert.notEqual(w(e, 'quoteDezimal'), 0)
  }
})

const STAKE_GEWONNEN = [
  // Einsatz, Auszahlung, angezeigte Quote, echter Multiplikator
  ['5,100.000000...', 5100, '5,151.000000...', 5151, '1,01', 1.01],
  ['2,165.000000...', 2165, '3,660.804995...', 3660.804995, '1,69', 1.690902],
  ['5,000.000000...', 5000, '8,454.515000...', 8454.515, '1,69', 1.690903],
  ['5,000.000000...', 5000, '9,175.995500...', 9175.9955, '1,84', 1.8351991],
  ['500.00000000', 500, '920.81035000', 920.81035, '1,84', 1.8416207],
  // Hier wird die Rundung auf den Cent sichtbar: auf dem Schein steht ein
  // Einsatz von 5.801,0025, das Programm legt 5.801,00 ab. Ein Viertelcent.
  // Ueber sechzig Scheine summiert sich das auf hoechstens dreissig Cent.
  // OFFENE FRAGE AN KARAM, siehe UEBERGABE.md: die Rundung haengt an Excel und
  // an der Summenpruefung und wurde deshalb nicht eigenmaechtig geaendert.
  ['5,801.002500...', 5801, '10,587.70319...', 10587.70319, '1,83', 1.8251506],
]

test('Stake: gewonnene Scheine, der echte Multiplikator statt der Anzeige', () => {
  for (const [rohEin, sEinsatz, rohAus, sAuszahlung, angezeigt, sQuote] of STAKE_GEWONNEN) {
    const e = leseSchein(
      stake('Über 82.5 Rushing Yards', 'Jahmyr Gibbs', 'Gewonnen', angezeigt, rohEin, rohAus),
      STAKE
    )
    assert.equal(w(e, 'einsatz'), sEinsatz, `Einsatz "${rohEin}"`)
    assert.ok(Math.abs(w(e, 'auszahlung') - sAuszahlung) < 0.011, `Auszahlung "${rohAus}": ${w(e, 'auszahlung')}`)
    assert.equal(e.status, 'gewonnen')

    // Angezeigt 1,84, wahr 1,8351991. Bei 5000 Einsatz waeren 5000 mal 1,84
    // gleich 9200, ausgezahlt wurden 9175,9955: vierundzwanzig daneben, und
    // das auf EINEM Schein.
    assert.ok(
      Math.abs(w(e, 'quoteDezimal') - sQuote) < 0.0001,
      `Multiplikator bei ${sEinsatz}: ${w(e, 'quoteDezimal')}, erwartet ${sQuote}`
    )
  }
})

test('Stake: zweimal dieselbe Wette, verschiedene Einsaetze, gleicher Multiplikator', () => {
  // 2165 und 5000 auf dieselbe Auswahl. Wenn das Programm richtig rechnet,
  // muss derselbe Multiplikator herauskommen, obwohl beide Scheine voellig
  // andere Zahlen tragen. Das ist die Gegenrechnung ueber zwei Scheine hinweg.
  const a = leseSchein(stake('Über 2.5 Annahmen', 'Deebo Samuel Sr.', 'Gewonnen', '1,69', '2,165.000000...', '3,660.804995...'), STAKE)
  const b = leseSchein(stake('Über 2.5 Annahmen', 'Deebo Samuel Sr.', 'Gewonnen', '1,69', '5,000.000000...', '8,454.515000...'), STAKE)
  assert.ok(
    Math.abs(w(a, 'quoteDezimal') - w(b, 'quoteDezimal')) < 0.00001,
    `${w(a, 'quoteDezimal')} gegen ${w(b, 'quoteDezimal')}`
  )
})

// ---------------------------------------------------------------------------
// BetOnline: amerikanische Quoten, und die Anzeige ist GERUNDET.
//
// Das ist der teuerste Fallstrick im ganzen Satz. Wer die angezeigte Quote
// umrechnet, liegt bei jedem Schein daneben:
//
//     -157 ergibt umgerechnet 1,63694, die Auszahlung verlangt aber 1,64
//     -121 ergibt umgerechnet 1,82645, die Auszahlung verlangt aber 1,83
//
// Wo Returns dasteht, ist Einsatz mal X gleich Returns der Pruefstein, und
// dann darf die Automatik entscheiden. Wo Returns fehlt, bleibt die Anzeige.
// ---------------------------------------------------------------------------

const BO_GEWONNEN = [
  ['396376584', 'Sep 13, 1:28 PM', 'Caleb Williams', 'Chicago Bears @ Carolina Panthers',
    'WILL HAVE OVER 229.5 PASSING YARDS', '268', '-115', '300', '561', 300, 561, 1.87],
  ['396228612', 'Sep 10, 10:42 PM', 'Deebo Samuel', 'San Francisco 49ers @ Los Angeles Rams',
    'WILL HAVE OVER 2.5 RECEPTIONS', '4', '-157', '181', '296.84', 181, 296.84, 1.64],
  ['396228581', 'Sep 10, 10:41 PM', 'Deebo Samuel', 'San Francisco 49ers @ Los Angeles Rams',
    'WILL HAVE OVER 2.5 RECEPTIONS', '4', '-157', '300', '492', 300, 492, 1.64],
  ['396228545', 'Sep 10, 10:41 PM', 'Deebo Samuel', 'San Francisco 49ers @ Los Angeles Rams',
    'WILL HAVE OVER 2.5 RECEPTIONS', '4', '-157', '300', '492', 300, 492, 1.64],
  ['396376613', 'Sep 13, 1:29 PM', 'Caleb Williams', 'Chicago Bears @ Carolina Panthers',
    'WILL HAVE OVER 229.5 PASSING YARDS', '268', '-115', '274', '512.38', 274, 512.38, 1.87],
]

test('BetOnline: der Pruefstein schlaegt die gerundete amerikanische Anzeige', () => {
  for (const [nr, zeit, spieler, paarung, markt, punkte, quote, einsatz, returns, sEinsatz, sAuszahlung, sQuote] of BO_GEWONNEN) {
    const e = leseSchein(bo(nr, zeit, 'won', spieler, paarung, markt, punkte, quote, einsatz, returns), BETONLINE)
    assert.equal(w(e, 'einsatz'), sEinsatz, `${nr} Einsatz`)
    assert.equal(w(e, 'auszahlung'), sAuszahlung, `${nr} Auszahlung`)
    assert.equal(e.status, 'gewonnen', `${nr} Stand`)
    assert.equal(w(e, 'waehrung'), 'USD', `${nr} Waehrung`)
    assert.equal(w(e, 'scheinNr'), nr, `${nr} Scheinnummer`)
    assert.ok(
      Math.abs(w(e, 'quoteDezimal') - sQuote) < 0.0005,
      `${nr} Multiplikator: ${w(e, 'quoteDezimal')}, erwartet ${sQuote} aus ${sAuszahlung} geteilt durch ${sEinsatz}`
    )
  }
})

test('BetOnline: zwei getrennte Scheine mit identischen Zahlen bleiben zwei', () => {
  // 396228581 und 396228545: gleicher Spieler, gleicher Markt, gleiche 300
  // Dollar, gleiche -157. Nur die Scheinnummer unterscheidet sie. Wuerden sie
  // zusammengefasst, fehlten 300 Dollar Einsatz und 492 Dollar Auszahlung.
  const a = leseSchein(bo('396228581', 'Sep 10, 10:41 PM', 'won', 'Deebo Samuel',
    'San Francisco 49ers @ Los Angeles Rams', 'WILL HAVE OVER 2.5 RECEPTIONS', '4', '-157', '300', '492'), BETONLINE)
  const b = leseSchein(bo('396228545', 'Sep 10, 10:41 PM', 'won', 'Deebo Samuel',
    'San Francisco 49ers @ Los Angeles Rams', 'WILL HAVE OVER 2.5 RECEPTIONS', '4', '-157', '300', '492'), BETONLINE)
  assert.notEqual(w(a, 'scheinNr'), w(b, 'scheinNr'))
  assert.equal(w(a, 'scheinNr'), '396228581')
  assert.equal(w(b, 'scheinNr'), '396228545')
})

test('BetOnline: verloren, und es gibt gar keine Returns-Spalte', () => {
  for (const [nr, einsatz, sEinsatz] of [['396418815', '268', 268], ['396418628', '300', 300]]) {
    const e = leseSchein(
      bo(nr, 'Sep 13, 6:39 PM', 'lost', 'Baker Mayfield', 'Tampa Bay Buccaneers @ Cincinnati Bengals',
        'WILL HAVE OVER 231.5 PASSING YARDS', '216', '-114', einsatz, null),
      BETONLINE
    )
    assert.equal(w(e, 'einsatz'), sEinsatz, `${nr} Einsatz`)
    assert.equal(e.status, 'verloren', `${nr} Stand`)
    assert.equal(w(e, 'ausgezahlt'), 0, `${nr}: ein verlorener Schein zahlt nichts aus`)

    // Ohne Returns gibt es keinen Pruefstein. Die 216 aus
    // "FINAL PLAYER SCORE: 216" darf auf keinen Fall eine Auszahlung werden.
    assert.notEqual(w(e, 'auszahlung'), 216, `${nr}: der Spielstand ist keine Auszahlung`)
    assert.notEqual(w(e, 'ausgezahlt'), 216, `${nr}: der Spielstand ist kein Rueckfluss`)
  }
})

test('BetOnline: ein Einsatz von zwei Dollar wird nicht anders behandelt', () => {
  const e = leseSchein(
    [
      '#381217420 Feb 8, 11:37 PM',
      'won',
      'LONGEST RUSH - KENNETH WALKER III - OVER 14.5 (SEA @ NE)',
      'Odds: -121  Stake: $ 2  Returns: $ 3.66',
    ],
    BETONLINE
  )
  assert.equal(w(e, 'einsatz'), 2)
  assert.equal(w(e, 'auszahlung'), 3.66)
  // -121 umgerechnet waeren 1,82645 und damit 3,65. Der Schein sagt 3,66.
  assert.ok(Math.abs(w(e, 'quoteDezimal') - 1.83) < 0.0005, `Multiplikator ${w(e, 'quoteDezimal')}`)
})

// ---------------------------------------------------------------------------
// Die Summe ueber alle sechsunddreissig Scheine.
//
// Das ist die Zahl, die Karam am Ende sehen will. Sie wird hier gegen von Hand
// nachgerechnete Werte geprueft, damit ein Fehler im Leseprogramm nicht
// unbemerkt in die Summe wandert.
//
// Umgerechnet wird NICHT. Euro, Dollar und Krypto bleiben getrennt.
// ---------------------------------------------------------------------------

test('Summe je Anbieter, von Hand nachgerechnet', () => {
  const summe = (scheine) => scheine.reduce((s, e) => s + (w(e, 'einsatz') ?? 0), 0)

  const ps3838 = [...PS_FAELLE.map((f) => leseSchein(ps(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7]), PS3838)),
    ...PS_VERLOREN.map((f) => leseSchein(ps(f[0], 'Over 230.5 Passing Yards', 'Baker Mayfield Total Passing Yards',
      'Cincinnati Bengals-vs-Tampa Bay Buccaneers', f[1], f[2], f[3], 'LOSE'), PS3838))]
  // 2315,98 + 2583,54 + 2560 + 2540,48 + 500 + 499 + 2540,48 + 2518 + 1660
  assert.ok(Math.abs(summe(ps3838) - 17717.48) < 0.011, `PS3838: ${summe(ps3838)}`)

  const bet365 = B365.map(([auswahl, markt, einsatz, gewinn]) =>
    leseSchein([`${einsatz}  Einzelwetten`, 'GEWONNEN', auswahl, markt, 'NY Jets 23', 'TEN Titans 10',
      'Einsatz:          Gewinn:', `${einsatz}           ${gewinn}`], BET365))
  // 250 + 273,97 + 224 + 961,54 + 425,53
  assert.ok(Math.abs(summe(bet365) - 2135.04) < 0.011, `bet365: ${summe(bet365)}`)

  const betonline = [
    ...BO_GEWONNEN.map((f) => leseSchein(bo(f[0], f[1], 'won', f[2], f[3], f[4], f[5], f[6], f[7], f[8]), BETONLINE)),
    leseSchein(bo('396418815', 'Sep 13, 6:39 PM', 'lost', 'Baker Mayfield', 'Tampa Bay Buccaneers @ Cincinnati Bengals',
      'WILL HAVE OVER 231.5 PASSING YARDS', '216', '-114', '268', null), BETONLINE),
    leseSchein(bo('396418628', 'Sep 13, 6:39 PM', 'lost', 'Baker Mayfield', 'Tampa Bay Buccaneers @ Cincinnati Bengals',
      'WILL HAVE OVER 231.5 PASSING YARDS', '216', '-114', '300', null), BETONLINE),
  ]
  // 300 + 181 + 300 + 300 + 274 + 268 + 300
  assert.ok(Math.abs(summe(betonline) - 1923) < 0.011, `BetOnline: ${summe(betonline)}`)

  const stakeScheine = [
    ...STAKE_VERLOREN.map((f) => leseSchein(stake('Über 8.5 Receiving Yards', 'Elijah Arroyo', 'Verlust', f[2], f[0], '0.00000000'), STAKE)),
    ...STAKE_GEWONNEN.map((f) => leseSchein(stake('Über 82.5 Rushing Yards', 'Jahmyr Gibbs', 'Gewonnen', f[4], f[0], f[2]), STAKE)),
  ]
  // 2000 + 5000 + 3000 + 1000 + 700 + 5100 + 2165 + 5000 + 5000 + 500 + 5801,0025
  assert.ok(Math.abs(summe(stakeScheine) - 35266.0025) < 0.011, `Stake: ${summe(stakeScheine)}`)
})

// ---------------------------------------------------------------------------
// Der Riesenschein: welche Scheine gehoeren zusammen, und welche NICHT.
//
// Der teuerste Fund des 14.09.2026. In einer TABELLE steht die Wette in
// derselben Bildzeile wie das Geld. Diese Zeile wird wegen "Risk:" ganz als
// Beschriftungszeile verbraucht, und die Zeile mit dem Spielernamen ebenfalls.
// Uebrig blieben nur Zeitstempel und die Worte "Player Props" und "Specials",
// und die stehen auf JEDER PS3838-Zeile.
//
// Damit trug jeder PS3838-Schein genau dieselbe Wettkennung, Uebereinstimmung
// 1,0. Vier Gibbs-Scheine (Over 84.5 Rushing Yards, Detroit gegen New Orleans)
// landeten mit zwei Williams-Scheinen (Over 226.5 Passing Yards, Carolina
// gegen Chicago) in EINER Gruppe: anderer Spieler, anderes Spiel, andere
// Linie, ein sinnloser Multiplikator ueber 9.000 Euro Einsatz.
// ---------------------------------------------------------------------------

const alsSchein = (zeilen, umgebung, id, minute) => {
  const e = leseSchein(zeilen, { ...umgebung, id, projektId: 'p', bildId: `b${id}` })
  e.angelegtAm = new Date(2026, 8, 14, 12, minute).toISOString()
  return e
}

test('Riesenschein: zwei verschiedene Wetten in einer Tabelle bleiben getrennt', () => {
  const gibbs = ps('3778262388', 'Over 84.5 Rushing Yards', 'Jahmyr Gibbs Total Rushing Yards',
    'Detroit Lions-vs-New Orleans Saints', '1.826', '2,315.98', '1,913.00', 'WIN')
  const williams = ps('3777854081', 'Over 226.5 Passing Yards', 'Caleb Williams Total Passing Yards',
    'Carolina Panthers-vs-Chicago Bears', '1.854', '500.00', '427.00', 'WIN')

  const a = alsSchein(gibbs, PS3838, 'a', 1)
  const b = alsSchein(williams, PS3838, 'b', 2)

  // Die Linie ist das staerkste Merkmal und muss ueberhaupt erst ankommen.
  const ka = bildeKennung(a.auswahlen[0])
  const kb = bildeKennung(b.auswahlen[0])
  assert.equal(ka.linie, 84.5, 'die Linie des Gibbs-Scheins')
  assert.equal(kb.linie, 226.5, 'die Linie des Williams-Scheins')

  const v = vergleicheKennung(ka, kb)
  assert.equal(v.linieGleich, false, 'verschiedene Linien duerfen nicht als gleich gelten')
  assert.ok(v.punkte < 1, `Uebereinstimmung ${v.punkte}, vorher war sie 1,0`)

  const g = gruppiere([a, b])
  assert.equal(g.gruppen.length, 2, 'zwei verschiedene Wetten sind zwei Riesenscheine')
})

test('Riesenschein: derselbe Schein mehrfach gesetzt gehoert in EINE Gruppe', () => {
  // Vier Gibbs-Zeilen, dieselbe Wette, vier verschiedene Einsaetze. Genau der
  // Fall, fuer den Karam das Programm baut.
  const scheine = PS_FAELLE.slice(0, 4).map((f, i) =>
    alsSchein(ps(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7]), PS3838, `g${i}`, i)
  )
  const g = gruppiere(scheine)
  assert.equal(g.gruppen.length, 1, 'vier gleiche Wetten sind ein Riesenschein')
  assert.equal(g.gruppen[0].scheinIds.length, 4)

  // Und die Summe ueber die Gruppe: 2315,98 + 2583,54 + 2560 + 2540,48
  const einsatz = scheine.reduce((s, e) => s + (w(e, 'einsatz') ?? 0), 0)
  assert.ok(Math.abs(einsatz - 10000) < 0.011, `Einsatz der Gruppe: ${einsatz}`)
})

test('Riesenschein: die drei Mayfield-Verlierer bleiben unter sich', () => {
  // Sie haben dieselbe Linie und denselben Spieler wie die Gewinner-Zeilen
  // NICHT. Wuerden sie mit Gibbs oder Williams verschmelzen, waere der
  // Riesenschein zugleich gewonnen und verloren.
  const alle = [
    ...PS_FAELLE.slice(0, 4).map((f, i) => alsSchein(ps(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7]), PS3838, `w${i}`, i)),
    ...PS_VERLOREN.map((f, i) =>
      alsSchein(ps(f[0], 'Over 230.5 Passing Yards', 'Baker Mayfield Total Passing Yards',
        'Cincinnati Bengals-vs-Tampa Bay Buccaneers', f[1], f[2], f[3], 'LOSE'), PS3838, `v${i}`, 10 + i)
    ),
  ]
  const g = gruppiere(alle)
  assert.equal(g.gruppen.length, 2, 'Gibbs gewonnen und Mayfield verloren sind zwei Gruppen')
  for (const gr of g.gruppen) {
    const teil = gr.scheinIds.map((id) => alle.find((s) => s.id === id))
    const staende = new Set(teil.map((s) => s.status))
    assert.equal(staende.size, 1, `eine Gruppe darf nicht zugleich gewonnen und verloren sein: ${[...staende]}`)
  }
})

// ---------------------------------------------------------------------------
// Die Wortgrenze vor einem Umlaut.
//
// \b ist in JavaScript rein englisch. Vor einem grossen U-Umlaut steht deshalb
// NIE eine Wortgrenze: links ein Leerzeichen, rechts ein Buchstabe, den die
// englische Regel nicht als Buchstaben kennt. Beide Seiten gelten als
// Nichtwortzeichen, und die Grenze faellt aus.
//
// Folge: /\bueber\b/ mit Umlaut hat nie getroffen. Jeder deutsche Schein verlor
// Marktart UND Linie, also genau die zwei Merkmale, die ueber die Zuordnung zum
// Riesenschein entscheiden. Der Fehler war unsichtbar, weil englische Scheine
// sauber durchliefen.
// ---------------------------------------------------------------------------

test('Wortgrenze: die Linie wird auch hinter einem Umlaut gefunden', () => {
  const faelle = [
    // Stake: die Wettart steht in der Kopfzeile der Karte, also im Tipp.
    [stake('Über 2.5 Annahmen', 'Deebo Samuel Sr.', 'Gewonnen', '1,69', '2,165.000000...', '3,660.804995...'), STAKE, 2.5],
    [stake('Über 8.5 Receiving Yards', 'Elijah Arroyo', 'Verlust', '1,90', '2,000.000000...', '0.00000000'), STAKE, 8.5],
    [stake('Über 82.5 Rushing Yards', 'Jahmyr Gibbs', 'Gewonnen', '1,84', '500.00000000', '920.81035000'), STAKE, 82.5],
    // Betway: mitten in einem langen Satz, mit Doppelpunkt hinter der Zahl.
    [[
      'Einzelwette @ 1.74',
      'GEWONNEN',
      'Los Angeles Rams - San Francisco 49ers',
      'Deebo Samuel Sr. (SF) Über 2.5: Erfolgreiche Annahmen gesamt',
      'Umsetzen          DU HAST GEWONNEN',
      '€78,30            €136,30',
    ], BETWAY, 2.5],
  ]

  for (const [zeilen, umgebung, sollLinie] of faelle) {
    const e = leseSchein(zeilen, umgebung)
    const k = bildeKennung(e.auswahlen[0])
    assert.equal(k.linie, sollLinie, `Linie aus ${JSON.stringify(zeilen[0])}`)
    assert.equal(k.marktart, 'ueber', `Marktart aus ${JSON.stringify(zeilen[0])}`)
  }
})

test('Wortgrenze: englische Scheine bleiben unveraendert', () => {
  // Sie liefen vorher schon richtig. Die Umstellung auf \p{L} darf daran
  // nichts aendern, sonst waere die Reparatur teurer als der Fehler.
  const e = leseSchein(bo('396228612', 'Sep 10, 10:42 PM', 'won', 'Deebo Samuel',
    'San Francisco 49ers @ Los Angeles Rams', 'WILL HAVE OVER 2.5 RECEPTIONS', '4', '-157', '181', '296.84'), BETONLINE)
  const k = bildeKennung(e.auswahlen[0])
  assert.equal(k.linie, 2.5)
  assert.equal(k.marktart, 'ueber')
})

test('Wortgrenze: derselbe Schein bei drei Anbietern nennt dieselbe Linie', () => {
  // Deebo Samuel, mehr als 2.5 Annahmen, bei BetOnline, Stake und Betway.
  // Drei Sprachen, drei Aufbauten, eine Wette. Linie und Marktart sind das,
  // was sich ueber alle drei hinweg vergleichen laesst.
  const betonline = leseSchein(bo('396228612', 'Sep 10, 10:42 PM', 'won', 'Deebo Samuel',
    'San Francisco 49ers @ Los Angeles Rams', 'WILL HAVE OVER 2.5 RECEPTIONS', '4', '-157', '181', '296.84'), BETONLINE)
  const stakeSchein = leseSchein([
    'Über 2.5 Annahmen', 'Gewonnen', 'Deebo Samuel Sr.', 'Fr., 11. Sept. 02:35',
    'Los Angeles Rams 7', 'San Francisco 49ers 27', 'Stake',
    'Quoten                    1,69', 'Einsatz          2,165.000000...', 'Auszahlung       3,660.804995...',
  ], STAKE)
  const betwaySchein = leseSchein([
    'Einzelwette @ 1.74', 'GEWONNEN', 'Los Angeles Rams - San Francisco 49ers',
    '7 Los Angeles Rams', '27 San Francisco 49ers',
    'Deebo Samuel Sr. (SF) Über 2.5: Erfolgreiche Annahmen gesamt',
    'Umsetzen          DU HAST GEWONNEN', '€78,30            €136,30',
  ], BETWAY)

  for (const [name, e] of [['BetOnline', betonline], ['Stake', stakeSchein], ['Betway', betwaySchein]]) {
    const k = bildeKennung(e.auswahlen[0])
    assert.equal(k.linie, 2.5, `${name}: Linie`)
    assert.equal(k.marktart, 'ueber', `${name}: Marktart`)
  }

  // OFFEN, siehe UEBERGABE.md: das reicht noch NICHT, um die drei zu einem
  // Riesenschein zusammenzufassen. Die Uebereinstimmung liegt bei 0,20 bis
  // 0,46, die Schwelle bei 0,60. Es fehlen die uebersetzten Marktbegriffe
  // ("receptions" gegen "Annahmen") und die Paarung bei Stake. Der Test haelt
  // den Stand fest: nicht zusammenfassen ist SICHER, falsch zusammenfassen
  // waere es nicht.
  const v = vergleicheKennung(bildeKennung(betonline.auswahlen[0]), bildeKennung(betwaySchein.auswahlen[0]))
  assert.equal(v.linieGleich, true)
  assert.equal(v.marktartGleich, true)
})
