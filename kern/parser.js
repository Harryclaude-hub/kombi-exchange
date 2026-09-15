// @ts-check
/**
 * Der Schein-Leser.
 *
 * Aus den Textzeilen einer einzelnen Wettkarte wird ein vollstaendiger Schein.
 * Die Felder haengen an ihren Beschriftungen, nicht an festen Bildkoordinaten.
 * Damit funktioniert derselbe Leser bei jedem Buchmacher, solange die Beschriftung
 * in der Liste steht.
 *
 * Grundsaetze dieser Datei:
 *   - Nichts wird stillschweigend verworfen. Was nicht gedeutet werden kann,
 *     landet als Hinweis im Schein und bleibt sichtbar.
 *   - Jede Zahl wird gegengerechnet, bevor sie als gueltig gilt.
 *   - Der Leser rechnet nie selbst. Er ruft dafuer die Quotenmathematik auf.
 *
 * Reine Logik. Keine Anzeige.
 */

import {
  leseZahl,
  leseAmerikanischeQuote,
  erkenneWaehrung,
  ZIFFERNZEICHEN,
  MINUS_KLASSE,
  alsKlasse,
} from './zahlen.js'
import { versoehne, amerikanischNachDezimal, dezimalNachAmerikanisch, kombiquote } from './quoten.js'
import { leseZeitpunkt } from './zeitpunkt.js'
import {
  EINSATZ_ETIKETTEN,
  AUSZAHLUNG_ETIKETTEN,
  QUOTE_ETIKETTEN,
  SCHEINNUMMER_ETIKETTEN,
  STATUS_ETIKETTEN,
  KOMBI_MUSTER,
  SYSTEM_MUSTER,
  GRATIS_MUSTER,
  EACHWAY_MUSTER,
  BOOST_MUSTER,
} from './etiketten.js'
import { geldZeigtPotenzial } from './status.js'
import { repariereBetraege } from './reparatur.js'

/**
 * @typedef {object} Etikettstelle
 * @property {number} start
 * @property {number} ende
 * @property {'einsatz'|'auszahlung'|'quote'} art
 * @property {'auszahlung'|'gewinn'|'unklar'|null} bedeutung
 * @property {string} wort
 */

/** Alle Etiketten in einer Liste, lang vor kurz, damit das laengste zuerst greift. */
const ETIKETTLISTE = [
  ...EINSATZ_ETIKETTEN.map((w) => ({
    wort: w, art: /** @type {const} */ ('einsatz'), bedeutung: /** @type {null} */ (null),
  })),
  ...AUSZAHLUNG_ETIKETTEN.map((e) => ({
    wort: e.wort, art: /** @type {const} */ ('auszahlung'), bedeutung: e.bedeutung,
  })),
  ...QUOTE_ETIKETTEN.map((w) => ({
    wort: w, art: /** @type {const} */ ('quote'), bedeutung: /** @type {null} */ (null),
  })),
].sort((a, b) => b.wort.length - a.wort.length)

/** Buchstaben, die eine Wortgrenze verhindern. Umlaute zaehlen als Buchstaben. */
const BUCHSTABE = /[a-zA-ZäöüÄÖÜßàâçéèêëîïôûùüÿñæœ]/

/**
 * Erzeugt ein Feld mit Herkunft.
 *
 * @template T
 * @param {T|null} wert
 * @param {number} sicherheit
 * @param {import('./typen.js').Quelle} quelle
 * @param {string} [roh]
 * @returns {import('./typen.js').Feld<T>}
 */
export function feld(wert, sicherheit, quelle, roh) {
  return { wert, sicherheit, quelle, roh: roh ?? '' }
}

/**
 * Findet alle Etiketten in einer Zeile.
 *
 * @param {string} zeile
 * @returns {Etikettstelle[]}
 */
export function findeEtikettstellen(zeile) {
  const klein = zeile.toLowerCase()
  /** @type {Etikettstelle[]} */
  const stellen = []

  for (const eintrag of ETIKETTLISTE) {
    let ab = 0
    for (;;) {
      const start = klein.indexOf(eintrag.wort, ab)
      if (start === -1) break
      const ende = start + eintrag.wort.length
      ab = ende

      const davor = start === 0 ? '' : klein.charAt(start - 1)
      const danach = ende >= klein.length ? '' : klein.charAt(ende)
      if (davor && BUCHSTABE.test(davor)) continue
      if (danach && BUCHSTABE.test(danach)) continue

      // Ein laengeres Etikett an derselben Stelle hat Vorrang.
      if (stellen.some((s) => start < s.ende && ende > s.start)) continue

      stellen.push({ start, ende, art: eintrag.art, bedeutung: eintrag.bedeutung, wort: eintrag.wort })
    }
  }

  stellen.sort((a, b) => a.start - b.start)
  return stellen
}

/**
 * Die Muster, mit denen eine Zahl im Fliesstext gefunden wird.
 *
 * Sie werden aus kern/zahlen.js gebaut, NICHT hier noch einmal hingeschrieben.
 * Vorher stand hier eine zweite, kuerzere Liste verlesener Ziffern: T, Q, D,
 * E, A, h und der senkrechte Strich fehlten. Aus "2QQ" wurde deshalb 2 statt
 * 200, und zwar mit Sicherheit 0,9, weil nichts als ersetzt vermerkt wurde.
 * Genau denselben Text las leseZahl richtig. Siehe test/verlesen.test.mjs.
 */
const ZIFFERNKLASSE = alsKlasse(ZIFFERNZEICHEN)
const VORZEICHEN_MUSTER = new RegExp(`[+${MINUS_KLASSE}]\\s?\\d`)
const ZAHLENSTART = new RegExp(`[0-9${ZIFFERNKLASSE}]`)
const ZAHLENMUSTER = new RegExp(
  `[+${MINUS_KLASSE}]?\\s?` +
    `(?:\\d|[${ZIFFERNKLASSE}](?=[\\d${ZIFFERNKLASSE}]))` +
    `[\\d${ZIFFERNKLASSE}.,'\\u0020\\u00A0\\u202F]*`
)

/**
 * Besteht diese Zeile wirklich nur aus Werten?
 *
 * WOZU: die Regel "steht hinter der Beschriftung keine Zahl, dann steht der
 * Wert in der naechsten Zeile" ist bei Karten mit Spalten unverzichtbar. Ohne
 * Bremse frisst sie aber jede beliebige Zeile.
 *
 * Am 14.09.2026 an einer PS3838-Tabelle gemessen: das Wort "WIN" am Zeilenende
 * gilt als unklarer Auszahlungsbegriff, dahinter stand nichts, und die
 * naechste Zeile war "2026-09-13 11:35:43 Player Props D". Aus der JAHRESZAHL
 * wurde ein Gewinn von 2026, daraus eine Auszahlung von 4.341,98 und eine
 * Quote von 1,8748. Nichts davon steht auf dem Schein.
 *
 * Eine Wertzeile besteht aus ein bis drei Spalten, und jede davon ist nach
 * Abzug von Waehrungszeichen und Vorzeichen eine nackte Zahl. Ein Datum
 * (2026-09-13), eine Uhrzeit (11:35:43) und Fliesstext fallen damit heraus.
 *
 * Projektregel 1: wo kein Pruefstein ist, entscheidet der Mensch. Lieber kein
 * Wert und ein sichtbarer Hinweis als ein erfundener Wert.
 * Siehe test/wertzeile.test.mjs.
 *
 * @param {string} zeile
 */
export function istWertzeile(zeile) {
  if (typeof zeile !== 'string') return false
  const ohneWaehrung = zeile
    .normalize('NFKC')
    .replace(/US\$|\bUSD\b|\bEUR\b|\bGBP\b|\bCHF\b|Fr\.|[$€£]/gi, ' ')
    .trim()
  if (ohneWaehrung === '' || !/[0-9]/.test(ohneWaehrung)) return false

  const spalten = ohneWaehrung.split(/\s{2,}/).map((s) => s.trim()).filter((s) => s !== '')
  // Mehr als drei Spalten ist keine Wertzeile mehr, sondern eine Tabellenzeile.
  if (spalten.length === 0 || spalten.length > 3) return false

  return spalten.every((s) => NACKTE_ZAHL.test(s))
}

/**
 * Eine nackte Zahl: Vorzeichen, Ziffern, Trennzeichen, sonst nichts.
 * Ein einzelnes Leerzeichen als Tausendertrenner ist erlaubt, ein Doppelpunkt
 * (Uhrzeit) und ein Bindestrich mitten drin (Datum) sind es nicht.
 */
const NACKTE_ZAHL = new RegExp(`^[+${MINUS_KLASSE}]?\\s?\\d[\\d.,']*(?: \\d[\\d.,']*)*$`)

/**
 * Holt die erste Zahl aus einem Textabschnitt.
 *
 * @param {string} abschnitt
 * @param {{gebiet?: 'de'|'en'|null, waehrungBekannt?: boolean}} [einstellungen]
 * @returns {import('./zahlen.js').Zahlenfund|null}
 */
export function ersteZahl(abschnitt, einstellungen = {}) {
  if (typeof abschnitt !== 'string') return null
  const ohneWaehrung = abschnitt
    .normalize('NFKC')
    .replace(/US\$|\bUSD\b|\bEUR\b|\bGBP\b|\bCHF\b|Fr\.|[$€£]/gi, ' ')
  if (!ZAHLENSTART.test(ohneWaehrung)) return null

  const treffer = ohneWaehrung.match(ZAHLENMUSTER)
  if (!treffer || !treffer[0]) return null

  // Das Muster darf Leerzeichen enthalten, weil ein einzelnes ein
  // Tausendertrenner sein kann. Zwei oder mehr sind aber eine Spaltengrenze,
  // und dahinter steht die naechste Zahl. Siehe test/spalten.test.mjs.
  const bisSpalte = treffer[0].split(/\s{2,}/)[0] ?? ''
  const fund = leseZahl(bisSpalte, einstellungen)
  return fund.wert === null ? null : fund
}

