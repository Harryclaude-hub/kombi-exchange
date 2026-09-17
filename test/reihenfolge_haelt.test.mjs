import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Die von Hand gesetzte Reihenfolge der Scheine muss halten.
 *
 * Karam am 16.09.2026: "Da rechts einfach alle Minischeine, alle Kombis, mit
 * Anbieter und Einsatz, und das muss IMMER EINE REIHENFOLGE GEBEN, wann er was
 * gesetzt hat."
 *
 * DER FUND, 17.09.2026, aus einer Gegenpruefung aller seiner Forderungen gegen
 * den Quelltext.
 *
 * Setzen konnte man sie: die Pfeile an jedem Kaertchen und der Knopf "nach
 * Zeit" schreiben ueber setzeReihenfolge nach riesenschein.scheinIds. Halten
 * tat sie nicht. ordneNeu nahm scheinIds jedes Mal frisch aus der Gruppe, und
 * gruppierung.js baut die Liste in der Reihenfolge auf, in der die Scheine
 * hereinkommen.
 *
 * Neu geordnet wird nach JEDER berichtigten Zahl, nach jedem gesetzten Ausgang
 * und nach jedem neuen Foto. Wer also sortierte und danach irgendetwas anfasste,
 * hatte die Sortierung wieder verloren, ohne Meldung.
 *
 * Es ist derselbe Fehler wie bei den Ordnern am selben Tag: etwas, das am
 * Riesenschein haengt, ueberlebt das Neuordnen nur, wenn es dort ausdruecklich
 * uebernommen wird. Name, Notiz und Ordner wurden uebernommen, die Reihenfolge
 * nicht.
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

/**
 * Ein Schein derselben Wette, mit eigenem Zeitpunkt.
 *
 * @param {string} id
 * @param {string} zeit  ISO-Zeichenkette.
 * @param {number} einsatz
 * @returns {any}
 */
function schein(id, zeit, einsatz) {
  const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'ocr', roh: '' })
  return {
    id,
    bildId: 'einFoto',
    gruppeId: null,
    buchmacher: feld(`Anbieter ${id}`),
    konto: feld(null),
    scheinNr: feld(id),
    gesetztAm: feld(zeit),
    einsatz: feld(einsatz),
    auszahlung: feld(einsatz * 1.9),
    ausgezahlt: feld(null),
    quoteDezimal: feld(1.9),
    quoteAmerikanisch: feld(null),
    waehrung: feld('EUR'),
    status: 'offen',
    art: 'kombi',
    gratiswette: false,
    eachWay: false,
    ausgeschlossen: false,
    beine: [],
    auswahlen: [
      {
        id: `${id}-1`,
        tipp: feld('Gibbs Over'),
        ereignis: feld('Rams @ 49ers'),
        markt: feld('Sieger'),
        linie: feld(null),
        quoteDezimal: feld(1.9),
        ergebnis: feld(null),
        status: 'offen',
      },
    ],
    hinweise: [],
    zeilen: [],
    notiz: '',
    ocrSicherheit: 1,
    rohtext: '',
    geaendertAm: '2026-09-17T12:00:00.000Z',
    vonHand: false,
  }
}

function frischerStand() {
  Zustand.aendere({
    scheine: [],
    riesenscheine: [],
    restposten: [],
    verdacht: [],
    huelle: null,
    auswahl: null,
    scheinAuswahl: null,
    ordnerFilter: null,
    projekt: { id: 'p', name: 'Probe', notiz: '', waehrung: 'EUR', angelegtAm: '', geaendertAm: '' },
  })
}

/** Die drei Scheine einer Wette, absichtlich NICHT nach Zeit hereingegeben. */
function dreiScheine() {
  return [
    schein('c', '2026-09-17T14:00:00.000Z', 300),
    schein('a', '2026-09-17T10:00:00.000Z', 100),
    schein('b', '2026-09-17T12:00:00.000Z', 200),
  ]
}

