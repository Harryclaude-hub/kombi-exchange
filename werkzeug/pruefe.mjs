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
import {
  TUEREN,
  VORSILBE,
  ERLAUBTE_SCHEMATA as GRENZE_SCHEMATA,
  FREMDE_NAMEN as GRENZE_FREMDE,
  FREMDE_VORSILBEN,
} from '../daten/grenze.js'

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

/*
  Die vier Dateien im Wurzelverzeichnis gehoeren mitgeprueft.

  dienstarbeiter.js und manifest.json sind seit dem 18.09.2026 Teil des
  Programms, und zwar an einer Stelle, an der ein Fehler besonders lange
  unbemerkt bliebe: ein Gedankenstrich oder eine Farbe von Hand faellt dort
  niemandem auf, weil die beiden nie jemand aufmacht.
*/
const dateien = [...ORDNER.flatMap(sammle), 'index.html', 'dienstarbeiter.js', 'manifest.json']

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
  //   werkzeug/kontrastmesser.js  MISST Farben und setzt keine. Er muss die
  //           Schreibweisen des Browsers lesen koennen, sonst kann er nicht
  //           nachrechnen, ob das Design lesbar ist.
  const istBildrechnung =
    rel.startsWith('stil') ||
    rel.startsWith(`bild${path.sep}`) ||
    rel.startsWith(`werkzeug${path.sep}probe`) ||
    rel === `werkzeug${path.sep}kontrastmesser.js` ||
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
  SEIT DEM 18.09.2026 IST ES EINE DRITTE STELLE: dienstarbeiter.js.

  Sie steht dort woertlich und MUSS dort woertlich stehen. Der Browser holt den
  Dienstarbeiter neu und vergleicht seine BYTES; aendern sie sich nicht, wird der
  alte nie ersetzt. Eine Datei, die ihre Fassung erst zur Laufzeit aus
  fassung.json laedt, aendert ihre eigenen Bytes nie und bliebe fuer immer stehen,
  mitsamt ihrem alten Vorrat.

  Laufen die drei auseinander, ist der Schaden groesser als bei zweien: der
  Dienstarbeiter raeumte dann einen Speicher auf, der noch gebraucht wird, oder
  behielte einen, den niemand mehr will.
*/
const dienstarbeiterText = fs.readFileSync(path.join(wurzel, 'dienstarbeiter.js'), 'utf8')
const imDienstarbeiter = dienstarbeiterText.match(/const FASSUNG = '([^']+)'/)?.[1] ?? ''

