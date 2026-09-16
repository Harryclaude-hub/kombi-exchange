// @ts-check
/**
 * Ansicht "Ablage".
 *
 * Karam am 14.09.2026: "Ein System wie beim Explorer, wo man all die Scheine
 * und die Kombis hat. Man kann hin und her verschieben, es soll uebersichtlich
 * sein, man soll Sachen anpinnen koennen, alles ist mit Datum beschriftet und
 * man kann es umbenennen."
 *
 * AUFBAU
 *
 *   Links   die Ordner. "Alle", "Angepinnt", dann jeder Ordner mit Anzahl.
 *   Rechts  die Projekte des gewaehlten Ordners, mit Datum und Groesse.
 *   Unten   der Inhalt des offenen Projekts: Riesenscheine und ihre Scheine.
 *
 * WAS EIN ORDNER HIER IST
 *
 * Nur ein Name, unter dem Projekte zusammenstehen. Verschieben heisst: das
 * Textfeld am Projekt aendern. Es gibt keine Ordner-Tabelle und keine Ordner
 * in Ordnern. Warum, steht in supabase/migrations/0008.
 *
 * Ein Ordner existiert, solange mindestens ein Projekt darin liegt. Ein leerer
 * Ordner verschwindet also von selbst. Das ist Absicht: sonst muesste man
 * Ordner auch loeschen koennen, und ein leerer Ordner, den man vergessen hat,
 * ist nur Unordnung.
 *
 * WAS DIESE DATEI NICHT TUT
 *
 * Sie rechnet nichts. Alle Zahlen kommen aus kern/rechnung.js. Sie setzt auch
 * keine Farben und keine Groessen, das steht in stil/.
 */

import { el, fuelle, zeitText, anbieterzeichen } from './werkzeug.js'
import { formatiere, formatiereQuote } from '../kern/geld.js'
import { barEinsatz, realisierterRueckfluss, offenePotenzialauszahlung } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'

/**
 * Die Kennung des Pseudo-Ordners "Angepinnt".
 *
 * Sie muss sich von jedem echten Ordnernamen unterscheiden, den Karam tippen
 * koennte. Frueher stand hier ein rohes Null-Byte in der Zeichenkette. Das war
 * gueltiges JavaScript, machte die Datei aber fuer grep, file und git zu einer
 * BINAERDATEI: jede Textsuche im Projekt ging still an ihr vorbei, und git
 * zeigte nur "Bin 0 -> 16263 bytes" statt eines Unterschieds.
 *
 * Zwei Unterstriche vorn und hinten sind genauso eindeutig und bleiben Text.
 */
const ORDNER_ANGEPINNT = '__angepinnt__'

/**
 * Welche Projekte gerade zum Loeschen angehakt sind.
 *
 * Wie bei den grossen Bildern: reine Ansichtssache, deshalb hier im Modul und
 * nicht im Zustand. Sie ueberlebt das Neuzeichnen und verschwindet, wenn die
 * Seite geschlossen wird.
 *
 * @type {Set<string>}
 */
const gewaehlteProjekte = new Set()

/**
 * Loescht Projekte, nach einer Rueckfrage, die die Namen nennt.
 *
 * DIE RUECKFRAGE NENNT DIE NAMEN, nicht nur die Anzahl. "3 Projekte loeschen?"
 * beantwortet man mit ja, ohne zu wissen, welche drei. Bei einer Saison mit
 * zwanzigtausend Euro Einsatz ist das die falsche Frage.
 *
 * Geloescht wird in app.js, nicht hier: diese Ansicht speichert nichts selbst,
 * sonst gaebe es zwei Stellen, die Projekte schreiben, und die driften
 * auseinander (Projektregel 8).
 *
 * @param {import('../kern/typen.js').Projekt[]} projekte
 */
