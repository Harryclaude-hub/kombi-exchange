// @ts-check
/**
 * Trainingsseite: echte Bildschirmfotos einlesen, pruefen, berichtigen,
 * und daraus dauerhafte Pruefaelle machen.
 *
 * WOZU
 *
 * Das Leseprogramm laesst sich nur an echten Bildern verbessern. Nachgebaute
 * Bilder haben immer die Schrift, die Aufloesung und die Kantenglaettung
 * dessen, der sie gebaut hat, und genau daran scheitert eine Texterkennung
 * nicht. Sie scheitert an dem, was der echte Buchmacher wirklich hinschreibt.
 *
 * WIE ES LAEUFT
 *
 *   1. Bilder holen: aus `.arbeit/fotos/` oder ueber den Auswahldialog.
 *   2. Die Seite laesst den GANZEN echten Weg darueber laufen: Zerlegung in
 *      Karten, Anbietererkennung, Texterkennung, Auswertung. Nicht nachgebaut,
 *      sondern dieselben Bausteine, die die Anwendung benutzt.
 *   3. Es zeigt, was herauskam, und was es sich dabei gedacht hat.
 *   4. Was falsch ist, wird berichtigt. Jeder Schein wird abgehakt.
 *   5. "Als Pruefaelle sichern" legt eine Datei ab, die nach test/ gehoert.
 *
 * WAS DABEI GESICHERT WIRD
 *
 * NICHT das Bild, sondern die Textzeilen, die die Texterkennung daraus gemacht
 * hat, zusammen mit der berichtigten Wahrheit. Das hat zwei Vorteile: die
 * Pruefaelle laufen danach in Sekunden in node statt in Minuten im Browser,
 * und es verlaesst kein Bild das Geraet.
 *
 * WAS DAS TRAINING NICHT IST
 *
 * Hier wird kein neuronales Netz nachtrainiert. "Trainieren" heisst hier:
 * jeder Fehler, den ein echtes Bild zeigt, wird zu einem Pruefall, der ab dann
 * fuer immer geprueft wird. Das Programm wird dadurch messbar besser und kann
 * nicht wieder schlechter werden, ohne dass es auffaellt.
 *
 * DIE REGELN, DIE DIESE SEITE EINHAELT
 *
 * Sie sind aus echten Fehlern entstanden, siehe UEBERGABE.md:
 *
 *   Eine Berichtigung, die nicht ankommt, ist schlimmer als keine. Deshalb
 *   sind die Zahlenfelder Textfelder mit eigener Umwandlung ueber
 *   kern/zahlen.js, und was sich nicht deuten laesst, bleibt sichtbar rot
 *   stehen statt still zu verschwinden.
 *
 *   Was niemand angesehen hat, ist keine Wahrheit. Jeder Schein braucht den
 *   Haken "durchgesehen", sonst wandert er als uebersprungen in die Datei.
 *
 *   "Hier steht in Wahrheit nichts" muss sich sagen lassen, sonst friert ein
 *   erfundener Wert fuer immer als Sollwert ein.
 *
 *   Aussortiertes bleibt sichtbar. Karten ohne Text, misslungene Bilder und
 *   jede Meldung aus dem Leseweg stehen auf der Seite.
 */

import * as Zustand from '../../oberflaeche/zustand.js'
import { nimmAuf, leseBilder, beendeLeser } from '../../oberflaeche/aufnahme.js'
import { el, fuelle, neueKennung, jetzt } from '../../oberflaeche/werkzeug.js'
// Eigene Fenster statt window.confirm, wie im Programm selbst. Karam am
// 19.09.2026: "alle Pop-ups, die vom Browser kommen, irgendwie oben, sollen
// custom-made sein." Die paar Regeln dafuer bringt index.html selbst mit.
import * as Dialog from '../../oberflaeche/dialog.js'
import { leseZahl } from '../../kern/zahlen.js'

const ziel = /** @type {HTMLElement} */ (document.getElementById('inhalt'))
const stapel = /** @type {HTMLInputElement} */ (document.getElementById('dateien'))
const knopfLesen = /** @type {HTMLButtonElement} */ (document.getElementById('lesen'))
const knopfSichern = /** @type {HTMLButtonElement} */ (document.getElementById('sichern'))
const knopfOrdner = /** @type {HTMLButtonElement} */ (document.getElementById('ausordner'))
const lage = /** @type {HTMLElement} */ (document.getElementById('lage'))

/** Die Status, die ein Schein haben kann. Quelle: kern/typen.js, Typ Status. */
const STATUS_WERTE = [
  'offen',
  'gewonnen',
  'verloren',
  'halb_gewonnen',
  'halb_verloren',
  'push',
  'storniert',
  'cashout',
  'unbekannt',
]

