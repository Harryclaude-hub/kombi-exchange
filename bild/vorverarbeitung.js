// @ts-check
/**
 * Bildvorbereitung fuer die Texterkennung.
 *
 * Wichtigste Erkenntnis: ein Bildschirmfoto ist KEIN Foto von Papier.
 * Der Text ist schon sauber, nur zu klein. Was bei Papier hilft (Schwellwert,
 * Entrauschen, Schaerfen), zerstoert bei Bildschirmtext die Kantenglaettung
 * und macht die Erkennung schlechter. Deshalb wird zuerst festgestellt, womit
 * wir es zu tun haben, und dann unterschiedlich vorgegangen.
 *
 * Reine Logik auf Bilddaten. Keine Anzeige, keine Farben der Oberflaeche.
 */

/**
 * @typedef {object} Bildbefund
 * @property {boolean} istBildschirmfoto
 * @property {number} flaechenanteil    Anteil der Pixel, die wie ihr Nachbar aussehen.
 * @property {number} farbanzahl        Geschaetzte Anzahl verschiedener Farben.
 * @property {boolean} dunkelModus      true, wenn heller Text auf dunklem Grund ueberwiegt.
 * @property {number} helligkeitMittel
 */

/**
 * Legt ein Bild auf eine Leinwand und liefert den Zeichenkontext.
 *
 * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} quelle
 * @param {number} [breite]
 * @param {number} [hoehe]
 * @returns {{leinwand: HTMLCanvasElement, kontext: CanvasRenderingContext2D}}
 */
export function aufLeinwand(quelle, breite, hoehe) {
  const b = breite ?? ('naturalWidth' in quelle ? quelle.naturalWidth : quelle.width)
  const h = hoehe ?? ('naturalHeight' in quelle ? quelle.naturalHeight : quelle.height)

  const leinwand = document.createElement('canvas')
  leinwand.width = Math.max(1, Math.round(b))
  leinwand.height = Math.max(1, Math.round(h))

  const kontext = leinwand.getContext('2d', { willReadFrequently: true })
  if (!kontext) throw new Error('Der Browser stellt keinen 2D-Zeichenkontext bereit.')

  kontext.imageSmoothingEnabled = true
  kontext.imageSmoothingQuality = 'high'
  kontext.drawImage(quelle, 0, 0, leinwand.width, leinwand.height)
  return { leinwand, kontext }
}

/**
 * Liest eine Datei als Bild ein.
 *
 * @param {File|Blob} datei
 * @returns {Promise<HTMLImageElement>}
 */
export function ladeBild(datei) {
  return new Promise((erfuellen, ablehnen) => {
    const url = URL.createObjectURL(datei)
    const bild = new Image()
    bild.onload = () => {
      URL.revokeObjectURL(url)
      erfuellen(bild)
    }
    bild.onerror = () => {
      URL.revokeObjectURL(url)
      ablehnen(new Error(`Die Datei konnte nicht als Bild gelesen werden: ${'name' in datei ? datei.name : 'ohne Namen'}`))
    }
    bild.src = url
  })
}

/**
 * Untersucht, ob es sich um ein Bildschirmfoto oder um ein Foto vom Bildschirm handelt.
 *
 * Bildschirmfotos haben grosse einfarbige Flaechen und wenige verschiedene Farben.
 * Fotos haben Rauschen, deshalb ist dort fast kein Pixel genau wie sein Nachbar.
 *
 * @param {ImageData} daten
 * @returns {Bildbefund}
 */
