import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

/**
 * Der Dienstarbeiter, also das Programm zum Ablegen.
 *
 * Karam am 18.09.2026: "Ich will, dass du jetzt in einem Zug das Programm als
 * eine Download-Website machst."
 *
 * WAS HIER GEPRUEFT WIRD
 *
 * Nicht der Browser. Geprueft wird die eine Entscheidung, an der alles haengt:
 * welche Anfrage wird wie behandelt. Alles andere in dieser Datei ist
 * Verwaltung.
 *
 * WARUM DAS SO WICHTIG IST
 *
 * Ein Zwischenspeicher kann mit dem Fassungsabgleich in daten/fassung.js in
 * Streit geraten, und der Streit endet in einer Endlosschleife: der Speicher
 * liefert alte Dateien, die Pruefung sieht eine Abweichung zu fassung.json,
 * laedt neu, bekommt wieder die alten Dateien, laedt wieder neu. Das Programm
 * waere dann unbenutzbar, und zwar ausgerechnet fuer den, der gerade
 * aktualisiert hat.
 *
 * Unmoeglich wird das durch genau zwei Regeln: fassung.json kommt NIE aus dem
 * Speicher, und alles andere fragt IMMER zuerst das Netz. Diese Probe haelt
 * beide fest.
 *
 * WARUM node:vm UND KEIN import
 *
 * Der Dienstarbeiter ist mit Absicht ein klassisches Skript ohne import und
 * export. Modul-Dienstarbeiter gibt es nicht in jedem Browser, und ein
 * Dienstarbeiter, der auf manchen Geraeten gar nicht erst anspringt, ist
 * schlechter als keiner.
 */

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const quelltext = fs.readFileSync(path.join(wurzel, 'dienstarbeiter.js'), 'utf8')

/** Ein self, das nur mitschreibt, was angemeldet wird. */
const horcher = new Map()
const self = {
  addEventListener: (art, was) => horcher.set(art, was),
  location: { origin: 'https://harryclaude-hub.github.io' },
}

/*
  URL MUSS MITGEGEBEN WERDEN.

  vm.createContext baut einen leeren Weltraum ohne die Globalen von node. Beim
  ersten Lauf war URL darin unbekannt, "new URL(...)" warf, und weil entscheide
  das abfaengt, kam fuer JEDE Adresse "nicht-anfassen" zurueck. Fuenf Proben
  waren rot, und keine davon zeigte auf den wahren Grund.

  Im Browser gibt es URL in jedem Dienstarbeiter. Das war also eine Falle
  dieser Probe, keine des Programms.
*/
const umgebung = vm.createContext({ self, URL, Response, caches: undefined, fetch: undefined, console })
vm.runInContext(quelltext, umgebung, { filename: 'dienstarbeiter.js' })

const entscheide = self.__entscheide
const EIGEN = 'https://harryclaude-hub.github.io'

test('die Entscheidung liegt ueberhaupt offen', () => {
  assert.equal(typeof entscheide, 'function', 'ohne sie liesse sich hier nichts pruefen')
})

test('DIE WICHTIGSTE: fassung.json kommt nie aus dem Speicher', () => {
  /*
    Das ist die halbe Unmoeglichkeit der Endlosschleife. Kaeme fassung.json aus
    dem Speicher, saehe die Pruefung eine alte Kennung neben alten Dateien und
    lueden beide sich gegenseitig endlos neu.
  */
  assert.equal(entscheide(`${EIGEN}/kombi-exchange/fassung.json`, 'GET', EIGEN), 'netz-nur')
  // Mit Zeitstempel dahinter, so wie daten/fassung.js sie wirklich holt.
  assert.equal(
    entscheide(`${EIGEN}/kombi-exchange/fassung.json?t=1758240000000`, 'GET', EIGEN),
    'netz-nur'
  )
})

test('der Dienstarbeiter speichert sich nicht selbst zwischen', () => {
  // Sonst bliebe eine alte Fassung fuer immer stehen, samt ihrem alten Vorrat.
  assert.equal(entscheide(`${EIGEN}/kombi-exchange/dienstarbeiter.js`, 'GET', EIGEN), 'netz-nur')
})

test('die Datenbank wird gar nicht erst angefasst', () => {
  /*
    Eine aus dem Speicher beantwortete Datenbankabfrage waere ein erfundener
    Wert, und das verbietet Projektregel 1. Sie darf nicht einmal
    durchgereicht, sie muss uebersprungen werden.
  */
  const fremd = [
    'https://mqmevpyatjsambervgtu.supabase.co/rest/v1/rpc/kombi_scheine_lesen',
    'https://api.anthropic.com/v1/messages',
    'https://example.com/irgendwas.js',
  ]
  for (const adresse of fremd) {
    assert.equal(entscheide(adresse, 'GET', EIGEN), 'nicht-anfassen', adresse)
  }
})

