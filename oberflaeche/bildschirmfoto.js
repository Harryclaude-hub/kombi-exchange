// @ts-check
/**
 * Bildschirmfoto direkt am Rechner machen und zuschneiden.
 *
 * WOZU
 *
 * Bisher konnte Karam nur fertige Dateien hochladen. Er musste also erst mit
 * dem Betriebssystem ein Bildschirmfoto machen, es irgendwo ablegen, den
 * Ordner wiederfinden und die Datei heraussuchen. Bei zwanzig Wetten bei
 * zwanzig Anbietern sind das zwanzig Wege durch den Dateiexplorer.
 *
 * Hier geht es in einem Zug: Knopf druecken, Fenster aussuchen, Rahmen um die
 * Wettliste ziehen, fertig. Der Ausschnitt geht auf demselben Weg weiter wie
 * eine hochgeladene Datei, es aendert sich also nichts an der Auswertung.
 *
 * DREI WEGE, UND WARUM ES DREI SIND
 *
 *   1. Bildschirm aufnehmen. Der Browser fragt, welches Fenster. Danach kommt
 *      der Zuschnitt. Braucht eine sichere Verbindung (https oder localhost).
 *   2. Aus der Zwischenablage. Wer lieber das Windows-Werkzeug benutzt
 *      (Windows-Taste + Umschalt + S), drueckt danach einfach Strg+V.
 *      Dieser Weg braucht keine Erlaubnis und geht immer.
 *   3. Datei hochladen, wie bisher.
 *
 * Weg 2 ist bewusst dabei: Weg 1 kann der Browser oder der Rechner verweigern,
 * und dann steht Karam sonst ohne alles da. Ein Werkzeug, das nur manchmal
 * geht, ist kein Werkzeug.
 *
 * DER ZUSCHNITT IST HANDARBEIT, UND ZWAR MIT ABSICHT
 *
 * Es gibt in diesem Projekt KEINE automatische Suche nach dem Wettlisten-
 * Bereich. Sie wurde nach vier Anlaeufen wieder entfernt, die Begruendung
 * steht in bild/segmentierung.js. Kurz: eine Automatik, die in der Haelfte der
 * Faelle selbstbewusst danebenliegt, ist schlechter als keine, weil sie wie
 * Erfolg aussieht. Hier zieht der Mensch den Rahmen. Das dauert drei Sekunden
 * und ist immer richtig.
 *
 * DESIGN
 *
 * Diese Datei setzt nur Klassennamen. Farben und Groessen stehen in stil/.
 */

import { el } from './werkzeug.js'
import { schneideAus } from '../bild/vorverarbeitung.js'

/**
 * Kann dieser Browser den Bildschirm aufnehmen?
 *
 * getDisplayMedia gibt es nur in einer sicheren Umgebung, also unter https
 * oder auf localhost. Auf GitHub Pages ist das gegeben.
 */
export function kannBildschirmAufnehmen() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
    window.isSecureContext === true
  )
}

/** Kann dieser Browser die Zwischenablage von sich aus lesen? */
export function kannZwischenablageLesen() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.read === 'function' &&
    window.isSecureContext === true
  )
}

