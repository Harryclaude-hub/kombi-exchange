/**
 * Misst, wie viel vom Korpus richtig gelesen wird.
 *
 * Aufruf:  node werkzeug/messe_lesen.mjs
 *          node werkzeug/messe_lesen.mjs --ausfuehrlich
 *
 * Warum das kein normaler Test ist: ein Test sagt bestanden oder gefallen.
 * Hier ist die Frage, WIE VIEL richtig gelesen wird und WELCHES Feld klemmt.
 * Diese Zahl gehoert vor und nach jeder Aenderung am Leseprogramm verglichen.
 *
 * Der eigentliche Test, der bei einer Verschlechterung rot wird, steht in
 * test/korpus.test.mjs. Hier geht es um die Uebersicht.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KORPUS } from '../test/scheinkorpus.mjs'
import { leseSchein } from '../kern/parser.js'
import { pruefeFall, wert } from '../test/korpus_pruefer.mjs'

const ausfuehrlich = process.argv.includes('--ausfuehrlich')
const hier = path.dirname(fileURLToPath(import.meta.url))

/**
 * Der echte Korpus aus Karams Fotos, falls es ihn schon gibt.
 *
 * WARUM DAS HIER STEHEN MUSS: ohne ihn misst diese Latte nach dem Training
 * weiter nur die nachgebauten Bilder und meldet weiter hundert Prozent,
 * waehrend die echten Fotos schlecht gelesen werden. Ein auffaellig gutes
 * Ergebnis ist ein Warnsignal, und das waere eines gewesen.
 */
const echtDatei = path.join(hier, '..', 'test', 'korpus_echt.mjs')
let KORPUS_ECHT = []
let echtVorhanden = false
if (fs.existsSync(echtDatei)) {
  const geladen = await import('../test/korpus_echt.mjs')
  if (Array.isArray(geladen.KORPUS_ECHT)) {
    KORPUS_ECHT = geladen.KORPUS_ECHT
    echtVorhanden = true
  }
}

// Nur durchgesehene Faelle sind geprueefte Wahrheit. Der Rest ist das, was die
// Maschine gesagt hat, und sich selbst zu messen ergibt immer hundert Prozent.
const ECHT_GEPRUEFT = KORPUS_ECHT.filter((f) => f.durchgesehen === true)

/** Die Felder, die ein Fall ueberhaupt beurteilen kann. */
const PRUEFBARE_FELDER = ['scheinNr', 'einsatz', 'quoteDezimal', 'auszahlung', 'waehrung', 'status']

/**
 * Zaehlt einen Korpus durch.
 *
 * @param {any[]} korpus
 * @returns {{zaehler: Map<string, {richtig: number, gesamt: number}>, fehlerliste: any[]}}
 */
function messe(korpus) {
  const zaehler = new Map()
  const fehlerliste = []

  for (const fall of korpus) {
    for (const z of pruefeFall(fall)) {
      const stand = zaehler.get(z.feld) ?? { richtig: 0, gesamt: 0 }
      stand.gesamt++
      if (z.gut) stand.richtig++
      zaehler.set(z.feld, stand)

      if (!z.gut) {
        fehlerliste.push({
          fall: fall.name,
          buchmacher: fall.buchmacher,
          feld: z.feld,
          soll: z.soll,
          ist: z.ist,
        })
      }
    }
  }

  return { zaehler, fehlerliste }
}

const { zaehler, fehlerliste } = messe(KORPUS)

// --- Bericht ---

let gesamtRichtig = 0
let gesamtAlle = 0
for (const stand of zaehler.values()) {
  gesamtRichtig += stand.richtig
  gesamtAlle += stand.gesamt
}

console.log(`\nNACHGEBAUT: ${KORPUS.length} Scheine, ${gesamtAlle} gepruefte Felder.\n`)
console.log('Feld              richtig   von    Anteil')
console.log('-----------------------------------------')

const felder = [...zaehler.entries()].sort((a, b) => a[0].localeCompare(b[0]))
for (const [feld, stand] of felder) {
  const anteil = ((stand.richtig / stand.gesamt) * 100).toFixed(0)
  const marke = stand.richtig === stand.gesamt ? '' : '   <--'
  console.log(
    `${feld.padEnd(16)}  ${String(stand.richtig).padStart(5)}  ${String(stand.gesamt).padStart(5)}  ${anteil.padStart(6)}%${marke}`
  )
}

console.log('-----------------------------------------')
const gesamtAnteil = ((gesamtRichtig / gesamtAlle) * 100).toFixed(1)
console.log(`${'GESAMT'.padEnd(16)}  ${String(gesamtRichtig).padStart(5)}  ${String(gesamtAlle).padStart(5)}  ${gesamtAnteil.padStart(6)}%\n`)

if (fehlerliste.length > 0) {
  console.log(`${fehlerliste.length} Abweichung(en):\n`)
  for (const f of fehlerliste) {
    console.log(`  ${f.fall}`)
    console.log(`    ${f.feld}: erwartet ${JSON.stringify(f.soll)}, gelesen ${JSON.stringify(f.ist)}`)
  }
  console.log('')
}

