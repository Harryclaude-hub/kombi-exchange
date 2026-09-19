// @ts-check
/**
 * Massenausschnitt: ein schwebender Mini-Knopf, jeder Druck nimmt den ganzen
 * Bildschirm, Doppelklick bringt das Programm mit der Vorschau zurueck.
 *
 * Karam am 19.09.2026: "Wenn ich auf diesen Knopf druecke, verkleinert sich
 * das Programm, wird so ein Mini-Knopf, der ist einfach auf dem Bildschirm,
 * den kann man noch bewegen. Und immer wenn ich drauf druecke, kann ich den
 * aktuellen gesamten Bildschirm einfach ausschneiden. Wenn ich mit dem
 * Massenausschneiden fertig bin, tue ich doppelklicken, dann oeffnet sich das
 * Programm wieder und hat eine Preview von allen Screenshots."
 *
 * WIE DER MINI-KNOPF SCHWEBT
 *
 * Eine Webseite kann ihr eigenes Fenster nicht verkleinern. Was sie kann, ist
 * ein BILD-IM-BILD-FENSTER oeffnen (documentPictureInPicture): das ist das
 * einzige Fenster, das IMMER ueber allen anderen liegt, sich frei verschieben
 * laesst und eigenen Inhalt tragen darf. Genau das ist der Mini-Knopf. Chrome
 * und Edge koennen das; wo es fehlt (Firefox, Safari, Telefon), schwebt der
 * Knopf stattdessen IN der Seite, und dann muss das Programmfenster sichtbar
 * bleiben. Der Unterschied steht am Knopf, nicht im Kleingedruckten
 * (Falle 7: eine Einschraenkung ohne ihr Warum liest sich wie Absicht).
 *
 * WAS AUFGENOMMEN WIRD: der GANZE geteilte Bildschirm, ungeschnitten. Kein
 * Rahmenziehen, das ist der Unterschied zum normalen Ausschneiden. Die
 * Zerlegung und das Lesen laufen danach durch dieselben Wege wie jede
 * hochgeladene Datei. Der Mini-Knopf selbst ist auf dem Bild MIT drauf, wenn
 * derselbe Bildschirm geteilt wird; er ist klein und gehoert an den Rand.
 *
 * Die Fensterwahl kommt genau EINMAL (oeffneBildschirmstrom), danach beliebig
 * viele Aufnahmen. Beendet wird mit Doppelklick, Escape, dem Schliessen des
 * Mini-Fensters oder dem Beenden der Freigabe im Browser: alle vier Wege
 * enden im selben Aufraeumen, keiner laesst den Strom offen.
 *
 * Diese Datei setzt nur Klassennamen. Farben und Groessen stehen in stil/,
 * auch fuer das Bild-im-Bild-Fenster: dessen Dokument bekommt dieselben
 * Stilblaetter verlinkt.
 */

import { el } from './werkzeug.js'
import {
  oeffneBildschirmstrom,
  greifeEinzelbild,
  beendeStrom,
  alsDatei,
} from './bildschirmfoto.js'

/**
 * Wie lange nach einem Klick auf ein zweites geklickt gewartet wird, bevor er
 * als EINZELNER Klick gilt (Aufnahme). Kommt in der Spanne ein zweiter, war
 * es ein Doppelklick (fertig). Gemessen an der ueblichen Doppelklickzeit von
 * Windows (500 ms Vorgabe): 300 ms trifft beides, zuegiges Aufnehmen und
 * bequemes Doppelklicken.
 */
const DOPPELKLICK_SPANNE = 300

/**
 * Gibt es hier ein echtes schwebendes Fenster?
 *
 * @returns {boolean}
 */