/**
 * Die Felder, die geprueft werden. Reihenfolge ist die Anzeigereihenfolge.
 *
 * `ausKopf` heisst: der Wert kommt aus dem Bildkopf, nicht aus dem Kartentext.
 * leseSchein bekommt ihn also gar nicht zu sehen, und er gehoert nicht in die
 * Sollwerte eines Pruefalls. Berichtigen laesst er sich trotzdem, denn er
 * beschriftet den Fall und sagt, welches Anbieterprofil richtig gewesen waere.
 *
 * @type {{feld: string, name: string, art: 'zahl'|'text'|'auswahl', ausKopf?: boolean}[]}
 */
const FELDER = [
  { feld: 'buchmacher', name: 'Anbieter', art: 'text', ausKopf: true },
  { feld: 'konto', name: 'Konto', art: 'text', ausKopf: true },
  { feld: 'scheinNr', name: 'Schein-Nr', art: 'text' },
  { feld: 'einsatz', name: 'Einsatz', art: 'zahl' },
  { feld: 'quoteDezimal', name: 'Quote', art: 'zahl' },
  { feld: 'auszahlung', name: 'Auszahlung', art: 'zahl' },
  { feld: 'waehrung', name: 'Waehrung', art: 'text' },
  { feld: 'status', name: 'Status', art: 'auswahl' },
]

const NUR_PRUEFBAR = FELDER.filter((f) => !f.ausKopf)

/**
 * Alles, was von Hand eingetragen wurde.
 *
 * Der Schluessel ist ABSICHTLICH nicht schein.id: die wird bei jedem Lesen neu
 * vergeben, und ein zweiter Durchgang haette dann jede Berichtigung
 * weggeworfen, ohne es zu sagen. Bild und Position im Bild bleiben dagegen
 * gleich.
 *
 * @type {Map<string, {werte: Record<string, unknown>, fehlt: Set<string>, durchgesehen: boolean}>}
 */
const handarbeit = new Map()

const ABLAGE = 'kombi_exchange_training_handarbeit'

/** @param {any} schein */
function schluessel(schein) {
  return `${schein.bildId ?? 'ohne'}#${schein.positionImBild ?? 0}`
}

/** @param {any} schein */
function eintrag(schein) {
  const k = schluessel(schein)
  let e = handarbeit.get(k)
  if (!e) {
    e = { werte: {}, fehlt: new Set(), durchgesehen: false }
    handarbeit.set(k, e)
  }
  return e
}

/**
 * Handarbeit ueberlebt ein versehentliches Neuladen der Seite.
 *
 * Karam sitzt hier Stunden. Ein Druck auf F5 darf das nicht kosten.
 */
function merkeHandarbeit() {
  try {
    const roh = {}
    for (const [k, e] of handarbeit) {
      roh[k] = { werte: e.werte, fehlt: [...e.fehlt], durchgesehen: e.durchgesehen }
    }
    localStorage.setItem(ABLAGE, JSON.stringify(roh))
  } catch {
    // Kein Speicher, kein Drama. Die Arbeit laeuft weiter, nur ohne Netz.
  }
}

function holeHandarbeit() {
  try {
    const roh = JSON.parse(localStorage.getItem(ABLAGE) ?? '{}')
    for (const [k, e] of Object.entries(roh)) {
      const w = /** @type {any} */ (e)
      handarbeit.set(k, {
        werte: w.werte ?? {},
        fehlt: new Set(w.fehlt ?? []),
        durchgesehen: w.durchgesehen === true,
      })
    }
  } catch {
    // Unlesbar gespeichert heisst: neu anfangen. Nicht abstuerzen.
  }
}

holeHandarbeit()

/** Welche Bilder schon gelesen wurden. Gegen doppeltes Lesen. */
const gelesene = new Set()

Zustand.hoerZu(() => zeichne())

// Ein Projekt nur im Speicher. Die Trainingsseite fasst die Datenbank nicht an:
// hier wird geprueft, nicht gearbeitet, und Pruefdaten haben in den echten
// Projekten nichts verloren.
Zustand.aendere({
  angemeldet: true,
  token: '',
  projekt: {
    id: neueKennung(),
    name: 'Training',
    notiz: '',
    waehrung: 'UNBEKANNT',
    angelegtAm: jetzt(),
    geaendertAm: jetzt(),
  },
  projekte: [],
})

// Gruendlich lesen. Das steht in den Einstellungen, nicht im Aufruf von
// leseBilder: dort gibt es den Schluessel gar nicht, er waere stillschweigend
// fallengelassen worden.
Zustand.aendere({
  einstellungen: { ...Zustand.hole().einstellungen, gruendlich: true },
})

stapel.addEventListener('change', async () => {
  const dateien = stapel.files
  if (!dateien || dateien.length === 0) return
  melde(`${dateien.length} Bild(er) werden aufgenommen ...`)
  const ergebnis = await nimmAuf(dateien)
  meldeAufnahme(ergebnis, dateien.length, 'dem Auswahldialog')
})

