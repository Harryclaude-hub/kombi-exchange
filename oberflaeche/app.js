// @ts-check
/**
 * Der Zusammenbau.
 *
 * Hier haengen Tor, Kopfleiste, Ansichten und das Speichern zusammen.
 * Gerechnet wird hier nichts.
 */

import { el, fuelle, such, neueKennung, jetzt, verzoegert, zeitText, ausschnittbild } from './werkzeug.js'
import * as Bildspeicher from './bildspeicher.js'
import { formatiere } from '../kern/geld.js'
import { rechneProjekt, barEinsatz } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'
import * as Nadeln from './nadeln.js'
import * as Ordner from './ordner.js'
import * as Reihenfolge from './reihenfolge.js'
// Eigene Fenster statt window.prompt, window.confirm und window.alert.
// Karam am 17.09.2026: "diese Pop-Ups vom Browser oben, das mag ich gar
// nicht." Siehe oberflaeche/dialog.js.
import * as Dialog from './dialog.js'
import * as Anleitung from './anleitung.js'
import * as Datenbank from '../daten/datenbank.js'
import { SITZUNG_SCHLUESSEL, EINSTELLUNG_SCHLUESSEL, PROGRAMM_FASSUNG } from '../daten/einstellungen.js'
import { merkeStand, holeStand, holeBilderZuProjekt, loescheBild, loescheBilderZuProjekt } from '../daten/ablage.js'
import { sorgeFuerAktuelleDateien } from '../daten/fassung.js'

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
  { schluessel: 'start', name: 'Übersicht', zeichen: 'U', zeichne: AnsichtStart.zeichne },
  { schluessel: 'positionen', name: 'Riesenscheine', zeichen: 'R', zeichne: AnsichtPositionen.zeichne },
  { schluessel: 'scheine', name: 'Scheine', zeichen: 'S', zeichne: AnsichtScheine.zeichne },
  { schluessel: 'aufnahme', name: 'Aufnahme', zeichen: 'A', zeichne: AnsichtAufnahme.zeichne },
  { schluessel: 'ausgabe', name: 'Ausgabe', zeichen: 'E', zeichne: AnsichtAusgabe.zeichne },
  { schluessel: 'ablage', name: 'Ablage', zeichen: 'L', zeichne: AnsichtAblage.zeichne },
  { schluessel: 'hilfe', name: 'Erklärung', zeichen: '?', zeichne: AnsichtHilfe.zeichne },
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
  /*
    EIN EIGENER ZUHOERER FUER DIE ORDNER BRAUCHT ES NICHT MEHR.

    Bis zur Fassung 2026-09-17-b lagen die Ordner neben dem Arbeitsstand, im
    Browserspeicher, und mussten sich von dort aus melden. Seit dem 17.09.2026
    steht der Ordner IM Riesenschein: er aendert sich ueber Zustand.setzeOrdner
    wie ein Name, und damit zeichnet der normale Weg ohnehin alles neu.
  */
  horcheAufAblage()

  const gemerkt = localStorage.getItem(SITZUNG_SCHLUESSEL) ?? ''
  if (gemerkt) {
    zeichneWarten('Zugang wird geprüft')
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
  probeModus = true
  Zustand.hoerZu(zeichneHuelle)
  Nadeln.hoerZu(zeichnePanel)
  zeichneHuelle()
}

/*
  Am 16.09.2026 gefunden: auf der Probeseite verschwand die ganze Oberfläche,
  sobald man den Farbumschalter drückte.

  Der Grund war kein Fehler im Programm. farbwahlknopf ruft zeichneAlles, und
  das prüft stand.angemeldet. Auf der Probeseite ist das absichtlich falsch,
  damit nichts in die Datenbank geschrieben wird. Also zeichnete es
  folgerichtig das Tor.

  Nur: eine Probeseite, auf der man das Thema nicht umschalten kann, taugt zum
  Prüfen von Farben wenig. Dieser Schalter sagt zeichneAlles, dass es die
  Hülle zeichnen soll, obwohl niemand angemeldet ist. Er wird AUSSCHLIESSLICH
  von zeichneFuerProbe gesetzt; im Programm bleibt er falsch, und dort
  entscheidet weiterhin allein stand.angemeldet.
*/
let probeModus = false

