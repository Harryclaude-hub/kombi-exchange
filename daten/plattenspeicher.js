// @ts-check
/**
 * Ein echter Ordner auf der Platte, in dem die Fotos liegen bleiben.
 *
 * Karam am 17.09.2026: "Du musst wirklich sicherstellen, dass der Speicherplatz
 * immer optimal gespeichert wird. Dass der Nutzer immer seine Fotos irgendwo
 * hat. Also am besten noch auf dem Desktop, den er gerade nutzt."
 *
 * Und davor: "Ich habe keinen Bock, so viel auf Supabase zu machen, wenn das
 * dann Geld kostet. Aber ich will wirklich, dass immer die Fotos gespeichert
 * bleiben, dann geht nichts verloren."
 *
 * WARUM NICHT DIE DATENBANK
 *
 * Supabase gibt im kostenlosen Plan ein Gigabyte Dateispeicher. Bei Karams
 * Bildern sind das etwa tausend Fotos. Er rechnet mit zehntausend bis
 * hunderttausend in einer Saison. Das passt nicht, und es wuerde Geld kosten,
 * das er nicht ausgeben will.
 *
 * WARUM NICHT NUR DIE BROWSERDATENBANK
 *
 * Die gibt es schon (daten/ablage.js), sie ist kostenlos und schnell, und seit
 * dem 17.09.2026 bittet das Programm den Browser, sie nicht von selbst
 * aufzuraeumen. Aber sie hat zwei Grenzen, die sich nicht wegbauen lassen:
 *
 *   Wer die Browserdaten loescht, loescht die Fotos mit.
 *   Ein neu aufgesetzter Rechner faengt bei null an.
 *
 * Eine Kopie AUSSERHALB des Browsers ist die einzige Antwort darauf. Ein Ordner
 * auf der Platte kostet nichts, hat kein Limit ausser der Platte selbst, und
 * die Dateien liegen ganz normal da: auch ohne dieses Programm, auch in zehn
 * Jahren, auch auf einer externen Festplatte oder in einem Ordner, der sich von
 * selbst in eine Wolke sichert.
 *
 * WAS DER BROWSER DAFUER KANN
 *
 * showDirectoryPicker() gibt einen Griff auf einen Ordner, den der Mensch
 * aussucht. Der Griff laesst sich in der Browserdatenbank ablegen und ueberlebt
 * das Schliessen des Fensters. Beim naechsten Start wird EINMAL nach der
 * Erlaubnis gefragt, danach laeuft es von selbst.
 *
 * DAS GIBT ES NICHT UEBERALL. Chrome und Edge koennen es, Firefox und Safari
 * nicht, auf dem Telefon meistens auch nicht. Deshalb sagt dieses Modul
 * ehrlich, ob es geht. Wo es nicht geht, gibt es HEUTE keinen Ersatz: die
 * Fotos liegen dann nur im Browser. Der Kasten in der Uebersicht sagt genau
 * das, und er verspricht keinen Weg, den es nicht gibt (Projektregel 1: eine
 * Luecke mit Warnung ist besser als ein erfundener Wert).
 *
 * HIER WIRD NICHTS GELOESCHT. Dieses Modul schreibt nur. Was einmal im Ordner
 * liegt, bleibt dort, auch wenn das Bild im Programm entfernt wird: der Ordner
 * ist die Sicherung, und eine Sicherung, die mitloescht, ist keine.
 */

import { merkeStand, holeStand } from './ablage.js'

/** Unter welchem Schluessel der Griff auf den Ordner liegt. */
const SCHLUESSEL = 'plattenordner'

/** @type {FileSystemDirectoryHandle|null} */
let griff = null

/** Was in dieser Sitzung schon geschrieben wurde. Spart das Nachsehen. */
const schonGeschrieben = new Set()

/**
 * Ob dieser Browser Ordner auf der Platte kann.
 *
 * @returns {boolean}
 */
export function moeglich() {
  return typeof globalThis.showDirectoryPicker === 'function'
}

/**
 * Holt den gemerkten Griff aus der Browserdatenbank.
 *
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
async function gemerkterGriff() {
  if (griff) return griff
  try {
    const wert = await holeStand(SCHLUESSEL)
    if (wert && typeof wert === 'object' && 'queryPermission' in wert) {
      griff = /** @type {any} */ (wert)
      return griff
    }
  } catch {
    // Ein Griff, den der Browser nicht mehr annimmt, ist kein Fehler. Dann
    // fragt das Programm eben noch einmal nach dem Ordner.
  }
  return null
}

/**
 * Setzt den Ordnergriff von Hand. NUR FUER DIE PROBE.
 *
 * In node gibt es weder showDirectoryPicker noch die Browserdatenbank, aus der
 * der Griff sonst kommt. Ohne diesen Weg liesse sich keine der Zusagen zum
 * Speicherplatz nachmessen, und Projektregel 3 sagt: eine Sicherung zaehlt
 * erst, wenn sie ausgeloest hat.
 *
 * Im Programm ruft das niemand; `werkzeug/pruefe.mjs` wacht darueber.
 *
 * @param {any} neuerGriff
 */
