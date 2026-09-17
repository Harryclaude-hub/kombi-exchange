import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Der Ordner gehoert an den Riesenschein und muss jedes Neuordnen ueberleben.
 *
 * DIE VORGESCHICHTE, in zwei Schritten
 *
 * 17.09.2026, morgens: die Ordner lagen im Browserspeicher, unter der Kennung
 * des Riesenscheins. gruppiere() vergibt bei jedem Lauf NEUE Kennungen, und
 * neu geordnet wird nach jeder berichtigten Zahl. Gemessen im Browser: vier
 * Riesenscheine in einen Ordner gelegt, einmal "Neuer Riesenschein" gedrueckt,
 * alle vier Ordner weg. Damals mit einer Umzugsliste geflickt.
 *
 * 17.09.2026, abends: Karam erklaert, warum der Ansatz von vornherein falsch
 * war. "Du musst verstehen, dieses Programm ist ein Account. Es wird alles auf
 * einer Datenbank gespeichert, in Supabase. Und ich sehe jedes Foto, jeden
 * Schein, den eine Person macht, und die Person genauso bei mir. Das ist kein
 * eigenes Profil. Das ist einfach DAS Profil."
 *
 * Ein Ordner, den nur ein Geraet kennt, passt nicht in ein Programm mit genau
 * einem Zugang. Er steht jetzt IM Riesenschein, im Feld ordner, und wandert
 * damit dieselbe Zeile wie der Name: von der alten Gruppe auf die neue, ueber
 * die Signatur. Die Umzugsliste ist damit weg, und mit ihr eine zweite Stelle,
 * die man haette vergessen koennen.
 *
 * DIESE FAELLE SICHERN GENAU DAS AB. Der wichtigste ist der erste: er ist der
 * Fehler von heute Morgen, nachgestellt.
 */

/** Ein Ersatz fuer den Browserspeicher, damit sich das hier pruefen laesst. */
function baueSpeicher(anfang = {}) {
  const inhalt = new Map(Object.entries(anfang))
  return {
    getItem: (k) => (inhalt.has(k) ? inhalt.get(k) : null),
    setItem: (k, v) => void inhalt.set(k, String(v)),
    removeItem: (k) => void inhalt.delete(k),
    clear: () => inhalt.clear(),
  }
}

const BRUECKE = 'kombi-riesenschein-ordner'

globalThis.localStorage = baueSpeicher()

const Ordner = await import('../oberflaeche/ordner.js')
const Zustand = await import('../oberflaeche/zustand.js')

/**
 * Ein Schein, wie ihn der Parser liefert. Nur die Felder, die hier zaehlen.
 *
 * @param {string} id
 * @param {string} tipp   Was gewettet wurde. Gleiche Tipps wandern zusammen.
 * @param {number} einsatz
 * @param {number} quote
 * @returns {any}
 */
