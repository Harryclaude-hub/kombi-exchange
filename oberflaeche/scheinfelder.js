// @ts-check
/**
 * Die Eingabefelder eines einzelnen Scheins.
 *
 * WARUM DAS EINE EIGENE DATEI IST
 *
 * Seit dem 17.09.2026 gibt es zwei Stellen, an denen ein Schein von Hand
 * berichtigt wird: die Tabelle im Reiter Scheine, und die dritte Ebene bei den
 * Riesenscheinen, wo ein einzelner Schein gross aufgemacht wird.
 *
 * Karam am 17.09.2026: "kann man sie dann separat aufmachen, und dann sieht
 * man im grossen Bereich, welche Einsaetze man hat, da kann man die auch
 * bearbeiten."
 *
 * Zwei Abschriften derselben Felder waeren zwei Stellen, an denen sich das
 * Verhalten auseinanderentwickelt: eine Umrechnung berichtigt, die andere
 * nicht. Deshalb steht jedes Feld genau einmal hier (Projektregel 8).
 *
 * HIER WIRD NICHTS GERECHNET UND NICHTS GEDEUTET. Das Lesen von Hand
 * eingegebener Zahlen macht kern/handeingabe.js, das Speichern macht
 * zustand.js. Diese Datei baut nur die Eingabefelder.
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5). Die Klasse der
 * Huelle wird uebergeben, damit dieselben Felder in der Tabelle anders liegen
 * koennen als im grossen Formular, ohne dass hier etwas ueber Aussehen steht.
 */

import { el, anbieterzeichen, sicherheitsstufe, zeitText } from './werkzeug.js'
import { formatiere, formatiereQuote } from '../kern/geld.js'
import { statusText } from '../bild/mosaik.js'
import { leseGeldEingabe, leseQuoteEingabe } from '../kern/handeingabe.js'
import * as Zustand from './zustand.js'

/** Alle Status, die von Hand gesetzt werden koennen. */
export const STATUSLISTE = [
  'offen',
  'gewonnen',
  'verloren',
  'halb_gewonnen',
  'halb_verloren',
  'push',
  'storniert',
  'cashout',
  'unbekannt',
]

/**
 * Ein Textfeld: Anbieter, Konto, Schein-Nummer.
 *
 * @param {import('../kern/typen.js').Schein} schein
 * @param {'buchmacher'|'konto'|'scheinNr'} feldname
 * @param {string} platzhalter
 * @param {string} [huelle]
 * @returns {HTMLElement}
 */
export function textfeld(schein, feldname, platzhalter, huelle = '.zelle') {
  const feld = schein[feldname]
  return el(huelle, {}, [
    // Beim Anbieter steht sein Zeichen vor dem Feld. Ueberall sonst waere es
    // sinnlos, deshalb genau hier und nirgends sonst.
    feldname === 'buchmacher' ? anbieterzeichen(feld.wert) : null,
    el('input.feldeingabe', {
      type: 'text',
      value: feld.wert ?? '',
      placeholder: platzhalter,
      daten: { stufe: sicherheitsstufe(feld.sicherheit) },
      title: feld.roh ? `Gelesen: ${feld.roh}` : '',
      onchange: (e) => {
        const wert = /** @type {HTMLInputElement} */ (e.target).value.trim()
        Zustand.setzeFeld(schein.id, feldname, wert === '' ? null : wert)
      },
    }),
  ])
}

/**
 * Ein Geldfeld: Einsatz, Auszahlung, ausgezahlt.
 *
 * @param {import('../kern/typen.js').Schein} schein
 * @param {'einsatz'|'auszahlung'|'ausgezahlt'} feldname
 * @param {import('../kern/typen.js').Waehrung} waehrung
 * @param {string} [huelle]
 * @returns {HTMLElement}
 */
export function zahlfeld(schein, feldname, waehrung, huelle = '.zelle.zelle-zahl') {
  const feld = schein[feldname]
  return el(huelle, {}, [
    el('input.feldeingabe.eingabe-zahl', {
      type: 'text',
      inputmode: 'decimal',
      value: feld.wert === null ? '' : formatiere(feld.wert, 'UNBEKANNT', 'de', { ohneZeichen: true }),
      daten: { stufe: sicherheitsstufe(feld.sicherheit), quelle: feld.quelle },
      title: `${feld.quelle === 'berechnet' ? 'Berechnet. ' : ''}${feld.roh ? `Gelesen: ${feld.roh}` : ''}`,
      onchange: (e) => {
        // Ueber kern/handeingabe.js, nicht mit einer eigenen Umwandlung.
        //
        // Hier stand bis zum 16.09.2026 replace(/\./g, '') plus Number(): das
        // strich ALLE Punkte, und aus "5000.00" wurde 500000, aus "5,000.00"
        // wurde 5. Der Wert bekam Sicherheit 1 und die Herkunft hand und wurde
        // nie wieder ueberschrieben.
        const feldEl = /** @type {HTMLInputElement} */ (e.target)
        const gelesen = leseGeldEingabe(feldEl.value, schein.leseumgebung?.gebiet ?? 'de')
        if (feldEl.value.trim() === '') {
          feldEl.removeAttribute('data-fehler')
          feldEl.title = ''
          Zustand.setzeFeld(schein.id, feldname, null)
          return
        }
        if (gelesen.wert === null) {
          // Nicht deutbar: NICHTS speichern, stehen lassen, Grund anzeigen.
          feldEl.dataset.fehler = 'true'
          feldEl.title = gelesen.grund
          Zustand.melde('warnung', gelesen.grund)
          return
        }
        feldEl.removeAttribute('data-fehler')
        feldEl.title = gelesen.grund
        Zustand.setzeFeld(schein.id, feldname, gelesen.wert)
      },
    }),
    el('span.waehrungszeichen', { text: waehrung === 'UNBEKANNT' ? '?' : waehrung }),
  ])
}