/**
 * Holt die Bilder aus `.arbeit/fotos/` statt aus dem Auswahldialog.
 *
 * WARUM: bei hundert Fotos ist der Dialog muehsam, und er laesst sich von
 * aussen nicht bedienen. Der Ordner steht in `.gitignore`, die Bilder bleiben
 * also auf dem Geraet. Braucht `node werkzeug/server.mjs`, weil nur der
 * Server in einen Ordner sehen kann.
 *
 * Was hier NICHT passiert: die Bilder werden nicht nachbearbeitet und nicht
 * umbenannt. Was ankommt, ist Byte fuer Byte die Datei von der Platte, damit
 * der Fingerabdruck in `nimmAuf` derselbe ist wie beim Auswahldialog.
 */
knopfOrdner.addEventListener('click', async () => {
  knopfOrdner.disabled = true
  try {
    melde('Ordner wird gelesen ...')

    let verzeichnis
    try {
      const antwort = await fetch('/werkzeug/fotoordner', { cache: 'no-store' })
      if (!antwort.ok) throw new Error(`Server antwortet mit ${antwort.status}`)
      verzeichnis = await antwort.json()
    } catch (fehler) {
      melde(
        'Der Ordner liess sich nicht lesen. Laeuft "node werkzeug/server.mjs"? ' +
          `(${fehler instanceof Error ? fehler.message : String(fehler)})`
      )
      return
    }

    if (!verzeichnis.vorhanden) {
      melde(`Den Ordner ${verzeichnis.ordner}/ gibt es noch nicht. Anlegen und Fotos hineinlegen.`)
      return
    }
    if (verzeichnis.dateien.length === 0) {
      melde(`In ${verzeichnis.ordner}/ liegt kein Bild.`)
      return
    }

    /** @type {File[]} */
    const dateien = []
    /** @type {string[]} */
    const misslungen = []

    for (let i = 0; i < verzeichnis.dateien.length; i++) {
      const e = verzeichnis.dateien[i]
      melde(`Bild ${i + 1} von ${verzeichnis.dateien.length} wird geholt: ${e.name}`)
      try {
        const antwort = await fetch(e.pfad, { cache: 'no-store' })
        if (!antwort.ok) throw new Error(`Server antwortet mit ${antwort.status}`)
        const inhalt = await antwort.blob()
        if (!inhalt.type.startsWith('image/')) {
          throw new Error(`kommt als "${inhalt.type || 'unbekannt'}" an, nicht als Bild`)
        }
        dateien.push(new File([inhalt], e.name, { type: inhalt.type }))
      } catch (fehler) {
        // Ein einzelnes misslungenes Bild darf die anderen neunundneunzig nicht
        // aufhalten. Genannt wird es trotzdem, sonst faellt es nie auf.
        misslungen.push(`${e.name} (${fehler instanceof Error ? fehler.message : String(fehler)})`)
      }
    }

    if (dateien.length === 0) {
      melde(`Kein einziges Bild liess sich holen. ${misslungen.join('; ')}`)
      return
    }

    const ergebnis = await nimmAuf(dateien)
    meldeAufnahme(ergebnis, verzeichnis.dateien.length, `${verzeichnis.ordner}/`, misslungen)
  } finally {
    knopfOrdner.disabled = false
  }
})

/**
 * Sagt vollstaendig, was bei der Aufnahme herauskam.
 *
 * Vorher stand hier nur "98 aufgenommen". Die zwei, die im Fehlerfall weder
 * als aufgenommen noch als uebersprungen gezaehlt werden, fehlten wortlos.
 * Eine Zahl, die nicht aufgeht, muss sichtbar sein.
 *
 * @param {{aufgenommen: number, uebersprungen: number}} ergebnis
 * @param {number} angeboten
 * @param {string} woher
 * @param {string[]} [misslungen]
 */
function meldeAufnahme(ergebnis, angeboten, woher, misslungen = []) {
  const verschwunden = angeboten - ergebnis.aufgenommen - ergebnis.uebersprungen - misslungen.length
  const teile = [`${ergebnis.aufgenommen} von ${angeboten} aus ${woher} aufgenommen`]
  if (ergebnis.uebersprungen > 0) teile.push(`${ergebnis.uebersprungen} schon da`)
  if (misslungen.length > 0) teile.push(`NICHT geholt: ${misslungen.join('; ')}`)
  if (verschwunden > 0) {
    teile.push(`${verschwunden} liessen sich nicht vorbereiten, Grund steht unten bei den Meldungen`)
  }
  melde(teile.join(', ') + '.')
  knopfLesen.disabled = Zustand.hole().bilder.size === 0
}

