// @ts-check
/**
 * Viele Ausschnitte in einem Durchgang, mit EINER Fensterauswahl.
 *
 * WOZU
 *
 * Karam am 18.09.2026: "Bei jedem Riesenschein gibt es diesen Button. Neben
 * neuen Schein erstellen. Dass man einfach richtig viele Screenshots macht,
 * eine Preview dafuer, und dann funktionierendes Snipping, wo wirklich, man
 * muss nur auf diesen Knopf klicken und dann schon kann man sich aussuchen, was
 * man aus dem Bildschirm ausschneiden will."
 *
 * Und vorher schon, zweimal: "Kannst du Snipping-Tool so machen, dass es keinen
 * anderen Fenster oeffnet, sondern einfach direkt das ganze Bildschirm
 * mitnimmt." Und: "Nicht das ganze Bildschirm direkt mit, sondern das ganze
 * Bildschirm direkt projektiert, dass ich da was raussnippen kann."
 *
 * WARUM DAS NICHT bildschirmfoto.js ERLEDIGT
 *
 * Es gibt dort bereits alles, was ein einzelner Ausschnitt braucht. Nur endet
 * der Datenstrom zu frueh: nimmBildschirmAuf() beendet in seinem finally jede
 * Spur, und zwar BEVOR der Zuschnitt ueberhaupt erscheint. Fuer jedes weitere
 * Bild fragt der Browser deshalb wieder, welches Fenster freigegeben werden
 * soll. Genau dieses Fragefenster ist das "andere Fenster", das Karam nicht
 * will, und bei zwanzig Anbietern fragt es zwanzigmal.
 *
 * Und zeigeZuschnitt() loest genau einmal auf und raeumt sich weg. Karams Fall
 * "wenn mehrere Scheine in einem Bild sind" braucht aber mehrere Ausschnitte
 * aus DEMSELBEN Bild.
 *
 * Hier bleibt der Strom offen, bis Karam auf "Fertig" drueckt. Die Fensterwahl
 * kommt genau einmal, danach beliebig viele Bilder und aus jedem Bild beliebig
 * viele Ausschnitte.
 *
 * DIE DREI VORKEHRUNGEN AUS bildschirmfoto.js WERDEN GEERBT
 *
 * Sie stehen dort mit Datum, weil sie alle drei aus einem echten Vorfall
 * stammen, und sie gelten hier genauso:
 *
 *   1. requestVideoFrameCallback bekommt ein Sicherheitsnetz aus setTimeout.
 *      Ein verdecktes Fenster ruft den Bildrueckruf nie auf.
 *   2. Kein img.decode(). Am 13.09.2026 blieb es im verdeckten Fenster stumm
 *      haengen.
 *   3. platzMasse() faengt die Buehne von drei Bildpunkten ab. Gemessen am
 *      13.09.2026: Massstab 0,002, und darauf laesst sich kein Rahmen ziehen.
 *
 * DER MASSSTAB IST NUR DIE ANZEIGE
 *
 * Geschnitten wird IMMER aus den Originalpunkten des Videos, nie aus der
 * verkleinerten Anzeige. Ein aus der Anzeige geschnittenes Bild waere unscharf,
 * und unscharfe Ziffern sind genau das, woran die Texterkennung scheitert.
 *
 * Diese Datei setzt nur Klassennamen. Farben und Groessen stehen in stil/.
 */

import { el } from './werkzeug.js'
import { schneideAus } from '../bild/vorverarbeitung.js'
import {
  oeffneBildschirmstrom,
  greifeEinzelbild,
  beendeStrom,
} from './bildschirmfoto.js'

/**
 * Wie viele Bildaufbauten gewartet wird, bevor gegriffen wird.
 *
 * ZWEI, UND NICHT EINER. Wenn Karam denselben Bildschirm freigibt, auf dem das
 * Programm laeuft, nimmt das naechste Einzelbild die eigene Bedienschicht mit
 * auf: er fotografierte dann sich selbst. Deshalb wird die Schicht vorher
 * unsichtbar gemacht.
 *
 * Ein einzelnes requestAnimationFrame reicht dafuer nicht. Das Verstecken ist
 * erst nach dem NAECHSTEN Zeichnen des Browsers auf dem Schirm, und der
 * Bildschirmstrom sieht es erst danach. Zwei Aufbauten plus eine kurze
 * Nachwartezeit sind die Spanne, die im Versuch verlaesslich war.
 */
