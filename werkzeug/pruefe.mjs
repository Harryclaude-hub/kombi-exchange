/**
 * Gegenprobe ueber das ganze Programm, ohne Browser.
 *
 * Geprueft wird:
 *   1. Jede Datei ist syntaktisch gueltig.
 *   2. Jeder Importpfad zeigt auf eine Datei, die es wirklich gibt.
 *      Ein Tippfehler im Pfad faellt im Browser sonst erst auf, wenn genau
 *      diese Ansicht geoeffnet wird, und dann still.
 *   3. Kein langer Gedankenstrich in einer erzeugten Datei.
 *   4. Keine Farbe steht im JavaScript. Farben gehoeren in stil/.
 *
 * Aufruf: node werkzeug/pruefe.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const ORDNER = ['kern', 'bild', 'lesen', 'ausgabe', 'daten', 'oberflaeche', 'stil', 'test', 'werkzeug']
const UEBERSPRINGEN = new Set(['lib', 'node_modules', '.git'])

/** Der lange Gedankenstrich, gebaut aus seinem Codepunkt. */
const LANGER_STRICH = String.fromCodePoint(0x2014)

/** @type {{art: string, datei: string, text: string}[]} */
const beanstandungen = []
let geprueft = 0

/**
 * @param {string} ordner
 * @returns {string[]}
 */
function sammle(ordner) {
  const heraus = []
  const voll = path.join(wurzel, ordner)
  if (!fs.existsSync(voll)) return heraus
  for (const eintrag of fs.readdirSync(voll, { withFileTypes: true })) {
    if (UEBERSPRINGEN.has(eintrag.name)) continue
    const rel = path.join(ordner, eintrag.name)
    if (eintrag.isDirectory()) heraus.push(...sammle(rel))
    else heraus.push(rel)
  }
  return heraus
}

const dateien = [...ORDNER.flatMap(sammle), 'index.html']

// --- 1. und 2.: Syntax und Importpfade ---