export function __setzeGriffFuerProbe(neuerGriff) {
  griff = neuerGriff
  schonGeschrieben.clear()
}

/**
 * Wie es um den Ordner steht.
 *
 * @returns {Promise<{moeglich: boolean, gewaehlt: boolean, name: string, erlaubt: boolean}>}
 */
export async function stand() {
  if (!moeglich()) return { moeglich: false, gewaehlt: false, name: '', erlaubt: false }

  const g = await gemerkterGriff()
  if (!g) return { moeglich: true, gewaehlt: false, name: '', erlaubt: false }

  let erlaubt = false
  try {
    erlaubt = (await g.queryPermission({ mode: 'readwrite' })) === 'granted'
  } catch {
    erlaubt = false
  }
  return { moeglich: true, gewaehlt: true, name: g.name ?? '', erlaubt }
}

/**
 * Laesst den Menschen einen Ordner aussuchen und merkt ihn sich.
 *
 * MUSS AUS EINEM KLICK HERAUS GERUFEN WERDEN. Der Browser oeffnet die Auswahl
 * nur, wenn ein Mensch gerade etwas gedrueckt hat. Von selbst geht es nicht,
 * und das ist richtig so.
 *
 * @returns {Promise<{gelungen: boolean, name: string, meldung: string}>}
 */
export async function waehleOrdner() {
  if (!moeglich()) {
    return {
      gelungen: false,
      name: '',
      meldung: 'Dieser Browser kann keine Ordner auswählen. Chrome oder Edge können es.',
    }
  }

  try {
    const gewaehlt = await globalThis.showDirectoryPicker({
      id: 'kombi-fotos',
      mode: 'readwrite',
      startIn: 'desktop',
    })
    // Die Erlaubnis gleich holen, solange der Klick noch zaehlt. Spaeter waere
    // eine zweite Rueckfrage noetig, und die kaeme dann ohne Zusammenhang.
    const erlaubnis = await gewaehlt.requestPermission({ mode: 'readwrite' })
    if (erlaubnis !== 'granted') {
      return { gelungen: false, name: gewaehlt.name ?? '', meldung: 'Ohne Schreibrecht geht es nicht.' }
    }

    griff = gewaehlt
    schonGeschrieben.clear()
    await merkeStand(SCHLUESSEL, gewaehlt)
    return { gelungen: true, name: gewaehlt.name ?? '', meldung: '' }
  } catch (fehler) {
    // Abbrechen ist kein Fehler. Der Browser wirft dabei AbortError.
    const name = fehler instanceof Error ? fehler.name : ''
    if (name === 'AbortError') return { gelungen: false, name: '', meldung: '' }
    return {
      gelungen: false,
      name: '',
      meldung: `Der Ordner liess sich nicht öffnen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
    }
  }
}

/**
 * Holt die Schreiberlaubnis fuer den gemerkten Ordner zurueck.
 *
 * DER WEG, DER GEFEHLT HAT. Der Browser vergisst die Erlaubnis bei jedem
 * Neustart; der Griff auf den Ordner bleibt, das Ja dazu nicht. Am 17.09.2026
 * gefunden: der Knopf, der "Ordner wieder freigeben" hiess, rief in Wahrheit
 * das Sichern auf, und das scheiterte genau an der fehlenden Erlaubnis. Es gab
 * keinen Weg zurueck ausser den Ordner neu auszusuchen.
 *
 * MUSS AUS EINEM KLICK HERAUS LAUFEN. requestPermission verlangt eine
 * Handlung des Menschen; von selbst aufgerufen lehnt der Browser ab.
 *
 * @returns {Promise<{gelungen: boolean, name: string, meldung: string}>}
 */
export async function holeErlaubnis() {
  const g = await gemerkterGriff()
  if (!g) return { gelungen: false, name: '', meldung: 'Es ist kein Ordner gemerkt.' }

  try {
    if ((await g.queryPermission({ mode: 'readwrite' })) === 'granted') {
      return { gelungen: true, name: g.name ?? '', meldung: '' }
    }
    const erlaubnis = await g.requestPermission({ mode: 'readwrite' })
    if (erlaubnis !== 'granted') {
      return {
        gelungen: false,
        name: g.name ?? '',
        meldung: 'Ohne Schreibrecht kann nichts in den Ordner geschrieben werden.',
      }
    }
    return { gelungen: true, name: g.name ?? '', meldung: '' }
  } catch (fehler) {
    return {
      gelungen: false,
      name: g.name ?? '',
      meldung: `Die Erlaubnis liess sich nicht holen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
    }
  }
}

/**
 * Sieht im Ordner NACH, welche dieser Bilder wirklich fehlen.
 *
 * NACHGESEHEN STATT GERATEN. Bis zum 17.09.2026 stand in der Uebersicht
 * "N Bild(er) liegen noch nicht im Ordner", und N war in Wahrheit die
 * Gesamtzahl ALLER Bilder des Projekts, auch der laengst gesicherten. Wer
 * zweimal auf Sichern drueckte, sah dieselbe Zahl wieder. Das ist kein
 * Messwert, das ist eine Behauptung.
 *
 * Der Ordner kann seine Dateinamen aufzaehlen, und dateinameFuer() ist
 * eindeutig. Also wird verglichen.
 *
 * Gibt null zurueck, wenn sich nichts feststellen laesst: kein Ordner, keine
 * Erlaubnis, kein Aufzaehlen moeglich. Dann steht in der Anzeige, dass es
 * nicht nachgesehen wurde, statt einer erfundenen Zahl.
 *
 * @param {{id: string, dateiname?: string}[]} bilder
 * @returns {Promise<number|null>}
 */
