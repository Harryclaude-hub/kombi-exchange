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
import { sorgeFuerAktuelleDateien } from '../daten/fassung.js'
import { ladeBild } from '../bild/vorverarbeitung.js'

import * as AnsichtAufnahme from './ansicht_aufnahme.js'
import * as AnsichtAblage from './ansicht_ablage.js'
import * as AnsichtScheine from './ansicht_scheine.js'
import * as AnsichtPositionen from './ansicht_positionen.js'
import * as AnsichtAusgabe from './ansicht_ausgabe.js'

const ANSICHTEN = [
  { schluessel: 'aufnahme', name: 'Aufnahme', zeichne: AnsichtAufnahme.zeichne },
  { schluessel: 'scheine', name: 'Scheine', zeichne: AnsichtScheine.zeichne },
  { schluessel: 'positionen', name: 'Riesenscheine', zeichne: AnsichtPositionen.zeichne },
  { schluessel: 'ausgabe', name: 'Ausgabe', zeichne: AnsichtAusgabe.zeichne },
  { schluessel: 'ablage', name: 'Ablage', zeichne: AnsichtAblage.zeichne },
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

  // Zuerst pruefen, ob dieser Browser eine veraltete Mischung aus alten und
  // neuen Programmdateien geladen hat. Passiert das, wird einmal neu geladen
  // und dieser Start bricht hier ab, weil gleich ein neuer folgt.
  //
  // Das steht ganz vorne mit Absicht: nach dem Laden von Daten neu zu laden
  // waere verschwendete Arbeit, und mitten in einer Bearbeitung waere es
  // Datenverlust.
  const aktualitaet = await sorgeFuerAktuelleDateien()
  if (aktualitaet.neugeladen) return
  if (aktualitaet.meldung && aktualitaet.art === 'veraltet') {
    Zustand.melde('warnung', aktualitaet.meldung)
  }

  Zustand.hoerZu(zeichneAlles)
  horcheAufAblage()

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

    // Drei Zahlen, nicht sechs.
    //
    // Die Leiste steht immer im Blick, ueber jeder Ansicht. Was hier steht,
    // sollte man ohne Nachdenken lesen koennen. Bei sechs Zahlen nebeneinander
    // liest man keine einzige. Scheine, Anbieter und Risiko stehen weiterhin in
    // der Ansicht Riesenscheine, dort wo man sie braucht.
    el('.laufleiste', {}, [
      laufwert('EINSATZ', formatiere(gesamt.einsatzGesamt, w, 'de'), 'neutral'),
      laufwert('MOEGLICH', formatiere(gesamt.auszahlungMoeglich, w, 'de'), 'gut'),
      // Solange nichts entschieden ist, sagt eine Null nichts. Dann ist
      // interessanter, was noch auf dem Spiel steht.
      Math.abs(gesamt.ergebnisRealisiert) > 0.005
        ? laufwert(
            'ERGEBNIS',
            formatiere(gesamt.ergebnisRealisiert, w, 'de'),
            gesamt.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht'
          )
        : laufwert('IM RISIKO', formatiere(gesamt.imRisiko, w, 'de'), 'offen'),
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
        text: 'Code wechseln',
        title: 'Einen neuen Zugangscode erzeugen und alle anderen Fenster abmelden.',
        onclick: zeigeCodewechsel,
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
 * Den Zugangscode wechseln.
 *
 * Warum es das gibt: es gibt genau einen Code fuer alle. Wird er einmal
 * weitergegeben, kommt jeder herein, der ihn hat. Ohne Wechselmoeglichkeit
 * gaebe es dagegen kein Mittel.
 *
 * Zwei Dinge sind bewusst so gebaut:
 *
 * 1. Der bisherige Code muss eingegeben werden. Ein offenes Fenster allein
 *    reicht nicht. Sonst koennte jemand, der kurz am Rechner sass, den Code
 *    aendern und alle anderen aussperren.
 *
 * 2. Der neue Code wird HIER gewuerfelt, nicht selbst ausgedacht. Selbst
 *    ausgedachte Codes sind erratbar. Die Datenbank bekommt ihn nur als
 *    Einwegwert zu sehen, im Klartext steht er nirgends.
 */
function zeigeCodewechsel() {
  const stand = Zustand.hole()
  const neuerCode = Datenbank.wuerfleCode()

  const altFeld = el('input.feldeingabe', {
    type: 'password',
    placeholder: 'bisheriger Code',
    autocomplete: 'off',
  })
  const anzeige = el('input.feldeingabe.feldeingabe-code', {
    type: 'text',
    value: neuerCode,
    readonly: true,
    spellcheck: false,
  })
  const hinweis = el('p.hinweiszeile', { text: '' })

  const dialog = /** @type {HTMLDialogElement} */ (el('dialog.dialog', {}, [
    el('h2', { text: 'Zugangscode wechseln' }),
    el('p', {
      text:
        'Der neue Code steht unten. Bitte zuerst sichern, danach ist er nicht ' +
        'mehr abrufbar. Alle anderen offenen Fenster werden abgemeldet.',
    }),
    el('label.feldzeile', {}, [el('span', { text: 'Bisheriger Code' }), altFeld]),
    el('label.feldzeile', {}, [el('span', { text: 'Neuer Code' }), anzeige]),
    hinweis,
    el('.dialogknoepfe', {}, [
      el('button.knopf.knopf-klein', {
        type: 'button',
        text: 'Neu wuerfeln',
        onclick: () => {
          anzeige.value = Datenbank.wuerfleCode()
        },
      }),
      el('button.knopf.knopf-klein', {
        type: 'button',
        text: 'Kopieren',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(anzeige.value)
            hinweis.textContent = 'In die Zwischenablage gelegt.'
          } catch {
            // Ohne Erlaubnis zur Zwischenablage: markieren, dann kann der
            // Nutzer selbst kopieren. Nicht einfach schweigen.
            anzeige.select()
            hinweis.textContent = 'Kopieren ging nicht. Der Code ist markiert, bitte von Hand kopieren.'
          }
        },
      }),
      el('button.knopf.knopf-klein', {
        type: 'button',
        text: 'Abbrechen',
        onclick: () => dialog.close(),
      }),
      el('button.knopf.knopf-haupt', {
        type: 'button',
        text: 'Wechseln',
        onclick: async () => {
          const alt = altFeld.value.trim()
          const neu = anzeige.value.trim()
          if (!alt) {
            hinweis.textContent = 'Bitte den bisherigen Code eingeben.'
            return
          }
          if (
            !confirm(
              `Code wirklich wechseln?\n\nNeuer Code:\n${neu}\n\n` +
                'Bitte vorher sichern. Danach ist er nicht mehr abrufbar, und ' +
                'alle anderen Fenster werden abgemeldet.'
            )
          ) {
            return
          }

          hinweis.textContent = 'Wird gewechselt ...'
          const ergebnis = await Datenbank.wechsleCode(stand.token, alt, neu)

          if (!ergebnis.gelungen) {
            hinweis.textContent = ergebnis.meldung
            return
          }

          dialog.close()
          Zustand.melde(
            'erfolg',
            `Code gewechselt. ${ergebnis.hinausgeworfen} andere Sitzung(en) wurden abgemeldet. ` +
              'Dieses Fenster bleibt offen.'
          )
        },
      }),
    ]),
  ]))

  document.body.append(dialog)
  dialog.addEventListener('close', () => dialog.remove())
  dialog.showModal()
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
          // Die Fassung des gewaehlten Projekts wird mitgenommen. Ohne sie
          // wuesste das naechste Speichern nicht, auf welchem Stand es aufsetzt.
          Zustand.aendere({
            projekt: gewaehlt,
            fassung: fassungVon(gewaehlt),
            scheine: [],
            riesenscheine: [],
            bilder: new Map(),
          })
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
 * Die Ablage meldet ihre Wuensche ueber zwei Ereignisse.
 *
 * WARUM SO: oberflaeche/ansicht_ablage.js soll nichts von der Datenbank wissen
 * und nichts vom Nachladen. Sie zeigt an und meldet, was der Nutzer will. Das
 * Laden und Speichern bleibt hier, an EINER Stelle, zusammen mit dem Rest.
 *
 * Wer das umdreht und in der Ansicht speichert, hat zwei Stellen, die Projekte
 * schreiben, und die driften auseinander.
 */
function horcheAufAblage() {
  window.addEventListener('kombi-projekt-oeffnen', async (e) => {
    const id = /** @type {any} */ (e).detail?.id
    const stand = Zustand.hole()
    const gewaehlt = stand.projekte.find((p) => p.id === id)
    if (!gewaehlt || gewaehlt.id === stand.projekt?.id) return

    Zustand.aendere({
      projekt: gewaehlt,
      fassung: fassungVon(gewaehlt),
      scheine: [],
      riesenscheine: [],
      bilder: new Map(),
    })
    await ladeProjektinhalt(gewaehlt.id)
  })

  window.addEventListener('kombi-projekt-speichern', async (e) => {
    const projekt = /** @type {any} */ (e).detail?.projekt
    if (!projekt) return
    await speichereProjektAngaben(projekt)
  })
}

/**
 * Speichert Name, Ordner und Pin eines Projekts.
 *
 * ERST speichern, DANN anzeigen. Wer es umgekehrt macht, sieht eine Aenderung,
 * die es nie gegeben hat, und merkt es erst beim naechsten Laden. Genau diese
 * Fehlerklasse steht in UEBERGABE.md.
 *
 * @param {import('../kern/typen.js').Projekt} projekt
 */
async function speichereProjektAngaben(projekt) {
  const stand = Zustand.hole()
  const antwort = await Datenbank.speichereProjekt(stand.token, projekt, fassungVon(projekt))

  if (antwort.art === 'fehler') {
    Zustand.melde('warnung', `Nicht gespeichert: ${antwort.meldung}`)
    return
  }

  const zeile = Array.isArray(antwort.daten) ? antwort.daten[0] : antwort.daten
  if (!zeile) {
    // Null Zeilen zurueck heisst: es wurde nichts geschrieben. Das sieht sonst
    // genauso aus wie Erfolg, und beim naechsten Laden steht der alte Wert da.
    Zustand.melde('warnung', 'Nicht gespeichert: die Datenbank hat nichts zurueckgemeldet.')
    return
  }

  const frisch = ausDatenbankProjekt(zeile)
  Zustand.aendere({
    projekte: stand.projekte.map((p) => (p.id === frisch.id ? frisch : p)),
    projekt: stand.projekt?.id === frisch.id ? frisch : stand.projekt,
    fassung: stand.projekt?.id === frisch.id ? fassungVon(frisch) : stand.fassung,
  })
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

  const angelegt = Array.isArray(antwort.daten) ? antwort.daten[0] : antwort.daten

  Zustand.aendere({
    projekte: [projekt, ...stand.projekte],
    projekt,
    fassung: Number(angelegt?.fassung ?? 1),
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
    // Leeren zaehlt die Fassung hoch. Wer sie hier nicht nachzieht, bekommt
    // beim naechsten Speichern einen Widerspruch, den er selbst verursacht hat.
    fassung: Number(antwort.daten?.fassung ?? null) || null,
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
    // Was die Datenbank zurueckmeldet, ist massgeblich, nicht was hier gedacht wird.
    const zeileAngelegt = Array.isArray(angelegt.daten) ? angelegt.daten[0] : angelegt.daten
    projekt = { ...projekt, fassung: Number(zeileAngelegt?.fassung ?? 1) }
    projekte.push(projekt)
  }

  Zustand.aendere({ projekte, projekt, fassung: fassungVon(projekt), datenbankErreichbar: true })

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

  // Die Fassung wandert durch den ganzen Speichervorgang. Jeder Schritt zaehlt
  // sie hoch und gibt die neue zurueck, der naechste Schritt nimmt sie mit.
  // Ohne diese Weitergabe liefe der zweite Schritt gegen den ersten.
  let fassung = stand.fassung

  const scheine = await Datenbank.speichereScheine(
    stand.token,
    stand.projekt.id,
    stand.scheine,
    fassung
  )
  if (!scheine.gelungen) {
    if (scheine.widerspruch) {
      meldeWiderspruch(scheine.meldung)
      return
    }
    Zustand.aendere({ datenbankErreichbar: false })
    Zustand.melde('warnung', `Nicht alles konnte gesichert werden: ${scheine.meldung}`)
    return
  }
  fassung = scheine.fassung

  const riesenscheine = await Datenbank.speichereRiesenscheine(
    stand.token,
    stand.projekt.id,
    stand.riesenscheine,
    fassung
  )
  if (riesenscheine.art === 'fehler') {
    if (riesenscheine.code === Datenbank.WIDERSPRUCH) {
      meldeWiderspruch(riesenscheine.meldung)
      return
    }
    Zustand.aendere({ datenbankErreichbar: false })
    Zustand.melde('warnung', `Die Riesenscheine liessen sich nicht sichern: ${riesenscheine.meldung}`)
    return
  }
  fassung = Number(riesenscheine.daten?.fassung ?? fassung)

  Zustand.aendere({ fassung })

  if (!stand.datenbankErreichbar) {
    Zustand.aendere({ datenbankErreichbar: true })
  }
}, 2500)

/**
 * Jemand anderes hat dasselbe Projekt geaendert, waehrend hier gearbeitet wurde.
 *
 * Wichtig ist, was hier NICHT passiert: es wird nicht automatisch neu geladen.
 * Das wuerde die ungesicherte Arbeit in diesem Fenster wegwerfen, und zwar
 * genau die Arbeit, die der Schutz retten sollte. Der Mensch entscheidet.
 *
 * Die Arbeit liegt weiterhin auf dem Geraet, das Speichern dorthin ist oben
 * schon passiert. Es geht also nichts verloren, solange das Fenster offen bleibt.
 *
 * @param {string} grund
 */
function meldeWiderspruch(grund) {
  Zustand.melde(
    'warnung',
    'Dieses Projekt wurde an anderer Stelle geaendert, etwa in einem zweiten ' +
      'Fenster. Es wurde deshalb nichts ueberschrieben. Deine Arbeit liegt hier ' +
      'auf dem Geraet. Am besten diese Angaben notieren und die Seite neu laden, ' +
      `dann sind beide Staende zusammen sichtbar. (${grund})`
  )
  Zustand.aendere({ datenbankErreichbar: true })
}

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
 * Liest die Fassung, die an einem Projekt haengt.
 *
 * Fehlt sie, wird null geliefert und nicht etwa 1. Eine geratene 1 waere
 * schlimmer als gar keine: sie wuerde bei jedem Speichern einen Widerspruch
 * ausloesen, obwohl gar keiner vorliegt.
 *
 * @param {any} projekt
 * @returns {number|null}
 */
function fassungVon(projekt) {
  const wert = Number(projekt?.fassung)
  return Number.isFinite(wert) ? wert : null
}

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
    // Ablage: Ordner und Pin. Alte Zeilen haben die Felder noch nicht.
    ordner: String(zeile.ordner ?? ''),
    angepinnt: zeile.angepinnt === true,
    // Haengt am Projekt, damit beim Umschalten die richtige mitkommt.
    fassung: fassungVon(zeile),
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