function loescheProjekte(projekte) {
  if (projekte.length === 0) return

  const namen = projekte.map((p) => p.name || 'ohne Namen')
  const liste = namen.length <= 6 ? namen.join(', ') : `${namen.slice(0, 6).join(', ')} und ${namen.length - 6} weitere`
  const frage =
    projekte.length === 1
      ? `"${namen[0]}" wirklich loeschen?\n\nAlle Scheine, Riesenscheine und Bilder dieses Projekts gehen mit. Das laesst sich nicht rueckgaengig machen.`
      : `${projekte.length} Projekte wirklich loeschen?\n\n${liste}\n\nAlle Scheine, Riesenscheine und Bilder dieser Projekte gehen mit. Das laesst sich nicht rueckgaengig machen.`

  if (!window.confirm(frage)) return

  for (const p of projekte) gewaehlteProjekte.delete(p.id)
  window.dispatchEvent(
    new CustomEvent('kombi-projekte-loeschen', { detail: { ids: projekte.map((p) => p.id) } })
  )
}


/**
 * Welcher Ordner links gewaehlt ist.
 *
 * Steht NUR im Speicher, nicht in der Datenbank. Es ist eine Ansichtssache,
 * kein Eigentum des Projekts: wer die Seite neu laedt, faengt bei "Alle" an,
 * und das ist richtig so.
 *
 * @type {string|null}  null heisst "Alle", '' heisst "ohne Ordner"
 */
let gewaehlterOrdner = null

/** Suchtext. Ebenfalls nur Ansicht. */
let suche = ''

/** Wonach sortiert wird. */
let sortierung = 'geaendert'

/**
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  const stand = Zustand.hole()
  const projekte = stand.projekte ?? []

  // Jede Aenderung baut die ganze Ansicht neu. Das Suchfeld ist danach ein
  // ANDERES Element, und damit waere der Fokus nach jedem getippten Zeichen
  // weg: man koennte genau einen Buchstaben eingeben. Deshalb wird gemerkt, ob
  // der Fokus darin lag, und danach wiederhergestellt.
  const hatteFokus =
    document.activeElement instanceof HTMLElement &&
    document.activeElement.classList.contains('ablage-suche')

  fuelle(ziel, [
    erklaerzeile(),
    kopfleiste(projekte),
    el('.ablage-raster', {}, [ordnerspalte(projekte), projektspalte(projekte, stand)]),
    inhalt(stand),
  ])

  if (hatteFokus) {
    const feld = ziel.querySelector('.ablage-suche')
    if (feld instanceof HTMLInputElement) {
      feld.focus()
      // Der Schreibzeiger gehoert ans Ende, sonst springt er bei jedem
      // Zeichen an den Anfang.
      feld.setSelectionRange(feld.value.length, feld.value.length)
    }
  }
}

/**
 * @param {import('../kern/typen.js').Projekt[]} projekte
 */
function kopfleiste(projekte) {
  const feld = el('input.ablage-suche', {
    type: 'text',
    placeholder: 'Suchen ...',
    value: suche,
  })
  feld.addEventListener('input', () => {
    suche = /** @type {HTMLInputElement} */ (feld).value
    neuZeichnen()
  })

  const wahl = el('select.ablage-sortierung', {})
  for (const [wert, name] of [
    ['geaendert', 'Zuletzt geaendert'],
    ['angelegt', 'Angelegt'],
    ['name', 'Name'],
  ]) {
    wahl.append(el('option', { value: wert, text: name, selected: wert === sortierung ? 'selected' : null }))
  }
  wahl.addEventListener('change', () => {
    sortierung = /** @type {HTMLSelectElement} */ (wahl).value
    neuZeichnen()
  })

  return el('.ablage-kopf', {}, [
    el('.ablage-titel', { text: 'Ablage' }),
    el('.ablage-zahl', { text: `${projekte.length} Projekt(e)` }),
    feld,
    wahl,
  ])
}

/**
 * Die Ordnerliste links.
 *
 * @param {import('../kern/typen.js').Projekt[]} projekte
 */