/**
 * Nimmt EIN Bild vom Bildschirm auf.
 *
 * Der Datenstrom wird sofort wieder beendet. Es wird nichts aufgezeichnet und
 * nichts gespeichert: ein einziges Bild, und das bleibt im Arbeitsspeicher
 * dieses Reiters.
 *
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function nimmBildschirmAuf() {
  const { strom, video } = await oeffneBildschirmstrom()
  try {
    return await greifeEinzelbild(video)
  } finally {
    // IMMER abschalten, auch wenn oben etwas schiefging. Ein weiterlaufender
    // Datenstrom heisst: der Browser zeigt weiter an, dass der Bildschirm
    // geteilt wird. Das darf nicht passieren.
    beendeStrom(strom, video)
  }
}

/**
 * Oeffnet den Bildschirmstrom und laesst ihn LAUFEN.
 *
 * WARUM DAS GETRENNT VON nimmBildschirmAuf STEHT
 *
 * Seit dem 18.09.2026 gibt es zwei Wege, die beide einen Bildschirmstrom
 * brauchen: das einzelne Bild hier und die Serie in oberflaeche/schnipsel.js.
 * Der Unterschied ist NUR, wann der Strom endet, und deshalb waere ein zweiter
 * Nachbau dieser dreissig Zeilen genau das, was Projektregel 8 verbietet.
 *
 * Die drei Vorkehrungen darin stammen alle aus echten Vorfaellen und gelten
 * fuer beide Wege gleichermassen: die Zeitgrenze von zehn Sekunden, das
 * Sicherheitsnetz fuer den Bildrueckruf, und kein img.decode.
 *
 * WER DAS HIER RUFT, MUSS beendeStrom RUFEN. Sonst zeigt der Browser
 * unbegrenzt weiter an, dass der Bildschirm geteilt wird.
 *
 * @returns {Promise<{strom: MediaStream, video: HTMLVideoElement}>}
 */
export async function oeffneBildschirmstrom() {
  if (!kannBildschirmAufnehmen()) {
    throw new Error(
      'Dieser Browser kann den Bildschirm nicht aufnehmen. ' +
        'Mach das Bildschirmfoto mit Windows-Taste + Umschalt + S und füge es mit Strg+V ein.'
    )
  }

  const strom = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
    // Der Mauszeiger im Bild waere nur ein schwarzer Fleck ueber einer Zahl.
    // @ts-ignore nicht in jeder Typfassung bekannt
    cursor: 'never',
    preferCurrentTab: false,
  })

  const video = document.createElement('video')
  video.srcObject = strom
  video.muted = true
  video.playsInline = true

  try {
    await new Promise((fertig, schiefgegangen) => {
      // Ohne Zeitgrenze haengt das hier stumm, wenn der Datenstrom kein Bild
      // liefert. Ein stiller Fehlschlag ist schlimmer als eine Meldung.
      const uhr = setTimeout(() => schiefgegangen(new Error('Der Bildschirm lieferte kein Bild.')), 10000)
      video.onloadedmetadata = () => {
        clearTimeout(uhr)
        video.play().then(fertig).catch(schiefgegangen)
      }
      video.onerror = () => {
        clearTimeout(uhr)
        schiefgegangen(new Error('Der Bildschirm ließ sich nicht anzeigen.'))
      }
    })
  } catch (fehler) {
    // Sonst liefe die Freigabe weiter, obwohl niemand mehr etwas davon hat.
    beendeStrom(strom, video)
    throw fehler
  }

  return { strom, video }
}

