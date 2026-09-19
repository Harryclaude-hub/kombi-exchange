// @ts-check
/**
 * Das Programm herunterladen und als richtiges Programm oeffnen.
 *
 * Karam am 18.09.2026: "Ich will, dass du jetzt in einem Zug das Programm als
 * eine Download-Website machst. Das heisst, ich habe den Button, das zu
 * downloaden. In deinem Desktop oder auf mein Handy."
 *
 * WAS HIER "HERUNTERLADEN" HEISST
 *
 * Kein Installationsprogramm und keine Datei zum Doppelklicken. Der Browser
 * legt das Programm selbst ab: ein eigenes Fenster ohne Adresszeile, ein
 * Symbol auf dem Schreibtisch beziehungsweise auf dem Startbildschirm, und es
 * laeuft auch ohne Netz weiter. Fuer Karam ist der Unterschied zu einem
 * herkoemmlichen Programm nach dem ersten Klick keiner mehr, und es gibt nichts
 * zu aktualisieren: die naechste Fassung ist beim naechsten Oeffnen da.
 *
 * WARUM DAS ANGEBOT IN EINER MODULVARIABLEN LIEGT
 *
 * Der Browser meldet sich EINMAL von sich aus mit beforeinstallprompt, und
 * zwar irgendwann nach dem Laden. zeichneKopf() in app.js baut die Kopfleiste
 * bei jeder Zustandsaenderung komplett neu. Laege das Angebot im Knopf, waere
 * es beim ersten Neuzeichnen weg, und der Knopf koennte nie wieder etwas.
 * Deshalb liegt es hier, ausserhalb jeder Zeichenfunktion, und der Kopf wird
 * benachrichtigt, wenn sich etwas aendert. Genauso macht es nadeln.js.
 *
 * KEIN SCHNUEFFELN NACH DEM GERAET
 *
 * Es wird nirgends gefragt, ob das ein iPhone ist. Der Unterschied, auf den es
 * ankommt, ist nicht "welches Geraet", sondern "kam ein Angebot oder nicht",
 * und genau das steht hier in einer Variablen. Safari auf dem iPhone schickt
 * kein beforeinstallprompt und wird es nie tun; dort bekommt Karam den Weg ueber
 * "Teilen" erklaert. Dieselbe Antwort passt auch fuer Firefox und fuer ein
 * Chrome, das sich einfach noch nicht gemeldet hat.
 *
 * Diese Datei setzt nur Klassennamen. Farben und Groessen stehen in stil/.
 */

import { el } from './werkzeug.js'
import { sag } from './dialog.js'
import { PROGRAMM_FASSUNG } from '../daten/einstellungen.js'

/**
 * Das abgefangene Angebot des Browsers, oder null.
 *
 * @type {any}
 */
let angebot = null

/** @type {Set<() => void>} */
const zuhoerer = new Set()

/** Wurde der Dienstarbeiter angemeldet? Nur fuer die Standanzeige. */
let dienstarbeiterLaeuft = false

function sagBescheid() {
  for (const was of zuhoerer) {
    try {
      was()
    } catch (fehler) {
      // Ein Zuhoerer, der stolpert, darf die anderen nicht mitnehmen.
      console.error('[Installieren]', fehler)
    }
  }
}

/**
 * Wer benachrichtigt werden will, wenn sich der Zustand des Knopfs aendert.
 *
 * @param {() => void} was
 */
export function hoerZu(was) {
  zuhoerer.add(was)
}

/** Laeuft das Programm bereits als eigenstaendiges Fenster? */
export function laeuftAlsProgramm() {
  if (typeof window === 'undefined') return false
  // navigator.standalone ist der Weg des iPhones, matchMedia der aller anderen.
  const wieIphone = /** @type {any} */ (window.navigator).standalone === true
  const wieAndere =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return wieIphone || wieAndere
}

/**
 * Faengt die Meldungen des Browsers ab. Einmal beim Start rufen.
 */
export function horcheAufAngebot() {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (ereignis) => {
    /*
      preventDefault ist Pflicht. Ohne es blendet Chrome seine eigene kleine
      Leiste unten ein, und dann haette Karam zwei Wege zum selben Ziel, von
      denen der eine nicht zum Programm gehoert.
    */
    ereignis.preventDefault()
    angebot = ereignis
    sagBescheid()
  })

  window.addEventListener('appinstalled', () => {
    // Das Angebot ist damit verbraucht, und der Knopf soll seinen dritten
    // Zustand zeigen, ohne dass jemand die Seite neu laedt.
    angebot = null
    sagBescheid()
  })
}