function ordnerspalte(projekte) {
  /** @type {Map<string, number>} */
  const zaehler = new Map()
  for (const p of projekte) {
    const o = p.ordner ?? ''
    zaehler.set(o, (zaehler.get(o) ?? 0) + 1)
  }
  const angepinnt = projekte.filter((p) => p.angepinnt === true).length

  const eintraege = []
  eintraege.push(ordnerzeile(null, 'Alle', projekte.length, false))
  if (angepinnt > 0) eintraege.push(ordnerzeile(ORDNER_ANGEPINNT, 'Angepinnt', angepinnt, false))
  if ((zaehler.get('') ?? 0) > 0) eintraege.push(ordnerzeile('', 'Ohne Ordner', zaehler.get('') ?? 0, true))

  for (const name of [...zaehler.keys()].filter((o) => o !== '').sort((a, b) => a.localeCompare(b, 'de'))) {
    eintraege.push(ordnerzeile(name, name, zaehler.get(name) ?? 0, true))
  }

  return el('.ablage-ordner', {}, [
    el('.ablage-spaltentitel', { text: 'Ordner' }),
    el('.ordnerliste', {}, eintraege),
    el('p.ablage-hinweis', {
      text: 'Ein Projekt mit der Maus auf einen Ordner ziehen verschiebt es. Ein Ordner ohne Projekte verschwindet von selbst.',
    }),
  ])
}

/**
 * @param {string|null} schluessel
 * @param {string} name
 * @param {number} anzahl
 * @param {boolean} zielFuerAblegen
 */
function ordnerzeile(schluessel, name, anzahl, zielFuerAblegen) {
  const aktiv = gewaehlterOrdner === schluessel

  // Ein ECHTER Ordner laesst sich loeschen. "Alle", "Angepinnt" und "Ohne
  // Ordner" sind keine Ordner, sondern Sichten: sie haben keinen Namen, den
  // man entfernen koennte.
  const echterOrdner = typeof schluessel === 'string' && schluessel !== '' && schluessel !== ORDNER_ANGEPINNT

  const wegKnopf = echterOrdner
    ? el('button.ordnerweg', {
        type: 'button',
        text: 'Löschen',
        title: `Den Ordner "${name}" aufloesen. Die Projekte bleiben.`,
      })
    : null
  if (wegKnopf) {
    wegKnopf.addEventListener('click', async (e) => {
      e.stopPropagation()
      await loescheOrdner(String(schluessel), anzahl)
    })
  }

  const zeile = el('.ordnerzeile', { daten: { aktiv: String(aktiv) } }, [
    el('.ordnername', { text: name }),
    el('.ordnerzahl', { text: String(anzahl) }),
    wegKnopf,
  ])

  zeile.addEventListener('click', () => {
    gewaehlterOrdner = schluessel
    neuZeichnen()
  })

  if (zielFuerAblegen) {
    zeile.addEventListener('dragover', (e) => {
      e.preventDefault()
      zeile.classList.add('ordner-bereit')
    })
    zeile.addEventListener('dragleave', () => zeile.classList.remove('ordner-bereit'))
    zeile.addEventListener('drop', async (e) => {
      e.preventDefault()
      zeile.classList.remove('ordner-bereit')
      const id = /** @type {DragEvent} */ (e).dataTransfer?.getData('text/plain') ?? ''
      if (id) await verschiebe(id, schluessel ?? '')
    })
  }

  return zeile
}

/**
 * Die Projektliste rechts.
 *
 * @param {import('../kern/typen.js').Projekt[]} projekte
 * @param {any} stand
 */