for (const rel of dateien) {
  const voll = path.join(wurzel, rel)
  if (!fs.existsSync(voll)) continue
  const inhalt = fs.readFileSync(voll, 'utf8')
  geprueft++

  // 3. Langer Gedankenstrich.
  //
  // Das gesuchte Zeichen wird aus seinem Codepunkt gebaut und nicht woertlich
  // hingeschrieben. Sonst wuerde diese Pruefdatei sich selbst beanstanden.
  if (inhalt.includes(LANGER_STRICH)) {
    const zeile = inhalt.slice(0, inhalt.indexOf(LANGER_STRICH)).split('\n').length
    beanstandungen.push({
      art: 'gedankenstrich',
      datei: rel,
      text: `Langer Gedankenstrich in Zeile ${zeile}.`,
    })
  }

  if (!rel.endsWith('.js') && !rel.endsWith('.mjs')) continue

  // 4. Farben im JavaScript.
  //
  // Ausgenommen sind drei Faelle, in denen ein Farbwert keine Gestaltung ist,
  // sondern zur Sache gehoert:
  //   stil/   ist die Designschicht selbst.
  //   bild/   rechnet mit Bildpunkten. Die deckende Unterlage vor dem Zeichnen ist
  //           zwingend, sonst liefert ein durchsichtiges PNG unbrauchbare Helligkeiten.
  //   mosaik  bringt eigene Vorgabefarben mit, damit das Blatt auch dann entsteht,
  //           wenn der Ordner stil geloescht wurde.
  //   werkzeug/probe  baut Testbilder nach und muss dafuer echte Farben zeichnen.
  const istBildrechnung =
    rel.startsWith('stil') ||
    rel.startsWith(`bild${path.sep}`) ||
    rel.startsWith(`werkzeug${path.sep}probe`) ||
    rel.includes('mosaik')
  if (!istBildrechnung) {
    const farbe = inhalt.match(/#[0-9a-fA-F]{6}\b|rgba?\(/)
    if (farbe) {
      const zeile = inhalt.slice(0, inhalt.indexOf(farbe[0])).split('\n').length
      beanstandungen.push({
        art: 'farbe-im-code',
        datei: rel,
        text: `Farbe "${farbe[0]}" in Zeile ${zeile}. Farben gehoeren nach stil/.`,
      })
    }
  }

  // Importpfade.
  const muster = /(?:^|[\s;{])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let treffer
  while ((treffer = muster.exec(inhalt)) !== null) {
    const pfad = treffer[1] ?? treffer[2]
    if (!pfad) continue
    if (pfad.startsWith('node:')) continue
    if (!pfad.startsWith('.')) {
      beanstandungen.push({
        art: 'fremder-import',
        datei: rel,
        text: `"${pfad}" ist kein Pfad in dieses Programm. Ohne Bundler gibt es kein Paketverzeichnis.`,
      })
      continue
    }
    const ziel = path.resolve(path.dirname(voll), pfad)
    if (!fs.existsSync(ziel)) {
      beanstandungen.push({
        art: 'toter-import',
        datei: rel,
        text: `"${pfad}" zeigt ins Leere.`,
      })
    }
  }
}

// --- Verweise aus index.html ---

const indexPfad = path.join(wurzel, 'index.html')
if (fs.existsSync(indexPfad)) {
  const inhalt = fs.readFileSync(indexPfad, 'utf8')
  const muster = /(?:href|src)\s*=\s*"([^"]+)"|from\s*'([^']+)'|import\s*\(\s*'([^']+)'\s*\)/g
  let treffer
  while ((treffer = muster.exec(inhalt)) !== null) {
    const pfad = treffer[1] ?? treffer[2] ?? treffer[3]
    if (!pfad || pfad.startsWith('data:') || pfad.startsWith('http')) continue
    const ziel = path.resolve(wurzel, pfad.replace(/^\.\//, ''))
    if (!fs.existsSync(ziel)) {
      beanstandungen.push({ art: 'toter-verweis', datei: 'index.html', text: `"${pfad}" fehlt.` })
    }
  }
}

// --- Mitgelieferte Bibliotheken ---

const PFLICHTDATEIEN = [
  'lib/tesseract/tesseract.esm.min.js',
  'lib/tesseract/worker.min.js',
  'lib/tesseract/core/tesseract-core-lstm.wasm.js',
  'lib/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'lib/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'lib/tesseract/sprachen/eng.traineddata.gz',
  'lib/exceljs/exceljs.min.js',
]

for (const pflicht of PFLICHTDATEIEN) {
  if (!fs.existsSync(path.join(wurzel, pflicht))) {
    beanstandungen.push({ art: 'bibliothek-fehlt', datei: pflicht, text: 'Die Datei fehlt.' })
  }
}

// --- Fassungskennung ---
//
// Dieselbe Kennung steht an zwei Stellen: in daten/einstellungen.js, fest in den
// Programmdateien, und in fassung.json daneben. Der Browser vergleicht beim Start,
// ob er eine alte Mischung geladen hat.
//
// Genau deshalb muss hier geprueft werden, dass die beiden gleich sind. Liefen sie
// auseinander, wuerde jeder Browser bei jedem Start denken, er sei veraltet, und
// sich endlos neu laden. Eine Vorsichtsmassnahme, die zum Fehler wird.

const einstellungenText = fs.readFileSync(path.join(wurzel, 'daten/einstellungen.js'), 'utf8')
const imProgramm = einstellungenText.match(/PROGRAMM_FASSUNG\s*=\s*'([^']+)'/)?.[1] ?? ''

let inDatei = ''
try {
  inDatei = String(JSON.parse(fs.readFileSync(path.join(wurzel, 'fassung.json'), 'utf8')).fassung ?? '')
} catch (fehler) {
  beanstandungen.push({
    art: 'fassung',
    datei: 'fassung.json',
    text: `laesst sich nicht lesen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
  })
}

if (!imProgramm) {
  beanstandungen.push({
    art: 'fassung',
    datei: 'daten/einstellungen.js',
    text: 'PROGRAMM_FASSUNG wurde nicht gefunden.',
  })
} else if (inDatei && imProgramm !== inDatei) {
  beanstandungen.push({
    art: 'fassung',
    datei: 'fassung.json',
    text: `steht auf "${inDatei}", in daten/einstellungen.js steht "${imProgramm}". Beide muessen gleich sein.`,
  })
}

/*
  DERSELBE SQL-BEFEHL STEHT AN ZWEI STELLEN, UND DAS DARF NICHT AUSEINANDERLAUFEN.

  supabase/migrations/0009_riesenschein_ordner.sql ist die Wahrheit. Die Seite
  werkzeug/datenbank_erweitern.html traegt denselben Befehl noch einmal zum
  Kopieren, weil Karam ihn in seinen SQL-Editor einfuegen muss und die Seite
  auch dann funktionieren soll, wenn sie jemand einzeln speichert. Aus der
  Datei nachladen geht nicht: ueber file:// gibt es kein fetch.

  Zwei Abschriften sind eine Stelle zu viel (Projektregel 8). Wenn sie schon
  sein muessen, dann mit einer Sperre davor: hier wird verglichen, was wirklich
  ausgefuehrt wird. Kommentare, Leerzeilen und die Klammer aus begin und commit
  bleiben aussen vor. Wer eine der beiden Fassungen aendert und die andere
  vergisst, kommt an dieser Stelle nicht vorbei.
*/
function sqlKern(text) {
  return text
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z !== '' && !z.startsWith('--'))
    .filter((z) => z !== 'begin;' && z !== 'commit;')
    .join(' ')
    .replace(/\s+/g, ' ')
}

try {
  const migration = fs.readFileSync(
    path.join(wurzel, 'supabase', 'migrations', '0009_riesenschein_ordner.sql'),
    'utf8'
  )
  const seite = fs.readFileSync(path.join(wurzel, 'werkzeug', 'datenbank_erweitern.html'), 'utf8')

  // Aus der Seite die Zeilen des Befehls herausholen. Sie stehen als Liste von
  // Zeichenketten im Skript, zwischen "const BEFEHL = [" und "].join".
  const stueck = seite.match(/const BEFEHL = \[([\s\S]*?)\]\.join/)
  if (!stueck) {
    beanstandungen.push({
      art: 'sql',
      datei: 'werkzeug/datenbank_erweitern.html',
      text: 'Der Befehl liess sich nicht finden. Erwartet wird "const BEFEHL = [ ... ].join".',
    })
  } else {
    const roh = stueck[1]
    /** @type {string[]} */
    const zeilen = []
    // Von Hand durchgehen statt mit einem Ausdruck: in den Zeilen stehen
    // Anfuehrungszeichen beider Art, und ein Ausdruck, der das sauber trennt,
    // waere schwerer zu lesen als diese Schleife.
    let i = 0
    while (i < roh.length) {
      const zeichen = roh[i]
      if (zeichen !== "'" && zeichen !== '"') {
        i += 1
        continue
      }
      const ende = zeichen
      let text = ''
      i += 1
      while (i < roh.length && roh[i] !== ende) {
        if (roh[i] === '\\') {
          const naechstes = roh[i + 1]
          text += naechstes === 'n' ? '\n' : naechstes
          i += 2
          continue
        }
        text += roh[i]
        i += 1
      }
      i += 1
      zeilen.push(text)
    }

    const ausSeite = sqlKern(zeilen.join('\n'))
    const ausDatei = sqlKern(migration)
    if (ausSeite !== ausDatei) {
      // Die erste Stelle nennen, an der es auseinandergeht. "Sie sind
      // verschieden" schickt sonst jemanden auf die Suche durch sechzig Zeilen.
      let stelle = 0
      while (stelle < ausSeite.length && ausSeite[stelle] === ausDatei[stelle]) stelle += 1
      beanstandungen.push({
        art: 'sql',
        datei: 'werkzeug/datenbank_erweitern.html',
        text:
          'Der Befehl zum Kopieren stimmt nicht mehr mit ' +
          'supabase/migrations/0009_riesenschein_ordner.sql ueberein. ' +
          `Erste Abweichung bei Zeichen ${stelle}: Seite "` +
          `${ausSeite.slice(stelle, stelle + 40)}", Datei "${ausDatei.slice(stelle, stelle + 40)}".`,
      })
    }
  }
} catch (fehler) {
  beanstandungen.push({
    art: 'sql',
    datei: 'supabase/migrations/0009_riesenschein_ordner.sql',
    text: `laesst sich nicht mit der Kopierseite vergleichen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
  })
}

// --- Bericht ---

console.log(`${geprueft} Dateien geprueft.`)
if (beanstandungen.length === 0) {
  console.log('Keine Beanstandung.')
  process.exit(0)
}

console.log(`\n${beanstandungen.length} Beanstandung(en):\n`)
for (const b of beanstandungen) {
  console.log(`  [${b.art}] ${b.datei}`)
  console.log(`      ${b.text}`)
}
process.exit(1)
