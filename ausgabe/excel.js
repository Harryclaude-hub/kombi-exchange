// @ts-check
/**
 * Excel-Ausgabe.
 *
 * Grundsatz: in der Tabelle stehen echte Zahlen, keine Texte. Nur dann kann Excel
 * damit rechnen, und nur dann sieht Karam sofort, wenn etwas nicht stimmt.
 *
 * Zweiter Grundsatz: die Rechenwege stehen als Formeln drin, nicht als fertige
 * Ergebnisse. Wer die Datei bekommt, kann jede Summe nachvollziehen und nachrechnen.
 * Jede Formelzelle bekommt zusaetzlich das ausgerechnete Ergebnis mitgegeben,
 * weil Excel die Zelle sonst leer anzeigt, bis der Nutzer neu berechnen laesst.
 *
 * Dritter Grundsatz: das Blatt "Hinweise" enthaelt ALLES, was beim Lesen aufgefallen ist.
 * Nichts verschwindet still.
 */

import { formatiere } from '../kern/geld.js'
import { runde } from '../kern/zahlen.js'
import { barEinsatz, realisierterRueckfluss, offenePotenzialauszahlung } from '../kern/rechnung.js'
import { istEntschieden } from '../kern/status.js'
import { statusText } from '../bild/mosaik.js'

/** Zahlenformate. Bewusst ohne Sprachabhaengigkeit, Excel uebersetzt selbst. */
const FORMAT = {
  USD: '"$"#,##0.00',
  EUR: '#,##0.00 "€"',
  GBP: '"£"#,##0.00',
  CHF: '#,##0.00 "CHF"',
  UNBEKANNT: '#,##0.00',
  quote: '0.0000',
  quoteUS: '+#,##0;-#,##0;0',
  anteil: '0.0 %',
  ganz: '#,##0',
  zeit: 'yyyy-mm-dd hh:mm',
}

/** @type {Promise<any>|null} */
let excelLaedt = null

/**
 * Laedt die Excel-Bibliothek aus dem Ordner lib. Kein Aufruf nach draussen.
 *
 * @returns {Promise<any>}
 */
export function ladeExcel() {
  if (excelLaedt) return excelLaedt

  excelLaedt = new Promise((erfuellen, ablehnen) => {
    const vorhanden = /** @type {any} */ (globalThis).ExcelJS
    if (vorhanden) {
      erfuellen(vorhanden)
      return
    }
    const quelle = new URL('lib/exceljs/exceljs.min.js', new URL('./', document.baseURI)).href
    const schild = document.createElement('script')
    schild.src = quelle
    schild.async = true
    schild.onload = () => {
      const geladen = /** @type {any} */ (globalThis).ExcelJS
      if (geladen) erfuellen(geladen)
      else ablehnen(new Error('Die Excel-Bibliothek wurde geladen, meldet sich aber nicht an.'))
    }
    schild.onerror = () => {
      excelLaedt = null
      ablehnen(new Error(`Die Excel-Bibliothek liess sich nicht laden: ${quelle}`))
    }
    document.head.appendChild(schild)
  })

  return excelLaedt
}

/**
 * @typedef {object} Ausgabeposten
 * @property {import('../kern/typen.js').Riesenschein} riesenschein
 * @property {import('../kern/typen.js').Schein[]} scheine
 * @property {import('../kern/typen.js').Rechnung} rechnung
 */

/**
 * @typedef {object} Mappeneinstellungen
 * @property {string} titel
 * @property {'de'|'en'} [gebiet]
 * @property {Blob|null} [belegBild]      Der Riesenschein als Bild, wird eingebettet.
 * @property {{breite: number, hoehe: number}} [belegMasse]
 * @property {import('../kern/typen.js').Restposten[]} [restposten]
 * @property {Map<string, import('../kern/typen.js').Schein>} [scheinNachId]
 */

/**
 * Baut die Arbeitsmappe.
 *
 * @param {Ausgabeposten[]} posten
 * @param {Mappeneinstellungen} einstellungen
 * @returns {Promise<Blob>}
 */
