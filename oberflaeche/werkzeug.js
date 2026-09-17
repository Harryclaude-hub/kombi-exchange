// @ts-check
/**
 * Kleine Helfer fuer die Oberflaeche.
 *
 * Hier stehen keine Farben und keine Groessen. Aussehen kommt ausschliesslich aus
 * den Dateien im Ordner stil. Diese Datei baut nur Bausteine und haengt sie ein.
 */

import { schluesselFuerName, kuerzelFuer } from '../kern/buchmacher.js'

/**
 * Baut ein Element.
 *
 * @param {string} bauart      Zum Beispiel 'div.karte.gross' oder 'button#senden'.
 * @param {Record<string, any>} [eigenschaften]
 * @param {(Node|string|null|undefined|false)[]} [kinder]
 * @returns {HTMLElement}
 */
export function el(bauart, eigenschaften = {}, kinder = []) {
  const teile = bauart.split(/(?=[.#])/)
  const name = teile[0] && !teile[0].startsWith('.') && !teile[0].startsWith('#') ? teile[0] : 'div'
  const element = document.createElement(name)

  for (const teil of teile.slice(name === teile[0] ? 1 : 0)) {
    if (teil.startsWith('.')) element.classList.add(teil.slice(1))
    else if (teil.startsWith('#')) element.id = teil.slice(1)
  }

  for (const [schluessel, wert] of Object.entries(eigenschaften)) {
    if (wert === null || wert === undefined || wert === false) continue
    if (schluessel === 'text') element.textContent = String(wert)
    else if (schluessel === 'html') element.innerHTML = String(wert)
    else if (schluessel === 'klasse') element.className = String(wert)
    else if (schluessel.startsWith('on') && typeof wert === 'function') {
      element.addEventListener(schluessel.slice(2).toLowerCase(), wert)
    } else if (schluessel === 'daten' && typeof wert === 'object') {
      for (const [d, w] of Object.entries(wert)) element.dataset[d] = String(w)
    } else if (schluessel === 'stil' && typeof wert === 'object') {
      // Nur fuer berechnete Groessen, zum Beispiel eine Balkenbreite in Prozent.
      // Farben gehoeren hier NICHT herein, die kommen aus dem Stylesheet.
      for (const [d, w] of Object.entries(wert)) element.style.setProperty(d, String(w))
    } else {
      element.setAttribute(schluessel, String(wert))
    }
  }

  for (const kind of kinder.flat(3)) {
    if (kind === null || kind === undefined || kind === false) continue
    element.append(kind instanceof Node ? kind : document.createTextNode(String(kind)))
  }

  return element
}

/**
 * Leert ein Element und setzt neuen Inhalt hinein.
 *
 * @param {HTMLElement|null} ziel
 * @param {(Node|string|null|undefined|false)[]} kinder
 */
export function fuelle(ziel, kinder) {
  if (!ziel) return
  ziel.replaceChildren()
  for (const kind of kinder.flat(3)) {
    if (kind === null || kind === undefined || kind === false) continue
    ziel.append(kind instanceof Node ? kind : document.createTextNode(String(kind)))
  }
}

/**
 * @param {string} auswahl
 * @param {ParentNode} [wurzel]
 * @returns {HTMLElement|null}
 */
export function such(auswahl, wurzel = document) {
  return /** @type {HTMLElement|null} */ (wurzel.querySelector(auswahl))
}

/**
 * Erzeugt eine Kennung, die sich nicht wiederholt.
 *
 * Es wird die Kennungsfunktion des Browsers genommen, weil die Datenbank
 * echte Kennungen dieser Form erwartet.
 *
 * @returns {string}
 */
export function neueKennung() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  // Ersatzweg fuer aeltere Browser, gleiche Form.
  const zufall = new Uint8Array(16)
  ;(globalThis.crypto ?? { getRandomValues: (a) => a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256))) })
    .getRandomValues(zufall)
  zufall[6] = ((zufall[6] ?? 0) & 0x0f) | 0x40
  zufall[8] = ((zufall[8] ?? 0) & 0x3f) | 0x80
  const hex = [...zufall].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Wartet, bis eine Weile nichts mehr passiert ist, und fuehrt dann aus.
 *
 * @template {(...args: any[]) => void} T
 * @param {T} arbeit
 * @param {number} millisekunden
 * @returns {(...args: Parameters<T>) => void}
 */