export function untersuche(daten) {
  const { width: breite, height: hoehe, data: pixel } = daten
  // Nur eine Stichprobe pruefen, sonst dauert es bei grossen Bildern zu lange.
  const schritt = Math.max(1, Math.floor(Math.sqrt((breite * hoehe) / 120000)))

  let gleich = 0
  let geprueft = 0
  let helligkeitSumme = 0
  const farben = new Set()

  for (let y = 0; y < hoehe - schritt; y += schritt) {
    for (let x = 0; x < breite - schritt; x += schritt) {
      const i = (y * breite + x) * 4
      const j = (y * breite + x + schritt) * 4
      const r = pixel[i] ?? 0
      const g = pixel[i + 1] ?? 0
      const b = pixel[i + 2] ?? 0

      helligkeitSumme += 0.299 * r + 0.587 * g + 0.114 * b
      if (farben.size < 4096) {
        farben.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3))
      }

      const dr = Math.abs(r - (pixel[j] ?? 0))
      const dg = Math.abs(g - (pixel[j + 1] ?? 0))
      const db = Math.abs(b - (pixel[j + 2] ?? 0))
      if (dr + dg + db <= 6) gleich++
      geprueft++
    }
  }

  const flaechenanteil = geprueft > 0 ? gleich / geprueft : 0
  const helligkeitMittel = geprueft > 0 ? helligkeitSumme / geprueft : 0

  return {
    istBildschirmfoto: flaechenanteil > 0.55 && farben.size < 3000,
    flaechenanteil,
    farbanzahl: farben.size,
    dunkelModus: helligkeitMittel < 110,
    helligkeitMittel,
  }
}

/**
 * Wandelt in Graustufen um. Arbeitet auf den Daten selbst, ohne Kopie.
 *
 * @param {ImageData} daten
 * @returns {ImageData}
 */
export function graustufen(daten) {
  const pixel = daten.data
  for (let i = 0; i < pixel.length; i += 4) {
    const grau = 0.299 * (pixel[i] ?? 0) + 0.587 * (pixel[i + 1] ?? 0) + 0.114 * (pixel[i + 2] ?? 0)
    const wert = grau < 0 ? 0 : grau > 255 ? 255 : grau
    pixel[i] = wert
    pixel[i + 1] = wert
    pixel[i + 2] = wert
  }
  return daten
}

/**
 * Kehrt die Helligkeit um. Noetig bei hellem Text auf dunklem Grund,
 * weil die Texterkennung dunklen Text auf hellem Grund erwartet.
 *
 * @param {ImageData} daten
 * @returns {ImageData}
 */
export function umkehren(daten) {
  const pixel = daten.data
  for (let i = 0; i < pixel.length; i += 4) {
    pixel[i] = 255 - (pixel[i] ?? 0)
    pixel[i + 1] = 255 - (pixel[i + 1] ?? 0)
    pixel[i + 2] = 255 - (pixel[i + 2] ?? 0)
  }
  return daten
}

/**
 * Spreizt den Kontrast auf den vollen Bereich, wobei die aeussersten Prozente
 * abgeschnitten werden. Das holt blassen Text heraus, ohne Ausreisser zu verstaerken.
 *
 * @param {ImageData} daten
 * @param {number} [abschnitt]  Anteil, der oben und unten abgeschnitten wird.
 * @returns {ImageData}
 */
export function kontrastSpreizen(daten, abschnitt = 0.005) {
  const pixel = daten.data
  const haeufigkeit = new Uint32Array(256)
  for (let i = 0; i < pixel.length; i += 4) haeufigkeit[pixel[i] ?? 0]++

  const gesamt = pixel.length / 4
  const grenze = Math.floor(gesamt * abschnitt)

  let unten = 0
  let gezaehlt = 0
  for (let w = 0; w < 256; w++) {
    gezaehlt += haeufigkeit[w] ?? 0
    if (gezaehlt > grenze) {
      unten = w
      break
    }
  }

  let oben = 255
  gezaehlt = 0
  for (let w = 255; w >= 0; w--) {
    gezaehlt += haeufigkeit[w] ?? 0
    if (gezaehlt > grenze) {
      oben = w
      break
    }
  }

  if (oben <= unten) return daten

  const streckung = 255 / (oben - unten)
  const tabelle = new Uint8Array(256)
  for (let w = 0; w < 256; w++) {
    const neu = (w - unten) * streckung
    tabelle[w] = neu < 0 ? 0 : neu > 255 ? 255 : Math.round(neu)
  }

  for (let i = 0; i < pixel.length; i += 4) {
    const wert = tabelle[pixel[i] ?? 0] ?? 0
    pixel[i] = wert
    pixel[i + 1] = wert
    pixel[i + 2] = wert
  }
  return daten
}

/**
 * Bestimmt den Schwellwert nach Otsu.
 *
 * @param {ImageData} daten
 * @returns {number}
 */