function projektspalte(projekte, stand) {
  let liste = projekte.slice()

  if (gewaehlterOrdner === ORDNER_ANGEPINNT) liste = liste.filter((p) => p.angepinnt === true)
  else if (gewaehlterOrdner !== null) liste = liste.filter((p) => (p.ordner ?? '') === gewaehlterOrdner)

  const suchtext = suche.trim().toLowerCase()
  if (suchtext !== '') {
    liste = liste.filter(
      (p) =>
        p.name.toLowerCase().includes(suchtext) ||
        (p.ordner ?? '').toLowerCase().includes(suchtext) ||
        (p.notiz ?? '').toLowerCase().includes(suchtext)
    )
  }

  liste.sort((a, b) => {
    // Angepinntes steht IMMER oben, egal wie sortiert wird. Das ist der Sinn
    // eines Pins.
    if ((a.angepinnt === true) !== (b.angepinnt === true)) return a.angepinnt === true ? -1 : 1
    if (sortierung === 'name') return a.name.localeCompare(b.name, 'de')
    if (sortierung === 'angelegt') return String(b.angelegtAm).localeCompare(String(a.angelegtAm))
    return String(b.geaendertAm).localeCompare(String(a.geaendertAm))
  })

  const neu = el('button.ablage-knopf', { type: 'button', text: 'Neuer Ordner' })
  neu.addEventListener('click', () => neuerOrdner())

  // Die Auswahlleiste. Sie erscheint erst, wenn wirklich etwas angehakt ist,
  // und nennt immer die Zahl. Sichtbar nur, was gerade in der Liste steht:
  // wer in einem Ordner auswaehlt und dann den Ordner wechselt, soll nicht aus
  // Versehen Projekte loeschen, die er gar nicht mehr sieht.
  const sichtbarGewaehlt = liste.filter((p) => gewaehlteProjekte.has(p.id))

  return el('.ablage-projekte', {}, [
    sichtbarGewaehlt.length > 0
      ? el('.auswahlleiste', {}, [
          el('span.auswahlzahl', {
            text:
              sichtbarGewaehlt.length === 1
                ? '1 Projekt ausgewaehlt'
                : `${sichtbarGewaehlt.length} Projekte ausgewaehlt`,
          }),
          (() => {
            const k = el('button.knopf.knopf-klein.knopf-weg', {
              type: 'button',
              text: sichtbarGewaehlt.length === 1 ? 'Ausgewähltes löschen' : 'Ausgewaehlte loeschen',
            })
            k.addEventListener('click', () => loescheProjekte(sichtbarGewaehlt))
            return k
          })(),
          (() => {
            const k = el('button.knopf.knopf-klein', { type: 'button', text: 'Auswahl aufheben' })
            k.addEventListener('click', () => {
              gewaehlteProjekte.clear()
              neuZeichnen()
            })
            return k
          })(),
          (() => {
            const k = el('button.knopf.knopf-klein', { type: 'button', text: 'Alle sichtbaren wählen' })
            k.addEventListener('click', () => {
              for (const p of liste) gewaehlteProjekte.add(p.id)
              neuZeichnen()
            })
            return k
          })(),
        ])
      : null,
    el('.ablage-spaltenkopf', {}, [
      el('.ablage-spaltentitel', {
        text:
          gewaehlterOrdner === null
            ? 'Alle Projekte'
            : gewaehlterOrdner === ORDNER_ANGEPINNT
              ? 'Angepinnt'
              : gewaehlterOrdner === ''
                ? 'Ohne Ordner'
                : gewaehlterOrdner,
      }),
      neu,
    ]),
    liste.length === 0
      ? el('p.ablage-hinweis', { text: 'Hier liegt nichts.' })
      : el('.projektliste', {}, liste.map((p) => projektzeile(p, stand))),
  ])
}

/**
 * @param {import('../kern/typen.js').Projekt} p
 * @param {any} stand
 */
