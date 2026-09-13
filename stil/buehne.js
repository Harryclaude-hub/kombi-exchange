// @ts-check
/**
 * Designschicht: der Schalter fuer die Bewegung.
 *
 * Diese Datei darf geloescht werden. Dann bleibt die Seite bei Stufe 1,
 * weil buehne.css genau das als Vorgabe hat. Es geht keine Funktion verloren.
 *
 * Hier entsteht kein einziges Rechenergebnis. Es wird nur ein Merkmal am
 * html-Element gesetzt, auf das die Stilvorlagen reagieren.
 */

const SPEICHERNAME = 'kombi.bewegung'

/** Die drei Stufen, so wie sie in buehne.css beschrieben sind. */
export const STUFEN = [
  { wert: 0, name: 'Ruhig', hilfe: 'Keine Bewegung. Schont Akku und schwache Geraete.' },
  { wert: 1, name: 'Normal', hilfe: 'Sanfte Uebergaenge. Vorgabe.' },
  { wert: 2, name: 'Voll', hilfe: 'Zusaetzliche Betonung. Nur fuer starke Rechner.' },
]

/**
 * Liest die gewaehlte Stufe.
 *
 * @returns {0|1|2}
 */
export function stufe() {
  try {
    const gemerkt = Number(localStorage.getItem(SPEICHERNAME))
    if (gemerkt === 0 || gemerkt === 1 || gemerkt === 2) return gemerkt
  } catch {
    // Ohne Speicher gilt die Vorgabe.
  }
  return 1
}

/**
 * Setzt die Stufe.
 *
 * @param {0|1|2} neu
 */
export function setzeStufe(neu) {
  try {
    localStorage.setItem(SPEICHERNAME, String(neu))
  } catch {
    // Auch ohne Speicher soll die Stufe fuer diese Sitzung gelten.
  }
  document.documentElement.dataset.bewegung = String(neu)
}

/** Setzt die gemerkte Stufe beim Start. */
export function starte() {
  document.documentElement.dataset.bewegung = String(stufe())
}