knopfLesen.addEventListener('click', async () => {
  const alle = [...Zustand.hole().bilder.keys()]
  if (alle.length === 0) return

  const offene = alle.filter((id) => !gelesene.has(id))
  let ids = offene

  if (offene.length === 0) {
    // Alles schon gelesen. Erneut lesen vergibt neue Kennungen, haengt die
    // Scheine ein zweites Mal an die Liste und ist fast nie gemeint.
    const nochmal = await Dialog.bestaetige({
      titel: `Alle ${alle.length} Bilder sind schon gelesen`,
      punkte: [
        'Nochmal lesen hängt jeden Schein ein ZWEITES Mal an die Liste.',
        'Die Berichtigungen bleiben erhalten, die Liste wird aber doppelt so lang.',
      ],
      ja: 'Alles noch einmal lesen',
      nein: 'Doch nicht',
    })
    if (!nochmal) {
      melde('Nichts zu lesen. Alle Bilder sind bereits gelesen.')
      return
    }
    ids = alle
  }

  knopfLesen.disabled = true
  melde(`${ids.length} Bild(er) werden gelesen. Rechne mit etwa fuenf Sekunden je Schein.`)
  const begonnen = performance.now()
  const vorher = Zustand.hole().scheine.length
  const ergebnis = await leseBilder(ids)
  const dauer = (performance.now() - begonnen) / 1000
  for (const id of ids) gelesene.add(id)

  const dazu = Zustand.hole().scheine.length - vorher
  const karten = ids.reduce((n, id) => n + (Zustand.hole().bilder.get(id)?.karten.length ?? 0), 0)
  const verloren = karten - ergebnis.gelesen

  // Die volle Bilanz. "0 Fehler" bei fuenf verschwundenen Karten waere genau
  // die Sorte guter Nachricht, vor der die Projektregeln warnen.
  const teile = [
    `${karten} Karte(n) gefunden`,
    `${ergebnis.gelesen} gelesen`,
    `${dazu} neu in der Liste`,
  ]
  if (verloren > 0) teile.push(`${verloren} OHNE lesbaren Text, siehe Meldungen unten`)
  if (ergebnis.fehler > 0) teile.push(`${ergebnis.fehler} Bild(er) misslungen`)
  teile.push(`${dauer.toFixed(1)} s (${(dauer / Math.max(1, ids.length)).toFixed(1)} je Bild)`)
  melde(teile.join(', ') + '.')

  knopfLesen.disabled = false
  knopfSichern.disabled = Zustand.hole().scheine.length === 0
})

knopfSichern.addEventListener('click', () => void sichere())

/** @param {string} text */
function melde(text) {
  lage.textContent = text
}

/**
 * Holt den gelesenen Wert eines Feldes.
 * @param {any} schein
 * @param {string} feld
 */
function gelesen(schein, feld) {
  const roh = schein[feld]
  if (roh && typeof roh === 'object' && 'wert' in roh) return roh.wert
  return roh
}

/**
 * Woher ein Wert stammt: 'ocr', 'berechnet', 'hand', 'vorgabe', 'gelernt'.
 * @param {any} schein
 * @param {string} feld
 */
function quelleVon(schein, feld) {
  const roh = schein[feld]
  if (roh && typeof roh === 'object' && 'quelle' in roh) return String(roh.quelle)
  return ''
}

/**
 * Holt die Sicherheit, mit der ein Feld gelesen wurde.
 * @param {any} schein
 * @param {string} feld
 */
function sicherheit(schein, feld) {
  const roh = schein[feld]
  if (roh && typeof roh === 'object' && 'sicherheit' in roh) return Number(roh.sicherheit) || 0
  return 1
}

/**
 * Gilt ein Wert als "nichts"?
 *
 * 'UNBEKANNT' bei der Waehrung und 'unbekannt' beim Status gehoeren dazu. Das
 * sind Platzhalter des Parsers fuer "nicht erkannt", keine Ergebnisse. Als
 * gefunden zu zaehlen waere ein zu gutes Ergebnis, und als Sollwert zu sichern
 * hiesse zu verlangen, dass auch kuenftig nichts erkannt wird: jede spaetere
 * Verbesserung machte den Test rot, also genau umgekehrt zu seinem Zweck.
 *
 * Wer sagen will "auf dem Schein steht dazu wirklich nichts", setzt den Haken
 * "steht nicht drauf". Das ist eine Aussage, kein Platzhalter.
 *
 * @param {unknown} w
 */
function istNichts(w) {
  return w === null || w === undefined || w === '' || w === 'UNBEKANNT' || w === 'unbekannt'
}

/** Welche Hinweise sind wirklich welche. Schwere ist info, warnung oder fehler. */
function ernst(schein) {
  return (schein.hinweise ?? []).filter((/** @type {any} */ h) => h.schwere !== 'info')
}

function zeichne() {
  const stand = Zustand.hole()

  if (stand.arbeit.laeuft) {
    fuelle(ziel, [
      el('p.hinweis', { text: `${stand.arbeit.text} (${Math.round(stand.arbeit.anteil * 100)} %)` }),
    ])
    return
  }

  if (stand.scheine.length === 0) {
    fuelle(ziel, [
      meldungen(stand),
      el('p.hinweis', {
        text:
          'Noch nichts gelesen. Bilder holen, dann auf "Alles lesen". ' +
          'Es wird nichts in die Datenbank geschrieben und kein Bild verlaesst das Geraet.',
      }),
    ])
    return
  }

  fuelle(ziel, [
    uebersicht(stand.scheine),
    meldungen(stand),
    bildhinweise(stand),
    ...stand.scheine.map((s, i) => scheinkarte(s, i, stand)),
  ])
}