function projektzeile(p, stand) {
  const offen = stand.projekt?.id === p.id

  // Das Kaestchen zum Auswaehlen. Es steht am Anfang der Zeile, damit man mit
  // dem Blick eine Spalte nach unten abhaken kann, statt jede Zeile einzeln zu
  // suchen. Ein Klick darauf darf das Projekt NICHT oeffnen, deshalb ueberall
  // stopPropagation.
  const kaestchen = el('input.projektkaestchen', {
    type: 'checkbox',
    checked: gewaehlteProjekte.has(p.id) ? 'checked' : null,
    title: 'Dieses Projekt auswählen',
  })
  kaestchen.addEventListener('click', (e) => e.stopPropagation())
  kaestchen.addEventListener('change', (e) => {
    const an = /** @type {HTMLInputElement} */ (e.target).checked
    if (an) gewaehlteProjekte.add(p.id)
    else gewaehlteProjekte.delete(p.id)
    neuZeichnen()
  })

  const name = el('.projektname', { text: p.name })
  // Doppelklick auf den Namen benennt um. Dasselbe wie im Dateimanager.
  name.addEventListener('dblclick', (e) => {
    e.stopPropagation()
    benenneUm(p)
  })

  const pin = el('button.projektpin', {
    type: 'button',
    title: p.angepinnt === true ? 'Nicht mehr anpinnen' : 'Anpinnen',
    text: p.angepinnt === true ? 'Angepinnt' : 'Anpinnen',
    daten: { an: String(p.angepinnt === true) },
  })
  pin.addEventListener('click', async (e) => {
    e.stopPropagation()
    await setzePin(p, !(p.angepinnt === true))
  })

  const umbenennen = el('button.projektknopf', { type: 'button', text: 'Umbenennen' })
  umbenennen.addEventListener('click', (e) => {
    e.stopPropagation()
    benenneUm(p)
  })

  const loeschen = el('button.projektknopf.knopf-weg', {
    type: 'button',
    text: 'Löschen',
    title: 'Dieses Projekt mit allen Scheinen und Bildern löschen',
  })
  loeschen.addEventListener('click', (e) => {
    e.stopPropagation()
    loescheProjekte([p])
  })

  const zeile = el(
    '.projektzeile',
    { daten: { offen: String(offen), gepinnt: String(p.angepinnt === true) }, draggable: 'true' },
    [
      kaestchen,
      el('.projektkopf', {}, [name, p.ordner ? el('.projektordner', { text: p.ordner }) : null]),
      el('.projektdatum', {
        text: `geaendert ${zeitText(p.geaendertAm)}`,
        title: `angelegt ${zeitText(p.angelegtAm)}`,
      }),
      el('.projektaktionen', {}, [pin, umbenennen, loeschen]),
    ]
  )

  zeile.addEventListener('click', () => oeffne(p))
  zeile.addEventListener('dragstart', (e) => {
    /** @type {DragEvent} */ (e).dataTransfer?.setData('text/plain', p.id)
    zeile.classList.add('projekt-zieht')
  })
  zeile.addEventListener('dragend', () => zeile.classList.remove('projekt-zieht'))

  return zeile
}

/**
 * Der Inhalt des offenen Projekts: Riesenscheine und ihre Scheine.
 *
 * Die Zahlen kommen aus kern/rechnung.js, hier wird nur dargestellt.
 *
 * @param {any} stand
 */
function inhalt(stand) {
  if (!stand.projekt) return null

  const riesen = stand.riesenscheine ?? []
  const scheine = stand.scheine ?? []

  if (scheine.length === 0) {
    return el('.ablage-inhalt', {}, [
      el('.ablage-spaltentitel', { text: `Inhalt von "${stand.projekt.name}"` }),
      el('p.ablage-hinweis', { text: 'In diesem Projekt liegt noch kein Schein.' }),
    ])
  }

  /** @type {Map<string, any[]>} */
  const nachRiesen = new Map()
  const lose = []
  for (const s of scheine) {
    if (s.gruppeId && riesen.some((/** @type {any} */ r) => r.id === s.gruppeId)) {
      const bisher = nachRiesen.get(s.gruppeId) ?? []
      bisher.push(s)
      nachRiesen.set(s.gruppeId, bisher)
    } else {
      lose.push(s)
    }
  }

  const bloecke = riesen
    .filter((/** @type {any} */ r) => (nachRiesen.get(r.id) ?? []).length > 0)
    .map((/** @type {any} */ r) => kombiblock(r.name, nachRiesen.get(r.id) ?? [], r.angelegtAm))

  if (lose.length > 0) {
    bloecke.push(kombiblock('Noch nicht zugeordnet', lose, ''))
  }

  return el('.ablage-inhalt', {}, [
    el('.ablage-spaltentitel', { text: `Inhalt von "${stand.projekt.name}"` }),
    ...bloecke,
  ])
}

