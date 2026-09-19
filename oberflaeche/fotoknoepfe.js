// @ts-check
/**
 * Fotos hinzufuegen, von ueberall aus.
 *
 * Karam am 16.09.2026: "mach auch bitte so, dass man bei den Riesenscheinen
 * ueberall noch eine Aufnahme triggern kann und einfach ein Foto hinzufuegen
 * kann."
 *
 * WARUM DAS EINE EIGENE DATEI IST
 *
 * Die drei Wege (Bildschirmfoto, Zwischenablage, Datei) standen bisher nur in
 * ansicht_aufnahme.js. Haette ich sie fuer die Riesenscheine noch einmal
 * gebaut, gaebe es zwei Fassungen desselben Ablaufs, und die eine haette
 * irgendwann den Zuschnitt anders gemacht als die andere. Genau davor warnt
 * Projektregel 8.
 *
 * Jetzt stehen die Ablaeufe hier, und BEIDE Ansichten rufen dieselben auf.
 * Alle drei enden im selben nimmAuf wie bisher.
 *
 * Diese Datei setzt nur Klassennamen. Farben und Groessen stehen in stil/.
 */

import { el } from './werkzeug.js'
import * as Zustand from './zustand.js'
// nimmAufUndLiesSofort statt nimmAuf: ausserhalb des Reiters Aufnahme wird
// sofort gelesen, sonst tat der Knopf sichtbar nichts (C2, Fehlersuche vom
// 17.09.2026). Im Reiter Aufnahme bleibt der Ablauf mit "Jetzt lesen".
import { nimmAufUndLiesSofort } from './aufnahme.js'
import {
  kannBildschirmAufnehmen,
  kannZwischenablageLesen,
  ausZwischenablage,
  zeigeZuschnitt,
  alsDatei,
} from './bildschirmfoto.js'
import { schnipselDurchgang } from './schnipsel.js'

/**
 * Bildschirm ausschneiden: einmal fragen, dann so viele Ausschnitte wie noetig.
 *
 * ERSETZT DEN FRUEHEREN EINZELSCHUSS.
 *
 * Bis zum 18.09.2026 stand hier bildschirmfotoMachen(): ein Bild, ein
 * Ausschnitt, Strom zu. Fuer jedes weitere Bild fragte der Browser wieder,
 * welches Fenster freigegeben werden soll. Bei zwanzig Anbietern zwanzigmal.
 *
 * Karam dazu, zweimal: "Kannst du Snipping-Tool so machen, dass es keinen
 * anderen Fenster oeffnet." Und: "Man muss nur auf diesen Knopf klicken und
 * dann schon kann man sich aussuchen, was man aus dem Bildschirm ausschneiden
 * will."
 *
 * Es gibt jetzt nur noch diesen einen Weg und nicht zwei nebeneinander. Der
 * alte konnte nichts, was der neue nicht auch kann: wer ein einziges Bild
 * will, nimmt einen Ausschnitt und drueckt Fertig. Zwei Fassungen desselben
 * Ablaufs waeren Projektregel 8.
 *
 * ALLE AUSSCHNITTE GEHEN IN EINEM ZUG WEITER. nimmAuf nimmt eine Liste, und
 * damit laeuft der Fortschrittsbalken einmal sauber durch, statt die
 * Oberflaeche zwanzigmal neu zu zeichnen.
 *
 * @returns {Promise<void>}
 */
export async function bildschirmAusschneiden() {
  try {
    const ausschnitte = await schnipselDurchgang()
    if (ausschnitte.length === 0) {
      Zustand.melde('info', 'Kein Ausschnitt genommen.')
      return
    }

    /*
      DER NAME BEKOMMT EINE LAUFENDE NUMMER.

      alsDatei benennt sekundengenau. In einer schnellen Serie entstehen zwei
      Ausschnitte in derselben Sekunde und heissen dann gleich. Verloren geht
      dabei nichts, die Pruefsumme unterscheidet sie, aber in der Liste haette
      Karam zweimal denselben Namen und wuesste nicht, welcher welcher ist.
    */
    const dateien = []
    for (let i = 0; i < ausschnitte.length; i += 1) {
      dateien.push(await alsDatei(ausschnitte[i], `schnipsel-${String(i + 1).padStart(2, '0')}`))
    }

    await nimmAufUndLiesSofort(dateien)
  } catch (fehler) {
    // Ein Abbruch im Auswahlfenster des Browsers ist kein Fehler, sondern eine
    // Entscheidung. Er darf deshalb nicht rot gemeldet werden.
    const text = fehler instanceof Error ? fehler.message : String(fehler)
    const abgebrochen =
      fehler instanceof DOMException &&
      (fehler.name === 'NotAllowedError' || fehler.name === 'AbortError')
    if (abgebrochen) Zustand.melde('info', 'Kein Bildschirmfoto gemacht.')
    else Zustand.melde('fehler', `Bildschirmfoto misslungen: ${text}`)
  }
}