export function kannMiniFenster() {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

/**
 * Der ganze Durchgang: Mini-Knopf zeigen, sammeln, aufraeumen.
 *
 * Loest mit den aufgenommenen Dateien auf, mit einer leeren Liste bei Abbruch
 * ohne Aufnahme. Wirft nur, wenn schon die Bildschirmfreigabe scheitert; das
 * behandelt der Aufrufer wie beim normalen Ausschneiden.
 *
 * @returns {Promise<File[]>}
 */
export async function massenDurchgang() {
  const { strom, video } = await oeffneBildschirmstrom()

  /** @type {HTMLCanvasElement[]} */
  const bilder = []

  try {
    await sammleImMiniKnopf(strom, video, bilder)
  } finally {
    // Alle Endwege muenden hier: der Browser zeigt sonst unbegrenzt weiter
    // an, dass der Bildschirm geteilt wird.
    beendeStrom(strom, video)
  }

  /** @type {File[]} */
  const dateien = []
  for (let i = 0; i < bilder.length; i++) {
    dateien.push(await alsDatei(bilder[i], `masse-${String(i + 1).padStart(2, '0')}`))
  }
  return dateien
}

/**
 * Zeigt den Mini-Knopf und sammelt Aufnahmen, bis Schluss ist.
 *
 * @param {MediaStream} strom
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement[]} bilder
 * @returns {Promise<void>}
 */
async function sammleImMiniKnopf(strom, video, bilder) {
  /** @type {Window|null} */
  let miniFenster = null
  if (kannMiniFenster()) {
    try {
      miniFenster = await /** @type {any} */ (window).documentPictureInPicture.requestWindow({
        width: 168,
        height: 168,
      })
    } catch {
      // Verweigert oder nicht verfuegbar: dann der Weg in der Seite.
      miniFenster = null
    }
  }

  const dokument = miniFenster ? miniFenster.document : document

  if (miniFenster) {
    // Die Stilblaetter des Programms auch im Mini-Fenster, damit hier keine
    // einzige Farbe im JavaScript steht (Projektregel 5).
    for (const blatt of ['stil/marken.css', 'stil/bauteile.css']) {
      const glied = dokument.createElement('link')
      glied.rel = 'stylesheet'
      glied.href = new URL(blatt, document.baseURI).href
      dokument.head.append(glied)
    }
    dokument.title = 'Massenausschnitt'
    // Nur Merkmale, kein Aussehen: dasselbe Farbthema wie das Programm, und
    // eine Klasse, an der stil/bauteile.css das kleine Fenster erkennt.
    const thema = document.documentElement.dataset.theme
    if (thema) dokument.documentElement.dataset.theme = thema
    dokument.body.className = 'minifenster'
  }

  return new Promise((fertigMelden) => {
    let vorbei = false
    /** @type {number|ReturnType<typeof setTimeout>|null} */
    let klickWecker = null

    const zaehler = dokument.createElement('span')
    zaehler.className = 'miniknopfzahl'
    zaehler.textContent = '0'

    const wort = dokument.createElement('span')
    wort.className = 'miniknopfwort'
    wort.textContent = 'Aufnehmen'

    const knopf = dokument.createElement('button')
    knopf.type = 'button'
    knopf.className = 'miniknopf'
    knopf.title =
      'Klick oder Eingabetaste: den ganzen Bildschirm aufnehmen. ' +
      'Doppelklick oder Escape: fertig, zurück zur Vorschau.'
    knopf.append(zaehler, wort)

    const hinweis = dokument.createElement('p')
    hinweis.className = 'miniknopfhinweis'
    hinweis.textContent = miniFenster
      ? 'Doppelklick: fertig'
      : 'Dieses Fenster muss sichtbar bleiben (kein schwebendes Fenster in diesem Browser). Doppelklick: fertig'

    const huelle = dokument.createElement('div')
    huelle.className = 'miniknopfhuelle'
    huelle.append(knopf, hinweis)

    /** Im Rueckfall ohne Mini-Fenster laesst sich die Huelle ziehen. */
    if (!miniFenster) {
      huelle.dataset.inSeite = 'true'
      macheZiehbar(huelle)
    }

    dokument.body.append(huelle)
    knopf.focus()

    const nimmAuf = async () => {
      try {
        const leinwand = await greifeEinzelbild(video)
        bilder.push(leinwand)
        zaehler.textContent = String(bilder.length)
        // Kurzes Aufleuchten als Quittung. Nur ein Merkmal, das Aussehen
        // steht in stil/bauteile.css.
        knopf.dataset.genommen = 'true'
        setTimeout(() => {
          knopf.dataset.genommen = 'false'
        }, 180)
      } catch (fehler) {
        wort.textContent = 'Fehlgeschlagen'
        knopf.title = `Die Aufnahme schlug fehl: ${
          fehler instanceof Error ? fehler.message : String(fehler)
        }`
      }
    }

    const schluss = () => {
      if (vorbei) return
      vorbei = true
      if (klickWecker !== null) clearTimeout(klickWecker)
      huelle.remove()
      if (miniFenster) {
        try {
          miniFenster.close()
        } catch {
          // Ein schon geschlossenes Fenster ist kein Fehler.
        }
      }
      fertigMelden()
    }

    /*
      EIN KLICK NIMMT AUF, EIN DOPPELKLICK BEENDET.

      Der Browser feuert bei einem Doppelklick ZWEI click-Ereignisse und dann
      dblclick. Wer beim ersten click sofort aufnimmt, hat beim Beenden immer
      eine ungewollte Aufnahme zu viel. Deshalb wartet der erste Klick die
      Doppelklick-Spanne ab: kommt ein zweiter, war es das Fertigzeichen.
      Die Eingabetaste nimmt SOFORT auf, sie kann kein Doppelklick sein.
    */
    knopf.addEventListener('click', () => {
      if (vorbei) return
      if (klickWecker !== null) {
        clearTimeout(klickWecker)
        klickWecker = null
        schluss()
        return
      }
      klickWecker = setTimeout(() => {
        klickWecker = null
        void nimmAuf()
      }, DOPPELKLICK_SPANNE)
    })

    dokument.addEventListener('keydown', (e) => {
      if (vorbei) return
      if (e.key === 'Enter') {
        e.preventDefault()
        void nimmAuf()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        schluss()
      }
    })

    // Wer die Freigabe ueber die Browserleiste beendet oder das Mini-Fenster
    // schliesst, ist genauso fertig wie mit dem Doppelklick.
    for (const spur of strom.getVideoTracks()) {
      spur.addEventListener('ended', schluss)
    }
    if (miniFenster) {
      miniFenster.addEventListener('pagehide', schluss)
    }
  })
}

/**
 * Macht die Huelle in der Seite mit der Maus verschiebbar (nur der Rueckfall
 * ohne Mini-Fenster; das echte Mini-Fenster verschiebt der Betriebssystem-
 * Fensterrahmen selbst).
 *
 * @param {HTMLElement} ziel
 */
function macheZiehbar(ziel) {
  let fasstAn = false
  let abstandX = 0
  let abstandY = 0

  ziel.addEventListener('pointerdown', (e) => {
    // Der Knopf selbst bleibt Knopf; gezogen wird an der Huelle daneben.
    if (/** @type {HTMLElement} */ (e.target).closest('.miniknopf')) return
    fasstAn = true
    const kasten = ziel.getBoundingClientRect()
    abstandX = e.clientX - kasten.left
    abstandY = e.clientY - kasten.top
    ziel.setPointerCapture(e.pointerId)
  })
  ziel.addEventListener('pointermove', (e) => {
    if (!fasstAn) return
    ziel.style.setProperty('--mini-links', `${Math.max(0, e.clientX - abstandX)}px`)
    ziel.style.setProperty('--mini-oben', `${Math.max(0, e.clientY - abstandY)}px`)
  })
  ziel.addEventListener('pointerup', () => {
    fasstAn = false
  })
}

/**
 * Die Vorschau aller Aufnahmen, mit dem Knopf "Analysieren".
 *
 * Karam: "oeffnet sich das Programm dann wieder und hat eine Preview von
 * allen Screenshots. Und dann kann ich auf Analysieren druecken."
 *
 * Einzelne Aufnahmen lassen sich vorher wegwerfen: ein danebengegangener
 * Schuss soll nicht mitgelesen werden. Loest mit den behaltenen Dateien auf,
 * mit null beim Verwerfen.
 *
 * @param {File[]} dateien
 * @param {string} wohin  Ein ehrlicher Satz, wo die Scheine landen werden.
 * @returns {Promise<File[]|null>}
 */
export function zeigeMassenVorschau(dateien, wohin) {
  return new Promise((erfuelle) => {
    /** @type {Set<number>} */
    const verworfen = new Set()
    /** @type {string[]} */
    const adressen = []

    const fenster = /** @type {HTMLDialogElement} */ (
      el('dialog.dialog.dialogfenster.massenvorschau', { 'aria-labelledby': 'massentitel' })
    )

    const titel = () =>
      `Massenausschnitt: ${dateien.length - verworfen.size} von ${dateien.length} Aufnahme(n) behalten`

    const ueberschrift = el('h2.dialogtitel', { id: 'massentitel', text: titel() })

    const kacheln = dateien.map((datei, i) => {
      const adresse = URL.createObjectURL(datei)
      adressen.push(adresse)
      const bild = el('img.massenbild', { src: adresse, alt: `Aufnahme ${i + 1}` })
      const kachel = el('.massenkachel', { daten: { weg: 'false' } }, [
        bild,
        el('span.massennummer', { text: String(i + 1) }),
        el('button.knopf.knopf-winzig.massenweg', {
          type: 'button',
          text: 'wegwerfen',
          title: 'Diese Aufnahme nicht mitlesen.',
          onclick: () => {
            if (verworfen.has(i)) verworfen.delete(i)
            else verworfen.add(i)
            kachel.dataset.weg = String(verworfen.has(i))
            const knopfEl = kachel.querySelector('.massenweg')
            if (knopfEl) knopfEl.textContent = verworfen.has(i) ? 'doch behalten' : 'wegwerfen'
            ueberschrift.textContent = titel()
          },
        }),
      ])
      return kachel
    })

    let geantwortet = false
    /** @param {File[]|null} ergebnis */
    const antworte = (ergebnis) => {
      if (geantwortet) return
      geantwortet = true
      for (const adresse of adressen) URL.revokeObjectURL(adresse)
      if (fenster.open) fenster.close()
      fenster.remove()
      erfuelle(ergebnis)
    }

    const formular = el('form.dialoginhalt', { method: 'dialog' }, [
      ueberschrift,
      el('p.dialogtext', { text: wohin }),
      el('.massenreihe', {}, kacheln),
      el('.dialogknoepfe', {}, [
        el('button.knopf', {
          type: 'button',
          text: 'Alles verwerfen',
          onclick: () => antworte(null),
        }),
        el('button.knopf.knopf-haupt', { type: 'submit', text: 'Analysieren' }),
      ]),
    ])

    formular.addEventListener('submit', (e) => {
      e.preventDefault()
      antworte(dateien.filter((_, i) => !verworfen.has(i)))
    })
    fenster.addEventListener('cancel', (e) => {
      e.preventDefault()
      antworte(null)
    })

    fuelleFenster(fenster, formular)
    document.body.append(fenster)
    fenster.showModal()
  })
}

/**
 * @param {HTMLDialogElement} fenster
 * @param {HTMLElement} inhalt
 */
function fuelleFenster(fenster, inhalt) {
  fenster.replaceChildren(inhalt)
}
