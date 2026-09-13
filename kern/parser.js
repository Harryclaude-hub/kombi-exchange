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

import { leseZahl, leseAmerikanischeQuote, erkenneWaehrung } from './zahlen.js'
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
  if (!/[0-9OolIiSsBbGgZzEeAahTqQD]/.test(ohneWaehrung)) return null

  // Vor dem Suchen die verlesenen Ziffern retten, sonst findet die Suche "l8l" nicht.
  const gerettet = ohneWaehrung.replace(/[OolIiSsBbGgZzEeAahTqQD]/g, (z) => z)
  const treffer = gerettet.match(
    /[+\-\u2212\u2013\u2014]?\s?(?:\d|[OolIiSsBbGgZz](?=[\dOolIiSsBbGgZz]))[\dOolIiSsBbGgZz.,' \u00A0\u202F]*/
  )
  if (!treffer || !treffer[0]) return null
  const fund = leseZahl(treffer[0], einstellungen)
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
 * @returns {Quotenfund}
 */
export function deuteQuote(text, vorgabe = 'dezimal') {
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

  const hatVorzeichen = /[+\-\u2212\u2013\u2014]\s?\d/.test(t)
  const zahl = ersteZahl(t, { gebiet: 'en' })
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
 * @returns {Quotenfund}
 */
export function leseBeinQuote(beinzeilen, quotenformat) {
  const leer = { dezimal: null, amerikanisch: null, art: null, mehrdeutig: false, roh: '' }

  for (const zeile of beinzeilen) {
    const stellen = findeEtikettstellen(zeile ?? '').filter((s) => s.art === 'quote')
    for (const stelle of stellen) {
      const abschnitt = (zeile ?? '').slice(stelle.ende)
      const q = deuteQuote(abschnitt, quotenformat)
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
export function leseLinie(markt) {
  if (typeof markt !== 'string') return null
  const treffer = markt.match(
    /\b(?:over|under|ueber|über|unter|o|u|total|handicap|hcp|spread|ah)\b[^0-9+-]{0,6}([+-]?\d+(?:[.,]\d+)?)/i
  )
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
 * @property {'de'|'en'} [gebiet]
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
export function leseSchein(rohzeilen, umgebung) {
  /** @type {import('./typen.js').Hinweis[]} */
  const hinweise = []

  const zeilen = (rohzeilen || []).map((z) => (typeof z === 'string' ? z.replace(/\s+/g, ' ').trim() : ''))
  const gesamttext = zeilen.filter((z) => z !== '').join('\n')

  const gebiet = umgebung.gebiet ?? 'en'
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
        if (/[0-9]/.test(naechste) && findeEtikettstellen(naechste).length === 0) {
          abschnitt = naechste
          gefunden.etikettZeilen.add(i + 1)
        }
      }

      if (stelle.art === 'quote') {
        if (gefunden.quote === null) {
          const q = deuteQuote(abschnitt, quotenformat)
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

  // 5. Auswahlzeilen: alles, was weder Kopfzeile noch Beschriftungszeile ist.
  const auswahlzeilen = []
  for (let i = 0; i < zeilen.length; i++) {
    if (gefunden.etikettZeilen.has(i)) continue
    if (i === nummer.zeile) continue
    if (i === zeitZeile) continue
    const zeile = (zeilen[i] ?? '').trim()
    if (zeile === '') continue
    // Reine Statusabzeichen gehoeren nicht zur Auswahl.
    if (zeile.toLowerCase().replace(/[^a-zäöüß ]/g, '').trim() === status.roh.toLowerCase().replace(/[^a-zäöüß ]/g, '').trim() && zeile.length <= 16) continue
    auswahlzeilen.push(zeile)
  }

  const beine = teileInBeine(auswahlzeilen)
  const scheinart = erkenneScheinart(gesamttext, beine.length)

  // 6. Sonderformen erkennen, die die Rechnung veraendern.
  const gratiswette = GRATIS_MUSTER.some((m) => m.test(gesamttext))
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
  if (widerspruch && geldZeigtPotenzial(status.status) && !gratiswette) {
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
  const beinQuotenFunde = beine.map((bein) => leseBeinQuote(bein.zeilen, quotenformat))
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
      linie: feld(leseLinie(bein.markt), 0.7, 'ocr', bein.markt),
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
      probe.ausgezahlt,
      probe.ausgezahlt === null ? 0 : 0.9,
      'ocr',
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
