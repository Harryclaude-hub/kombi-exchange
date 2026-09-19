import test from 'node:test'
import assert from 'node:assert/strict'

import { beurteileGleicheWette } from '../kern/kennung.js'
import { quotenstreuungVon } from '../kern/rechnung.js'
import { grosseFuerRahmen } from '../oberflaeche/massenschnipsel.js'

/**
 * Die Pruefung hinter dem Massenausschnitt (Karam am 19.09.2026):
 * "die KI muss auch immer erkennen, dass die Screenshots alle die gleiche
 * Wette haben. Also die Quoten muessen sich sehr aehnlich sein, die Spiele."
 *
 * Geprueft wird im PROGRAMM, mit derselben Rechnung, die auch die
 * Riesenscheine zusammenfuehrt: einer KI etwas zu glauben, was sich
 * nachrechnen laesst, verbietet Projektregel 1.
 */

const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'ocr', roh: '' })

/**
 * @param {string} id
 * @param {string} tipp
 * @param {string} markt
 * @param {number|null} linie
 * @param {number} quote
 */
function schein(id, tipp, markt, linie, quote) {
  return {
    id,
    bildId: `bild-${id}`,
    gruppeId: null,
    buchmacher: feld('Stake'),
    konto: feld(null),
    scheinNr: feld(id),
    gesetztAm: feld('2026-09-19T12:00:00.000Z'),
    einsatz: feld(500),
    auszahlung: feld(500 * quote),
    ausgezahlt: feld(null),
    quoteDezimal: feld(quote),
    quoteAmerikanisch: feld(null),
    waehrung: feld('EUR'),
    status: 'offen',
    art: 'einzel',
    gratiswette: false,
    eachWay: false,
    ausgeschlossen: false,
    beine: [],
    auswahlen: [
      {
        id: `${id}-b1`,
        ereignis: feld('Detroit Lions - New Orleans Saints'),
        markt: feld(markt),
        tipp: feld(tipp),
        linie: feld(linie),
        quoteDezimal: feld(quote),
        ergebnis: feld(null),
        status: 'unbekannt',
      },
    ],
    hinweise: [],
    zeilen: [],
    notiz: '',
    geaendertAm: '2026-09-19T12:00',
    vonHand: false,
  }
}

test('dieselbe Wette bei drei Anbietern gilt als gleich', () => {
  const urteil = beurteileGleicheWette([
    schein('a', 'Jahmyr Gibbs', 'OVER Rushing Yards', 84.5, 1.84),
    schein('b', 'Jahmyr Gibbs', 'OVER Rushing Yards', 84.5, 1.86),
    schein('c', 'Jahmyr Gibbs', 'OVER Rushing Yards', 84.5, 1.9),
  ])
  assert.equal(urteil.alleGleich, true)
  assert.equal(urteil.vergleichbar, 3)
  assert.equal(urteil.ohneAuswahl, 0)
})

test('ein anderer Spieler in der Serie faellt auf', () => {
  // Genau der teuerste Fund des Projekts: Gibbs und Williams zusammen waeren
  // ein sinnloser Multiplikator ueber tausende Euro.
  const urteil = beurteileGleicheWette([
    schein('a', 'Jahmyr Gibbs', 'OVER Rushing Yards', 84.5, 1.84),
    schein('b', 'Jahmyr Gibbs', 'OVER Rushing Yards', 84.5, 1.86),
    schein('c', 'Javonte Williams', 'OVER Passing Yards', 226.5, 1.85),
  ])
  assert.equal(urteil.alleGleich, false)
  assert.equal(urteil.abweichler.length, 1)
  assert.equal(urteil.abweichler[0].id, 'c')
  assert.ok(urteil.abweichler[0].gruende.length > 0, 'der Grund steht dabei')
})

test('eine andere Linie ist eine ANDERE Wette', () => {
  // Karam setzt bewusst verschiedene Linien: 84.5 und 82.5 sind verschiedene
  // Wetten mit verschiedenem Risiko. Die Pruefung muss das genauso streng
  // sehen wie die Gruppierung.
  const urteil = beurteileGleicheWette([
    schein('a', 'Jahmyr Gibbs', 'OVER Rushing Yards', 84.5, 1.84),
    schein('b', 'Jahmyr Gibbs', 'OVER Rushing Yards', 82.5, 1.84),
  ])
  assert.equal(urteil.alleGleich, false)
})

