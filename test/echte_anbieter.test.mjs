import test from 'node:test'
import assert from 'node:assert/strict'

import { leseZahl } from '../kern/zahlen.js'
import { leseSchein } from '../kern/parser.js'

/**
 * Die fuenf Anbieter, von denen Karam am 13.09.2026 echte Bildschirmfotos
 * geschickt hat: BetOnline, PS3838, Betway, bet365 und Stake.
 *
 * WAS DIESE DATEI IST UND WAS NICHT
 *
 * Die Zeilen hier sind vom Bild ABGELESEN, nicht von der Texterkennung
 * erzeugt. Sie pruefen also die Beschriftungen, die Schreibweisen und die
 * Anordnung, nicht die Texterkennung selbst. Der Korpus fuer die
 * Texterkennung entsteht getrennt in werkzeug/training/ aus den Bilddateien,
 * siehe test/korpus_echt.mjs.
 *
 * Beides wird gebraucht. Diese Faelle laufen sofort und fangen die Fehler, die
 * schon vor der Texterkennung entstehen.
 *
 * DIE SOLLWERTE SIND NACHGERECHNET, nicht geraten. Wo Einsatz mal Quote gleich
 * Auszahlung aufgeht, steht es im Kommentar.
 */

const w = (e, f) => (e[f] && typeof e[f] === 'object' && 'wert' in e[f] ? e[f].wert : e[f])

// ---------------------------------------------------------------------------
// Der gefaehrlichste Fall im ganzen Satz: abgeschnittene Betraege bei Stake
//
// Stake zeigt Kryptobetraege mit acht Nachkommastellen und schneidet sie in
// der Anzeige ab: "5,000.000000...". Die drei Punkte wurden als Trennzeichen
// gelesen und die Ziffern zusammengeschoben: aus 5.000 wurden 5.000.000.000.
// Faktor eine Million, und zwar OHNE jede Warnung.
//
// Bei Karams Einsaetzen ist das der Unterschied zwischen fuenftausend Euro und
// dem Bruttoinlandsprodukt.
// ---------------------------------------------------------------------------

test('abgeschnittene Betraege: die Punkte am Ende sind keine Ziffern', () => {
  for (const [text, soll] of [
    ['5,000.000000...', 5000],
    ['2,000.000000...', 2000],
    ['9,175.995500...', 9175.9955],
    ['10,587.70319...', 10587.70319],
    ['5,801.002500...', 5801.0025],
  ]) {
    assert.equal(leseZahl(text, { gebiet: 'en' }).wert, soll, `"${text}"`)
  }
})

test('auch mit dem echten Auslassungszeichen', () => {
  assert.equal(leseZahl('5,000.000000…', { gebiet: 'en' }).wert, 5000)
  assert.equal(leseZahl('2.165,000000…', { gebiet: 'de' }).wert, 2165)
})

test('ein Betrag ohne Abschneiden bleibt unveraendert', () => {
  assert.equal(leseZahl('500.00000000', { gebiet: 'en' }).wert, 500)
  assert.equal(leseZahl('920.81035000', { gebiet: 'en' }).wert, 920.81035)
  assert.equal(leseZahl('0.00000000', { gebiet: 'en' }).wert, 0)
})

// ---------------------------------------------------------------------------
// Stake: deutsche Quote, englischer Betrag, im selben Schein
// ---------------------------------------------------------------------------

const STAKE = { gebiet: 'en', waehrung: 'UNBEKANNT', quotenformat: 'dezimal' }

test('Stake, verlorener Schein', () => {
  const e = leseSchein(
    [
      'Über 8.5 Receiving Yards',
      'Verlust',
      'Elijah Arroyo',
      'Do., 10. Sept. 02:20',
      'Seattle Seahawks 13',
      'New England Patriots 10',
      'Quoten                    1,90',
      'Einsatz          2,000.000000...',
      'Auszahlung       0.00000000',
    ],
    STAKE
  )
  assert.equal(w(e, 'einsatz'), 2000, 'Einsatz')
  assert.equal(w(e, 'quoteDezimal'), 1.9, '"Quoten" ist die Beschriftung fuer die Quote')
  assert.equal(e.status, 'verloren', '"Verlust" heisst verloren')

  // ZWEI VERSCHIEDENE ZAHLEN, und beide werden gebraucht:
  //   auszahlung = was moeglich gewesen waere, 2000 x 1,9 = 3800
  //   ausgezahlt = was wirklich zurueckkam, bei einem verlorenen Schein 0
  // Auf dem Stake-Schein steht unter "Auszahlung" die 0. Das ist der
  // tatsaechliche Rueckfluss, nicht der moegliche Gewinn.
  assert.equal(w(e, 'auszahlung'), 3800, 'der moegliche Gewinn')
  assert.equal(w(e, 'ausgezahlt'), 0, 'wirklich zurueckgekommen ist nichts')

  // Die 0 darf NICHT zu einer Quote 0 fuehren. Bei einem verlorenen Schein
  // steht in der Auszahlungsspalte immer 0, und 0 geteilt durch den Einsatz
  // waere 0. Das wuerde den ganzen Riesenschein verderben.
  assert.notEqual(w(e, 'quoteDezimal'), 0)
})

