// @ts-check
/**
 * Der Arbeitsstand des Programms.
 *
 * Eine einzige Stelle, an der steht, was gerade gilt. Wer etwas aendert, ruft
 * aendere auf. Alle Ansichten hoeren zu und zeichnen sich neu.
 *
 * Gerechnete Werte werden NIE hier abgelegt. Summen entstehen immer frisch aus
 * kern/rechnung.js. Sonst haette man zwei Fassungen derselben Zahl, und genau
 * daraus entsteht die Drift, die niemand mehr findet.
 */

import { gruppiere, verschmelzeDoppelte, schlageNamenVor } from '../kern/gruppierung.js'
import { rechne } from '../kern/rechnung.js'
import { neueKennung, jetzt } from './werkzeug.js'

/**
 * @typedef {object} Meldung
 * @property {string} id
 * @property {'info'|'erfolg'|'warnung'|'fehler'} art
 * @property {string} text
 * @property {string} zeit
 */

/**
 * @typedef {object} Bildeintrag
 * @property {import('../kern/typen.js').Bild} bild
 * @property {HTMLImageElement|null} element
 * @property {Blob|null} inhalt
 * @property {import('../kern/typen.js').Rechteck[]} karten
 * @property {string[]} hinweise
 * @property {import('../kern/typen.js').Rechteck|null} [bereich]
 *   Der vom Nutzer gezogene Rahmen. null heisst: das ganze Bild.
 */

/**
 * @typedef {object} Stand
 * @property {boolean} angemeldet
 * @property {string} token
 * @property {boolean} datenbankErreichbar
 * @property {import('../kern/typen.js').Projekt|null} projekt
 * @property {import('../kern/typen.js').Projekt[]} projekte
 * @property {Map<string, Bildeintrag>} bilder
 * @property {import('../kern/typen.js').Schein[]} scheine
 * @property {import('../kern/typen.js').Riesenschein[]} riesenscheine
 * @property {import('../kern/typen.js').Restposten[]} restposten
 * @property {import('../kern/gruppierung.js').Doppelfund[]} verdacht
 * @property {'aufnahme'|'scheine'|'positionen'|'ausgabe'} ansicht
 * @property {string|null} auswahl
 * @property {number|null} fassung
 * @property {{laeuft: boolean, text: string, anteil: number}} arbeit
 * @property {Meldung[]} meldungen
 * @property {{gruendlich: boolean, sprachen: 'eng'|'deu'|'eng+deu', bewegung: 0|1|2}} einstellungen
 */

/** @type {Stand} */
const stand = {
  angemeldet: false,
  token: '',
  datenbankErreichbar: true,
  projekt: null,
  projekte: [],
  // Fassung des offenen Projekts, so wie sie zuletzt gelesen wurde. Sie wandert
  // bei jedem Speichern mit und verhindert, dass ein zweites Fenster mit altem
  // Stand diese Arbeit ueberschreibt. null heisst: noch nichts gelesen.
  fassung: null,
  bilder: new Map(),
  scheine: [],
  riesenscheine: [],
  restposten: [],
  verdacht: [],
  ansicht: 'aufnahme',
  auswahl: null,
  arbeit: { laeuft: false, text: '', anteil: 0 },
  meldungen: [],
  einstellungen: { gruendlich: true, sprachen: 'eng', bewegung: 1 },
}

/** @type {Set<(stand: Stand) => void>} */
const zuhoerer = new Set()

/**
 * @returns {Stand}
 */
export function hole() {
  return stand
}

/**
 * @param {(stand: Stand) => void} was
 * @returns {() => void}
 */
export function hoerZu(was) {
  zuhoerer.add(was)
  return () => zuhoerer.delete(was)
}

/**
 * Aendert den Stand und sagt allen Bescheid.
 *
 * @param {Partial<Stand>} aenderung
 */
export function aendere(aenderung) {
  Object.assign(stand, aenderung)
  for (const was of zuhoerer) {
    try {
      was(stand)
    } catch (fehler) {
      // Ein kaputter Zuhoerer darf nicht alle anderen mit hinunterreissen.
      console.error('[Oberflaeche] Ein Teil der Anzeige konnte nicht neu gezeichnet werden.', fehler)
    }
  }
}

