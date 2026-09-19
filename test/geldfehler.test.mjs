import test from 'node:test'
import assert from 'node:assert/strict'

import { rechne } from '../kern/rechnung.js'

/**
 * Die Geldfunde der Fehlersuche vom 17.09.2026, Abschnitt A.
 *
 * Jeder Fall hier ist mit node gegen die echten Rechenmodule nachgestellt und
 * hat vor der Reparatur Geld falsch gezaehlt, ohne eine einzige Meldung. Die
 * Betraege in den Faellen sind die aus der Fehlersuche.
 *
 *   A1  Der Knopf "Gewonnen" verspricht 1.800,00 und zahlt 900,00, weil ein
 *       als verloren gelesener Schein sein ausgezahlt = 0 behaelt.
 *   A2  Each Way zahlt offen das Doppelte, gewonnen das Einfache.
 *   A3  Halb gewonnene Gratiswette verbucht den Einsatz als Rueckfluss.
 *   A6  Ein Schein ohne erkannte Waehrung wandert still in die Summe der
 *       anderen, direkt unter der Zusage, dass genau das nie passiert.
 *
 * A4 und A5 betreffen die Excel-Ausgabe und stehen in
 * test/excel_formeln.test.mjs.
 */

// oberflaeche/ordner.js liest den Browserspeicher. Unter node gibt es keinen.
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

/**
 * Ein Schein, wie ihn der Parser liefert. Gleiche Tipps wandern zusammen.
 *
 * @param {string} id
 * @param {import('../kern/typen.js').Status} status
 * @param {Partial<{einsatz: number, quote: number, ausgezahlt: any, eachWay: boolean, gratiswette: boolean, waehrung: string}>} [extra]
 * @returns {any}
 */
function schein(id, status, extra = {}) {
  const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'ocr', roh: '' })
  const einsatz = extra.einsatz ?? 500
  const quote = extra.quote ?? 1.8
  return {
    id,
    bildId: 'einFoto',
    gruppeId: null,
    buchmacher: feld('PS3838'),
    konto: feld(null),
    scheinNr: feld(id),
    gesetztAm: feld('2026-09-19T12:00:00.000Z'),
    einsatz: feld(einsatz),
    auszahlung: feld(einsatz * quote),
    ausgezahlt: extra.ausgezahlt ?? feld(null),
    quoteDezimal: feld(quote),
    quoteAmerikanisch: feld(null),
    waehrung: feld(extra.waehrung ?? 'EUR'),
    status,
    art: 'kombi',
    gratiswette: extra.gratiswette ?? false,
    eachWay: extra.eachWay ?? false,
    ausgeschlossen: false,
    beine: [],
    auswahlen: [
      {
        id: `${id}-b1`,
        ereignis: feld('Detroit gegen New Orleans'),
        markt: feld('Rushing Yards'),
        tipp: feld('Gibbs Over 84.5 Rushing Yards'),
        linie: feld(84.5),
        quoteDezimal: feld(quote),
        ergebnis: feld(null),
        status: 'unbekannt',
      },
    ],
    hinweise: [],
    zeilen: [],
    notiz: '',
    geaendertAm: '2026-09-19T12:00',
    vonHand: false,
  }
}

// ---------------------------------------------------------------------------
// A1. Der Knopf "Gewonnen" muss halten, was er verspricht.
// ---------------------------------------------------------------------------

test('A1: ein als verloren gelesener Schein zahlt nach "Gewonnen" wieder aus', () => {
  // Zwei Scheine je 500 zu 1,8. Einer wurde als verloren gelesen und traegt
  // deshalb ausgezahlt = 0 aus dem Parser (berechnet, nicht von Hand).
  const verloren = schein('a1-verloren', 'verloren', {
    ausgezahlt: { wert: 0, sicherheit: 0.9, quelle: 'berechnet', roh: '' },
  })
  const offen = schein('a1-offen', 'offen')

  Zustand.ordneNeu([verloren, offen])
  const riesenschein = Zustand.hole().riesenscheine.find((r) => r.scheinIds.includes('a1-verloren'))
  assert.ok(riesenschein, 'beide Scheine liegen in einem Riesenschein')
  assert.ok(riesenschein.scheinIds.includes('a1-offen'), 'es ist EIN Riesenschein')

  const geaendert = Zustand.setzeAusgangFuerRiesenschein(riesenschein.id, 'gewonnen')
  assert.equal(geaendert, 2)

  const rechnung = Zustand.rechnungVon(riesenschein.id)
  // Versprochen sind 2 mal 500 mal 1,8. Vor der Reparatur kamen 900,00 heraus
  // und ein Ergebnis von minus 100,00 statt plus 800,00.
  assert.equal(rechnung.auszahlungRealisiert, 1800)
  assert.equal(rechnung.ergebnisRealisiert, 800)
})

