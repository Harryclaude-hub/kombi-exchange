// @ts-check
/**
 * Geldbetraege.
 *
 * Innerhalb einer Rechnung wird in ganzen Cent gerechnet, nie in Kommazahlen.
 * Der Grund: 0.1 plus 0.2 ergibt in Gleitkomma 0.30000000000000004. Ueber
 * hunderte Scheine summiert sich das zu sichtbaren Rundungsfehlern, und bei
 * Einsaetzen im fuenfstelligen Bereich faellt das auf.
 *
 * Reine Logik. Die Formatierung erzeugt nur Text, keine Farben und kein Layout.
 */

import { runde } from './zahlen.js'

/** @typedef {import('./typen.js').Waehrung} Waehrung */

/** Anzeigezeichen je Waehrung. */
export const WAEHRUNGSZEICHEN = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF',
  UNBEKANNT: '',
}

/**
 * Wandelt einen Betrag in ganze Cent.
 *
 * @param {number|null|undefined} betrag
 * @returns {number} Ganze Cent. Bei ungueltiger Eingabe 0.
 */
export function zuCent(betrag) {
  if (typeof betrag !== 'number' || !Number.isFinite(betrag)) return 0
  return Math.round(runde(betrag, 2) * 100)
}

/**
 * Wandelt ganze Cent zurueck in einen Betrag.
 *
 * @param {number} cent
 * @returns {number}
 */
export function vonCent(cent) {
  if (!Number.isFinite(cent)) return 0
  return cent / 100
}

/**
 * Summiert Betraege ohne Rundungsdrift.
 *
 * @param {(number|null|undefined)[]} betraege
 * @returns {number}
 */
export function summe(betraege) {
  let cent = 0
  for (const betrag of betraege) cent += zuCent(betrag)
  return vonCent(cent)
}

/**
 * Formatiert einen Betrag als Text.
 *
 * @param {number|null|undefined} betrag
 * @param {Waehrung} [waehrung]
 * @param {'de'|'en'} [gebiet]
 * @param {{ohneZeichen?: boolean, stellen?: number}} [einstellungen]
 * @returns {string}
 */
export function formatiere(betrag, waehrung = 'UNBEKANNT', gebiet = 'de', einstellungen = {}) {
  if (typeof betrag !== 'number' || !Number.isFinite(betrag)) return '-'
  const stellen = einstellungen.stellen ?? 2
  const sprache = gebiet === 'de' ? 'de-DE' : 'en-US'

  const zahl = new Intl.NumberFormat(sprache, {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  }).format(runde(betrag, stellen))

  if (einstellungen.ohneZeichen || waehrung === 'UNBEKANNT') return zahl

  const zeichen = WAEHRUNGSZEICHEN[waehrung] ?? ''
  // Im deutschen Raum steht das Zeichen hinten, im englischen vorn.
  return gebiet === 'de' ? `${zahl} ${zeichen}` : `${zeichen}${zahl}`
}

/**
 * Formatiert eine Quote.
 *
 * @param {number|null|undefined} dezimal
 * @param {'dezimal'|'amerikanisch'} [art]
 * @param {'de'|'en'} [gebiet]
 * @returns {string}
 */
export function formatiereQuote(dezimal, art = 'dezimal', gebiet = 'de') {
  if (typeof dezimal !== 'number' || !Number.isFinite(dezimal)) return '-'
  if (art === 'amerikanisch') {
    if (dezimal <= 1) return '-'
    const us = dezimal >= 2 ? (dezimal - 1) * 100 : -100 / (dezimal - 1)
    const gerundet = Math.round(us)
    return gerundet > 0 ? `+${gerundet}` : String(gerundet)
  }
  const sprache = gebiet === 'de' ? 'de-DE' : 'en-US'
  return new Intl.NumberFormat(sprache, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(runde(dezimal, 2))
}

/**
 * Das Zahlenformat fuer Excel je Waehrung.
 * Excel braucht das Format als Zeichenkette, damit die Zelle eine echte Zahl bleibt
 * und nicht als Text abgelegt wird.
 *
 * @param {Waehrung} waehrung
 * @param {'de'|'en'} [gebiet]
 * @returns {string}
 */
export function excelFormat(waehrung, gebiet = 'de') {
  const grund = gebiet === 'de' ? '#,##0.00' : '#,##0.00'
  switch (waehrung) {
    case 'USD':
      return gebiet === 'de' ? `${grund} "$"` : `"$"${grund}`
    case 'EUR':
      return gebiet === 'de' ? `${grund} "€"` : `"€"${grund}`
    case 'GBP':
      return gebiet === 'de' ? `${grund} "£"` : `"£"${grund}`
    case 'CHF':
      return `${grund} "CHF"`
    default:
      return grund
  }
}