test('Stake, gewonnener Schein mit acht Nachkommastellen', () => {
  const e = leseSchein(
    [
      'Über 82.5 Rushing Yards',
      'Gewonnen',
      'Jahmyr Gibbs',
      'Quoten                    1,84',
      'Einsatz          5,000.000000...',
      'Auszahlung       9,175.995500...',
    ],
    STAKE
  )
  assert.equal(w(e, 'einsatz'), 5000)
  // Auf den Cent. Geldbetraege werden im ganzen Programm auf zwei Stellen
  // gerundet (kern/quoten.js). Bei Stake stehen acht Nachkommastellen, weil
  // dort in Krypto gerechnet wird: aus 9175,9955 wird 9176,00.
  // OFFENE FRAGE AN KARAM: bei sechzig Scheinen summiert sich das auf
  // hoechstens dreissig Cent. Wenn das stoeren soll, muss die Rundung raus,
  // und das betrifft dann auch Excel und die Summenpruefung.
  assert.ok(Math.abs(w(e, 'auszahlung') - 9175.9955) < 0.005, w(e, 'auszahlung'))
  assert.equal(e.status, 'gewonnen')

  // DIE ANGEZEIGTE QUOTE IST NICHT DIE ECHTE.
  //
  // Auf dem Schein steht 1,84. Aus Einsatz und Auszahlung ergibt sich aber
  // 9175,9955 / 5000 = 1,8351991. Der Buchmacher rundet die Anzeige auf zwei
  // Stellen, das Programm rechnet den genauen Multiplikator zurueck.
  //
  // Fuer Karam ist genau das der Wert, der zaehlt: 5000 mal 1,84 waeren 9200,
  // ausgezahlt wurden aber 9175,9955. Wer mit der angezeigten Quote rechnet,
  // liegt bei diesem einen Schein schon 24 Euro daneben.
  assert.ok(
    Math.abs(w(e, 'quoteDezimal') - 1.8351991) < 0.0001,
    `Quote ${w(e, 'quoteDezimal')}, erwartet den gerechneten Multiplikator 1,8351991`
  )
  assert.notEqual(w(e, 'quoteDezimal'), 1.84, 'die gerundete Anzeige darf nicht gewinnen')
})

// ---------------------------------------------------------------------------
// Betway: deutsch, "Umsetzen" statt Einsatz, Wert in der NAECHSTEN Zeile
// ---------------------------------------------------------------------------

const BETWAY = { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }

test('Betway, gewonnen', () => {
  const e = leseSchein(
    [
      'Einzelwette @ 1.74',
      'GEWONNEN',
      'Los Angeles Rams - San Francisco 49ers',
      'Deebo Samuel Sr. (SF) Über 2.5: Erfolgreiche Annahmen gesamt',
      'Umsetzen',
      '€78,30',
      'DU HAST GEWONNEN',
      '€136,30',
    ],
    BETWAY
  )
  assert.equal(w(e, 'einsatz'), 78.3, '"Umsetzen" ist Betways Wort fuer den Einsatz')
  assert.equal(w(e, 'auszahlung'), 136.3, '136,30 ist die Auszahlung MIT Einsatz')
  assert.equal(e.status, 'gewonnen')
})

test('Betway, ungueltig: der Einsatz kommt zurueck', () => {
  const e = leseSchein(
    [
      'Einzelwette @ 1.87',
      'UNGÜLTIG',
      'Seattle Seahawks - New England Patriots',
      'Umsetzen',
      '€287,50',
      'Erstattet',
      '€287,50',
    ],
    BETWAY
  )
  assert.equal(w(e, 'einsatz'), 287.5)
  assert.equal(e.status, 'storniert', '"UNGUELTIG" heisst storniert')
  // Bei einer Erstattung ist Auszahlung gleich Einsatz. Daraus darf keine
  // Quote 1,0 werden, und die gedruckte 1,87 darf nicht verschwinden.
  assert.notEqual(w(e, 'quoteDezimal'), 1, 'aus einer Erstattung wurde eine Quote 1,0 gerechnet')
})

// ---------------------------------------------------------------------------
// bet365: deutsch, "Gewinn" heisst hier die AUSZAHLUNG
//
// 250 x 1,80 = 450, und auf dem Schein steht "Gewinn 450,00". Im Englischen
// waere "win" der reine Gewinn. Das Wort allein entscheidet also nicht, die
// Gegenrechnung entscheidet.
// ---------------------------------------------------------------------------

