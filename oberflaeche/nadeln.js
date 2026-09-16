// @ts-check
/**
 * Die Nadeln fuer das Panel links.
 *
 * Karam am 16.09.2026: "man kann customizen, das ist einfach Shortcuts."
 * Was angeheftet ist, steht im Panel links und ist von jeder Ansicht aus einen
 * Klick entfernt.
 *
 * WARUM DAS EINE EIGENE DATEI IST
 *
 * Die Nadeln werden an zwei Stellen gebraucht: das Panel in app.js zeigt sie,
 * die Ansicht Riesenscheine legt sie um. Lebten sie in app.js, muesste die
 * Ansicht app.js einbinden, und app.js bindet die Ansicht ein: ein Ring.
 * ES-Module kommen damit zwar zurecht, solange nur Funktionen gemeint sind,
 * aber es ist die Art Abhaengigkeit, die beim naechsten Umbau zuschnappt.
 *
 * WARUM IM BROWSER UND NICHT IN DER DATENBANK
 *
 * Eine Nadel ist eine Gewohnheit, keine Wahrheit ueber das Projekt. Sie sagt
 * nichts ueber Geld aus und muss deshalb nirgends gesichert werden. Auf einem
 * zweiten Rechner darf eine andere Auswahl angeheftet sein.
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5).
 */

/** Unter welchem Schluessel die angehefteten Sachen im Browser liegen. */
const SCHLUESSEL = 'kombi-panel'

/** @type {Set<() => void>} */
const zuhoerer = new Set()

/**
 * Alle angehefteten Kennungen.
 *
 * @returns {string[]}
 */
function hole() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    const wert = roh ? JSON.parse(roh) : []
    // Ein kaputter oder fremder Eintrag darf das Panel nicht mitnehmen.
    return Array.isArray(wert) ? wert.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * @param {string[]} liste
 */
function merke(liste) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(liste))
  } catch {
    // Kein Platz im Browser oder kein Zugriff darauf: dann haelt die Nadel nur,
    // solange das Fenster offen ist. Das ist kein Grund, das Programm
    // anzuhalten, und erst recht kein Grund fuer eine rote Meldung.
  }
}

/**
 * Alle angehefteten Kennungen, in der Reihenfolge des Anheftens.
 *
 * @returns {string[]}
 */
export function alle() {
  return hole()
}

/**
 * Ob diese Sache angeheftet ist.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function istAngeheftet(id) {
  return hole().includes(id)
}

/**
 * Anheften oder wieder abnehmen.
 *
 * @param {string} id
 */
export function heftAn(id) {
  const liste = hole()
  merke(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id])
  for (const was of zuhoerer) was()
}

/**
 * Sagt Bescheid, wenn sich an den Nadeln etwas geaendert hat.
 *
 * @param {() => void} was
 */
export function hoerZu(was) {
  zuhoerer.add(was)
}
