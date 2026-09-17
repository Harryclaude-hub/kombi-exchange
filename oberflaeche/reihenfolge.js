// @ts-check
/**
 * Filtern und Sortieren der Riesenscheine.
 *
 * Karam am 17.09.2026: "ich will, dass die Anordnung der Riesenscheine
 * gefiltert werden kann. Man kann bestimmte Folder aussuchen oder folderlose
 * Scheine, und dann sie anordnen: neueste, alphabetisch, mit dem meisten Geld,
 * mit dem wenigsten Geld, zuletzt geoeffnet."
 *
 * WARUM DAS EINE EIGENE DATEI IST
 *
 * Die linke Spalte (zeichnePanel in app.js) und die Uebersicht in der Mitte
 * (ansicht_positionen.js) muessen dieselbe Reihenfolge zeigen. Staende die
 * Sortierung an beiden Stellen, saehe die Liste links irgendwann anders aus
 * als die Kacheln in der Mitte, und man wuesste nicht, welche stimmt
 * (Projektregel 8).
 *
 * HIER WIRD KEIN GELD GERECHNET. Die Betraege kommen fertig aus
 * kern/rechnung.js herein, hier werden sie nur verglichen.
 *
 * WELCHER ORDNER, entscheidet ordner.js an einer Stelle: ordnerVon nimmt seit
 * dem 17.09.2026 den RIESENSCHEIN und nicht mehr seine Kennung, weil der
 * Ordner jetzt am Riesenschein selbst steht und mit ihm in die Datenbank
 * wandert (supabase/migrations/0009).
 */

import { OHNE_ORDNER, ordnerVon } from './ordner.js'

/**
 * Die Sortierungen, in der Reihenfolge, in der sie im Auswahlfeld stehen.
 *
 * Der Schluessel steht auch im Zustand, deshalb sind beide Listen dieselbe
 * Wahrheit und muessen zusammen geaendert werden.
 */
export const SORTIERUNGEN = [
  { schluessel: 'neueste', name: 'Neueste zuerst' },
  { schluessel: 'zuletztGeoeffnet', name: 'Zuletzt geöffnet' },
  { schluessel: 'alphabetisch', name: 'Nach Name' },
  { schluessel: 'meisteGeld', name: 'Meistes Geld zuerst' },
  { schluessel: 'wenigsteGeld', name: 'Wenigstes Geld zuerst' },
]

/** Unter welchem Schluessel steht, was zuletzt geoeffnet war. */
const ZULETZT_SCHLUESSEL = 'kombi-zuletzt-geoeffnet'

/**
 * Merkt sich, dass ein Riesenschein geoeffnet wurde.
 *
 * Im Browser und nicht in der Datenbank: "zuletzt geoeffnet" ist eine Frage an
 * das Geraet, an dem man sitzt, nicht an das Projekt. Karams Kollege hat seine
 * eigene Reihenfolge, und das ist richtig so.
 *
 * @param {string} riesenscheinId
 */
export function merkeGeoeffnet(riesenscheinId) {
  try {
    const roh = localStorage.getItem(ZULETZT_SCHLUESSEL)
    const liste = roh ? JSON.parse(roh) : []
    const ohne = (Array.isArray(liste) ? liste : []).filter((x) => x !== riesenscheinId)
    // Neueste vorne, hoechstens fuenfzig behalten.
    localStorage.setItem(ZULETZT_SCHLUESSEL, JSON.stringify([riesenscheinId, ...ohne].slice(0, 50)))
  } catch {
    // Ohne Gedaechtnis faellt diese eine Sortierung auf die Reihenfolge der
    // Liste zurueck. Kein Grund, das Programm anzuhalten.
  }
}

/**
 * @returns {string[]}
 */
