// @ts-check
/**
 * Der Zusammenbau.
 *
 * Hier haengen Tor, Kopfleiste, Ansichten und das Speichern zusammen.
 * Gerechnet wird hier nichts.
 */

import { el, fuelle, such, neueKennung, jetzt, verzoegert, zeitText } from './werkzeug.js'
import { formatiere } from '../kern/geld.js'
import { rechneProjekt } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'
import * as Datenbank from '../daten/datenbank.js'
import { SITZUNG_SCHLUESSEL, EINSTELLUNG_SCHLUESSEL } from '../daten/einstellungen.js'
import { merkeStand, holeStand, holeBilderZuProjekt, loescheBild } from '../daten/ablage.js'
import { ladeBild } from '../bild/vorverarbeitung.js'

import * as AnsichtAufnahme from './ansicht_aufnahme.js'
import * as AnsichtScheine from './ansicht_scheine.js'
import * as AnsichtPositionen from './ansicht_positionen.js'
import * as AnsichtAusgabe from './ansicht_ausgabe.js'

const ANSICHTEN = [
  { schluessel: 'aufnahme', name: 'Aufnahme', zeichne: AnsichtAufnahme.zeichne },
  { schluessel: 'scheine', name: 'Scheine', zeichne: AnsichtScheine.zeichne },
  { schluessel: 'positionen', name: 'Riesenscheine', zeichne: AnsichtPositionen.zeichne },
  { schluessel: 'ausgabe', name: 'Ausgabe', zeichne: AnsichtAusgabe.zeichne },
]

/** @type {HTMLElement|null} */
let wurzel = null

/**
 * Startet das Programm.
 *
 * @param {HTMLElement} ziel
 */
export async function starte(ziel) {
  wurzel = ziel
  ladeEinstellungen()

  Zustand.hoerZu(zeichneAlles)

  const gemerkt = localStorage.getItem(SITZUNG_SCHLUESSEL) ?? ''
  if (gemerkt) {
    zeichneWarten('Zugang wird geprueft')
    const pruefung = await Datenbank.pruefeSitzung(gemerkt)
    if (pruefung.gueltig) {
      Zustand.aendere({ angemeldet: true, token: gemerkt, datenbankErreichbar: true })
      await ladeAlles()
      return
    }
    if (!pruefung.erreichbar) {
      // Netz weg ist nicht dasselbe wie Zugang weg. Der Zugang bleibt gemerkt,
      // damit ein kurzer Aussetzer nicht zum erneuten Eintippen zwingt.
      Zustand.aendere({ angemeldet: true, token: gemerkt, datenbankErreichbar: false })
      Zustand.melde(
        'warnung',
        `Die Datenbank ist gerade nicht erreichbar. Es wird nur auf diesem Geraet gespeichert. ${pruefung.meldung}`
      )
      await ladeNurOertlich()
      return
    }
    localStorage.removeItem(SITZUNG_SCHLUESSEL)
  }

  zeichneTor()
}

/** Zeichnet den Zustand neu. */
function zeichneAlles() {
  if (!wurzel) return
  const stand = Zustand.hole()
  if (!stand.angemeldet) {
    zeichneTor()
    return
  }
  zeichneHuelle()
}

// ---------------------------------------------------------------------------
// Tor
// ---------------------------------------------------------------------------

