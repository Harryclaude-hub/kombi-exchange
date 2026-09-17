// @ts-check
/**
 * Was der Mensch von Hand in ein Feld tippt, zu einer Zahl machen.
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * Die Felder im Reiter "Scheine" hatten ihre eigene Umwandlung:
 *
 *     value.trim().replace(/\./g, '').replace(',', '.')  und dann Number()
 *
 * Sie strich ALLE Punkte, bevor sie die Zahl las. Aus "5000.00" wurde damit
 * 500000 und aus "5,000.00", genau so wie es auf einem Stake-Schein steht,
 * wurde 5. Der Wert bekam danach Sicherheit 1 und die Herkunft "hand", und was
 * von Hand kommt, wird spaeter nie wieder ueberschrieben. Ein Tippfehler von
 * Faktor hundert stand also fuer immer in der Summe.
 *
 * Gefunden am 15.09.2026 bei der Gegenpruefung, repariert am 16.09.2026.
 *
 * WAS HIER NICHT PASSIERT
 *
 * Diese Datei deutet KEINEN Text selbst. Sie ruft kern/zahlen.js und
 * kern/parser.js auf, so wie werkzeug/training/ es schon immer getan hat. Sonst
 * gaebe es eine zweite Stelle, an der aus Text eine Zahl wird, und genau das
 * verbietet Projektregel 8.
 *
 * WAS SIE ZUSAETZLICH TUT
 *
 * Sie entscheidet, was bei einer mehrdeutigen Eingabe geschieht. Die Antwort
 * folgt Projektregel 1: wo ein Pruefstein greift, darf die Automatik
 * entscheiden, sonst nicht.
 *
 *   Geld   Es gibt keinen Pruefstein. "1.181" heisst deutsch 1181 und englisch
 *          1,181, das ist der Faktor tausend. Bleibt es mehrdeutig, wird NICHTS
 *          gespeichert und der Grund gemeldet.
 *
 *   Quote  Hier gibt es einen: eine Dezimalquote liegt ueber 1 und unter 1000.
 *          "1.854" ergibt deutsch gelesen 1854, und das ist keine Quote. Bleibt
 *          nach dieser Pruefung genau EINE Deutung uebrig, wird sie genommen
 *          und als solche gekennzeichnet. Bleiben zwei, wird nichts gespeichert.
 */

import { leseZahl } from './zahlen.js'
import { deuteQuote } from './parser.js'

/** Kleinste und groesste Dezimalquote, die es wirklich gibt. */
const QUOTE_KLEINSTE = 1.001
const QUOTE_GROESSTE = 1000

/**
 * @typedef {object} Handeingabe
 * @property {number|null} wert       null heisst: nicht deutbar, nichts speichern.
 * @property {boolean} mehrdeutig     true, wenn die Schreibweise nicht eindeutig war.
 * @property {boolean} ausPlausibilitaet
 *   true, wenn die Mehrdeutigkeit ueber den Pruefstein aufgeloest wurde.
 * @property {string} grund           Fuer den Menschen, leer wenn alles klar war.
 */

/**
 * Liest einen von Hand getippten Geldbetrag.
 *
 * @param {string} text
 * @param {'de'|'en'|null} [gebiet]  Die Schreibweise des Anbieters, falls bekannt.
 * @returns {Handeingabe}
 */
export function leseGeldEingabe(text, gebiet = 'de') {
  const sauber = typeof text === 'string' ? text.trim() : ''
  if (sauber === '') {
    return { wert: null, mehrdeutig: false, ausPlausibilitaet: false, grund: 'leer' }
  }

  const fund = leseZahl(sauber, gebiet ? { gebiet } : {})

  if (fund.wert === null) {
    return {
      wert: null,
      mehrdeutig: fund.mehrdeutig,
      ausPlausibilitaet: false,
      grund: fund.grund || 'Das lässt sich nicht als Betrag lesen.',
    }
  }

  if (fund.mehrdeutig) {
    // Beide Deutungen sind moegliche Betraege, und es gibt keinen Pruefstein,
    // der entscheidet. Also entscheidet der Mensch, nicht das Programm.
    const andere = gebiet === 'de' ? 'en' : 'de'
    const zweite = leseZahl(sauber, { gebiet: /** @type {'de'|'en'} */ (andere) })
    return {
      wert: null,
      mehrdeutig: true,
      ausPlausibilitaet: false,
      grund:
        `Unklar: das kann ${fund.wert} oder ${zweite.wert} heissen. ` +
        'Bitte eindeutig schreiben, zum Beispiel 5000,00 oder 5000.',
    }
  }

  return { wert: fund.wert, mehrdeutig: false, ausPlausibilitaet: false, grund: '' }
}

