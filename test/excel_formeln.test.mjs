import test from 'node:test'
import assert from 'node:assert/strict'

import { rechne } from '../kern/rechnung.js'
import { runde } from '../kern/zahlen.js'

/**
 * Die Excel-Funde der Fehlersuche vom 17.09.2026, A4 und A5.
 *
 *   A4  Das Blatt Riesenscheine rechnete "Moeglicher Gewinn" als I-E, also
 *       moegliche Auszahlung minus GESAMTeinsatz. Das Programm zieht den
 *       Einsatz der unklaren Scheine (vorzeitige Auszahlung ohne Betrag)
 *       nicht ab. Sobald ein Cashout ohne Betrag dabei war, stand in der
 *       Mappe eine Zahl, die das Programm nie gezeigt hat.
 *   A5  Auf der Spalte "Auszahlung gelesen" (N) sass schon die
 *       Abweichungsformel N-O, danach wurde N noch einmal mit der
 *       GERECHNETEN Potenzialauszahlung ueberschrieben. Nach dem ersten
 *       Neuberechnen in Excel zeigte die Abweichungsspalte eine Abweichung,
 *       die es nicht gibt.
 *
 * Excel selbst laeuft unter node nicht. Deshalb steht hier ein Nachbau der
 * Bibliothek, der nur festhaelt, was in welche Zelle geschrieben wurde, und
 * ein kleiner Rechner, der eine Formel wie L2+I2-K2-M2 gegen genau diese
 * Zellen auswertet. Damit wird die FORMEL geprueft, nicht ihr mitgeliefertes
 * Ergebnis: das Ergebnis sieht Excel nur bis zum ersten Neuberechnen.
 */

// ---------------------------------------------------------------------------
// Der Nachbau der Excel-Bibliothek.
// ---------------------------------------------------------------------------