/**
 * Was die Zerlegung ueber die einzelnen Bilder zu sagen hatte.
 *
 * Hier steht zum Beispiel, dass ein Stueck zu flach fuer eine Karte war und
 * verworfen wurde, dass die Karten in mehreren Spalten lagen oder dass das
 * Bild im dunklen Modus aufgenommen ist. Ohne diese Liste verschwindet eine
 * abgeschnittene Karte spurlos, und der Korpus enthaelt am Ende genau die
 * Faelle nicht, an denen das Programm gescheitert ist.
 *
 * @param {any} stand
 */
function bildhinweise(stand) {
  const zeilen = []
  for (const eintragBild of stand.bilder?.values?.() ?? []) {
    for (const h of eintragBild.hinweise ?? []) {
      zeilen.push(`${eintragBild.bild.dateiname}: ${h}`)
    }
  }
  if (zeilen.length === 0) return null
  return el('section.meldungen', {}, [
    el('h2', { text: `${zeilen.length} Hinweis(e) aus der Bildzerlegung` }),
    el('ul', {}, zeilen.map((t) => el('li', { text: t }))),
  ])
}

/**
 * Alle Meldungen aus Aufnahme und Lesen.
 *
 * Vorher wurden sie nirgends angezeigt. Eine Karte ohne lesbaren Text wird in
 * leseBilder uebersprungen und zaehlt weder als gelesen noch als Fehler: ohne
 * diese Liste verschwindet sie spurlos, und der Korpus enthaelt am Ende genau
 * die Faelle nicht, an denen das Programm gescheitert ist.
 *
 * @param {any} stand
 */
function meldungen(stand) {
  const liste = stand.meldungen ?? []
  if (liste.length === 0) return null
  return el('section.meldungen', {}, [
    el('h2', { text: `${liste.length} Meldung(en) aus dem Leseweg` }),
    el(
      'ul',
      {},
      liste.map((/** @type {any} */ m) =>
        el('li', { class: `m-${m.art ?? 'info'}`, text: `[${m.art ?? 'info'}] ${m.text}` })
      )
    ),
  ])
}

/**
 * Wie viel wurde mit welcher Sicherheit gelesen, und wie weit ist Karam.
 * @param {any[]} scheine
 */
function uebersicht(scheine) {
  const zeilen = FELDER.map(({ feld, name }) => {
    const gefunden = scheine.filter((s) => !istNichts(gelesen(s, feld))).length
    const unsicher = scheine.filter((s) => sicherheit(s, feld) < 0.7).length
    return el('tr', {}, [
      el('td', { text: name }),
      el('td.zahl', { text: `${gefunden} / ${scheine.length}` }),
      el('td.zahl', { text: unsicher > 0 ? `${unsicher} unsicher` : '' }),
    ])
  })

  const mitFehler = scheine.filter((s) =>
    ernst(s).some((/** @type {any} */ h) => h.schwere === 'fehler')
  ).length
  const mitWarnung = scheine.filter((s) =>
    ernst(s).some((/** @type {any} */ h) => h.schwere === 'warnung')
  ).length
  const fertig = scheine.filter((s) => eintrag(s).durchgesehen).length

  return el('section.uebersicht', {}, [
    el('h2', { text: `${scheine.length} Schein(e) gelesen` }),
    el('p', {
      class: fertig === scheine.length ? 'gut' : 'warnung',
      text: `${fertig} von ${scheine.length} durchgesehen. Nur durchgesehene Scheine werden geprueft.`,
    }),
    el('table', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Feld' }),
          el('th', { text: 'gefunden' }),
          el('th', { text: '' }),
        ]),
      ]),
      el('tbody', {}, zeilen),
    ]),
    mitFehler + mitWarnung > 0
      ? el('p.warnung', {
          text:
            `${mitFehler} Schein(e) mit Fehler, ${mitWarnung} mit Warnung. ` +
            'Die gehoeren zuerst angesehen.',
        })
      : el('p.gut', { text: 'Kein Schein hat Fehler oder Warnung.' }),
  ])
}

/**
 * @param {any} schein
 * @param {number} nummer
 * @param {any} stand
 */