function schein(id, tipp, einsatz, quote) {
  const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'ocr', roh: '' })
  return {
    id,
    bildId: 'einFoto',
    gruppeId: null,
    buchmacher: feld('PS3838'),
    konto: feld(null),
    scheinNr: feld(id),
    gesetztAm: feld('2026-09-17T12:00:00.000Z'),
    einsatz: feld(einsatz),
    auszahlung: feld(einsatz * quote),
    ausgezahlt: feld(null),
    quoteDezimal: feld(quote),
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
        tipp: feld(tipp),
        ereignis: feld('Rams @ 49ers'),
        markt: feld('Sieger'),
        linie: feld(null),
        quoteDezimal: feld(quote),
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

/** Setzt den Arbeitsstand auf einen sauberen Anfang zurueck. */
function frischerStand() {
  globalThis.localStorage = baueSpeicher()
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

test('DER FEHLER VON HEUTE MORGEN: der Ordner ueberlebt das Neuordnen', () => {
  frischerStand()
  Zustand.ordneNeu([schein('a', 'Gibbs Over', 100, 1.9)])

  const vorher = Zustand.hole().riesenscheine[0]
  assert.ok(vorher, 'es muss einen Riesenschein geben')
  Zustand.setzeOrdner(vorher.id, 'Spieltag 3')
  assert.equal(Ordner.ordnerVon(Zustand.hole().riesenscheine[0]), 'Spieltag 3')

  // Neu geordnet wird nach JEDER berichtigten Zahl. Genau hier gingen die
  // Ordner heute Morgen verloren.
  Zustand.ordneNeu()

  const nachher = Zustand.hole().riesenscheine[0]
  assert.ok(nachher, 'der Riesenschein muss noch da sein')
  assert.equal(
    Ordner.ordnerVon(nachher),
    'Spieltag 3',
    'der Ordner muss das Neuordnen ueberleben'
  )
})

test('der Ordner ueberlebt, WENN DIE KENNUNG SICH WIRKLICH AENDERT', () => {
  /*
    WANN AENDERT SICH DIE KENNUNG UEBERHAUPT? Am 17.09.2026 nachgemessen, denn
    ich hatte es zuerst zu grob aufgeschrieben:

      Solange die Scheine ihre gruppeId tragen, baut gruppiere() dieselbe
      Gruppe mit DERSELBEN Kennung wieder auf. Zweimal ordneNeu hintereinander
      laesst die Kennungen unveraendert. Gemessen: true.

      Neu vergeben wird sie, wenn eine Gruppe FRISCH entsteht, also wenn die
      Scheine keine gruppeId tragen. Das ist der Fall beim allerersten Ordnen
      nach dem Lesen, und auf der Probeseite, wo die Scheine roh hereinkommen.
      Genau dort sind heute Morgen die vier Ordner verschwunden.

    Hier wird der zweite Fall nachgestellt: die Scheine verlieren ihre
    Zuordnung, die Gruppe entsteht neu und bekommt eine neue Kennung. Der
    Ordner muss trotzdem mitkommen, denn er reist ueber die Signatur mit, so
    wie der Name.
  */
  frischerStand()
  Zustand.ordneNeu([schein('a', 'Gibbs Over', 100, 1.9)])
  const alteKennung = Zustand.hole().riesenscheine[0].id
  Zustand.setzeOrdner(alteKennung, 'Woche 2')

  const ohneZuordnung = Zustand.hole().scheine.map((s) => ({ ...s, gruppeId: null }))
  Zustand.ordneNeu(ohneZuordnung)

  const jetzt = Zustand.hole().riesenscheine[0]
  assert.ok(jetzt, 'der Riesenschein muss neu entstanden sein')
  assert.notEqual(jetzt.id, alteKennung, 'die Kennung muss sich hier wirklich geaendert haben')
  assert.equal(Ordner.ordnerVon(jetzt), 'Woche 2', 'der Ordner reist ueber die Signatur mit')
})

test('zweimal ordnen hintereinander laesst die Kennungen unveraendert', () => {
  // Der Gegenbeweis zum Fall darueber, damit die Begruendung dort nicht
  // groesser klingt, als sie ist.
  frischerStand()
  Zustand.ordneNeu([schein('a', 'Gibbs Over', 100, 1.9), schein('b', 'Williams Under', 50, 2.1)])
  const vorher = Zustand.hole().riesenscheine.map((r) => r.id)
  Zustand.ordneNeu()
  const nachher = Zustand.hole().riesenscheine.map((r) => r.id)
  assert.deepEqual(nachher, vorher)
})

test('ein neuer Riesenschein landet im offenen Ordner', () => {
  frischerStand()
  const id = Zustand.macheHuelleAuf('Riesenschein 1', 'Spieltag 4')
  const neu = Zustand.hole().riesenscheine.find((r) => r.id === id)
  assert.ok(neu, 'der neue Riesenschein muss in der Liste stehen')
  assert.equal(Ordner.ordnerVon(neu), 'Spieltag 4')

  // Auch die leere Huelle ueberlebt das Neuordnen mit ihrem Ordner.
  Zustand.ordneNeu()
  const danach = Zustand.hole().riesenscheine.find((r) => r.id === id)
  assert.ok(danach, 'die leere Huelle muss stehen bleiben')
  assert.equal(Ordner.ordnerVon(danach), 'Spieltag 4')
})

test('ohne Ordner angelegt heisst: in keinem Ordner', () => {
  frischerStand()
  const id = Zustand.macheHuelleAuf('Riesenschein 1')
  const neu = Zustand.hole().riesenscheine.find((r) => r.id === id)
  assert.equal(Ordner.ordnerVon(neu), Ordner.OHNE_ORDNER)
})

test('leeren nimmt den Riesenschein aus seinem Ordner heraus', () => {
  frischerStand()
  Zustand.ordneNeu([schein('a', 'Gibbs Over', 100, 1.9)])
  const id = Zustand.hole().riesenscheine[0].id
  Zustand.setzeOrdner(id, 'Spieltag 3')
  Zustand.setzeOrdner(id, '   ')
  assert.equal(Ordner.ordnerVon(Zustand.hole().riesenscheine[0]), Ordner.OHNE_ORDNER)
})

test('aussen stehende Leerzeichen machen keinen zweiten Ordner', () => {
  assert.equal(Ordner.sauberName('  Woche 1  '), 'Woche 1')
  assert.equal(Ordner.sauberName(''), '')
  assert.equal(Ordner.sauberName(null), '')
})

test('DIE BRUECKE: was im Browser lag, geht nicht verloren', () => {
  // Wer zwischen der Fassung 2026-09-17-b und der Migration 0009 Ordner
  // angelegt hat, hat sie im Browserspeicher liegen. Sie duerfen nicht
  // verschwinden, nur weil die Zuordnung umgezogen ist.
  globalThis.localStorage = baueSpeicher({ [BRUECKE]: JSON.stringify({ alt1: 'Spieltag 1' }) })
  assert.equal(Ordner.ordnerVon({ id: 'alt1', ordner: '' }), 'Spieltag 1')
  assert.equal(Ordner.ordnerVon({ id: 'alt2', ordner: '' }), Ordner.OHNE_ORDNER)
})

test('was am Riesenschein steht, schlaegt die Bruecke', () => {
  globalThis.localStorage = baueSpeicher({ [BRUECKE]: JSON.stringify({ x: 'Alt' }) })
  assert.equal(Ordner.ordnerVon({ id: 'x', ordner: 'Neu' }), 'Neu')
})

test('ein entfernter Ordner kommt nicht aus der Bruecke zurueck', () => {
  // Der gefaehrliche Fall: Karam nimmt einen Riesenschein aus seinem Ordner
  // heraus, und beim naechsten Laden stuende er wieder drin, weil im Browser
  // noch der alte Eintrag liegt. Deshalb vergisst setzeOrdner die Bruecke.
  frischerStand()
  globalThis.localStorage = baueSpeicher({ [BRUECKE]: JSON.stringify({ merk: 'Alt' }) })
  Zustand.aendere({
    riesenscheine: [
      { id: 'merk', projektId: 'p', name: 'X', signatur: 's', scheinIds: [], notiz: '', ordner: '', angelegtAm: '', geaendertAm: '' },
    ],
  })
  assert.equal(Ordner.ordnerVon(Zustand.hole().riesenscheine[0]), 'Alt', 'zuerst greift die Bruecke')

  Zustand.setzeOrdner('merk', '')
  assert.equal(
    Ordner.ordnerVon(Zustand.hole().riesenscheine[0]),
    Ordner.OHNE_ORDNER,
    'nach dem Herausnehmen darf die Bruecke nicht mehr dazwischenreden'
  )
  assert.equal(globalThis.localStorage.getItem(BRUECKE), null, 'der letzte Eintrag raeumt den Schluessel weg')
})

test('alleOrdner zaehlt nur, worin wirklich etwas liegt', () => {
  globalThis.localStorage = baueSpeicher()
  const liste = [
    { id: 'a', ordner: 'Woche 1' },
    { id: 'b', ordner: 'Woche 1' },
    { id: 'c', ordner: '' },
    { id: 'd', ordner: 'Woche 2' },
  ]
  assert.deepEqual(Ordner.alleOrdner(liste), [
    { name: 'Woche 1', anzahl: 2 },
    { name: 'Woche 2', anzahl: 1 },
  ])
  assert.equal(Ordner.anzahlOhneOrdner(liste), 1)
  assert.deepEqual(
    Ordner.imOrdner(liste, 'Woche 1').map((r) => r.id),
    ['a', 'b']
  )
})

test('ein Ordner ohne Riesenscheine gibt es nicht', () => {
  globalThis.localStorage = baueSpeicher()
  assert.deepEqual(Ordner.alleOrdner([]), [])
  assert.equal(Ordner.anzahlOhneOrdner([]), 0)
})
