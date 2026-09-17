// @ts-check
/**
 * Ordner fuer Riesenscheine.
 *
 * Karam am 17.09.2026: "In einem Ordner sind Riesenscheine drinnen. Und diese
 * Ordner werden auch miteinander gerechnet."
 *
 * WO DIE ZUORDNUNG LIEGT, UND WARUM SIE DORT LIEGT
 *
 * Am Riesenschein selbst, im Feld `ordner`, und damit in der Datenbank.
 *
 * Bis zur Fassung 2026-09-17-b lag sie im Browserspeicher, weil
 * kombi.riesenscheine keine Spalte dafuer hatte. Im Programm stand deshalb, die
 * Ordner lagen "nur auf diesem Geraet". Karam am 17.09.2026 dazu:
 *
 *   "Du musst verstehen, dieses Programm ist ein Account. Es wird alles auf
 *   einer Datenbank gespeichert, in Supabase. Und ich sehe jedes Foto, jeden
 *   Schein, den eine Person macht, und die Person genauso bei mir. Das ist kein
 *   eigenes Profil. Das ist einfach DAS Profil."
 *
 * Er hat recht, und der Satz im Programm hat eine fehlende Spalte wie eine
 * Eigenschaft des Programms aussehen lassen. Die Spalte kommt mit
 * supabase/migrations/0009.
 *
 * EIN ORDNER IST NUR EIN NAME AM RIESENSCHEIN, keine eigene Sache. Er besteht,
 * solange ein Riesenschein darin liegt, und verschwindet sonst von selbst.
 * Genau so ist es bei den Projekten in der Ablage auch geloest
 * (supabase/migrations/0008), und zwei verschiedene Bauarten fuer dasselbe
 * waeren eine Quelle fuer Verwirrung.
 *
 * DIESE DATEI AENDERT NICHTS. Sie liest nur und sagt, was ein sauberer Name
 * ist. Gesetzt wird der Ordner in zustand.js, dort wo auch Name und Notiz
 * gesetzt werden (Projektregel 8).
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5).
 */

/** Der Name, unter dem alles ohne Ordner laeuft. */
export const OHNE_ORDNER = ''

/**
 * DIE BRUECKE AUS DEM BROWSERSPEICHER.
 *
 * Wer zwischen dem 17.09.2026 und der Migration 0009 Ordner angelegt hat, hat
 * sie hier liegen. Sie duerfen nicht einfach verschwinden, nur weil die
 * Zuordnung umgezogen ist.
 *
 * EINE EINBAHNSTRASSE: es wird nur noch GELESEN und nur dort eingesetzt, wo am
 * Riesenschein selbst nichts steht. Sobald jemand einen Ordner von Hand setzt,
 * faellt der alte Eintrag weg (siehe vergissBruecke). Damit kann ein Ordner,
 * den Karam ausdruecklich entfernt hat, nicht wieder auftauchen.
 */
const BRUECKE_SCHLUESSEL = 'kombi-riesenschein-ordner'

/**
 * Die alte Zuordnung aus dem Browserspeicher, Riesenschein-Kennung auf Name.
 *
 * @returns {Record<string, string>}
 */
function bruecke() {
  try {
    const roh = localStorage.getItem(BRUECKE_SCHLUESSEL)
    const wert = roh ? JSON.parse(roh) : {}
    if (!wert || typeof wert !== 'object' || Array.isArray(wert)) return {}
    /** @type {Record<string, string>} */
    const sauber = {}
    for (const [id, ordner] of Object.entries(wert)) {
      if (typeof id === 'string' && typeof ordner === 'string') sauber[id] = ordner
    }
    return sauber
  } catch {
    // Ein kaputter Eintrag darf die Ansicht nicht mitnehmen.
    return {}
  }
}

/**
 * Nimmt eine Kennung aus der Bruecke heraus.
 *
 * Wird gerufen, sobald jemand den Ordner dieses Riesenscheins von Hand setzt.
 * Danach gilt nur noch, was am Riesenschein steht.
 *
 * @param {string} riesenscheinId
 */
export function vergissBruecke(riesenscheinId) {
  try {
    const alt = bruecke()
    if (alt[riesenscheinId] === undefined) return
    delete alt[riesenscheinId]
    if (Object.keys(alt).length === 0) localStorage.removeItem(BRUECKE_SCHLUESSEL)
    else localStorage.setItem(BRUECKE_SCHLUESSEL, JSON.stringify(alt))
  } catch {
    // Kein Speicher: dann bleibt der alte Eintrag stehen und wird beim
    // naechsten Laden wieder eingesetzt. Kein Grund, etwas anzuhalten.
  }
}

/**
 * Wie viele Zuordnungen noch in der Bruecke liegen.
 *
 * Nur zum Anzeigen: solange hier etwas liegt, ist es noch nicht bei Karams
 * Kollegen angekommen.
 *
 * @returns {number}
 */
export function brueckenreste() {
  return Object.keys(bruecke()).length
}

/**
 * In welchem Ordner ein Riesenschein liegt. Leerer Text heisst: in keinem.
 *
 * Was am Riesenschein steht, gilt. Steht dort nichts, greift die alte
 * Zuordnung aus dem Browser, damit nichts verloren geht.
 *
 * @param {{id: string, ordner?: string}} riesenschein
 * @returns {string}
 */
export function ordnerVon(riesenschein) {
  if (!riesenschein) return OHNE_ORDNER
  const amSchein = String(riesenschein.ordner ?? '').trim()
  if (amSchein !== OHNE_ORDNER) return amSchein
  return bruecke()[riesenschein.id] ?? OHNE_ORDNER
}

/**
 * Was aus einem eingetippten Ordnernamen wird.
 *
 * Ein Ordnername ist nur Text. Die einzige Regel: aussen keine Leerzeichen,
 * sonst waeren " Woche 1" und "Woche 1" zwei Ordner, die gleich aussehen.
 *
 * @param {string} text
 * @returns {string}
 */
export function sauberName(text) {
  return String(text ?? '').trim()
}

/**
 * Alle Ordner, die es gerade gibt, mit der Zahl der Riesenscheine darin.
 *
 * Es werden nur Ordner gezaehlt, in denen wirklich etwas liegt: ein Ordner
 * ist kein eigenes Ding, sondern eine Beschriftung.
 *
 * @param {{id: string, ordner?: string}[]} riesenscheine
 * @returns {{name: string, anzahl: number}[]}
 */
export function alleOrdner(riesenscheine) {
  /** @type {Map<string, number>} */
  const zaehler = new Map()
  for (const r of riesenscheine ?? []) {
    const ordner = ordnerVon(r)
    if (ordner === OHNE_ORDNER) continue
    zaehler.set(ordner, (zaehler.get(ordner) ?? 0) + 1)
  }
  return [...zaehler.entries()]
    .map(([name, anzahl]) => ({ name, anzahl }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/**
 * Wie viele Riesenscheine in keinem Ordner liegen.
 *
 * @param {{id: string, ordner?: string}[]} riesenscheine
 * @returns {number}
 */
export function anzahlOhneOrdner(riesenscheine) {
  return (riesenscheine ?? []).filter((r) => ordnerVon(r) === OHNE_ORDNER).length
}

/**
 * Nur die Riesenscheine eines Ordners.
 *
 * @param {{id: string, ordner?: string}[]} riesenscheine
 * @param {string} ordner
 * @returns {{id: string, ordner?: string}[]}
 */
export function imOrdner(riesenscheine, ordner) {
  return (riesenscheine ?? []).filter((r) => ordnerVon(r) === ordner)
}