export async function baueMappe(posten, einstellungen) {
  const ExcelJS = await ladeExcel()
  const gebiet = einstellungen.gebiet ?? 'de'

  const mappe = new ExcelJS.Workbook()
  mappe.creator = 'Kombi Exchange'
  mappe.created = new Date()
  // Excel soll beim Oeffnen alle Formeln neu rechnen. Sonst zeigt es nur die
  // mitgelieferten Ergebnisse und der Nutzer weiss nicht, ob sie stimmen.
  mappe.calcProperties.fullCalcOnLoad = true

  const alleScheine = posten.flatMap((p) =>
    p.scheine.map((s) => ({ schein: s, riesenschein: p.riesenschein }))
  )

  const scheineBlatt = baueScheineBlatt(mappe, alleScheine, gebiet)
  baueRiesenscheinBlatt(mappe, posten, scheineBlatt.letzteZeile, gebiet)
  baueAuswahlBlatt(mappe, alleScheine)
  baueAnbieterBlatt(mappe, posten, gebiet)
  await baueBelegBlatt(mappe, einstellungen)
  baueHinweisBlatt(mappe, posten, einstellungen)
  baueUebersichtBlatt(mappe, posten, einstellungen, scheineBlatt.letzteZeile, gebiet)

  // Die Uebersicht soll vorne stehen.
  const uebersicht = mappe.getWorksheet('Uebersicht')
  if (uebersicht) mappe.views = [{ activeTab: uebersicht.id - 1 }]

  const puffer = await mappe.xlsx.writeBuffer()
  return new Blob([puffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Ein Blatt mit einer Zeile je Schein.
 *
 * @param {any} mappe
 * @param {{schein: import('../kern/typen.js').Schein, riesenschein: import('../kern/typen.js').Riesenschein}[]} eintraege
 * @param {'de'|'en'} gebiet
 * @returns {{letzteZeile: number}}
 */
function baueScheineBlatt(mappe, eintraege, gebiet) {
  const blatt = mappe.addWorksheet('Scheine', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }],
  })

  blatt.columns = [
    { header: 'Nr', key: 'nr', width: 6 },
    { header: 'Riesenschein', key: 'gruppe', width: 30 },
    { header: 'Anbieter', key: 'anbieter', width: 18 },
    { header: 'Konto', key: 'konto', width: 18 },
    { header: 'Schein-Nr', key: 'scheinNr', width: 16 },
    { header: 'Gesetzt am', key: 'zeit', width: 18 },
    { header: 'Art', key: 'art', width: 10 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Einsatz laut Schein', key: 'einsatz', width: 18 },
    { header: 'Aufwand in bar', key: 'aufwand', width: 16 },
    { header: 'Waehrung', key: 'waehrung', width: 10 },
    { header: 'Quote dezimal', key: 'quote', width: 14 },
    { header: 'Quote amerikanisch', key: 'quoteUS', width: 18 },
    { header: 'Auszahlung gelesen', key: 'auszahlungGelesen', width: 18 },
    { header: 'Auszahlung gerechnet', key: 'auszahlungGerechnet', width: 20 },
    { header: 'Abweichung', key: 'abweichung', width: 14 },
    { header: 'Tatsaechlich zurueck', key: 'zurueck', width: 18 },
    { header: 'Ergebnis', key: 'ergebnis', width: 14 },
    { header: 'Gratiswette', key: 'gratis', width: 12 },
    { header: 'Each Way', key: 'eachway', width: 10 },
    { header: 'Lesesicherheit', key: 'sicherheit', width: 14 },
    { header: 'Hinweise', key: 'hinweise', width: 60 },
  ]

  kopfzeile(blatt)

  let nr = 0
  for (const eintrag of eintraege) {
    const s = eintrag.schein
    nr++
    const zeilennummer = nr + 1
    const w = s.waehrung.wert ?? 'UNBEKANNT'
    const geldformat = FORMAT[w] ?? FORMAT.UNBEKANNT

    const aufwand = runde(barEinsatz(s), 2)
    const rueckfluss = realisierterRueckfluss(s)
    const potenzial = offenePotenzialauszahlung(s)

    const zeile = blatt.addRow({
      nr,
      gruppe: eintrag.riesenschein.name,
      anbieter: s.buchmacher.wert ?? '',
      konto: s.konto.wert ?? '',
      scheinNr: s.scheinNr.wert ?? '',
      zeit: s.gesetztAm.wert ? s.gesetztAm.wert.replace('T', ' ') : '',
      art: s.art,
      status: statusText(s.status),
      einsatz: zahl(s.einsatz.wert),
      aufwand,
      waehrung: w,
      quote: zahl(s.quoteDezimal.wert, 4),
      quoteUS: zahl(s.quoteAmerikanisch.wert, 0),
      auszahlungGelesen: zahl(istEntschieden(s.status) ? null : s.auszahlung.wert),
      gratis: s.gratiswette ? 'ja' : '',
      eachway: s.eachWay ? 'ja' : '',
      sicherheit: zahl(s.ocrSicherheit, 2),
      hinweise: s.hinweise.map((h) => `[${h.schwere}] ${h.text}`).join(' | '),
    })

    // Auszahlung gerechnet: als Formel, damit der Rechenweg sichtbar ist.
    const gerechnet = zelle(blatt, zeilennummer, 'auszahlungGerechnet')
    const einsatzAdresse = `I${zeilennummer}`
    const quoteAdresse = `L${zeilennummer}`
    const ergebnisWert =
      s.einsatz.wert !== null && s.quoteDezimal.wert !== null
        ? runde(s.einsatz.wert * s.quoteDezimal.wert, 2)
        : null
    if (ergebnisWert !== null) {
      gerechnet.value = {
        formula: `${einsatzAdresse}*${quoteAdresse}`,
        result: ergebnisWert,
      }
    }

    // Abweichung zwischen gelesener und gerechneter Auszahlung.
    const abweichung = zelle(blatt, zeilennummer, 'abweichung')
    const gelesenWert = istEntschieden(s.status) ? null : s.auszahlung.wert
    if (gelesenWert !== null && ergebnisWert !== null) {
      abweichung.value = {
        formula: `N${zeilennummer}-O${zeilennummer}`,
        result: runde(gelesenWert - ergebnisWert, 2),
      }
    }

    // Tatsaechlicher Rueckfluss und Ergebnis.
    const zurueck = zelle(blatt, zeilennummer, 'zurueck')
    if (rueckfluss.bekannt && rueckfluss.wert !== null) {
      zurueck.value = runde(rueckfluss.wert, 2)
      const ergebnis = zelle(blatt, zeilennummer, 'ergebnis')
      ergebnis.value = {
        formula: `Q${zeilennummer}-J${zeilennummer}`,
        result: runde(rueckfluss.wert - aufwand, 2),
      }
    } else if (!istEntschieden(s.status) && potenzial.bekannt && potenzial.wert !== null) {
      zelle(blatt, zeilennummer, 'auszahlungGelesen').value = runde(potenzial.wert, 2)
    }

    for (const schluessel of ['einsatz', 'aufwand', 'auszahlungGelesen', 'auszahlungGerechnet', 'abweichung', 'zurueck', 'ergebnis']) {
      zelle(blatt, zeilennummer, schluessel).numFmt = geldformat
    }
    zelle(blatt, zeilennummer, 'quote').numFmt = FORMAT.quote
    zelle(blatt, zeilennummer, 'quoteUS').numFmt = FORMAT.quoteUS
    zelle(blatt, zeilennummer, 'sicherheit').numFmt = '0 %'

    // Zeilen mit einem Fehler werden eingefaerbt, damit sie nicht untergehen.
    if (s.hinweise.some((h) => h.schwere === 'fehler')) {
      zeile.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E4' } }
      })
    } else if (s.hinweise.some((h) => h.schwere === 'warnung')) {
      zeile.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6E0' } }
      })
    }
  }

  const letzteZeile = Math.max(2, nr + 1)
  blatt.autoFilter = { from: { row: 1, column: 1 }, to: { row: letzteZeile, column: 22 } }

  // Summenzeile unten.
  const summenZeile = letzteZeile + 2
  blatt.getCell(`H${summenZeile}`).value = 'Summe'
  blatt.getCell(`H${summenZeile}`).font = { bold: true }
  for (const spalte of ['I', 'J', 'Q', 'R']) {
    const zellenname = `${spalte}${summenZeile}`
    blatt.getCell(zellenname).value = {
      formula: `SUM(${spalte}2:${spalte}${letzteZeile})`,
      result: summeSpalte(blatt, spalte, letzteZeile),
    }
    blatt.getCell(zellenname).font = { bold: true }
    blatt.getCell(zellenname).numFmt = FORMAT.UNBEKANNT
  }
  blatt.getCell(`A${summenZeile + 1}`).value =
    gebiet === 'de'
      ? 'Achtung: die Summe ist nur aussagekraeftig, wenn alle Zeilen dieselbe Waehrung haben.'
      : 'Note: the total is only meaningful if every row uses the same currency.'

  return { letzteZeile }
}