/**
 * @typedef {object} Quotenfund
 * @property {number|null} dezimal
 * @property {number|null} amerikanisch
 * @property {'amerikanisch'|'dezimal'|'bruch'|null} art
 * @property {boolean} mehrdeutig
 * @property {string} roh
 */

/**
 * Deutet einen Quotenwert. Das Format wird aus dem Wert selbst abgeleitet und nur
 * im Zweifel aus dem Buchmacherprofil.
 *
 * @param {string} text
 * @param {'amerikanisch'|'dezimal'|'bruch'} [vorgabe]
 * @param {'de'|'en'|'us'|null} [gebiet]
 *   Die Schreibweise des Anbieters. Sie wurde hier frueher fest auf 'en'
 *   gesetzt, und bei zwei Nachkommastellen faellt das nicht auf: "1,85" wird
 *   so oder so 1,85. Bei DREI Stellen entscheidet es alles. Eine deutsche
 *   Quote "1,854" wurde zu 1854, weil das Komma als Tausendertrenner galt.
 *   Genau diese Schreibweise benutzen Pinnacle und Stake. Siehe
 *   test/anbieter_streuung.test.mjs, Kombi mit drei Beinen.
 * @returns {Quotenfund}
 */
export function deuteQuote(text, vorgabe = 'dezimal', gebiet = 'en') {
  const leer = { dezimal: null, amerikanisch: null, art: null, mehrdeutig: false, roh: text }
  if (typeof text !== 'string' || text.trim() === '') return leer

  const t = text.normalize('NFKC').trim()

  // Bruchquote, zum Beispiel 5/2.
  const bruch = t.match(/(\d{1,4})\s*\/\s*(\d{1,4})/)
  if (bruch && bruch[1] && bruch[2]) {
    const nenner = +bruch[2]
    if (nenner > 0) {
      const dezimal = 1 + +bruch[1] / nenner
      return { dezimal, amerikanisch: dezimalNachAmerikanisch(dezimal), art: 'bruch', mehrdeutig: false, roh: bruch[0] }
    }
  }

  // Alle Striche, die wie ein Minus aussehen, aus kern/zahlen.js. Hier standen
  // frueher nur vier davon. Bei einem anderen Strich galt die Quote als ohne
  // Vorzeichen, und aus -157 wurde +157: Quote 2,57 statt 1,64, also ein
  // Aufschlag von 57 Prozent. Siehe test/verlesen.test.mjs.
  const hatVorzeichen = VORZEICHEN_MUSTER.test(t)
  const zahl = ersteZahl(t, { gebiet })
  if (!zahl || zahl.wert === null) return leer
  const betrag = Math.abs(zahl.wert)

  // Eindeutig amerikanisch: mit Vorzeichen und mindestens dreistellig.
  if (hatVorzeichen && betrag >= 100) {
    const us = leseAmerikanischeQuote(t)
    if (us.wert !== null) {
      return {
        dezimal: amerikanischNachDezimal(us.wert),
        amerikanisch: us.wert,
        art: 'amerikanisch',
        mehrdeutig: false,
        roh: t,
      }
    }
  }

  // Eindeutig dezimal: zwischen 1 und 100 mit Nachkommastelle.
  if (!hatVorzeichen && zahl.wert > 1 && zahl.wert < 100 && !Number.isInteger(zahl.wert)) {
    return {
      dezimal: zahl.wert,
      amerikanisch: dezimalNachAmerikanisch(zahl.wert),
      art: 'dezimal',
      mehrdeutig: false,
      roh: t,
    }
  }

  // Ab hier ist es nicht mehr eindeutig. Das Buchmacherprofil entscheidet,
  // der Fund wird aber als mehrdeutig gekennzeichnet.
  if (vorgabe === 'amerikanisch' && betrag >= 100) {
    const wert = hatVorzeichen ? zahl.wert : betrag
    return {
      dezimal: amerikanischNachDezimal(wert),
      amerikanisch: wert,
      art: 'amerikanisch',
      mehrdeutig: !hatVorzeichen,
      roh: t,
    }
  }
  if (zahl.wert > 1) {
    return {
      dezimal: zahl.wert,
      amerikanisch: dezimalNachAmerikanisch(zahl.wert),
      art: 'dezimal',
      mehrdeutig: true,
      roh: t,
    }
  }
  return { ...leer, mehrdeutig: true }
}

/**
 * Sieht eine achtstellige Ziffernfolge nach einem Datum aus?
 *
 * Nur fuer die Scheinnummernsuche gedacht. Im Zweifel lieber ja sagen: dann
 * wird die Zahl nicht als Scheinnummer genommen, und das kostet nichts.
 *
 * @param {string} ziffern  Genau acht Ziffern.
 * @returns {boolean}
 */
function siehtWieDatumAus(ziffern) {
  const alsJahrZuerst = Number(ziffern.slice(0, 4))
  const monatA = Number(ziffern.slice(4, 6))
  const tagA = Number(ziffern.slice(6, 8))
  if (alsJahrZuerst >= 1990 && alsJahrZuerst <= 2100 && monatA >= 1 && monatA <= 12 && tagA >= 1 && tagA <= 31) {
    return true
  }

  const tagB = Number(ziffern.slice(0, 2))
  const monatB = Number(ziffern.slice(2, 4))
  const jahrB = Number(ziffern.slice(4, 8))
  if (jahrB >= 1990 && jahrB <= 2100 && monatB >= 1 && monatB <= 12 && tagB >= 1 && tagB <= 31) {
    return true
  }

  return false
}

/**
 * Sucht die Scheinnummer.
 *
 * @param {string[]} zeilen
 * @returns {{wert: string|null, sicherheit: number, zeile: number, start: number, ende: number}}
 */