function zeichneTor() {
  if (!wurzel) return
  const meldung = el('.tormeldung')

  const eingabe = el('input.torfeld', {
    type: 'text',
    placeholder: 'KMB-XXXX-XXXX-XXXX',
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: 'false',
    'aria-label': 'Sperrcode',
  })

  const knopf = el('button.knopf.knopf-haupt.torknopf', { type: 'submit', text: 'Eintreten' })

  const senden = async (e) => {
    e.preventDefault()
    const code = /** @type {HTMLInputElement} */ (eingabe).value.trim().toUpperCase()
    if (code === '') {
      meldung.textContent = 'Bitte den Code eingeben.'
      meldung.dataset.art = 'fehler'
      return
    }
    knopf.setAttribute('disabled', 'disabled')
    meldung.textContent = 'Wird geprueft ...'
    meldung.dataset.art = 'info'

    const ergebnis = await Datenbank.loeseCodeEin(code)
    knopf.removeAttribute('disabled')

    if (!ergebnis.gelungen) {
      meldung.textContent = ergebnis.meldung || 'Der Code stimmt nicht.'
      meldung.dataset.art = 'fehler'
      return
    }

    localStorage.setItem(SITZUNG_SCHLUESSEL, ergebnis.token)
    Zustand.aendere({ angemeldet: true, token: ergebnis.token, datenbankErreichbar: true })
    await ladeAlles()
  }

  fuelle(wurzel, [
    el('.tor', {}, [
      el('form.torkasten', { onsubmit: senden }, [
        el('.tormarke', {}, [
          el('span.markenname', { text: 'KOMBI' }),
          el('span.markenzusatz', { text: 'EXCHANGE' }),
        ]),
        el('p.torunterzeile', { text: 'Riesenschein-Terminal' }),
        el('label.torbeschriftung', { for: 'torfeld', text: 'Sperrcode' }),
        eingabe,
        knopf,
        meldung,
        el('p.torfuss', {
          text: 'Ohne Anmeldung. Wer den Code hat, sieht alles. Die Bildschirmfotos bleiben auf dem Geraet.',
        }),
      ]),
    ]),
  ])
  setTimeout(() => eingabe.focus(), 50)
}

/**
 * @param {string} text
 */
function zeichneWarten(text) {
  if (!wurzel) return
  fuelle(wurzel, [
    el('.tor', {}, [
      el('.torkasten', {}, [
        el('.tormarke', {}, [
          el('span.markenname', { text: 'KOMBI' }),
          el('span.markenzusatz', { text: 'EXCHANGE' }),
        ]),
        el('p.torunterzeile', { text }),
        el('.balken', {}, [el('.balkenfuellung.balken-laeuft')]),
      ]),
    ]),
  ])
}

// ---------------------------------------------------------------------------
// Huelle
// ---------------------------------------------------------------------------

function zeichneHuelle() {
  if (!wurzel) return
  const stand = Zustand.hole()

  let inhalt = such('#inhalt')
  if (!inhalt) {
    fuelle(wurzel, [
      el('.huelle', {}, [
        el('header.kopfleiste', { id: 'kopfleiste' }),
        el('nav.reiterleiste', { id: 'reiterleiste' }),
        el('main.inhalt', { id: 'inhalt' }),
        el('.meldungsecke', { id: 'meldungsecke' }),
        el('.arbeitsleiste', { id: 'arbeitsleiste' }),
      ]),
    ])
    inhalt = such('#inhalt')
  }

  zeichneKopf()
  zeichneReiter()
  zeichneMeldungen()
  zeichneArbeit()

  const ansicht = ANSICHTEN.find((a) => a.schluessel === stand.ansicht) ?? ANSICHTEN[0]
  if (inhalt && ansicht) ansicht.zeichne(inhalt)
}

function zeichneKopf() {
  const kopf = such('#kopfleiste')
  if (!kopf) return
  const stand = Zustand.hole()

  const rechnungen = stand.riesenscheine.map((r) => Zustand.rechnungVon(r.id))
  const gesamt = rechneProjekt(rechnungen)
  const w = gesamt.waehrung

  fuelle(kopf, [
    el('.marke', {}, [
      el('span.markenname', { text: 'KOMBI' }),
      el('span.markenzusatz', { text: 'EXCHANGE' }),
    ]),

    el('.laufleiste', {}, [
      laufwert('EINSATZ', formatiere(gesamt.einsatzGesamt, w, 'de'), 'neutral'),
      laufwert('SCHEINE', String(gesamt.anzahlScheine), 'neutral'),
      laufwert('ANBIETER', String(gesamt.buchmacher.length), 'neutral'),
      laufwert('MOEGLICH', formatiere(gesamt.auszahlungMoeglich, w, 'de'), 'gut'),
      laufwert(
        'ERGEBNIS',
        formatiere(gesamt.ergebnisRealisiert, w, 'de'),
        gesamt.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht'
      ),
      laufwert('RISIKO', formatiere(gesamt.imRisiko, w, 'de'), 'offen'),
    ]),

    projektwahl(stand),

    el('.kopfknoepfe', {}, [
      el('span.verbindung', {
        daten: { an: String(stand.datenbankErreichbar) },
        text: stand.datenbankErreichbar ? 'verbunden' : 'nur auf diesem Geraet',
        title: stand.datenbankErreichbar
          ? 'Die Daten werden in der Datenbank gesichert.'
          : 'Die Datenbank ist nicht erreichbar. Es wird nur oertlich gespeichert.',
      }),
      el('button.knopf.knopf-klein', {
        type: 'button',
        text: 'Abmelden',
        onclick: () => {
          if (!confirm('Abmelden? Der Code wird beim naechsten Mal wieder gebraucht.')) return
          localStorage.removeItem(SITZUNG_SCHLUESSEL)
          Zustand.aendere({ angemeldet: false, token: '' })
        },
      }),
    ]),
  ])
}