/**
 * Traegt eine Meldung ein.
 *
 * @param {'info'|'erfolg'|'warnung'|'fehler'} art
 * @param {string} text
 */
export function melde(art, text) {
  const meldung = { id: neueKennung(), art, text, zeit: jetzt() }
  // Neueste zuerst, hoechstens fuenfzig behalten.
  aendere({ meldungen: [meldung, ...stand.meldungen].slice(0, 50) })
  return meldung.id
}

/**
 * @param {string} id
 */
export function meldungWeg(id) {
  aendere({ meldungen: stand.meldungen.filter((m) => m.id !== id) })
}

/**
 * @param {boolean} laeuft
 * @param {string} [text]
 * @param {number} [anteil]
 */
export function arbeite(laeuft, text = '', anteil = 0) {
  aendere({ arbeit: { laeuft, text, anteil } })
}

/**
 * Fuegt neue Scheine hinzu und ordnet danach alles neu.
 *
 * @param {import('../kern/typen.js').Schein[]} neue
 */
export function fuegeScheineHinzu(neue) {
  ordneNeu([...stand.scheine, ...neue])
}

/**
 * Ordnet alle Scheine neu zu Riesenscheinen.
 *
 * Zuerst werden Aufnahmen desselben Scheins zusammengefuehrt, dann wird gruppiert.
 * Bestehende Namen bleiben erhalten, damit eine Umbenennung durch den Nutzer
 * nicht bei der naechsten Aufnahme verschwindet.
 *
 * @param {import('../kern/typen.js').Schein[]} [scheine]
 */
export function ordneNeu(scheine) {
  const roh = scheine ?? stand.scheine
  const zusammengefuehrt = verschmelzeDoppelte(roh)

  if (zusammengefuehrt.verschmolzen.length > 0) {
    melde(
      'info',
      `${zusammengefuehrt.verschmolzen.length} Schein(e) waren doppelt erfasst und wurden zu je einem zusammengefuehrt.`
    )
  }

  const ergebnis = gruppiere(zusammengefuehrt.scheine, { gruppenId: () => neueKennung() })

  /** @type {Map<string, import('../kern/typen.js').Riesenschein>} */
  const alteNachId = new Map(stand.riesenscheine.map((r) => [r.id, r]))
  /** @type {Map<string, import('../kern/typen.js').Riesenschein>} */
  const alteNachSignatur = new Map(stand.riesenscheine.map((r) => [r.signatur, r]))

  /** @type {Map<string, import('../kern/typen.js').Schein>} */
  const nachId = new Map(zusammengefuehrt.scheine.map((s) => [s.id, s]))

  const riesenscheine = ergebnis.gruppen.map((gruppe) => {
    const dabei = gruppe.scheinIds.map((id) => nachId.get(id)).filter(Boolean)
    const alt = alteNachId.get(gruppe.id) ?? alteNachSignatur.get(gruppe.signatur)
    return {
      id: gruppe.id,
      projektId: stand.projekt?.id ?? '',
      name: alt?.name || schlageNamenVor(/** @type {any} */ (dabei)),
      signatur: gruppe.signatur,
      scheinIds: gruppe.scheinIds,
      notiz: alt?.notiz ?? '',
      angelegtAm: alt?.angelegtAm ?? jetzt(),
      geaendertAm: jetzt(),
    }
  })

  // Die Zugehoerigkeit auch auf den Scheinen vermerken, damit sie beim Speichern
  // mitgeht und beim naechsten Laden erhalten bleibt.
  for (const riesenschein of riesenscheine) {
    for (const id of riesenschein.scheinIds) {
      const schein = nachId.get(id)
      if (schein) schein.gruppeId = riesenschein.id
    }
  }

  const auswahl =
    stand.auswahl && riesenscheine.some((r) => r.id === stand.auswahl)
      ? stand.auswahl
      : (riesenscheine[0]?.id ?? null)

  aendere({
    scheine: zusammengefuehrt.scheine,
    riesenscheine,
    restposten: ergebnis.restposten,
    verdacht: [...zusammengefuehrt.verdacht, ...ergebnis.vorschlaege.map(vorschlagAlsVerdacht)],
    auswahl,
  })
}