test('Scheine ohne Auswahl werden gezaehlt statt still uebersprungen', () => {
  const ohne = schein('x', '', '', null, 1.85)
  ohne.auswahlen = []
  const urteil = beurteileGleicheWette([
    schein('a', 'Jahmyr Gibbs', 'OVER Rushing Yards', 84.5, 1.84),
    schein('b', 'Jahmyr Gibbs', 'OVER Rushing Yards', 84.5, 1.86),
    ohne,
  ])
  assert.equal(urteil.alleGleich, true, 'die vergleichbaren stimmen ueberein')
  assert.equal(urteil.ohneAuswahl, 1, 'aber der Unvergleichbare steht dabei')
})

test('quotenstreuungVon: Karams echte Streuung gegen den bekannten Verleser', () => {
  // Echte Quoten 4,52 Prozent auseinander: unauffaellig.
  const echt = quotenstreuungVon([1.64, 1.64, 1.64, 1.690903, 1.690903, 1.740741], 2)
  assert.ok(echt)
  assert.ok(echt.groessterAbstand < 1.1, `${echt.groessterAbstand}`)

  // Der Verleser 1,69 als 1,89: 13,5 Prozent, faellt ueber die Grenze.
  const verlesen = quotenstreuungVon([1.64, 1.64, 1.89], 2)
  assert.ok(verlesen)
  assert.ok(verlesen.groessterAbstand > 1.1, `${verlesen.groessterAbstand}`)
})

test('quotenstreuungVon: zwei Quoten reichen fuer die Serienpruefung', () => {
  const zwei = quotenstreuungVon([1.84, 18.4], 2)
  assert.ok(zwei)
  assert.ok(zwei.groessterAbstand > 3, 'ein Faktor zehn faellt auch zu zweit auf')

  // Fuer die Riesenschein-Kachel gilt weiter: unter drei wird nichts behauptet.
  assert.equal(quotenstreuungVon([1.84, 18.4]), null)
})

test('quotenstreuungVon rechnet genau wie die Kachel im Riesenschein', () => {
  // Gegenrechnung auf einem zweiten Weg (Projektregel 4), dieselben Zahlen
  // wie in test/quotenstreuung.test.mjs.
  const ECHT = [1.64, 1.64, 1.64, 1.690903, 1.690903, 1.740741]
  const s = quotenstreuungVon(ECHT)
  const sortiert = [...ECHT].sort((a, b) => a - b)
  const median = (sortiert[2] + sortiert[3]) / 2
  const groesster = Math.max(...ECHT.map((q) => (q > median ? q / median : median / q)))
  assert.equal(s.median, Math.round(median * 10000) / 10000)
  assert.equal(s.groessterAbstand, Math.round(groesster * 10000) / 10000)
  assert.equal(s.anzahl, 6)
})

test('grosseFuerRahmen: fast der Bildschirm, nie mehr als der Arbeitsbereich', () => {
  // Karams Monitor: 90 Prozent, damit der Rand des Fensters greifbar bleibt.
  assert.deepEqual(grosseFuerRahmen({ availWidth: 2560, availHeight: 1400 }), {
    breite: 2304,
    hoehe: 1260,
  })
  // Ein kleiner Bildschirm gibt nicht mehr her, als er hat: die Mindestmasse
  // duerfen den Arbeitsbereich nie ueberschreiten, sonst laege der Rahmen
  // teils ausserhalb.
  assert.deepEqual(grosseFuerRahmen({ availWidth: 400, availHeight: 300 }), {
    breite: 400,
    hoehe: 300,
  })
  // Ohne Angaben eine brauchbare Annahme statt NaN: resizeTo(NaN) waere ein
  // stiller Fehlschlag, und der Rahmen bliebe 104 Pixel schmal.
  const blind = grosseFuerRahmen(null)
  assert.ok(Number.isFinite(blind.breite) && blind.breite >= 480)
  assert.ok(Number.isFinite(blind.hoehe) && blind.hoehe >= 360)
})