/**
 * Projekt waehlen, anlegen, leeren.
 *
 * Ein Projekt ist eine Sammlung: alle Bilder, alle Scheine, alle Riesenscheine
 * einer Runde liegen darin. Wer eine neue Runde beginnt, legt ein neues an und
 * vermischt nichts mit der alten.
 *
 * @param {import('./zustand.js').Stand} stand
 * @returns {HTMLElement}
 */
function projektwahl(stand) {
  return el('.projektwahl', {}, [
    el(
      'select.feldwahl.projektfeld',
      {
        title: 'Projekt wechseln',
        onchange: async (e) => {
          const id = /** @type {HTMLSelectElement} */ (e.target).value
          const gewaehlt = stand.projekte.find((p) => p.id === id)
          if (!gewaehlt || gewaehlt.id === stand.projekt?.id) return
          Zustand.aendere({ projekt: gewaehlt, scheine: [], riesenscheine: [], bilder: new Map() })
          await ladeProjektinhalt(gewaehlt.id)
        },
      },
      stand.projekte.map((p) =>
        el('option', { value: p.id, text: p.name, selected: p.id === stand.projekt?.id ? 'selected' : null })
      )
    ),
    el('button.knopf.knopf-klein', {
      type: 'button',
      text: 'Neu',
      title: 'Neues Projekt anlegen',
      onclick: async () => {
        const name = prompt('Wie soll das neue Projekt heissen?', `Runde vom ${new Date().toLocaleDateString('de-DE')}`)
        if (!name) return
        await legeProjektAn(name.trim())
      },
    }),
    el('button.knopf.knopf-klein', {
      type: 'button',
      text: 'Leeren',
      title: 'Alle Scheine und Bilder dieses Projekts entfernen',
      onclick: () => leereAktuellesProjekt(),
    }),
  ])
}

/**
 * @param {string} name
 */
async function legeProjektAn(name) {
  const stand = Zustand.hole()
  /** @type {import('../kern/typen.js').Projekt} */
  const projekt = {
    id: neueKennung(),
    name,
    notiz: '',
    waehrung: 'UNBEKANNT',
    angelegtAm: jetzt(),
    geaendertAm: jetzt(),
  }

  const antwort = await Datenbank.speichereProjekt(stand.token, projekt)
  if (antwort.art === 'fehler') {
    Zustand.melde('warnung', `Das Projekt liess sich nicht anlegen: ${antwort.meldung}`)
    return
  }

  Zustand.aendere({
    projekte: [projekt, ...stand.projekte],
    projekt,
    scheine: [],
    riesenscheine: [],
    restposten: [],
    verdacht: [],
    bilder: new Map(),
    auswahl: null,
    ansicht: 'aufnahme',
  })
  Zustand.melde('erfolg', `Projekt "${name}" angelegt.`)
}

async function leereAktuellesProjekt() {
  const stand = Zustand.hole()
  if (!stand.projekt) return
  const anzahl = stand.scheine.length
  if (
    !confirm(
      `Alle ${anzahl} Schein(e) und alle Bilder aus "${stand.projekt.name}" entfernen?\n\n` +
        'Das Projekt selbst bleibt bestehen. Rueckgaengig machen geht nicht.'
    )
  ) {
    return
  }

  Zustand.arbeite(true, 'Projekt wird geleert', 0.5)
  const antwort = await Datenbank.leereProjekt(stand.token, stand.projekt.id)
  Zustand.arbeite(false)

  if (antwort.art === 'fehler') {
    Zustand.melde('fehler', `Das Projekt liess sich nicht leeren: ${antwort.meldung}`)
    return
  }

  // Auch die Bilder auf diesem Geraet wegraeumen, sonst bleiben sie liegen.
  for (const eintrag of stand.bilder.values()) {
    try {
      await loescheBild(eintrag.bild.id)
    } catch {
      // Ein Bild, das sich nicht loeschen laesst, darf den Vorgang nicht stoppen.
    }
  }
  await merkeStand('scheine', [])
  await merkeStand('riesenscheine', [])

  Zustand.aendere({
    scheine: [],
    riesenscheine: [],
    restposten: [],
    verdacht: [],
    bilder: new Map(),
    auswahl: null,
    ansicht: 'aufnahme',
  })
  Zustand.melde('erfolg', `${antwort.daten ?? anzahl} Schein(e) entfernt.`)
}

