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
import * as Nadeln from './nadeln.js'
import * as Anleitung from './anleitung.js'
import * as Datenbank from '../daten/datenbank.js'
import { SITZUNG_SCHLUESSEL, EINSTELLUNG_SCHLUESSEL, PROGRAMM_FASSUNG } from '../daten/einstellungen.js'
import { merkeStand, holeStand, holeBilderZuProjekt, loescheBild } from '../daten/ablage.js'
import { sorgeFuerAktuelleDateien } from '../daten/fassung.js'
import { ladeBild } from '../bild/vorverarbeitung.js'

import * as AnsichtStart from './ansicht_start.js'
import * as AnsichtAufnahme from './ansicht_aufnahme.js'
import * as AnsichtAblage from './ansicht_ablage.js'
import * as AnsichtScheine from './ansicht_scheine.js'
import * as AnsichtPositionen from './ansicht_positionen.js'
import * as AnsichtAusgabe from './ansicht_ausgabe.js'
import * as AnsichtHilfe from './ansicht_hilfe.js'

/*
  Die Reiter, in der Reihenfolge, in der man sie braucht.

  UEBERSICHT STEHT VORNE, seit dem 16.09.2026. Karam: "Aufnahme soll bitte
  bleiben, aber nicht ins Mainpage. Ich will, dass eine Homepage, eine
  Uebersicht gemacht wird."

  Die Aufnahme ist nicht geloescht, sie ist nur nicht mehr das Erste, was man
  sieht. Bilder hochladen ist der Handgriff von zehn Minuten in der Woche;
  nachsehen, wie man steht, ist der Grund, warum man das Programm den Rest der
  Woche aufmacht.

  "zeichen" ist nur ein Textzeichen fuer das schmale Panel links. Es steht hier
  und nicht im CSS, weil es Inhalt ist und kein Aussehen: auch ohne stil/ soll
  in der Spur etwas stehen (Projektregel 5).
*/
const ANSICHTEN = [
  { schluessel: 'start', name: 'Uebersicht', zeichen: 'U', zeichne: AnsichtStart.zeichne },
  { schluessel: 'positionen', name: 'Riesenscheine', zeichen: 'R', zeichne: AnsichtPositionen.zeichne },
  { schluessel: 'scheine', name: 'Scheine', zeichen: 'S', zeichne: AnsichtScheine.zeichne },
  { schluessel: 'aufnahme', name: 'Aufnahme', zeichen: 'A', zeichne: AnsichtAufnahme.zeichne },
  { schluessel: 'ausgabe', name: 'Ausgabe', zeichen: 'E', zeichne: AnsichtAusgabe.zeichne },
  { schluessel: 'ablage', name: 'Ablage', zeichen: 'L', zeichne: AnsichtAblage.zeichne },
  { schluessel: 'hilfe', name: 'Erklaerung', zeichen: '?', zeichne: AnsichtHilfe.zeichne },
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

  // Die gemerkte Farbfassung ZUERST, noch vor allem anderen. Sonst blitzt die
  // dunkle Fassung kurz auf, bevor die helle greift.
  stelleFarbeHer()

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
  // Eine Nadel aendert nur das Panel, nicht den Arbeitsstand. Deshalb ein
  // eigener Zuhoerer und kein Umweg ueber den Zustand.
  Nadeln.hoerZu(zeichnePanel)
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

/**
 * Einstieg fuer werkzeug/probe/oberflaeche.html.
 *
 * WOZU: alles ausser den Probeseiten liegt hinter dem Zugangscode. Wer am
 * Design arbeitet und den Code nicht hat, konnte Uebersicht und Riesenscheine
 * nicht ansehen, also genau die beiden Ansichten, um die es geht. Gestalten,
 * ohne zu sehen, ist Raten (Projektregel 2).
 *
 * WARUM HIER UND NICHT IN EINER EIGENEN DATEI: die Probeseite soll DIESELBE
 * Zeichenarbeit sehen wie das Programm. Ein eigener Nachbau waere eine zweite
 * Fassung, die irgendwann anders aussieht als das Original, und dann gestaltet
 * man am Nachbau (Projektregel 8).
 *
 * WAS SIE NICHT TUT: sie meldet niemanden an. Der Zuhoerer, der Projekte
 * speichert, verlangt stand.angemeldet, und das bleibt auf der Probeseite
 * falsch. Die Vorschau kann deshalb nichts in die Datenbank schreiben.
 *
 * @param {HTMLElement} ziel  Das Element, in dem die Huelle schon steht.
 */
export function zeichneFuerProbe(ziel) {
  wurzel = ziel
  Zustand.hoerZu(zeichneHuelle)
  Nadeln.hoerZu(zeichnePanel)
  zeichneHuelle()
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
        // Kopfzeile und Navigation gehoeren ZUSAMMEN, nicht untereinander als
        // zwei fremde Leisten. Karam am 16.09.2026: "einfach das
        // Navigationssystem in den Header". Beide Kennungen bleiben, damit
        // zeichneKopf und zeichneReiter unveraendert weiterarbeiten.
        el('header.kopfleiste', {}, [
          el('.kopfoben', { id: 'kopfleiste' }),
          el('nav.reiterleiste', { id: 'reiterleiste' }),
        ]),
        // Das Panel links steht IMMER, auf jeder Ansicht.
        el('aside.seitenpanel', { id: 'seitenpanel' }),
        el('main.inhalt', { id: 'inhalt' }),
        // Die Hinweisleiste ersetzt die alten Kaesten in der Ecke. Sie liegt
        // im Fluss der Seite und verdeckt nichts.
        el('.hinweisleiste', { id: 'hinweisleiste' }),
        el('.arbeitsleiste', { id: 'arbeitsleiste' }),
      ]),
    ])
    inhalt = such('#inhalt')
  }

  zeichneKopf()
  zeichneReiter()
  zeichnePanel()
  zeichneHinweise()
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
      /*
        Der Erklaerungsknopf steht ZUERST und traegt die Hauptfarbe.

        Karam am 16.09.2026: "oben in den Header einfach einen Button
        hinzufuegen, der heisst Erklaerung, und zwar der erklaert jede einzelne
        Seite in der Website, wie man das navigieren soll."

        Er springt in die Erklaerung UND sagt ihr, wo man gerade war: wer auf
        der Ablage steht und nicht weiss, was das ist, landet beim Absatz ueber
        die Ablage und nicht am Anfang einer langen Seite.
      */
      el('button.knopf.knopf-haupt.erklaerknopf', {
        type: 'button',
        text: 'Erklaerung',
        title: 'Erklaert jede Seite dieses Programms und wie man sich darin bewegt.',
        onclick: () => {
          const her = Zustand.hole().ansicht
          Zustand.aendere({ ansicht: 'hilfe', hilfeZu: her === 'hilfe' ? null : her })
        },
      }),
      /*
        Die Anleitung laesst sich JEDERZEIT neu starten.

        Karam am 16.09.2026: "man kann dieses Tutorial nochmal starten, wenn
        man will." Sie laeuft von selbst beim ersten Anmelden in einem Browser;
        wer sie danach noch einmal braucht, soll nicht suchen muessen.

        Der Unterschied zur Erklaerung daneben: die Anleitung fuehrt in neun
        Schritten durch den Weg, die Erklaerung ist die Seite zum Nachschlagen.
      */
      el('button.knopf.knopf-klein.anleitungsknopf', {
        type: 'button',
        text: 'Anleitung',
        title: 'Die Anleitung noch einmal von vorne durchgehen.',
        onclick: () => Anleitung.zeige(),
      }),
      el('span.verbindung', {
        daten: { an: String(stand.datenbankErreichbar) },
        text: stand.datenbankErreichbar ? 'verbunden' : 'nur auf diesem Geraet',
        title: stand.datenbankErreichbar
          ? 'Die Daten werden in der Datenbank gesichert.'
          : 'Die Datenbank ist nicht erreichbar. Es wird nur oertlich gespeichert.',
      }),
      // Welche Fassung dieses Fenster geladen hat.
      //
      // WOZU: am 16.09.2026 stand Karam vor der veroeffentlichten Seite und
      // sah seine Aenderungen nicht. Der Grund war der Zwischenspeicher des
      // Browsers (GitHub Pages sagt max-age=600, also zehn Minuten ohne
      // Nachfrage). Ohne eine sichtbare Fassung laesst sich das nicht von
      // "es wurde nicht hochgeschickt" unterscheiden, und man sucht an der
      // falschen Stelle.
      //
      // Ein Klick erzwingt ein Neuladen mit der Fassung in der Adresse. Fuer
      // den Browser ist das eine andere Seite, also holt er sie wirklich neu.
      el('button.knopf.knopf-klein.fassungschip', {
        type: 'button',
        text: PROGRAMM_FASSUNG,
        title:
          `Dieses Fenster laeuft mit Fassung ${PROGRAMM_FASSUNG}. ` +
          'Klicken laedt die Seite neu und umgeht dabei den Zwischenspeicher des Browsers.',
        onclick: () => {
          const adresse = new URL(location.href)
          adresse.searchParams.set('f', `${PROGRAMM_FASSUNG}-${Date.now()}`)
          location.replace(adresse.toString())
        },
      }),
      farbwahlknopf(),
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