const BET365 = { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }

test('bet365, "Gewinn" ist die Auszahlung mit Einsatz', () => {
  const e = leseSchein(
    [
      '€250,00 Einzelwetten',
      'GEWONNEN',
      'Nahshon Wright - Weniger als 2.5   1.80',
      'Tackles Ü/U',
      'Einsatz:',
      '€250,00',
      'Gewinn',
      '€450,00',
    ],
    BET365
  )
  assert.equal(w(e, 'einsatz'), 250)
  assert.equal(w(e, 'auszahlung'), 450)
  assert.equal(w(e, 'quoteDezimal'), 1.8)
})

test('bet365, deutscher Tausenderpunkt in der Auszahlung', () => {
  const e = leseSchein(
    [
      '€961,54 Einzelwetten',
      'GEWONNEN',
      'Nahshon Wright (NY Jets) - Weniger als 3.5   2.30',
      'Einsatz:',
      '€961,54',
      'Gewinn',
      '€2.211,55',
    ],
    BET365
  )
  assert.equal(w(e, 'einsatz'), 961.54)
  assert.equal(w(e, 'auszahlung'), 2211.55)
})

// ---------------------------------------------------------------------------
// PS3838: eine Tabellenzeile, die Quote steht nackt mit dem Buchstaben D
//
// Die Spaltenueberschriften stehen ausserhalb der Zeile. Innerhalb der Zeile
// ist die Quote nur "1.854 D", wobei D fuer Dezimal steht. Der Einsatz traegt
// dagegen die Beschriftung "Risk:".
//
// Die Spalte Win/Loss ist der GEWINN, nicht die Auszahlung: 500 x 0,854 = 427.
// Sie ist unbeschriftet und wird deshalb NICHT gelesen. Die Auszahlung rechnet
// das Programm aus Einsatz mal Quote aus und kennzeichnet sie als berechnet.
// Lieber nichts als falsch.
// ---------------------------------------------------------------------------

const PS3838 = { gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' }

test('PS3838, Tabellenzeile gewonnen', () => {
  const e = leseSchein(
    [
      'Sportsbook',
      '3777854081',
      'Football',
      '2026-09-13 16:29:36',
      'Over 226.5 Passing Yards',
      'Caleb Williams Total Passing Yards',
      'Carolina Panthers-vs-Chicago Bears',
      'Player Props',
      'NFL @ 2026-09-13',
      '1.854 D',
      'Risk: 500.00 (500.00)',
      '427.00',
      '0.00',
      'Settled WIN',
    ],
    PS3838
  )
  assert.equal(w(e, 'einsatz'), 500, '"Risk:" ist der Einsatz')
  assert.equal(w(e, 'quoteDezimal'), 1.854, '"1.854 D" ist die Dezimalquote')
  assert.equal(e.status, 'gewonnen')
})

test('PS3838, Tabellenzeile verloren mit Tausendertrenner', () => {
  const e = leseSchein(
    [
      'Sportsbook',
      '3778381351',
      'Over 230.5 Passing Yards',
      '1.847 D',
      'Risk: 2,540.48 (2,540.48)',
      '-2,540.48',
      'Settled LOSE',
    ],
    PS3838
  )
  assert.equal(w(e, 'einsatz'), 2540.48)
  assert.equal(w(e, 'quoteDezimal'), 1.847)
  assert.equal(e.status, 'verloren')
})

// ---------------------------------------------------------------------------
// BetOnline: der Fall, mit dem alles angefangen hat. Muss gruen bleiben.
// ---------------------------------------------------------------------------

const BETONLINE = { gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' }

test('BetOnline, gewonnen', () => {
  const e = leseSchein(
    [
      '#396228612 Sep 10, 10:42 PM',
      'won',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157        Stake: $ 181        Returns: $ 296.84',
    ],
    BETONLINE
  )
  assert.equal(w(e, 'einsatz'), 181)
  assert.equal(w(e, 'auszahlung'), 296.84)
  assert.equal(w(e, 'scheinNr'), '396228612')
  assert.equal(e.status, 'gewonnen')
})

test('BetOnline, verloren, ohne Returns-Spalte', () => {
  const e = leseSchein(
    [
      '#396418815 Sep 13, 6:39 PM',
      'lost',
      'Baker Mayfield',
      'WILL HAVE OVER 231.5 PASSING YARDS',
      'Odds: -114        Stake: $ 268',
    ],
    BETONLINE
  )
  assert.equal(w(e, 'einsatz'), 268)
  assert.equal(e.status, 'verloren')
  assert.equal(w(e, 'scheinNr'), '396418815')
})
