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

import { KORPUS } from '../test/scheinkorpus.mjs'
import { leseSchein } from '../kern/parser.js'

const ausfuehrlich = process.argv.includes('--ausfuehrlich')

/** Geld gilt als richtig, wenn es auf den Cent stimmt. */
const CENT = 0.005
/** Quoten gelten als richtig, wenn sie auf drei Nachkommastellen stimmen. */
const QUOTE = 0.0015

/**
 * @param {unknown} ist
 * @param {unknown} soll
 * @param {string} feld
 * @returns {boolean}
 */
function stimmt(ist, soll, feld) {
  if (typeof soll === 'number' && typeof ist === 'number') {
    const spielraum = feld === 'quoteDezimal' ? QUOTE : CENT
    return Math.abs(ist - soll) <= spielraum
  }
  return ist === soll
}

/** Holt einen Wert aus dem Ergebnis, egal ob er als Feld oder blank dasteht. */
function wert(ergebnis, feld) {
  const roh = ergebnis[feld]
  if (roh && typeof roh === 'object' && 'wert' in roh) return roh.wert
  return roh
}

const zaehler = new Map()
const fehlerliste = []

for (const fall of KORPUS) {
  let ergebnis
  try {
    ergebnis = leseSchein(fall.zeilen, fall.umgebung)
  } catch (fehler) {
    fehlerliste.push({
      fall: fall.name,
      feld: '(Absturz)',
      soll: '-',
      ist: fehler instanceof Error ? fehler.message : String(fehler),
    })
    continue
  }

  for (const [feld, soll] of Object.entries(fall.erwartet)) {
    const ist = wert(ergebnis, feld)
    const gut = stimmt(ist, soll, feld)

    const stand = zaehler.get(feld) ?? { richtig: 0, gesamt: 0 }
    stand.gesamt++
    if (gut) stand.richtig++
    zaehler.set(feld, stand)

    if (!gut) {
      fehlerliste.push({
        fall: fall.name,
        buchmacher: fall.buchmacher,
        feld,
        soll,
        ist: ist === undefined ? '(nicht gefunden)' : ist,
      })
    }
  }
}

// --- Bericht ---

let gesamtRichtig = 0
let gesamtAlle = 0
for (const stand of zaehler.values()) {
  gesamtRichtig += stand.richtig
  gesamtAlle += stand.gesamt
}

console.log(`\n${KORPUS.length} Scheine, ${gesamtAlle} gepruefte Felder.\n`)
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

if (ausfuehrlich) {
  console.log('\n=== Alle Ergebnisse im Einzelnen ===\n')
  for (const fall of KORPUS) {
    const e = leseSchein(fall.zeilen, fall.umgebung)
    console.log(`--- ${fall.name} (${fall.buchmacher})`)
    console.log(
      `    Einsatz ${wert(e, 'einsatz')}  Quote ${wert(e, 'quoteDezimal')}  ` +
        `Auszahlung ${wert(e, 'auszahlung')}  ${wert(e, 'waehrung')}  ${e.status}`
    )
    const wichtige = (e.hinweise ?? []).filter((h) => h.schwere !== 'hinweis')
    for (const h of wichtige) console.log(`      [${h.schwere}] ${h.code}: ${h.text}`)
  }
}

// Der Rueckgabewert sagt nichts ueber gut oder schlecht. Dieses Werkzeug misst,
// es urteilt nicht. Das Urteil faellt test/korpus.test.mjs.
process.exit(0)