/** Unter welchem Schluessel die Farbwahl im Browser liegt. */
const FARBE_SCHLUESSEL = 'kombi-farbe'

/**
 * Der Umschalter zwischen heller und dunkler Fassung.
 *
 * DREI STUFEN, nicht zwei: "System" folgt der Einstellung des Betriebssystems,
 * und das ist die richtige Vorgabe, weil niemand sie waehlen musste. Wer es
 * anders will, waehlt hell oder dunkel und bekommt es ueberall gleich.
 *
 * HIER STEHT KEINE EINZIGE FARBE. Der Knopf setzt allein das Merkmal
 * data-farbe am Wurzelelement; welche Farben dazugehoeren, steht in
 * stil/marken.css. Wird stil/ geloescht, tut der Knopf nichts Sichtbares mehr
 * und alles rechnet unveraendert weiter (Projektregel 5).
 *
 * @returns {HTMLElement}
 */
function farbwahlknopf() {
  const stufen = [
    { wert: '', name: 'System', hilfe: 'Folgt der Einstellung des Betriebssystems' },
    { wert: 'hell', name: 'Hell', hilfe: 'Immer helle Fassung' },
    { wert: 'dunkel', name: 'Dunkel', hilfe: 'Immer dunkle Fassung' },
  ]
  const jetzige = document.documentElement.dataset.farbe ?? ''
  const i = Math.max(0, stufen.findIndex((s) => s.wert === jetzige))
  const stufe = stufen[i] ?? stufen[0]
  const naechste = stufen[(i + 1) % stufen.length] ?? stufen[0]

  return el('button.knopf.knopf-klein.farbwahl', {
    type: 'button',
    text: `Ansicht: ${stufe.name}`,
    title: `${stufe.hilfe}. Klicken schaltet auf: ${naechste.name}.`,
    onclick: () => {
      setzeFarbe(naechste.wert)
      zeichneAlles()
    },
  })
}

