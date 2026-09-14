import test from 'node:test'
import assert from 'node:assert/strict'

import { leseSchein } from '../kern/parser.js'

/**
 * Ein Datum ist kein Geldbetrag.
 *
 * GEFUNDEN AM 14.09.2026 beim Durchlauf ueber eine nachgebaute PS3838-Tabelle.
 * Die Texterkennung macht aus einer Tabellenzeile freien Text, und dabei
 * landet alles durcheinander:
 *
 *   "1 Sportsbook 2026-09-13 15:57:21 Detroit Lions-vs-New Orleans Saints
 *    1826 (2,315.98) 1,913.00 0.00 WIN"
 *   "2026-09-13 11:35:43 Player Props D"
 *
 * Das Wort "WIN" am Zeilenende ist in der Etikettenliste als unklarer
 * Auszahlungsbegriff eingetragen. Dahinter stand keine Zahl, also griff die
 * Regel "dann steht der Wert in der naechsten Zeile". Die naechste Zeile
 * beginnt mit einem Datum, und so wurde aus der JAHRESZAHL 2026 ein Gewinn.
 * Daraus rechnete das Programm eine Auszahlung von 4.341,98 und eine Quote
 * von 1,8748. Alles erfunden, nichts davon steht auf dem Schein.
 *
 * DIE REGEL DAGEGEN: die Regel "Wert in der naechsten Zeile" gilt nur, wenn
 * die naechste Zeile auch WIRKLICH aus Werten besteht. Eine Zeile mit Datum,
 * Uhrzeit oder Fliesstext ist keine Wertzeile.
 *
 * Das ist Projektregel 1: wo kein Pruefstein ist, entscheidet der Mensch.
 * Lieber kein Wert und ein sichtbarer Hinweis als ein erfundener Wert.
 */

const w = (e, f) => (e[f] && typeof e[f] === 'object' && 'wert' in e[f] ? e[f].wert : e[f])

const PS3838 = { gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' }

test('aus einer Jahreszahl wird kein Gewinn', () => {
  const e = leseSchein(
    [
      '3778262388 Over 84.5 Rushing Yards',
      'Football Jahmyr Gibbs Total Rushing Yards Risk: 2,315.98 Settled',
      '1 Sportsbook 2026-09-13 15:57:21 Detroit Lions-vs-New Orleans Saints 1826 (2,315.98) 1,913.00 0.00 WIN',
      '2026-09-13 11:35:43 Player Props D',
      'NFL @ 2026-09-13',
    ],
    PS3838
  )

  assert.equal(w(e, 'einsatz'), 2315.98, 'der Einsatz steht beschriftet da und muss stimmen')

  // Das Entscheidende: es darf NICHTS erfunden werden.
  assert.notEqual(w(e, 'auszahlung'), 4341.98, 'die Auszahlung kam aus der Jahreszahl 2026')
  const quote = w(e, 'quoteDezimal')
  assert.ok(
    quote === null || Math.abs(quote - 1.826) < 0.01,
    `Quote ${quote}: entweder die echte 1,826 oder gar nichts, aber nichts Erfundenes`
  )
})

test('eine Zeile mit Datum ist keine Wertzeile', () => {
  const e = leseSchein(
    ['Gewinn', '2026-09-13 11:35:43 Player Props'],
    { gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(w(e, 'auszahlung'), null, 'aus dem Datum darf kein Betrag werden')
})

test('eine Zeile mit Uhrzeit ist keine Wertzeile', () => {
  const e = leseSchein(
    ['Einsatz', 'Do., 10. Sept. 02:20'],
    { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(w(e, 'einsatz'), null, 'aus der Uhrzeit darf kein Einsatz werden')
})

test('eine Zeile mit Fliesstext ist keine Wertzeile', () => {
  const e = leseSchein(
    ['Einsatz', 'Detroit Lions 31 New Orleans Saints 30'],
    { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(w(e, 'einsatz'), null, 'aus dem Spielstand darf kein Einsatz werden')
})

test('eine echte Wertzeile wird weiter genommen', () => {
  // Der Betway-Fall, der funktionieren MUSS.
  const e = leseSchein(
    [
      'Einzelwette @ 1.74',
      'GEWONNEN',
      'Umsetzen                              DU HAST GEWONNEN',
      '€78,30                                          €136,24',
    ],
    { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' }
  )
  assert.equal(w(e, 'einsatz'), 78.3)
  assert.equal(w(e, 'auszahlung'), 136.24)
})

test('eine Wertzeile ohne Waehrungszeichen ebenso', () => {
  const e = leseSchein(
    ['Quoten', '1,90', 'Einsatz', '2000.00', 'Auszahlung', '0.00'],
    { gebiet: 'en', waehrung: 'UNBEKANNT', quotenformat: 'dezimal' }
  )
  assert.equal(w(e, 'einsatz'), 2000)
  assert.equal(w(e, 'quoteDezimal'), 1.9)
})
