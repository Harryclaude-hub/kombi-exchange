import test from 'node:test'
import assert from 'node:assert/strict'

import { rechne } from '../kern/rechnung.js'

/**
 * Eine Hülle darf nicht schweigend verschiedene Wetten mischen.
 *
 * DER FUND, 16.09.2026, von einer Gegenprüfung an dem gefunden, was am selben
 * Tag gebaut wurde.
 *
 * Seit der Hülle stempelt oberflaeche/zustand.js jeden neu gelesenen Schein mit
 * gruppeId = huelle.id. kern/gruppierung.js macht daraus eine Handgruppe, und
 * dort steht "if (gruppe.vonHand) continue": eine Handgruppe wird nie
 * verglichen, nie aufgebrochen, nie befragt.
 *
 * Nachgemessen an den neun echten PS3838-Zeilen aus demselben Foto:
 *
 *   OHNE Hülle   3 Gruppen
 *     Gibbs    84,5   4 Scheine  10.000,00 Einsatz   +8.367,28
 *     Williams 226,5  2 Scheine     999,00 Einsatz     +857,14
 *     Mayfield 230,5  3 Scheine   6.718,48 Einsatz   -6.718,48
 *
 *   MIT offener Hülle   1 Gruppe
 *     9 Scheine, 17.717,48 Einsatz, drei verschiedene Linien,
 *     gewonnen UND verloren in einer Position.
 *
 * Das ist derselbe Fehler wie der teuerste Fund des Projekts, nur über
 * 17.717,48 statt über 9.000 Euro.
 *
 * AUFGEBROCHEN WIRD NICHTS. Karam hat die Scheine selbst dort hineingelegt,
 * und gegen seine Entscheidung zu gruppieren wäre eine Automatik ohne
 * Prüfstein in die Gegenrichtung (Projektregel 1). Gesagt werden muss es
 * trotzdem, und zwar laut (Projektregel 9).
 */

/**
 * @param {string} id
 * @param {number} einsatz
 * @param {number|null} quote
 * @param {string} status
 * @returns {any}
 */
function schein(id, einsatz, quote, status) {
  const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'ocr', roh: '' })
  return {
    id,
    bildId: 'einFoto',
    buchmacher: feld('PS3838'),
    konto: feld(null),
    scheinNr: feld(null),
    gesetztAm: feld(null),
    einsatz: feld(einsatz),
    auszahlung: feld(quote === null ? null : einsatz * quote),
    ausgezahlt: feld(status === 'verloren' ? 0 : null),
    quoteDezimal: feld(quote),
    quoteAmerikanisch: feld(null),
    waehrung: feld('EUR'),
    status,
    gratiswette: false,
    eachWay: false,
    ausgeschlossen: false,
    beine: [],
    auswahlen: [],
    hinweise: [],
    zeilen: [],
    notiz: '',
    geaendertAm: '2026-09-16T12:00:00.000Z',
    vonHand: false,
  }
}

/**
 * @param {any} rechnung
 * @returns {any|undefined}
 */
function gemischt(rechnung) {
  return rechnung.hinweise.find((h) => h.code === 'gewonnen_und_verloren')
}

test('gewonnen und verloren in einer Position wird gemeldet', () => {
  // Genau die Lage aus dem Fund: Gewinner und Verlierer in einem Riesenschein.
  const scheine = [
    schein('a', 2315.98, 1.826, 'gewonnen'),
    schein('b', 2583.54, 1.833, 'gewonnen'),
    schein('c', 2239.49, 1.84, 'verloren'),
    schein('d', 2239.49, 1.847, 'verloren'),
  ]
  const h = gemischt(rechne(scheine))
  assert.ok(h, 'der Widerspruch muss gemeldet werden')
  assert.equal(h.schwere, 'warnung')
  assert.match(h.text, /gewonnen/i)
  assert.match(h.text, /verloren/i)
})

test('alles gewonnen ist kein Widerspruch', () => {
  const scheine = [
    schein('a', 500, 1.9, 'gewonnen'),
    schein('b', 500, 1.88, 'gewonnen'),
    schein('c', 500, 1.92, 'gewonnen'),
  ]
  assert.equal(gemischt(rechne(scheine)), undefined)
})

test('alles verloren ist kein Widerspruch', () => {
  const scheine = [
    schein('a', 500, 1.9, 'verloren'),
    schein('b', 500, 1.88, 'verloren'),
  ]
  assert.equal(gemischt(rechne(scheine)), undefined)
})

test('offen neben gewonnen ist kein Widerspruch', () => {
  // Ein Teil der Wetten ist entschieden, ein Teil laeuft noch. Das ist der
  // Normalfall an einem Spieltag und keine Warnung wert.
  const scheine = [
    schein('a', 500, 1.9, 'gewonnen'),
    schein('b', 500, 1.88, 'offen'),
    schein('c', 500, 1.92, 'offen'),
  ]
  assert.equal(gemischt(rechne(scheine)), undefined)
})

test('storniert neben gewonnen ist kein Widerspruch', () => {
  // Eine Annullierung ist kein Verlust. Sie kommt bei jedem Anbieter vor und
  // darf keine Warnung ausloesen, sonst wird die Warnung wertlos.
  const scheine = [
    schein('a', 500, 1.9, 'gewonnen'),
    schein('b', 500, 1.88, 'storniert'),
  ]
  assert.equal(gemischt(rechne(scheine)), undefined)
})

test('ein einzelner Schein loest nichts aus', () => {
  assert.equal(gemischt(rechne([schein('a', 500, 1.9, 'gewonnen')])), undefined)
})
