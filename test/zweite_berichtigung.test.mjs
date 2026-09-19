import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * B1 der Fehlersuche vom 17.09.2026: zwei Berichtigungen in derselben Minute,
 * die zweite wurde nie gespeichert.
 *
 * Der Waechter in oberflaeche/app.js verglich einen Stempel aus geaendertAm,
 * und jetzt() ist nur minutengenau. Wer eine Zahl berichtigte und innerhalb
 * derselben Minute noch einmal, hatte denselben Stempel, und die zweite
 * Korrektur ging nicht hinaus. Beim Nachlesen von sechzig Scheinen ist eine
 * Minute gar nichts.
 *
 * Der Waechter haengt jetzt an der LISTE selbst: zustand.js ersetzt bei jeder
 * Datenaenderung das ganze Feld (map und filter, nie in place). Diese Datei
 * haelt genau dieses Versprechen fest. Bricht es jemand, indem er in
 * stand.scheine hineinschreibt statt zu ersetzen, faellt er hier durch, und
 * das Speichern wuerde wieder Aenderungen verschlucken.
 */

function baueSpeicher() {
  const inhalt = new Map()
  return {
    getItem: (k) => (inhalt.has(k) ? inhalt.get(k) : null),
    setItem: (k, v) => void inhalt.set(k, String(v)),
    removeItem: (k) => void inhalt.delete(k),
    clear: () => inhalt.clear(),
  }
}
globalThis.localStorage = baueSpeicher()

const Zustand = await import('../oberflaeche/zustand.js')

function schein(id) {
  const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'ocr', roh: '' })
  return {
    id,
    bildId: 'einFoto',
    gruppeId: null,
    buchmacher: feld('PS3838'),
    konto: feld(null),
    scheinNr: feld(id),
    gesetztAm: feld('2026-09-19T12:00:00.000Z'),
    einsatz: feld(500),
    auszahlung: feld(900),
    ausgezahlt: feld(null),
    quoteDezimal: feld(1.8),
    quoteAmerikanisch: feld(null),
    waehrung: feld('EUR'),
    status: 'offen',
    art: 'kombi',
    gratiswette: false,
    eachWay: false,
    ausgeschlossen: false,
    beine: [],
    auswahlen: [],
    hinweise: [],
    zeilen: [],
    notiz: '',
    geaendertAm: '2026-09-19T12:00',
    vonHand: false,
  }
}

test('jede Berichtigung ersetzt die Liste, auch die zweite in derselben Minute', () => {
  Zustand.ordneNeu([schein('b1')])

  const vorher = Zustand.hole().scheine
  Zustand.setzeFeld('b1', 'einsatz', 100)
  const nachErster = Zustand.hole().scheine
  assert.notEqual(nachErster, vorher, 'die erste Berichtigung ist ein neuer Stand')

  // Sofort danach, mit Sicherheit in derselben Minute. Der alte Stempel aus
  // geaendertAm waere jetzt IDENTISCH gewesen, und das Speichern haette diese
  // Aenderung nie gesehen.
  Zustand.setzeFeld('b1', 'einsatz', 250)
  const nachZweiter = Zustand.hole().scheine
  assert.notEqual(nachZweiter, nachErster, 'auch die zweite Berichtigung ist ein neuer Stand')

  const gespeichert = nachZweiter.find((s) => s.id === 'b1')
  assert.equal(gespeichert?.einsatz.wert, 250)
  assert.equal(gespeichert?.einsatz.quelle, 'hand')
})

test('eine reine Anzeigeaenderung laesst die Listen stehen', () => {
  // Der Waechter darf umgekehrt nicht bei jedem Klick speichern: Auswahl,
  // Suche und Meldungen aendern die Daten nicht.
  const scheineVorher = Zustand.hole().scheine
  const riesenscheineVorher = Zustand.hole().riesenscheine

  Zustand.aendere({ suche: 'gibbs', ansicht: 'scheine' })

  assert.equal(Zustand.hole().scheine, scheineVorher)
  assert.equal(Zustand.hole().riesenscheine, riesenscheineVorher)
})
