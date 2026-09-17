// @ts-check
/**
 * Traegt die Logodateien aus stil/logos/ in stil/logos.css ein.
 *
 * WOZU DIESES WERKZEUG
 *
 * Karam am 17.09.2026: "Ich will, dass ab jetzt bei jedem Anbieter statt Namen
 * immer das Original-Logo der Anbieter dabei ist." Er hat sich dafuer
 * entschieden, die Dateien ins Repository zu legen.
 *
 * Eine Zeile je Anbieter von Hand nachzutragen waere sechzig Gelegenheiten,
 * sich zu vertippen, und der Fehler faellt nicht auf: ein Logo, dessen Datei
 * fehlt, hinterlaesst ein LEERES Kaestchen, weil die Regel die Schrift
 * unsichtbar macht. Genau der leere Fleck, den Karam nicht wollte.
 *
 * Deshalb wird der Block erzeugt und nicht geschrieben:
 *
 *     node werkzeug/logos_eintragen.mjs
 *
 * Das Werkzeug sieht nach, welche Dateien wirklich in stil/logos/ liegen, und
 * schreibt genau dafuer Regeln. Eine Regel ohne Datei kann so nicht entstehen.
 * Fuer jeden Anbieter ohne Datei bleibt das farbige Kuerzel stehen, und das
 * ist kein Mangel, sondern die Ruecklage.
 *
 * WELCHE NAMEN DIE DATEIEN BRAUCHEN
 *
 * stil/logos/<schluessel>.<endung>, wobei der Schluessel der technische Name
 * aus kern/buchmacher.js ist: ps3838.png, betway.svg, bet365.webp. Welche
 * Schluessel es gibt, sagt dieses Werkzeug, wenn man es ohne Dateien laufen
 * laesst.
 *
 * WARUM DAS NICHT GEGEN PROJEKTREGEL 5 VERSTOESST: erzeugt wird eine
 * Designdatei, und im JavaScript steht weiterhin kein Dateiname und keine
 * Farbe. Wird stil/ geloescht, verschwinden die Logos mit, und keine einzige
 * Zahl im Programm aendert sich.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUCHMACHER } from '../kern/buchmacher.js'

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const logoordner = path.join(wurzel, 'stil', 'logos')
const cssdatei = path.join(wurzel, 'stil', 'logos.css')

/** Zwischen diesen beiden Zeilen steht der erzeugte Block, sonst nichts. */
const ANFANG = '/* ---- ERZEUGT von werkzeug/logos_eintragen.mjs. Nicht von Hand aendern. ---- */'
const ENDE = '/* ---- Ende des erzeugten Blocks ---- */'

/** Was der Browser als Hintergrundbild annimmt. */
const ENDUNGEN = new Set(['.png', '.svg', '.webp', '.jpg', '.jpeg', '.gif', '.avif'])

const schluessel = new Set(BUCHMACHER.map((b) => b.schluessel))

/** @type {{schluessel: string, datei: string}[]} */
const gefunden = []
/** @type {string[]} */
const fremd = []

if (fs.existsSync(logoordner)) {
  for (const name of fs.readdirSync(logoordner).sort()) {
    const endung = path.extname(name).toLowerCase()
    if (!ENDUNGEN.has(endung)) continue
    const stamm = path.basename(name, path.extname(name))
    if (!schluessel.has(stamm)) {
      fremd.push(name)
      continue
    }
    gefunden.push({ schluessel: stamm, datei: name })
  }
}

const zeilen = []
zeilen.push(ANFANG)
zeilen.push('/*')
zeilen.push('  Eine Zeile je Datei, die wirklich in stil/logos/ liegt.')
zeilen.push('')
zeilen.push('  color: transparent macht das Kuerzel unsichtbar, WEIL das Bild darueber')
zeilen.push('  liegt. Deshalb darf hier nie ein Anbieter stehen, dessen Datei fehlt:')
zeilen.push('  sonst waere das Kaestchen leer. Dieses Werkzeug kann das nicht falsch')
zeilen.push('  machen, denn es liest den Ordner, statt einer Liste zu glauben.')
zeilen.push('*/')

if (gefunden.length === 0) {
  zeilen.push('')
  zeilen.push('/* Noch keine Logodatei vorhanden. Alle Anbieter tragen ihr farbiges Kuerzel. */')
} else {
  for (const g of gefunden) {
    zeilen.push('')
    zeilen.push(`[data-anbieter="${g.schluessel}"] {`)
    zeilen.push(`  background-image: url("logos/${g.datei}");`)
    zeilen.push('  color: transparent;')
    zeilen.push('}')
  }
}

zeilen.push('')
zeilen.push(ENDE)
const block = zeilen.join('\n')

let css = fs.readFileSync(cssdatei, 'utf8')
if (css.includes(ANFANG) && css.includes(ENDE)) {
  const von = css.indexOf(ANFANG)
  const bis = css.indexOf(ENDE) + ENDE.length
  css = css.slice(0, von) + block + css.slice(bis)
} else {
  css = css.trimEnd() + '\n\n' + block + '\n'
}
fs.writeFileSync(cssdatei, css, 'utf8')

// --- Bericht ---
console.log(`${gefunden.length} Logodatei(en) eingetragen.`)
if (fremd.length > 0) {
  console.log(`\n${fremd.length} Datei(en) im Ordner passen zu KEINEM Anbieter und wurden uebergangen:`)
  for (const f of fremd) console.log(`  ${f}`)
  console.log('Die Datei muss so heissen wie der technische Schluessel des Anbieters.')
}

const ohne = BUCHMACHER.filter((b) => !gefunden.some((g) => g.schluessel === b.schluessel))
if (ohne.length > 0) {
  console.log(`\n${ohne.length} Anbieter haben noch kein Bild und tragen ihr farbiges Kuerzel:`)
  const namen = ohne.map((b) => `${b.schluessel} (${b.name})`)
  for (let i = 0; i < namen.length; i += 3) {
    console.log('  ' + namen.slice(i, i + 3).map((n) => n.padEnd(30)).join('').trimEnd())
  }
}