/** @param {number} n 1 wird A, 27 wird AA. */
function spaltenBuchstabe(n) {
  let s = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    s = String.fromCharCode(65 + rest) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

class ProbeZelle {
  constructor() {
    this.value = null
    this.numFmt = null
    this.font = null
    this.fill = null
    this.alignment = null
  }
}

class ProbeZeile {
  constructor(blatt, nummer) {
    this.blatt = blatt
    this.nummer = nummer
    /** @type {Map<number, ProbeZelle>} */
    this.zellen = new Map()
    this.font = null
    this.fill = null
    this.height = 0
    this.alignment = null
  }

  /** @param {number|string} schluessel Spaltennummer, Spaltenschluessel oder Buchstabe. */
  getCell(schluessel) {
    let nummer = 0
    if (typeof schluessel === 'number') {
      nummer = schluessel
    } else {
      const stelle = this.blatt.columns.findIndex((c) => c.key === schluessel)
      if (stelle >= 0) nummer = stelle + 1
      else if (/^[A-Z]+$/.test(schluessel)) {
        nummer = [...schluessel].reduce((n, z) => n * 26 + (z.charCodeAt(0) - 64), 0)
      }
    }
    if (nummer <= 0) throw new Error(`Unbekannte Spalte: ${schluessel}`)
    let zelle = this.zellen.get(nummer)
    if (!zelle) {
      zelle = new ProbeZelle()
      this.zellen.set(nummer, zelle)
    }
    return zelle
  }

  eachCell(arbeit) {
    for (const [nummer, zelle] of this.zellen) arbeit(zelle, nummer)
  }
}

class ProbeBlatt {
  constructor(name) {
    this.name = name
    /** @type {{header?: string, key?: string, width?: number}[]} */
    this.columns = []
    /** @type {Map<number, ProbeZeile>} */
    this.zeilen = new Map()
    this.letzte = 1
    this.autoFilter = null
  }

  getRow(nummer) {
    let zeile = this.zeilen.get(nummer)
    if (!zeile) {
      zeile = new ProbeZeile(this, nummer)
      this.zeilen.set(nummer, zeile)
    }
    return zeile
  }

  addRow(werte) {
    this.letzte += 1
    const zeile = this.getRow(this.letzte)
    for (const [schluessel, wert] of Object.entries(werte)) {
      zeile.getCell(schluessel).value = wert ?? null
    }
    return zeile
  }

  /** @param {string} adresse z.B. "I5" */
  getCell(adresse) {
    const treffer = /^([A-Z]+)(\d+)$/.exec(adresse)
    if (!treffer) throw new Error(`Keine Zelladresse: ${adresse}`)
    return this.getRow(Number(treffer[2])).getCell(treffer[1])
  }

  eachRow(arbeit) {
    const nummern = [...this.zeilen.keys()].sort((a, b) => a - b)
    for (const nummer of nummern) arbeit(this.zeilen.get(nummer), nummer)
  }
}

class ProbeMappe {
  constructor() {
    this.creator = ''
    this.created = null
    this.calcProperties = {}
    /** @type {ProbeBlatt[]} */
    this.worksheets = []
    this.views = []
    this.xlsx = { writeBuffer: async () => new ArrayBuffer(0) }
  }

  addWorksheet(name) {
    const blatt = new ProbeBlatt(name)
    this.worksheets.push(blatt)
    return blatt
  }
}

// Vor dem Import anmelden: ladeExcel nimmt eine schon vorhandene Bibliothek,
// ohne den Browser zu brauchen.
globalThis.ExcelJS = { Workbook: ProbeMappe }
const { baueMappe } = await import('../ausgabe/excel.js')

/**
 * Rechnet eine Formel wie "L2+(I2-K2-M2)" gegen die Zellen des Blattes aus.
 * Kennt genau Plus, Minus und Klammern, mehr steht in keiner Formel der Mappe.
 *
 * @param {string} formel
 * @param {ProbeBlatt} blatt
 * @returns {number}
 */
function bewerte(formel, blatt) {
  const teile = formel.match(/[A-Z]+\d+|[+\-()]/g) ?? []
  let stelle = 0

  function wertVon(adresse) {
    const inhalt = blatt.getCell(adresse).value
    if (typeof inhalt === 'number') return inhalt
    if (inhalt && typeof inhalt === 'object' && typeof inhalt.result === 'number') return inhalt.result
    return 0
  }

  function ausdruck() {
    let summe = einzeln()
    while (teile[stelle] === '+' || teile[stelle] === '-') {
      const zeichen = teile[stelle]
      stelle += 1
      const rechts = einzeln()
      summe = zeichen === '+' ? summe + rechts : summe - rechts
    }
    return summe
  }

  function einzeln() {
    const teil = teile[stelle]
    if (teil === '(') {
      stelle += 1
      const innen = ausdruck()
      if (teile[stelle] !== ')') throw new Error(`Klammer fehlt in ${formel}`)
      stelle += 1
      return innen
    }
    stelle += 1
    return wertVon(teil)
  }

  const ergebnis = ausdruck()
  if (stelle !== teile.length) throw new Error(`Formel nicht verstanden: ${formel}`)
  return ergebnis
}

// ---------------------------------------------------------------------------
// Die Scheine fuer die Probe.
// ---------------------------------------------------------------------------

function schein(id, status, extra = {}) {
  const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'ocr', roh: '' })
  const einsatz = extra.einsatz ?? 500
  const quote = extra.quote ?? 1.8
  return {
    id,
    bildId: 'einFoto',
    gruppeId: 'G1',
    buchmacher: feld('PS3838'),
    konto: feld(null),
    scheinNr: feld(id),
    gesetztAm: feld('2026-09-19T12:00:00.000Z'),
    einsatz: feld(einsatz),
    auszahlung: feld('auszahlungGelesen' in extra ? extra.auszahlungGelesen : einsatz * quote),
    ausgezahlt: extra.ausgezahlt ?? feld(null),
    quoteDezimal: feld(quote),
    quoteAmerikanisch: feld(null),
    waehrung: feld('EUR'),
    status,
    art: 'kombi',
    gratiswette: false,
    eachWay: extra.eachWay ?? false,
    ausgeschlossen: false,
    beine: [],
    auswahlen: [],
    hinweise: [],
    zeilen: [],
    notiz: '',
    ocrSicherheit: 0.9,
    geaendertAm: '2026-09-19T12:00',
    vonHand: false,
  }
}

function posten(scheine) {
  return {
    riesenschein: {
      id: 'G1',
      projektId: 'P1',
      name: 'Probe',
      signatur: 'sig',
      scheinIds: scheine.map((s) => s.id),
      notiz: '',
      ordner: '',
      angelegtAm: '2026-09-19T12:00',
      geaendertAm: '2026-09-19T12:00',
    },
    scheine,
    rechnung: rechne(scheine),
  }
}

function blattVon(mappe, name) {
  const blatt = mappe.worksheets.find((b) => b.name === name)
  assert.ok(blatt, `es gibt ein Blatt "${name}"`)
  return blatt
}