/**
 * Laedt Scheine, Riesenscheine und Bilder eines Projekts nach.
 *
 * @param {string} projektId
 */
async function ladeProjektinhalt(projektId) {
  const stand = Zustand.hole()
  Zustand.arbeite(true, 'Projekt wird geladen', 0.4)

  const riesenscheine = await Datenbank.holeRiesenscheine(stand.token, projektId)
  Zustand.aendere({
    riesenscheine: (Array.isArray(riesenscheine.daten) ? riesenscheine.daten : []).map(
      ausDatenbankRiesenschein
    ),
  })

  const scheine = await Datenbank.holeScheine(stand.token, projektId)
  if (scheine.art === 'fehler') {
    Zustand.melde('warnung', `Die Scheine liessen sich nicht laden: ${scheine.meldung}`)
  } else {
    Zustand.ordneNeu(scheine.daten)
  }

  await ladeBilderVomGeraet(projektId)
  Zustand.arbeite(false)
}

/**
 * @param {string} name
 * @param {string} wert
 * @param {'neutral'|'gut'|'schlecht'|'offen'} art
 * @returns {HTMLElement}
 */
function laufwert(name, wert, art) {
  return el('.laufwert', { daten: { art } }, [
    el('span.laufname', { text: name }),
    el('span.laufzahl', { text: wert }),
  ])
}

function zeichneReiter() {
  const leiste = such('#reiterleiste')
  if (!leiste) return
  const stand = Zustand.hole()

  const zahlen = {
    aufnahme: stand.bilder.size,
    scheine: stand.scheine.length,
    positionen: stand.riesenscheine.length,
    ausgabe: 0,
  }

  fuelle(
    leiste,
    ANSICHTEN.map((a) =>
      el(
        'button.reiter',
        {
          type: 'button',
          daten: { aktiv: String(a.schluessel === stand.ansicht) },
          onclick: () => Zustand.aendere({ ansicht: /** @type {any} */ (a.schluessel) }),
        },
        [
          el('span.reitername', { text: a.name }),
          zahlen[a.schluessel] > 0 ? el('span.reiterzahl', { text: String(zahlen[a.schluessel]) }) : null,
        ]
      )
    )
  )
}

function zeichneMeldungen() {
  const ecke = such('#meldungsecke')
  if (!ecke) return
  const stand = Zustand.hole()

  fuelle(
    ecke,
    stand.meldungen.slice(0, 5).map((m) =>
      el('.meldung', { daten: { art: m.art } }, [
        el('span.meldungstext', { text: m.text }),
        el('span.meldungszeit', { text: zeitText(m.zeit).slice(-5) }),
        el('button.meldungweg', {
          type: 'button',
          text: 'x',
          title: 'Ausblenden',
          onclick: () => Zustand.meldungWeg(m.id),
        }),
      ])
    )
  )
}

function zeichneArbeit() {
  const leiste = such('#arbeitsleiste')
  if (!leiste) return
  const stand = Zustand.hole()

  if (!stand.arbeit.laeuft) {
    fuelle(leiste, [])
    leiste.dataset.an = 'false'
    return
  }

  leiste.dataset.an = 'true'
  fuelle(leiste, [
    el('.arbeitstext', { text: stand.arbeit.text }),
    el('.balken', {}, [
      el('.balkenfuellung', {
        stil: { '--breite': `${Math.round(Math.min(1, Math.max(0, stand.arbeit.anteil)) * 100)}%` },
      }),
    ]),
  ])
}

// ---------------------------------------------------------------------------
// Laden und Speichern
// ---------------------------------------------------------------------------