/**
 * Ein Blatt mit einer Zeile je Riesenschein, vollstaendig aus Formeln.
 *
 * @param {any} mappe
 * @param {Ausgabeposten[]} posten
 * @param {number} letzteScheinZeile
 * @param {'de'|'en'} gebiet
 */
function baueRiesenscheinBlatt(mappe, posten, letzteScheinZeile, gebiet) {
  const blatt = mappe.addWorksheet('Riesenscheine', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  blatt.columns = [
    { header: 'Riesenschein', key: 'name', width: 36 },
    { header: 'Scheine', key: 'anzahl', width: 9 },
    { header: 'Anbieter', key: 'anbieter', width: 9 },
    { header: 'Konten', key: 'konten', width: 9 },
    { header: 'Gesamteinsatz', key: 'einsatz', width: 16 },
    { header: 'Davon offen', key: 'offen', width: 14 },
    { header: 'Davon entschieden', key: 'entschieden', width: 18 },
    { header: 'Effektive Quote', key: 'quote', width: 14 },
    { header: 'Moegliche Auszahlung', key: 'auszahlung', width: 20 },
    { header: 'Moeglicher Gewinn', key: 'gewinn', width: 18 },
    { header: 'Bisher zurueck', key: 'zurueck', width: 16 },
    { header: 'Ergebnis bisher', key: 'ergebnis', width: 16 },
    { header: 'Noch im Risiko', key: 'risiko', width: 14 },
    { header: 'Bestenfalls', key: 'bestenfalls', width: 14 },
    { header: 'Schlimmstenfalls', key: 'schlimmstenfalls', width: 16 },
    { header: 'Waehrung', key: 'waehrung', width: 10 },
    { header: 'Anbieterliste', key: 'liste', width: 46 },
  ]
  kopfzeile(blatt)

  let zeilennummer = 1
  for (const p of posten) {
    zeilennummer++
    const r = p.rechnung
    const geldformat = FORMAT[r.waehrung] ?? FORMAT.UNBEKANNT

    blatt.addRow({
      name: p.riesenschein.name,
      anzahl: r.anzahlScheine,
      anbieter: r.anzahlBuchmacher,
      konten: r.anzahlKonten,
      einsatz: runde(r.einsatzGesamt, 2),
      offen: runde(r.einsatzOffen, 2),
      entschieden: runde(r.einsatzEntschieden, 2),
      quote: zahl(r.quoteEffektiv, 4),
      auszahlung: runde(r.auszahlungMoeglich, 2),
      zurueck: runde(r.auszahlungRealisiert, 2),
      ergebnis: runde(r.ergebnisRealisiert, 2),
      risiko: runde(r.imRisiko, 2),
      waehrung: r.waehrung,
      liste: r.proBuchmacher
        .map((b) => `${b.buchmacher}: ${formatiere(b.einsatz, r.waehrung, gebiet)}`)
        .join(' | '),
    })

    // Die abgeleiteten Zahlen als Formel, damit der Zusammenhang sichtbar bleibt.
    zelle(blatt, zeilennummer, 'gewinn').value = {
      formula: `I${zeilennummer}-E${zeilennummer}`,
      result: runde(r.gewinnMoeglich, 2),
    }
    zelle(blatt, zeilennummer, 'bestenfalls').value = {
      formula: `L${zeilennummer}+(I${zeilennummer}-K${zeilennummer}-M${zeilennummer})`,
      result: runde(r.bestenfalls, 2),
    }
    zelle(blatt, zeilennummer, 'schlimmstenfalls').value = {
      formula: `L${zeilennummer}-M${zeilennummer}`,
      result: runde(r.schlimmstenfalls, 2),
    }

    for (const schluessel of [
      'einsatz', 'offen', 'entschieden', 'auszahlung', 'gewinn',
      'zurueck', 'ergebnis', 'risiko', 'bestenfalls', 'schlimmstenfalls',
    ]) {
      zelle(blatt, zeilennummer, schluessel).numFmt = geldformat
    }
    zelle(blatt, zeilennummer, 'quote').numFmt = FORMAT.quote
  }

  blatt.getCell(`A${zeilennummer + 2}`).value =
    'Die Spalten Bestenfalls und Schlimmstenfalls sind das Endergebnis, wenn ab jetzt alles ' +
    'gewinnt beziehungsweise alles verliert. Das bereits erzielte Ergebnis steckt in beiden drin.'
  void letzteScheinZeile
}

/**
 * Ein Blatt mit einer Zeile je Auswahl.
 *
 * @param {any} mappe
 * @param {{schein: import('../kern/typen.js').Schein, riesenschein: import('../kern/typen.js').Riesenschein}[]} eintraege
 */
function baueAuswahlBlatt(mappe, eintraege) {
  const blatt = mappe.addWorksheet('Auswahlen', { views: [{ state: 'frozen', ySplit: 1 }] })
  blatt.columns = [
    { header: 'Riesenschein', key: 'gruppe', width: 30 },
    { header: 'Schein-Nr', key: 'scheinNr', width: 16 },
    { header: 'Anbieter', key: 'anbieter', width: 16 },
    { header: 'Bein', key: 'bein', width: 6 },
    { header: 'Tipp', key: 'tipp', width: 26 },
    { header: 'Begegnung', key: 'ereignis', width: 40 },
    { header: 'Markt', key: 'markt', width: 40 },
    { header: 'Linie', key: 'linie', width: 10 },
    { header: 'Quote', key: 'quote', width: 12 },
    { header: 'Ausgang', key: 'ergebnis', width: 26 },
    { header: 'Status', key: 'status', width: 14 },
  ]
  kopfzeile(blatt)

  let zeilennummer = 1
  for (const eintrag of eintraege) {
    const s = eintrag.schein
    for (let i = 0; i < s.auswahlen.length; i++) {
      const a = s.auswahlen[i]
      if (!a) continue
      zeilennummer++
      blatt.addRow({
        gruppe: eintrag.riesenschein.name,
        scheinNr: s.scheinNr.wert ?? '',
        anbieter: s.buchmacher.wert ?? '',
        bein: i + 1,
        tipp: a.tipp.wert ?? '',
        ereignis: a.ereignis.wert ?? '',
        markt: a.markt.wert ?? '',
        linie: zahl(a.linie.wert, 2),
        quote: zahl(a.quoteDezimal.wert, 4),
        ergebnis: a.ergebnis.wert ?? '',
        status: statusText(a.status),
      })
      zelle(blatt, zeilennummer, 'quote').numFmt = FORMAT.quote
    }
  }
}

/**
 * Ein Blatt mit der Aufteilung nach Anbieter.
 *
 * @param {any} mappe
 * @param {Ausgabeposten[]} posten
 * @param {'de'|'en'} gebiet
 */
function baueAnbieterBlatt(mappe, posten, gebiet) {
  const blatt = mappe.addWorksheet('Anbieter', { views: [{ state: 'frozen', ySplit: 1 }] })
  blatt.columns = [
    { header: 'Riesenschein', key: 'gruppe', width: 30 },
    { header: 'Anbieter', key: 'anbieter', width: 20 },
    { header: 'Konten', key: 'konten', width: 30 },
    { header: 'Scheine', key: 'anzahl', width: 9 },
    { header: 'Einsatz', key: 'einsatz', width: 16 },
    { header: 'Anteil', key: 'anteil', width: 10 },
    { header: 'Moegliche Auszahlung', key: 'auszahlung', width: 20 },
    { header: 'Schnittquote', key: 'quote', width: 14 },
  ]
  kopfzeile(blatt)

  let zeilennummer = 1
  for (const p of posten) {
    const geldformat = FORMAT[p.rechnung.waehrung] ?? FORMAT.UNBEKANNT
    for (const b of p.rechnung.proBuchmacher) {
      zeilennummer++
      blatt.addRow({
        gruppe: p.riesenschein.name,
        anbieter: b.buchmacher,
        konten: b.konten.join(', '),
        anzahl: b.anzahl,
        einsatz: runde(b.einsatz, 2),
        anteil: runde(b.anteil, 4),
        auszahlung: runde(b.auszahlungMoeglich, 2),
        quote: zahl(b.quoteSchnitt, 4),
      })
      zelle(blatt, zeilennummer, 'einsatz').numFmt = geldformat
      zelle(blatt, zeilennummer, 'auszahlung').numFmt = geldformat
      zelle(blatt, zeilennummer, 'anteil').numFmt = FORMAT.anteil
      zelle(blatt, zeilennummer, 'quote').numFmt = FORMAT.quote
    }
  }
  void gebiet
}

/**
 * Das Blatt mit dem Riesenschein als Bild.
 *
 * @param {any} mappe
 * @param {Mappeneinstellungen} einstellungen
 */
async function baueBelegBlatt(mappe, einstellungen) {
  if (!einstellungen.belegBild) return
  const blatt = mappe.addWorksheet('Beleg')

  try {
    const puffer = new Uint8Array(await einstellungen.belegBild.arrayBuffer())
    const art = einstellungen.belegBild.type.includes('jpeg') ? 'jpeg' : 'png'
    const kennung = mappe.addImage({ buffer: puffer, extension: art })

    const masse = einstellungen.belegMasse ?? { breite: 900, hoehe: 1200 }
    // Frei schwebend verankern. Das ist die einzige Art, die sich in Excel,
    // LibreOffice und Google Tabellen gleich verhaelt.
    blatt.addImage(kennung, {
      tl: { col: 0, row: 1 },
      ext: { width: masse.breite, height: masse.hoehe },
    })
    blatt.getCell('A1').value = einstellungen.titel
    blatt.getCell('A1').font = { bold: true, size: 14 }
  } catch (fehler) {
    blatt.getCell('A1').value =
      `Das Bild konnte nicht eingebettet werden: ${fehler instanceof Error ? fehler.message : String(fehler)}`
  }
}

/**
 * Das Blatt mit allen Hinweisen. Nichts verschwindet still.
 *
 * @param {any} mappe
 * @param {Ausgabeposten[]} posten
 * @param {Mappeneinstellungen} einstellungen
 */
function baueHinweisBlatt(mappe, posten, einstellungen) {
  const blatt = mappe.addWorksheet('Hinweise', { views: [{ state: 'frozen', ySplit: 1 }] })
  blatt.columns = [
    { header: 'Schwere', key: 'schwere', width: 10 },
    { header: 'Riesenschein', key: 'gruppe', width: 30 },
    { header: 'Schein', key: 'schein', width: 18 },
    { header: 'Feld', key: 'feld', width: 18 },
    { header: 'Code', key: 'code', width: 26 },
    { header: 'Hinweis', key: 'text', width: 110 },
  ]
  kopfzeile(blatt)

  for (const p of posten) {
    for (const h of p.rechnung.hinweise) {
      blatt.addRow({
        schwere: h.schwere,
        gruppe: p.riesenschein.name,
        schein: '',
        feld: h.feld ?? '',
        code: h.code,
        text: h.text,
      })
    }
    for (const s of p.scheine) {
      for (const h of s.hinweise) {
        blatt.addRow({
          schwere: h.schwere,
          gruppe: p.riesenschein.name,
          schein: s.scheinNr.wert ?? s.id,
          feld: h.feld ?? '',
          code: h.code,
          text: h.text,
        })
      }
    }
  }

  for (const rest of einstellungen.restposten ?? []) {
    const schein = einstellungen.scheinNachId?.get(rest.scheinId)
    blatt.addRow({
      schwere: 'warnung',
      gruppe: 'Resttopf',
      schein: schein?.scheinNr.wert ?? rest.scheinId,
      feld: '',
      code: 'restposten',
      text: rest.grund,
    })
  }

  blatt.eachRow((zeile, nummer) => {
    if (nummer === 1) return
    const schwere = String(zeile.getCell(1).value ?? '')
    if (schwere === 'fehler') {
      zeile.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E4' } }
      })
    }
  })
}