test('A1: dieselbe Statuskorrektur von Hand am Einzelschein (Aufklappmenue)', () => {
  const s = schein('a1-menue', 'verloren', {
    ausgezahlt: { wert: 0, sicherheit: 0.9, quelle: 'berechnet', roh: '' },
  })
  Zustand.ordneNeu([s])
  Zustand.setzeFeld('a1-menue', 'status', 'gewonnen')

  const gespeichert = Zustand.hole().scheine.find((x) => x.id === 'a1-menue')
  assert.ok(gespeichert)
  const rechnung = rechne([gespeichert])
  assert.equal(rechnung.auszahlungRealisiert, 900)
  assert.equal(rechnung.ergebnisRealisiert, 400)
})

test('A1: ein von Hand eingetragener Rueckfluss bleibt bei jedem Statuswechsel stehen', () => {
  // Handeingaben werden nie ueberschrieben. Wer 450 eingetragen hat und den
  // Stand wechselt, behaelt seine 450.
  const s = schein('a1-hand', 'gewonnen', {
    ausgezahlt: { wert: 450, sicherheit: 1, quelle: 'hand', roh: '' },
  })
  Zustand.ordneNeu([s])
  Zustand.setzeFeld('a1-hand', 'status', 'verloren')

  const gespeichert = Zustand.hole().scheine.find((x) => x.id === 'a1-hand')
  assert.equal(gespeichert?.ausgezahlt.wert, 450)
  assert.equal(gespeichert?.ausgezahlt.quelle, 'hand')
})

test('A1: "Wieder offen" laesst keinen alten Rueckfluss zurueck', () => {
  const s = schein('a1-offen2', 'verloren', {
    ausgezahlt: { wert: 0, sicherheit: 0.9, quelle: 'berechnet', roh: '' },
  })
  Zustand.ordneNeu([s])
  const riesenschein = Zustand.hole().riesenscheine.find((r) => r.scheinIds.includes('a1-offen2'))
  assert.ok(riesenschein)
  Zustand.setzeAusgangFuerRiesenschein(riesenschein.id, 'offen')

  const rechnung = Zustand.rechnungVon(riesenschein.id)
  assert.equal(rechnung.auszahlungRealisiert, 0)
  assert.equal(rechnung.einsatzOffen, 500)
  assert.equal(rechnung.auszahlungMoeglich, 900)
})

// ---------------------------------------------------------------------------
// A2. Each Way: offen und gewonnen muessen dieselbe Rechnung sein.
// ---------------------------------------------------------------------------

test('A2: der Gewinn einer Each-Way-Wette verschwindet nicht beim Umstellen auf gewonnen', () => {
  // Einsatz 1000, Quote 2,0, Each Way: abgebucht werden 2.000, moeglich sind
  // 4.000. Vor der Reparatur wurden nach dem Umstellen nur 2.000 verbucht,
  // und der Gewinn von 2.000 war weg, ohne Hinweis.
  const offen = rechne([schein('a2-offen', 'offen', { einsatz: 1000, quote: 2, eachWay: true })])
  assert.equal(offen.auszahlungMoeglich, 4000)
  assert.equal(offen.bestenfalls, 2000)

  const gewonnen = rechne([schein('a2-gewonnen', 'gewonnen', { einsatz: 1000, quote: 2, eachWay: true })])
  assert.equal(gewonnen.auszahlungRealisiert, 4000)
  assert.equal(gewonnen.ergebnisRealisiert, 2000)

  // Der Kern des Fundes: was offen versprochen war, muss gewonnen herauskommen.
  assert.equal(gewonnen.ergebnisRealisiert, offen.bestenfalls)
})