export function verzoegert(arbeit, millisekunden) {
  /** @type {any} */
  let wecker = null
  return (...args) => {
    clearTimeout(wecker)
    wecker = setTimeout(() => arbeit(...args), millisekunden)
  }
}

/**
 * Gibt dem Browser Gelegenheit, zwischendurch zu zeichnen.
 * Ohne das friert die Seite waehrend langer Rechenarbeit ein.
 *
 * WICHTIG: es wird nicht allein auf den naechsten Bildaufbau gewartet.
 * In einem versteckten Fenster, in einem anderen Reiter oder bei minimiertem
 * Programm ruft der Browser requestAnimationFrame gar nicht mehr auf. Wer sich
 * darauf verlaesst, dessen Verarbeitung bleibt genau dann stehen, wenn der
 * Nutzer waehrend des Lesens den Reiter wechselt. Und zwar ohne Fehlermeldung.
 *
 * Deshalb laufen beide Wege gleichzeitig und der schnellere gewinnt: sichtbar
 * wird sauber gezeichnet, versteckt geht es trotzdem weiter.
 *
 * @returns {Promise<void>}
 */
export function atmen() {
  return new Promise((erfuellen) => {
    let erledigt = false
    const fertig = () => {
      if (erledigt) return
      erledigt = true
      erfuellen()
    }
    if ('requestAnimationFrame' in globalThis) requestAnimationFrame(fertig)
    setTimeout(fertig, 0)
  })
}

/**
 * Zeitpunkt als lesbarer Text.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function zeitText(iso) {
  if (!iso) return '-'
  const zeitpunkt = new Date(iso)
  if (Number.isNaN(zeitpunkt.getTime())) return String(iso)
  const zwei = (n) => String(n).padStart(2, '0')
  return (
    `${zwei(zeitpunkt.getDate())}.${zwei(zeitpunkt.getMonth() + 1)}.${zeitpunkt.getFullYear()} ` +
    `${zwei(zeitpunkt.getHours())}:${zwei(zeitpunkt.getMinutes())}`
  )
}

/**
 * Jetzt, als ISO-Zeichenkette in Ortszeit ohne Zeitzone.
 *
 * @returns {string}
 */
export function jetzt() {
  const zeitpunkt = new Date()
  const zwei = (n) => String(n).padStart(2, '0')
  return (
    `${zeitpunkt.getFullYear()}-${zwei(zeitpunkt.getMonth() + 1)}-${zwei(zeitpunkt.getDate())}` +
    `T${zwei(zeitpunkt.getHours())}:${zwei(zeitpunkt.getMinutes())}`
  )
}

/**
 * Grad der Sicherheit als Wort, fuer Menschen und fuer die Klassennamen im Stylesheet.
 *
 * @param {number} sicherheit
 * @returns {'hoch'|'mittel'|'niedrig'|'keine'}
 */
export function sicherheitsstufe(sicherheit) {
  if (!Number.isFinite(sicherheit) || sicherheit <= 0) return 'keine'
  if (sicherheit >= 0.85) return 'hoch'
  if (sicherheit >= 0.6) return 'mittel'
  return 'niedrig'
}

/**
 * Das Zeichen eines Anbieters: Logo, wenn es eines gibt, sonst sein Kuerzel.
 *
 * WOZU: Karam am 16.09.2026, "es ist sehr wichtig, dass jeder Anbieter mit dem
 * Logo dasteht". Ueberall, wo ein Anbietername steht, steht ab jetzt sein
 * Zeichen davor: in der Scheineliste, in der Ablage, bei den Riesenscheinen
 * und in der Aufnahme.
 *
 * WIE DAS AUSSEHEN HEREINKOMMT
 *
 * Hier steht KEINE Farbe und KEIN Dateiname. Dieses Element traegt nur zwei
 * Merkmale:
 *
 *   data-anbieter="ps3838"   der technische Schluessel, oder "unbekannt"
 *   Textinhalt "PS"          das Kuerzel als Rueckfall
 *
 * Alles Weitere steht in stil/logos.css: dort haengt an jedem Schluessel die
 * Hausfarbe und, sobald eine Datei da ist, das Bild. Faellt stil/ weg, bleibt
 * das Kuerzel als schlichter Text stehen und nichts rechnet anders
 * (Projektregel 5).
 *
 * WARUM EIN KUERZEL UND NICHT NUR DAS LOGO
 *
 * Es liegt noch keine einzige Logodatei im Projekt, und sechzig Anbieter
 * werden auch spaeter nicht alle eine haben. Ein leerer Fleck neben jedem
 * zweiten Namen waere genau das, was Karam nicht wollte. Das Kuerzel steht
 * immer da; wo ein Bild dazukommt, legt es sich darueber.
 *
 * @param {string|null|undefined} name  Der Anzeigename, wie er am Schein steht.
 * @returns {HTMLElement}
 */
