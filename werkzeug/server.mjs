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
  '.wasm': 'application/wasm',
  // Die Sprachdatei wird vom Programm selbst entpackt. Deshalb wird sie NICHT
  // als gepackt gemeldet, sonst packt der Browser sie schon aus und das Programm
  // findet danach die erwartete Kennung nicht mehr.
  '.gz': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

const server = http.createServer((anfrage, antwort) => {
  const adresse = new URL(anfrage.url ?? '/', `http://${anfrage.headers.host}`)
  let pfad = decodeURIComponent(adresse.pathname)
  if (pfad.endsWith('/')) pfad += 'index.html'

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
