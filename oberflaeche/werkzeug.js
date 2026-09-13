// @ts-check
/**
 * Kleine Helfer fuer die Oberflaeche.
 *
 * Hier stehen keine Farben und keine Groessen. Aussehen kommt ausschliesslich aus
 * den Dateien im Ordner stil. Diese Datei baut nur Bausteine und haengt sie ein.
 */

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