/**
 * Meldet den Dienstarbeiter an. Am ENDE des Starts rufen.
 *
 * Nach der Fassungspruefung, nicht davor: die Pruefung soll bei ihrem ersten
 * Lauf ein unverfaelschtes Bild vom Netz bekommen.
 *
 * @returns {Promise<void>}
 */
export async function meldeDienstarbeiterAn() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // Ueber file:// gibt es keinen Dienstarbeiter, und das ist kein Fehler.
  if (typeof location !== 'undefined' && location.protocol === 'file:') return

  try {
    await navigator.serviceWorker.register('./dienstarbeiter.js', {
      scope: './',
      /*
        updateViaCache: 'none' ist hier das Wichtigste.

        Sonst darf der Browser den Dienstarbeiter selbst aus seinem eigenen
        Zwischenspeicher nehmen, und GitHub Pages schickt max-age=600. Das waere
        derselbe Vorfall wie am 16.09.2026 mit den alten Programmdateien, nur
        eine Ebene tiefer und schlimmer: ein alter Dienstarbeiter lebt laenger
        als eine alte Datei.
      */
      updateViaCache: 'none',
    })
    dienstarbeiterLaeuft = true
    sagBescheid()
  } catch (fehler) {
    // Ein Fehlschlag ist kein Drama: dann laeuft das Programm wie bisher, nur
    // ohne Offlinebetrieb. Das darf Karam nicht mit einer roten Meldung stoeren.
    console.warn('[Installieren] Der Dienstarbeiter liess sich nicht anmelden.', fehler)
  }
}

/**
 * Der Knopf fuer die Kopfleiste. Drei Zustaende, eine Stelle.
 *
 * @returns {HTMLElement}
 */
export function installierknopf() {
  if (laeuftAlsProgramm()) {
    return el('button.knopf.knopf-klein.installknopf.installknopf-fertig', {
      type: 'button',
      text: 'Als App geöffnet',
      title: 'Kombi Exchange läuft als eigenständiges Programm.',
      onclick: () =>
        sag({
          titel: 'Läuft als Programm',
          text: 'Kombi Exchange ist installiert und läuft in einem eigenen Fenster.',
          punkte: [
            `Fassung ${PROGRAMM_FASSUNG}.`,
            dienstarbeiterLaeuft
              ? 'Ohne Netz bleibt alles sichtbar und du kannst Excel ausgeben. Neue Bilder lesen geht dann nicht.'
              : 'Der Offlinebetrieb ist in diesem Fenster noch nicht eingerichtet. Einmal neu öffnen.',
            'Zum Entfernen: im Fenstermenü oben rechts auf "Deinstallieren".',
          ],
          fuss: 'Es gibt nichts zu aktualisieren. Die nächste Fassung ist beim nächsten Öffnen da.',
        }),
    })
  }

  return el('button.knopf.knopf-klein.installknopf', {
    type: 'button',
    text: 'App installieren',
    title: 'Legt Kombi Exchange als eigenes Programm ab, auf dem Rechner oder auf dem Handy.',
    onclick: async () => {
      if (angebot) {
        /*
          Ein Angebot laesst sich genau EINMAL verwenden. Danach muss es weg,
          sonst drueckt Karam ein zweites Mal und nichts passiert, ohne dass
          jemand sagt warum.
        */
        const dieses = angebot
        angebot = null
        try {
          await dieses.prompt()
          await dieses.userChoice
        } catch (fehler) {
          console.warn('[Installieren]', fehler)
        }
        sagBescheid()
        return
      }

      await sag({
        titel: 'So legst du Kombi Exchange ab',
        text: 'Dieser Browser bietet die Installation nicht von selbst an. Von Hand geht sie trotzdem.',
        punkte: [
          'iPhone und iPad, Safari: unten auf "Teilen", dann "Zum Home-Bildschirm".',
          'Android, Chrome: oben rechts das Dreipunktmenü, dann "App installieren" oder "Zum Startbildschirm".',
          'Windows und Mac, Chrome oder Edge: rechts in der Adresszeile das kleine Bildschirmsymbol, oder Menü, dann "Installieren".',
          'Firefox kann es am Rechner nicht. Dort bleibt der Reiter, und das reicht auch.',
        ],
        fuss: 'Danach steht das Symbol auf dem Schreibtisch oder dem Startbildschirm, und es öffnet sich ohne Adresszeile.',
      })
    },
  })
}