async function ladeAlles() {
  zeichneWarten('Daten werden geladen')
  const stand = Zustand.hole()

  const antwort = await Datenbank.holeProjekte(stand.token)
  if (antwort.art === 'fehler') {
    Zustand.aendere({ datenbankErreichbar: false })
    Zustand.melde('warnung', `Die Projekte liessen sich nicht laden: ${antwort.meldung}`)
    await ladeNurOertlich()
    return
  }

  /** @type {import('../kern/typen.js').Projekt[]} */
  const projekte = (Array.isArray(antwort.daten) ? antwort.daten : []).map(ausDatenbankProjekt)

  let projekt = projekte[0] ?? null
  if (!projekt) {
    projekt = {
      id: neueKennung(),
      name: 'Mein erstes Projekt',
      notiz: '',
      waehrung: 'UNBEKANNT',
      angelegtAm: jetzt(),
      geaendertAm: jetzt(),
    }
    const angelegt = await Datenbank.speichereProjekt(stand.token, projekt)
    if (angelegt.art === 'fehler') {
      Zustand.melde('warnung', `Das Projekt liess sich nicht anlegen: ${angelegt.meldung}`)
    }
    projekte.push(projekt)
  }

  Zustand.aendere({ projekte, projekt, datenbankErreichbar: true })

  const scheine = await Datenbank.holeScheine(stand.token, projekt.id)
  if (scheine.art === 'fehler') {
    Zustand.melde('warnung', `Die Scheine liessen sich nicht laden: ${scheine.meldung}`)
  }

  const riesenscheine = await Datenbank.holeRiesenscheine(stand.token, projekt.id)
  /** @type {import('../kern/typen.js').Riesenschein[]} */
  const geladeneRiesenscheine = (Array.isArray(riesenscheine.daten) ? riesenscheine.daten : []).map(
    ausDatenbankRiesenschein
  )

  Zustand.aendere({ riesenscheine: geladeneRiesenscheine })
  if (scheine.daten.length > 0) {
    Zustand.ordneNeu(scheine.daten)
  }

  await ladeBilderVomGeraet(projekt.id)
  Zustand.melde(
    'erfolg',
    `${scheine.daten.length} Schein(e) geladen. Willkommen zurueck.`
  )
  zeichneHuelle()
}

/** Wenn die Datenbank nicht erreichbar ist: wenigstens das laden, was hier liegt. */
async function ladeNurOertlich() {
  const gemerktesProjekt = await holeStand('projekt')
  const gemerkteScheine = await holeStand('scheine')

  const projekt = gemerktesProjekt ?? {
    id: neueKennung(),
    name: 'Oertliches Projekt',
    notiz: '',
    waehrung: 'UNBEKANNT',
    angelegtAm: jetzt(),
    geaendertAm: jetzt(),
  }

  Zustand.aendere({ projekt, projekte: [projekt] })
  if (Array.isArray(gemerkteScheine) && gemerkteScheine.length > 0) {
    Zustand.ordneNeu(gemerkteScheine)
  }
  await ladeBilderVomGeraet(projekt.id)
  zeichneHuelle()
}

/**
 * Holt die Bilder aus der Browserdatenbank zurueck, damit das Blatt auch nach
 * einem Neustart noch gebaut werden kann.
 *
 * @param {string} projektId
 */
