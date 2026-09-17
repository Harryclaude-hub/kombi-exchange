/**
 * Die entpackten Bilder. EINZIGE Stelle, an der ein Foto im Arbeitsspeicher
 * landet, und einzige Stelle, die es wieder hergibt.
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * Am 17.09.2026 nachgemessen: beim Start hat das Programm JEDES Bild des
 * Projekts aus der Browserdatenbank geholt und sofort entpackt, in
 * oberflaeche/app.js, ladeBilderVomGeraet. Ein Bildschirmfoto vom Telefon ist
 * 1170 mal 2532 Bildpunkte gross. Entpackt sind das vier Byte je Punkt, also
 * rund 11 MB je Foto, gleich ob die Datei 300 KB hat.
 *
 *   10 Fotos      110 MB      geht
 *   100 Fotos     1,1 GB      der Browser wird zaeh
 *   300 Fotos     3,3 GB      der Reiter stirbt beim Laden
 *
 * Karam rechnet mit 10.000 bis 100.000 Fotos in einer Saison. Das waere beim
 * Start eines einzigen Projekts nicht aufgegangen, und zwar mit einem leeren
 * Reiter und ohne jede Meldung.
 *
 * DIE LOESUNG IST NICHT WENIGER SPEICHERN, SONDERN SPAETER ENTPACKEN.
 *
 * Die Datei selbst (der Blob) kostet fast nichts: sie liegt weiter auf der
 * Platte, der Browser haelt nur einen Verweis. Teuer ist allein das Entpacken.
 * Also wird erst entpackt, was jemand wirklich sehen oder lesen will, und es
 * bleiben hoechstens WIE_VIELE Stueck gleichzeitig entpackt. Wer dazukommt,
 * schiebt das aelteste hinaus.
 *
 * WAS DABEI NICHT PASSIEREN DARF: dass ein Bild verschwindet. Hier wird NUR
 * das Entpackte weggeraeumt, nie die Datei. Was hinausgeschoben wurde, wird
 * beim naechsten Ansehen neu entpackt. Es geht also nichts verloren, es dauert
 * nur einen Wimpernschlag laenger.
 */

import { ladeBild } from '../bild/vorverarbeitung.js'

/**
 * Wie viele Bilder gleichzeitig entpackt bleiben.
 *
 * Bei Karams Bildern sind das rund 11 MB je Stueck, also etwa 260 MB. Auf dem
 * Bildschirm sind nie mehr als eine Handvoll gleichzeitig zu sehen; die
 * uebrigen sind Vorrat fuer das Blaettern.
 *
 * KEINE ZAHL AUS DEM STIL. Das hier ist kein Aussehen, sondern Speicher.
 */
const WIE_VIELE = 24

/**
 * Die entpackten Bilder, aeltestes zuerst.
 *
 * Eine Map behaelt die Einfuegereihenfolge, deshalb ist das aelteste immer der
 * erste Schluessel. Wer eines benutzt, wird neu eingefuegt und rutscht damit
 * ans Ende.
 *
 * @type {Map<string, HTMLImageElement>}
 */
const entpackt = new Map()

/**
 * Was gerade entpackt wird. Verhindert, dass dasselbe Bild zehnmal
 * gleichzeitig entpackt wird, wenn zehn Ausschnitte daraus auf dem Bildschirm
 * stehen.
 *
 * @type {Map<string, Promise<HTMLImageElement|null>>}
 */
const unterwegs = new Map()

/**
 * Gibt das entpackte Bild, wenn es schon da ist. Entpackt nichts.
 *
 * @param {string} id
 * @returns {HTMLImageElement|null}
 */
export function schonDa(id) {
  const treffer = entpackt.get(id)
  if (!treffer) return null
  // Benutzt heisst jung: wieder ans Ende der Reihe.
  entpackt.delete(id)
  entpackt.set(id, treffer)
  return treffer
}

/**
 * Entpackt ein Bild, wenn noetig, und gibt es zurueck.
 *
 * Gibt null, wenn es nichts zu entpacken gibt oder die Datei kaputt ist. Wirft
 * nie: ein einzelnes kaputtes Bild darf nie eine ganze Ansicht aufhalten.
 *
 * @param {{bild?: {id: string}, id?: string, element?: HTMLImageElement|null, inhalt?: Blob|null}|null|undefined} eintrag
 * @returns {Promise<HTMLImageElement|null>}
 */
export async function hole(eintrag) {
  if (!eintrag) return null
  const id = eintrag.bild?.id ?? eintrag.id ?? ''
  if (!id) return eintrag.element ?? null

  // Frisch aufgenommen: das Bild liegt schon entpackt am Eintrag.
  if (eintrag.element) {
    if (!entpackt.has(id)) lege(id, eintrag.element)
    return eintrag.element
  }

  const fertig = schonDa(id)
  if (fertig) return fertig

  const laeuft = unterwegs.get(id)
  if (laeuft) return laeuft

  const inhalt = eintrag.inhalt
  if (!inhalt) return null

  const versuch = ladeBild(inhalt)
    .then((element) => {
      lege(id, element)
      return element
    })
    .catch(() => null)
    .finally(() => {
      unterwegs.delete(id)
    })

  unterwegs.set(id, versuch)
  return versuch
}

/**
 * Legt ein entpacktes Bild ab und schiebt das aelteste hinaus, wenn es zu
 * viele werden.
 *
 * @param {string} id
 * @param {HTMLImageElement} element
 */
function lege(id, element) {
  entpackt.delete(id)
  entpackt.set(id, element)

  while (entpackt.size > WIE_VIELE) {
    const aeltester = entpackt.keys().next().value
    if (aeltester === undefined) break
    const raus = entpackt.get(aeltester)
    entpackt.delete(aeltester)
    /*
      WAS DEN SPEICHER WIRKLICH FREIGIBT, ist das Loeschen aus der Map eine
      Zeile hoeher: danach haelt niemand mehr das entpackte Bild, und der
      Browser raeumt es weg.

      Das revokeObjectURL hier ist NICHT der Grund dafuer, und es ist kein
      Ersatz dafuer. bild/vorverarbeitung.js gibt die Adresse schon beim Laden
      wieder her; hier steht es nur fuer den Fall, dass ein Bild auf anderem
      Weg hereinkam und seine Adresse noch lebt. Ein zweites Freigeben derselben
      Adresse tut nichts.
    */
    loesePassendeAdresse(raus)
  }
}

/**
 * Gibt die Adresse eines Bildes her, falls sie noch lebt.
 *
 * @param {HTMLImageElement|null|undefined} element
 */
function loesePassendeAdresse(element) {
  const quelle = element?.src ?? ''
  if (!quelle.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(quelle)
  } catch {
    // Eine schon hergegebene Adresse noch einmal herzugeben ist kein Fehler.
  }
}

/**
 * Raeumt alles weg. Beim Projektwechsel und beim Verwerfen.
 */
export function leere() {
  for (const element of entpackt.values()) loesePassendeAdresse(element)
  entpackt.clear()
  unterwegs.clear()
}

/**
 * Wie viele gerade entpackt sind. Nur zum Nachmessen und fuer die Probe.
 *
 * @returns {{entpackt: number, hoechstens: number}}
 */
export function stand() {
  return { entpackt: entpackt.size, hoechstens: WIE_VIELE }
}
