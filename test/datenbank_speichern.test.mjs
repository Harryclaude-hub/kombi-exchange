import test from 'node:test'
import assert from 'node:assert/strict'

import { speichereScheine } from '../daten/datenbank.js'

/**
 * Das Speichern von Scheinen muss durchlaufen und die Fassung weitergeben.
 *
 * ZWEI FUNDE stecken in dieser Datei:
 *
 * 1. Gefunden am 19.09.2026 beim Beheben von B3: speichereScheine rief nach
 *    jedem erfolgreichen Haeppchen zahlOderNull auf. Diese Funktion gibt es
 *    in daten/datenbank.js gar nicht, sie ist eine PRIVATE Funktion von
 *    kern/quoten.js. Der Aufruf warf einen ReferenceError, NACHDEM das erste
 *    Haeppchen schon in der Datenbank lag. Der Fehler verschwand als
 *    unbehandelte Ablehnung im verzoegert-Wecker: keine Meldung, die Fassung
 *    im Programm blieb alt, und jeder weitere Speicherlauf waere als
 *    "zweites Fenster" abgelehnt worden.
 *
 * 2. B3 der Fehlersuche vom 17.09.2026: bricht das Speichern zwischen zwei
 *    Haeppchen ab, hat die Datenbank schon weitergezaehlt. Die Fehlerantwort
 *    muss die erreichte Fassung mitbringen, damit oberflaeche/app.js sie
 *    uebernehmen kann. Sonst sperrt ein einziger Netzwackler alle weiteren
 *    Speicherlaeufe.
 *
 * Die Datenbank selbst laeuft unter node nicht mit; fetch wird nachgebaut und
 * antwortet, was die echte Tuer kombi_scheine_speichern antworten wuerde.
 */

/** @type {Array<{ok: boolean, status?: number, koerper: any}>} */
let antworten = []
/** @type {any[]} */
let gesendet = []

globalThis.fetch = async (adresse, optionen) => {
  gesendet.push({ adresse: String(adresse), koerper: JSON.parse(String(optionen?.body ?? 'null')) })
  const naechste = antworten.shift()
  if (!naechste) throw new Error('Der Nachbau hat keine Antwort mehr uebrig.')
  return {
    ok: naechste.ok,
    status: naechste.status ?? (naechste.ok ? 200 : 500),
    text: async () => JSON.stringify(naechste.koerper),
  }
}

/** @param {number} n */
function scheine(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `s${i}` }))
}

test('ein Haeppchen: gelungen, und die neue Fassung kommt zurueck', async () => {
  antworten = [{ ok: true, koerper: { fassung: 5, anzahl: 3 } }]
  gesendet = []

  const ergebnis = await speichereScheine('token', 'projekt', scheine(3), 4)

  assert.equal(ergebnis.gelungen, true)
  assert.equal(ergebnis.anzahl, 3)
  assert.equal(ergebnis.fassung, 5)
  assert.equal(gesendet.length, 1)
  assert.equal(gesendet[0].koerper.p_fassung, 4)
})

test('zwei Haeppchen: das zweite bekommt die Fassung des ersten mit', async () => {
  antworten = [
    { ok: true, koerper: { fassung: 8, anzahl: 200 } },
    { ok: true, koerper: { fassung: 9, anzahl: 50 } },
  ]
  gesendet = []

  const ergebnis = await speichereScheine('token', 'projekt', scheine(250), 7)

  assert.equal(ergebnis.gelungen, true)
  assert.equal(ergebnis.anzahl, 250)
  assert.equal(ergebnis.fassung, 9)
  assert.equal(gesendet[0].koerper.p_fassung, 7)
  assert.equal(gesendet[1].koerper.p_fassung, 8, 'sonst liefe der Lauf gegen sich selbst')
})

test('B3: bricht es zwischen zwei Haeppchen ab, traegt die Fehlerantwort die erreichte Fassung', async () => {
  antworten = [
    { ok: true, koerper: { fassung: 12, anzahl: 200 } },
    { ok: false, status: 500, koerper: { message: 'kaputt' } },
  ]
  gesendet = []

  const ergebnis = await speichereScheine('token', 'projekt', scheine(250), 11)

  assert.equal(ergebnis.gelungen, false)
  assert.equal(ergebnis.anzahl, 200, 'das erste Haeppchen war schon gespeichert')
  assert.equal(ergebnis.fassung, 12, 'die Datenbank hat weitergezaehlt, das Programm muss mit')
  assert.equal(ergebnis.widerspruch, false)
  assert.match(ergebnis.meldung, /200 von 250/)
})

test('ein Widerspruch wird als Widerspruch gemeldet, nicht als Ausfall', async () => {
  antworten = [{ ok: false, status: 409, koerper: { code: 'K0409', message: 'Jemand war schneller.' } }]

  const ergebnis = await speichereScheine('token', 'projekt', scheine(1), 3)

  assert.equal(ergebnis.gelungen, false)
  assert.equal(ergebnis.widerspruch, true)
  assert.equal(ergebnis.fassung, 3, 'die eigene Fassung bleibt, es wurde nichts geschrieben')
})

test('eine Antwort ohne Fassung macht daraus null und erfindet keine Zahl', async () => {
  antworten = [{ ok: true, koerper: { anzahl: 1 } }]

  const ergebnis = await speichereScheine('token', 'projekt', scheine(1), null)

  assert.equal(ergebnis.gelungen, true)
  assert.equal(ergebnis.fassung, null)
})