test('A2: Each Way bei push bekommt den DOPPELTEN Einsatz zurueck', () => {
  // Abgebucht wurden 2.000 (kern/rechnung.js verdoppelt den Aufwand). Kommt
  // nur der einfache Einsatz zurueck, steht ein Verlust da, den es nie gab.
  const r = rechne([schein('a2-push', 'push', { einsatz: 1000, quote: 2, eachWay: true })])
  assert.equal(r.auszahlungRealisiert, 2000)
  assert.equal(r.ergebnisRealisiert, 0)
})

test('A2: Each Way halb gewonnen bleibt im Verhaeltnis zum doppelten Einsatz', () => {
  const r = rechne([schein('a2-halb', 'halb_gewonnen', { einsatz: 1000, quote: 2, eachWay: true })])
  // Je Haelfte: halber Einsatz zurueck plus halber Einsatz mal Quote, und das
  // fuer beide Teile der Each-Way-Wette: (500 + 500*2) * 2 = 3000.
  assert.equal(r.auszahlungRealisiert, 3000)
  assert.equal(r.ergebnisRealisiert, 1000)
})

// ---------------------------------------------------------------------------
// A3. Gratiswette: der Einsatz war nie eigenes Geld.
// ---------------------------------------------------------------------------

test('A3: halb gewonnene Gratiswette zahlt nur den Gewinn der gewonnenen Haelfte', () => {
  const r = rechne([schein('a3-halb', 'halb_gewonnen', { einsatz: 1000, quote: 2, gratiswette: true })])
  // Vor der Reparatur: 500 Einsatzrueckgabe plus 1.000 Gewinn = 1.500. Die 500
  // Rueckgabe gab es nie, der Einsatz war eine Gutschrift des Buchmachers.
  assert.equal(r.auszahlungRealisiert, 500)
  assert.equal(r.ergebnisRealisiert, 500)
})

test('A3: halb verlorene Gratiswette zahlt nichts zurueck', () => {
  const r = rechne([schein('a3-halbverloren', 'halb_verloren', { einsatz: 1000, quote: 2, gratiswette: true })])
  assert.equal(r.auszahlungRealisiert, 0)
  assert.equal(r.ergebnisRealisiert, 0)
})

test('A3: die Gegenprobe: mit echtem Geld bleibt halb gewonnen wie es war', () => {
  const r = rechne([schein('a3-echt', 'halb_gewonnen', { einsatz: 1000, quote: 2 })])
  assert.equal(r.auszahlungRealisiert, 1500)
  assert.equal(r.ergebnisRealisiert, 500)
})

// ---------------------------------------------------------------------------
// A6. Ein Schein ohne Waehrung darf nicht still in fremde Summen wandern.
// ---------------------------------------------------------------------------

test('A6: UNBEKANNT neben EUR gilt als gemischt und wird gemeldet', () => {
  const r = rechne([
    schein('a6-eur1', 'offen', { waehrung: 'EUR' }),
    schein('a6-eur2', 'offen', { waehrung: 'EUR' }),
    schein('a6-ohne', 'offen', { waehrung: 'UNBEKANNT' }),
  ])
  assert.equal(r.waehrungGemischt, true, 'ob es dieselbe Waehrung ist, weiss niemand')
  const hinweis = r.hinweise.find((h) => h.code === 'waehrung_unbekannt')
  assert.ok(hinweis, 'der Fall wird beim Namen genannt')
  assert.equal(hinweis.schwere, 'fehler')
})

test('A6: lauter UNBEKANNT ist nicht gemischt, nur unbenannt', () => {
  // Ein Bestand ganz ohne erkannte Waehrung ist in sich stimmig. Er bekommt
  // keine erfundene Mischwarnung, die Waehrung bleibt schlicht UNBEKANNT.
  const r = rechne([
    schein('a6-o1', 'offen', { waehrung: 'UNBEKANNT' }),
    schein('a6-o2', 'offen', { waehrung: 'UNBEKANNT' }),
  ])
  assert.equal(r.waehrungGemischt, false)
  assert.equal(r.waehrung, 'UNBEKANNT')
  assert.equal(r.hinweise.some((h) => h.code === 'waehrung_unbekannt'), false)
})

test('A6: EUR neben USD bleibt gemischt wie bisher', () => {
  const r = rechne([
    schein('a6-eur', 'offen', { waehrung: 'EUR' }),
    schein('a6-usd', 'offen', { waehrung: 'USD' }),
  ])
  assert.equal(r.waehrungGemischt, true)
  assert.ok(r.hinweise.some((h) => h.code === 'waehrung_gemischt'))
})