/**
 * Holt EIN Einzelbild aus einem laufenden Strom.
 *
 * DIE UHR IST WAEHLBAR (uhren): der Massenausschnitt laesst das
 * Programmfenster absichtlich verdeckt hinten liegen, und Chrome drosselt
 * die Wecker verdeckter Fenster auf etwa einen Schlag je Sekunde. Das
 * Sicherheitsnetz hier ist im verdeckten Fenster der EINZIGE Weg zum Bild
 * (der Bildrueckruf feuert dort nie, siehe unten), und gedrosselt machte
 * es aus 500 Millisekunden eine volle Sekunde je Aufnahme. Deshalb plant
 * der Massenausschnitt diese Uhr auf seinem nie verdeckten Mini-Fenster.
 *
 * @param {HTMLVideoElement} video
 * @param {Window} [uhren]  Das Fenster, dessen Wecker benutzt werden.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function greifeEinzelbild(video, uhren = window) {
  // Ein Einzelbild abwarten. Ohne das ist die Leinwand manchmal schwarz,
  // weil das erste Bild noch nicht durch ist.
  await new Promise((fertig) => {
    if ('requestVideoFrameCallback' in video) {
      let schon = false
      const einmal = () => {
        if (schon) return
        schon = true
        fertig(undefined)
      }
      // @ts-ignore nicht in jeder Typfassung bekannt
      video.requestVideoFrameCallback(einmal)
      // Sicherheitsnetz: in einem verdeckten Fenster ruft der Browser den
      // Bildrueckruf nicht auf. Genau diese Falle hat dieses Projekt schon
      // einmal einen halben Tag gekostet.
      uhren.setTimeout(einmal, 500)
    } else {
      uhren.setTimeout(() => fertig(undefined), 300)
    }
  })

  const leinwand = document.createElement('canvas')
  leinwand.width = video.videoWidth
  leinwand.height = video.videoHeight
  const kontext = leinwand.getContext('2d')
  if (!kontext) throw new Error('Der Browser stellt keinen Zeichenkontext bereit.')
  kontext.drawImage(video, 0, 0)

  if (leinwand.width === 0 || leinwand.height === 0) {
    throw new Error('Das aufgenommene Bild war leer.')
  }
  return leinwand
}

/**
 * Beendet einen Bildschirmstrom vollstaendig.
 *
 * @param {MediaStream|null} strom
 * @param {HTMLVideoElement|null} [video]
 */
export function beendeStrom(strom, video) {
  if (video) {
    try {
      video.pause()
      video.srcObject = null
    } catch {
      // Ein Video, das sich nicht mehr anhalten laesst, ist ohnehin fertig.
    }
  }
  for (const spur of strom?.getTracks() ?? []) spur.stop()
}

/**
 * Holt ein Bild aus der Zwischenablage.
 *
 * @returns {Promise<HTMLCanvasElement|null>}  null, wenn dort kein Bild liegt.
 */
export async function ausZwischenablage() {
  if (!kannZwischenablageLesen()) {
    throw new Error(
      'Dieser Browser gibt die Zwischenablage nicht heraus. ' +
        'Klick erst in die Seite und drücke dann Strg+V.'
    )
  }
  const stuecke = await navigator.clipboard.read()
  for (const stueck of stuecke) {
    const art = stueck.types.find((t) => t.startsWith('image/'))
    if (!art) continue
    return await ausBlob(await stueck.getType(art))
  }
  return null
}

