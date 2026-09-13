/**
 * Kleiner Server zum Ausprobieren auf dem eigenen Rechner.
 *
 * Fuer den Betrieb wird er NICHT gebraucht. Das Programm besteht nur aus Dateien
 * und laeuft auf jedem Webspeicher, auch auf GitHub Pages.
 *
 * Aufruf:  node werkzeug/server.mjs [Port]
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2] ?? 4173)

/** Dateiendung zu Inhaltsart. */
const ARTEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.wasm': 'application/wasm',
  // Die Sprachdatei wird vom Programm selbst entpackt. Deshalb wird sie NICHT
  // als gepackt gemeldet, sonst packt der Browser sie schon aus und das Programm
  // findet danach die erwartete Kennung nicht mehr.
  '.gz': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

/**
 * Der Ordner, in den Karam seine Bildschirmfotos legt.
 *
 * WARUM ES DEN GIBT: bei hundert Fotos ist der Auswahldialog des Browsers
 * muehsam, und er laesst sich von aussen nicht bedienen. Wer die Fotos hier
 * ablegt, drueckt auf der Trainingsseite einen Knopf und alles laeuft.
 *
 * `.arbeit/` steht in `.gitignore`. Die Fotos koennen also gar nicht
 * versehentlich ins oeffentliche Repo wandern. Das ist Absicht.
 *
 * Nur die Trainingsseite benutzt das. Die Anwendung selbst braucht keinen
 * Server und weiss von diesem Ordner nichts.
 */
const FOTOORDNER = '.arbeit/fotos'
const BILDENDUNGEN = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'])

/** Listet die Bilder im Fotoordner auf. */
function listeFotos() {
  const ordner = path.join(wurzel, FOTOORDNER)
  let namen = []
  try {
    namen = fs.readdirSync(ordner)
  } catch {
    return { ordner: FOTOORDNER, vorhanden: false, dateien: [] }
  }

  const dateien = []
  for (const name of namen.sort((a, b) => a.localeCompare(b, 'de'))) {
    if (!BILDENDUNGEN.has(path.extname(name).toLowerCase())) continue
    let angaben
    try {
      angaben = fs.statSync(path.join(ordner, name))
    } catch {
      continue
    }
    if (!angaben.isFile()) continue
    dateien.push({
      name,
      groesse: angaben.size,
      // Der Weg, unter dem der Browser die Datei holen kann.
      pfad: `/${FOTOORDNER}/${encodeURIComponent(name)}`,
    })
  }
  return { ordner: FOTOORDNER, vorhanden: true, dateien }
}

const server = http.createServer((anfrage, antwort) => {
  const adresse = new URL(anfrage.url ?? '/', `http://${anfrage.headers.host}`)
  let pfad = decodeURIComponent(adresse.pathname)
  if (pfad.endsWith('/')) pfad += 'index.html'

  if (pfad === '/werkzeug/fotoordner') {
    const inhalt = JSON.stringify(listeFotos())
    antwort.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(inhalt),
      'Cache-Control': 'no-store',
    })
    antwort.end(inhalt)
    return
  }

  const ziel = path.join(wurzel, pfad)

  // Nichts ausserhalb des Ordners ausliefern.
  if (!ziel.startsWith(wurzel)) {
    antwort.writeHead(403).end('Nicht erlaubt')
    return
  }

  fs.stat(ziel, (fehler, angaben) => {
    if (fehler || !angaben.isFile()) {
      antwort.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      antwort.end(`Nicht gefunden: ${pfad}`)
      return
    }

    const endung = path.extname(ziel).toLowerCase()
    antwort.writeHead(200, {
      'Content-Type': ARTEN[endung] ?? 'application/octet-stream',
      'Content-Length': angaben.size,
      'Cache-Control': 'no-cache',
      // Damit die Texterkennung mehrere Kerne nutzen darf.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    })
    fs.createReadStream(ziel).pipe(antwort)
  })
})

server.listen(port, () => {
  console.log(`Kombi Exchange laeuft auf http://localhost:${port}`)
})