/** Zeichnet den Zustand neu. */
function zeichneAlles() {
  if (!wurzel) return
  const stand = Zustand.hole()
  if (!stand.angemeldet && !probeModus) {
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
    meldung.textContent = 'Wird geprüft ...'
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
          text:
            'Ein Zugang für alle. Wer den Code hat, sieht dieselben Projekte, Scheine und Zahlen. Nur die Bilddateien bleiben auf dem Gerät, auf dem sie hochgeladen wurden.',
        }),

        /*
          DER WEG ZURUECK, wenn der Code weg ist.

          Am 16.09.2026 stand Karam ohne Code da und fragte, wie er wieder
          hereinkommt. Am Tor stand darueber nichts, und das ist genau die
          Stelle, an der man die Frage hat.

          Der Code ist mit Absicht nicht abrufbar: in kombi.zugangscodes liegt
          nur ein bcrypt-Fingerabdruck. Das heisst, NIEMAND kann ihn
          zurueckrechnen, auch nicht, wer an die Datenbank kommt. Der Preis
          dafuer ist, dass es keine Frage "Code vergessen" gibt, die man
          beantworten koennte: es gibt nur den Weg, in der Datenbank einen
          neuen zu setzen.

          Ein <details> und kein eigener Zustand: es klappt auch dann auf,
          wenn stil/ fehlt, und es lenkt niemanden ab, der seinen Code hat.
        */
        el('details.tornotfall', {}, [
          el('summary', { text: 'Code verloren?' }),
          el('p', {
            text:
              'Der Code lässt sich nicht wiederherstellen. In der Datenbank steht nur sein ' +
              'Fingerabdruck, nicht er selbst. Das ist Absicht: so kann ihn auch niemand ' +
              'auslesen, der an die Datenbank kommt.',
          }),
          el('p', {
            text:
              'Du setzt dir einen neuen. Am einfachsten mit der Hilfsseite: sie würfelt einen ' +
              'Code in deinem Browser, baut den fertigen Befehl darum und hat zwei Knöpfe zum ' +
              'Kopieren. Du musst nichts tippen.',
          }),
          el('p', {}, [
            el('a.knopf.knopf-haupt', {
              href: 'werkzeug/code_setzen.html',
              text: 'Neuen Code setzen',
            }),
          ]),
          el('p', {
            text:
              'Wer es lieber von Hand macht: im Supabase SQL-Editor des Projekts appload einmal ' +
              'diese Zeile ausführen und DEIN-NEUER-CODE durch einen eigenen ersetzen, ' +
              'mindestens zwölf Zeichen, keine Leerzeichen.',
          }),
          el('pre.tornotfall-befehl', {
            text:
              [
                'update kombi.zugangscodes',
                "   set code_hash = extensions.crypt('DEIN-NEUER-CODE', extensions.gen_salt('bf', 12))",
                ' where aktiv;',
              ].join(ZEILENUMBRUCH),
          }),
          el('p', {
            text:
              'Dieselbe Zeile steht in NOTFALL.md im Quelltext. Bist du noch irgendwo ' +
              'angemeldet, geht es einfacher: dort oben im Kopf auf "Code wechseln".',
          }),
        ]),
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
      laufwert('MÖGLICH', formatiere(gesamt.auszahlungMoeglich, w, 'de'), 'gut'),
      // Solange nichts entschieden ist, sagt eine Null nichts. Dann ist
      // interessanter, was noch auf dem Spiel steht.
      // Siehe ansicht_start.js: null ist eine Aussage, kein Leerstand.
      gesamt.einsatzEntschieden > 0.005
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
        text: 'Erklärung',
        title: 'Erklärt jede Seite dieses Programms und wie man sich darin bewegt.',
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
        onclick: async () => {
          const ja = await Dialog.bestaetige({
            titel: 'Abmelden?',
            punkte: [
              'Es geht nichts verloren. Alles liegt in der Datenbank.',
              'Beim nächsten Mal brauchst du den Zugangscode wieder.',
              'Andere Fenster bleiben angemeldet.',
            ],
            ja: 'Abmelden',
          })
          if (!ja) return
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
 * Ein Zeilenumbruch als Wert.
 *
 * Steht als eigene Groesse da, weil der Notfallbefehl am Tor ueber drei Zeilen
 * geht. Ein Rueckstrich-n mitten in einer langen Zeichenkette ist genau die
 * Art Zeichen, die beim naechsten Umbau verrutscht, und dann steht im
 * Quelltext ein echter Umbruch, wo eine Zeichenkette sein sollte.
 */
const ZEILENUMBRUCH = String.fromCharCode(10)

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
        text: 'Neu würfeln',
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
          const ja = await Dialog.bestaetige({
            titel: 'Code wirklich wechseln?',
            text: `Neuer Code: ${neu}`,
            punkte: [
              'Schreib ihn dir VORHER auf. Danach ist er nicht mehr abrufbar.',
              'Alle anderen Fenster werden abgemeldet, auch die deines Kollegen.',
              'Dieses Fenster bleibt offen.',
            ],
            ja: 'Code wechseln',
            gefahr: true,
          })
          if (!ja) return

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
    /*
      DAS PLUSZEICHEN STEHT UNTER DEM PROJEKT, NICHT DANEBEN.

      Karam am 17.09.2026: "schau mal, Runde vom 16.09.2026. Darunter moechte
      ich ein Pluszeichen, da kann man Projekte hinzufuegen. Projekte sind halt
      wirklich so wie eigene Profile, die haben nichts mit dem anderen zu tun."

      Es gab den Knopf schon, er hiess "Neu" und stand RECHTS neben dem
      Auswahlfeld, zwischen "Neu" und "Leeren". Zwei kurze Woerter nebeneinander,
      von denen eines anlegt und eines ausraeumt: das ist genau die Reihe, in
      der man sich vergreift. Jetzt steht das Plus in einer eigenen Zeile
      darunter, mit ausgeschriebener Beschriftung, und "Leeren" daneben bleibt
      klein und leise.
    */
    el('button.knopf.knopf-klein.projektplus', {
      type: 'button',
      text: '+ Neues Projekt',
      title:
        'Legt ein neues Projekt an. Ein Projekt ist ein eigener Arbeitsplatz und ' +
        'teilt nichts mit den anderen.',
      onclick: async () => {
        /*
          KEIN DATUM IM PROJEKTNAMEN.

          Karam am 16.09.2026: "bitte oben bei so Runde 16.09., ich will, dass
          man da kein Datum hat, sondern einfach Projekt 1."

          "Runde vom 16.09." war fuer einen Spieltag gedacht. Ein Projekt
          traegt bei Karam eine ganze Saison. Ein Datum im Namen behauptet das
          Gegenteil und ist nach der zweiten Woche irrefuehrend. Durchgezaehlt
          wird deshalb, nicht datiert.

          WAS EIN PROJEKT IST, steht in der Rueckfrage mit dabei. Karam:
          "Projekte hinzufuegen, und zwar das wirklich wie ein komplett neuer
          Desktop. Wir haben nichts miteinander zu tun." Genau so ist es auch
          gebaut, und das soll man lesen, bevor man eines anlegt.
        */
        const stand = Zustand.hole()
        const antwort = await Dialog.frage({
          titel: 'Neues Projekt anlegen',
          text: 'Ein Projekt ist ein eigener Arbeitsplatz, wie ein zweiter Schreibtisch.',
          punkte: [
            'Nimm eines je Saison oder je Sportart. Zum Beispiel "NFL 2026/27".',
            'Es teilt NICHTS mit den anderen: keine Scheine, keine Riesenscheine, keine Bilder, keine Summen.',
            'Ordner liegen INNERHALB eines Projekts. Sie verbinden nie zwei Projekte.',
            'Das offene Projekt bleibt, wo es ist. Du kannst oben jederzeit zurückwechseln.',
          ],
          felder: [
            {
              name: 'name',
              beschriftung: 'Name des Projekts',
              wert: `Projekt ${stand.projekte.length + 1}`,
              hilfe: 'Kannst du später in der Ablage umbenennen.',
            },
          ],
          ja: 'Projekt anlegen',
        })
        if (antwort === null || !antwort.name) return
        await legeProjektAn(antwort.name)
      },
    }),
    el('button.knopf.knopf-winzig.projektleeren', {
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

    /*
      UND DIE BILDER AUS DER BROWSERDATENBANK.

      Bis zum 17.09.2026 wurde hier nur der Arbeitsstand geleert. Die Bilder
      blieben liegen, ohne Projekt, ohne Anzeige, ohne Weg sie je
      wiederzufinden: Waisen, die den Platz belegen, den die naechste Saison
      braucht. Bei Karams Mengen sind das Gigabyte je geloeschtem Projekt.

      Der Ordner auf der Platte bleibt UNANGETASTET. Er ist die Sicherung.
    */
    let geloeschteBilder = 0
    for (const projektId of weg) {
      try {
        geloeschteBilder += await loescheBilderZuProjekt(projektId)
      } catch (fehler) {
        Zustand.melde(
          'warnung',
          `Die Bilder des gelöschten Projekts blieben liegen: ${fehler instanceof Error ? fehler.message : String(fehler)}`
        )
      }
    }
    Bildspeicher.leere()

    if (aenderung.projekt) await ladeProjektinhalt(aenderung.projekt.id)
    const wieviel = weg.length === 1 ? 'Projekt gelöscht.' : `${weg.length} Projekte gelöscht.`
    Zustand.melde(
      'erfolg',
      geloeschteBilder > 0
        ? `${wieviel} ${geloeschteBilder} Bild(er) sind aus dem Browser verschwunden; ` +
            'in deinem Ordner auf der Platte liegen sie weiter.'
        : wieviel
    )
  }

  if (gescheitert.length > 0) {
    Zustand.melde('fehler', `Nicht gelöscht: ${gescheitert.join(' | ')}`)
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
    Zustand.melde('warnung', 'Nicht gespeichert: die Datenbank hat nichts zurückgemeldet.')
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
    Zustand.melde('warnung', `Das Projekt ließ sich nicht anlegen: ${antwort.meldung}`)
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
  const ja = await Dialog.bestaetige({
    titel: `Alles aus "${stand.projekt.name}" entfernen?`,
    punkte: [
      `${anzahl} Schein(e), alle Riesenscheine und alle Bilder dieses Projekts gehen weg.`,
      'Das Projekt selbst bleibt bestehen, nur leer.',
      'Rückgängig machen geht nicht.',
    ],
    ja: 'Projekt leeren',
    gefahr: true,
  })
  if (!ja) return

  Zustand.arbeite(true, 'Projekt wird geleert', 0.5)
  const antwort = await Datenbank.leereProjekt(stand.token, stand.projekt.id)
  Zustand.arbeite(false)

  if (antwort.art === 'fehler') {
    Zustand.melde('fehler', `Das Projekt ließ sich nicht leeren: ${antwort.meldung}`)
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

  // Die entpackten Bilder des VORIGEN Projekts gehoeren nicht zu diesem. Ohne
  // das bliebe ein viertel Gigabyte eines Projekts liegen, das gerade
  // zugeklappt wurde. Die Dateien bleiben, nur das Entpackte geht.
  Bildspeicher.leere()

  const riesenscheine = await Datenbank.holeRiesenscheine(stand.token, projektId)
  const rohe = Array.isArray(riesenscheine.daten) ? riesenscheine.daten : []
  Zustand.aendere({
    riesenscheine: rohe.map(ausDatenbankRiesenschein),
    ordnerGeteilt: ordnerWerdenGeteilt(rohe),
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

/*
  DIE LINKE SPALTE, jetzt dreistufig.

  Karam am 17.09.2026: "ganz links sind entweder Riesenscheine, wenn man noch
  keinen auf hat, oder wenn man einen Riesenschein aufmacht, kommt der in die
  Mitte, und ganz links werden dann alle Scheine angezeigt, die in diesem
  Riesenschein sind."

    Ebene 1   alle Riesenscheine, mit Ordnern, Filter und Anordnung
    Ebene 2   die Scheine des offenen Riesenscheins
    Ebene 3   dieselbe Liste, der offene Schein ist hervorgehoben

  In allen anderen Reitern traegt das Panel weiter das Angeheftete und das
  offene Projekt. Die Wege selbst stehen oben im Kopf und NICHT hier, seit
  Karam am 16.09.2026 sagte: "jetzt hast du irgendwie oben und unten zwei
  identische Symbole."
*/
function zeichnePanel() {
  const panel = such('#seitenpanel')
  if (!panel) return
  const stand = Zustand.hole()
  const schmal = panelSchmal()

  panel.dataset.schmal = String(schmal)

  const beiRiesenscheinen = stand.ansicht === 'positionen'
  const offener = beiRiesenscheinen
    ? (stand.riesenscheine.find((r) => r.id === stand.auswahl) ?? null)
    : null

  fuelle(panel, [
    el('.panelkopf', {}, [
      schmal
        ? null
        : el('span.paneltitel', {
            text: offener
              ? 'Scheine darin'
              : beiRiesenscheinen
                ? 'Riesenscheine'
                : 'Schnellzugriff',
          }),
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

    offener ? panelScheine(stand, offener, schmal) : null,
    beiRiesenscheinen && !offener ? panelRiesenscheine(stand, schmal) : null,
    beiRiesenscheinen ? null : panelSchnellzugriff(stand, schmal),
  ])
}

/**
 * Ebene 1: Ordnerwahl, Anordnung, dann alle Riesenscheine.
 *
 * @param {any} stand
 * @param {boolean} schmal
 * @returns {HTMLElement}
 */
function panelRiesenscheine(stand, schmal) {
  const ordner = Ordner.alleOrdner(stand.riesenscheine)
  const ohne = Ordner.anzahlOhneOrdner(stand.riesenscheine)
  const gesucht = String(stand.suche ?? '').trim() !== ''
  const sichtbar = Reihenfolge.ordne(
    stand.riesenscheine,
    {
      // Dieselbe Regel wie in der Mitte: wird gesucht, gilt kein Ordner.
      ordnerFilter: gesucht ? null : stand.ordnerFilter,
      sortierung: stand.sortierung,
      suche: stand.suche,
    },
    Zustand.rechnungVon,
    Zustand.scheineVon
  )
  const nachGeld = stand.sortierung === 'meisteGeld' || stand.sortierung === 'wenigsteGeld'

  /**
   * Ein Knopf, der einen Ordner waehlt.
   *
   * @param {string|null} wert
   * @param {string} beschriftung
   * @param {number} anzahl
   * @returns {HTMLElement}
   */
  const ordnerknopf = (wert, beschriftung, anzahl) =>
    el(
      'button.panelknopf.panelknopf-ordner',
      {
        type: 'button',
        daten: { offen: String(stand.ordnerFilter === wert) },
        title:
          wert === null
            ? 'Alle Riesenscheine des Projekts zeigen'
            : wert === Ordner.OHNE_ORDNER
              ? 'Nur die, die in keinem Ordner liegen'
              : `Den Ordner "${beschriftung}" aufmachen`,
        /*
          DERSELBE KLICK WIE AUF DIE KACHEL IN DER MITTE.

          Die Spalte links und die Uebersicht in der Mitte zeigen denselben
          Ordner. Wuerde hier nur gefiltert und dort aufgemacht, staende links
          etwas anderes als rechts, und niemand wuesste, wo er ist.

          auswahl und scheinAuswahl werden mit zurueckgesetzt: wer den Ordner
          wechselt, will die Uebersicht des Ordners sehen und nicht den
          Riesenschein, der zufaellig noch offen war.
        */
        onclick: () =>
          Zustand.aendere({ ordnerFilter: wert, auswahl: null, scheinAuswahl: null }),
        // Derselbe Ton wie an der Kachel in der Uebersicht: derselbe Ordner
        // sieht an beiden Stellen gleich aus.
        daten: { ton: wert && wert !== Ordner.OHNE_ORDNER ? Ordner.tonFuer(wert) : '' },
      },
      [
        el('span.panelzeichen', {
          // "Alle" und "ohne Ordner" sind keine Ordner, sondern Filter. Nur
          // der echte Ordner bekommt das Ordnerzeichen der Wettebene.
          daten: wert && wert !== Ordner.OHNE_ORDNER ? { stufe: 'ordner-riesenschein' } : {},
          text: wert === null ? '*' : wert === Ordner.OHNE_ORDNER ? '-' : 'O',
        }),
        schmal
          ? null
          : el('span.panelwette', {}, [
              el('span.panelname', { text: beschriftung }),
              el('span.panelzahl', { text: String(anzahl) }),
            ]),
      ]
    )

  return el('.panelgruppe', {}, [
    schmal ? null : el('.panelgruppentitel', { text: 'Ordner' }),
    ordnerknopf(null, 'Alle', stand.riesenscheine.length),
    ohne > 0 ? ordnerknopf(Ordner.OHNE_ORDNER, 'Ohne Ordner', ohne) : null,
    ...ordner.map((o) => ordnerknopf(o.name, o.name, o.anzahl)),

    /*
      DIE SUMME DES GEWAEHLTEN ORDNERS.

      Karam am 17.09.2026: "die Ordner werden auch miteinander gerechnet."

      Nur wenn wirklich EIN Ordner gewaehlt ist. Bei "Alle" staende hier
      dieselbe Zahl wie oben in der Kopfleiste, und dieselbe Zahl zweimal auf
      einem Bildschirm macht nur unsicher, ob es wirklich dieselbe ist.
    */
    !schmal && stand.ordnerFilter !== null && stand.ordnerFilter !== Ordner.OHNE_ORDNER
      ? ordnerbilanz(stand)
      : null,

    schmal
      ? null
      : el('label.panelanordnung', {}, [
          el('span.panelgruppentitel', { text: 'Anordnung' }),
          el(
            'select.feldwahl',
            {
              onchange: (e) =>
                Zustand.aendere({
                  sortierung: /** @type {HTMLSelectElement} */ (e.target).value,
                }),
            },
            Reihenfolge.SORTIERUNGEN.map((s) =>
              el('option', {
                value: s.schluessel,
                text: s.name,
                selected: s.schluessel === stand.sortierung ? 'selected' : null,
              })
            )
          ),

          /*
            NACH GELD ORDNEN UEBER MEHRERE WAEHRUNGEN HINWEG IST KEIN VERGLEICH.

            Gemessen am 17.09.2026 im Testkorpus: nach "Meistes Geld zuerst"
            stand 5.000,00 $ vor 1.600,00 €. Das stimmt hier zufaellig, weil
            1.600 Euro auch in Dollar weniger sind. Bei 1.600,00 $ und
            1.500,00 € stuende die falsche Reihe da, und niemand saehe es.

            UMGERECHNET WIRD NICHT. Es gibt in diesem Programm keinen Kurs, und
            einen zu erfinden waere genau das, was Projektregel 1 verbietet.
            Gesagt wird es stattdessen, und zwar da, wo man die Reihenfolge
            einstellt.
          */
          nachGeld && gemischteWaehrungen(sichtbar)
            ? el('span.panelanordnungwarnung', {
                text:
                  'Hier liegen mehrere Währungen nebeneinander. ' +
                  'Geordnet wird nach der bloßen Zahl, nicht umgerechnet.',
              })
            : null,
        ]),

    schmal
      ? null
      : el('.panelgruppentitel', {
          text: sichtbar.length === 1 ? '1 Riesenschein' : `${sichtbar.length} Riesenscheine`,
        }),

    sichtbar.length === 0 && !schmal
      ? el('p.panelleer', {
          text:
            stand.ordnerFilter === null
              ? 'Noch kein Riesenschein. Der grosse Knopf in der Mitte macht einen neuen auf.'
              : 'In diesem Ordner liegt gerade nichts.',
        })
      : null,

    ...sichtbar.map((r, i) => {
      const rechnung = Zustand.rechnungVon(r.id)
      const liegtIn = Ordner.ordnerVon(r)
      return el(
        'button.panelknopf.panelknopf-wette',
        {
          type: 'button',
          daten: { offen: 'false' },
          title: liegtIn
            ? `${r.name || 'Ohne Namen'}, im Ordner ${liegtIn}`
            : `${r.name || 'Ohne Namen'} aufmachen`,
          onclick: () => {
            Reihenfolge.merkeGeoeffnet(r.id)
            Zustand.aendere({ auswahl: r.id, scheinAuswahl: null })
          },
        },
        [
          /*
            DIE STUFE STEHT AM ZEICHEN, nicht daneben.

            Am 17.09.2026 nachgemessen: hier und in panelScheine stand
            dieselbe laufende Nummer im gleichen Kasten, einmal fuer einen
            Riesenschein und einmal fuer einen einzelnen Schein. Gleiche Zahl,
            gleicher Kasten, verschiedene Ebene. Eingeklappt ist die Spalte 56
            Pixel breit, und dann ist dieser Kasten fast alles, was zu sehen
            ist.

            Ein zweites Zeichen daneben passt dort nicht hin. Also faerbt das
            Merkmalswort den Kasten selbst ein, und die Nummer bleibt stehen.
            Welche Farbe dazugehoert, steht in stil/bauteile.css.
          */
          el('span.panelzeichen', { daten: { stufe: 'riesenschein' }, text: String(i + 1) }),
          schmal
            ? null
            : el('span.panelwette', {}, [
                el('span.panelname', { text: r.name || 'Ohne Namen' }),
                el('span.panelzahl', {
                  text: formatiere(rechnung.einsatzGesamt, rechnung.waehrung, 'de'),
                }),
                /*
                  DER ORDNER STEHT AN DER ZEILE.

                  Die Mitte zeigt bei "Alle" nur noch Ordner und das, was in
                  keinem liegt. Diese Spalte fuehrt weiter JEDEN Riesenschein
                  des Projekts, damit nichts unerreichbar wird (Projektregel 9).
                  Dann muss aber an der Zeile stehen, wo er liegt, sonst sucht
                  man ihn in der Mitte vergeblich.
                */
                liegtIn && stand.ordnerFilter === null
                  ? el('span.panelordner', { text: liegtIn })
                  : null,
              ]),
        ]
      )
    }),
  ])
}

/**
 * Ob in dieser Liste mehr als eine Waehrung vorkommt.
 *
 * Unbekannte Waehrungen zaehlen NICHT mit: ein Schein, auf dem kein Zeichen
 * stand, ist kein Beweis fuer eine zweite Waehrung, nur ein Beweis dafuer,
 * dass nichts dastand.
 *
 * @param {any[]} riesenscheine
 * @returns {boolean}
 */
function gemischteWaehrungen(riesenscheine) {
  const gesehen = new Set()
  for (const r of riesenscheine) {
    const w = Zustand.rechnungVon(r.id).waehrung
    if (w && w !== 'UNBEKANNT') gesehen.add(w)
    if (gesehen.size > 1) return true
  }
  return false
}

/**
 * Die Summe eines Ordners, zusammengezaehlt aus den Rechnungen des Kerns.
 *
 * @param {any} stand
 * @returns {HTMLElement}
 */
function ordnerbilanz(stand) {
  const s = Reihenfolge.ordnersumme(stand.riesenscheine, stand.ordnerFilter, Zustand.rechnungVon)

  /*
    EIGENE KLASSEN UND NICHT DIE DES PROJEKTBLOCKS.

    Hier standen zuerst .panelprojektname und .panelprojektzahl, geborgt vom
    Block "Dieses Projekt". Die sind aber fuer die Panelflaeche gemacht, und
    dieser Kasten hat eine eigene, getoente. Gemessen am 17.09.2026 im hellen
    Farbschema: 4,25 zu 1, also unter den geforderten 4,5.

    Eine Klasse, die woanders gemessen wurde, ist hier nicht gemessen.
  */
  if (s.gemischt) {
    return el('.panelordnersumme', {}, [
      el('.panelordnername', { text: stand.ordnerFilter }),
      el('.panelordneranzahl', {
        text: `${s.anzahl} Riesenscheine, Währungen gemischt, deshalb keine Summe`,
      }),
    ])
  }

  return el('.panelordnersumme', {}, [
    el('.panelordnername', { text: stand.ordnerFilter }),
    el('.panelordneranzahl', { text: `${s.anzahl} Riesenscheine zusammen` }),
    el('.panelordnerzeile', {}, [
      el('span', { text: 'gesetzt' }),
      el('span.panelzahl', { text: formatiere(s.einsatz, s.waehrung, 'de') }),
    ]),
    el('.panelordnerzeile', {}, [
      el('span', { text: 'kann zurück' }),
      el('span.panelzahl', { text: formatiere(s.moeglich, s.waehrung, 'de') }),
    ]),
  ])
}

/**
 * Ebene 2 und 3: die Scheine des offenen Riesenscheins.
 *
 * @param {any} stand
 * @param {any} riesenschein
 * @param {boolean} schmal
 * @returns {HTMLElement}
 */
function panelScheine(stand, riesenschein, schmal) {
  const scheine = Zustand.scheineVon(riesenschein.id)

  return el('.panelgruppe', {}, [
    /*
      ZURUECK ZU ALLEN RIESENSCHEINEN.

      Karam am 17.09.2026: "man kann dann auch auf Zurueck druecken." Der Weg
      zurueck steht GANZ OBEN in der Spalte, dort wo man ihn sucht, und nicht
      unter sechzig Scheinen.
    */
    el(
      'button.panelknopf.panelzurueck',
      {
        type: 'button',
        title: 'Zurück zu allen Riesenscheinen',
        onclick: () => Zustand.aendere({ auswahl: null, scheinAuswahl: null }),
      },
      [
        el('span.panelzeichen', { text: '<' }),
        schmal ? null : el('span.panelname', { text: 'Alle Riesenscheine' }),
      ]
    ),

    schmal ? null : el('.panelgruppentitel', { text: riesenschein.name || 'Ohne Namen' }),

    scheine.length === 0 && !schmal
      ? el('p.panelleer', {
          text: 'Noch kein Schein darin. Lade rechts ein Bildschirmfoto hoch, dann steht es hier.',
        })
      : null,

    ...scheine.map((s, i) => {
      const w = s.waehrung.wert ?? 'UNBEKANNT'
      return el(
        'button.panelknopf.panelknopf-schein',
        {
          type: 'button',
          daten: { offen: String(stand.scheinAuswahl === s.id), status: s.status },
          title:
            stand.scheinAuswahl === s.id
              ? 'Diesen Schein wieder zuklappen'
              : `Schein ${i + 1} gross aufmachen und bearbeiten`,
          onclick: () =>
            Zustand.aendere({
              scheinAuswahl: stand.scheinAuswahl === s.id ? null : s.id,
            }),
        },
        [
          // Violett und etwas leiser: eine Stufe tiefer als der Riesenschein.
          // Siehe panelRiesenscheine weiter oben.
          el('span.panelzeichen', { daten: { stufe: 'schein' }, text: String(i + 1) }),
          /*
            DAS BILD IST AUCH HIER DABEI, wenn auch nur als Daumennagel.

            Karam am 17.09.2026: "Kannst du immer bei jeder Angabe von den
            einzelnen Scheinen so machen, dass immer ein Bild dabei ist, wenn
            ein Bild hochgeladen ist. Das ist mir sehr wichtig, dass man immer
            die Bilder daneben hat. Wenn es mehrere Scheine gleichzeitig sind,
            dann ist einfach ein kleines Bild, und wenn man die Scheine dann
            aufmacht, dass die Bilder dann sichtbarer sind."

            Genau so: hier klein, in der Liste in der Mitte groesser, und am
            aufgemachten Schein gross. Ist das Bild nach einem Neuladen nicht
            mehr da, bleibt der leere Rahmen stehen: er sagt, dass hier ein
            Bild hingehoert.
          */
          schmal
            ? null
            : el('span.panelbild', {}, [
                ausschnittbild(stand.bilder.get(s.bildId), s.ausschnitt),
              ]),
          schmal
            ? null
            : el('span.panelwette', {}, [
                el('span.panelname', { text: s.buchmacher.wert ?? 'Anbieter offen' }),
                el('span.panelzahl', { text: formatiere(barEinsatz(s), w, 'de') }),
              ]),
        ]
      )
    }),
  ])
}

/**
 * Ueberall ausser bei den Riesenscheinen: das Angeheftete und das Projekt.
 *
 * Karam am 16.09.2026: "jetzt hast du irgendwie oben und unten zwei identische
 * Symbole." Die Wege stehen deshalb nur noch oben im Kopf. Was hier steht,
 * gibt es oben NICHT.
 *
 * @param {any} stand
 * @param {boolean} schmal
 * @returns {HTMLElement}
 */
function panelSchnellzugriff(stand, schmal) {
  const angeheftet = Nadeln.alle()
  const angehefteteWetten = stand.riesenscheine.filter((r) => angeheftet.includes(r.id))

  return el('.panelgruppe', {}, [
    schmal ? null : el('.panelgruppentitel', { text: 'Angeheftet' }),
    angehefteteWetten.length === 0 && !schmal
      ? el('p.panelleer', {
          text:
            'Noch nichts angeheftet. Klick die Nadel an einem Riesenschein an, ' +
            'dann steht er hier und ist von überall aus einen Klick entfernt.',
        })
      : null,
    ...angehefteteWetten.map((r) =>
      el(
        'button.panelknopf.panelknopf-wette',
        {
          type: 'button',
          daten: { offen: 'false' },
          title: r.name || 'Ohne Namen',
          onclick: () => {
            Reihenfolge.merkeGeoeffnet(r.id)
            Zustand.aendere({ ansicht: 'positionen', auswahl: r.id, scheinAuswahl: null })
          },
        },
        [
          el('span.panelzeichen', { text: '*' }),
          schmal ? null : el('span.panelname', { text: r.name || 'Ohne Namen' }),
        ]
      )
    ),

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
        schmal ? null : el('span.panelname', { text: 'Foto hinzufügen' }),
      ]
    ),
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
      Zustand.melde('warnung', `Das Projekt ließ sich nicht anlegen: ${angelegt.meldung}`)
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
  const roheRiesenscheine = Array.isArray(riesenscheine.daten) ? riesenscheine.daten : []
  /** @type {import('../kern/typen.js').Riesenschein[]} */
  const geladeneRiesenscheine = roheRiesenscheine.map(ausDatenbankRiesenschein)

  Zustand.aendere({
    riesenscheine: geladeneRiesenscheine,
    ordnerGeteilt: ordnerWerdenGeteilt(roheRiesenscheine),
  })
  if (scheine.daten.length > 0) {
    Zustand.ordneNeu(scheine.daten)
  }

  await ladeBilderVomGeraet(projekt.id)
  Zustand.melde(
    'erfolg',
    `${scheine.daten.length} Schein(e) geladen. Willkommen zurück.`
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
    name: 'Örtliches Projekt',
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

    /*
      HIER WIRD NICHTS ENTPACKT.

      Bis zum 17.09.2026 stand hier ein `await ladeBild(eintrag.inhalt)` je
      Bild, und damit lag beim Start JEDES Foto des Projekts entpackt im
      Arbeitsspeicher. Nachgerechnet an Karams Bildern: 1170 mal 2532 Punkte
      mal vier Byte sind 11 MB je Foto, gleich ob die Datei 300 KB hat. Bei
      dreihundert Fotos sind das 3,3 GB, und der Reiter stirbt beim Laden. Er
      rechnet mit zehntausend bis hunderttausend in einer Saison.

      Der Blob dagegen kostet fast nichts, er bleibt auf der Platte liegen.
      Entpackt wird erst, was jemand wirklich ansieht oder lesen laesst, und
      hoechstens vierundzwanzig Stueck gleichzeitig: oberflaeche/bildspeicher.js.
    */
    const bilder = new Map(Zustand.hole().bilder)
    for (const eintrag of abgelegt) {
      if (bilder.has(eintrag.id)) continue
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
        element: null,
        inhalt: eintrag.inhalt,
        karten: [],
        hinweise: [],
      })
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

  /*
    ZUERST DIE GELOESCHTEN, DANN DIE VORHANDENEN.

    speichereScheine schreibt die Liste, die da ist. Ein Schein, der aus der
    Liste verschwunden ist, verschwindet damit NICHT aus der Datenbank: beim
    naechsten Laden war er wieder da, und beim Kollegen war er nie weg.

    Zuerst loeschen und dann schreiben, nicht umgekehrt: haette jemand
    zwischendurch denselben Schein neu angelegt, wuerde ein Loeschen danach
    ihn wieder mitnehmen.

    Scheitert ein Loeschen, bleibt die Kennung in der Merkliste und der
    naechste Speicherlauf holt es nach. Deshalb wird nur vergessen, was
    wirklich weg ist.
  */
  const geloescht = []
  for (const kennung of stand.geloeschteScheine ?? []) {
    const antwort = await Datenbank.loescheSchein(stand.token, kennung)
    if (antwort.art !== 'fehler') geloescht.push(kennung)
  }
  if (geloescht.length > 0) Zustand.vergissGeloescht(geloescht)

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
    'Dieses Projekt wurde an anderer Stelle geändert, etwa in einem zweiten ' +
      'Fenster. Es wurde deshalb nichts ueberschrieben. Deine Arbeit liegt hier ' +
      'auf dem Gerät. Am besten diese Angaben notieren und die Seite neu laden, ' +
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
    // Vor supabase/migrations/0009 gibt es die Spalte nicht. Dann steht hier
    // ein leerer Text, und ordner.js greift auf die alte Zuordnung im Browser
    // zurueck, damit nichts verloren geht.
    ordner: String(zeile.ordner ?? ''),
    angelegtAm: String(zeile.angelegt_am ?? ''),
    geaendertAm: String(zeile.geaendert_am ?? ''),
  }
}

/**
 * Ob die Ordner wirklich geteilt werden, GEMESSEN statt geraten.
 *
 * Karam am 17.09.2026: "dieses Programm ist ein Account. Ich sehe jedes Foto,
 * jeden Schein, den eine Person macht, und die Person genauso bei mir."
 *
 * Ein Ordner wird nur dann geteilt, wenn kombi.riesenscheine die Spalte hat,
 * also wenn supabase/migrations/0009 gelaufen ist. Das laesst sich an den
 * Zeilen ablesen: kommt ordner mit, gibt es die Spalte.
 *
 * NICHT VERMUTEN, NACHSEHEN. Es waere leicht, im Programm einfach zu
 * behaupten, die Ordner wuerden geteilt. Am 17.09.2026 stand dort die
 * umgekehrte Behauptung, sie wuerden es nicht, und auch die war nur so lange
 * richtig, bis jemand die Spalte anlegt.
 *
 * Kommen GAR KEINE Zeilen, weiss es niemand, und dann bleibt es null. Ein
 * leeres Projekt beweist nichts.
 *
 * @param {any[]} zeilen
 * @returns {boolean|null}
 */
function ordnerWerdenGeteilt(zeilen) {
  if (!Array.isArray(zeilen) || zeilen.length === 0) return null
  return zeilen.every((z) => z !== null && typeof z === 'object' && 'ordner' in z)
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