export function anbieterzeichen(name) {
  const schluessel = schluesselFuerName(name)
  return el('span.anbieterzeichen', {
    daten: { anbieter: schluessel ?? 'unbekannt' },
    title: name ? String(name) : 'Anbieter unbekannt',
    text: kuerzelFuer(name),
  })
}

/**
 * Zeigt nur den Ausschnitt des Quellbildes, aus dem ein Schein gelesen wurde.
 *
 * Karam am 16.09.2026: "bei den Riesenscheinen moechte ich, dass da immer ein
 * Foto dabei ist, das Foto immer angezeigt wird."
 *
 * STEHT HIER UND NICHT IN EINER ANSICHT, weil jetzt zwei Ansichten dasselbe
 * brauchen: die Scheineliste und die Riesenscheine. Zweimal gebaut hiesse,
 * dass eines Tages die eine den Ausschnitt anders schneidet als die andere,
 * und dann sieht man an zwei Stellen zwei verschiedene Wahrheiten ueber
 * dasselbe Bild (Projektregel 8).
 *
 * Kein Bild da (etwa nach einem Neuladen, weil die Bilder auf dem Geraet
 * liegen): dann bleibt die Leinwand leer statt zu verschwinden. Ein leerer
 * Rahmen sagt "hier gehoert ein Bild hin", nichts sagt gar nichts.
 *
 * @param {{element?: HTMLImageElement|null, inhalt?: Blob|null, bild?: {id: string}}|null|undefined} bild
 * @param {{x: number, y: number, breite: number, hoehe: number}|null|undefined} ausschnitt
 * @returns {HTMLElement}
 */
export function ausschnittbild(bild, ausschnitt) {
  const leinwand = /** @type {HTMLCanvasElement} */ (el('canvas.ausschnitt'))
  const breite = Math.max(1, Math.round(ausschnitt?.breite ?? 1))
  const hoehe = Math.max(1, Math.round(ausschnitt?.hoehe ?? 1))
  leinwand.width = breite
  leinwand.height = hoehe

  const kontext = leinwand.getContext('2d')
  if (!kontext || !ausschnitt) return leinwand

  if (bild?.element) {
    kontext.drawImage(bild.element, ausschnitt.x, ausschnitt.y, breite, hoehe, 0, 0, breite, hoehe)
    return leinwand
  }

  /*
    NACH EINEM NEULADEN IST DAS BILD NOCH NICHT ENTPACKT.

    Seit dem 17.09.2026 entpackt das Programm beim Start nichts mehr (sonst
    laegen bei dreihundert Fotos 3,3 GB im Arbeitsspeicher). Der Ausschnitt
    holt sich das Bild deshalb selbst nach und zeichnet, sobald es da ist.

    Bis dahin steht die leere Leinwand. Ein leerer Rahmen sagt "hier gehoert
    ein Bild hin"; nichts sagt gar nichts.

    Der Import steht ABSICHTLICH in der Funktion und nicht oben: werkzeug.js
    wird von fast allem geladen, bildspeicher.js nur von den Stellen, die
    wirklich ein Bild brauchen.
  */
  if (bild?.inhalt) {
    import('./bildspeicher.js')
      .then((Bildspeicher) => Bildspeicher.hole(bild))
      .then((element) => {
        if (!element || !leinwand.isConnected) return
        kontext.drawImage(element, ausschnitt.x, ausschnitt.y, breite, hoehe, 0, 0, breite, hoehe)
      })
      .catch(() => {
        // Ein Bild, das sich nicht entpacken laesst, laesst den Rahmen leer.
      })
  }

  return leinwand
}