/**
 * Aus der Zwischenablage holen, zuschneiden, aufnehmen lassen.
 *
 * @returns {Promise<void>}
 */
export async function ausZwischenablageHolen() {
  try {
    const bild = await ausZwischenablage()
    if (!bild) {
      Zustand.melde('warnung', 'In der Zwischenablage liegt kein Bild.')
      return
    }
    const ausschnitt = await zeigeZuschnitt(bild)
    if (!ausschnitt) {
      Zustand.melde('info', 'Bild verworfen.')
      return
    }
    await nimmAufUndLiesSofort([await alsDatei(ausschnitt, 'zwischenablage')])
  } catch (fehler) {
    Zustand.melde(
      'fehler',
      `Zwischenablage: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
  }
}

/**
 * Die Knopfreihe zum Fotohinzufuegen.
 *
 * WOHIN DIE BILDER GEHEN: immer in das offene Projekt, egal aus welcher
 * Ansicht der Knopf gedrueckt wurde. Es gibt genau einen Arbeitsstand, und die
 * Aufnahme haengt nicht daran, welcher Reiter gerade oben ist.
 *
 * NACH DEM AUFNEHMEN WIRD NICHT GEWECHSELT. Wer aus dem Riesenschein heraus
 * ein Foto nachreicht, will dort bleiben und sehen, dass die Zahl der Bilder
 * gestiegen ist. Ein erzwungener Ansichtswechsel waere genau das Gegenteil von
 * "nebenbei ein Foto hinzufuegen".
 *
 * @param {object} [einstellungen]
 * @param {boolean} [einstellungen.kompakt]  Kleine Knoepfe fuer eine Seitenleiste.
 * @param {string} [einstellungen.titel]     Ueberschrift ueber den Knoepfen.
 * @returns {HTMLElement}
 */
export function fotoknoepfe(einstellungen = {}) {
  const kompakt = einstellungen.kompakt === true
  const klasse = kompakt ? 'button.knopf.knopf-klein' : 'button.knopf'

  const eingabe = el('input.versteckt', {
    type: 'file',
    accept: 'image/*',
    multiple: 'multiple',
    onchange: async (e) => {
      const ziel = /** @type {HTMLInputElement} */ (e.target)
      if (ziel.files && ziel.files.length > 0) await nimmAufUndLiesSofort(ziel.files)
      // Zuruecksetzen, sonst laesst sich dieselbe Datei nicht zweimal waehlen.
      ziel.value = ''
    },
  })

  const knoepfe = []

  if (kannBildschirmAufnehmen()) {
    knoepfe.push(
      el(`${klasse}.foto-bildschirm`, {
        type: 'button',
        text: 'Bildschirm ausschneiden',
        title:
          'Einmal das Fenster aussuchen, dann beliebig viele Ausschnitte. ' +
          'Eingabe nimmt, N holt ein neues Bild, Esc ist fertig.',
        onclick: async (e) => {
          e.stopPropagation()
          await bildschirmAusschneiden()
        },
      })
    )
  }

  if (kannZwischenablageLesen()) {
    knoepfe.push(
      el(`${klasse}.foto-ablage`, {
        type: 'button',
        text: 'Aus Zwischenablage',
        title: 'Erst mit Windows-Taste + Umschalt + S ausschneiden, dann hier drücken.',
        onclick: async (e) => {
          e.stopPropagation()
          await ausZwischenablageHolen()
        },
      })
    )
  }

  knoepfe.push(
    el(`${klasse}.foto-datei`, {
      type: 'button',
      text: 'Foto hochladen',
      title: 'Eine oder mehrere Bilddateien auswählen.',
      onclick: (e) => {
        e.stopPropagation()
        eingabe.click()
      },
    })
  )

  return el('.fotoknoepfe', { daten: { kompakt: String(kompakt) } }, [
    einstellungen.titel ? el('.fotoknoepfe-titel', { text: einstellungen.titel }) : null,
    el('.fotoknoepfe-reihe', {}, knoepfe),
    eingabe,
  ])
}
