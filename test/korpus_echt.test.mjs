import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { alsTests } from './korpus_pruefer.mjs'

/**
 * Der Korpus aus Karams ECHTEN Bildschirmfotos.
 *
 * WOZU DIESE DATEI DA IST
 *
 * werkzeug/training/ laesst echte Fotos durch den echten Leseweg laufen, Karam
 * berichtigt von Hand, was falsch gelesen wurde, und der Knopf "Als Pruefaelle
 * sichern" legt daraus `korpus_echt.mjs` ab. Diese Datei hier ist das, was
 * daraus einen Test macht.
 *
 * VORHER WAR DAS DER TEUERSTE FEHLER DES PROJEKTS: die Seite versprach "ab
 * dann wird jeder dieser Faelle bei jeder Aenderung mitgeprueft", aber
 * `npm test` fuehrt `test/*.test.mjs` aus, und `korpus_echt.mjs` heisst nicht
 * so. Keine Datei hat KORPUS_ECHT je geladen. Stunden Handarbeit waeren ohne
 * jede Wirkung geblieben, und alles haette nach Erfolg ausgesehen: Datei da,
 * Meldung freundlich, Tests gruen.
 *
 * WAS HIER ABSICHTLICH NICHT PASSIERT
 *
 * Es wird nicht rot, solange es noch keine echten Fotos gibt. Vor dem ersten
 * Training gibt es die Datei mit gutem Grund nicht. Der Zustand ist aber
 * sichtbar: node meldet den Fall als uebersprungen, und
 * `node werkzeug/messe_lesen.mjs` sagt es in Worten.
 *
 * Ein Fall ohne `durchgesehen: true` wird ebenfalls uebersprungen. Was niemand
 * angesehen hat, ist keine geprueefte Wahrheit, sondern das Ergebnis der
 * Maschine. Das als Sollwert festzuschreiben hiesse, einen Lesefehler fuer
 * immer einzufrieren.
 */

const hier = path.dirname(fileURLToPath(import.meta.url))
const datei = path.join(hier, 'korpus_echt.mjs')

/** @type {any[]|null} */
let korpus = null
/** @type {string} */
let grund = ''

if (!fs.existsSync(datei)) {
  grund =
    'test/korpus_echt.mjs fehlt. Sie gehoert ins Repo, auch leer. Siehe werkzeug/training/.'
} else {
  const geladen = await import('./korpus_echt.mjs')
  korpus = geladen.KORPUS_ECHT ?? null
  if (!Array.isArray(korpus)) {
    grund = 'test/korpus_echt.mjs liegt da, exportiert aber kein Feld KORPUS_ECHT.'
    korpus = null
  } else if (korpus.length === 0) {
    grund =
      'Noch kein Training gelaufen: test/korpus_echt.mjs ist leer. ' +
      'Echte Fotos durch werkzeug/training/ schicken.'
    korpus = null
  }
}

if (korpus === null) {
  test('echter Korpus aus Fotos', { skip: grund }, () => {})
} else {
  test('jeder Fall des echten Korpus prueft wirklich etwas', () => {
    const leer = korpus
      .filter((f) => f.durchgesehen === true)
      .filter(
        (f) =>
          Object.keys(f.erwartet ?? {}).length === 0 && (f.nichtVorhanden ?? []).length === 0
      )
    assert.equal(
      leer.length,
      0,
      'Diese durchgesehenen Faelle verlangen gar nichts und sind wertlos: ' +
        leer.map((f) => f.name).join(', ')
    )
  })

  test('die Faelle tragen die Umgebung, unter der sie gelesen wurden', () => {
    // Ein Fall, der ohne Umgebung nachgespielt wird, liest dieselben Zeilen
    // anders als der Lauf, aus dem seine Wahrheit stammt. Dann ist er entweder
    // grundlos rot oder, schlimmer, gruen mit einer anderen Zahl.
    const ohne = korpus.filter((f) => !f.umgebung || typeof f.umgebung !== 'object')
    assert.equal(ohne.length, 0, 'ohne Umgebung: ' + ohne.map((f) => f.name).join(', '))
  })

  alsTests(test, assert, korpus, { praefix: 'echt', nurDurchgesehene: true })
}