// ---------------------------------------------------------------------------
// A4: Moeglicher Gewinn im Riesenschein-Blatt.
// ---------------------------------------------------------------------------

test('A4: die Gewinnformel der Mappe rechnet wie das Programm, auch mit Cashout', async () => {
  // Ein gewonnener Schein und ein Cashout OHNE eingetragenen Betrag. Der
  // Cashout ist unklar und steht auf beiden Seiten der Rechnung draussen.
  const p = posten([
    schein('gewonnen', 'gewonnen'),
    schein('cashout', 'cashout'),
  ])
  assert.ok(p.rechnung.hinweise.some((h) => h.code === 'realisiert_unklar'), 'der Cashout ist unklar')

  await baueMappe([p], { titel: 'Probe' })
  const blatt = blattVon(letzteMappe, 'Riesenscheine')

  const gewinn = blatt.getRow(2).getCell('gewinn').value
  assert.ok(gewinn && typeof gewinn === 'object', 'der Gewinn ist eine Formel')
  assert.equal(gewinn.result, runde(p.rechnung.gewinnMoeglich, 2))

  // DER KERN: die Formel selbst muss dieselbe Zahl ergeben. Das mitgelieferte
  // Ergebnis sieht Excel nur bis zum ersten Neuberechnen.
  assert.ok(
    Math.abs(bewerte(gewinn.formula, blatt) - p.rechnung.gewinnMoeglich) < 0.01,
    `Formel ${gewinn.formula} ergibt ${bewerte(gewinn.formula, blatt)}, ` +
      `das Programm sagt ${p.rechnung.gewinnMoeglich}`
  )

  // Gegenprobe am Nachbarn: auch Bestenfalls muss als Formel stimmen.
  const bestenfalls = blatt.getRow(2).getCell('bestenfalls').value
  assert.ok(Math.abs(bewerte(bestenfalls.formula, blatt) - p.rechnung.bestenfalls) < 0.01)
})

// ---------------------------------------------------------------------------
// A5: "Auszahlung gelesen" bleibt die gelesene Zahl.
// ---------------------------------------------------------------------------

test('A5: die gelesene Auszahlung wird nicht mit der gerechneten ueberschrieben', async () => {
  // Ein offener Each-Way-Schein: gelesen wurden 900, das Potenzial ist wegen
  // Each Way 1.800. Genau hier hat die alte Fassung die Spalte N nachtraeglich
  // mit 1.800 ueberschrieben, waehrend die Abweichungsformel N-O schon stand.
  const p = posten([schein('ew', 'offen', { eachWay: true, auszahlungGelesen: 900 })])

  await baueMappe([p], { titel: 'Probe' })
  const blatt = blattVon(letzteMappe, 'Scheine')

  assert.equal(blatt.getRow(2).getCell('auszahlungGelesen').value, 900)

  const abweichung = blatt.getRow(2).getCell('abweichung').value
  assert.ok(abweichung && typeof abweichung === 'object', 'die Abweichung ist eine Formel')
  assert.ok(
    Math.abs(bewerte(abweichung.formula, blatt) - abweichung.result) < 0.01,
    'die Formel ergibt nach dem Neuberechnen dieselbe Zahl wie beim Erzeugen'
  )
})

test('A5: ohne gelesene Auszahlung bleibt die Spalte leer statt gerechnet gefuellt', async () => {
  // Steht auf dem Foto keine Auszahlung, hat in "gelesen" auch nichts zu
  // stehen. Die gerechnete Zahl steht daneben in ihrer eigenen Spalte O.
  const p = posten([schein('ohne', 'offen', { auszahlungGelesen: null })])

  await baueMappe([p], { titel: 'Probe' })
  const blatt = blattVon(letzteMappe, 'Scheine')

  assert.equal(blatt.getRow(2).getCell('auszahlungGelesen').value, null)
  const gerechnet = blatt.getRow(2).getCell('auszahlungGerechnet').value
  assert.equal(gerechnet.result, 900)
})

// ---------------------------------------------------------------------------
// Die zuletzt gebaute Mappe abgreifen: baueMappe legt sie selbst an.
// ---------------------------------------------------------------------------

/** @type {ProbeMappe} */
let letzteMappe
const echteMappe = ProbeMappe
globalThis.ExcelJS = {
  Workbook: class extends echteMappe {
    constructor() {
      super()
      letzteMappe = this
    }
  },
}