export function findeScheinnummer(zeilen) {
  // Erste Wahl: das Rautezeichen mit mindestens fuenf Ziffern. So macht es BetOnline.
  for (let i = 0; i < zeilen.length; i++) {
    const zeile = zeilen[i] ?? ''
    const treffer = zeile.match(/#\s?([0-9]{5,20})/)
    if (treffer && treffer[1] && treffer.index !== undefined) {
      return {
        wert: treffer[1],
        sicherheit: 0.95,
        zeile: i,
        start: treffer.index,
        ende: treffer.index + treffer[0].length,
      }
    }
  }

  // Zweite Wahl: ein Etikett wie "Bet ID" oder "Wett-ID".
  for (let i = 0; i < zeilen.length; i++) {
    const zeile = zeilen[i] ?? ''
    const klein = zeile.toLowerCase()
    for (const etikett of SCHEINNUMMER_ETIKETTEN) {
      const start = klein.indexOf(etikett)
      if (start === -1) continue
      const danach = zeile.slice(start + etikett.length)
      const nummer = danach.match(/[:\s#]*([A-Z0-9-]{5,24})/i)
      if (nummer && nummer[1] && /\d/.test(nummer[1])) {
        return {
          wert: nummer[1],
          sicherheit: 0.85,
          zeile: i,
          start,
          ende: start + etikett.length + (nummer.index ?? 0) + nummer[0].length,
        }
      }
    }
  }

  // Dritte Wahl: eine nackte lange Ziffernfolge ganz am Zeilenanfang.
  //
  // BetOnline schreibt die Scheinnummer ohne jede Beschriftung in die erste
  // Zeile, direkt vor den Zeitpunkt: "396228612    Sep 10, 10:45 PM".
  //
  // Das ist die gefaehrlichste der drei Regeln, weil eine nackte Zahl auch ein
  // Betrag sein koennte. Deshalb muss ALLES davon zutreffen:
  //
  //   - mindestens sieben Ziffern. Selbst 20.000 hat nur fuenf. Ein Betrag mit
  //     sieben Stellen und ohne jedes Trennzeichen kommt auf einem Schein nicht vor.
  //   - ganz am Zeilenanfang. Betraege stehen hinter ihrer Beschriftung.
  //   - nur Ziffern, kein Komma, kein Punkt, kein Waehrungszeichen daneben.
  //   - in einer der ersten drei Zeilen. Kopfzeilen stehen oben.
  //   - keine Geldbeschriftung in derselben Zeile.
  //   - kein Datum in Ziffernform.
  //
  // Faellt eine dieser Bedingungen weg, wird lieber gar keine Nummer gefunden.
  // Eine fehlende Scheinnummer ist aergerlich, ein als Nummer verschluckter
  // Einsatz waere ein Rechenfehler.
  for (let i = 0; i < Math.min(3, zeilen.length); i++) {
    const zeile = zeilen[i] ?? ''
    const treffer = zeile.match(/^\s*([0-9]{7,20})(?![0-9.,])/)
    if (!treffer || !treffer[1]) continue

    const kandidat = treffer[1]

    // Steht direkt davor oder dahinter ein Waehrungszeichen, ist es Geld.
    // Das Fenster muss weit genug reichen, damit auch ein nachgestelltes
    // "EUR" oder "USD" hineinfaellt, nicht nur ein Zeichen wie $.
    const umfeld = zeile.slice(0, (treffer.index ?? 0) + treffer[0].length + 6)
    if (/[$€£¥]|\b(usd|eur|gbp|chf)\b/i.test(umfeld)) continue

    // Eine Geldbeschriftung in derselben Zeile macht die Zahl verdaechtig.
    if (findeEtikettstellen(zeile).length > 0) continue

    // Acht Ziffern koennen ein Datum sein: 20260913 oder 13092026.
    if (kandidat.length === 8 && siehtWieDatumAus(kandidat)) continue

    return {
      wert: kandidat,
      sicherheit: 0.7,
      zeile: i,
      start: treffer.index ?? 0,
      ende: (treffer.index ?? 0) + treffer[0].length,
    }
  }

  // Vierte Wahl: eine nackte lange Ziffernfolge als EIGENE Tabellenspalte.
  //
  // PS3838 zeigt den Wettverlauf als Tabelle. Die Scheinnummer steht dort
  // nicht am Zeilenanfang, sondern in der Spalte "Detail", also mitten drin:
  //
  //   Sportsbook  3778262388  Over 84.5 Rushing Yards  1.826  Risk: 2,315.98 ...
  //
  // Regel drei greift hier nicht. Sie verlangt den Zeilenanfang, und ihre
  // Bremse "keine Geldbeschriftung in der Zeile" kann eine Tabellenzeile nie
  // erfuellen: "Risk:" steht immer mit drauf, nur eben in einer ANDEREN Spalte.
  //
  // WARUM DAS WICHTIG IST UND NICHT NUR HUEBSCH WAERE: ohne Scheinnummer sehen
  // zwei getrennt gesetzte Scheine mit gleichem Einsatz und gleicher Quote aus
  // wie ein einziger, doppelt hochgeladener. Genau das steht in Karams Bild 10
  // zweimal nebeneinander: 396228581 und 396228545, beide Deebo Samuel, beide
  // 300 Dollar, beide -157. Werden die zusammengefasst, fehlen 300 Dollar
  // Einsatz und 492 Dollar Auszahlung in der Summe.
  //
  // Die Bremsen bleiben, nur spaltenweise gedacht:
  //   - mindestens ACHT Ziffern, eine mehr als bei Regel drei
  //   - eine vollstaendige Spalte, links und rechts eine Spaltengrenze
  //   - nur Ziffern, kein Trennzeichen, kein Waehrungszeichen daneben
  //   - keine Geldbeschriftung in der Spalte DAVOR
  //   - kein Datum in Ziffernform
  for (let i = 0; i < Math.min(3, zeilen.length); i++) {
    const zeile = zeilen[i] ?? ''
    const muster = /(?:^|\s{2,})([0-9]{8,20})(?=\s{2,}|$)/g
    let treffer
    while ((treffer = muster.exec(zeile)) !== null) {
      const kandidat = treffer[1]
      if (!kandidat) continue
      const start = treffer.index + treffer[0].length - kandidat.length

      const umfeld = zeile.slice(Math.max(0, start - 6), start + kandidat.length + 6)
      if (/[$\u20ac\u00a3\u00a5]|\b(usd|eur|gbp|chf)\b/i.test(umfeld)) continue

      if (kandidat.length === 8 && siehtWieDatumAus(kandidat)) continue

      const davor =
        zeile
          .slice(0, start)
          .split(/\s{2,}/)
          .filter((t) => t.trim() !== '')
          .pop() ?? ''
      if (findeEtikettstellen(davor).length > 0) continue

      return {
        wert: kandidat,
        sicherheit: 0.6,
        zeile: i,
        start,
        ende: start + kandidat.length,
      }
    }
  }

  return { wert: null, sicherheit: 0, zeile: -1, start: -1, ende: -1 }
}

/**
 * Sucht den Status.
 *
 * Ein Statuswort, das allein auf einer kurzen Zeile steht, ist ein Abzeichen und damit sicher.
 * Dasselbe Wort mitten in einem Satz ist deutlich unsicherer.
 * Direkt vor einem Doppelpunkt oder einer Zahl ist es kein Status, sondern eine Beschriftung.
 *
 * @param {string[]} zeilen
 * @returns {{status: import('./typen.js').Status, sicherheit: number, roh: string}}
 */
export function findeStatus(zeilen) {
  /** @type {{status: import('./typen.js').Status, sicherheit: number, roh: string}} */
  let bester = { status: 'unbekannt', sicherheit: 0, roh: '' }

  for (const rohzeile of zeilen) {
    const zeile = (rohzeile ?? '').trim()
    if (zeile === '') continue
    const klein = zeile.toLowerCase()

    for (const eintrag of STATUS_ETIKETTEN) {
      let ab = 0
      for (;;) {
        const start = klein.indexOf(eintrag.wort, ab)
        if (start === -1) break
        const ende = start + eintrag.wort.length
        ab = ende

        const davor = start === 0 ? '' : klein.charAt(start - 1)
        const danach = ende >= klein.length ? '' : klein.charAt(ende)
        if (davor && BUCHSTABE.test(davor)) continue
        if (danach && BUCHSTABE.test(danach)) continue

        // Vor einem Doppelpunkt oder einer Zahl ist das Wort eine Beschriftung.
        const rest = klein.slice(ende).trimStart()
        if (rest.startsWith(':') || rest.startsWith('=') || /^[$€£]?\s?\d/.test(rest)) continue

        const alleinstehend = klein.replace(/[^a-zäöüß ]/g, '').trim() === eintrag.wort
        const sicherheit = alleinstehend ? 0.95 : zeile.length <= 24 ? 0.8 : 0.6
        if (sicherheit > bester.sicherheit) {
          bester = { status: eintrag.status, sicherheit, roh: zeile }
        }
      }
    }
  }
  return bester
}

/**
 * Erkennt, ob es sich um eine Einzelwette, eine Kombi oder ein System handelt.
 *
 * @param {string} gesamttext
 * @param {number} anzahlBeine
 * @returns {{art: import('./typen.js').Scheinart, erwarteteBeine: number|null, roh: string}}
 */
export function erkenneScheinart(gesamttext, anzahlBeine) {
  for (const muster of SYSTEM_MUSTER) {
    const treffer = gesamttext.match(muster)
    if (treffer) return { art: 'system', erwarteteBeine: null, roh: treffer[0] }
  }
  for (const muster of KOMBI_MUSTER) {
    const treffer = gesamttext.match(muster)
    if (treffer) {
      const anzahl = treffer[1] ? Number(treffer[1]) : null
      return {
        art: 'kombi',
        erwarteteBeine: anzahl !== null && Number.isFinite(anzahl) ? anzahl : null,
        roh: treffer[0],
      }
    }
  }
  if (anzahlBeine > 1) return { art: 'kombi', erwarteteBeine: anzahlBeine, roh: '' }
  if (anzahlBeine === 1) return { art: 'einzel', erwarteteBeine: 1, roh: '' }
  return { art: 'unbekannt', erwarteteBeine: null, roh: '' }
}

/** Muster fuer eine Begegnung: zwei Mannschaften mit einem Trennzeichen dazwischen. */
const BEGEGNUNG_MUSTER = [
  /\s@\s/,
  /\s(?:vs\.?|v\.?)\s/i,
  /\s(?:gegen|geg\.)\s/i,
  /\s[-\u2013]\s/,
  /\s:\s/,
]

/**
 * Entscheidet, ob eine Zeile eine Begegnung beschreibt.
 *
 * @param {string} zeile
 * @returns {boolean}
 */
export function istBegegnung(zeile) {
  if (typeof zeile !== 'string') return false
  const t = zeile.trim()
  if (t.length < 7 || t.length > 120) return false
  // Eine Begegnung besteht aus Namen, nicht aus Betraegen.
  if (/[$€£]/.test(t)) return false
  const buchstaben = (t.match(/[a-zA-ZäöüÄÖÜß]/g) || []).length
  if (buchstaben < 6) return false
  return BEGEGNUNG_MUSTER.some((m) => m.test(t))
}

/**
 * Zerlegt die Auswahlzeilen einer Karte in einzelne Beine.
 *
 * Aufbau eines Beins, wie ihn die meisten Buchmacher verwenden:
 *   Zeile mit dem Tipp (Spieler oder Mannschaft)
 *   Zeile mit der Begegnung
 *   Zeile mit dem Markt
 *   optional eine Zeile mit dem Ausgang
 *
 * Die Begegnungszeile ist der Anker, weil sie sich am sichersten erkennen laesst.
 * Alles davor bis zum vorherigen Bein ist der Tipp, alles danach ist Markt und Ausgang.
 *
 * @param {string[]} zeilen
 * @returns {{tipp: string, ereignis: string, markt: string, ergebnis: string, zeilen: string[]}[]}
 */
export function teileInBeine(zeilen) {
  const sauber = zeilen.map((z) => (z ?? '').trim()).filter((z) => z !== '')
  const ankerStellen = []
  for (let i = 0; i < sauber.length; i++) {
    if (istBegegnung(sauber[i] ?? '')) ankerStellen.push(i)
  }

  // Keine Begegnung erkennbar: alles ist ein einziges Bein.
  if (ankerStellen.length === 0) {
    if (sauber.length === 0) return []
    return [
      {
        tipp: sauber[0] ?? '',
        ereignis: '',
        markt: sauber.slice(1).join(' | '),
        ergebnis: '',
        zeilen: sauber,
      },
    ]
  }

  const beine = []
  for (let n = 0; n < ankerStellen.length; n++) {
    const anker = ankerStellen[n] ?? 0
    const vorherigerAnker = n === 0 ? -1 : (ankerStellen[n - 1] ?? -1)
    const naechsterAnker = n + 1 < ankerStellen.length ? (ankerStellen[n + 1] ?? sauber.length) : sauber.length

    // Der Tipp steht zwischen dem vorherigen Bein und dieser Begegnung.
    const vorlauf = sauber.slice(vorherigerAnker + 1, anker)
    // Markt und Ausgang stehen zwischen dieser Begegnung und dem Tipp des naechsten Beins.
    // Die letzte Zeile vor der naechsten Begegnung gehoert schon zum naechsten Bein.
    const nachlaufEnde = naechsterAnker === sauber.length ? sauber.length : Math.max(anker + 1, naechsterAnker - 1)
    const nachlauf = sauber.slice(anker + 1, nachlaufEnde)

    const ergebniszeilen = nachlauf.filter((z) => istErgebniszeile(z))
    const marktzeilen = nachlauf.filter((z) => !istErgebniszeile(z))

    beine.push({
      tipp: vorlauf.length > 0 ? vorlauf[vorlauf.length - 1] ?? '' : '',
      ereignis: sauber[anker] ?? '',
      markt: marktzeilen.join(' | '),
      ergebnis: ergebniszeilen.join(' | '),
      zeilen: [...vorlauf, sauber[anker] ?? '', ...nachlauf],
    })
  }
  return beine
}

/**
 * Zeilen, die den Ausgang beschreiben statt den Markt.
 *
 * @param {string} zeile
 * @returns {boolean}
 */
function istErgebniszeile(zeile) {
  return /\b(final|ergebnis|endstand|result|score|resultat)\b/i.test(zeile)
}

/**
 * Liest die Quote eines einzelnen Beins.
 *
 * Bewusst streng: es wird NUR eine Zahl genommen, die entweder an einer Quotenbeschriftung
 * haengt oder eindeutig amerikanisches Format hat. Eine freistehende Zahl im Markttext
 * waere sonst die Linie, nicht die Quote. Aus "OVER 2.5 RECEPTIONS" wuerde sonst
 * eine Quote von 2.5, und die ganze Kombirechnung waere falsch.
 *
 * @param {string[]} beinzeilen
 * @param {'amerikanisch'|'dezimal'|'bruch'} quotenformat
 * @param {'de'|'en'|'us'|null} [gebiet]  Schreibweise des Anbieters, siehe deuteQuote.
 * @returns {Quotenfund}
 */
export function leseBeinQuote(beinzeilen, quotenformat, gebiet = 'en') {
  const leer = { dezimal: null, amerikanisch: null, art: null, mehrdeutig: false, roh: '' }

  for (const zeile of beinzeilen) {
    const stellen = findeEtikettstellen(zeile ?? '').filter((s) => s.art === 'quote')
    for (const stelle of stellen) {
      const abschnitt = (zeile ?? '').slice(stelle.ende)
      const q = deuteQuote(abschnitt, quotenformat, gebiet)
      if (q.dezimal !== null) return q
    }
  }

  // Ohne Beschriftung nur dann, wenn das Format keinen Zweifel laesst.
  for (const zeile of beinzeilen) {
    const treffer = (zeile ?? '').match(/(^|[\s(])([+\-\u2212\u2013\u2014]\s?\d{3,5})(?![\d.,])/)
    if (treffer && treffer[2]) {
      const q = deuteQuote(treffer[2], 'amerikanisch')
      if (q.dezimal !== null && q.art === 'amerikanisch') return q
    }
  }

  return leer
}

/**
 * Liest die Linie aus einem Markttext, also die Zahl hinter over, under oder Handicap.
 *
 * @param {string} markt
 * @returns {number|null}
 */
const LINIEN_MUSTER =
  /(?<![\p{L}\p{N}_])(?:over|under|ueber|über|unter|mehr als|weniger als|o|u|total|handicap|hcp|spread|ah)(?![\p{L}\p{N}_])[^0-9+-]{0,6}([+-]?\d+(?:[.,]\d+)?)/iu

export function leseLinie(markt) {
  if (typeof markt !== 'string') return null
  const treffer = markt.match(LINIEN_MUSTER)
  if (treffer && treffer[1]) {
    const fund = leseZahl(treffer[1], { gebiet: 'en' })
    if (fund.wert !== null) return fund.wert
  }
  return null
}

/**
 * @typedef {object} Leseumgebung
 * @property {string} id
 * @property {string} projektId
 * @property {string} bildId
 * @property {import('./typen.js').Rechteck} ausschnitt
 * @property {number} positionImBild
 * @property {string|null} [buchmacher]
 * @property {number} [buchmacherSicherheit]
 * @property {string|null} [konto]
 * @property {number} [kontoSicherheit]
 * @property {'de'|'en'|'us'|null} [gebiet]
 *   Fehlt es oder ist es null, wird NICHT geraten: ein einzelner Punkt oder ein
 *   einzelnes Komma mit drei Ziffern dahinter gilt dann als mehrdeutig und
 *   erzeugt einen sichtbaren Hinweis. Siehe test/gebiet.test.mjs.
 * @property {import('./typen.js').Waehrung} [waehrung]
 * @property {'amerikanisch'|'dezimal'|'bruch'} [quotenformat]
 * @property {number} [bezugsjahr]
 * @property {number} [bezugsmonat]
 * @property {string} [zeitstempel]  ISO-Zeitpunkt fuer angelegtAm, wird hereingereicht.
 * @property {number} [ocrSicherheit]
 */

/**
 * Liest einen vollstaendigen Schein aus den Zeilen einer Karte.
 *
 * @param {string[]} rohzeilen
 * @param {Leseumgebung} umgebung
 * @returns {import('./typen.js').Schein}
 */
/**
 * Sucht ein Geld- oder Quotenetikett, das auf EINER Zeile zweimal steht.
 *
 * Das ist das Erkennungsmal fuer zwei Wettscheine nebeneinander, die beim
 * Zuschneiden nicht getrennt wurden: ein einzelner Schein traegt "Einsatz",
 * "Auszahlung" oder "Quoten" genau einmal je Zeile. Steht eines davon
 * zweimal da, gehoeren die Zahlen rechts und links zu verschiedenen Wetten.
 *
 * Es gibt hier keinen Schwellwert und nichts zu kalibrieren, deshalb ist die
 * Regel auch ohne echte Fotos belastbar.
 *
 * Die Wortgrenze wird mit \p{L} gebildet, nicht mit \b. In JavaScript ist \b
 * rein englisch und trifft vor einem Umlaut nie, und genau daran sind schon
 * einmal alle deutschen Scheine gescheitert.
 *
 * @param {string[]} zeilen
 * @returns {string|null} das doppelte Etikett, oder null
 */
function findeDoppeltesEtikett(zeilen) {
  const etiketten = [
    ...EINSATZ_ETIKETTEN,
    ...AUSZAHLUNG_ETIKETTEN.map((e) => e.wort),
    ...QUOTE_ETIKETTEN,
  ].filter((wort) => typeof wort === 'string' && wort.length >= 4)

  for (const zeile of zeilen) {
    if (zeile === '') continue
    const klein = zeile.toLowerCase()
    for (const wort of etiketten) {
      if (!klein.includes(wort)) continue
      const sicher = wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const muster = new RegExp(`(?<!\\p{L})${sicher}(?!\\p{L})`, 'gu')
      const stellen = [...klein.matchAll(muster)].map((t) => t.index ?? -1).filter((i) => i >= 0)
      if (stellen.length < 2) continue

      // Zweimal dasselbe Wort allein reicht NICHT.
      //
      // bet365 schreibt in einer Zeile "Einsatz:  Gewinn  450,00 Gewinn": das
      // zweite "Gewinn" ist Teil der Beschriftung des Betrags, keine zweite
      // Karte. Die Regel hat diesen Schein beim ersten Durchlauf im Browser
      // sofort faelschlich beanstandet, und gruene Tests hatten es nicht
      // gezeigt (Projektregel 2).
      //
      // Ein Etikett, das wirklich einen Betrag beschriftet, hat auch einen
      // Betrag hinter sich. Gezaehlt wird deshalb nur, wo nach dem Wort und
      // vor dem naechsten Vorkommen desselben Wortes eine Ziffer steht. Zwei
      // beschriftete Betraege desselben Namens auf einer Zeile sind zwei
      // Karten.
      let mitZahl = 0
      for (let i = 0; i < stellen.length; i++) {
        const start = (stellen[i] ?? 0) + wort.length
        const ende = i + 1 < stellen.length ? (stellen[i + 1] ?? klein.length) : klein.length
        if (/\d/.test(klein.slice(start, ende))) mitZahl++
      }
      if (mitZahl >= 2) return wort
    }
  }
  return null
}

export function leseSchein(rohzeilen, umgebung) {
  /** @type {import('./typen.js').Hinweis[]} */
  const hinweise = []

  // Die Leerzeichen werden vereinheitlicht, aber NICHT platt gemacht.
  //
  // Frueher wurde jede Folge von Leerzeichen zu einem einzigen. Damit ging die
  // Spalteninformation verloren, und aus der Betway-Fusszeile
  // "78,30     136,24" wurde ein einziger Betrag von 783.013.624.
  //
  // Jetzt bleibt der Unterschied erhalten: ein Leerzeichen bleibt eines und
  // kann ein Tausendertrenner sein, zwei oder mehr werden zu genau zwei und
  // gelten als Spaltengrenze. Siehe test/spalten.test.mjs.
  const zeilen = (rohzeilen || []).map((z) =>
    typeof z === 'string' ? z.replace(/\s+/g, (m) => (m.length >= 2 ? '  ' : ' ')).trim() : ''
  )
  const gesamttext = zeilen.filter((z) => z !== '').join('\n')

  // Kein Rateschluss auf 'en'. "1.250" heisst deutsch 1250 und englisch 1,25,
  // das ist der Faktor tausend. Ohne bekanntes Gebiet gilt der Betrag als
  // mehrdeutig, und der Mensch entscheidet. Siehe test/gebiet.test.mjs.
  const gebiet = umgebung.gebiet ?? null
  const quotenformat = umgebung.quotenformat ?? 'dezimal'
  const waehrungAusText = erkenneWaehrung(gesamttext)
  const waehrung = waehrungAusText !== 'UNBEKANNT' ? waehrungAusText : (umgebung.waehrung ?? 'UNBEKANNT')
  const waehrungBekannt = waehrung !== 'UNBEKANNT'

  // 1. Scheinnummer zuerst, damit ihre Ziffern nicht als Betrag gelesen werden.
  const nummer = findeScheinnummer(zeilen)
  const zeilenOhneNummer = zeilen.slice()
  if (nummer.zeile >= 0) {
    const alt = zeilenOhneNummer[nummer.zeile] ?? ''
    zeilenOhneNummer[nummer.zeile] =
      alt.slice(0, nummer.start) + ' '.repeat(Math.max(0, nummer.ende - nummer.start)) + alt.slice(nummer.ende)
  }

  // 2. Zeitpunkt. Auch seine Ziffern duerfen spaeter nicht als Betrag auftauchen.
  /** @type {import('./zeitpunkt.js').Zeitfund} */
  let zeit = { iso: null, jahrGeraten: false, nurDatum: false, roh: '', sicherheit: 0 }
  let zeitZeile = -1
  for (let i = 0; i < zeilenOhneNummer.length; i++) {
    const versuch = leseZeitpunkt(zeilenOhneNummer[i] ?? '', {
      bezugsjahr: umgebung.bezugsjahr,
      bezugsmonat: umgebung.bezugsmonat,
      gebiet,
    })
    if (versuch.iso && versuch.sicherheit > zeit.sicherheit) {
      zeit = versuch
      zeitZeile = i
    }
  }
  const arbeitszeilen = zeilenOhneNummer.slice()
  if (zeitZeile >= 0 && zeit.roh) {
    const alt = arbeitszeilen[zeitZeile] ?? ''
    for (const stueck of zeit.roh.split(' ')) {
      if (stueck.length >= 3) {
        arbeitszeilen[zeitZeile] = (arbeitszeilen[zeitZeile] ?? alt).replace(stueck, ' '.repeat(stueck.length))
      }
    }
  }
  if (zeit.jahrGeraten) {
    hinweise.push({
      code: 'jahr_geraten',
      schwere: 'info',
      feld: 'gesetztAm',
      text: 'Der Buchmacher zeigt kein Jahr. Es wurde aus dem Zeitpunkt des Hochladens abgeleitet.',
    })
  }

  // 3. Status.
  const status = findeStatus(zeilen)

  // 4. Beschriftete Felder einsammeln.
  /** @type {{einsatz: import('./zahlen.js').Zahlenfund|null, auszahlung: import('./zahlen.js').Zahlenfund|null, auszahlungBedeutung: 'auszahlung'|'gewinn'|'unklar'|null, quote: Quotenfund|null, etikettZeilen: Set<number>}} */
  const gefunden = {
    einsatz: null,
    auszahlung: null,
    auszahlungBedeutung: null,
    quote: null,
    etikettZeilen: new Set(),
  }

  for (let i = 0; i < arbeitszeilen.length; i++) {
    const zeile = arbeitszeilen[i] ?? ''
    const stellen = findeEtikettstellen(zeile)
    if (stellen.length === 0) continue
    gefunden.etikettZeilen.add(i)

    for (let n = 0; n < stellen.length; n++) {
      const stelle = stellen[n]
      if (!stelle) continue
      const bis = n + 1 < stellen.length ? (stellen[n + 1]?.start ?? zeile.length) : zeile.length
      let abschnitt = zeile.slice(stelle.ende, bis)

      // Steht hinter der Beschriftung keine Zahl, steht der Wert in der naechsten Zeile.
      if (!/[0-9]/.test(abschnitt)) {
        const naechste = arbeitszeilen[i + 1] ?? ''
        if (istWertzeile(naechste) && findeEtikettstellen(naechste).length === 0) {
          // Stehen in der Beschriftungszeile MEHRERE Etiketten nebeneinander,
          // dann gehoert zu jedem die Zahl in derselben Spalte darunter:
          //
          //     Umsetzen            DU HAST GEWONNEN
          //     78,30                         136,24
          //
          // Vorher bekam jedes Etikett die GANZE naechste Zeile, und damit
          // beide denselben Wert: der Gewinn wurde zu 78,30 statt 136,24, und
          // daraus rechnete das Programm eine Quote von 2,0. Am 14.09.2026 an
          // nachgebauten Ansichten von Betway und bet365 gemessen.
          // Siehe test/spalten.test.mjs.
          const spalten = naechste.split(/\s{2,}/).filter((s) => s.trim() !== '')
          const eigene = spalten.length === stellen.length ? spalten[n] : null
          abschnitt = eigene ?? naechste
          gefunden.etikettZeilen.add(i + 1)
        }
      }

      if (stelle.art === 'quote') {
        if (gefunden.quote === null) {
          const q = deuteQuote(abschnitt, quotenformat, gebiet)
          if (q.dezimal !== null) gefunden.quote = q
        }
      } else if (stelle.art === 'einsatz') {
        if (gefunden.einsatz === null) {
          gefunden.einsatz = ersteZahl(abschnitt, { gebiet, waehrungBekannt })
        }
      } else if (stelle.art === 'auszahlung') {
        if (gefunden.auszahlung === null) {
          gefunden.auszahlung = ersteZahl(abschnitt, { gebiet, waehrungBekannt })
          gefunden.auszahlungBedeutung = stelle.bedeutung
        }
      }
    }
  }

  // 4b. Die Quote in einer Tabellenspalte, mit Formatbuchstaben dahinter.
  //
  // PS3838 zeigt den Wettverlauf als TABELLE. Die Spaltenueberschriften stehen
  // ausserhalb der Zeile, in der Zeile selbst steht die Quote nackt da:
  //
  //   1.854 D
  //
  // Der Buchstabe ist das Quotenformat: D fuer dezimal, A fuer amerikanisch,
  // H fuer Hongkong, M fuer Malay, I fuer Indonesisch. Er ist also eine
  // Beschriftung, nur eine sehr kurze, und er sagt sogar mehr als "Odds:".
  //
  // Absichtlich eng gefasst: die ganze Zeile muss aus genau dieser Zahl und
  // genau diesem einen Buchstaben bestehen. Alles andere wuerde raten, und ein
  // geratener Multiplikator ist bei Karams Einsaetzen das Teuerste ueberhaupt.
  // Nur D und A werden gedeutet, bei den drei anderen Formaten bleibt die
  // Quote leer und der Hinweis "quote_fehlt" stehen. Lieber nichts als falsch.
  if (gefunden.quote === null) {
    for (let i = 0; i < arbeitszeilen.length; i++) {
      if (gefunden.etikettZeilen.has(i)) continue
      const treffer = (arbeitszeilen[i] ?? '').trim().match(/^([0-9]{1,3}[.,][0-9]{2,3})\s*([DAHMI])$/)
      if (!treffer || !treffer[1] || !treffer[2]) continue

      const format = treffer[2] === 'D' ? 'dezimal' : treffer[2] === 'A' ? 'amerikanisch' : null
      if (format === null) continue

      const q = deuteQuote(treffer[1], format, gebiet)
      if (q.dezimal === null || q.dezimal <= 1) continue

      gefunden.quote = q
      gefunden.etikettZeilen.add(i)
      hinweise.push({
        code: 'quote_aus_spalte',
        schwere: 'info',
        feld: 'quoteDezimal',
        text: `Die Quote ${treffer[1]} stand ohne Beschriftung in einer Tabellenspalte, ` +
          `der Buchstabe "${treffer[2]}" nennt das Format. Bitte kurz nachsehen.`,
      })
      break
    }
  }

  // 4c. Die Quote hinter einem At-Zeichen.
  //
  // Betway schreibt sie in die Kopfzeile der Karte:
  //
  //   Einzelwette @ 1.74
  //
  // Das At-Zeichen ist hier die Beschriftung. Auf demselben Schein steht es
  // aber auch zwischen zwei Mannschaften ("San Francisco 49ers @ Los Angeles
  // Rams") und vor einem Datum ("NFL @ 2026-09-13"). Deshalb muss hinter dem
  // Zeichen eine Quote stehen und sonst NICHTS MEHR bis zum Zeilenende. Ein
  // Datum und ein Mannschaftsname haben kein Dezimaltrennzeichen mit zwei bis
  // drei Stellen und fallen damit von selbst heraus.
  if (gefunden.quote === null) {
    for (let i = 0; i < arbeitszeilen.length; i++) {
      if (gefunden.etikettZeilen.has(i)) continue
      const zeile = (arbeitszeilen[i] ?? '').trim()
      if (zeile.length > 40) continue
      const treffer = zeile.match(/@\s*([0-9]{1,3}[.,][0-9]{2,3})$/)
      if (!treffer || !treffer[1]) continue

      const q = deuteQuote(treffer[1], 'dezimal', gebiet)
      if (q.dezimal === null || q.dezimal <= 1 || q.dezimal > 1000) continue

      gefunden.quote = q
      gefunden.etikettZeilen.add(i)
      hinweise.push({
        code: 'quote_hinter_at',
        schwere: 'info',
        feld: 'quoteDezimal',
        text:
          `Die Quote ${treffer[1]} stand hinter einem At-Zeichen in der Kopfzeile. ` +
          `Bitte kurz nachsehen.`,
      })
      break
    }
  }

  // 4d. Die Quote in einer Tabellenzeile, der Formatbuchstabe in einer anderen.
  //
  // 4b verlangt, dass die GANZE Zeile aus "1.854 D" besteht. Auf einem echten
  // PS3838-Bildschirmfoto trifft das nie zu: die Texterkennung liest quer ueber
  // alle Spalten hinweg, und dabei landet die Quote in der einen Zeile und ihr
  // Formatbuchstabe in der naechsten:
  //
  //   Sportsbook  3777854081  Over 226.5 Passing Yards  1.854  Risk: 500.00  427.00  ...
  //   Football  Caleb Williams Total Passing Yards  D  (500.00)  WIN
  //
  // Am 14.09.2026 an Karams echten Bildern gemessen: neun von neun
  // PS3838-Scheinen hatten GAR KEINE Quote, und ohne Quote auch keine
  // Auszahlung. Bei einem Einsatz von 2.540,48 ist das kein Schoenheitsfehler.
  //
  // Jeder Schritt hier ist eine Bremse:
  //   - Irgendwo muss eine Spalte stehen, die NUR aus D oder A besteht. Ohne
  //     diesen Beleg wird gar nichts genommen.
  //   - Betrachtet werden nur Spalten, die ganz aus einer nackten Zahl
  //     bestehen. "Over 84.5 Rushing Yards" ist Fliesstext und faellt damit
  //     heraus, sonst waere die 84,5 eine Quote. Genau der Fall steht in Bild 1.
  //   - Es muss genau EIN Kandidat im Quotenbereich uebrig bleiben. Bei
  //     mehreren wird nichts genommen und der Zweifel angezeigt.
  if (gefunden.quote === null) {
    const spaltenJeZeile = arbeitszeilen.map((z) =>
      (z ?? '')
        .split(/\s{2,}/)
        .map((t) => t.trim())
        .filter((t) => t !== '')
    )

    /** @type {'dezimal'|'amerikanisch'|null} */
    let format = null
    for (const spalten of spaltenJeZeile) {
      for (const spalte of spalten) {
        if (spalte === 'D') format = 'dezimal'
        else if (spalte === 'A') format = 'amerikanisch'
      }
      if (format !== null) break
    }

    if (format === 'dezimal') {
      const einsatzWert = gefunden.einsatz?.wert ?? null

      /** @type {{roh: string, wert: number}[]} */
      const kandidaten = []
      /** @type {number[]} */
      const nackteWerte = []

      for (const spalten of spaltenJeZeile) {
        for (const spalte of spalten) {
          if (!NACKTE_ZAHL.test(spalte)) continue
          const z = leseZahl(spalte, { gebiet, waehrungBekannt })
          if (z.wert === null) continue
          nackteWerte.push(z.wert)
          // Der Quotenbereich. Ein Multiplikator unter eins waere ein Verlust
          // auf dem Papier, ueber hundert gibt es ihn hier nicht.
          if (z.wert <= 1 || z.wert > 100) continue
          // Ein Trennzeichen mit zwei bis drei Stellen dahinter. Eine glatte 5
          // ist keine Quote, sondern ein Spielstand.
          if (!/[.,][0-9]{2,3}$/.test(spalte)) continue
          // Der Einsatz ist schon vergeben und darf nicht doppelt zaehlen.
          if (einsatzWert !== null && Math.abs(z.wert - einsatzWert) < 0.005) continue
          kandidaten.push({ roh: spalte, wert: z.wert })
        }
      }

      if (kandidaten.length > 1) {
        hinweise.push({
          code: 'quote_spalte_mehrdeutig',
          schwere: 'warnung',
          feld: 'quoteDezimal',
          text:
            `In der Tabellenzeile stehen mehrere Zahlen, die eine Quote sein koennten ` +
            `(${kandidaten.map((k) => k.roh).join(', ')}). Es wurde keine genommen. ` +
            `Bitte von Hand eintragen.`,
        })
      } else if (kandidaten.length === 1) {
        const k = kandidaten[0]
        const q = deuteQuote(k.roh, 'dezimal', gebiet)
        if (q.dezimal !== null && q.dezimal > 1) {
          gefunden.quote = q

          // GEGENRECHNUNG, und zwar auf derselben Zeile.
          //
          // Neben Einsatz und Quote steht bei PS3838 die Spalte Win/Loss, und
          // das ist der GEWINN, nicht die Auszahlung. Also muss gelten:
          //
          //   Einsatz mal (Quote minus eins) = Win/Loss
          //   500 mal 0,854 = 427,00
          //
          // Trifft das auf den Cent zu, ist die Quote nicht geraten, sondern
          // belegt. Bei einem verlorenen Schein steht in derselben Spalte der
          // Einsatz mit Minus. Auch das ist ein Beleg, nur ein anderer: er
          // bestaetigt den Einsatz, sagt aber nichts ueber die Quote.
          let belegt = null
          if (einsatzWert !== null) {
            const gewinnSoll = einsatzWert * (q.dezimal - 1)
            if (nackteWerte.some((v) => Math.abs(v - gewinnSoll) < 0.011)) belegt = 'gewinn'
            else if (nackteWerte.some((v) => Math.abs(v + einsatzWert) < 0.011)) belegt = 'verlust'
          }

          if (belegt === 'gewinn') {
            hinweise.push({
              code: 'quote_durch_gewinn_belegt',
              schwere: 'info',
              feld: 'quoteDezimal',
              text:
                `Die Quote ${k.roh} stand ohne Beschriftung in einer Tabellenspalte. ` +
                `Sie ist gegengerechnet: Einsatz mal (Quote minus eins) ergibt genau ` +
                `die Gewinnspalte derselben Zeile.`,
            })
          } else if (belegt === 'verlust') {
            hinweise.push({
              code: 'quote_aus_spalte',
              schwere: 'info',
              feld: 'quoteDezimal',
              text:
                `Die Quote ${k.roh} stand ohne Beschriftung in einer Tabellenspalte. ` +
                `Der Schein ist verloren, in der Gewinnspalte steht der Einsatz mit ` +
                `Minus. Damit ist der Einsatz belegt, die Quote aber nicht. Bitte ` +
                `kurz nachsehen.`,
            })
          } else {
            hinweise.push({
              code: 'quote_aus_spalte',
              schwere: 'warnung',
              feld: 'quoteDezimal',
              text:
                `Die Quote ${k.roh} stand ohne Beschriftung in einer Tabellenspalte und ` +
                `liess sich auf der Zeile nicht gegenrechnen. Bitte nachsehen.`,
            })
          }
        }
      }
    }
  }

  // 4e. Die Quote aus Einsatz und Gewinnspalte zurueckrechnen.
  //
  // AM 14.09.2026 IM BROWSER GEMESSEN, an einer nachgebauten PS3838-Tabelle in
  // der echten Schriftgroesse von dreizehn Bildpunkten. Die Texterkennung
  // verliert dort den Dezimalpunkt der Quote:
  //
  //   auf dem Bild steht   1.854
  //   gelesen wird         1854      (einmal sogar "tase")
  //
  // Damit ist der Quotentext unbrauchbar, und Abschnitt 4d findet keinen
  // Kandidaten im Quotenbereich. Auf derselben Zeile stehen aber zwei Zahlen,
  // die das Ergebnis eindeutig festlegen:
  //
  //   Risk: 500.00     der Einsatz
  //   427.00           die Spalte Win/Loss, also der GEWINN
  //
  //   427 / 500 + 1 = 1,854
  //
  // DAS ALLEIN WAERE NOCH ZU WENIG. Auf der Zeile steht auch die 1854 selbst,
  // und 1854 / 500 + 1 ergaebe 4,708: ebenfalls eine moegliche Quote. Deshalb
  // wird ein zweiter Beleg verlangt: die ZIFFERN der gerechneten Quote muessen
  // irgendwo auf der Zeile als Baustein vorkommen.
  //
  //   1,854 hat die Ziffern 1854, und "1854" steht da   ->  belegt
  //   4,708 hat die Ziffern 4708, und die steht nirgends ->  verworfen
  //
  // Zwei voneinander unabhaengige Angaben sagen dasselbe. Das ist Projektregel
  // 1: hier gibt es einen Pruefstein, also darf die Automatik entscheiden.
  //
  // Bei einem VERLORENEN Schein steht in der Gewinnspalte der Einsatz mit
  // Minus. Daraus laesst sich nichts zurueckrechnen, und es wird auch nichts
  // genommen. Die Quote bleibt leer, der Hinweis bleibt stehen, der Mensch
  // traegt sie ein. Das ist richtig so: ohne Pruefstein wird nicht geraten.
  if (gefunden.quote === null && (gefunden.einsatz?.wert ?? 0) > 0) {
    const einsatzWert = gefunden.einsatz.wert

    /** Alle Ziffernfolgen, die irgendwo auf dem Schein stehen. */
    const ziffernfolgen = new Set()
    for (const z of arbeitszeilen) {
      for (const baustein of (z ?? '').split(/\s+/)) {
        const nur = baustein.replace(/[^0-9]/g, '')
        if (nur.length >= 2) ziffernfolgen.add(nur.replace(/^0+(?=\d)/, ''))
      }
    }

    /** @type {{quote: number, gewinn: number, ziffern: string}[]} */
    const kandidaten = []
    for (const z of arbeitszeilen) {
      for (const spalte of (z ?? '').split(/\s{2,}/).map((t) => t.trim())) {
        if (spalte === '' || !NACKTE_ZAHL.test(spalte)) continue
        const fund = leseZahl(spalte, { gebiet, waehrungBekannt })
        if (fund.wert === null || fund.wert <= 0) continue
        // Der Einsatz selbst ist kein Gewinn.
        if (Math.abs(fund.wert - einsatzWert) < 0.005) continue

        const quote = Math.round((fund.wert / einsatzWert + 1) * 1000) / 1000
        if (quote <= 1.01 || quote > 100) continue

        // Der zweite Beleg: die Ziffern der gerechneten Quote muessen als
        // Baustein auf dem Schein stehen.
        const ziffern = quote.toFixed(3).replace(/[^0-9]/g, '').replace(/0+$/, '')
        const passt = [...ziffernfolgen].some((f) => f === ziffern || f === quote.toFixed(3).replace(/[^0-9]/g, ''))
        if (!passt) continue

        if (!kandidaten.some((k) => Math.abs(k.quote - quote) < 0.0005)) {
          kandidaten.push({ quote, gewinn: fund.wert, ziffern })
        }
      }
    }

    if (kandidaten.length > 1) {
      hinweise.push({
        code: 'quote_rueckgerechnet_mehrdeutig',
        schwere: 'warnung',
        feld: 'quoteDezimal',
        text:
          `Aus Einsatz und Gewinnspalte liessen sich mehrere Quoten zurueckrechnen ` +
          `(${kandidaten.map((k) => k.quote).join(', ')}). Es wurde keine genommen. ` +
          `Bitte von Hand eintragen.`,
      })
    } else if (kandidaten.length === 1) {
      const k = kandidaten[0]
      gefunden.quote = { dezimal: k.quote, amerikanisch: null, art: 'dezimal', mehrdeutig: false, roh: k.ziffern }
      hinweise.push({
        code: 'quote_rueckgerechnet',
        schwere: 'info',
        feld: 'quoteDezimal',
        text:
          `Die Quote stand unlesbar im Bild und wurde zurueckgerechnet: ` +
          `Gewinn ${k.gewinn} geteilt durch Einsatz ${einsatzWert} plus eins ergibt ${k.quote}. ` +
          `Belegt durch die Ziffernfolge "${k.ziffern}" auf demselben Schein. Bitte kurz nachsehen.`,
      })
    }
  }

  // 5. Auswahlzeilen: alles, was weder Kopfzeile noch Beschriftungszeile ist.
  //
  // ERGAENZUNG VOM 14.09.2026, an Karams echten PS3838-Bildern gefunden.
  //
  // In einer TABELLE steht die Wette in derselben Bildzeile wie das Geld:
  //
  //   Sportsbook  3777854081  Over 226.5 Passing Yards  1.854  Risk: 500.00  427.00 ...
  //
  // Wegen "Risk:" wird diese Zeile ganz als Beschriftungszeile verbraucht, und
  // die Zeile darunter mit dem Spielernamen ebenfalls. Uebrig blieben nur die
  // Zeitstempel und die Worte "Player Props" und "Specials". Die stehen auf
  // JEDER PS3838-Zeile.
  //
  // Folge: jeder PS3838-Schein trug genau dieselbe Wettkennung, Uebereinstimmung
  // 1,0. Der Riesenschein warf vier Gibbs-Scheine (Over 84.5 Rushing Yards,
  // Detroit gegen New Orleans) mit zwei Williams-Scheinen (Over 226.5 Passing
  // Yards, Carolina gegen Chicago) in EINE Gruppe. Anderer Spieler, anderes
  // Spiel, andere Linie, eine Gruppe, ein sinnloser Multiplikator.
  //
  // Eine verbrauchte Zeile wird deshalb spaltenweise nachgelesen: was dort an
  // TEXT steht und nicht zum Geld gehoert, ist die Wette.
  //
  // DAS KANN KEINE ZAHL VERDERBEN. Einsatz, Quote und Auszahlung sind an dieser
  // Stelle laengst vergeben. Was hier hinzukommt, fliesst nur in Tipp,
  // Begegnung und Markt, also allein in die Zuordnung zum Riesenschein.
  const istStatusabzeichen = (text) =>
    text.toLowerCase().replace(/[^a-zäöüß ]/g, '').trim() ===
      status.roh.toLowerCase().replace(/[^a-zäöüß ]/g, '').trim() && text.length <= 16

  /**
   * Holt aus einer verbrauchten Tabellenzeile die Spalten, die Wettext sind.
   * @param {string} zeile
   * @returns {string[]}
   */
  const textspalten = (zeile) => {
    const spalten = zeile
      .split(/\s{2,}/)
      .map((t) => t.trim())
      .filter((t) => t !== '')
    // Ohne Spaltengrenze ist es eine gewoehnliche Beschriftungszeile.
    if (spalten.length < 2) return []
    return spalten.filter((sp) => {
      if (sp.length < 4) return false
      if (NACKTE_ZAHL.test(sp)) return false
      // Ohne ein richtiges Wort ist es kein Wettext, sondern Geld.
      if (!/[a-zA-ZäöüÄÖÜß]{3,}/.test(sp)) return false
      // "Risk: 500.00" gehoert zum Geld und ist schon gelesen.
      if (findeEtikettstellen(sp).length > 0) return false
      // Ein Datum oder eine Uhrzeit ist keine Wette.
      if (/^\d{4}-\d{2}-\d{2}/.test(sp)) return false
      if (istStatusabzeichen(sp)) return false
      return true
    })
  }

  const auswahlzeilen = []
  for (let i = 0; i < zeilen.length; i++) {
    const zeile = (zeilen[i] ?? '').trim()
    if (zeile === '') continue
    if (gefunden.etikettZeilen.has(i)) {
      for (const sp of textspalten(zeile)) auswahlzeilen.push(sp)
      continue
    }
    if (i === nummer.zeile) continue
    if (i === zeitZeile) continue
    // Reine Statusabzeichen gehoeren nicht zur Auswahl.
    if (istStatusabzeichen(zeile)) continue
    auswahlzeilen.push(zeile)
  }

  const beine = teileInBeine(auswahlzeilen)
  const scheinart = erkenneScheinart(gesamttext, beine.length)

  // 6. Sonderformen erkennen, die die Rechnung veraendern.
  const gratiswette = GRATIS_MUSTER.some((m) => m.test(gesamttext))
  // Quotenboost: dann liegt die Auszahlung hoeher, als die angezeigte Quote
  // hergibt, und der Pruefstein Einsatz mal Quote gleich Auszahlung gilt dort
  // nicht. Siehe BOOST_MUSTER in kern/etiketten.js.
  const quotenboost = BOOST_MUSTER.some((m) => m.test(gesamttext))
  const eachWay = EACHWAY_MUSTER.some((m) => m.test(gesamttext))
  if (gratiswette) {
    hinweise.push({
      code: 'gratiswette_erkannt',
      schwere: 'warnung',
      feld: 'einsatz',
      text:
        'Das sieht nach einer Gratis- oder Bonuswette aus. Der Einsatz zaehlt dann nicht als ' +
        'eigenes Geld und wird bei einem Gewinn nicht mit ausgezahlt. Bitte pruefen.',
    })
  }
  if (eachWay) {
    hinweise.push({
      code: 'eachway_erkannt',
      schwere: 'warnung',
      feld: 'einsatz',
      text:
        'Das sieht nach einer Each-Way-Wette aus. Der angezeigte Einsatz wird doppelt abgebucht, ' +
        'einmal auf Sieg und einmal auf Platz. Der Aufwand ist deshalb das Doppelte.',
    })
  }

  // 7. Gegenrechnen.
  let auszahlungWert = gefunden.auszahlung?.wert ?? null
  const einsatzWert = gefunden.einsatz?.wert ?? null
  const quoteDezimal = gefunden.quote?.dezimal ?? null

  // Bedeutet die Beschriftung "Gewinn" statt "Auszahlung", muss der Einsatz dazugerechnet werden.
  // Bei unklarer Beschriftung entscheidet die Probe, welche Deutung aufgeht.
  //
  // Das gilt aber NUR, solange der Betrag die moegliche Auszahlung ist. Bei einem
  // verlorenen oder annullierten Schein steht dort der tatsaechliche Rueckfluss,
  // und daran ist nichts umzudeuten.
  if (geldZeigtPotenzial(status.status) && !gratiswette) {
    if (auszahlungWert !== null && einsatzWert !== null && quoteDezimal !== null) {
      const alsAuszahlung = Math.abs(auszahlungWert - einsatzWert * quoteDezimal)
      const alsGewinn = Math.abs(auszahlungWert - einsatzWert * (quoteDezimal - 1))
      if (gefunden.auszahlungBedeutung === 'gewinn') {
        auszahlungWert = auszahlungWert + einsatzWert
        hinweise.push({
          code: 'gewinn_zu_auszahlung',
          schwere: 'info',
          feld: 'auszahlung',
          text: 'Der Buchmacher zeigt den reinen Gewinn. Der Einsatz wurde fuer die Auszahlung dazugerechnet.',
        })
      } else if (gefunden.auszahlungBedeutung === 'unklar' && alsGewinn < alsAuszahlung) {
        auszahlungWert = auszahlungWert + einsatzWert
        hinweise.push({
          code: 'gewinn_erkannt',
          schwere: 'info',
          feld: 'auszahlung',
          text:
            'Die Beschriftung war nicht eindeutig. Die Probe zeigt, dass der reine Gewinn angezeigt wird. ' +
            'Der Einsatz wurde dazugerechnet.',
        })
      }
    } else if (
      auszahlungWert !== null &&
      gefunden.auszahlungBedeutung === 'gewinn' &&
      einsatzWert !== null
    ) {
      auszahlungWert = auszahlungWert + einsatzWert
    }
  }

  let probe = versoehne({
    einsatz: einsatzWert,
    auszahlung: auszahlungWert,
    dezimal: gefunden.quote?.art === 'amerikanisch' ? null : quoteDezimal,
    amerikanisch: gefunden.quote?.amerikanisch ?? null,
    status: status.status,
    einsatzWirdZurueckgezahlt: !gratiswette,
  })

  // Passt die Rechnung nicht, kann die Rechnung selbst den Lesefehler finden.
  //
  // Auf einem Schein muessen Einsatz, Quote und Auszahlung zusammenpassen. Wenn
  // die Texterkennung eine Ziffer verliest, passt es nicht mehr, und dann laesst
  // sich durchprobieren, welche Ziffer es gewesen sein muss. Berichtigt wird nur,
  // wenn GENAU EINE der ueblichen Verwechslungen die Zahlen zur Deckung bringt.
  // Sonst bleibt der Widerspruch als Warnung stehen.
  const widerspruch = probe.hinweise.some(
    (h) => h.code === 'quote_widerspruch_us' || h.code === 'quote_widerspruch'
  )
  if (quotenboost && widerspruch) {
    // Nicht berichtigen, sondern sagen warum. Eine Automatik, die hier
    // entscheidet, schreibt eine richtig gelesene Zahl falsch: gemessen wurde
    // ein Einsatz von 200, der auf 206 umgeschrieben wurde, mit der Begruendung
    // "nur diese eine Kombination passt zur angezeigten Quote".
    hinweise.push({
      code: 'quotenboost',
      schwere: 'warnung',
      feld: 'auszahlung',
      text:
        'Auf dem Schein steht ein Quotenboost. Die Auszahlung liegt deshalb ueber dem, ' +
        'was die angezeigte Quote hergibt. Die Zahlen werden NICHT berichtigt, weil die ' +
        'Rechnung Einsatz mal Quote gleich Auszahlung bei einem Boost nicht gilt.',
    })
  } else if (widerspruch && geldZeigtPotenzial(status.status) && !gratiswette) {
    const reparatur = repariereBetraege({
      einsatz: einsatzWert,
      auszahlung: auszahlungWert,
      amerikanisch: gefunden.quote?.amerikanisch ?? null,
    })
    if (reparatur.gelungen && reparatur.einsatz !== null && reparatur.auszahlung !== null) {
      probe = versoehne({
        einsatz: reparatur.einsatz,
        auszahlung: reparatur.auszahlung,
        dezimal: gefunden.quote?.art === 'amerikanisch' ? null : quoteDezimal,
        amerikanisch: gefunden.quote?.amerikanisch ?? null,
        status: status.status,
        einsatzWirdZurueckgezahlt: !gratiswette,
      })
      hinweise.push({
        code: 'ziffern_berichtigt',
        schwere: 'warnung',
        feld: 'einsatz',
        text: `Die Zahlen passten nicht zusammen. ${reparatur.begruendung} Bitte kurz nachsehen.`,
      })
    } else if (reparatur.loesungen > 1) {
      hinweise.push({
        code: 'reparatur_mehrdeutig',
        schwere: 'warnung',
        feld: 'einsatz',
        text: reparatur.begruendung,
      })
    }
  }

  hinweise.push(...probe.hinweise)

  // 8. Probe ueber die Beine: passt das Produkt der Einzelquoten zur Gesamtquote?
  const beinQuotenFunde = beine.map((bein) => leseBeinQuote(bein.zeilen, quotenformat, gebiet))
  const beinQuoten = []
  for (const q of beinQuotenFunde) {
    if (q.dezimal !== null) beinQuoten.push(q.dezimal)
  }
  if (beinQuoten.length > 1 && beinQuoten.length === beine.length && probe.dezimal !== null) {
    const produkt = kombiquote(beinQuoten)
    if (produkt !== null && Math.abs(produkt - probe.dezimal) / probe.dezimal > 0.03) {
      hinweise.push({
        code: 'kombiquote_abweichung',
        schwere: 'info',
        feld: 'quoteDezimal',
        text:
          'Das Produkt der Einzelquoten weicht von der Gesamtquote ab. Bei Kombis aus derselben ' +
          'Begegnung ist das normal, weil der Buchmacher sie abhaengig bepreist.',
      })
    }
  }

  // 8b. Zwei Karten nebeneinander, die beim Zerlegen nicht getrennt wurden.
  //
  // Bei Stake liegen die Wetten in zwei Spalten. Trennt die Bildzerlegung sie
  // nicht, steht in EINER Karte alles doppelt, und die Texterkennung liefert
  // Zeilen wie "Auszahlung  9.175,9955  Auszahlung  0,00". Aus so einer Karte
  // kann kein richtiger Schein werden: die Betraege der linken und der rechten
  // Wette stehen nebeneinander, und jede Zuordnung waere geraten.
  //
  // Am 15.09.2026 wurde daraus zuerst der Einsatz 5.000.000.000.002.004 und
  // danach, nach der Reparatur in kern/zahlen.js, ein AUSGERECHNETER Einsatz
  // von 49,87 aus einer verlesenen Quote 184. Beides lief ohne einen einzigen
  // Fehlerhinweis in die Summe.
  //
  // Das Erkennungsmal ist eindeutig und braucht keinen Schwellwert: steht
  // DASSELBE Geld- oder Quotenetikett zweimal auf EINER Zeile, sind es zwei
  // Karten. Ein Schein hat jedes dieser Etiketten genau einmal.
  const doppeltesEtikett = findeDoppeltesEtikett(zeilen)
  if (doppeltesEtikett !== null) {
    hinweise.push({
      code: 'zwei_karten_in_einer',
      schwere: 'fehler',
      text:
        `Auf einer Zeile steht "${doppeltesEtikett}" zweimal. Hier liegen zwei Wettscheine ` +
        'nebeneinander, die beim Zuschneiden nicht getrennt wurden. Die Zahlen dieser Karte ' +
        'gehoeren zu zwei verschiedenen Wetten und werden deshalb nicht in die Summe genommen. ' +
        'Bitte den Ausschnitt so setzen, dass nur eine Wette darin steht.',
    })
  }

  // 9. Fehlende Pflichtangaben melden, statt sie zu verschweigen.
  if (probe.einsatz === null) {
    hinweise.push({
      code: 'einsatz_fehlt',
      schwere: 'fehler',
      feld: 'einsatz',
      text: 'Kein Einsatz gefunden. Ohne Einsatz kann dieser Schein nicht in die Summe.',
    })
  }
  if (probe.dezimal === null) {
    hinweise.push({
      code: 'quote_fehlt',
      schwere: 'warnung',
      feld: 'quoteDezimal',
      text: 'Keine Quote gefunden.',
    })
  }
  if (waehrung === 'UNBEKANNT') {
    hinweise.push({
      code: 'waehrung_fehlt',
      schwere: 'warnung',
      feld: 'waehrung',
      text: 'Keine Waehrung erkannt. Betraege verschiedener Waehrungen werden nie zusammengezaehlt.',
    })
  }
  if (gefunden.einsatz?.mehrdeutig || gefunden.auszahlung?.mehrdeutig) {
    hinweise.push({
      code: 'trennzeichen_mehrdeutig',
      schwere: 'warnung',
      text: 'Bei einem Betrag war unklar, ob der Punkt Tausender oder Nachkommastellen trennt. Bitte pruefen.',
    })
  }
  if (gefunden.quote?.mehrdeutig) {
    hinweise.push({
      code: 'quotenformat_mehrdeutig',
      schwere: 'warnung',
      feld: 'quoteDezimal',
      text: 'Das Quotenformat war nicht eindeutig. Bitte pruefen, ob amerikanisch oder dezimal gemeint ist.',
    })
  }
  if (nummer.wert === null) {
    hinweise.push({
      code: 'scheinnummer_fehlt',
      schwere: 'info',
      feld: 'scheinNr',
      text: 'Keine Scheinnummer gefunden. Ohne sie kann ein doppelt hochgeladener Schein schwerer erkannt werden.',
    })
  }

  const ocrSicherheit = umgebung.ocrSicherheit ?? 0
  const zeitstempel = umgebung.zeitstempel ?? ''

  /** @type {import('./typen.js').Auswahl[]} */
  const auswahlen = beine.map((bein, n) => {
    const beinQuote = beinQuotenFunde[n] ?? { dezimal: null, amerikanisch: null, art: null, mehrdeutig: false, roh: '' }
    return {
      id: `${umgebung.id}-b${n + 1}`,
      ereignis: feld(bein.ereignis || null, bein.ereignis ? 0.85 : 0, 'ocr', bein.ereignis),
      markt: feld(bein.markt || null, bein.markt ? 0.8 : 0, 'ocr', bein.markt),
      tipp: feld(bein.tipp || null, bein.tipp ? 0.8 : 0, 'ocr', bein.tipp),
      // Die Linie steht nicht immer im Marktfeld.
      //
      // Bei Stake ist die Kopfzeile der Karte der TIPP (Über 2.5 Annahmen),
      // bei BetOnline steht dieselbe Aussage im MARKT (WILL HAVE OVER 2.5
      // RECEPTIONS). Dieselbe Wette darf nicht daran scheitern, in welches
      // Feld der Aufbau des Anbieters sie gelegt hat. Erst der Markt, dann der
      // Tipp: das Ereignisfeld bleibt aussen vor, dort stehen Spielstaende.
      linie: feld(leseLinie(bein.markt) ?? leseLinie(bein.tipp), 0.7, 'ocr', bein.markt),
      quoteDezimal: feld(
        beine.length === 1 ? probe.dezimal : beinQuote.dezimal,
        beine.length === 1 ? 0.9 : 0.5,
        'ocr',
        beine.length === 1 ? '' : beinQuote.roh
      ),
      ergebnis: feld(bein.ergebnis || null, bein.ergebnis ? 0.8 : 0, 'ocr', bein.ergebnis),
      status: beine.length === 1 ? status.status : 'unbekannt',
    }
  })

  // Ein verlorener Schein zahlt nichts aus.
  //
  // Das ist keine Schaetzung, sondern die Bedeutung des Wortes. Stake schreibt
  // die Null hin ("Auszahlung 0.00000000"), PS3838 nicht: dort steht in der
  // Gewinnspalte der Einsatz mit Minus, und das ist etwas anderes. Ohne diese
  // Zeile blieb ausgezahlt leer, und ein verlorener Schein sah in der Summe
  // aus wie ein noch offener.
  //
  // Nur 'verloren' bekommt die Null. 'halb_verloren' nicht, dort kommt ein
  // Teil zurueck, und 'cashout' erst recht nicht.
  const verlorenOhneZahl = probe.ausgezahlt === null && status.status === 'verloren'
  const ausgezahltWert = verlorenOhneZahl ? 0 : probe.ausgezahlt

  return {
    id: umgebung.id,
    projektId: umgebung.projektId,
    gruppeId: null,

    buchmacher: feld(umgebung.buchmacher ?? null, umgebung.buchmacherSicherheit ?? 0, 'ocr'),
    konto: feld(umgebung.konto ?? null, umgebung.kontoSicherheit ?? 0, 'ocr'),
    scheinNr: feld(nummer.wert, nummer.sicherheit, 'ocr'),
    gesetztAm: feld(zeit.iso, zeit.sicherheit, 'ocr', zeit.roh),

    einsatz: feld(probe.einsatz, herkunftSicherheit(probe.herkunft[0], gefunden.einsatz), probe.herkunft[0] === 'berechnet' ? 'berechnet' : 'ocr', gefunden.einsatz?.roh),
    waehrung: feld(waehrung, waehrung === 'UNBEKANNT' ? 0 : 0.9, 'ocr'),
    quoteDezimal: feld(probe.dezimal, probe.dezimal === null ? 0 : 0.9, 'berechnet', gefunden.quote?.roh),
    quoteAmerikanisch: feld(probe.amerikanisch, probe.amerikanisch === null ? 0 : 0.85, 'berechnet', gefunden.quote?.roh),
    auszahlung: feld(probe.auszahlung, herkunftSicherheit(probe.herkunft[1], gefunden.auszahlung), probe.herkunft[1] === 'berechnet' ? 'berechnet' : 'ocr', gefunden.auszahlung?.roh),
    ausgezahlt: feld(
      ausgezahltWert,
      ausgezahltWert === null ? 0 : 0.9,
      verlorenOhneZahl ? 'berechnet' : 'ocr',
      gefunden.auszahlung?.roh
    ),

    status: status.status,
    art: scheinart.art,
    auswahlen,
    gratiswette,
    eachWay,

    bildId: umgebung.bildId,
    ausschnitt: umgebung.ausschnitt,
    positionImBild: umgebung.positionImBild,

    rohtext: gesamttext,
    ocrSicherheit,
    hinweise,
    vonHand: false,
    ausgeschlossen: false,
    angelegtAm: zeitstempel,
    geaendertAm: zeitstempel,
  }
}

/**
 * @param {'gelesen'|'berechnet'|'fehlt'|undefined} herkunft
 * @param {import('./zahlen.js').Zahlenfund|null} fund
 * @returns {number}
 */
function herkunftSicherheit(herkunft, fund) {
  if (herkunft === 'fehlt' || herkunft === undefined) return 0
  if (herkunft === 'berechnet') return 0.7
  if (fund && fund.mehrdeutig) return 0.55
  if (fund && fund.ersetzt) return 0.7
  return 0.9
}