function scheinkarte(schein, nummer, stand) {
  const wichtige = ernst(schein)
  const e = eintrag(schein)
  const bild = stand.bilder?.get?.(schein.bildId)
  const herkunft = bild
    ? `${bild.bild.dateiname}, Karte ${(schein.positionImBild ?? 0) + 1}`
    : 'Bild unbekannt'

  const haken = el('input', { type: 'checkbox' })
  const hakenEl = /** @type {HTMLInputElement} */ (haken)
  hakenEl.checked = e.durchgesehen
  haken.addEventListener('change', () => {
    e.durchgesehen = hakenEl.checked
    merkeHandarbeit()
    // Nur die Karte umfaerben. Ein voller Neuaufbau wuerde bei hundert
    // Scheinen die Scrollstelle wegwerfen, und Karam suchte jedes Mal neu.
    karte.dataset.fertig = String(e.durchgesehen)
  })

  const karte = el(
    'section.schein',
    {
      daten: {
        warnung: String(wichtige.length > 0),
        fertig: String(e.durchgesehen),
      },
    },
    [
      el('h3', {}, [
        el('span', { text: `Schein ${nummer + 1} ` }),
        el('span.herkunft', { text: herkunft }),
      ]),

      el('label.durchgesehen', {}, [haken, el('span', { text: ' durchgesehen' })]),

      el('table.felder', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: 'Feld' }),
            el('th', { text: 'gelesen' }),
            el('th', { text: 'sicher' }),
            el('th', { text: 'richtig waere' }),
            el('th', { text: 'steht nicht drauf' }),
          ]),
        ]),
        el('tbody', {}, FELDER.map((f) => feldzeile(schein, f, e))),
      ]),

      wichtige.length > 0
        ? el(
            'ul.warnungen',
            {},
            wichtige.map((/** @type {any} */ h) =>
              el('li', { text: `[${h.schwere}] ${h.code}: ${h.text}` })
            )
          )
        : null,

      el('details.rohtext', {}, [
        el('summary', { text: 'Was die Texterkennung gesehen hat' }),
        el('pre', { text: (schein.lesezeilen ?? []).join('\n') || schein.rohtext || '(leer)' }),
      ]),
    ]
  )

  return karte
}

/**
 * Eine Zeile der Feldtabelle, mit Berichtigung und "steht nicht drauf".
 *
 * @param {any} schein
 * @param {{feld: string, name: string, art: 'zahl'|'text'|'auswahl', ausKopf?: boolean}} f
 * @param {{werte: Record<string, unknown>, fehlt: Set<string>, durchgesehen: boolean}} e
 */
function feldzeile(schein, f, e) {
  const { feld, name, art } = f
  const wert = gelesen(schein, feld)
  const s = sicherheit(schein, feld)

  const zelle = el('td', {})
  const eingabe = baueEingabe(f, e, zelle)

  // Felder aus dem Bildkopf gehen nicht durch leseSchein und koennen deshalb
  // auch nicht Sollwert eines Pruefalls sein. Der Haken waere dort sinnlos.
  let fehltZelle
  if (f.ausKopf) {
    fehltZelle = el('td.leise', { text: 'aus dem Bildkopf' })
  } else {
    const kasten = el('input', { type: 'checkbox' })
    const kastenEl = /** @type {HTMLInputElement} */ (kasten)
    kastenEl.checked = e.fehlt.has(feld)
    kasten.addEventListener('change', () => {
      if (kastenEl.checked) {
        e.fehlt.add(feld)
        delete e.werte[feld]
        if (eingabe instanceof HTMLInputElement || eingabe instanceof HTMLSelectElement) {
          eingabe.value = ''
        }
        eingabe.setAttribute('disabled', 'disabled')
      } else {
        e.fehlt.delete(feld)
        eingabe.removeAttribute('disabled')
      }
      merkeHandarbeit()
    })
    if (kastenEl.checked) eingabe.setAttribute('disabled', 'disabled')
    fehltZelle = el('td', {}, [kasten])
  }

  zelle.append(eingabe)

  // Ein berechneter Wert steht auf dem Bild NIRGENDS. Er sieht in der Karte
  // aus wie ein gelesener, erfuellt den Pruefstein Einsatz mal Quote gleich
  // Auszahlung immer und kann ihn nie verletzen. Wer das nicht sieht, nickt
  // ihn ab. Deshalb steht es dran.
  const berechnet = quelleVon(schein, feld) === 'berechnet'

  return el('tr', { daten: { unsicher: String(s < 0.7) } }, [
    el('td', { text: name }),
    el('td.wert', {}, [
      el('span', { text: istNichts(wert) ? '(nichts)' : String(wert) }),
      berechnet
        ? el('span.berechnet', { text: ' ausgerechnet, steht nicht auf dem Bild' })
        : null,
    ]),
    el('td.zahl', { text: `${Math.round(s * 100)} %` }),
    zelle,
    fehltZelle,
  ])
}

/**
 * Das Eingabefeld fuer eine Berichtigung.
 *
 * Zahlen sind ABSICHTLICH Textfelder. input type="number" verschluckt "250,50"
 * je nach Spracheinstellung des Browsers: .value ist dann leer, die Korrektur
 * verschwindet stillschweigend, und der falsch gelesene Wert wird als Wahrheit
 * gesichert. Im Feld steht derweil sichtbar 250,50. Das ist der teuerste
 * Fehler, den diese Seite machen kann, und in Karams Projekten ist er schon
 * einmal passiert.
 *
 * Umgewandelt wird ueber kern/zahlen.js, die EINE Stelle des Projekts, an der
 * aus Text eine Zahl wird. Ein blankes Number() waere eine zweite.
 *
 * @param {{feld: string, art: 'zahl'|'text'|'auswahl'}} f
 * @param {{werte: Record<string, unknown>, fehlt: Set<string>}} e
 * @param {HTMLElement} zelle
 */