// ---------------------------------------------------------------------------
// Der echte Korpus aus Karams Fotos
//
// Die Zahl oben sagt nur, wie gut nachgebaute Bilder gelesen werden. Das ist
// die leichtere Uebung. Was zaehlt, steht hier.
// ---------------------------------------------------------------------------

console.log('ECHTE FOTOS')
console.log('-----------------------------------------')

if (!echtVorhanden || KORPUS_ECHT.length === 0) {
  console.log('  Noch kein Training gelaufen: test/korpus_echt.mjs ist leer.')
  console.log('  Die Zahl oben sagt deshalb NICHTS ueber echte Bildschirmfotos aus.')
  console.log('  Gefuellt wird sie in werkzeug/training/, siehe UEBERGABE.md.\n')
} else if (ECHT_GEPRUEFT.length === 0) {
  console.log(`  ${KORPUS_ECHT.length} Fall/Faelle vorhanden, aber KEINER ist durchgesehen.`)
  console.log('  Ungeprueftes Maschinenergebnis gegen sich selbst zu messen ergibt immer')
  console.log('  hundert Prozent und sagt nichts. Deshalb wird hier nichts gezaehlt.\n')
} else {
  const echt = messe(ECHT_GEPRUEFT)
  let richtig = 0
  let alle = 0
  for (const stand of echt.zaehler.values()) {
    richtig += stand.richtig
    alle += stand.gesamt
  }

  console.log(
    `  ${ECHT_GEPRUEFT.length} von ${KORPUS_ECHT.length} Faellen durchgesehen, ${alle} gepruefte Felder.\n`
  )
  console.log('  Feld              richtig   von    Anteil')
  console.log('  ---------------------------------------')
  for (const [feld, stand] of [...echt.zaehler.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const anteil = ((stand.richtig / stand.gesamt) * 100).toFixed(0)
    const marke = stand.richtig === stand.gesamt ? '' : '   <--'
    console.log(
      `  ${feld.padEnd(16)}  ${String(stand.richtig).padStart(5)}  ${String(stand.gesamt).padStart(5)}  ${anteil.padStart(6)}%${marke}`
    )
  }
  console.log('  ---------------------------------------')
  const anteil = alle > 0 ? ((richtig / alle) * 100).toFixed(1) : '0.0'
  console.log(
    `  ${'GESAMT'.padEnd(16)}  ${String(richtig).padStart(5)}  ${String(alle).padStart(5)}  ${anteil.padStart(6)}%\n`
  )

  // Ein Feld, das weder gelesen noch als "steht nicht drauf" bezeichnet wurde,
  // taucht nirgends auf. Es wuerde die Prozentzahl heben, je schlechter
  // gelesen wird. Deshalb wird es hier ausdruecklich genannt.
  const offen = new Map()
  for (const fall of ECHT_GEPRUEFT) {
    for (const feld of PRUEFBARE_FELDER) {
      const beurteilt =
        Object.prototype.hasOwnProperty.call(fall.erwartet ?? {}, feld) ||
        (fall.nichtVorhanden ?? []).includes(feld)
      if (!beurteilt) offen.set(feld, (offen.get(feld) ?? 0) + 1)
    }
  }
  if (offen.size > 0) {
    console.log('  NICHT BEURTEILT (weder gelesen noch als "steht nicht drauf" bezeichnet):')
    for (const [feld, n] of [...offen.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${feld.padEnd(16)} ${n} Fall/Faelle`)
    }
    console.log('    Diese Felder heben die Prozentzahl, je schlechter gelesen wird.')
    console.log('    Sie gehoeren in der Trainingsseite abgehakt.\n')
  }

  if (echt.fehlerliste.length > 0) {
    console.log(`  ${echt.fehlerliste.length} Abweichung(en) bei echten Fotos:\n`)
    for (const f of echt.fehlerliste) {
      console.log(`    ${f.fall}`)
      console.log(
        `      ${f.feld}: erwartet ${JSON.stringify(f.soll)}, gelesen ${JSON.stringify(f.ist)}`
      )
    }
    console.log('')
  }
}

if (ausfuehrlich) {
  console.log('\n=== Alle Ergebnisse im Einzelnen ===\n')
  for (const fall of KORPUS) {
    const e = leseSchein(fall.zeilen, fall.umgebung)
    console.log(`--- ${fall.name} (${fall.buchmacher})`)
    console.log(
      `    Einsatz ${wert(e, 'einsatz')}  Quote ${wert(e, 'quoteDezimal')}  ` +
        `Auszahlung ${wert(e, 'auszahlung')}  ${wert(e, 'waehrung')}  ${e.status}`
    )
    // Schwere ist 'info', 'warnung' oder 'fehler' (kern/typen.js). Ein Filter
    // auf 'hinweis' liess frueher JEDEN Hinweis als wichtig durchgehen.
    const wichtige = (e.hinweise ?? []).filter((h) => h.schwere !== 'info')
    for (const h of wichtige) console.log(`      [${h.schwere}] ${h.code}: ${h.text}`)
  }
}

// Der Rueckgabewert sagt nichts ueber gut oder schlecht. Dieses Werkzeug misst,
// es urteilt nicht. Das Urteil faellt test/korpus.test.mjs.
process.exit(0)