test('alles ausser GET wird durchgelassen', () => {
  // Ein POST zu speichern waere sinnlos und gefaehrlich zugleich.
  for (const art of ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
    assert.equal(entscheide(`${EIGEN}/kombi-exchange/index.html`, art, EIGEN), 'nicht-anfassen', art)
  }
})

test('die Programmdateien fragen zuerst das Netz', () => {
  const eigene = [
    `${EIGEN}/kombi-exchange/`,
    `${EIGEN}/kombi-exchange/index.html`,
    `${EIGEN}/kombi-exchange/oberflaeche/app.js`,
    `${EIGEN}/kombi-exchange/stil/marken.css`,
    `${EIGEN}/kombi-exchange/symbole/symbol-512.png`,
    `${EIGEN}/kombi-exchange/lib/exceljs/exceljs.min.js`,
  ]
  for (const adresse of eigene) {
    assert.equal(entscheide(adresse, 'GET', EIGEN), 'netz-zuerst', adresse)
  }
})

test('eine kaputte Adresse bringt nichts zum Einsturz', () => {
  assert.equal(entscheide('nicht mal eine Adresse', 'GET', EIGEN), 'nicht-anfassen')
  assert.equal(entscheide('', 'GET', EIGEN), 'nicht-anfassen')
})

test('der Speichername traegt die Fassung', () => {
  /*
    Damit ist das Aufraeumen keine Pflege, sondern eine Folge: eine neue
    Fassung hat zwangslaeufig einen anderen Namen, der alte Speicher ist damit
    unerreichbar und faellt beim naechsten Anlaufen weg.
  */
  const fassung = quelltext.match(/const FASSUNG = '([^']+)'/)?.[1]
  assert.ok(fassung, 'die Fassung steht woertlich in der Datei')
  assert.match(quelltext, /const SPEICHER = `kombi-\$\{FASSUNG\}`/)
})

/**
 * Der Quelltext ohne Kommentare.
 *
 * Die Proben unten suchen nach Woertern, die in den Erklaerungen absichtlich
 * vorkommen: dort steht "KEIN skipWaiting" und "NICHT DABEI: lib/tesseract".
 * Beim ersten Lauf haben genau diese zwei Erklaerungen ihre eigenen Proben
 * umgeworfen. Dieselbe Falle wie bei zwei Regeln in werkzeug/pruefe.mjs.
 */
const ohneErklaerung = quelltext
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/)
  .map((z) => {
    const stelle = z.indexOf('//')
    return stelle < 0 ? z : z.slice(0, stelle)
  })
  .join('\n')

test('kein skipWaiting und kein clients.claim', () => {
  /*
    Uebernaehme der neue Dienstarbeiter mitten in der Sitzung, loeschte er beim
    Aufraeumen den Speicher der Fassung, mit der das offene Fenster gerade
    laeuft. Faellt danach das Netz aus und das Fenster laedt noch ein Modul
    nach, bekaeme es eine neue Datei in ein altes Programm. index.html tut
    genau das: stil/buehne.js wird erst nach dem Start geholt.
  */
  assert.ok(!ohneErklaerung.includes('skipWaiting'), 'skipWaiting darf nicht vorkommen')
  assert.ok(!ohneErklaerung.includes('clients.claim'), 'clients.claim darf nicht vorkommen')
})

test('beim Einrichten wird alles oder nichts geholt', () => {
  // addAll und nicht put in einer Schleife: ein halb gefuellter Speicher waere
  // eine Mischung aus zwei Fassungen, und genau die soll es nie geben.
  assert.match(quelltext, /addAll\(VORRAT\)/)
})

test('der Speicher wird nur beim Einrichten beschrieben', () => {
  /*
    Ein Speicher, der nebenbei mitschreibt, wird mit der Zeit zwangslaeufig
    eine Mischung aus mehreren Fassungen. Deshalb darf im fetch-Horcher kein
    einziges put stehen.
  */
  const abFetch = ohneErklaerung.slice(ohneErklaerung.indexOf("addEventListener('fetch'"))
  assert.ok(!abFetch.includes('.put('), 'im fetch-Horcher wird nichts geschrieben')
})

test('lib/tesseract bleibt draussen, lib/exceljs kommt mit', () => {
  /*
    Gemessen am 18.09.2026: lib/tesseract sind 16.162.819 Bytes, also 94,5
    Prozent des ganzen Ordners lib. Von den drei Kernen benutzt ein Geraet
    genau einen. Und Tesseract legt sein Sprachmodell ohnehin selbst ab.
  */
  assert.ok(!ohneErklaerung.includes('lib/tesseract'), 'Tesseract gehoert nicht in den Vorrat')
  assert.ok(ohneErklaerung.includes('lib/exceljs/exceljs.min.js'), 'Excel schon')
})