function baueEingabe(f, e, zelle) {
  const { feld, art } = f
  const bisher = e.werte[feld]

  if (art === 'auswahl') {
    const auswahl = el('select.berichtigung', {})
    const auswahlEl = /** @type {HTMLSelectElement} */ (auswahl)
    auswahl.append(el('option', { value: '', text: 'nur wenn falsch' }))
    for (const w of STATUS_WERTE) auswahl.append(el('option', { value: w, text: w }))
    auswahlEl.value = typeof bisher === 'string' ? bisher : ''
    auswahl.addEventListener('change', () => {
      if (auswahlEl.value === '') delete e.werte[feld]
      else e.werte[feld] = auswahlEl.value
      merkeHandarbeit()
    })
    return auswahl
  }

  const eingabe = el('input.berichtigung', {
    type: 'text',
    inputmode: art === 'zahl' ? 'decimal' : 'text',
    placeholder: 'nur wenn falsch',
    value: bisher === undefined ? '' : String(bisher),
  })
  const eingabeEl = /** @type {HTMLInputElement} */ (eingabe)

  const pruefe = () => {
    const text = eingabeEl.value.trim()
    zelle.querySelector('.eingabefehler')?.remove()
    eingabe.classList.remove('falsch')

    if (text === '') {
      delete e.werte[feld]
      merkeHandarbeit()
      return
    }

    if (art === 'zahl') {
      // Ohne Gebiet entscheidet kern/zahlen.js nicht ueber Punkt und Komma,
      // sondern meldet mehrdeutig. Hier tippt aber ein Mensch, und ein Mensch
      // im deutschen Raum meint mit dem Komma die Nachkommastellen.
      const fund = leseZahl(text, { gebiet: 'de' })
      if (fund.wert === null) {
        // NICHT stillschweigend als "keine Berichtigung" behandeln. Sonst
        // wandert der falsch gelesene Wert als Wahrheit in die Datei, und
        // Karam sieht seine Eingabe noch im Feld stehen.
        delete e.werte[feld]
        eingabe.classList.add('falsch')
        zelle.append(
          el('div.eingabefehler', {
            text: `"${text}" ist keine Zahl (${fund.grund || 'nicht deutbar'}). Diese Berichtigung zaehlt NICHT.`,
          })
        )
        merkeHandarbeit()
        return
      }
      e.werte[feld] = fund.wert
      if (fund.mehrdeutig) {
        zelle.append(
          el('div.eingabefehler', {
            text: `Verstanden als ${fund.wert}. War das gemeint? Sonst mit Komma schreiben.`,
          })
        )
      }
    } else {
      e.werte[feld] = text
    }
    merkeHandarbeit()
  }

  eingabe.addEventListener('change', pruefe)
  eingabe.addEventListener('blur', pruefe)
  return eingabe
}

/**
 * Schreibt die Pruefaelle als Datei heraus.
 *
 * Erzeugt wird die Form, die test/korpus_pruefer.mjs prueft. Die Datei gehoert
 * nach test/korpus_echt.mjs, und test/korpus_echt.test.mjs nimmt sie von dort
 * automatisch auf.
 */