test('DER FUND: die Reihenfolge ueberlebt das Neuordnen', () => {
  frischerStand()
  Zustand.ordneNeu(dreiScheine())
  const r = Zustand.hole().riesenscheine[0]
  assert.equal(r.scheinIds.length, 3, 'alle drei gehoeren in dieselbe Wette')

  // So, wie es der Knopf "nach Zeit" tut.
  Zustand.setzeReihenfolge(r.id, ['a', 'b', 'c'])
  assert.deepEqual(Zustand.hole().riesenscheine[0].scheinIds, ['a', 'b', 'c'])

  // Und jetzt irgendetwas anfassen. Genau hier ging sie bisher verloren.
  Zustand.ordneNeu()

  assert.deepEqual(
    Zustand.hole().riesenscheine[0].scheinIds,
    ['a', 'b', 'c'],
    'nach dem Neuordnen muss dieselbe Reihenfolge dastehen'
  )
})

test('die Reihenfolge ueberlebt auch das Berichtigen eines Feldes', () => {
  frischerStand()
  Zustand.ordneNeu(dreiScheine())
  const r = Zustand.hole().riesenscheine[0]
  Zustand.setzeReihenfolge(r.id, ['b', 'c', 'a'])

  // setzeFeld ruft ordneNeu. Das ist der haeufigste Weg ueberhaupt: Karam
  // berichtigt taeglich Betraege, die falsch gelesen wurden.
  Zustand.setzeFeld('a', 'buchmacher', 'bet365')

  assert.deepEqual(Zustand.hole().riesenscheine[0].scheinIds, ['b', 'c', 'a'])
})

test('ein neu dazugekommener Schein haengt sich HINTEN an', () => {
  // Vorne waere falsch: der Neue ist der juengste und soll die von Hand
  // sortierte Liste nicht anfuehren.
  frischerStand()
  Zustand.ordneNeu(dreiScheine())
  const r = Zustand.hole().riesenscheine[0]
  Zustand.setzeReihenfolge(r.id, ['c', 'b', 'a'])

  // Der Vierte kommt in DENSELBEN Riesenschein. So laeuft es im Programm: ein
  // Foto, das in den offenen Riesenschein hochgeladen wird, bekommt dessen
  // Kennung mit (zustand.js, fuegeScheineHinzu). Ohne diese Kennung machte
  // gruppiere() daraus eine eigene Gruppe, weil eine Gruppe mit gesetzter
  // gruppeId nie wieder aufgebrochen wird.
  const vierter = { ...schein('d', '2026-09-17T16:00:00.000Z', 400), gruppeId: r.id }
  Zustand.ordneNeu([...Zustand.hole().scheine, vierter])

  const jetzt = Zustand.hole().riesenscheine.find((x) => x.scheinIds.length === 4)
  assert.ok(jetzt, 'der vierte gehoert in dieselbe Wette')
  assert.deepEqual(jetzt.scheinIds, ['c', 'b', 'a', 'd'])
})

test('ein entfernter Schein faellt aus der Reihenfolge heraus', () => {
  frischerStand()
  Zustand.ordneNeu(dreiScheine())
  const r = Zustand.hole().riesenscheine[0]
  Zustand.setzeReihenfolge(r.id, ['c', 'b', 'a'])

  Zustand.entferneSchein('b')

  const jetzt = Zustand.hole().riesenscheine[0]
  assert.deepEqual(jetzt.scheinIds, ['c', 'a'])
})

test('ohne gesetzte Reihenfolge bleibt es bei der Reihenfolge der Gruppe', () => {
  // Wer nie sortiert hat, soll keine willkuerliche Umordnung bekommen.
  frischerStand()
  Zustand.ordneNeu(dreiScheine())
  const vorher = [...Zustand.hole().riesenscheine[0].scheinIds]
  Zustand.ordneNeu()
  assert.deepEqual(Zustand.hole().riesenscheine[0].scheinIds, vorher)
})