/**
 * Liest eine von Hand getippte Dezimalquote.
 *
 * @param {string} text
 * @param {'de'|'en'|null} [gebiet]
 * @returns {Handeingabe}
 */
export function leseQuoteEingabe(text, gebiet = 'de') {
  const sauber = typeof text === 'string' ? text.trim() : ''
  if (sauber === '') {
    return { wert: null, mehrdeutig: false, ausPlausibilitaet: false, grund: 'leer' }
  }

  // Eine amerikanische Quote gehoert NICHT in dieses Feld.
  //
  // deuteQuote rechnet "-157" bereitwillig in 1,63694 um. Genau diese
  // Umrechnung ist aber der teuerste Fallstrick des ganzen Projekts: die
  // angezeigte amerikanische Quote ist GERUNDET, und die Auszahlung verlangt in
  // Wahrheit 1,64. Wer sie umrechnet, liegt bei jedem Schein daneben
  // (FOTOS_KARAM.md, Abschnitt "Der teuerste Fallstrick im ganzen Satz").
  //
  // Als gelesener Wert ist das in Ordnung, denn dort korrigiert der Pruefstein
  // aus Einsatz und Auszahlung nach. Als HANDEINGABE nicht: sie bekommt
  // Sicherheit 1 und wird nie wieder ueberschrieben. Deshalb wird hier
  // abgelehnt und gesagt, was stattdessen zu tun ist.
  if (/^[+-]\s*\d{3,}$/.test(sauber.replace(/\s/g, ''))) {
    return {
      wert: null,
      mehrdeutig: false,
      ausPlausibilitaet: false,
      grund:
        'Das ist eine amerikanische Quote. Sie ist beim Anbieter gerundet, und ' +
        'umgerechnet liegt sie bei jedem Schein daneben. Trag stattdessen Einsatz und ' +
        'Auszahlung ein, dann rechnet das Programm den genauen Multiplikator selbst aus.',
    }
  }

  const plausibel = (w) => typeof w === 'number' && Number.isFinite(w) && w > QUOTE_KLEINSTE && w < QUOTE_GROESSTE

  const hier = deuteQuote(sauber, 'dezimal', gebiet ?? 'de')
  if (hier.dezimal !== null && !hier.mehrdeutig && plausibel(hier.dezimal)) {
    return { wert: hier.dezimal, mehrdeutig: false, ausPlausibilitaet: false, grund: '' }
  }

  // Der Pruefstein: eine Dezimalquote liegt zwischen 1 und 1000. Deutsch
  // gelesen wird aus "1.854" die Zahl 1854, und die ist keine Quote. Bleibt
  // genau eine plausible Deutung uebrig, ist sie belegt und nicht geraten.
  const anderes = /** @type {'de'|'en'} */ (gebiet === 'de' ? 'en' : 'de')
  const dort = deuteQuote(sauber, 'dezimal', anderes)

  const kandidaten = [hier.dezimal, dort.dezimal].filter(plausibel)
  const eindeutig = [...new Set(kandidaten)]

  if (eindeutig.length === 1) {
    const wert = eindeutig[0] ?? null
    return {
      wert,
      mehrdeutig: true,
      ausPlausibilitaet: true,
      grund: `Als Quote gelesen: ${wert}. Die andere Lesart waere keine gueltige Quote.`,
    }
  }

  if (eindeutig.length === 0) {
    return {
      wert: null,
      mehrdeutig: false,
      ausPlausibilitaet: false,
      grund: 'Das ist keine gueltige Quote. Eine Dezimalquote liegt zwischen 1 und 1000.',
    }
  }

  return {
    wert: null,
    mehrdeutig: true,
    ausPlausibilitaet: false,
    grund: `Unklar: das kann ${eindeutig.join(' oder ')} heissen. Bitte eindeutig schreiben.`,
  }
}