async function ladeBilderVomGeraet(projektId) {
  try {
    const abgelegt = await holeBilderZuProjekt(projektId)
    if (abgelegt.length === 0) return

    const bilder = new Map(Zustand.hole().bilder)
    for (const eintrag of abgelegt) {
      if (bilder.has(eintrag.id)) continue
      try {
        const element = await ladeBild(eintrag.inhalt)
        bilder.set(eintrag.id, {
          bild: {
            id: eintrag.id,
            projektId: eintrag.projektId,
            dateiname: eintrag.dateiname,
            breite: eintrag.breite,
            hoehe: eintrag.hoehe,
            quelle: '',
            pruefsumme: eintrag.pruefsumme,
            buchmacher: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
            konto: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
            angelegtAm: jetzt(),
          },
          element,
          inhalt: eintrag.inhalt,
          karten: [],
          hinweise: [],
        })
      } catch {
        // Ein einzelnes kaputtes Bild darf nicht den ganzen Start blockieren.
      }
    }
    Zustand.aendere({ bilder })
  } catch (fehler) {
    Zustand.melde(
      'warnung',
      `Die gemerkten Bilder liessen sich nicht laden: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
  }
}

/** Speichert verzoegert, damit nicht bei jedem Tastendruck geschrieben wird. */
const speichereVerzoegert = verzoegert(async () => {
  const stand = Zustand.hole()
  if (!stand.projekt) return

  // Immer zuerst hier auf dem Geraet. Das geht auch ohne Netz.
  try {
    await merkeStand('projekt', stand.projekt)
    await merkeStand('scheine', stand.scheine)
    await merkeStand('riesenscheine', stand.riesenscheine)
  } catch (fehler) {
    console.error('[Speichern] oertlich fehlgeschlagen', fehler)
  }

  if (!stand.token) return

  const scheine = await Datenbank.speichereScheine(stand.token, stand.projekt.id, stand.scheine)
  if (!scheine.gelungen) {
    Zustand.aendere({ datenbankErreichbar: false })
    Zustand.melde('warnung', `Nicht alles konnte gesichert werden: ${scheine.meldung}`)
    return
  }

  const riesenscheine = await Datenbank.speichereRiesenscheine(
    stand.token,
    stand.projekt.id,
    stand.riesenscheine
  )
  if (riesenscheine.art === 'fehler') {
    Zustand.aendere({ datenbankErreichbar: false })
    Zustand.melde('warnung', `Die Riesenscheine liessen sich nicht sichern: ${riesenscheine.meldung}`)
    return
  }

  if (!stand.datenbankErreichbar) {
    Zustand.aendere({ datenbankErreichbar: true })
  }
}, 2500)

// Bei jeder Aenderung an den Daten wird gesichert.
let letzterStempel = ''
Zustand.hoerZu((stand) => {
  const stempel = `${stand.scheine.length}|${stand.riesenscheine.map((r) => `${r.id}:${r.geaendertAm}`).join(',')}|${stand.scheine.map((s) => s.geaendertAm).join(',')}`
  if (stempel === letzterStempel) return
  letzterStempel = stempel
  if (stand.angemeldet && stand.projekt) speichereVerzoegert()
})

// ---------------------------------------------------------------------------
// Hilfsumsetzungen
// ---------------------------------------------------------------------------

/**
 * @param {any} zeile
 * @returns {import('../kern/typen.js').Projekt}
 */
function ausDatenbankProjekt(zeile) {
  return {
    id: String(zeile.id),
    name: String(zeile.name ?? 'Ohne Namen'),
    notiz: String(zeile.notiz ?? ''),
    waehrung: /** @type {any} */ (zeile.waehrung ?? 'UNBEKANNT'),
    angelegtAm: String(zeile.angelegt_am ?? ''),
    geaendertAm: String(zeile.geaendert_am ?? ''),
  }
}

/**
 * @param {any} zeile
 * @returns {import('../kern/typen.js').Riesenschein}
 */
function ausDatenbankRiesenschein(zeile) {
  return {
    id: String(zeile.id),
    projektId: String(zeile.projekt_id ?? ''),
    name: String(zeile.name ?? ''),
    signatur: String(zeile.signatur ?? ''),
    scheinIds: Array.isArray(zeile.schein_ids) ? zeile.schein_ids.map(String) : [],
    notiz: String(zeile.notiz ?? ''),
    angelegtAm: String(zeile.angelegt_am ?? ''),
    geaendertAm: String(zeile.geaendert_am ?? ''),
  }
}

function ladeEinstellungen() {
  try {
    const roh = localStorage.getItem(EINSTELLUNG_SCHLUESSEL)
    if (!roh) return
    const gelesen = JSON.parse(roh)
    Zustand.aendere({ einstellungen: { ...Zustand.hole().einstellungen, ...gelesen } })
  } catch {
    // Kaputte Einstellungen werden ignoriert, die Vorgaben greifen.
  }
}

Zustand.hoerZu((stand) => {
  try {
    localStorage.setItem(EINSTELLUNG_SCHLUESSEL, JSON.stringify(stand.einstellungen))
  } catch {
    // Wenn der Speicher voll ist, laeuft das Programm trotzdem weiter.
  }
})
