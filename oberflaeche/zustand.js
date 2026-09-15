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
/**
 * Wie lange eine Meldung stehen bleibt, in Millisekunden.
 *
 * WARUM NICHT ALLE GLEICH
 *
 * Eine Bestaetigung ("Bild entfernt") hat ihren Zweck erfuellt, sobald man sie
 * gelesen hat. Sie geht von selbst. Eine Warnung braucht laenger, weil man
 * vielleicht erst zu Ende tippt.
 *
 * Ein FEHLER bleibt stehen, bis der Mensch ihn wegklickt. Das ist die ganze
 * Regel in einem Satz: was Geld betrifft, verschwindet nicht von allein. Eine
 * Fehlermeldung, die nach vier Sekunden weg ist, ist dasselbe wie keine
 * Fehlermeldung, und genau davor warnt die Fehlerklasse "stille Fehlschlaege".
 */
const MELDUNG_DAUER = {
  erfolg: 4000,
  info: 5000,
  warnung: 9000,
  fehler: 0,
}

export function melde(art, text) {
  const meldung = { id: neueKennung(), art, text, zeit: jetzt() }
  // Neueste zuerst, hoechstens fuenfzig behalten.
  aendere({ meldungen: [meldung, ...stand.meldungen].slice(0, 50) })

  const dauer = MELDUNG_DAUER[art] ?? 5000
  if (dauer > 0) {
    // setTimeout und nicht requestAnimationFrame: der Merksatz aus diesem
    // Projekt lautet, nichts an der Sichtbarkeit des Fensters aufzuhaengen.
    // In einem verdeckten Reiter wuerde die Meldung sonst nie verschwinden.
    setTimeout(() => meldungWeg(meldung.id), dauer)
  }
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
 * Setzt die Notiz eines Riesenscheins.
 *
 * @param {string} id
 * @param {string} notiz
 */
export function setzeRiesenscheinNotiz(id, notiz) {
  aendere({
    riesenscheine: stand.riesenscheine.map((r) =>
      r.id === id ? { ...r, notiz: String(notiz ?? ''), geaendertAm: jetzt() } : r
    ),
  })
}

/**
 * Setzt die Notiz eines einzelnen Scheins.
 *
 * Eine Notiz ist KEIN Feld mit Herkunft und Sicherheit wie Einsatz oder Quote:
 * sie wird nie gelesen, nie gerechnet und nie gegengeprueft. Sie ist ein
 * schlichter Text am Schein. Deshalb laeuft sie nicht ueber setzeFeld und setzt
 * auch vonHand nicht: wer eine Bemerkung schreibt, hat damit keinen Wert von
 * Hand bestaetigt, und ein spaeteres Neulesen soll den Schein weiter berichtigen
 * duerfen.
 *
 * @param {string} scheinId
 * @param {string} notiz
 */
export function setzeScheinNotiz(scheinId, notiz) {
  aendere({
    scheine: stand.scheine.map((s) =>
      s.id === scheinId ? { ...s, notiz: String(notiz ?? ''), geaendertAm: jetzt() } : s
    ),
  })
}

/**
 * Entfernt einen einzelnen Schein.
 *
 * WOZU: Karam fotografiert in Mengen. Ein Ausschnitt trifft danebem, eine Karte
 * wird doppelt erfasst, ein Schein gehoert gar nicht in dieses Projekt. Ohne
 * einen Weg, genau diesen einen loszuwerden, bleibt nur "alles verwerfen".
 *
 * Der Riesenschein bleibt bestehen, auch wenn er dadurch leer wird: ordneNeu
 * baut die Gruppen aus den verbliebenen Scheinen neu, und Name und Notiz
 * ueberleben ueber die Kennung. Wer den letzten Schein einer Gruppe entfernt,
 * hat die Gruppe damit aufgeloest, und das ist dieselbe Entscheidung.
 *
 * @param {string} scheinId
 */
export function entferneSchein(scheinId) {
  const vorher = stand.scheine.length
  const scheine = stand.scheine.filter((s) => s.id !== scheinId)
  if (scheine.length === vorher) return
  ordneNeu(scheine)
}

/**
 * Entfernt ein Bild und alle Scheine, die daraus gelesen wurden.
 *
 * Beides gehoert zusammen: ein Schein ohne sein Bild laesst sich nie wieder
 * nachpruefen, und ein Bild ohne seine Scheine erzeugt beim naechsten Lesen
 * Doppelgaenger. Wie viele Scheine mitgehen, gibt die Funktion zurueck, damit
 * die Ansicht vorher fragen kann.
 *
 * @param {string} bildId
 * @returns {number} wie viele Scheine mit entfernt wurden
 */
export function entferneBild(bildId) {
  const bilder = new Map(stand.bilder)
  if (!bilder.delete(bildId)) return 0

  const betroffen = stand.scheine.filter((s) => s.bildId === bildId)
  aendere({ bilder })
  if (betroffen.length > 0) {
    ordneNeu(stand.scheine.filter((s) => s.bildId !== bildId))
  }
  return betroffen.length
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