/**
 * @param {string} titel
 * @param {any[]} scheine
 * @param {string} datum
 */
function kombiblock(titel, scheine, datum) {
  let einsatz = 0
  let moeglich = 0
  let zurueck = 0
  for (const s of scheine) {
    einsatz += barEinsatz(s)
    moeglich += offenePotenzialauszahlung(s).wert ?? 0
    zurueck += realisierterRueckfluss(s).wert ?? 0
  }
  const multiplikator = einsatz > 0 ? moeglich / einsatz : null

  // Waehrungen werden NICHT umgerechnet, und deshalb duerfen sie auch nicht
  // stillschweigend zusammengezaehlt werden. 181 Dollar plus 750 Euro sind
  // nicht 931. Der Multiplikator ist davon nicht betroffen, er ist ein
  // Verhaeltnis und kuerzt sich, solange jeder Schein in sich stimmt.
  const waehrungen = new Set(
    scheine.map((s) => s.waehrung?.wert ?? 'UNBEKANNT').filter((wg) => wg !== 'UNBEKANNT')
  )
  const gemischt = waehrungen.size > 1
  const eine = waehrungen.size === 1 ? [...waehrungen][0] : 'UNBEKANNT'

  return el('.kombiblock', {}, [
    el('.kombikopf', {}, [
      el('.kombititel', { text: titel }),
      datum ? el('.kombidatum', { text: zeitText(datum) }) : null,
      el('.kombizahl', { text: `${scheine.length} Schein(e)` }),
    ]),
    gemischt
      ? el('p.kombiwarnung', {
          text:
            `Hier stehen ${waehrungen.size} Waehrungen nebeneinander (${[...waehrungen].join(', ')}). ` +
            'Sie werden nicht umgerechnet, deshalb gibt es hier keine Summe. ' +
            'Der Multiplikator gilt trotzdem, er ist ein Verhältnis.',
        })
      : null,
    el('.kombisumme', {}, [
      summe('Einsatz', gemischt ? '-' : formatiere(einsatz, eine)),
      summe('moeglicher Gewinn', gemischt ? '-' : formatiere(moeglich, eine)),
      summe('Multiplikator', multiplikator === null ? '-' : formatiereQuote(multiplikator)),
      summe('zurueck', gemischt ? '-' : formatiere(zurueck, eine)),
    ]),
    el(
      '.scheinliste',
      {},
      scheine.map((s) =>
        el('.scheinzeile', {}, [
          el('.scheinanbieter', {}, [
            anbieterzeichen(s.buchmacher?.wert),
            el('span', { text: s.buchmacher?.wert ?? 'Anbieter unbekannt' }),
          ]),
          el('.scheinzahl', { text: formatiere(barEinsatz(s), s.waehrung?.wert ?? 'UNBEKANNT') }),
          el('.scheinzahl', {
            text: s.quoteDezimal?.wert === null ? '-' : formatiereQuote(s.quoteDezimal.wert),
          }),
          el('.scheinstand', { text: s.status }),
        ])
      )
    ),
  ])
}

/**
 * @param {string} name
 * @param {string} wert
 */
function summe(name, wert) {
  return el('.summenfeld', {}, [
    el('.summenname', { text: name }),
    el('.summenwert', { text: wert }),
  ])
}

