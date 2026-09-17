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

import { el, fuelle, zeitText, anbieterzeichen, ausschnittbild } from './werkzeug.js'
import { tonFuer } from './ordner.js'
import { formatiere, formatiereQuote } from '../kern/geld.js'
import { barEinsatz, realisierterRueckfluss, offenePotenzialauszahlung } from '../kern/rechnung.js'
// Der Stand eines Scheins steht in der Datenbank als Schluessel, also
// "halb_gewonnen" oder "cashout". Auf dem Bildschirm gehoert der Satz hin,
// den ein Mensch liest. Die Uebersetzung gibt es genau einmal, in mosaik.js
// (Projektregel 8).
import { statusText } from '../bild/mosaik.js'
import * as Zustand from './zustand.js'
// Eigene Fenster statt window.prompt und window.confirm, siehe
// oberflaeche/dialog.js. Karam am 17.09.2026: "diese Pop-Ups vom Browser
// oben, das mag ich gar nicht."
import * as Dialog from './dialog.js'
import { aufbaukette } from './aufbau.js'

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

  Dialog.bestaetige({
    titel:
      projekte.length === 1
        ? `"${namen[0]}" wirklich löschen?`
        : `${projekte.length} Projekte wirklich löschen?`,
    text: projekte.length === 1 ? '' : liste,
    punkte: [
      'Alle Scheine, alle Riesenscheine und alle Bilder darin gehen mit.',
      'Das lässt sich nicht rückgängig machen.',
      'Willst du nur aufräumen, nimm stattdessen "In Ordner legen".',
    ],
    ja: projekte.length === 1 ? 'Endgültig löschen' : `${projekte.length} endgültig löschen`,
    gefahr: true,
  }).then((ja) => {
    if (!ja) return
    for (const p of projekte) gewaehlteProjekte.delete(p.id)
    window.dispatchEvent(
      new CustomEvent('kombi-projekte-loeschen', { detail: { ids: projekte.map((p) => p.id) } })
    )
  })
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
    ['geaendert', 'Zuletzt geändert'],
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
      text:
        'Ein Ordner ist nur eine Beschriftung am Projekt. Mit "In Ordner legen" an der ' +
        'Zeile rechts kommt ein Projekt hinein, mit der Maus geht es auch: Zeile auf einen ' +
        'Ordner ziehen. Ein Ordner ohne Projekte verschwindet von selbst.',
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

  /*
    KEIN KNOPF "NEUER ORDNER" MEHR, seit dem 17.09.2026.

    Er stand hier ueber der Projektliste und legte das GERADE OFFENE Projekt in
    den neuen Ordner. Nicht das, in dessen Zeile man stand, sondern das offene.
    Das ist zweierlei, und an keiner Stelle stand, welches gemeint ist. Ohne
    offenes Projekt tat er gar nichts und meldete das erst hinterher.

    Ein Ordner entsteht jetzt dort, wo er hingehoert: an der Zeile, mit "In
    Ordner legen". Es gibt ohnehin keinen leeren Ordner, also auch nichts
    anzulegen, bevor etwas darin liegt.
  */

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
                ? '1 Projekt ausgewählt'
                : `${sichtbarGewaehlt.length} Projekte ausgewählt`,
          }),
          (() => {
            const k = el('button.knopf.knopf-klein.knopf-weg', {
              type: 'button',
              text: sichtbarGewaehlt.length === 1 ? 'Ausgewähltes löschen' : 'Ausgewählte löschen',
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

  /*
    EIN KNOPF, DER OEFFNET, seit dem 17.09.2026.

    Karam: "dass die Knoepfe sich sehr, sehr leicht verstehen lassen."

    Die ganze Zeile hat schon immer geoeffnet, wenn man sie anklickt. Nur stand
    das nirgends. Wer eine Zeile mit einem Kaestchen, einer Nadel und drei
    Knoepfen vor sich hat, drueckt nicht auf die Luft dazwischen. Der Weg, um
    den es hier geht, war der einzige ohne Beschriftung.

    Die Zeile oeffnet weiterhin, der Knopf ist der SICHTBARE Weg, nicht der
    einzige.
  */
  const oeffnen = offen
    ? el('span.projektoffen', { text: 'Offen', title: 'Dieses Projekt ist gerade geöffnet.' })
    : el('button.projektknopf.projektknopf-haupt', {
        type: 'button',
        text: 'Öffnen',
        title: `Wechselt zu "${p.name}". Alles, was du danach siehst, gehört zu diesem Projekt.`,
      })
  if (oeffnen instanceof HTMLButtonElement) {
    oeffnen.addEventListener('click', (e) => {
      e.stopPropagation()
      oeffne(p)
    })
  }

  /*
    ORDNER SETZEN OHNE MAUS.

    Verschoben wurde bisher NUR mit der Maus, indem man die Zeile auf einen
    Ordner zog. Auf einem Handy gibt es das nicht, und Karams Kollege arbeitet
    am Telefon. Der Knopf hier tut dasselbe und ruft dieselbe Funktion
    (Projektregel 8). Das Ziehen bleibt, es ist schneller, wenn man eine Maus
    hat.
  */
  const ordnern = el('button.projektknopf', {
    type: 'button',
    text: p.ordner ? 'Ordner ändern' : 'In Ordner legen',
    title: p.ordner
      ? `Liegt im Ordner "${p.ordner}". Leeren nimmt es wieder heraus.`
      : 'Legt dieses Projekt in einen Ordner. Gibt es den Namen noch nicht, entsteht der Ordner dabei.',
  })
  ordnern.addEventListener('click', (e) => {
    e.stopPropagation()
    const bekannte = [
      ...new Set((Zustand.hole().projekte ?? []).map((x) => x.ordner ?? '').filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'de'))
    Dialog.frage({
      titel: p.ordner ? 'Ordner ändern' : 'Projekt in einen Ordner legen',
      text: `Wohin soll das Projekt "${p.name}"?`,
      punkte: [
        'Hier geht es um Ordner für PROJEKTE, nicht für Riesenscheine.',
        'Ein Ordner ist nur eine Beschriftung. Er besteht, solange ein Projekt darin liegt.',
        'Leer lassen heißt: in keinen Ordner.',
        bekannte.length > 0 ? `Schon da: ${bekannte.join(', ')}` : 'Bisher gibt es keinen Ordner.',
      ],
      felder: [
        {
          name: 'ordner',
          beschriftung: 'Ordnername',
          wert: p.ordner ?? '',
          platzhalter: 'leer lassen: ohne Ordner',
          vorschlaege: bekannte,
        },
      ],
      ja: 'Übernehmen',
    }).then((antwort) => {
      if (antwort === null) return
      verschiebe(p.id, antwort.ordner)
    })
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
    {
      // Der Ton haengt am Projektnamen, genau wie bei den Ordnern.
      // Siehe oberflaeche/ordner.js, tonFuer().
      daten: { offen: String(offen), gepinnt: String(p.angepinnt === true), ton: tonFuer(p.name) },
      draggable: 'true',
    },
    [
      kaestchen,
      /*
        HIESS BIS ZUM 17.09.2026 .projektkopf, genau wie der Block mit den
        Projektsummen ueber den Riesenscheinen. Zwei verschiedene Sachen mit
        demselben Namen, und in bauteile.css stand die Regel von hier WEITER
        UNTEN: sie hat den anderen Block von einem Raster in eine Zeile
        verwandelt.

        Gemessen am 17.09.2026 bei 375 Pixeln Breite: die drei Projektzahlen
        standen als 38 Pixel breite Saeulen nebeneinander, ein Buchstabe je
        Zeile. Breit fiel es nicht auf, weil eine Zeile dort aussieht wie ein
        Raster.
      */
      el('.projektzeilenkopf', {}, [name, p.ordner ? el('.projektordner', { text: p.ordner }) : null]),
      el('.projektdatum', {
        text: `geändert ${zeitText(p.geaendertAm)}`,
        title: `angelegt ${zeitText(p.angelegtAm)}`,
      }),
      el('.projektaktionen', {}, [oeffnen, ordnern, pin, umbenennen, loeschen]),
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
            `Hier stehen ${waehrungen.size} Währungen nebeneinander (${[...waehrungen].join(', ')}). ` +
            'Sie werden nicht umgerechnet, deshalb gibt es hier keine Summe. ' +
            'Der Multiplikator gilt trotzdem, er ist ein Verhältnis.',
        })
      : null,
    el('.kombisumme', {}, [
      summe('Einsatz', gemischt ? '-' : formatiere(einsatz, eine)),
      summe('Möglicher Gewinn', gemischt ? '-' : formatiere(moeglich, eine)),
      summe('Multiplikator', multiplikator === null ? '-' : formatiereQuote(multiplikator)),
      summe('Zurückgekommen', gemischt ? '-' : formatiere(zurueck, eine)),
    ]),
    el(
      '.scheinliste',
      {},
      scheine.map((s) =>
        el('.scheinzeile', {}, [
          // Auch hier das Bild, klein. Karam am 17.09.2026: "dass man immer die
          // Bilder daneben hat."
          el('.scheinminibild', {}, [
            ausschnittbild(Zustand.hole().bilder.get(s.bildId), s.ausschnitt),
          ]),
          el('.scheinanbieter', {}, [
            anbieterzeichen(s.buchmacher?.wert),
            el('span', { text: s.buchmacher?.wert ?? 'Anbieter unbekannt' }),
          ]),
          el('.scheinzahl', { text: formatiere(barEinsatz(s), s.waehrung?.wert ?? 'UNBEKANNT') }),
          el('.scheinzahl', {
            text: s.quoteDezimal?.wert === null ? '-' : formatiereQuote(s.quoteDezimal.wert),
          }),
          el('.scheinstand', { text: statusText(s.status) }),
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
  Dialog.frage({
    titel: 'Projekt umbenennen',
    punkte: [
      'Nur der Name ändert sich. Scheine, Riesenscheine und Bilder bleiben, wie sie sind.',
      'Der Name steht danach überall: oben in der Kopfzeile und an jedem Riesenschein.',
    ],
    felder: [{ name: 'name', beschriftung: 'Neuer Name', wert: p.name }],
    ja: 'Umbenennen',
  }).then((antwort) => {
    if (antwort === null) return
    const sauber = antwort.name.trim()
    if (sauber === '' || sauber === p.name) return
    speichere({ ...p, name: sauber })
  })
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
  const ja = await Dialog.bestaetige({
    titel: `Den Ordner "${name}" auflösen?`,
    punkte:
      anzahl === 0
        ? ['In diesem Ordner liegt nichts. Es verschwindet nur die Beschriftung.']
        : [
            `${anzahl === 1 ? 'Das Projekt darin wandert' : `Die ${anzahl} Projekte darin wandern`} nach "Ohne Ordner".`,
            'ES WIRD NICHTS GELÖSCHT. Kein Schein, kein Bild, kein Projekt.',
            'Sollen die Projekte selbst weg, wähle sie rechts an und nimm "Ausgewählte löschen".',
          ],
    ja: 'Ordner auflösen',
  })
  if (!ja) return

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
        'musst ihn nicht anlegen und nicht aufräumen.',
    }),

    /*
      ACHTUNG, ZWEI VERSCHIEDENE ORDNER.

      Hier ordnen Ordner PROJEKTE. Bei den Riesenscheinen ordnen Ordner
      RIESENSCHEINE. Dasselbe Wort, zwei Ebenen, und genau davor hatte Karam am
      17.09.2026 Angst: "Ich habe einfach Angst, dass das nicht funktioniert."
      Deshalb steht die ganze Kette hier daneben, und der Satz darunter sagt,
      welche Stufe gerade gemeint ist.
    */
    aufbaukette(),
    el('p.erklaerzeile-text', {
      text:
        'Auf DIESER Seite ordnen die Ordner Projekte. Die Ordner für Riesenscheine ' +
        'sind etwas anderes und liegen im Reiter Riesenscheine, innerhalb eines Projekts.',
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
