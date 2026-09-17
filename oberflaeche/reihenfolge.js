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
 * @param {{ordnerFilter: string|null, sortierung: string, suche?: string}} wie
 * @param {(id: string) => {einsatzGesamt: number}} rechnungVon
 * @param {((id: string) => any[])|null} [scheineVon] Fuer die Suche in den Scheinen.
 * @returns {any[]}
 */
export function ordne(riesenscheine, wie, rechnungVon, scheineVon = null) {
  const liste = [...(riesenscheine ?? [])]

  /*
    GESUCHT WIRD ZUERST, UND ZWAR UEBER ALLE ORDNER HINWEG.

    Karam am 17.09.2026: "Bitte bei der Uebersicht ein Suchpanel machen, wo man
    einfach etwas nach Zahl, Name suchen kann, wie beim Explorer, und man die
    finden kann, wenn man halt sehr viel hat. Dann sucht man den Namen des
    Riesenscheins oder den Namen des Ordners."

    Eine Suche, die nur im offenen Ordner sucht, ist keine Suche: wer suchen
    muss, weiss ja gerade nicht mehr, wo etwas liegt. Deshalb hebt ein
    Suchbegriff den Ordnerfilter auf. Der Ordner steht dafuer an jedem Treffer
    dabei, damit man sieht, wo er gefunden wurde.
  */
  const suchtext = String(wie.suche ?? '').trim().toLowerCase()

  const gefiltert =
    suchtext !== ''
      ? liste.filter((r) => passtZurSuche(r, suchtext, rechnungVon, scheineVon))
      : wie.ordnerFilter === null
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
 * Ob ein Riesenschein zu einem Suchbegriff passt.
 *
 * Karam: "nach Zahl, Name suchen, wie beim Explorer."
 *
 * GESUCHT WIRD IN:
 *   dem Namen des Riesenscheins
 *   dem Namen seines Ordners
 *   seiner Notiz
 *   den Anbietern und Scheinnummern der Scheine darin
 *   dem Gesamteinsatz, als Zahl
 *
 * Der Einsatz wird in ZWEI Schreibweisen verglichen: "5481" und "5.481,00".
 * Karam tippt mal das eine, mal das andere, und eine Suche, die "5481" nicht
 * findet, weil im Programm "5.481,00" steht, ist keine Hilfe.
 *
 * Mehrere Woerter muessen ALLE vorkommen, in beliebiger Reihenfolge. So findet
 * "spieltag gibbs" den Riesenschein Gibbs im Ordner Spieltag 3, ohne dass man
 * die Reihenfolge raten muss.
 *
 * @param {any} riesenschein
 * @param {string} suchtext  Schon klein geschrieben und beschnitten.
 * @param {(id: string) => any} rechnungVon
 * @param {((id: string) => any[])|null} scheineVon
 * @returns {boolean}
 */
function passtZurSuche(riesenschein, suchtext, rechnungVon, scheineVon) {
  const teile = [
    riesenschein.name ?? '',
    ordnerVon(riesenschein),
    riesenschein.notiz ?? '',
  ]

  const rechnung = rechnungVon(riesenschein.id)
  if (rechnung) {
    const roh = rechnung.einsatzGesamt ?? 0
    teile.push(String(Math.round(roh)))
    teile.push(roh.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  if (scheineVon) {
    for (const s of scheineVon(riesenschein.id) ?? []) {
      if (s.buchmacher?.wert) teile.push(s.buchmacher.wert)
      if (s.scheinNr?.wert) teile.push(s.scheinNr.wert)
    }
  }

  const heuhaufen = teile.join(' ').toLowerCase()
  return suchtext.split(/\s+/).every((wort) => heuhaufen.includes(wort))
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
