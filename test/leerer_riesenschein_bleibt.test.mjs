import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * B4 der Fehlersuche vom 17.09.2026: ein neuer, noch leerer Riesenschein
 * verschwand spurlos.
 *
 * Er lebte nur in stand.huelle. Wer "Neuer Riesenschein" drueckte, ihn
 * benannte und dann den naechsten anlegte oder neu lud, fand ihn nicht
 * wieder: Name weg, Ordner weg, keine Meldung. gruppiere() baut die Liste
 * vollstaendig aus den Scheinen, und ein Riesenschein ohne Scheine kommt
 * darin nie vor.
 *
 * Jetzt gilt: was bewusst leer angelegt wurde (leere scheinIds im alten
 * Stand), ueberlebt jedes Neuordnen. Eine Gruppe, deren Scheine geloescht
 * wurden, hatte Kennungen in scheinIds und faellt weiterhin heraus, sonst
 * kaeme jeder geloeschte Riesenschein wieder.
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

function schein(id, tipp) {
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
    art: 'einzel',
    gratiswette: false,
    eachWay: false,
    ausgeschlossen: false,
    beine: [],
    auswahlen: [
      {
        id: `${id}-b1`,
        ereignis: feld('Detroit gegen New Orleans'),
        markt: feld('Rushing Yards'),
        tipp: feld(tipp),
        linie: feld(84.5),
        quoteDezimal: feld(1.8),
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

test('der benannte leere Riesenschein ueberlebt den naechsten "Neuer Riesenschein"', () => {
  Zustand.ordneNeu([schein('s1', 'Gibbs Over 84.5')])

  const erster = Zustand.macheHuelleAuf('Spieltag 5')
  const zweiter = Zustand.macheHuelleAuf('Spieltag 6')

  const namen = Zustand.hole().riesenscheine.map((r) => r.name)
  assert.ok(namen.includes('Spieltag 5'), `Spieltag 5 fehlt: ${namen.join(', ')}`)
  assert.ok(namen.includes('Spieltag 6'))
  assert.notEqual(erster, zweiter)

  // Die neue Huelle nimmt auf, die alte bleibt nur stehen.
  assert.equal(Zustand.hole().huelle?.id, zweiter)
})

test('der leere Riesenschein ueberlebt auch jedes weitere Neuordnen', () => {
  // Jede berichtigte Zahl ordnet neu. Der leere Riesenschein muss das aushalten.
  Zustand.setzeFeld('s1', 'einsatz', 750)
  Zustand.setzeFeld('s1', 'einsatz', 800)

  const namen = Zustand.hole().riesenscheine.map((r) => r.name)
  assert.ok(namen.includes('Spieltag 5'))
  assert.ok(namen.includes('Spieltag 6'))
})

test('"nicht mehr aufnehmen" wirft den leeren Riesenschein nicht weg', () => {
  Zustand.schliesseHuelle()
  const namen = Zustand.hole().riesenscheine.map((r) => r.name)
  assert.ok(namen.includes('Spieltag 6'), 'er wurde bewusst angelegt und bleibt sichtbar')
  assert.equal(Zustand.hole().huelle, null)
})

test('eine Gruppe, deren Scheine weg sind, kommt NICHT wieder', () => {
  // Gegenprobe: die Rettung gilt nur fuer bewusst leer Angelegtes. Wer alle
  // Scheine einer Gruppe loescht, will auch die Gruppe nicht behalten.
  const vorher = Zustand.hole().riesenscheine.find((r) => r.scheinIds.includes('s1'))
  assert.ok(vorher, 'die Gruppe zu s1 gibt es')

  Zustand.ordneNeu([])

  const namen = Zustand.hole().riesenscheine.map((r) => r.name)
  assert.equal(
    Zustand.hole().riesenscheine.some((r) => r.id === vorher.id),
    false,
    `die geleerte Gruppe ist weg, da sind nur noch: ${namen.join(', ')}`
  )
  assert.ok(namen.includes('Spieltag 5'), 'die leeren bleiben')
  assert.ok(namen.includes('Spieltag 6'))
})