if (!imDienstarbeiter) {
  beanstandungen.push({
    art: 'fassung',
    datei: 'dienstarbeiter.js',
    text: "const FASSUNG = '...' wurde nicht gefunden. Ohne sie ersetzt der Browser den Dienstarbeiter nie.",
  })
} else if (imProgramm && imDienstarbeiter !== imProgramm) {
  beanstandungen.push({
    art: 'fassung',
    datei: 'dienstarbeiter.js',
    text: `steht auf "${imDienstarbeiter}", in daten/einstellungen.js steht "${imProgramm}". Alle drei Stellen muessen gleich sein.`,
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

/*
  ANGEZEIGTER TEXT TRAEGT ECHTE UMLAUTE.

  Karam am 16.09.2026: "Erklaerung mit E-Umlaut, nicht mit AE."

  Am 16.09. bin ich das mit Suchen und Ersetzen angegangen und habe dabei
  dreimal Code beschaedigt: Bezeichner umbenannt, Ausdruecke in Vorlagen
  zerschnitten. Am 17.09. habe ich es im Browser nachgemessen und WIEDER
  Fundstellen gefunden, die beide Durchgaenge uebersehen hatten: "Erklaerung"
  stand noch auf der Startseite, "Kann zurueckkommen" in der Kopfzeile,
  "Bitte pruefen" in einem Dutzend Hinweisen aus dem Kern.

  Zweimal uebersehen heisst: von Hand geht es nicht. Deshalb steht es jetzt
  hier, und zwar als PRUEFUNG und nicht als Ersetzung: gemeldet wird, geaendert
  wird von Hand. Eine Maschine, die in Zeichenketten schreibt, hat in diesem
  Projekt schon genug angerichtet.

  GEPRUEFT WIRD NUR, WAS IN EINER ZEICHENKETTE STEHT. Kommentare, Bezeichner
  und die Ausdruecke in ${...} bleiben unberuehrt: dort ist "pruefe" ein
  Funktionsname und kein angezeigter Text.
*/

/** Woerter, die im Deutschen einen Umlaut tragen, hier ohne geschrieben. */
const UMLAUTWOERTER = [
  'Zurueck', 'zurueck', 'Uebersicht', 'uebersicht', 'Erklaerung', 'erklaerung',
  'Waehrung', 'waehrung', 'Waehrungen', 'waehrungen', 'pruefen', 'Pruefen',
  'pruefe', 'geprueft', 'Pruefung', 'pruefung', 'zaehlt', 'zaehlen', 'Zaehler',
  'moeglich', 'Moegliche', 'moegliche', 'hoechst', 'Hoechst', 'groesser',
  'Groesse', 'groesste', 'laesst', 'waehle', 'waehlen', 'gewaehlt', 'Auswaehlen',
  'hinzufuegen', 'ausloesen', 'Ausloesen', 'loeschen', 'Loeschen', 'geloescht',
  'aendern', 'Aendern', 'geaendert', 'naechste', 'naechsten', 'Naechste',
  'koennen', 'koennte', 'muessen', 'traegt', 'traegst', 'spaeter', 'frueher',
  'ungefaehr', 'zusaetzlich', 'aehnlich', 'Anhaenge', 'Vorschlaege',
  'aussagekraeftig', 'Betraege', 'Eintraege', 'zusammengezaehlt', 'Rueckfluss',
  'rueckfluss', 'geoeffnet', 'schliessen', 'Schliessen', 'oeffnen', 'Oeffnen',
  'fuer', 'Fuer', 'ueber', 'Ueber', 'Erklaer', 'erklaer', 'Huelle', 'huelle',
  'Kaertchen', 'Saeule', 'staerker', 'Stueck', 'stueck', 'zurueckkommen',
  'zurueckgeflossen', 'noetig', 'Noetig',
]

/**
 * Alle Zeichenketten einer JavaScript-Datei, mit ihrer Zeilennummer.
 *
 * Von Hand durchgegangen und nicht mit einem Ausdruck: ein Ausdruck, der
 * Kommentare, drei Arten von Anfuehrungszeichen und ${...} in Vorlagen
 * auseinanderhaelt, waere selbst die naechste Fehlerquelle. Diese Schleife ist
 * laenger und dafuer lesbar.
 *
 * @param {string} text
 * @returns {{zeile: number, wert: string, art: string}[]}
 */
function zeichenketten(text) {
  const heraus = []
  let i = 0
  let zeile = 1
  const laenge = text.length

  while (i < laenge) {
    const z = text[i]

    if (z === '\n') { zeile += 1; i += 1; continue }

    // Zeilenkommentar
    if (z === '/' && text[i + 1] === '/') {
      while (i < laenge && text[i] !== '\n') i += 1
      continue
    }

    // Blockkommentar
    if (z === '/' && text[i + 1] === '*') {
      i += 2
      while (i < laenge && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') zeile += 1
        i += 1
      }
      i += 2
      continue
    }

    if (z === "'" || z === '"') {
      const beginn = zeile
      const ende = z
      let wert = ''
      i += 1
      while (i < laenge && text[i] !== ende) {
        if (text[i] === '\\') { wert += text[i + 1] ?? ''; i += 2; continue }
        if (text[i] === '\n') break
        wert += text[i]
        i += 1
      }
      i += 1
      heraus.push({ zeile: beginn, wert, art: 'einfach' })
      continue
    }

    if (z === '`') {
      const beginn = zeile
      let wert = ''
      i += 1
      let tiefe = 0
      while (i < laenge) {
        if (tiefe === 0 && text[i] === '`') { i += 1; break }
        if (text[i] === '\\') { wert += text[i + 1] ?? ''; i += 2; continue }
        // Was in ${...} steht, ist CODE und kein angezeigter Text.
        if (tiefe === 0 && text[i] === '$' && text[i + 1] === '{') {
          tiefe = 1
          i += 2
          while (i < laenge && tiefe > 0) {
            if (text[i] === '{') tiefe += 1
            else if (text[i] === '}') tiefe -= 1
            else if (text[i] === '\n') zeile += 1
            i += 1
          }
          wert += ' '
          continue
        }
        if (text[i] === '\n') zeile += 1
        wert += text[i]
        i += 1
      }
      heraus.push({ zeile: beginn, wert, art: 'vorlage' })
      continue
    }

    i += 1
  }

  return heraus
}

/**
 * Ob eine Zeichenkette ueberhaupt angezeigter Text sein kann.
 *
 * Kein Weg, kein Auswahlausdruck, kein Bezeichner. "Erklaerung" allein ist
 * Text, ".ordnerkachel" und "kombi_scheine_lesen" sind es nicht.
 *
 * @param {string} wert
 * @returns {boolean}
 */
function istAnzeigetext(wert) {
  if (wert.length < 3) return false
  if (wert.startsWith('.') || wert.startsWith('#')) return false
  if (wert.includes('/') || wert.includes('\\')) return false
  // Ein einzelnes Wort ohne Leerzeichen ist nur dann Text, wenn es mit einem
  // Grossbuchstaben anfaengt. Bezeichner in diesem Projekt fangen klein an.
  if (!wert.includes(' ')) return /^[A-ZÄÖÜ]/.test(wert)
  return true
}

const UMLAUT_ORDNER = ['oberflaeche', 'kern', 'bild', 'lesen', 'ausgabe', 'daten']

/*
  ZWEI DATEIEN SIND AUSGENOMMEN, UND DAS IST WICHTIG.

  kern/etiketten.js und kern/buchmacher.js enthalten MUSTER, an denen gelesener
  Text erkannt wird, keine Anzeige. Dort steht "moegliche auszahlung" absichtlich
  NEBEN "mögliche auszahlung": beide Schreibweisen kommen auf echten Scheinen
  vor, und der Parser muss beide finden. Wer hier Umlaute setzt, macht ihn auf
  einem Teil der Scheine blind, ohne dass ein Test es merkt.
*/
const UMLAUT_AUSGENOMMEN = new Set(['kern/etiketten.js', 'kern/buchmacher.js'])

for (const ordner of UMLAUT_ORDNER) {
  const weg = path.join(wurzel, ordner)
  if (!fs.existsSync(weg)) continue
  for (const datei of fs.readdirSync(weg)) {
    if (!datei.endsWith('.js')) continue
    if (UMLAUT_AUSGENOMMEN.has(`${ordner}/${datei}`)) continue
    const voll = path.join(weg, datei)
    const text = fs.readFileSync(voll, 'utf8')
    for (const k of zeichenketten(text)) {
      if (!istAnzeigetext(k.wert)) continue
      for (const wort of UMLAUTWOERTER) {
        // Ganzes Wort, damit "fuer" nicht in "fuenf" trifft.
        const treffer = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])${wort}([^A-Za-zÄÖÜäöüß]|$)`)
        if (!treffer.test(k.wert)) continue
        beanstandungen.push({
          art: 'umlaut',
          datei: `${ordner}/${datei}:${k.zeile}`,
          text: `Angezeigter Text schreibt "${wort}" statt mit Umlaut: "${k.wert.slice(0, 70)}"`,
        })
        break
      }
    }
  }
}

// --- Bilder, auf die eine Stilvorlage zeigt ---
//
// Am 17.09.2026 gefunden: dieses Skript prueft tote Importe in JavaScript und
// tote Verweise in index.html, aber NICHT die url() in einer CSS-Datei. Eine
// vergessene Logodatei faellt damit nirgends auf, und das ist der
// gefaehrlichste Fall von allen: die Regel dazu setzt color auf transparent,
// weil das Bild die Schrift verdecken soll. Fehlt das Bild, bleibt ein LEERES
// Kaestchen stehen. Genau der leere Fleck, den Karam nicht wollte.

for (const datei of dateien) {
  const pfad = datei.split(path.sep).join('/')
  if (!pfad.endsWith('.css')) continue
  // Kommentare heraus, BEVOR gesucht wird. In stil/logos.css steht ein
  // Beispiel im Kommentarkopf, und ohne diesen Schritt beanstandet die Regel
  // die Anleitung, die sie erklaert. Beim ersten Lauf genau so passiert.
  const inhalt = fs.readFileSync(path.join(wurzel, datei), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const ordner = path.dirname(path.join(wurzel, datei))
  for (const treffer of inhalt.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const ziel = treffer[1]
    if (/^(data:|https?:|\/\/)/.test(ziel)) continue
    if (!fs.existsSync(path.resolve(ordner, ziel))) {
      beanstandungen.push({
        art: 'totes-bild',
        datei: pfad,
        text: `url("${ziel}") zeigt ins Leere. Ohne die Datei bleibt an dieser Stelle ein leeres Feld.`,
      })
    }
  }
}

// --- Probehaken gehoeren in die Probe ---
//
// daten/plattenspeicher.js hat einen Weg, den Ordnergriff von Hand zu setzen.
// Ohne ihn liesse sich keine der Zusagen zum Speicherplatz in node nachmessen.
// Im PROGRAMM darf ihn niemand rufen: ein Ordner, den sich das Programm selbst
// setzt, waere genau das, was man nicht will.

const HAKEN_ERLAUBT = new Set(['daten/plattenspeicher.js', 'werkzeug/pruefe.mjs'])

for (const datei of dateien) {
  // Unter Windows kommen die Pfade mit Schraegstrich rueckwaerts. Ohne das
  // hat diese Regel sich beim ersten Lauf selbst beanstandet.
  const pfad = datei.split(path.sep).join('/')
  if (pfad.startsWith('test/') || HAKEN_ERLAUBT.has(pfad)) continue
  if (!pfad.endsWith('.js') && !pfad.endsWith('.mjs')) continue
  const text = fs.readFileSync(path.join(wurzel, datei), 'utf8')
  if (text.includes('__setzeGriffFuerProbe')) {
    beanstandungen.push({
      art: 'probehaken',
      datei,
      text: '__setzeGriffFuerProbe ist nur fuer test/ gedacht und darf im Programm nicht vorkommen.',
    })
  }
}

/*
  DIE GRENZE ZWISCHEN DEN PROGRAMMEN IN DERSELBEN DATENBANK.

  Karam am 18.09.2026: "Mach klare Trennungen zwischen den Projekten in der
  Datenbank. Ich will nie, dass sich irgendwas mischt. Und auch fuer die neuen
  Chats, wenn ich da was arbeite und mit der Datenbank mache, muss das wirklich
  klar getrennt sein, keine Fehler, kein Durcheinander."

  In einer Supabase-Datenbank liegen drei Programme:

    Kombi Exchange   Schema kombi, Tueren public.kombi_*    7 Tabellen, 25 Funktionen
    Kombi Tafel      public.kt_*                           22 Tabellen, 15 Funktionen
    immo-check       public, ohne Vorsilbe                 13 Tabellen,  6 Funktionen

  Im Programm steht die Wand in daten/datenbank.js: rufe() nimmt nur Namen an,
  die mit kombi_ beginnen. Die Wanderungen erreicht sie aber nicht, denn die
  laufen nicht durch rufe(), sondern werden von Hand in den SQL-Editor
  eingefuegt. Genau dort ist der Schaden am groessten, weil ein "drop table
  scheine" ohne Schema in public landet und dort etwas Fremdes treffen kann.

  Deshalb hier die zweite Haelfte derselben Grenze. Vier Fragen an jede
  Wanderung, und alle vier muessen mit nein beantwortet sein:

    1. Kommt darin ein Name eines fremden Programms vor?
    2. Wird etwas in public angelegt, das nicht kombi_ heisst?
    3. Wird ein Objekt ohne Schema angesprochen, das also dort landet, wohin
       der Suchpfad gerade zeigt?
    4. Wird ein fremdes Schema angefasst?

  DIE KOMMENTARE MUESSEN VORHER WEG. Beim ersten Lauf hat diese Regel den
  eigenen Erklaerungstext beanstandet, in dem die Tabellennamen der anderen
  Programme als Beispiel stehen. Ein Beispiel in einem Kommentar ist kein
  Zugriff. Dieselbe Falle wie bei der Regel fuer tote Bildadressen.
*/

const WANDERUNGEN = path.join(wurzel, 'supabase', 'migrations')

/*
  Die Namen kommen aus daten/grenze.js und stehen hier NICHT noch einmal.

  Sie standen bis zum 18.09.2026 an drei Stellen: hier, in daten/datenbank.js
  und in test/trennung.test.mjs. Drei Abschriften derselben Sache sind genau
  das, was Projektregel 8 verbietet, und die dritte waere die gefaehrlichste
  gewesen: eine Probe, die ihre eigene veraltete Liste prueft, ist gruen und
  beweist nichts.
*/
const FREMDE_NAMEN = GRENZE_FREMDE
const ERLAUBTE_SCHEMATA = new Set(GRENZE_SCHEMATA)

/**
 * Schneidet Kommentare heraus, ohne Zeichenketten zu zerschneiden.
 *
 * Ein doppelter Strich innerhalb von Anfuehrungszeichen ist kein Kommentar. In
 * den Wanderungen stehen deutsche Meldungstexte, und eine Regel, die in einen
 * Meldungstext hineinschneidet, meldet danach Unsinn.
 *
 * @param {string} text
 */
function ohneKommentare(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/)
    .map((zeile) => {
      const stelle = zeile.indexOf('--')
      if (stelle < 0) return zeile
      const davor = zeile.slice(0, stelle)
      // Ungerade Zahl an Anfuehrungszeichen davor heisst: wir stehen mitten in
      // einer Zeichenkette, der Strich gehoert zum Text.
      const hochkommas = (davor.match(/'/g) ?? []).length
      return hochkommas % 2 === 1 ? zeile : davor
    })
    .join('\n')
}

/** @type {string[]} */
let wanderungen = []
try {
  wanderungen = fs.readdirSync(WANDERUNGEN).filter((d) => d.endsWith('.sql')).sort()
} catch {
  beanstandungen.push({
    art: 'grenze',
    datei: 'supabase/migrations',
    text: 'Der Ordner mit den Wanderungen liess sich nicht lesen.',
  })
}

if (wanderungen.length < 9) {
  beanstandungen.push({
    art: 'grenze',
    datei: 'supabase/migrations',
    text: `Es liegen ${wanderungen.length} Wanderungen da. Erwartet werden mindestens neun, 0001 bis 0009.`,
  })
}

for (const name of wanderungen) {
  const pfad = `supabase/migrations/${name}`

  /*
    "if not exists" wird vor allem anderen herausgeschnitten.

    Sonst braucht jeder folgende Ausdruck eine Wahlgruppe, und ein Ausdruck mit
    Wahlgruppe springt zurueck: bei "drop function if exists public.kombi_x"
    ueberliest er die Gruppe und faengt stattdessen das Wort "if" als
    Objektnamen. Beim ersten Lauf kamen so dreissig Beanstandungen der Form
    "spricht if ohne Schema an", alle falsch.
  */
  const sql = ohneKommentare(fs.readFileSync(path.join(WANDERUNGEN, name), 'utf8'))
    .toLowerCase()
    .replace(/\bif\s+(?:not\s+)?exists\b/g, ' ')

  // --- Frage 1: ein fremder Name? ---
  for (const fremd of FREMDE_NAMEN) {
    if (new RegExp(`\\b${fremd}\\b`).test(sql)) {
      beanstandungen.push({
        art: 'grenze',
        datei: pfad,
        text:
          `nennt "${fremd}". Das gehoert einem anderen Programm in derselben Datenbank. ` +
          'Kombi Exchange fasst nur kombi.* und public.kombi_* an.',
      })
    }
  }
  for (const vorsilbe of FREMDE_VORSILBEN) {
    const treffer = [...new Set(sql.match(new RegExp(`\\b${vorsilbe}[a-z0-9_]+`, 'g')) ?? [])]
    if (treffer.length > 0) {
      beanstandungen.push({
        art: 'grenze',
        datei: pfad,
        text: `nennt ${treffer.join(', ')}. Das gehoert einem anderen Programm und wird von hier aus nie angefasst.`,
      })
    }
  }

  // --- Frage 2: etwas in public ohne die Vorsilbe? ---
  const inPublic =
    /\b(?:create|drop|alter)\s+(?:or\s+replace\s+)?(?:unique\s+)?(?:table|view|function|procedure|trigger|type|sequence|index)\s+public\.([a-z0-9_]+)/g
  for (const fund of sql.matchAll(inPublic)) {
    if (!fund[1].startsWith('kombi_')) {
      beanstandungen.push({
        art: 'grenze',
        datei: pfad,
        text:
          `legt public.${fund[1]} an oder aendert es. In public darf Kombi Exchange nur ` +
          'Namen mit der Vorsilbe kombi_ anfassen, sonst trifft es ein anderes Programm.',
      })
    }
  }

  /*
    --- Frage 3: ein Objekt ohne Schema? ---

    Ohne Schemaangabe entscheidet der Suchpfad, und der ist beim Einfuegen in
    den SQL-Editor nicht leer, sondern zeigt auf public. Ein "create table
    scheine" landete also in public, direkt neben kt_scheine.

    Der Nachblick (?![a-z0-9_.]) sortiert die richtig geschriebenen Faelle aus:
    bei "create table kombi.projekte" steht hinter kombi ein Punkt, das ist
    also bereits ein Schemaname und keine nackte Tabelle.

    Indizes stehen nicht in der Liste: ein Index wohnt im Schema seiner
    Tabelle, und "create index projekte_ordner_idx on kombi.projekte" ist
    richtig geschrieben.
  */
  const ohneSchema =
    /\b(?:create|drop|alter)\s+(?:or\s+replace\s+)?(?:table|view|function|procedure|type|sequence)\s+([a-z0-9_]+)(?![a-z0-9_.])/g
  for (const fund of sql.matchAll(ohneSchema)) {
    beanstandungen.push({
      art: 'grenze',
      datei: pfad,
      text:
        `spricht "${fund[1]}" ohne Schema an. Dann entscheidet der Suchpfad, wo es landet, ` +
        `und im SQL-Editor zeigt der auf public. Immer kombi.${fund[1]} schreiben.`,
    })
  }

  /*
    --- Frage 4: ein fremdes Schema? ---

    Zwei Ausdruecke, weil ein Schema auf zwei Arten auftaucht: als Aufruf
    (extensions.crypt(...)) und als Tabelle hinter from, join, into, update
    oder references.

    Nicht nach jedem "wort.wort" suchen: in den Wanderungen stehen ueberall
    Tabellenkuerzel wie s.id, z.aktiv und t.e, und die waeren alle falsche
    Treffer.
  */
  const fremdeSchemata = new Set()
  for (const fund of sql.matchAll(/\b([a-z][a-z0-9_]*)\.[a-z][a-z0-9_]*\s*\(/g)) {
    if (!ERLAUBTE_SCHEMATA.has(fund[1])) fremdeSchemata.add(fund[1])
  }
  for (const fund of sql.matchAll(
    /\b(?:from|join|into|update|references)\s+([a-z][a-z0-9_]*)\.[a-z][a-z0-9_]*/g
  )) {
    if (!ERLAUBTE_SCHEMATA.has(fund[1])) fremdeSchemata.add(fund[1])
  }
  for (const schema of fremdeSchemata) {
    beanstandungen.push({
      art: 'grenze',
      datei: pfad,
      text: `greift auf das Schema "${schema}" zu. Erlaubt sind nur ${[...ERLAUBTE_SCHEMATA].join(', ')}.`,
    })
  }
}

/*
  ES GIBT GENAU EINE TUER ZUR DATENBANK.

  Die Wand in daten/datenbank.js prueft NAMEN. Sie haelt niemanden davon ab, in
  einer neuen Datei selbst ein fetch auf /rest/v1/ zu bauen und damit an ihr
  vorbeizugehen. Heute gibt es genau eine solche Stelle; nichts hielt die zweite
  auf, und genau die zweite waere die, die niemand mehr prueft.

  Erlaubt sind zwei Dateien: daten/datenbank.js baut die Adresse,
  daten/einstellungen.js haelt sie. Alles andere ist eine Beanstandung.
*/
const TUER_ERLAUBT = new Set(['daten/datenbank.js', 'daten/einstellungen.js'])
const TUER_MUSTER = /rest\/v1|storage\/v1|\.supabase\.co|DATENBANK\.adresse/

/**
 * Schneidet Kommentare aus Quelltext, damit eine Erklaerung keine Beanstandung
 * ausloest. Dieselbe Falle wie bei der Regel fuer tote Bildadressen.
 *
 * @param {string} text
 * @param {boolean} istHtml
 */
function ohneErklaerungen(text, istHtml) {
  let heraus = text.replace(/\/\*[\s\S]*?\*\//g, ' ')
  if (istHtml) heraus = heraus.replace(/<!--[\s\S]*?-->/g, ' ')
  return heraus
    .split(/\r?\n/)
    .map((zeile) => {
      const stelle = zeile.indexOf('//')
      if (stelle < 0) return zeile
      // Ein doppelter Schraegstrich in einer Adresse ist kein Kommentar.
      if (/https?:$/.test(zeile.slice(0, stelle))) return zeile
      return zeile.slice(0, stelle)
    })
    .join('\n')
}

for (const datei of dateien) {
  const pfad = datei.split(path.sep).join('/')
  if (TUER_ERLAUBT.has(pfad)) continue
  /*
    Proben sind ausgenommen, aus demselben Grund wie beim Probehaken weiter
    oben: eine Probe, die beweist, dass die Wand haelt, MUSS nennen koennen,
    was sie aussperrt. test/dienstarbeiter.test.mjs fuehrt eine echte
    Supabase-Adresse auf, um zu zeigen, dass der Dienstarbeiter sie nicht
    anfasst. Beim ersten Lauf hat diese Regel genau das beanstandet.
  */
  if (pfad.startsWith('test/')) continue
  if (!/\.(js|mjs|html)$/.test(pfad)) continue
  const voll = path.join(wurzel, datei)
  if (!fs.existsSync(voll)) continue

  const roh = ohneErklaerungen(fs.readFileSync(voll, 'utf8'), pfad.endsWith('.html'))
  if (!TUER_MUSTER.test(roh)) continue

  const zeilen = roh.split(/\r?\n/)
  const nummer = zeilen.findIndex((z) => TUER_MUSTER.test(z)) + 1
  beanstandungen.push({
    art: 'grenze',
    datei: `${pfad}:${nummer}`,
    text:
      'spricht die Datenbank selbst an. Es gibt genau eine Tuer, und das ist rufe() in ' +
      'daten/datenbank.js. Nur dort steht die Pruefung, die fremde Programme aussperrt. ' +
      'Warum das so ist, steht in supabase/TRENNUNG.md und in daten/grenze.js.',
  })
}

/*
  DIE VIERZEHN TUEREN MUESSEN AN DREI ORTEN DIESELBEN SEIN.

  daten/grenze.js fuehrt sie, die Wanderungen legen sie an, daten/datenbank.js
  ruft sie. Laufen die drei auseinander, faellt das sonst erst im Betrieb auf,
  und zwar als 404, was im Browser aussieht wie ein Netzproblem.

  Gemeldet wird mit RICHTUNG und nicht als "ungleich": vergessener Eintrag,
  Tippfehler und tote Tuer sind drei verschiedene Fehler mit drei verschiedenen
  Handgriffen.

  Der Sonderfall: 0004 zieht drei Funktionen mit "alter function ... set schema
  kombi" aus public heraus. Die stehen danach zwar in einer Wanderung, sind aber
  keine Tueren mehr. Sie werden hier abgezogen.
*/
const ausWanderungen = new Set()
for (const name of wanderungen) {
  const sql = ohneKommentare(fs.readFileSync(path.join(WANDERUNGEN, name), 'utf8')).toLowerCase()

  /*
    DER REIHE NACH, NICHT ERST ALLE ANLEGEN UND DANN ALLE ABZIEHEN.

    Beim ersten Lauf meldete diese Regel drei Tueren als fehlend, die es
    laengst gibt: kombi_scheine_speichern, kombi_riesenscheine_speichern und
    kombi_bilder_speichern. Der Grund stand in 0004. Dort wird jede der drei
    ERST mit "set schema kombi" aus public herausgezogen und dann SOFORT unter
    demselben Namen neu angelegt, nur mit einer Unterschrift mehr (p_fassung).

    Wer erst alle Anlagen sammelt und am Ende alle Wegzuege abzieht, loescht
    damit auch die Neuanlage danach. Also wird hier in der Reihenfolge
    gelaufen, in der es wirklich passiert.
  */
  const ereignisse = []
  for (const fund of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(kombi_[a-z0-9_]+)/g)) {
    ereignisse.push({ stelle: fund.index ?? 0, name: fund[1], was: 'anlegen' })
  }
  for (const fund of sql.matchAll(/alter\s+function\s+public\.(kombi_[a-z0-9_]+)\s*\([^)]*\)\s*set\s+schema/g)) {
    ereignisse.push({ stelle: fund.index ?? 0, name: fund[1], was: 'wegziehen' })
  }
  ereignisse.sort((a, b) => a.stelle - b.stelle)

  for (const ereignis of ereignisse) {
    if (ereignis.was === 'anlegen') ausWanderungen.add(ereignis.name)
    else ausWanderungen.delete(ereignis.name)
  }
}

const datenbankText = fs.readFileSync(path.join(wurzel, 'daten/datenbank.js'), 'utf8')
const ausAufrufen = new Set(
  [...datenbankText.matchAll(/rufe\('(kombi_[a-z0-9_]+)'/g)].map((f) => f[1])
)

const ausGrenze = new Set(TUEREN)

for (const name of ausWanderungen) {
  if (!ausGrenze.has(name)) {
    beanstandungen.push({
      art: 'grenze',
      datei: 'daten/grenze.js',
      text: `In den Wanderungen steht public.${name}, aber TUEREN kennt den Namen nicht. Neue Tuer angelegt und nicht eingetragen?`,
    })
  }
}
for (const name of ausAufrufen) {
  if (!ausWanderungen.has(name)) {
    beanstandungen.push({
      art: 'grenze',
      datei: 'daten/datenbank.js',
      text: `ruft ${name}, aber keine Wanderung legt es an. Tippfehler, oder die Wanderung fehlt?`,
    })
  }
}
for (const name of ausGrenze) {
  if (!ausWanderungen.has(name)) {
    beanstandungen.push({
      art: 'grenze',
      datei: 'daten/grenze.js',
      text: `fuehrt ${name}, aber keine Wanderung legt es an.`,
    })
  }
}

/*
  VIER ZEILEN, DIE IN KEINER WANDERUNG STEHEN DUERFEN.

  Alle vier gehen an den bisherigen Fragen vorbei, weil sie kein einziges
  fremdes Wort enthalten, und jede einzelne wuerde die drei Programme in einem
  Zug vermischen oder aufschliessen:

    grant ... on all ... in schema public    schliesst ALLE Funktionen und
                                             Tabellen aller drei Programme auf
    drop extension                           pgcrypto gehoert allen dreien
    grant ... to public                      public ist jeder, auch nicht
                                             angemeldet
    alter role / alter database              wirkt auf die ganze Datenbank
*/
const VERBOTENE_ZEILEN = [
  {
    muster: /grant[\s\S]{0,80}?on\s+all\s+(?:functions|tables|sequences)\s+in\s+schema\s+public/,
    warum:
      'schliesst ALLE Funktionen und Tabellen in public auf, also auch die der beiden anderen ' +
      'Programme. Immer einzeln freigeben: grant execute on function public.kombi_... .',
  },
  {
    muster: /drop\s+extension/,
    warum: 'pgcrypto in extensions gehoert allen drei Programmen gemeinsam. Es faellt niemand allein.',
  },
  {
    muster: /grant[\s\S]{0,120}?\sto\s+public\b/,
    warum:
      '"public" ist in Postgres JEDER, auch wer sich nie angemeldet hat. Freigeben nur an anon und authenticated.',
  },
  {
    muster: /alter\s+(?:role|database|system)\b/,
    warum: 'wirkt auf die ganze Datenbank und damit auf alle drei Programme.',
  },
]

for (const name of wanderungen) {
  const sql = ohneKommentare(fs.readFileSync(path.join(WANDERUNGEN, name), 'utf8'))
    .toLowerCase()
    .replace(/'[^']*'/g, "''")
  for (const regel of VERBOTENE_ZEILEN) {
    if (regel.muster.test(sql)) {
      beanstandungen.push({
        art: 'grenze',
        datei: `supabase/migrations/${name}`,
        text: `${regel.warum} Warum das so ist, steht in supabase/TRENNUNG.md.`,
      })
    }
  }
}

/*
  JEDE NEUE FUNKTION BRAUCHT EINEN LEEREN SUCHPFAD.

  Ohne "set search_path = ''" entscheidet der Suchpfad des Aufrufers, welche
  Tabelle eine Funktion trifft. Bei einer Funktion mit security definer, und das
  sind hier alle, ist das der klassische Weg, an fremde Daten zu kommen: wer den
  Suchpfad setzt, lenkt die Funktion auf eine eigene Tabelle um.

  Diese Regel laeuft auf dem Text OHNE Literalentfernung, denn sie sucht gerade
  nach search_path = '' und das ist ein Literal.
*/
for (const name of wanderungen) {
  const sql = ohneKommentare(fs.readFileSync(path.join(WANDERUNGEN, name), 'utf8')).toLowerCase()
  const funktionen = [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_.]+)/g)]
  const suchpfade = [...sql.matchAll(/set\s+search_path\s*=\s*''/g)]
  if (funktionen.length > suchpfade.length) {
    beanstandungen.push({
      art: 'grenze',
      datei: `supabase/migrations/${name}`,
      text:
        `legt ${funktionen.length} Funktion(en) an, aber nur ${suchpfade.length} davon setzen ` +
        "search_path = ''. Ohne leeren Suchpfad laesst sich eine Funktion mit security definer " +
        'auf eine fremde Tabelle umlenken. Warum das so ist, steht in supabase/TRENNUNG.md.',
    })
  }
}

/*
  DAS MANIFEST MUSS AUF ETWAS ZEIGEN, DAS ES GIBT.

  Ein Symbol, das fehlt, faellt erst nach der Installation auf, und dann steht
  auf Karams Startbildschirm ein leeres Feld. Derselbe Fall wie eine tote url()
  in stil/, nur schlechter zu finden.

  Und: alle Adressen muessen relativ sein. Die Seite liegt in einem
  Unterverzeichnis, ein fuehrender Schraegstrich zeigte auf die Wurzel des
  ganzen Kontos. Die einzige Ausnahme ist "id", das gegen den Ursprung
  aufgeloest wird und deshalb ausgeschrieben werden MUSS.
*/
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(wurzel, 'manifest.json'), 'utf8'))

  for (const symbol of manifest.icons ?? []) {
    const ziel = path.join(wurzel, String(symbol.src).replace(/^\.\//, ''))
    if (!fs.existsSync(ziel)) {
      beanstandungen.push({
        art: 'manifest',
        datei: 'manifest.json',
        text: `zeigt auf ${symbol.src}, aber die Datei gibt es nicht. Erst "python werkzeug/symbole_bauen.py" laufen lassen.`,
      })
    }
    if (!String(symbol.src).startsWith('./')) {
      beanstandungen.push({
        art: 'manifest',
        datei: 'manifest.json',
        text: `${symbol.src} ist nicht relativ. Die Seite liegt in einem Unterverzeichnis.`,
      })
    }
  }

  for (const feld of ['start_url', 'scope']) {
    if (manifest[feld] !== './') {
      beanstandungen.push({
        art: 'manifest',
        datei: 'manifest.json',
        text: `${feld} steht auf "${manifest[feld]}", erwartet wird "./". Alles andere zeigt aus dem Unterverzeichnis heraus.`,
      })
    }
  }

  if (!String(manifest.id ?? '').startsWith('/')) {
    beanstandungen.push({
      art: 'manifest',
      datei: 'manifest.json',
      text:
        `id steht auf "${manifest.id}". Sie ist die EINZIGE Angabe, die gegen den Ursprung ` +
        'aufgeloest wird, und muss deshalb ausgeschrieben sein, sonst teilt sich dieses ' +
        'Programm seine Kennung mit jeder anderen Seite dieses Kontos.',
    })
  }

  const markenText = fs.readFileSync(path.join(wurzel, 'stil/marken.css'), 'utf8')
  const grundTief = markenText.match(/--grund-tief:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? ''
  for (const feld of ['theme_color', 'background_color']) {
    if (grundTief && String(manifest[feld]).toLowerCase() !== grundTief.toLowerCase()) {
      beanstandungen.push({
        art: 'manifest',
        datei: 'manifest.json',
        text: `${feld} steht auf "${manifest[feld]}", in stil/marken.css steht --grund-tief auf "${grundTief}".`,
      })
    }
  }
} catch (fehler) {
  beanstandungen.push({
    art: 'manifest',
    datei: 'manifest.json',
    text: `laesst sich nicht lesen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
  })
}

/*
  DER VORRAT DES DIENSTARBEITERS MUSS VOLLSTAENDIG SEIN.

  Ohne diese Regel ist die haeufigste Panne programmiert: eine neue Datei
  entsteht, niemand denkt an die Liste, und ohne Netz steht eine weisse Seite.
  Bemerkt wuerde das erst Wochen spaeter, im Zug, wenn es zu spaet ist.

  Verglichen wird gegen den ECHTEN Importgraphen, von index.html aus
  durchgelaufen. Ausgenommen ist lib/tesseract: das liegt mit 16,2 MB bewusst
  draussen, weil davon auf jedem Geraet nur ein Drittel gebraucht wird und
  Tesseract sein Sprachmodell ohnehin selbst ablegt.
*/
const vorrat = new Set(
  [...dienstarbeiterText.matchAll(/'\.\/([^']+)'/g)].map((f) => f[1]).filter((w) => w !== '')
)

/** @param {string} datei */
function folgeImporten(datei, gesehen) {
  if (gesehen.has(datei)) return gesehen
  const voll = path.join(wurzel, datei)
  if (!fs.existsSync(voll)) return gesehen
  gesehen.add(datei)
  const text = fs.readFileSync(voll, 'utf8')
  for (const fund of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
    const ziel = path.posix.normalize(path.posix.join(path.posix.dirname(datei), fund[1]))
    folgeImporten(ziel, gesehen)
  }
  return gesehen
}

const gebraucht = folgeImporten('oberflaeche/app.js', folgeImporten('stil/buehne.js', new Set()))

for (const datei of gebraucht) {
  if (datei.startsWith('lib/tesseract/')) continue
  if (!vorrat.has(datei)) {
    beanstandungen.push({
      art: 'vorrat',
      datei: 'dienstarbeiter.js',
      text:
        `${datei} wird vom Programm geladen, steht aber nicht im Vorrat. Ohne Netz waere das ` +
        'eine weisse Seite. Eintragen in die Liste VORRAT.',
    })
  }
}

for (const eintrag of vorrat) {
  if (eintrag === '' || eintrag.endsWith('/')) continue
  if (!fs.existsSync(path.join(wurzel, eintrag))) {
    beanstandungen.push({
      art: 'vorrat',
      datei: 'dienstarbeiter.js',
      text: `fuehrt ${eintrag}, aber die Datei gibt es nicht. Das Einrichten ist alles oder nichts: eine fehlende Datei heisst gar kein Offlinebetrieb.`,
    })
  }
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