export function otsuSchwelle(daten) {
  const pixel = daten.data
  const haeufigkeit = new Uint32Array(256)
  for (let i = 0; i < pixel.length; i += 4) haeufigkeit[pixel[i] ?? 0]++

  const gesamt = pixel.length / 4
  let summe = 0
  for (let w = 0; w < 256; w++) summe += w * (haeufigkeit[w] ?? 0)

  let summeHintergrund = 0
  let anzahlHintergrund = 0
  let bestesMass = -1
  let besteSchwelle = 128

  for (let w = 0; w < 256; w++) {
    anzahlHintergrund += haeufigkeit[w] ?? 0
    if (anzahlHintergrund === 0) continue
    const anzahlVordergrund = gesamt - anzahlHintergrund
    if (anzahlVordergrund === 0) break

    summeHintergrund += w * (haeufigkeit[w] ?? 0)
    const mittelHintergrund = summeHintergrund / anzahlHintergrund
    const mittelVordergrund = (summe - summeHintergrund) / anzahlVordergrund
    const mass =
      anzahlHintergrund * anzahlVordergrund * (mittelHintergrund - mittelVordergrund) ** 2

    if (mass > bestesMass) {
      bestesMass = mass
      besteSchwelle = w
    }
  }
  return besteSchwelle
}

/**
 * Oertlicher Schwellwert nach Sauvola. Nur fuer Fotos gedacht, bei denen die
 * Beleuchtung ueber das Bild hinweg schwankt.
 *
 * @param {ImageData} daten
 * @param {number} [fenster]
 * @param {number} [k]
 * @returns {ImageData}
 */
export function sauvola(daten, fenster = 25, k = 0.2) {
  const { width: breite, height: hoehe, data: pixel } = daten
  const halb = Math.max(1, Math.floor(fenster / 2))

  // Summenbilder, damit das Fenster in fester Zeit ausgewertet werden kann.
  const flaeche = (breite + 1) * (hoehe + 1)
  const summe = new Float64Array(flaeche)
  const summeQuadrat = new Float64Array(flaeche)

  for (let y = 0; y < hoehe; y++) {
    let zeilensumme = 0
    let zeilensummeQuadrat = 0
    for (let x = 0; x < breite; x++) {
      const wert = pixel[(y * breite + x) * 4] ?? 0
      zeilensumme += wert
      zeilensummeQuadrat += wert * wert
      const stelle = (y + 1) * (breite + 1) + (x + 1)
      summe[stelle] = (summe[stelle - (breite + 1)] ?? 0) + zeilensumme
      summeQuadrat[stelle] = (summeQuadrat[stelle - (breite + 1)] ?? 0) + zeilensummeQuadrat
    }
  }

  const ergebnis = new Uint8ClampedArray(pixel.length)

  for (let y = 0; y < hoehe; y++) {
    const oben = Math.max(0, y - halb)
    const unten = Math.min(hoehe - 1, y + halb)
    for (let x = 0; x < breite; x++) {
      const links = Math.max(0, x - halb)
      const rechts = Math.min(breite - 1, x + halb)
      const anzahl = (unten - oben + 1) * (rechts - links + 1)

      const a = (unten + 1) * (breite + 1) + (rechts + 1)
      const b = oben * (breite + 1) + (rechts + 1)
      const c = (unten + 1) * (breite + 1) + links
      const d = oben * (breite + 1) + links

      const s = (summe[a] ?? 0) - (summe[b] ?? 0) - (summe[c] ?? 0) + (summe[d] ?? 0)
      const sq = (summeQuadrat[a] ?? 0) - (summeQuadrat[b] ?? 0) - (summeQuadrat[c] ?? 0) + (summeQuadrat[d] ?? 0)

      const mittel = s / anzahl
      const streuung = Math.sqrt(Math.max(0, sq / anzahl - mittel * mittel))
      const schwelle = mittel * (1 + k * (streuung / 128 - 1))

      const stelle = (y * breite + x) * 4
      const wert = (pixel[stelle] ?? 0) > schwelle ? 255 : 0
      ergebnis[stelle] = wert
      ergebnis[stelle + 1] = wert
      ergebnis[stelle + 2] = wert
      ergebnis[stelle + 3] = 255
    }
  }

  return new ImageData(ergebnis, breite, hoehe)
}