async function sichere() {
  const stand = Zustand.hole()

  const faelle = stand.scheine.map((schein, i) => {
    const e = eintrag(schein)
    /** @type {Record<string, unknown>} */
    const erwartet = {}
    /** @type {string[]} */
    const nichtVorhanden = []
    /** @type {string[]} */
    const berichtigt = []

    for (const { feld } of NUR_PRUEFBAR) {
      if (e.fehlt.has(feld)) {
        nichtVorhanden.push(feld)
        berichtigt.push(feld)
        continue
      }
      const vonHand = feld in e.werte
      const wert = vonHand ? e.werte[feld] : gelesen(schein, feld)
      // 'UNBEKANNT' und leer sind kein Sollwert. Wer sie festschreibt,
      // verlangt fuer immer, dass nichts erkannt wird.
      if (istNichts(wert)) continue

      // Eine Zahl, die das Programm aus zwei anderen Zahlen gebildet hat, ist
      // kein Lesergebnis und darf nie Sollwert eines LESEtests werden.
      //
      // Beispiel: steht auf dem Foto keine Auszahlung, rechnet der Parser
      // Einsatz mal Quote und liefert 296,29 mit Quelle 'berechnet'. Auf dem
      // Bild steht diese Zahl nirgends. Sie erfuellt den Pruefstein Einsatz
      // mal Quote gleich Auszahlung IMMER und kann ihn nie verletzen, sieht
      // in der Karte aber aus wie ein gelesener Wert. Wer sie als Wahrheit
      // festschreibt, prueft ab dann, dass das Programm richtig rechnet,
      // nicht dass es richtig liest.
      //
      // Von Hand bestaetigt ist etwas anderes: dann hat ein Mensch auf das
      // Bild gesehen.
      if (!vonHand && quelleVon(schein, feld) === 'berechnet') continue

      erwartet[feld] = wert
      if (vonHand) berichtigt.push(feld)
    }

    const buchmacher = 'buchmacher' in e.werte
      ? String(e.werte.buchmacher)
      : String(gelesen(schein, 'buchmacher') ?? '')

    return {
      name: `echt ${i + 1}: ${buchmacher || 'Anbieter unbekannt'}`,
      buchmacher,
      // Die genauen Zeilen, die leseSchein bekommen hat. rohtext ist fuer
      // Menschen zusammengesetzt und waere eine andere Eingabe.
      zeilen: (schein.lesezeilen ?? String(schein.rohtext ?? '').split('\n')).filter(
        (/** @type {string} */ z) => String(z).trim() !== ''
      ),
      // Die Umgebung des Laufs, aus dem diese Wahrheit stammt. Ohne sie liest
      // der Pruefall dieselben Zeilen unter anderen Bedingungen.
      umgebung: schein.leseumgebung ?? {},
      erwartet,
      nichtVorhanden,
      vonHandBerichtigt: berichtigt,
      durchgesehen: e.durchgesehen,
    }
  })

  const durchgesehen = faelle.filter((f) => f.durchgesehen).length
  const mitKorrektur = faelle.filter((f) => f.vonHandBerichtigt.length > 0).length

  if (durchgesehen < faelle.length) {
    const weiter = await Dialog.bestaetige({
      titel: `${faelle.length - durchgesehen} von ${faelle.length} Scheinen sind NICHT durchgesehen`,
      punkte: [
        'Sie kommen mit in die Datei, werden beim Prüfen aber übersprungen.',
        'Was niemand angesehen hat, ist keine geprüfte Wahrheit.',
      ],
      ja: 'Trotzdem sichern',
      nein: 'Erst durchsehen',
    })
    if (!weiter) {
      melde('Nichts gesichert. Erst die restlichen Scheine durchsehen und abhaken.')
      return
    }
  }

  const kopf = [
    '/**',
    ' * Pruefaelle aus ECHTEN Bildschirmfotos.',
    ' *',
    ' * Erzeugt von werkzeug/training/ am ' +
      new Date().toISOString().slice(0, 16).replace('T', ' ') +
      '.',
    ' *',
    ' * Die Zeilen sind das, was die Texterkennung wirklich aus dem Bild gemacht',
    ' * hat. "erwartet" ist die geprueefte Wahrheit, "nichtVorhanden" nennt die',
    ' * Felder, die auf dem Schein ausdruecklich NICHT stehen. Faelle mit',
    ' * Eintraegen unter "vonHandBerichtigt" waren beim Erzeugen falsch gelesen:',
    ' * das sind die wertvollen, sie zeigen, woran das Leseprogramm scheitert.',
    ' *',
    ' * Ein Fall ohne "durchgesehen: true" hat niemand angesehen. Er wird beim',
    ' * Pruefen uebersprungen, damit kein Maschinenergebnis zur Wahrheit wird.',
    ' *',
    ' * Diese Datei gehoert nach test/korpus_echt.mjs.',
    ' * test/korpus_echt.test.mjs nimmt sie von dort automatisch auf.',
    ' */',
    '',
    'export const KORPUS_ECHT = ',
  ].join('\n')

  // Der lange Gedankenstrich wird als Fluchtfolge geschrieben, nicht woertlich.
  //
  // Er kommt in echten Scheinen vor ("Bayern - Dortmund" mit langem Strich),
  // und die Texterkennung gibt ihn so weiter. Im Projekt ist das Zeichen
  // verboten, werkzeug/pruefe.mjs prueft das ueber ALLE Dateien, also auch
  // ueber test/. Woertlich geschrieben waere die Gegenprobe des ganzen
  // Programms dauerhaft rot, und der naheliegende Ausweg waere, das Zeichen
  // im Rohtext zu ersetzen. Genau das darf nicht passieren: der Rohtext ist
  // die Aufzeichnung dessen, was die Texterkennung gesehen hat.
  //
  // Als Fluchtfolge bleibt der Wert beim Einlesen derselbe, und die Regel
  // gilt weiter fuer alle Dateien ohne Ausnahme.
  // Das Zeichen steht hier selbst nur als Fluchtfolge, sonst haette diese
  // Datei es woertlich enthalten und pruefe.mjs haette sie beanstandet.
  const inhalt =
    kopf + JSON.stringify(faelle, null, 2).split(String.fromCharCode(0x2014)).join('\\u2014') + '\n'
  const blob = new Blob([inhalt], { type: 'text/javascript;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'korpus_echt.mjs'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)

  melde(
    `${faelle.length} Pruefaelle gesichert, ${durchgesehen} davon durchgesehen, ` +
      `${mitKorrektur} mit Berichtigung. Die Datei gehoert nach test/korpus_echt.mjs.`
  )
}

window.addEventListener('beforeunload', () => {
  beendeLeser().catch(() => {})
})

zeichne()