function zuletztGeoeffnet() {
  try {
    const roh = localStorage.getItem(ZULETZT_SCHLUESSEL)
    const liste = roh ? JSON.parse(roh) : []
    return Array.isArray(liste) ? liste.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Filtert und sortiert die Riesenscheine.
 *
 * @param {any[]} riesenscheine
 * @param {{ordnerFilter: string|null, sortierung: string}} wie
 * @param {(id: string) => {einsatzGesamt: number}} rechnungVon
 * @returns {any[]}
 */
export function ordne(riesenscheine, wie, rechnungVon) {
  const liste = [...(riesenscheine ?? [])]

  /*
    FILTERN ZUERST.

    null heisst alle. Der leere Text heisst ausdruecklich "die ohne Ordner",
    und das ist etwas anderes als "alle". Karam hat beides genannt, und
    ohne die Unterscheidung faende man die Riesenscheine ohne Ordner nie
    wieder, sobald es viele gibt.
  */
  const gefiltert =
    wie.ordnerFilter === null
      ? liste
      : liste.filter((r) => ordnerVon(r) === wie.ordnerFilter)

  // Die Einsaetze einmal holen und nicht je Vergleich. Bei sechzig Scheinen je
  // Riesenschein waere das sonst spuerbar.
  /** @type {Map<string, number>} */
  const einsatz = new Map()
  if (wie.sortierung === 'meisteGeld' || wie.sortierung === 'wenigsteGeld') {
    for (const r of gefiltert) einsatz.set(r.id, rechnungVon(r.id).einsatzGesamt ?? 0)
  }

  const zuletzt = wie.sortierung === 'zuletztGeoeffnet' ? zuletztGeoeffnet() : []

  const sortiert = [...gefiltert]
  switch (wie.sortierung) {
    case 'alphabetisch':
      sortiert.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'de'))
      break
    case 'meisteGeld':
      sortiert.sort((a, b) => (einsatz.get(b.id) ?? 0) - (einsatz.get(a.id) ?? 0))
      break
    case 'wenigsteGeld':
      sortiert.sort((a, b) => (einsatz.get(a.id) ?? 0) - (einsatz.get(b.id) ?? 0))
      break
    case 'zuletztGeoeffnet': {
      // Was nie geoeffnet wurde, kommt ans ENDE und nicht an den Anfang.
      // Sonst stuende das Unbekannte vor dem Bekannten.
      const platz = (id) => {
        const i = zuletzt.indexOf(id)
        return i === -1 ? Number.MAX_SAFE_INTEGER : i
      }
      sortiert.sort((a, b) => platz(a.id) - platz(b.id))
      break
    }
    case 'neueste':
    default:
      // angelegtAm ist eine ISO-Zeichenkette, die laesst sich als Text
      // vergleichen. Fehlt sie, zaehlt der Riesenschein als aeltest.
      sortiert.sort((a, b) => String(b.angelegtAm ?? '').localeCompare(String(a.angelegtAm ?? '')))
      break
  }

  return sortiert
}

/**
 * Die Summe eines Ordners.
 *
 * Karam am 17.09.2026: "die Ordner werden auch miteinander gerechnet."
 *
 * HIER WIRD NICHT GERECHNET, sondern zusammengezaehlt, was kern/rechnung.js
 * je Riesenschein schon geliefert hat. Und es wird NIE ueber Waehrungen hinweg
 * summiert: kommen mehrere vor, bleibt die Summe null und gemischt ist wahr.
 * Das ist dieselbe Regel wie ueberall sonst im Programm.
 *
 * @param {any[]} riesenscheine
 * @param {string} ordner
 * @param {(id: string) => any} rechnungVon
 * @returns {{anzahl: number, einsatz: number, moeglich: number, ergebnis: number, waehrung: string, gemischt: boolean}}
 */
export function ordnersumme(riesenscheine, ordner, rechnungVon) {
  const drin = riesenscheine.filter((r) => ordnerVon(r) === ordner)
  const rechnungen = drin.map((r) => rechnungVon(r.id))

  const waehrungen = new Set(
    rechnungen.map((r) => r.waehrung).filter((w) => w && w !== 'UNBEKANNT')
  )
  const gemischt = waehrungen.size > 1

  if (gemischt) {
    return {
      anzahl: drin.length,
      einsatz: 0,
      moeglich: 0,
      ergebnis: 0,
      waehrung: 'UNBEKANNT',
      gemischt: true,
    }
  }

  return {
    anzahl: drin.length,
    einsatz: rechnungen.reduce((s, r) => s + (r.einsatzGesamt ?? 0), 0),
    moeglich: rechnungen.reduce((s, r) => s + (r.auszahlungMoeglich ?? 0), 0),
    ergebnis: rechnungen.reduce((s, r) => s + (r.ergebnisRealisiert ?? 0), 0),
    waehrung: /** @type {string} */ ([...waehrungen][0] ?? 'UNBEKANNT'),
    gemischt: false,
  }
}

export { OHNE_ORDNER }