export async function fehlende(bilder) {
  const g = await gemerkterGriff()
  if (!g || typeof g.keys !== 'function') return null

  try {
    if ((await g.queryPermission({ mode: 'readwrite' })) !== 'granted') return null

    /** @type {Set<string>} */
    const drin = new Set()
    for await (const name of g.keys()) drin.add(name)

    let fehlt = 0
    for (const bild of bilder) {
      if (!drin.has(dateinameFuer(bild))) fehlt += 1
      else schonGeschrieben.add(bild.id)
    }
    return fehlt
  } catch {
    return null
  }
}

/**
 * Nimmt den Ordner wieder heraus. Die Dateien darin bleiben liegen.
 */
export async function vergissOrdner() {
  griff = null
  schonGeschrieben.clear()
  await merkeStand(SCHLUESSEL, null)
}

/**
 * Der Dateiname, unter dem ein Bild im Ordner liegt.
 *
 * ER ENTHAELT DIE KENNUNG. Zwei Bildschirmfotos heissen oft gleich
 * ("Screenshot 2026-09-17.png"), und dann wuerde eines das andere
 * ueberschreiben: ein stiller Verlust genau der Art, die Karam fuerchtet.
 *
 * @param {{id: string, dateiname?: string}} bild
 * @returns {string}
 */
export function dateinameFuer(bild) {
  const roh = String(bild.dateiname ?? '').trim()
  const punkt = roh.lastIndexOf('.')
  const endung = punkt > 0 ? roh.slice(punkt + 1).toLowerCase() : 'png'
  const stamm = (punkt > 0 ? roh.slice(0, punkt) : roh) || 'bild'
  // Alles, was in einem Dateinamen Aerger macht, faellt weg.
  const sauber = stamm.replace(/[^\w\- ]+/g, '_').slice(0, 60).trim() || 'bild'
  return `${sauber}__${bild.id}.${endung.replace(/[^a-z0-9]/g, '') || 'png'}`
}

/**
 * Schreibt ein Bild in den Ordner.
 *
 * Tut nichts, wenn kein Ordner gewaehlt ist oder die Erlaubnis fehlt. Das ist
 * Absicht: das Sichern darf das Aufnehmen nie aufhalten. Ob es geklappt hat,
 * steht im Ergebnis, und die Ansicht zeigt es an.
 *
 * @param {{id: string, dateiname?: string, inhalt: Blob}} bild
 * @returns {Promise<{geschrieben: boolean, grund: string}>}
 */
export async function sichere(bild) {
  if (!bild?.inhalt) return { geschrieben: false, grund: 'kein Inhalt' }
  if (schonGeschrieben.has(bild.id)) return { geschrieben: true, grund: 'schon gesichert' }

  const g = await gemerkterGriff()
  if (!g) return { geschrieben: false, grund: 'kein Ordner gewählt' }

  try {
    if ((await g.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      return { geschrieben: false, grund: 'keine Erlaubnis' }
    }
    const datei = await g.getFileHandle(dateinameFuer(bild), { create: true })
    const strom = await datei.createWritable()
    await strom.write(bild.inhalt)
    await strom.close()
    schonGeschrieben.add(bild.id)
    return { geschrieben: true, grund: '' }
  } catch (fehler) {
    return {
      geschrieben: false,
      grund: fehler instanceof Error ? fehler.message : String(fehler),
    }
  }
}

/**
 * Schreibt mehrere Bilder und sagt, wie viele es wurden.
 *
 * Eines nach dem anderen und nicht alle auf einmal: bei zehntausend Bildern
 * wuerde ein Promise.all den Arbeitsspeicher fuellen und den Browser anhalten.
 * Der Fortschritt wird gemeldet, damit die Ansicht ihn zeigen kann.
 *
 * @param {{id: string, dateiname?: string, inhalt: Blob}[]} bilder
 * @param {(fertig: number, gesamt: number) => void} [melde]
 * @returns {Promise<{geschrieben: number, uebersprungen: number, fehler: string[]}>}
 */
export async function sichereAlle(bilder, melde) {
  let geschrieben = 0
  let uebersprungen = 0
  /** @type {string[]} */
  const fehler = []

  for (let i = 0; i < bilder.length; i += 1) {
    const ergebnis = await sichere(bilder[i])
    if (ergebnis.geschrieben) geschrieben += 1
    else if (ergebnis.grund === 'kein Inhalt') uebersprungen += 1
    else if (fehler.length < 5) fehler.push(ergebnis.grund)
    if (melde) melde(i + 1, bilder.length)
  }

  return { geschrieben, uebersprungen, fehler }
}