/**
 * Die Quote, dezimal eingegeben, amerikanisch daneben.
 *
 * @param {import('../kern/typen.js').Schein} schein
 * @param {string} [huelle]
 * @returns {HTMLElement}
 */
export function quotenfeld(schein, huelle = '.zelle.zelle-zahl') {
  return el(huelle, {}, [
    el('input.feldeingabe.eingabe-zahl', {
      type: 'text',
      inputmode: 'decimal',
      value: schein.quoteDezimal.wert === null ? '' : formatiereQuote(schein.quoteDezimal.wert, 'dezimal', 'de'),
      daten: { stufe: sicherheitsstufe(schein.quoteDezimal.sicherheit) },
      title:
        schein.quoteAmerikanisch.wert !== null
          ? `Angezeigt beim Anbieter: ${schein.quoteAmerikanisch.wert > 0 ? '+' : ''}${Math.round(schein.quoteAmerikanisch.wert)}`
          : '',
      onchange: (e) => {
        // Ebenfalls ueber kern/handeingabe.js. "1.854" ergab hier frueher
        // 1.854, "1,90." dagegen still null: die Quote war weg, ohne dass es
        // jemand merkte.
        const quoteEl = /** @type {HTMLInputElement} */ (e.target)
        const gelesen = leseQuoteEingabe(quoteEl.value, schein.leseumgebung?.gebiet ?? 'de')
        if (quoteEl.value.trim() === '') {
          quoteEl.removeAttribute('data-fehler')
          quoteEl.title = ''
          Zustand.setzeFeld(schein.id, 'quoteDezimal', null)
          return
        }
        if (gelesen.wert === null) {
          quoteEl.dataset.fehler = 'true'
          quoteEl.title = gelesen.grund
          Zustand.melde('warnung', gelesen.grund)
          return
        }
        quoteEl.removeAttribute('data-fehler')
        quoteEl.title = gelesen.grund
        Zustand.setzeFeld(schein.id, 'quoteDezimal', gelesen.wert)
      },
    }),
    schein.quoteAmerikanisch.wert !== null
      ? el('span.quoteUS', {
          text: `${schein.quoteAmerikanisch.wert > 0 ? '+' : ''}${Math.round(schein.quoteAmerikanisch.wert)}`,
        })
      : null,
  ])
}

/**
 * Der Zeitpunkt, an dem gesetzt wurde.
 *
 * @param {import('../kern/typen.js').Schein} schein
 * @param {string} [huelle]
 * @returns {HTMLElement}
 */
export function zeitfeld(schein, huelle = '.zelle') {
  return el(huelle, {}, [
    el('input.feldeingabe', {
      type: 'text',
      value: schein.gesetztAm.wert ? schein.gesetztAm.wert.replace('T', ' ') : '',
      placeholder: 'JJJJ-MM-TT hh:mm',
      daten: { stufe: sicherheitsstufe(schein.gesetztAm.sicherheit) },
      title: zeitText(schein.gesetztAm.wert),
      onchange: (e) => {
        const roh = /** @type {HTMLInputElement} */ (e.target).value.trim().replace(' ', 'T')
        Zustand.setzeFeld(schein.id, 'gesetztAm', roh === '' ? null : roh)
      },
    }),
  ])
}

/**
 * Gewonnen, verloren, offen und die uebrigen Ausgaenge.
 *
 * @param {import('../kern/typen.js').Schein} schein
 * @param {string} [huelle]
 * @returns {HTMLElement}
 */
export function statuswahl(schein, huelle = '.zelle') {
  return el(huelle, {}, [
    el(
      'select.feldwahl',
      {
        daten: { status: schein.status },
        onchange: (e) =>
          Zustand.setzeFeld(schein.id, 'status', /** @type {HTMLSelectElement} */ (e.target).value),
      },
      STATUSLISTE.map((s) =>
        el('option', {
          value: s,
          text: statusText(/** @type {any} */ (s)),
          selected: s === schein.status ? 'selected' : null,
        })
      )
    ),
  ])
}

/**
 * Ein Haken: Gratiswette, Each Way, ausgeschlossen.
 *
 * @param {import('../kern/typen.js').Schein} schein
 * @param {'gratiswette'|'eachWay'|'ausgeschlossen'} feldname
 * @param {string} beschriftung
 * @returns {HTMLElement}
 */
export function schalter(schein, feldname, beschriftung) {
  return el('label.schalter', {}, [
    el('input', {
      type: 'checkbox',
      checked: schein[feldname] ? 'checked' : null,
      onchange: (e) =>
        Zustand.setzeFeld(schein.id, feldname, /** @type {HTMLInputElement} */ (e.target).checked),
    }),
    el('span', { text: beschriftung }),
  ])
}
