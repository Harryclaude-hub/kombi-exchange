import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Die Zusagen zum Speicherplatz, nachgemessen.
 *
 * Karam am 17.09.2026: "Ich will wirklich, dass immer die Fotos gespeichert
 * bleiben, dann geht nichts verloren. Das ist mir sehr wichtig, sehr, sehr
 * wichtig. Du musst sicherstellen, dass bei Riesenmengen an Fotos noch immer
 * alle Fotos gespeichert werden koennen, langfristig. Also am besten noch auf
 * dem Desktop, den er gerade nutzt."
 *
 * Projektregel 3: eine Sicherung zaehlt erst, wenn sie ausgeloest hat. Alle
 * drei Faelle hier haben am 17.09.2026 in der Fehlersuche wirklich
 * zugeschlagen, und keiner davon hat dabei eine Meldung erzeugt.
 */

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

/* ------------------------------------------------------------------ *
 * Ein Ordner auf der Platte, nachgebaut.                              *
 * ------------------------------------------------------------------ */

/**
 * @param {string[]} dateien  Was schon im Ordner liegt.
 * @param {PermissionState} erlaubnis
 */
function ordnerMit(dateien, erlaubnis = 'granted') {
  return {
    name: 'Fotos',
    async queryPermission() {
      return erlaubnis
    },
    async requestPermission() {
      return erlaubnis
    },
    async *keys() {
      for (const d of dateien) yield d
    },
  }
}

test('fehlende() sieht im Ordner NACH und zaehlt nicht einfach alles', async () => {
  /*
    DER FEHLER, GEGEN DEN DAS HIER STEHT.

    Bis zum 17.09.2026 stand in der Uebersicht "N Bild(er) liegen noch nicht im
    Ordner", und N war die Gesamtzahl ALLER Bilder des Projekts. Wer gesichert
    hatte, sah nach dem Neuladen dieselbe Zahl wieder und drueckte noch einmal.
  */
  const Platte = await frischesModul()
  const drei = [
    { id: 'a-1', dateiname: 'Screenshot.png' },
    { id: 'b-2', dateiname: 'Screenshot.png' },
    { id: 'c-3', dateiname: 'Screenshot.png' },
  ]
  // Zwei davon liegen schon drin, unter ihren eindeutigen Namen.
  const schonDrin = [Platte.dateinameFuer(drei[0]), Platte.dateinameFuer(drei[1])]
  Platte.__setzeGriffFuerProbe(ordnerMit(schonDrin))

  assert.equal(await Platte.fehlende(drei), 1)
  assert.equal(await Platte.fehlende([drei[0], drei[1]]), 0)
})

test('ohne Erlaubnis sagt fehlende() NICHTS statt null Luecken', async () => {
  /*
    Die gefaehrlichste Anzeige ist die, die beruhigt, wo sie nichts weiss. Ohne
    Erlaubnis wird nicht geschrieben; haette diese Stelle 0 gemeldet, stuende
    im Kasten "Alle Bilder dieses Projekts liegen im Ordner", waehrend gerade
    gar nichts hineinkommt. Genau so war es bis zum 17.09.2026.
  */
  const Platte = await frischesModul()
  Platte.__setzeGriffFuerProbe(ordnerMit([], 'prompt'))
  assert.equal(await Platte.fehlende([{ id: 'a', dateiname: 'x.png' }]), null)
})

test('ohne gemerkten Ordner sagt fehlende() ebenfalls NICHTS', async () => {
  const Platte = await frischesModul()
  Platte.__setzeGriffFuerProbe(null)
  assert.equal(await Platte.fehlende([{ id: 'a', dateiname: 'x.png' }]), null)
})

test('holeErlaubnis() fragt wirklich nach, statt zu sichern', async () => {
  /*
    Der Knopf hiess "Ordner wieder freigeben" und rief in Wahrheit das Sichern
    auf. Das Sichern scheitert aber genau an der fehlenden Erlaubnis: ein
    Knopf, der nichts tut, und kein Weg zurueck ausser den Ordner neu
    auszusuchen. Nach JEDEM Browser-Neustart.
  */
  const Platte = await frischesModul()
  let gefragt = 0
  const griff = ordnerMit([], 'prompt')
  griff.requestPermission = async () => {
    gefragt += 1
    return 'granted'
  }
  Platte.__setzeGriffFuerProbe(griff)

  const ergebnis = await Platte.holeErlaubnis()
  assert.equal(gefragt, 1, 'requestPermission wurde nicht gerufen')
  assert.equal(ergebnis.gelungen, true)
  assert.equal(ergebnis.name, 'Fotos')
})

test('ein Nein auf die Nachfrage ist kein stiller Erfolg', async () => {
  const Platte = await frischesModul()
  Platte.__setzeGriffFuerProbe(ordnerMit([], 'denied'))
  const ergebnis = await Platte.holeErlaubnis()
  assert.equal(ergebnis.gelungen, false)
  assert.match(ergebnis.meldung, /Schreibrecht/)
})

test('ohne gemerkten Ordner behauptet holeErlaubnis() nichts', async () => {
  const Platte = await frischesModul()
  Platte.__setzeGriffFuerProbe(null)
  const ergebnis = await Platte.holeErlaubnis()
  assert.equal(ergebnis.gelungen, false)
})

/**
 * Laedt das Modul frisch, damit der gemerkte Griff je Probe eigen ist.
 *
 * Node haelt geladene Module fest; ohne den Anhaenger an der Adresse traege
 * die zweite Probe den Ordner der ersten.
 */
let zaehler = 0
async function frischesModul() {
  zaehler += 1
  return import(`../daten/plattenspeicher.js?probe=${zaehler}`)
}