/**
 * Setzt die Farbfassung und merkt sie sich.
 *
 * @param {string} wert  leer heisst: der Einstellung des Systems folgen
 */
export function setzeFarbe(wert) {
  if (wert === '') delete document.documentElement.dataset.farbe
  else document.documentElement.dataset.farbe = wert
  try {
    if (wert === '') localStorage.removeItem(FARBE_SCHLUESSEL)
    else localStorage.setItem(FARBE_SCHLUESSEL, wert)
  } catch {
    // Ein Browser ohne Speicher (privates Fenster, gesperrte Seitendaten) darf
    // deswegen nicht die ganze Seite anhalten. Die Wahl gilt dann nur, solange
    // das Fenster offen ist.
  }
}

/** Holt die gemerkte Farbfassung beim Start. */
function stelleFarbeHer() {
  try {
    const wert = localStorage.getItem(FARBE_SCHLUESSEL)
    if (wert === 'hell' || wert === 'dunkel') document.documentElement.dataset.farbe = wert
  } catch {
    // Siehe oben.
  }
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

  window.addEventListener('kombi-projekte-loeschen', async (e) => {
    const ids = /** @type {any} */ (e).detail?.ids
    if (!Array.isArray(ids) || ids.length === 0) return
    await loescheProjekte(ids)
  })
}

