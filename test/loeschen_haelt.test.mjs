import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Ein geloeschter Schein muss geloescht bleiben.
 *
 * Karam am 18.09.2026: "Bitte stell sicher, bevor wir morgen losschiessen,
 * dass alles gespeichert bleibt und nicht irgendwie verloren geht, auch wenn
 * ich auf einem anderen Browser bin. Es soll auf jedem Geraet das gleiche
 * angezeigt werden."
 *
 * Beim Loeschen galt das bis heute NICHT. speichereScheine schreibt die Liste,
 * die gerade da ist; ein Schein, der aus der Liste verschwindet, verschwindet
 * damit nicht aus der Datenbank. Beim naechsten Laden war er wieder da, und
 * auf dem Geraet des Kollegen war er nie weg.
 */

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

const Zustand = await import('../oberflaeche/zustand.js')

const feld = (wert) => ({ wert, sicherheit: 0.95, quelle: 'ocr' })
const leer = { wert: null, sicherheit: 0, quelle: 'vorgabe' }

/**
 * Ein Schein in der VOLLEN Form aus kern/typen.js.
 *
 * Nicht abgekuerzt, und das ist hier keine Sorgfaeltigkeit, sondern eine
 * Lehre vom selben Tag: zweimal hintereinander ist die Gruppierung an einem
 * fehlenden Feld stehengeblieben, erst an auswahl.markt, dann an
 * schein.gesetztAm. Eine Probe mit halbem Schein prueft nichts.
 *
 * @param {string} id
 */
function schein(id) {
  return {
    id,
    projektId: 'p',
    bildId: 'bild-1',
    gruppeId: null,
    buchmacher: feld('BetOnline'),
    konto: feld('Auer'),
    scheinNr: feld(id),
    gesetztAm: feld('15.09.2026 20:00'),
    einsatz: feld(100),
    waehrung: feld('USD'),
    quoteDezimal: feld(1.8),
    quoteAmerikanisch: leer,
    auszahlung: feld(180),
    ausgezahlt: leer,
    status: 'offen',
    art: 'einzel',
    auswahlen: [
      {
        id: 'a-' + id,
        ereignis: feld('Denver Broncos - Kansas City Chiefs'),
        markt: feld('UNDER Rushing Yards'),
        tipp: feld('RJ Harvey'),
        linie: feld(18.5),
        quoteDezimal: feld(1.8),
        ergebnis: leer,
        status: 'unbekannt',
      },
    ],
    gratiswette: false,
    eachWay: false,
    ausschnitt: null,
    geaendertAm: '2026-09-18 08:00',
    vonHand: false,
  }
}

test('wer geloescht wird, steht auf der Merkliste', () => {
  Zustand.ordneNeu([schein('a'), schein('b'), schein('c')])
  assert.equal(Zustand.hole().geloeschteScheine.length, 0)

  Zustand.entferneSchein('b')

  assert.equal(Zustand.hole().scheine.length, 2, 'aus der Liste ist er weg')
  assert.deepEqual(Zustand.hole().geloeschteScheine, ['b'], 'und er steht zum Loeschen an')
})

test('eine Kennung steht nur EINMAL auf der Merkliste', () => {
  // Sonst liefe beim Speichern derselbe Loeschbefehl mehrfach.
  Zustand.ordneNeu([schein('a')])
  Zustand.vergissGeloescht(Zustand.hole().geloeschteScheine)

  Zustand.merkeGeloescht(['x'])
  Zustand.merkeGeloescht(['x'])
  Zustand.merkeGeloescht(['x', 'y'])
  assert.deepEqual(Zustand.hole().geloeschteScheine, ['x', 'y'])
})

test('ein Schein, den es nie gab, landet nicht auf der Merkliste', () => {
  Zustand.ordneNeu([schein('a')])
  Zustand.vergissGeloescht(Zustand.hole().geloeschteScheine)

  Zustand.entferneSchein('gibtesnicht')
  assert.equal(Zustand.hole().geloeschteScheine.length, 0)
})

test('DIE WICHTIGSTE: was nicht geloescht werden konnte, bleibt stehen', () => {
  /*
    Scheitert das Loeschen, weil gerade kein Netz da ist, darf die Kennung
    NICHT verschwinden. Sonst waere der Schein oertlich weg und in der
    Datenbank fuer immer da, und niemand wuerde es je erfahren.
  */
  Zustand.ordneNeu([schein('a'), schein('b')])
  Zustand.vergissGeloescht(Zustand.hole().geloeschteScheine)

  Zustand.entferneSchein('a')
  Zustand.entferneSchein('b')
  assert.deepEqual(Zustand.hole().geloeschteScheine, ['a', 'b'])

  // Nur 'a' ging durch, 'b' scheiterte.
  Zustand.vergissGeloescht(['a'])
  assert.deepEqual(Zustand.hole().geloeschteScheine, ['b'], 'b wartet auf den naechsten Lauf')
})

test('mit dem Bild gehen auch seine Scheine auf die Merkliste', () => {
  Zustand.ordneNeu([schein('a'), schein('b')])
  Zustand.vergissGeloescht(Zustand.hole().geloeschteScheine)

  const bilder = new Map()
  bilder.set('bild-1', { bild: { id: 'bild-1', dateiname: 'x.png' }, element: null, inhalt: null, karten: [], hinweise: [] })
  Zustand.aendere({ bilder })

  const weg = Zustand.entferneBild('bild-1')
  assert.equal(weg, 2, 'beide Scheine gingen mit')
  assert.deepEqual(Zustand.hole().geloeschteScheine.sort(), ['a', 'b'])
})