/**
 * @param {import('../kern/gruppierung.js').Zuordnungsvorschlag} vorschlag
 * @returns {import('../kern/gruppierung.js').Doppelfund}
 */
function vorschlagAlsVerdacht(vorschlag) {
  return {
    scheinId: vorschlag.scheinId,
    gleichWieScheinId: vorschlag.gruppeId,
    grund: `Koennte zu einem anderen Riesenschein gehoeren (${Math.round(vorschlag.punkte * 100)} Prozent Uebereinstimmung). ${vorschlag.gruende.join(' ')}`,
    sicherheit: vorschlag.punkte,
    sicher: false,
  }
}

/**
 * Die Scheine eines Riesenscheins, in der gespeicherten Reihenfolge.
 *
 * @param {string} riesenscheinId
 * @returns {import('../kern/typen.js').Schein[]}
 */
export function scheineVon(riesenscheinId) {
  const riesenschein = stand.riesenscheine.find((r) => r.id === riesenscheinId)
  if (!riesenschein) return []
  const nachId = new Map(stand.scheine.map((s) => [s.id, s]))
  return riesenschein.scheinIds
    .map((id) => nachId.get(id))
    .filter(/** @returns {s is import('../kern/typen.js').Schein} */ (s) => Boolean(s))
}

/**
 * Die Rechnung eines Riesenscheins.
 *
 * @param {string} riesenscheinId
 * @returns {import('../kern/typen.js').Rechnung}
 */
export function rechnungVon(riesenscheinId) {
  return rechne(scheineVon(riesenscheinId))
}

/**
 * Aendert ein einzelnes Feld eines Scheins von Hand.
 *
 * Von Hand gesetzte Werte bekommen die Herkunft 'hand' und werden dadurch
 * bei jeder spaeteren Verarbeitung in Ruhe gelassen.
 *
 * @param {string} scheinId
 * @param {string} feldname
 * @param {any} wert
 */
export function setzeFeld(scheinId, feldname, wert) {
  const scheine = stand.scheine.map((schein) => {
    if (schein.id !== scheinId) return schein
    const kopie = { ...schein, geaendertAm: jetzt(), vonHand: true }
    if (feldname === 'status') {
      kopie.status = wert
    } else if (feldname === 'gratiswette' || feldname === 'eachWay' || feldname === 'ausgeschlossen') {
      /** @type {any} */ (kopie)[feldname] = Boolean(wert)
    } else {
      /** @type {any} */ (kopie)[feldname] = {
        wert,
        sicherheit: 1,
        quelle: 'hand',
        roh: /** @type {any} */ (schein)[feldname]?.roh ?? '',
      }
    }
    return kopie
  })
  ordneNeu(scheine)
}

/**
 * Verschiebt einen Schein in einen anderen Riesenschein.
 *
 * @param {string} scheinId
 * @param {string|null} zielId
 */
export function verschiebeSchein(scheinId, zielId) {
  const scheine = stand.scheine.map((s) =>
    s.id === scheinId ? { ...s, gruppeId: zielId, vonHand: true, geaendertAm: jetzt() } : s
  )
  ordneNeu(scheine)
}

/**
 * Benennt einen Riesenschein um.
 *
 * @param {string} id
 * @param {string} name
 */
export function benenneUm(id, name) {
  aendere({
    riesenscheine: stand.riesenscheine.map((r) =>
      r.id === id ? { ...r, name, geaendertAm: jetzt() } : r
    ),
  })
}

/**
 * Aendert die Reihenfolge der Scheine in einem Riesenschein.
 *
 * @param {string} id
 * @param {string[]} reihenfolge
 */
export function setzeReihenfolge(id, reihenfolge) {
  aendere({
    riesenscheine: stand.riesenscheine.map((r) =>
      r.id === id ? { ...r, scheinIds: reihenfolge, geaendertAm: jetzt() } : r
    ),
  })
}
