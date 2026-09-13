// @ts-check
/**
 * Dateien erzeugen und zum Herunterladen anbieten.
 *
 * Zwei Kleinigkeiten, die sonst Aerger machen:
 *   Eine CSV-Datei braucht am Anfang die Byte-Reihenfolge-Marke, sonst zeigt Excel
 *   unter Windows aus Umlauten Buchstabensalat.
 *   Im deutschen Excel trennt das Semikolon die Spalten, nicht das Komma. Mit einem
 *   Komma landet die ganze Zeile in einer einzigen Zelle.
 */

/** Die Marke, an der Excel erkennt, dass die Datei UTF-8 ist. */
const BOM = '﻿'

/**
 * Baut eine CSV-Datei.
 *
 * @param {string[]} kopf
 * @param {(string|number|null|undefined)[][]} zeilen
 * @param {{trenner?: ';'|',', gebiet?: 'de'|'en'}} [einstellungen]
 * @returns {Blob}
 */
export function baueCsv(kopf, zeilen, einstellungen = {}) {
  const gebiet = einstellungen.gebiet ?? 'de'
  const trenner = einstellungen.trenner ?? (gebiet === 'de' ? ';' : ',')

  /** @param {string|number|null|undefined} wert */
  const feld = (wert) => {
    if (wert === null || wert === undefined) return ''
    if (typeof wert === 'number') {
      if (!Number.isFinite(wert)) return ''
      // Im deutschen Excel ist das Komma das Dezimaltrennzeichen.
      return gebiet === 'de' ? String(wert).replace('.', ',') : String(wert)
    }
    const text = String(wert)
    if (text.includes(trenner) || text.includes('"') || text.includes('\n') || text.includes('\r')) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }

  const inhalt = [kopf, ...zeilen].map((zeile) => zeile.map(feld).join(trenner)).join('\r\n')
  return new Blob([BOM + inhalt], { type: 'text/csv;charset=utf-8' })
}

/**
 * Bietet eine Datei zum Herunterladen an.
 *
 * @param {Blob} inhalt
 * @param {string} dateiname
 */
export function biete(inhalt, dateiname) {
  const adresse = URL.createObjectURL(inhalt)
  const verweis = document.createElement('a')
  verweis.href = adresse
  verweis.download = sichererName(dateiname)
  verweis.rel = 'noopener'
  document.body.appendChild(verweis)
  verweis.click()
  document.body.removeChild(verweis)
  // Etwas warten, sonst bricht der Download in manchen Browsern ab.
  setTimeout(() => URL.revokeObjectURL(adresse), 4000)
}

/**
 * Macht aus einem beliebigen Text einen Dateinamen, der ueberall funktioniert.
 *
 * Umlaute werden ersetzt statt entfernt, damit der Name lesbar bleibt.
 *
 * @param {string} roh
 * @returns {string}
 */
export function sichererName(roh) {
  const ersetzt = String(roh)
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return ersetzt.length > 0 ? ersetzt.slice(0, 120) : 'datei'
}

/**
 * Zeitstempel fuer Dateinamen, zum Beispiel 2026-09-13_0231.
 *
 * @param {Date} [zeitpunkt]
 * @returns {string}
 */
export function zeitstempel(zeitpunkt = new Date()) {
  const zwei = (n) => String(n).padStart(2, '0')
  return (
    `${zeitpunkt.getFullYear()}-${zwei(zeitpunkt.getMonth() + 1)}-${zwei(zeitpunkt.getDate())}` +
    `_${zwei(zeitpunkt.getHours())}${zwei(zeitpunkt.getMinutes())}`
  )
}