// ---------------------------------------------------------------------------
// Was die Knoepfe tun
//
// Jede Aenderung geht ueber Zustand und ueber die Datenbank. Sie wird ERST
// gespeichert und dann angezeigt: wer es umgekehrt macht, sieht eine Aenderung,
// die es nie gegeben hat, und merkt es erst beim naechsten Laden.
// ---------------------------------------------------------------------------

function neuZeichnen() {
  // Ein leeres aendere() weckt alle Zuhoerer, ohne etwas zu veraendern.
  Zustand.aendere({})
}

/** @param {import('../kern/typen.js').Projekt} p */
function oeffne(p) {
  const stand = Zustand.hole()
  if (stand.projekt?.id === p.id) return
  // Das eigentliche Umschalten macht app.js, weil dort die Daten nachgeladen
  // werden. Hier wird nur der Wunsch gemeldet.
  window.dispatchEvent(new CustomEvent('kombi-projekt-oeffnen', { detail: { id: p.id } }))
}

/** @param {import('../kern/typen.js').Projekt} p */
function benenneUm(p) {
  const neu = window.prompt('Neuer Name fuer dieses Projekt:', p.name)
  if (neu === null) return
  const sauber = neu.trim()
  if (sauber === '' || sauber === p.name) return
  speichere({ ...p, name: sauber })
}

/**
 * @param {import('../kern/typen.js').Projekt} p
 * @param {boolean} an
 */
function setzePin(p, an) {
  return speichere({ ...p, angepinnt: an })
}

/**
 * @param {string} projektId
 * @param {string} ordner
 */
/**
 * Loest einen Ordner auf. Die Projekte darin bleiben erhalten.
 *
 * WARUM DIE PROJEKTE BLEIBEN
 *
 * Ein Ordner ist hier kein Behaelter, sondern nur ein Name am Projekt (siehe
 * den Kopf dieser Datei und supabase/migrations/0008). Ihn zu loeschen heisst
 * deshalb: den Namen von allen Projekten entfernen. Die Projekte wandern nach
 * "Ohne Ordner" und sind vollstaendig da.
 *
 * Das ist die sichere Lesart, und sie ist hier die richtige: einen Ordner
 * raeumt man auf, weil die Einteilung nicht mehr passt, nicht weil die
 * Wettscheine darin wertlos geworden sind. Wer die Projekte wirklich los sein
 * will, waehlt sie rechts an und drueckt "Ausgewaehlte loeschen". Dafuer gibt
 * es die Mehrfachauswahl.
 *
 * @param {string} name
 * @param {number} anzahl
 */
async function loescheOrdner(name, anzahl) {
  const frage =
    anzahl === 0
      ? `Den Ordner "${name}" aufloesen?`
      : `Den Ordner "${name}" aufloesen?\n\n` +
        `${anzahl === 1 ? 'Das Projekt darin wandert' : `Die ${anzahl} Projekte darin wandern`} nach ` +
        '"Ohne Ordner". Es wird nichts gelöscht.\n\n' +
        'Sollen die Projekte selbst weg, wähle sie rechts an und nimm "Ausgewählte löschen".'
  if (!window.confirm(frage)) return

  const betroffen = (Zustand.hole().projekte ?? []).filter((p) => (p.ordner ?? '') === name)
  for (const p of betroffen) speichere({ ...p, ordner: '' })

  // Der aufgeloeste Ordner darf nicht gewaehlt bleiben, sonst steht die Liste
  // rechts leer da und niemand weiss, warum.
  if (gewaehlterOrdner === name) gewaehlterOrdner = null
  neuZeichnen()
  Zustand.melde(
    'erfolg',
    betroffen.length === 0
      ? `Ordner "${name}" aufgeloest.`
      : `Ordner "${name}" aufgeloest, ${betroffen.length} Projekt(e) stehen jetzt unter "Ohne Ordner".`
  )
}

function verschiebe(projektId, ordner) {
  const p = (Zustand.hole().projekte ?? []).find((x) => x.id === projektId)
  if (!p) return
  if ((p.ordner ?? '') === ordner) return
  return speichere({ ...p, ordner })
}