/**
 * Waehlt den Vergroesserungsfaktor.
 *
 * Die Texterkennung arbeitet am besten bei einer Zeichenhoehe von etwa 30 Bildpunkten.
 * Bildschirmtext hat oft nur 11 bis 14 Punkte, deshalb lohnt sich das Vergroessern.
 * Nach oben wird begrenzt, weil sehr grosse Leinwaende Arbeitsspeicher fressen.
 *
 * @param {number} breite
 * @param {number} hoehe
 * @param {number} [zielBreite]
 * @param {number} [hoechstFlaeche]
 * @returns {number}
 */
export function waehleFaktor(breite, hoehe, zielBreite = 1800, hoechstFlaeche = 40e6) {
  if (breite <= 0 || hoehe <= 0) return 1
  let faktor = zielBreite / breite
  if (faktor < 1) faktor = 1
  if (faktor > 4) faktor = 4
  while (faktor > 1 && breite * faktor * hoehe * faktor > hoechstFlaeche) {
    faktor -= 0.25
  }
  return Math.max(1, Math.round(faktor * 4) / 4)
}

/**
 * Bereitet einen Bildausschnitt fuer die Texterkennung vor.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} quelle
 * @param {import('../kern/typen.js').Rechteck} [ausschnitt]
 * @param {object} [einstellungen]
 * @param {number} [einstellungen.faktor]        Vergroesserung, sonst automatisch.
 * @param {boolean} [einstellungen.erzwingeFoto] Foto-Behandlung erzwingen.
 * @returns {{leinwand: HTMLCanvasElement, befund: Bildbefund, faktor: number}}
 */
export function bereiteVor(quelle, ausschnitt, einstellungen = {}) {
  const vollBreite = 'naturalWidth' in quelle ? quelle.naturalWidth : quelle.width
  const vollHoehe = 'naturalHeight' in quelle ? quelle.naturalHeight : quelle.height

  const x = Math.max(0, Math.round(ausschnitt?.x ?? 0))
  const y = Math.max(0, Math.round(ausschnitt?.y ?? 0))
  const b = Math.min(vollBreite - x, Math.round(ausschnitt?.breite ?? vollBreite))
  const h = Math.min(vollHoehe - y, Math.round(ausschnitt?.hoehe ?? vollHoehe))

  if (b <= 0 || h <= 0) {
    throw new Error('Der gewaehlte Ausschnitt liegt ausserhalb des Bildes.')
  }

  // Zuerst den Ausschnitt in Originalgroesse untersuchen.
  const roh = document.createElement('canvas')
  roh.width = b
  roh.height = h
  const rohKontext = roh.getContext('2d', { willReadFrequently: true })
  if (!rohKontext) throw new Error('Der Browser stellt keinen 2D-Zeichenkontext bereit.')
  rohKontext.drawImage(quelle, x, y, b, h, 0, 0, b, h)

  const befund = untersuche(rohKontext.getImageData(0, 0, b, h))
  const alsFoto = einstellungen.erzwingeFoto === true || !befund.istBildschirmfoto

  const faktor = einstellungen.faktor ?? waehleFaktor(b, h)

  const gross = document.createElement('canvas')
  gross.width = Math.round(b * faktor)
  gross.height = Math.round(h * faktor)
  const kontext = gross.getContext('2d', { willReadFrequently: true })
  if (!kontext) throw new Error('Der Browser stellt keinen 2D-Zeichenkontext bereit.')
  kontext.imageSmoothingEnabled = true
  kontext.imageSmoothingQuality = 'high'
  kontext.drawImage(roh, 0, 0, gross.width, gross.height)

  let daten = kontext.getImageData(0, 0, gross.width, gross.height)
  daten = graustufen(daten)

  if (befund.dunkelModus) daten = umkehren(daten)

  if (alsFoto) {
    // Beim Foto hilft der oertliche Schwellwert gegen ungleiche Beleuchtung.
    daten = sauvola(daten, Math.max(15, Math.round(25 * faktor)), 0.2)
  } else {
    // Beim Bildschirmfoto nur sanft nachziehen. Ein harter Schwellwert wuerde
    // die Kantenglaettung zerstoeren und die Erkennung verschlechtern.
    daten = kontrastSpreizen(daten, 0.003)
  }

  kontext.putImageData(daten, 0, 0)
  return { leinwand: gross, befund, faktor }
}