/**
 * Macht aus einem Bild-Blob eine Leinwand.
 *
 * WARUM NICHT img.decode(): in einem verdeckten oder minimierten Fenster gibt
 * der Browser das Versprechen aus decode() nicht mehr zurueck. Es kommt kein
 * Fehler, es passiert einfach gar nichts, und der Nutzer steht vor einer
 * Oberflaeche, die nicht reagiert. Am 13.09.2026 hier gemessen: Einfuegen im
 * verdeckten Fenster blieb stumm haengen, nachdem genau dieselbe Fehlerklasse
 * das Projekt schon einmal ueber requestAnimationFrame erwischt hatte.
 *
 * createImageBitmap haengt nicht an der Sichtbarkeit. Der Rueckweg ueber
 * Image benutzt onload statt decode und hat zusaetzlich eine Zeitgrenze:
 * lieber eine ehrliche Fehlermeldung als stilles Nichts.
 *
 * @param {Blob} blob
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function ausBlob(blob) {
  const zeichne = (quelle, breite, hoehe) => {
    const leinwand = document.createElement('canvas')
    leinwand.width = Math.max(1, breite)
    leinwand.height = Math.max(1, hoehe)
    const kontext = leinwand.getContext('2d')
    if (!kontext) throw new Error('Der Browser stellt keinen Zeichenkontext bereit.')
    kontext.drawImage(quelle, 0, 0)
    return leinwand
  }

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    try {
      return zeichne(bitmap, bitmap.width, bitmap.height)
    } finally {
      bitmap.close?.()
    }
  }

  const bild = new Image()
  const adresse = URL.createObjectURL(blob)
  try {
    await new Promise((fertig, schiefgegangen) => {
      const uhr = setTimeout(
        () => schiefgegangen(new Error('Das Bild ließ sich nicht laden (Zeit abgelaufen).')),
        10000
      )
      bild.onload = () => {
        clearTimeout(uhr)
        fertig(undefined)
      }
      bild.onerror = () => {
        clearTimeout(uhr)
        schiefgegangen(new Error('Das Bild ließ sich nicht laden.'))
      }
      bild.src = adresse
    })
    return zeichne(bild, bild.naturalWidth, bild.naturalHeight)
  } finally {
    // Sofort freigeben. Bei hundert Bildern haengt sonst jede Datei fuer immer
    // im Speicher.
    URL.revokeObjectURL(adresse)
  }
}

/**
 * Zeigt das aufgenommene Bild und laesst einen Rahmen darum ziehen.
 *
 * Gibt den Ausschnitt zurueck, oder null, wenn abgebrochen wurde.
 *
 * DER WIRT IST WAEHLBAR, seit dem 19.09.2026 nachts. Der Massenausschnitt
 * zieht den Rahmen im schwebenden Mini-Fenster selbst, damit sich das
 * Programmfenster nicht bei jeder Aufnahme nach vorn schiebt (Karam: "ich
 * will nicht, dass jedes Mal sich die Kombi Exchange oeffnet"). Es bleibt
 * dieselbe EINE Umsetzung fuer beide Fenster (Projektregel 8); die Elemente
 * werden beim Einhaengen vom Zieldokument uebernommen, die Tastatur- und
 * Groessenhorcher haengen am Wirt, nicht am Programmfenster.
 *
 * @param {HTMLCanvasElement} leinwand
 * @param {Window} [wirt]  Das Fenster, in dem der Rahmen liegt.
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export function zeigeZuschnitt(leinwand, wirt = window) {
  return new Promise((fertig) => {
    /** @type {{x: number, y: number, breite: number, hoehe: number}|null} */
    let rahmen = null
    let zieht = false
    let startX = 0
    let startY = 0

    const anzeige = el('canvas.zuschnitt-bild', {})
    const anzeigeEl = /** @type {HTMLCanvasElement} */ (anzeige)
    const markierung = el('.zuschnitt-rahmen', {})
    const masse = el('.zuschnitt-masse', { text: '' })

    const knopfNehmen = el('button.zuschnitt-nehmen', { type: 'button', text: 'Ausschnitt nehmen' })
    const knopfGanz = el('button.zuschnitt-ganz', { type: 'button', text: 'Ganzes Bild nehmen' })
    const knopfAbbruch = el('button.zuschnitt-abbruch', { type: 'button', text: 'Abbrechen' })
    // Eigene Zeile mit const. Eine Anweisung, die mit einer Klammer beginnt,
    // haengt sich hier an die Zeile davor: der Quelltext kommt ohne
    // Strichpunkte aus, und dann setzt der Browser vor "(" keinen.
    const nehmenEl = /** @type {HTMLButtonElement} */ (knopfNehmen)
    nehmenEl.disabled = true

    const buehne = el('.zuschnitt-buehne', {}, [anzeige, markierung, masse])
    const schicht = el('.zuschnittschicht', {}, [
      el('.zuschnitt-kopf', {}, [
        el('.zuschnitt-titel', { text: 'Rahmen um die Wettliste ziehen' }),
        el('.zuschnitt-text', {
          text:
            'Mit der Maus einen Rahmen um die Wetten ziehen, die zusammengehören. ' +
            'Kopfleisten, Menüs und Werbung bleiben draußen, sonst landet deren Text ' +
            'in der Texterkennung. Ohne Rahmen wird das ganze Bild genommen.',
        }),
      ]),
      buehne,
      el('.zuschnitt-leiste', {}, [knopfNehmen, knopfGanz, knopfAbbruch]),
    ])

    // Das Bild wird zum Anzeigen verkleinert, der Ausschnitt aber IMMER aus
    // den Originalpunkten geschnitten. Ein aus der verkleinerten Anzeige
    // geschnittenes Bild waere unscharf, und unscharfe Ziffern sind genau das,
    // woran die Texterkennung scheitert.
    let massstab = 1

    /**
     * Wie viel Platz die Buehne wirklich hat.
     *
     * Ein frisch eingehaengtes Element meldet gelegentlich noch fast nichts,
     * und ein verdecktes Fenster meldet null. Beides ergab eine Anzeige von
     * drei Bildpunkten Breite, und darauf laesst sich kein Rahmen ziehen.
     * Gemessen am 13.09.2026: Buehne 3 Bildpunkte, Massstab 0,002.
     *
     * Deshalb: unter einer brauchbaren Groesse gilt das Fenster als Mass.
     */
    function platzMasse() {
      const platz = buehne.getBoundingClientRect()
      if (platz.width >= 80 && platz.height >= 80) {
        return { breite: platz.width, hoehe: platz.height }
      }
      return {
        breite: Math.max(320, wirt.innerWidth - 32),
        hoehe: Math.max(240, wirt.innerHeight - 180),
      }
    }

    function zeichneAnzeige() {
      const platz = platzMasse()
      const breiteMax = platz.breite || leinwand.width
      const hoeheMax = platz.hoehe || leinwand.height
      massstab = Math.min(1, breiteMax / leinwand.width, hoeheMax / leinwand.height)
      anzeigeEl.width = Math.max(1, Math.round(leinwand.width * massstab))
      anzeigeEl.height = Math.max(1, Math.round(leinwand.height * massstab))
      const k = anzeigeEl.getContext('2d')
      if (k) k.drawImage(leinwand, 0, 0, anzeigeEl.width, anzeigeEl.height)
    }

    function zeigeRahmen() {
      if (!rahmen || rahmen.breite < 2 || rahmen.hoehe < 2) {
        markierung.classList.remove('sichtbar')
        masse.classList.remove('sichtbar')
        nehmenEl.disabled = true
        return
      }
      const eck = anzeigeEl.getBoundingClientRect()
      const buehneEck = buehne.getBoundingClientRect()
      markierung.classList.add('sichtbar')
      markierung.style.setProperty('--links', `${eck.left - buehneEck.left + rahmen.x * massstab}px`)
      markierung.style.setProperty('--oben', `${eck.top - buehneEck.top + rahmen.y * massstab}px`)
      markierung.style.setProperty('--breit', `${rahmen.breite * massstab}px`)
      markierung.style.setProperty('--hoch', `${rahmen.hoehe * massstab}px`)
      masse.classList.add('sichtbar')
      masse.textContent = `${Math.round(rahmen.breite)} x ${Math.round(rahmen.hoehe)} Bildpunkte`
      nehmenEl.disabled = false
    }

    /** Mausstelle in Originalpunkte umrechnen. */
    function stelle(e) {
      const eck = anzeigeEl.getBoundingClientRect()
      return {
        x: Math.max(0, Math.min(leinwand.width, (e.clientX - eck.left) / massstab)),
        y: Math.max(0, Math.min(leinwand.height, (e.clientY - eck.top) / massstab)),
      }
    }

    anzeige.addEventListener('pointerdown', (e) => {
      const p = stelle(e)
      zieht = true
      startX = p.x
      startY = p.y
      rahmen = { x: p.x, y: p.y, breite: 0, hoehe: 0 }
      anzeigeEl.setPointerCapture(/** @type {PointerEvent} */ (e).pointerId)
      zeigeRahmen()
    })

    anzeige.addEventListener('pointermove', (e) => {
      if (!zieht) return
      const p = stelle(e)
      rahmen = {
        x: Math.min(startX, p.x),
        y: Math.min(startY, p.y),
        breite: Math.abs(p.x - startX),
        hoehe: Math.abs(p.y - startY),
      }
      zeigeRahmen()
    })

    const loslassen = () => {
      zieht = false
      zeigeRahmen()
    }
    anzeige.addEventListener('pointerup', loslassen)
    anzeige.addEventListener('pointercancel', loslassen)

    // Geschnitten wird in bild/, wo die Bildrechnung hingehoert. Der
    // Ausschnitt kommt IMMER aus den Originalpunkten, nie aus der
    // verkleinerten Anzeige.
    const schneide = (bereich) => schneideAus(leinwand, bereich)

    function schliesse(ergebnis) {
      wirt.removeEventListener('resize', beiGroesse)
      wirt.removeEventListener('keydown', beiTaste)
      schicht.remove()
      fertig(ergebnis)
    }

    const beiGroesse = () => {
      zeichneAnzeige()
      zeigeRahmen()
    }
    const beiTaste = (e) => {
      if (e.key === 'Escape') schliesse(null)
      if (e.key === 'Enter' && rahmen && rahmen.breite >= 2 && rahmen.hoehe >= 2) {
        schliesse(schneide(rahmen))
      }
    }

    knopfNehmen.addEventListener('click', () => {
      if (rahmen && rahmen.breite >= 2 && rahmen.hoehe >= 2) schliesse(schneide(rahmen))
    })
    knopfGanz.addEventListener('click', () =>
      schliesse(schneide({ x: 0, y: 0, breite: leinwand.width, hoehe: leinwand.height }))
    )
    knopfAbbruch.addEventListener('click', () => schliesse(null))

    wirt.addEventListener('resize', beiGroesse)
    wirt.addEventListener('keydown', beiTaste)

    // append uebernimmt die anderswo gebauten Elemente in das Zieldokument
    // (die Uebernahme ist Teil des Einhaengens im DOM-Standard).
    wirt.document.body.append(schicht)
    zeichneAnzeige()
    // Zweiter Anlauf, sobald der Browser die Schicht wirklich eingerichtet hat.
    // Bewusst setTimeout und NICHT requestAnimationFrame: in einem verdeckten
    // Fenster ruft der Browser den Bildrueckruf nicht mehr auf, und dann
    // bliebe die Anzeige fuer immer klein. Diese Falle hat das Projekt schon
    // einmal einen halben Tag gekostet. Die Uhr des WIRTS, nicht des
    // Programmfensters: das kann waehrend des Massenausschnitts verdeckt
    // und gedrosselt sein.
    wirt.setTimeout(beiGroesse, 0)
  })
}

/**
 * Macht aus einer Leinwand eine Datei, wie sie auch aus dem Dateidialog kaeme.
 *
 * Der Weg dahinter kennt danach keinen Unterschied: derselbe Fingerabdruck,
 * dieselbe Zerlegung, dieselbe Texterkennung.
 *
 * @param {HTMLCanvasElement} leinwand
 * @param {string} praefix
 * @returns {Promise<File>}
 */
export async function alsDatei(leinwand, praefix = 'bildschirm') {
  const blob = await new Promise((fertig, schiefgegangen) => {
    leinwand.toBlob((b) => {
      if (b) fertig(b)
      else schiefgegangen(new Error('Das Bild ließ sich nicht ablegen.'))
      // PNG, nicht JPEG. JPEG-Artefakte lassen die Vorverarbeitung das Bild
      // faelschlich fuer ein Foto halten, und dann wird Bildschirmschrift hart
      // schwellwertbinarisiert. Aus 8 wird B, aus 0 wird O.
    }, 'image/png')
  })
  const zeit = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return new File([blob], `${praefix}-${zeit}.png`, { type: 'image/png' })
}