/**
 * Loescht ein oder mehrere Projekte, mitsamt allem, was darin liegt.
 *
 * WARUM DAS BISHER GEFEHLT HAT: kombi_projekt_loeschen gibt es in der
 * Datenbank seit der ersten Migration, und Datenbank.loescheProjekt ruft es
 * auf. Nur hat diese Funktion niemand aufgerufen. In der Oberflaeche gab es
 * bloss "Projekt leeren". Karam am 16.09.2026: "ich will den irgendwie
 * loeschen, aber das funktioniert nicht ganz so gut". Es ging gar nicht.
 *
 * JEDES PROJEKT EINZELN, NICHT ALLE AUF EINMAL: geht eines schief, sollen die
 * uebrigen trotzdem verschwinden, und am Ende muss dastehen, was wirklich
 * passiert ist. Ein stiller Teilerfolg waere die schlimmere Auskunft.
 *
 * @param {string[]} ids
 */
async function loescheProjekte(ids) {
  const stand = Zustand.hole()
  /** @type {string[]} */
  const weg = []
  /** @type {string[]} */
  const gescheitert = []

  for (const id of ids) {
    const antwort = await Datenbank.loescheProjekt(stand.token, id)
    if (antwort.art === 'fehler') {
      const name = stand.projekte.find((p) => p.id === id)?.name ?? id
      gescheitert.push(`${name}: ${antwort.meldung}`)
    } else {
      weg.push(id)
    }
  }

  if (weg.length > 0) {
    const uebrig = stand.projekte.filter((p) => !weg.includes(p.id))
    /** @type {any} */
    const aenderung = { projekte: uebrig }

    // War das offene Projekt dabei, muss auch sein Inhalt aus dem Arbeitsstand
    // verschwinden. Sonst stehen Scheine eines Projekts auf dem Bildschirm,
    // das es nicht mehr gibt, und der naechste Speicherlauf schreibt sie
    // womoeglich wieder irgendwohin.
    if (stand.projekt && weg.includes(stand.projekt.id)) {
      aenderung.projekt = uebrig[0] ?? null
      aenderung.scheine = []
      aenderung.riesenscheine = []
      aenderung.bilder = new Map()
    }
    Zustand.aendere(aenderung)

    if (aenderung.projekt) await ladeProjektinhalt(aenderung.projekt.id)
    Zustand.melde(
      'erfolg',
      weg.length === 1 ? 'Projekt geloescht.' : `${weg.length} Projekte geloescht.`
    )
  }

  if (gescheitert.length > 0) {
    Zustand.melde('fehler', `Nicht geloescht: ${gescheitert.join(' | ')}`)
  }
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

/*
  DIE KAESTEN IN DER ECKE SIND WEG.

  Karam am 16.09.2026: "es kommen immer Anzeigen von rechts oben, die ich
  wegklicken muss, bitte entfernen, diese Anzeigen brauche ich nicht."

  Er hat recht, und der Grund stand im Code: in zustand.js steht MELDUNG_DAUER
  mit fehler: 0. Bestaetigungen verschwanden nach vier Sekunden von selbst,
  FEHLER nie. Genau die musste er also wegklicken, und genau die kommen bei
  sechzig Scheinen am haeufigsten.

  EINFACH WEGLASSEN GEHT TROTZDEM NICHT. Projektregel 9 sagt: Aussortiertes
  bleibt sichtbar. Ein Fehler, den niemand sieht, ist bei zwanzigtausend Euro
  Einsatz teurer als einer, den man wegklicken muss.

  Der Weg dazwischen: die schwebenden Kaesten fallen weg, an ihre Stelle tritt
  eine ruhige Leiste unten im Fluss der Seite. Sie verdeckt nichts, sie huepft
  nicht auf, sie will nicht weggeklickt werden. Es steht immer nur die neueste
  Zeile da, daneben wie viele weitere anstehen. Ein Klick klappt alle auf.

  Bestaetigungen erscheinen gar nicht mehr: dass etwas geklappt hat, sieht man
  daran, dass es dasteht.
*/

/** Ob die Hinweisleiste gerade aufgeklappt ist. Reine Anzeige. */
let hinweiseOffen = false

function zeichneHinweise() {
  const leiste = such('#hinweisleiste')
  if (!leiste) return
  const stand = Zustand.hole()

  // Nur was der Mensch wissen muss. Ein "gespeichert" braucht keine Zeile.
  const wichtig = stand.meldungen.filter((m) => m.art === 'fehler' || m.art === 'warnung')

  if (wichtig.length === 0) {
    fuelle(leiste, [])
    leiste.dataset.an = 'false'
    return
  }

  leiste.dataset.an = 'true'
  leiste.dataset.offen = String(hinweiseOffen)

  const neueste = wichtig[0]
  const rest = wichtig.length - 1

  fuelle(leiste, [
    el(
      'button.hinweiskopf',
      {
        type: 'button',
        'aria-expanded': String(hinweiseOffen),
        title: hinweiseOffen ? 'Zuklappen' : 'Alle Hinweise zeigen',
        onclick: () => {
          hinweiseOffen = !hinweiseOffen
          zeichneHinweise()
        },
      },
      [
        el('span.hinweismarke', {
          daten: { art: neueste.art },
          text: neueste.art === 'fehler' ? 'FEHLER' : 'ACHTUNG',
        }),
        el('span.hinweistext', { text: neueste.text }),
        rest > 0 ? el('span.hinweiszahl', { text: `und ${rest} weitere` }) : null,
        el('span.hinweispfeil', { text: hinweiseOffen ? 'zu' : 'auf' }),
      ]
    ),

    hinweiseOffen
      ? el(
          '.hinweisliste',
          {},
          wichtig.map((m) =>
            el('.hinweiszeile', { daten: { art: m.art } }, [
              el('span.hinweismarke', {
                daten: { art: m.art },
                text: m.art === 'fehler' ? 'FEHLER' : 'ACHTUNG',
              }),
              el('span.hinweistext', { text: m.text }),
              el('span.hinweiszeit', { text: zeitText(m.zeit).slice(-5) }),
              el('button.knopf.knopf-winzig', {
                type: 'button',
                text: 'x',
                title: 'Diesen Hinweis erledigen',
                onclick: () => Zustand.meldungWeg(m.id),
              }),
            ])
          )
        )
      : null,

    hinweiseOffen && wichtig.length > 1
      ? el('button.knopf.knopf-klein.hinweisalle', {
          type: 'button',
          text: 'Alle erledigen',
          onclick: () => {
            for (const m of wichtig) Zustand.meldungWeg(m.id)
          },
        })
      : null,
  ])
}

/*
  ------------------------------------------------------------------ Das Panel

  Karam am 16.09.2026: "ich moechte, dass man links ein Panel hat, der ist
  immer da, und dann kann man customizen, das ist einfach Shortcuts,
  irgendwelche Dateien, Daten und so weiter."

  Vier Gruppen, von oben nach unten:
    Wege        jede Ansicht als Knopf, die offene hervorgehoben
    Angeheftet  was Karam selbst dorthin gelegt hat
    Projekt     an welchem er gerade arbeitet, mit den Stueckzahlen
    Aufnehmen   der Weg, ein Foto nachzureichen, von jeder Ansicht aus

  WAS "CUSTOMIZEN" HIER HEISST: an jedem Riesenschein sitzt eine Nadel. Was
  angeheftet ist, steht oben im Panel und ist von jeder Ansicht aus einen Klick
  entfernt. Die Nadeln liegen im Browser dieses Geraets, nicht in der
  Datenbank: es ist eine Gewohnheit, keine Wahrheit ueber das Projekt, und auf
  einem zweiten Rechner darf sie eine andere sein.

  Eingeklappt bleibt die Spur mit den Zeichen stehen. Das Panel verschwindet
  nie ganz, denn Karam hat gesagt: "der ist immer da".
*/

/** Ob das Panel eingeklappt ist. */
const PANEL_SCHMAL_SCHLUESSEL = 'kombi-panel-schmal'

function panelSchmal() {
  try {
    return localStorage.getItem(PANEL_SCHMAL_SCHLUESSEL) === 'ja'
  } catch {
    return false
  }
}

function zeichnePanel() {
  const panel = such('#seitenpanel')
  if (!panel) return
  const stand = Zustand.hole()
  const schmal = panelSchmal()

  panel.dataset.schmal = String(schmal)

  const angeheftet = Nadeln.alle()
  const angehefteteWetten = stand.riesenscheine.filter((r) => angeheftet.includes(r.id))

  fuelle(panel, [
    el('.panelkopf', {}, [
      schmal ? null : el('span.paneltitel', { text: 'Schnellzugriff' }),
      el('button.knopf.knopf-winzig.panelfalten', {
        type: 'button',
        text: schmal ? '>' : '<',
        title: schmal ? 'Panel aufklappen' : 'Panel einklappen, die Spur bleibt stehen',
        'aria-label': schmal ? 'Panel aufklappen' : 'Panel einklappen',
        onclick: () => {
          try {
            localStorage.setItem(PANEL_SCHMAL_SCHLUESSEL, schmal ? 'nein' : 'ja')
          } catch {
            // ohne Gedaechtnis eben nur fuer dieses Fenster
          }
          zeichnePanel()
        },
      }),
    ]),

    el('nav.panelgruppe', { 'aria-label': 'Wege durch das Programm' }, [
      schmal ? null : el('.panelgruppentitel', { text: 'Wege' }),
      ...ANSICHTEN.map((a) =>
        el(
          'button.panelknopf',
          {
            type: 'button',
            daten: { offen: String(stand.ansicht === a.schluessel) },
            title: a.name,
            onclick: () => Zustand.aendere({ ansicht: a.schluessel }),
          },
          [
            el('span.panelzeichen', { text: a.zeichen }),
            schmal ? null : el('span.panelname', { text: a.name }),
          ]
        )
      ),
    ]),

    el('.panelgruppe', {}, [
      schmal ? null : el('.panelgruppentitel', { text: 'Angeheftet' }),
      angehefteteWetten.length === 0 && !schmal
        ? el('p.panelleer', {
            text:
              'Noch nichts angeheftet. Klick die Nadel an einem Riesenschein an, ' +
              'dann steht er hier und ist von ueberall aus einen Klick entfernt.',
          })
        : null,
      ...angehefteteWetten.map((r) =>
        el(
          'button.panelknopf.panelknopf-wette',
          {
            type: 'button',
            daten: {
              offen: String(stand.ansicht === 'positionen' && stand.auswahl === r.id),
            },
            title: r.name || 'Ohne Namen',
            onclick: () => Zustand.aendere({ ansicht: 'positionen', auswahl: r.id }),
          },
          [
            el('span.panelzeichen', { text: '*' }),
            schmal ? null : el('span.panelname', { text: r.name || 'Ohne Namen' }),
          ]
        )
      ),
    ]),

    el('.panelgruppe', {}, [
      schmal ? null : el('.panelgruppentitel', { text: 'Dieses Projekt' }),
      schmal
        ? null
        : el('.panelprojekt', {}, [
            el('.panelprojektname', { text: stand.projekt?.name || 'Kein Projekt' }),
            el('.panelprojektzahl', {
              text: `${stand.riesenscheine.length} Riesenscheine, ${stand.scheine.length} Scheine`,
            }),
          ]),
      el(
        'button.panelknopf',
        {
          type: 'button',
          title: 'Ein Foto aufnehmen und daraus einen Schein machen',
          onclick: () => Zustand.aendere({ ansicht: 'aufnahme' }),
        },
        [
          el('span.panelzeichen', { text: '+' }),
          schmal ? null : el('span.panelname', { text: 'Foto hinzufuegen' }),
        ]
      ),
    ]),
  ])
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

  // ZULETZT, nicht zuerst: die Anleitung legt sich ueber die Seite, und dahinter
  // soll schon etwas stehen. Ueber einem leeren Bildschirm zu erklaeren, wo was
  // liegt, hilft niemandem. Sie zeigt sich nur beim ERSTEN Mal in diesem
  // Browser; oben im Kopf laesst sie sich jederzeit neu starten.
  Anleitung.zeigeWennNeu()
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

  // Auch ohne Datenbank: wer zum ersten Mal in diesem Browser hereinkommt,
  // bekommt die Anleitung. Sie erklaert die Oberflaeche, und die steht auch
  // dann, wenn gerade nichts geladen werden konnte.
  Anleitung.zeigeWennNeu()
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
