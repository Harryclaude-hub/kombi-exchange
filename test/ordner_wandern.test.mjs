import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Ordner duerfen beim Neuordnen nicht verloren gehen.
 *
 * DER FUND, 17.09.2026, im Browser, eine Viertelstunde nachdem die Ordner das
 * erste Mal liefen:
 *
 *   vier Riesenscheine in den Ordner "Spieltag 3" gelegt, gemessen: richtig,
 *     gesetzt 5.481,00 $, kann zurueck 8.988,84 $, von Hand nachgerechnet.
 *   einmal auf "Neuer Riesenschein" gedrueckt, gemessen: ALLE VIER Ordner weg.
 *
 * Der Grund liegt in zustand.js, ordneNeu: gruppiere() baut die Riesenscheine
 * bei jedem Lauf frisch und vergibt dabei neue Kennungen. Stabil ist nicht die
 * Kennung, sondern die Signatur; deshalb rettet ordneNeu auch den Namen ueber
 * die Signatur und nicht ueber die Kennung.
 *
 * Neu geordnet wird nach JEDER berichtigten Zahl. Karam haette seine Ordner
 * also mehrmals taeglich verloren, stillschweigend.
 *
 * Es ist derselbe Fehler wie die Verwechslung von "wo etwas steht" mit "was es
 * ist", die am 16.09.2026 schon positionImBild als Beweis fuer Gleichheit
 * verworfen hat: eine Kennung, die sich aendert, taugt nicht als Gedaechtnis.
 */

/**
 * Ein Ersatz fuer den Browserspeicher, damit sich ordner.js hier pruefen
 * laesst. Es wird NICHTS nachgebaut, was die Datei selbst tut: nur Lesen,
 * Schreiben und Loeschen von Text unter einem Schluessel.
 */
function baueSpeicher(anfang = {}) {
  const inhalt = new Map(Object.entries(anfang))
  return {
    getItem: (k) => (inhalt.has(k) ? inhalt.get(k) : null),
    setItem: (k, v) => void inhalt.set(k, String(v)),
    removeItem: (k) => void inhalt.delete(k),
    clear: () => inhalt.clear(),
  }
}

const SCHLUESSEL = 'kombi-riesenschein-ordner'

/**
 * @param {Record<string, string>} zuordnung
 */
function setzeSpeicher(zuordnung) {
  globalThis.localStorage = baueSpeicher({ [SCHLUESSEL]: JSON.stringify(zuordnung) })
}

/**
 * @returns {Record<string, string>}
 */
function lesSpeicher() {
  const roh = globalThis.localStorage.getItem(SCHLUESSEL)
  return roh ? JSON.parse(roh) : {}
}

// Muss VOR dem Laden gesetzt sein, falls das Modul beim Laden etwas liest.
globalThis.localStorage = baueSpeicher()
const Ordner = await import('../oberflaeche/ordner.js')

test('eine neue Kennung nimmt den Ordner mit', () => {
  setzeSpeicher({ alt1: 'Spieltag 3' })
  Ordner.wandere([['alt1', 'neu1']], new Set(['neu1']))
  assert.deepEqual(lesSpeicher(), { neu1: 'Spieltag 3' })
})

test('genau der Fall aus dem Browser: vier Ordner ueberleben das Neuordnen', () => {
  setzeSpeicher({
    a: 'Spieltag 3',
    b: 'Spieltag 3',
    c: 'Spieltag 3',
    d: 'Spieltag 3',
  })
  Ordner.wandere(
    [
      ['a', 'a2'],
      ['b', 'b2'],
      ['c', 'c2'],
      ['d', 'd2'],
    ],
    new Set(['a2', 'b2', 'c2', 'd2'])
  )
  const nachher = lesSpeicher()
  assert.equal(Object.keys(nachher).length, 4, 'alle vier muessen noch da sein')
  assert.ok(Object.values(nachher).every((o) => o === 'Spieltag 3'))
})

test('eine Kennung, die gleich bleibt, behaelt ihren Ordner', () => {
  // Handgruppen behalten ihre Kennung, weil sie auf den Scheinen steht.
  setzeSpeicher({ handgruppe: 'Woche 2' })
  Ordner.wandere([], new Set(['handgruppe']))
  assert.deepEqual(lesSpeicher(), { handgruppe: 'Woche 2' })
})

test('was auf nichts mehr zeigt, faellt weg', () => {
  // Sonst waechst die Zuordnung ueber eine Saison hinweg um tote Eintraege,
  // und alleOrdner zaehlte irgendwann Ordner, die es nicht mehr gibt.
  setzeSpeicher({ lebt: 'Woche 2', tot: 'Woche 1' })
  Ordner.wandere([], new Set(['lebt']))
  assert.deepEqual(lesSpeicher(), { lebt: 'Woche 2' })
})

test('ein Umzug auf eine Kennung, die es gar nicht gibt, erfindet nichts', () => {
  setzeSpeicher({ ohneOrdner: 'Woche 3' })
  Ordner.wandere([['gibtEsNicht', 'neu']], new Set(['neu', 'ohneOrdner']))
  const nachher = lesSpeicher()
  assert.equal(nachher.neu, undefined, 'ein leerer Umzug darf keinen Ordner erfinden')
  assert.equal(nachher.ohneOrdner, 'Woche 3')
})

test('ohne Umzug und ohne gueltige Kennung bleibt nichts uebrig', () => {
  setzeSpeicher({ a: 'Woche 1', b: 'Woche 2' })
  Ordner.wandere([], new Set())
  assert.deepEqual(lesSpeicher(), {})
})

test('alleOrdner zaehlt nur, worin wirklich etwas liegt', () => {
  setzeSpeicher({ a: 'Woche 1', b: 'Woche 1', c: '' })
  const ordner = Ordner.alleOrdner([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }])
  assert.deepEqual(ordner, [{ name: 'Woche 1', anzahl: 2 }])
  assert.equal(Ordner.anzahlOhneOrdner([{ id: 'a' }, { id: 'c' }, { id: 'd' }]), 2)
})
