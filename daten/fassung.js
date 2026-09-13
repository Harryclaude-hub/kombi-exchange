// @ts-check
/**
 * Prueft beim Start, ob der Browser eine veraltete Mischung geladen hat.
 *
 * Das Programm besteht aus vielen einzelnen Dateien, die der Browser einzeln
 * holt und einzeln zwischenspeichert. Nach einer Aktualisierung kann er deshalb
 * einige neue und einige alte Dateien im Speicher haben. Die Seite laeuft dann
 * mit einer Mischung, die es nie gegeben hat. Solche Fehler sind nicht
 * nachstellbar, weil sie von der Vorgeschichte genau dieses Browsers abhaengen.
 *
 * Deshalb: fassung.json wird ausdruecklich OHNE Zwischenspeicher geholt und mit
 * der Kennung verglichen, die in den geladenen Programmdateien steht. Weichen
 * sie ab, wird einmal neu geladen.
 *
 * Reine Vorsichtsmassnahme. Sie darf nie den Start verhindern: laesst sich
 * fassung.json nicht holen, laeuft das Programm ganz normal weiter.
 */

import { PROGRAMM_FASSUNG } from './einstellungen.js'

/** Damit ein Neuladen nicht in eine Schleife laufen kann. */
const SCHON_NEUGELADEN = 'kombi.fassung.neugeladen'

/**
 * @returns {Promise<{art: 'aktuell'|'veraltet'|'unbekannt', hier: string, dort: string, meldung: string}>}
 */
export async function pruefeFassung() {
  try {
    const antwort = await fetch('./fassung.json', { cache: 'no-store' })
    if (!antwort.ok) {
      return {
        art: 'unbekannt',
        hier: PROGRAMM_FASSUNG,
        dort: '',
        meldung: `fassung.json antwortet mit ${antwort.status}.`,
      }
    }
    const inhalt = await antwort.json()
    const dort = String(inhalt?.fassung ?? '')
    if (!dort) {
      return {
        art: 'unbekannt',
        hier: PROGRAMM_FASSUNG,
        dort: '',
        meldung: 'In fassung.json steht keine Fassung.',
      }
    }
    return {
      art: dort === PROGRAMM_FASSUNG ? 'aktuell' : 'veraltet',
      hier: PROGRAMM_FASSUNG,
      dort,
      meldung: '',
    }
  } catch (fehler) {
    // Kein Netz, oder oertlich geoeffnet. Beides ist kein Grund, nicht zu starten.
    return {
      art: 'unbekannt',
      hier: PROGRAMM_FASSUNG,
      dort: '',
      meldung: fehler instanceof Error ? fehler.message : String(fehler),
    }
  }
}

/**
 * Prueft und laedt hoechstens einmal neu.
 *
 * @returns {Promise<{neugeladen: boolean, art: string, meldung: string}>}
 */
export async function sorgeFuerAktuelleDateien() {
  const ergebnis = await pruefeFassung()

  if (ergebnis.art !== 'veraltet') {
    // Ist alles in Ordnung, wird die Sperre wieder aufgehoben, damit die
    // naechste Aktualisierung wieder ein Neuladen ausloesen darf.
    try {
      sessionStorage.removeItem(SCHON_NEUGELADEN)
    } catch {
      /* Manche Browser verbieten das. Dann eben nicht. */
    }
    return { neugeladen: false, art: ergebnis.art, meldung: ergebnis.meldung }
  }

  let schonVersucht = false
  try {
    schonVersucht = sessionStorage.getItem(SCHON_NEUGELADEN) === ergebnis.dort
  } catch {
    /* Ohne Sitzungsspeicher wird nicht neu geladen, sonst droht eine Schleife. */
    return {
      neugeladen: false,
      art: 'veraltet',
      meldung:
        'Die geladenen Dateien sind alt, aber ohne Sitzungsspeicher wird nicht ' +
        'automatisch neu geladen. Bitte die Seite einmal von Hand neu laden.',
    }
  }

  if (schonVersucht) {
    // Einmal neu geladen und immer noch alt. Dann liegt es nicht am
    // Zwischenspeicher des Browsers, sondern weiter vorne, etwa an einem
    // Zwischenspeicher im Netz. Jetzt nicht weiter neu laden, sondern sagen.
    return {
      neugeladen: false,
      art: 'veraltet',
      meldung:
        `Dieses Fenster laeuft mit Fassung ${ergebnis.hier}, aktuell ist ` +
        `${ergebnis.dort}. Neu laden hat nicht geholfen. Bitte den Zwischenspeicher ` +
        'des Browsers fuer diese Seite leeren.',
    }
  }

  try {
    sessionStorage.setItem(SCHON_NEUGELADEN, ergebnis.dort)
  } catch {
    /* siehe oben */
  }

  location.reload()
  return { neugeladen: true, art: 'veraltet', meldung: '' }
}