function neuerOrdner() {
  const name = window.prompt('Name des neuen Ordners:')
  if (name === null) return
  const sauber = name.trim()
  if (sauber === '') return

  // Ein Ordner ohne Projekt gibt es nicht. Deshalb wird gleich gefragt, was
  // hinein soll, statt einen leeren Ordner anzulegen, der beim naechsten Laden
  // wieder weg waere.
  const stand = Zustand.hole()
  if (!stand.projekt) {
    Zustand.melde('warnung', 'Es ist kein Projekt offen, das in den Ordner könnte.')
    return
  }
  if (
    !window.confirm(
      `Ordner "${sauber}" anlegen und das offene Projekt "${stand.projekt.name}" hineinlegen?\n\n` +
        'Ein Ordner besteht nur, solange ein Projekt darin liegt.'
    )
  ) {
    return
  }
  gewaehlterOrdner = sauber
  speichere({ ...stand.projekt, ordner: sauber })
}

/**
 * Speichert ein geaendertes Projekt und zieht die Anzeige nach.
 *
 * @param {import('../kern/typen.js').Projekt} projekt
 */
function speichere(projekt) {
  window.dispatchEvent(new CustomEvent('kombi-projekt-speichern', { detail: { projekt } }))
}

/**
 * Zwei Saetze darueber, wozu diese Seite da ist.
 *
 * Karam am 16.09.2026: "Ausgabe, Ablage bitte mehr erklaeren, was das ist."
 *
 * Besonders die Frage, was ein Projekt und was ein Ordner ist, laesst sich
 * nicht raten: ein Ordner ist hier keine eigene Sache, sondern nur eine
 * Beschriftung am Projekt. Wer das nicht weiss, sucht einen Knopf "Ordner
 * anlegen", den es nicht gibt und nicht geben muss.
 *
 * @returns {HTMLElement}
 */
function erklaerzeile() {
  return el('.erklaerzeile', {}, [
    el('.erklaerzeile-titel', { text: 'Was diese Seite ist' }),
    el('p.erklaerzeile-text', {
      text:
        'Dein Archiv. Ein PROJEKT ist ein eigener Arbeitsplatz: alles, was du darin setzt, mit ' +
        'allen Fotos, Scheinen und Riesenscheinen. Es darf eine Woche umfassen oder eine ganze ' +
        'Saison. Ein ORDNER ist nur eine Schublade für Projekte: er entsteht, sobald du ein ' +
        'Projekt hineinziehst, und verschwindet von selbst, wenn du das letzte herausnimmst. Du ' +
        'musst ihn nicht anlegen und nicht aufraeumen.',
    }),

    /*
      DIE TRENNUNG ZWISCHEN PROJEKTEN, ausdruecklich hingeschrieben.

      Karam am 16.09.2026: "Projekte sind komplett anders voneinander. Das sind
      die klaren Trennungen, und das ist in der Datenbank und auch im
      Verstaendnis der App sehr wichtig."

      Es stimmt auch so: in kombi.riesenscheine, kombi.scheine und kombi.bilder
      steht je eine projekt_id mit on delete cascade. Nichts wird ueber
      Projektgrenzen hinweg gerechnet, und rechneProjekt sieht nur die
      Riesenscheine des offenen Projekts. Wer das nicht weiss, sucht Zahlen an
      der falschen Stelle.
    */
    el('.erklaerzeile-trennung', {}, [
      el('strong', { text: 'Projekte haben nichts miteinander zu tun. ' }),
      'Jedes ist ein eigener Arbeitsplatz, wie ein zweiter Schreibtisch. Keine Zahl, kein ' +
        'Schein und kein Bild wandert von einem ins andere, und es wird nie über Projekte ' +
        'hinweg summiert. Ordner dagegen liegen INNERHALB der Ablage und ordnen nur, sie ' +
        'trennen nicht.',
    ]),
  ])
}