/**
 * Die Uebersicht ganz vorn.
 *
 * @param {any} mappe
 * @param {Ausgabeposten[]} posten
 * @param {Mappeneinstellungen} einstellungen
 * @param {number} letzteScheinZeile
 * @param {'de'|'en'} gebiet
 */
function baueUebersichtBlatt(mappe, posten, einstellungen, letzteScheinZeile, gebiet) {
  const blatt = mappe.addWorksheet('Uebersicht')
  blatt.columns = [
    { key: 'a', width: 30 },
    { key: 'b', width: 24 },
    { key: 'c', width: 70 },
  ]

  blatt.getCell('A1').value = einstellungen.titel
  blatt.getCell('A1').font = { bold: true, size: 18 }
  blatt.getCell('A2').value = `Erstellt am ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
  blatt.getCell('A2').font = { color: { argb: 'FF808080' } }

  const waehrungen = new Set(posten.map((p) => p.rechnung.waehrung))
  const einheitlich = waehrungen.size === 1 && !waehrungen.has('UNBEKANNT')
  const geldformat = einheitlich
    ? FORMAT[/** @type {keyof typeof FORMAT} */ ([...waehrungen][0] ?? 'UNBEKANNT')] ?? FORMAT.UNBEKANNT
    : FORMAT.UNBEKANNT

  const zeilen = [
    ['Riesenscheine', posten.length, 'Anzahl verschiedener Wetten'],
    [
      'Scheine gesamt',
      posten.reduce((n, p) => n + p.rechnung.anzahlScheine, 0),
      'Anzahl einzelner Wettscheine',
    ],
    [
      'Anbieter gesamt',
      new Set(posten.flatMap((p) => p.rechnung.buchmacher)).size,
      'Bei wie vielen Buchmachern gesetzt wurde',
    ],
    [
      'Konten gesamt',
      new Set(posten.flatMap((p) => p.rechnung.konten)).size,
      'Wie viele verschiedene Konten beteiligt sind',
    ],
  ]

  let zeilennummer = 4
  for (const [name, wert, erklaerung] of zeilen) {
    blatt.getCell(`A${zeilennummer}`).value = String(name)
    blatt.getCell(`A${zeilennummer}`).font = { bold: true }
    blatt.getCell(`B${zeilennummer}`).value = wert
    blatt.getCell(`C${zeilennummer}`).value = String(erklaerung)
    blatt.getCell(`C${zeilennummer}`).font = { color: { argb: 'FF808080' } }
    zeilennummer++
  }

  zeilennummer++
  const geldZeilen = [
    ['Gesamteinsatz', 'einsatzGesamt', 'Summe aller Einsaetze, Gratiswetten zaehlen nicht mit'],
    ['Davon noch offen', 'einsatzOffen', 'Einsatz der Scheine, die noch nicht entschieden sind'],
    ['Moegliche Auszahlung', 'auszahlungMoeglich', 'Was zurueckkaeme, wenn alles Offene gewinnt'],
    ['Moeglicher Gewinn', 'gewinnMoeglich', 'Moegliche Auszahlung minus Gesamteinsatz'],
    ['Bisher zurueck', 'auszahlungRealisiert', 'Aus bereits entschiedenen Scheinen'],
    ['Ergebnis bisher', 'ergebnisRealisiert', 'Nur entschiedene Scheine, auf beiden Seiten der Rechnung'],
    ['Noch im Risiko', 'imRisiko', 'Der Einsatz, der noch verloren gehen kann'],
    ['Bestenfalls', 'bestenfalls', 'Endergebnis, wenn ab jetzt alles gewinnt'],
    ['Schlimmstenfalls', 'schlimmstenfalls', 'Endergebnis, wenn ab jetzt alles verliert'],
  ]

  for (const [name, schluessel, erklaerung] of geldZeilen) {
    const summe = posten.reduce(
      (s, p) => s + Number(/** @type {any} */ (p.rechnung)[schluessel] ?? 0),
      0
    )
    blatt.getCell(`A${zeilennummer}`).value = String(name)
    blatt.getCell(`A${zeilennummer}`).font = { bold: true }
    const zielZelle = blatt.getCell(`B${zeilennummer}`)
    zielZelle.value = runde(summe, 2)
    zielZelle.numFmt = geldformat
    blatt.getCell(`C${zeilennummer}`).value = String(erklaerung)
    blatt.getCell(`C${zeilennummer}`).font = { color: { argb: 'FF808080' } }
    zeilennummer++
  }

  if (!einheitlich) {
    zeilennummer++
    const warnung = blatt.getCell(`A${zeilennummer}`)
    warnung.value =
      'ACHTUNG: In dieser Mappe kommen mehrere Waehrungen vor. Die Summen oben addieren ' +
      'verschiedene Waehrungen und sind deshalb NICHT aussagekraeftig.'
    warnung.font = { bold: true, color: { argb: 'FFB00020' } }
  }

  zeilennummer += 2
  blatt.getCell(`A${zeilennummer}`).value = 'Aufbau der Mappe'
  blatt.getCell(`A${zeilennummer}`).font = { bold: true }
  zeilennummer++
  const blattErklaerung = [
    ['Scheine', 'Jede Zeile ist ein einzelner Wettschein, so wie er im Bild stand.'],
    ['Riesenscheine', 'Jede Zeile ist eine Wette, die mehrfach gesetzt wurde.'],
    ['Auswahlen', 'Die einzelnen Beine der Wetten.'],
    ['Anbieter', 'Wie sich der Einsatz auf die Buchmacher verteilt.'],
    ['Beleg', 'Der Riesenschein als Bild.'],
    ['Hinweise', 'Alles, was beim Lesen aufgefallen ist. Bitte durchsehen.'],
  ]
  for (const [name, text] of blattErklaerung) {
    blatt.getCell(`A${zeilennummer}`).value = name
    blatt.getCell(`C${zeilennummer}`).value = text
    blatt.getCell(`C${zeilennummer}`).font = { color: { argb: 'FF808080' } }
    zeilennummer++
  }

  void letzteScheinZeile
  void gebiet
}

/**
 * Formatiert die Kopfzeile eines Blattes.
 *
 * @param {any} blatt
 */
function kopfzeile(blatt) {
  const zeile = blatt.getRow(1)
  zeile.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  zeile.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2A3A' } }
  zeile.height = 22
  zeile.alignment = { vertical: 'middle', wrapText: true }
}

/**
 * @param {any} blatt
 * @param {number} zeile
 * @param {string} schluessel
 * @returns {any}
 */
function zelle(blatt, zeile, schluessel) {
  return blatt.getRow(zeile).getCell(schluessel)
}

/**
 * Gibt eine echte Zahl zurueck oder null. Niemals eine Zeichenkette,
 * sonst kann Excel damit nicht rechnen.
 *
 * @param {number|null|undefined} wert
 * @param {number} [stellen]
 * @returns {number|null}
 */
function zahl(wert, stellen = 2) {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) return null
  return runde(wert, stellen)
}

/**
 * @param {any} blatt
 * @param {string} spalte
 * @param {number} letzteZeile
 * @returns {number}
 */
function summeSpalte(blatt, spalte, letzteZeile) {
  let summe = 0
  for (let z = 2; z <= letzteZeile; z++) {
    const wert = blatt.getCell(`${spalte}${z}`).value
    if (typeof wert === 'number') summe += wert
    else if (wert && typeof wert === 'object' && typeof wert.result === 'number') summe += wert.result
  }
  return runde(summe, 2)
}