const AUFBAUTEN_BIS_GEGRIFFEN = 2

/** Nachwartezeit nach den Bildaufbauten, in Millisekunden. */
const NACHWARTEN = 60

/** @returns {Promise<void>} */
function naechsterAufbau() {
  return new Promise((weiter) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => weiter())
    else setTimeout(weiter, 16)
  })
}

/** @param {number} ms */
function warte(ms) {
  return new Promise((weiter) => setTimeout(weiter, ms))
}

/**
 * Der ganze Durchgang: Fenster einmal aussuchen, dann schneiden bis fertig.
 *
 * Gibt die geschnittenen Leinwaende in der Reihenfolge zurueck, in der sie
 * genommen wurden. Eine leere Liste heisst: nichts genommen oder abgebrochen.
 *
 * @returns {Promise<HTMLCanvasElement[]>}
 */
export async function schnipselDurchgang() {
  const { strom, video } = await oeffneBildschirmstrom()

  /** @type {HTMLCanvasElement[]} */
  const ausschnitte = []

  /** Das gerade eingefrorene Bild, aus dem geschnitten wird. */
  let standbild = await greifeEinzelbild(video)

  return new Promise((fertig) => {
    /** @type {{x: number, y: number, breite: number, hoehe: number}|null} */
    let rahmen = null
    let zieht = false
    let startX = 0
    let startY = 0
    let massstab = 1
    let beendet = false

    // --- Die Teile der Schicht ---

    const anzeige = /** @type {HTMLCanvasElement} */ (el('canvas.schnipsel-bild', {}))
    const markierung = el('.schnipsel-rahmen', {})
    const masse = el('.schnipsel-masse', { text: '' })
    const buehne = el('.schnipsel-buehne', {}, [anzeige, markierung, masse])

    const streifen = el('.schnipsel-streifen', {})
    const zaehler = el('.schnipsel-zaehler', { text: '' })

    const knopfNehmen = /** @type {HTMLButtonElement} */ (
      el('button.knopf.schnipsel-nehmen', { type: 'button', text: 'Ausschnitt nehmen' })
    )
    const knopfGanz = el('button.knopf.schnipsel-ganz', {
      type: 'button',
      text: 'Ganzes Bild nehmen',
    })
    const knopfNeu = el('button.knopf.schnipsel-neu', {
      type: 'button',
      text: 'Neues Bild holen',
      title: 'Holt den aktuellen Stand des freigegebenen Bildschirms. Taste: N',
    })
    const knopfFertig = el('button.knopf.knopf-haupt.schnipsel-fertig', {
      type: 'button',
      text: 'Fertig',
    })
    const knopfWeg = el('button.knopf.schnipsel-weg', {
      type: 'button',
      text: 'Alles verwerfen',
    })
    knopfNehmen.disabled = true

    const schicht = el('.schnipselschicht', {}, [
      el('.schnipsel-kopf', {}, [
        el('.schnipsel-titel', { text: 'Rahmen ziehen, Ausschnitt nehmen, weiter' }),
        el('.schnipsel-text', {
          text:
            'Der Bildschirm ist eingefroren. Zieh mit der Maus einen Rahmen um die Wetten, ' +
            'die zusammengehören, und nimm den Ausschnitt. Das geht mehrfach aus demselben Bild. ' +
            'Wenn drüben etwas anderes stehen soll: dort umschalten und dann "Neues Bild holen". ' +
            'Das Fenster wird kein zweites Mal abgefragt.',
        }),
        el('.schnipsel-tasten', {
          text: 'Eingabe = nehmen   ·   N = neues Bild   ·   Esc = fertig',
        }),
      ]),
      buehne,
      el('.schnipsel-sammlung', {}, [zaehler, streifen]),
      el('.schnipsel-leiste', {}, [
        knopfNehmen,
        knopfGanz,
        knopfNeu,
        knopfWeg,
        knopfFertig,
      ]),
    ])

    // --- Anzeige ---

    /**
     * Wie viel Platz die Buehne wirklich hat.
     *
     * Ein frisch eingehaengtes Element meldet gelegentlich noch fast nichts,
     * und ein verdecktes Fenster meldet null. Gemessen am 13.09.2026: Buehne 3
     * Bildpunkte, Massstab 0,002. Darauf laesst sich kein Rahmen ziehen.
     */
    function platzMasse() {
      const platz = buehne.getBoundingClientRect()
      if (platz.width >= 80 && platz.height >= 80) {
        return { breite: platz.width, hoehe: platz.height }
      }
      return {
        breite: Math.max(320, window.innerWidth - 32),
        hoehe: Math.max(240, window.innerHeight - 320),
      }
    }

    function zeichneAnzeige() {
      const platz = platzMasse()
      massstab = Math.min(1, platz.breite / standbild.width, platz.hoehe / standbild.height)
      anzeige.width = Math.max(1, Math.round(standbild.width * massstab))
      anzeige.height = Math.max(1, Math.round(standbild.height * massstab))
      const k = anzeige.getContext('2d')
      if (k) k.drawImage(standbild, 0, 0, anzeige.width, anzeige.height)
    }

    function zeigeRahmen() {
      if (!rahmen || rahmen.breite < 2 || rahmen.hoehe < 2) {
        markierung.classList.remove('sichtbar')
        masse.classList.remove('sichtbar')
        knopfNehmen.disabled = true
        return
      }
      const eck = anzeige.getBoundingClientRect()
      const buehneEck = buehne.getBoundingClientRect()
      markierung.classList.add('sichtbar')
      markierung.style.setProperty('--links', `${eck.left - buehneEck.left + rahmen.x * massstab}px`)
      markierung.style.setProperty('--oben', `${eck.top - buehneEck.top + rahmen.y * massstab}px`)
      markierung.style.setProperty('--breit', `${rahmen.breite * massstab}px`)
      markierung.style.setProperty('--hoch', `${rahmen.hoehe * massstab}px`)
      masse.classList.add('sichtbar')
      masse.textContent = `${Math.round(rahmen.breite)} x ${Math.round(rahmen.hoehe)} Bildpunkte`
      knopfNehmen.disabled = false
    }

    // --- Die Sammlung ---

    /**
     * Zeichnet den Vorschaustreifen neu.
     *
     * Die Miniaturen werden HIER verkleinert und nicht als volles Bild
     * angezeigt. bildspeicher.js haelt aus gutem Grund hoechstens 24 entpackte
     * Bilder: rund 11 MB je Stueck, und 300 Fotos auf einmal haben den Reiter
     * beim Laden getoetet. Zwanzig volle Leinwaende im Streifen waeren derselbe
     * Fehler an anderer Stelle.
     */
    function zeichneStreifen() {
      streifen.replaceChildren()
      zaehler.textContent =
        ausschnitte.length === 0
          ? 'Noch kein Ausschnitt genommen.'
          : ausschnitte.length === 1
            ? '1 Ausschnitt'
            : `${ausschnitte.length} Ausschnitte`

      ausschnitte.forEach((bild, i) => {
        const mini = /** @type {HTMLCanvasElement} */ (el('canvas.schnipsel-mini', {}))
        const hoehe = 64
        const breite = Math.max(1, Math.round((bild.width / bild.height) * hoehe))
        mini.width = breite
        mini.height = hoehe
        const k = mini.getContext('2d')
        if (k) k.drawImage(bild, 0, 0, breite, hoehe)

        streifen.append(
          el('.schnipsel-kachel', {}, [
            mini,
            el('span.schnipsel-nummer', { text: String(i + 1) }),
            el('button.schnipsel-kachelweg', {
              type: 'button',
              text: '×',
              title: `Ausschnitt ${i + 1} wieder verwerfen`,
              onclick: () => {
                ausschnitte.splice(i, 1)
                zeichneStreifen()
              },
            }),
          ])
        )
      })

      streifen.scrollLeft = streifen.scrollWidth
    }

    /** @param {{x: number, y: number, breite: number, hoehe: number}} bereich */
    function nimm(bereich) {
      ausschnitte.push(/** @type {HTMLCanvasElement} */ (schneideAus(standbild, bereich)))
      rahmen = null
      zeigeRahmen()
      zeichneStreifen()
    }

    // --- Ein neues Bild holen ---

    let holtGerade = false

    async function holeNeuesBild() {
      if (holtGerade || beendet) return
      holtGerade = true
      knopfNeu.setAttribute('disabled', 'disabled')
      try {
        /*
          ERST UNSICHTBAR MACHEN, DANN GREIFEN.

          Gibt Karam denselben Bildschirm frei, auf dem das Programm laeuft,
          faengt das naechste Einzelbild sonst diese Schicht mit ein, und er
          schneidet beim zweiten Mal aus einem Bild von sich selbst.

          visibility statt display: display none wuerfe das Seitenlayout weg und
          baute es danach neu auf, und dabei meldet die Buehne wieder drei
          Bildpunkte.
        */
        schicht.classList.add('schnipsel-weggeblendet')
        for (let i = 0; i < AUFBAUTEN_BIS_GEGRIFFEN; i += 1) await naechsterAufbau()
        await warte(NACHWARTEN)

        standbild = await greifeEinzelbild(video)
        rahmen = null
      } catch (fehler) {
        /*
          Der haeufigste Fall ist kein Fehler, sondern eine Entscheidung: Karam
          hat die Freigabe im Band des Browsers beendet. Dann ist der Strom tot
          und es gibt nichts mehr zu holen. Was schon geschnitten ist, bleibt.
        */
        schliesse(true)
        return
      } finally {
        schicht.classList.remove('schnipsel-weggeblendet')
        knopfNeu.removeAttribute('disabled')
        holtGerade = false
      }
      zeichneAnzeige()
      zeigeRahmen()
    }

    // --- Schliessen ---

    /** @param {boolean} behalten */
    function schliesse(behalten) {
      if (beendet) return
      beendet = true
      window.removeEventListener('resize', beiGroesse)
      window.removeEventListener('keydown', beiTaste)
      beendeStrom(strom, video)
      schicht.remove()
      fertig(behalten ? ausschnitte : [])
    }

    function beiGroesse() {
      zeichneAnzeige()
      zeigeRahmen()
    }

    /** @param {KeyboardEvent} e */
    function beiTaste(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        schliesse(true)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (rahmen && rahmen.breite >= 2 && rahmen.hoehe >= 2) nimm(rahmen)
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        holeNeuesBild()
      }
    }

    // --- Ziehen ---

    /** @param {PointerEvent} e */
    function stelle(e) {
      const eck = anzeige.getBoundingClientRect()
      return {
        x: Math.min(standbild.width, Math.max(0, (e.clientX - eck.left) / massstab)),
        y: Math.min(standbild.height, Math.max(0, (e.clientY - eck.top) / massstab)),
      }
    }

    anzeige.addEventListener('pointerdown', (e) => {
      const p = stelle(e)
      zieht = true
      startX = p.x
      startY = p.y
      rahmen = { x: p.x, y: p.y, breite: 0, hoehe: 0 }
      anzeige.setPointerCapture(e.pointerId)
      zeigeRahmen()
    })

    anzeige.addEventListener('pointermove', (e) => {
      if (!zieht) return
      const p = stelle(e)
      // Ueber Math.min und Math.abs, damit das Ziehen in jede Richtung geht.
      rahmen = {
        x: Math.min(startX, p.x),
        y: Math.min(startY, p.y),
        breite: Math.abs(p.x - startX),
        hoehe: Math.abs(p.y - startY),
      }
      zeigeRahmen()
    })

    for (const art of ['pointerup', 'pointercancel']) {
      anzeige.addEventListener(art, () => {
        zieht = false
        zeigeRahmen()
      })
    }

    // --- Knoepfe ---

    knopfNehmen.addEventListener('click', () => {
      if (rahmen && rahmen.breite >= 2 && rahmen.hoehe >= 2) nimm(rahmen)
    })
    knopfGanz.addEventListener('click', () => {
      nimm({ x: 0, y: 0, breite: standbild.width, hoehe: standbild.height })
    })
    knopfNeu.addEventListener('click', () => holeNeuesBild())
    knopfFertig.addEventListener('click', () => schliesse(true))
    knopfWeg.addEventListener('click', () => {
      ausschnitte.length = 0
      zeichneStreifen()
    })

    /*
      Endet die Freigabe im Band des Browsers, ist der Strom tot. Ohne diesen
      Horcher stuende Karam vor einem eingefrorenen Bild, das sich nicht mehr
      auffrischen laesst, ohne zu wissen warum.
    */
    for (const spur of strom.getVideoTracks()) {
      spur.addEventListener('ended', () => schliesse(true))
    }

    window.addEventListener('resize', beiGroesse)
    window.addEventListener('keydown', beiTaste)

    document.body.append(schicht)
    zeichneAnzeige()
    zeichneStreifen()
    // Nach dem Einhaengen noch einmal, siehe platzMasse.
    setTimeout(beiGroesse, 0)
  })
}
