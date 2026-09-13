// @ts-check
/**
 * Ein Bildschirmfoto in einzelne Wettkarten zerlegen.
 *
 * Der Kniff steckt in den Messpuffern. Wer das Bild vor der Messung in BEIDEN
 * Richtungen verkleinert, macht aus einer 1 Bildpunkt duennen Trennlinie nichts
 * und aus einem schwachen Kartenrand einen halb so starken. Deshalb behaelt der
 * Puffer in der gemessenen Richtung die volle Aufloesung und wird nur quer dazu
 * verkleinert. Das ist schnell und verliert genau das nicht, worauf es ankommt.
 *
 * Erkannt wird ueber Mittelwert UND Streuung je Zeile. Die Helligkeit allein
 * reicht nicht: eine weisse Karte und eine hellgraue Seite sind beide "ohne Text",
 * aber nur die eine ist eine Luecke zwischen zwei Karten.
 *
 * Die Zeilenlogik steht genau einmal hier, in kartenkanten. Alles andere ruft sie auf.
 * Zwei Fassungen davon waeren die Drift, die spaeter niemand mehr findet.
 *
 * Reine Bildlogik. Keine Anzeige, keine Farben der Oberflaeche.
 */

/** Breite des Messpuffers fuer die Zeilenmessung. Die Hoehe bleibt voll. */
const ZEILENPUFFER_BREITE = 256

/** Hoehe des Messpuffers fuer die Spaltenmessung. Die Breite bleibt voll. */
const SPALTENPUFFER_HOEHE = 256

/** Nur der mittlere Teil der Breite wird gemessen, damit runde Ecken nicht stoeren. */
const MESSFENSTER = 0.6

/** Eine Karte muss mindestens so hoch sein, in Bildpunkten des Originals. */
const KARTE_MINDESTHOEHE = 40


/**
 * @typedef {object} Zerlegung
 * @property {import('../kern/typen.js').Rechteck[]} karten
 * @property {import('../kern/typen.js').Rechteck} inhalt   Der gefundene Inhaltsbereich.
 * @property {boolean} dunkelModus
 * @property {number} kartenGrund   Helligkeit des Kartenhintergrunds, 0 bis 255.
 * @property {number} seitenGrund   Helligkeit des Seitenhintergrunds, 0 bis 255.
 * @property {string} verfahren     Welcher Weg zum Ergebnis gefuehrt hat.
 * @property {string[]} hinweise
 */

/**
 * Zeichnet einen Bildausschnitt deckend auf eine Leinwand und gibt die Bilddaten zurueck.
 *
 * Das Weiss darunter ist wichtig: bei einem PNG mit Transparenz liefert
 * getImageData sonst Unsinn in den durchsichtigen Bereichen.
 *
 * @param {CanvasImageSource} quelle
 * @param {import('../kern/typen.js').Rechteck} bereich
 * @param {number} zielBreite
 * @param {number} zielHoehe
 * @returns {ImageData|null}
 */
function messpuffer(quelle, bereich, zielBreite, zielHoehe) {
  const leinwand = document.createElement('canvas')
  leinwand.width = Math.max(1, Math.round(zielBreite))
  leinwand.height = Math.max(1, Math.round(zielHoehe))
  const kontext = leinwand.getContext('2d', { willReadFrequently: true, alpha: false })
  if (!kontext) return null

  kontext.fillStyle = '#ffffff'
  kontext.fillRect(0, 0, leinwand.width, leinwand.height)
  kontext.imageSmoothingEnabled = true
  kontext.imageSmoothingQuality = 'high'
  kontext.drawImage(
    quelle,
    bereich.x, bereich.y, bereich.breite, bereich.hoehe,
    0, 0, leinwand.width, leinwand.height
  )
  return kontext.getImageData(0, 0, leinwand.width, leinwand.height)
}

/**
 * Helligkeit eines Bildpunkts.
 *
 * @param {Uint8ClampedArray} pixel
 * @param {number} stelle
 * @returns {number}
 */
function helligkeit(pixel, stelle) {
  return 0.299 * (pixel[stelle] ?? 0) + 0.587 * (pixel[stelle + 1] ?? 0) + 0.114 * (pixel[stelle + 2] ?? 0)
}

/**
 * Haeufigste Helligkeit in einem Bereich, grob gerastert.
 *
 * @param {ImageData} daten
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {number}
 */
export function haeufigsteHelligkeit(daten, x0, y0, x1, y1) {
  const { width: breite, data: pixel } = daten
  const faecher = new Uint32Array(32)
  const summen = new Float64Array(32)

  const vonX = Math.max(0, Math.floor(x0))
  const bisX = Math.min(breite, Math.ceil(x1))
  const vonY = Math.max(0, Math.floor(y0))
  const bisY = Math.min(daten.height, Math.ceil(y1))

  for (let y = vonY; y < bisY; y++) {
    for (let x = vonX; x < bisX; x++) {
      const wert = helligkeit(pixel, (y * breite + x) * 4)
      const fach = Math.min(31, Math.floor(wert / 8))
      faecher[fach]++
      summen[fach] += wert
    }
  }

  let bestesFach = 0
  let besteAnzahl = -1
  for (let f = 0; f < 32; f++) {
    if ((faecher[f] ?? 0) > besteAnzahl) {
      besteAnzahl = faecher[f] ?? 0
      bestesFach = f
    }
  }
  const anzahl = faecher[bestesFach] ?? 0
  return anzahl > 0 ? (summen[bestesFach] ?? 0) / anzahl : 255
}

/**
 * Mittelwert und Streuung je Zeile, gemessen im mittleren Teil eines Spaltenbereichs.
 *
 * @param {ImageData} daten
 * @param {number} [vonX]     Erste Spalte, einschliesslich.
 * @param {number} [bisX]     Letzte Spalte, ausschliesslich.
 * @param {number} [fenster]  Anteil der Breite, der gemessen wird.
 * @returns {{mittel: Float32Array, streuung: Float32Array}}
 */
export function zeilenprofil(daten, vonX = 0, bisX = daten.width, fenster = MESSFENSTER) {
  const { width: breite, height: hoehe, data: pixel } = daten
  const links = Math.max(0, Math.floor(vonX))
  const rechts = Math.min(breite, Math.ceil(bisX))
  const spanne = Math.max(1, rechts - links)

  // Nur der mittlere Teil wird gemessen, damit runde Ecken und Raender nicht stoeren.
  const rand = Math.floor((spanne * (1 - fenster)) / 2)
  const von = links + rand
  const bis = Math.max(von + 1, rechts - rand)
  const anzahl = bis - von

  const mittel = new Float32Array(hoehe)
  const streuung = new Float32Array(hoehe)

  for (let y = 0; y < hoehe; y++) {
    let summe = 0
    let summeQuadrat = 0
    const zeilenanfang = y * breite
    for (let x = von; x < bis; x++) {
      const wert = helligkeit(pixel, (zeilenanfang + x) * 4)
      summe += wert
      summeQuadrat += wert * wert
    }
    const m = summe / anzahl
    mittel[y] = m
    streuung[y] = Math.sqrt(Math.max(0, summeQuadrat / anzahl - m * m))
  }

  return { mittel, streuung }
}

/**
 * Mittelwert und Streuung je Spalte.
 *
 * @param {ImageData} daten
 * @returns {{mittel: Float32Array, streuung: Float32Array}}
 */
export function spaltenprofil(daten) {
  const { width: breite, height: hoehe, data: pixel } = daten
  const mittel = new Float32Array(breite)
  const streuung = new Float32Array(breite)

  for (let x = 0; x < breite; x++) {
    let summe = 0
    let summeQuadrat = 0
    for (let y = 0; y < hoehe; y++) {
      const wert = helligkeit(pixel, (y * breite + x) * 4)
      summe += wert
      summeQuadrat += wert * wert
    }
    const m = summe / hoehe
    mittel[x] = m
    streuung[x] = Math.sqrt(Math.max(0, summeQuadrat / hoehe - m * m))
  }

  return { mittel, streuung }
}

/**
 * Otsu-Schwelle ueber eine Reihe von Messwerten zwischen 0 und 255.
 *
 * @param {Float32Array} werte
 * @returns {number}
 */
export function otsuUeberReihe(werte) {
  const faecher = new Uint32Array(256)
  for (const wert of werte) {
    const fach = Math.max(0, Math.min(255, Math.round(wert)))
    faecher[fach]++
  }

  const gesamt = werte.length
  if (gesamt === 0) return 128

  let summe = 0
  for (let w = 0; w < 256; w++) summe += w * (faecher[w] ?? 0)

  let summeUnten = 0
  let anzahlUnten = 0
  let bestesMass = -1
  let besteSchwelle = 128

  for (let w = 0; w < 256; w++) {
    anzahlUnten += faecher[w] ?? 0
    if (anzahlUnten === 0) continue
    const anzahlOben = gesamt - anzahlUnten
    if (anzahlOben === 0) break
    summeUnten += w * (faecher[w] ?? 0)
    const mittelUnten = summeUnten / anzahlUnten
    const mittelOben = (summe - summeUnten) / anzahlOben
    const mass = anzahlUnten * anzahlOben * (mittelUnten - mittelOben) ** 2
    if (mass > bestesMass) {
      bestesMass = mass
      besteSchwelle = w
    }
  }
  return besteSchwelle
}

/**
 * Findet zusammenhaengende Abschnitte, in denen eine Bedingung gilt.
 *
 * @param {(index: number) => boolean} bedingung
 * @param {number} laenge
 * @returns {{von: number, bis: number}[]}  bis ist ausschliesslich.
 */
export function findeAbschnitte(bedingung, laenge) {
  const abschnitte = []
  let start = -1
  for (let i = 0; i < laenge; i++) {
    if (bedingung(i)) {
      if (start === -1) start = i
    } else if (start !== -1) {
      abschnitte.push({ von: start, bis: i })
      start = -1
    }
  }
  if (start !== -1) abschnitte.push({ von: start, bis: laenge })
  return abschnitte
}

/**
 * @typedef {object} Kantenfund
 * @property {number[]} kanten     Schnittstellen im Messpuffer, von oben nach unten.
 * @property {number} oben         Erste Zeile mit Inhalt.
 * @property {number} unten        Letzte Zeile mit Inhalt, ausschliesslich.
 * @property {string} verfahren
 * @property {boolean} unterscheidbar  false, wenn Karte und Seite fast gleich hell sind.
 */

/**
 * DIE Zeilenlogik. Nur hier wird entschieden, wo eine Karte aufhoert.
 *
 * @param {Float32Array} mittel
 * @param {Float32Array} streuung
 * @param {number} kartenGrund
 * @param {number} seitenGrund
 * @param {number} kartenMindest  Mindesthoehe einer Karte, im Messpuffer gemessen.
 * @returns {Kantenfund}
 */
export function kartenkanten(mittel, streuung, kartenGrund, seitenGrund, kartenMindest) {
  const hoehe = mittel.length

  // Text erzeugt Streuung. Eine leere Flaeche hat fast keine, egal wie hell sie ist.
  const streuungSchwelle = Math.max(6, otsuUeberReihe(streuung) * 0.5)

  // Drei Arten von Zeilen, und die Unterscheidung ist der Kern der ganzen Sache:
  //
  //   Textzeile        hat Streuung, dort steht etwas.
  //   Hintergrundzeile hat keine Streuung und dieselbe Helligkeit wie die Karte.
  //                    Das ist Leerraum INNERHALB einer Karte und trennt nichts.
  //   Trennzeile       hat keine Streuung, ist aber anders hell als die Karte.
  //                    Das ist entweder die Seite zwischen zwei Karten oder eine
  //                    duenne Trennlinie.
  //
  // Der zweite Fall ist der wichtige. Viele Buchmacher setzen die Karten ohne
  // Abstand untereinander und trennen sie nur durch eine ein bis zwei Bildpunkte
  // duenne graue Linie. Wer nur nach Luecken in der Farbe der Seite sucht, findet
  // dort gar keine Trennung und macht aus der ganzen Liste eine einzige Karte.
  const unterscheidbar = Math.abs(kartenGrund - seitenGrund) >= 6
  const ABSTAND_MINDEST = 5

  /** @param {number} y */
  const istText = (y) => (streuung[y] ?? 0) >= streuungSchwelle

  /** @param {number} y */
  const abstandZurKarte = (y) => Math.abs((mittel[y] ?? 0) - kartenGrund)

  /** @param {number} y */
  const istTrenner = (y) => !istText(y) && abstandZurKarte(y) >= ABSTAND_MINDEST

  /** @param {number} y */
  const istLeer = (y) => !istText(y)

  // Der Inhaltsbereich richtet sich nach dem Text, nicht nach den Trennern.
  const textbereiche = findeAbschnitte(istText, hoehe)
  if (textbereiche.length === 0) {
    return { kanten: [], oben: 0, unten: hoehe, verfahren: 'kein Inhalt', unterscheidbar }
  }

  const oben = textbereiche[0]?.von ?? 0
  const unten = textbereiche[textbereiche.length - 1]?.bis ?? hoehe

  // Kandidaten fuer eine Grenze: jeder zusammenhaengende Bereich ohne Text.
  const ohneText = findeAbschnitte(istLeer, hoehe).filter((l) => l.von > oben && l.bis < unten)

  // ERSTE Bedingung, und die wichtigste: eine Grenze muss mindestens eine Zeile
  // enthalten, die NICHT die Farbe der Karte hat. Leerraum zwischen zwei
  // Textzeilen derselben Karte ist reines Kartenweiss und scheidet damit aus.
  // Ohne diese Bedingung wird jeder Zeilenabstand zur Kartengrenze und eine
  // Karte zerfaellt in ihre Textzeilen.
  /** @type {{von: number, bis: number, dicke: number, linien: number, staerke: number}[]} */
  const kandidaten = []
  for (const l of ohneText) {
    let dicke = 0
    let linien = 0
    let vorherTrenner = false
    for (let y = l.von; y < l.bis; y++) {
      const trenner = istTrenner(y)
      if (trenner) {
        dicke++
        if (!vorherTrenner) linien++
      }
      vorherTrenner = trenner
    }
    if (dicke === 0) continue
    // Zwei getrennte Linien wiegen schwerer als eine dicke. Zwischen zwei Karten
    // liegen naemlich zwei Raender, der untere der einen und der obere der naechsten.
    // Innerhalb einer Karte gibt es nur die eine Trennlinie.
    kandidaten.push({ von: l.von, bis: l.bis, dicke, linien, staerke: linien * 1000 + dicke })
  }

  // Welche Grenzen wirklich Karten trennen, entscheidet die GLEICHMAESSIGKEIT.
  //
  // Der Gedanke: Wettkarten sehen einander aehnlich und sind darum etwa gleich hoch.
  // Schneidet man zusaetzlich an den inneren Trennlinien, entstehen abwechselnd
  // hohe und flache Stuecke, und genau das verraet den falschen Schnitt.
  //
  // Vorher wurde nach der Dicke der Linie entschieden. Das ging schief, sobald
  // eine Karte innen eine Linie ueber der Zeile mit Einsatz und Quote hatte:
  // die Karte wurde dort geteilt, das flache untere Stueck fiel unter die
  // Mindesthoehe, und damit verschwand genau die Zeile mit den Betraegen.
  const staerken = [...new Set(kandidaten.map((k) => k.staerke))].sort((a, b) => b - a)

  /** @type {{grenzen: typeof kandidaten, punkte: number, name: string}[]} */
  const vorschlaege = []

  // Auch gar nicht schneiden ist ein Vorschlag. Bei einer einzelnen Karte gewinnt er.
  vorschlaege.push({
    grenzen: [],
    punkte: bewerteSchnitt([], oben, unten, kartenMindest),
    name: 'ungeteilt',
  })

  for (let i = 0; i < staerken.length; i++) {
    const schwelle = staerken[i] ?? 0
    const auswahl = kandidaten.filter((k) => k.staerke >= schwelle)
    vorschlaege.push({
      grenzen: auswahl,
      punkte: bewerteSchnitt(auswahl, oben, unten, kartenMindest),
      name: i === 0 ? 'nur die staerksten Grenzen' : `Grenzen ab Stufe ${staerken.length - i}`,
    })
  }

  let bester = vorschlaege[0]
  for (const vorschlag of vorschlaege) {
    if (!bester || vorschlag.punkte > bester.punkte) bester = vorschlag
  }
  const gewaehlt = bester?.grenzen ?? []
  const verfahren = bester?.name ?? 'ungeteilt'

  // Geschnitten wird in der MITTE der Luecke, nicht am dunkelsten Punkt.
  // Karten haben oft einen weichen Schatten unter sich, und der dunkelste Punkt
  // liegt dann schon unterhalb der Karte. Ein Schnitt dort nimmt den Schatten mit.
  const kanten = [oben]
  for (const grenze of gewaehlt) {
    kanten.push(Math.round((grenze.von + grenze.bis) / 2))
  }
  kanten.push(unten)

  return { kanten, oben, unten, verfahren, unterscheidbar }
}

/**
 * Bewertet einen Satz Schnittstellen danach, wie gleichmaessig die Stuecke werden.
 *
 * Viele gleich hohe Stuecke sind gut. Wenige oder sehr ungleiche sind schlecht.
 * Die Wurzel aus der Stueckzahl sorgt dafuer, dass ein zusaetzlicher Schnitt sich
 * nur lohnt, wenn er die Gleichmaessigkeit nicht nennenswert verschlechtert.
 *
 * Verglichen wird gegen den MEDIAN, nicht gegen den Mittelwert. Ein einzelnes
 * Stueck, das gar keine Karte ist, etwa der Kopf eines Fensters, verschiebt den
 * Mittelwert so weit, dass die richtige Aufteilung knapp verliert. Der Median
 * laesst sich davon nicht beeindrucken.
 *
 * Zusaetzlich werden Stuecke bestraft, die fuer eine Wettkarte zu flach sind.
 * Ein Stueck von dreissig Bildpunkten ist eine abgeschnittene Karte, keine Karte.
 *
 * @param {{von: number, bis: number}[]} grenzen
 * @param {number} oben
 * @param {number} unten
 * @param {number} kartenMindest
 * @returns {number}
 */
function bewerteSchnitt(grenzen, oben, unten, kartenMindest) {
  const kanten = [oben, ...grenzen.map((g) => Math.round((g.von + g.bis) / 2)), unten]
  /** @type {number[]} */
  const hoehen = []
  for (let i = 0; i < kanten.length - 1; i++) {
    hoehen.push((kanten[i + 1] ?? 0) - (kanten[i] ?? 0))
  }
  if (hoehen.length === 0) return 0
  if (hoehen.length === 1) return 1

  const sortiert = [...hoehen].sort((a, b) => a - b)
  const mitte = Math.floor(sortiert.length / 2)
  const median =
    sortiert.length % 2 === 1
      ? (sortiert[mitte] ?? 0)
      : ((sortiert[mitte - 1] ?? 0) + (sortiert[mitte] ?? 0)) / 2
  if (median <= 0) return 0

  const abweichung = hoehen.reduce((s, h) => s + Math.abs(h - median), 0) / hoehen.length / median
  const gleichmass = 1 - Math.min(1, abweichung)

  const zuFlach = hoehen.filter((h) => h < kartenMindest).length
  const strafe = 1 - 0.6 * (zuFlach / hoehen.length)

  return gleichmass * Math.sqrt(hoehen.length) * strafe
}

/**
 * Zerlegt ein Bild in die einzelnen Wettkarten.
 *
 * @param {CanvasImageSource & {width: number, height: number}} quelle
 * @param {object} [einstellungen]
 * @param {import('../kern/typen.js').Rechteck} [einstellungen.bereich]  Nur dieser Teil wird betrachtet.
 * @param {number} [einstellungen.mindestHoehe]
 * @returns {Zerlegung}
 */
export function zerlege(quelle, einstellungen = {}) {
  const vollBreite = quelle.width
  const vollHoehe = quelle.height
  /** @type {string[]} */
  const hinweise = []

  const bereich = einstellungen.bereich ?? { x: 0, y: 0, breite: vollBreite, hoehe: vollHoehe }
  const mindestHoehe = einstellungen.mindestHoehe ?? KARTE_MINDESTHOEHE

  if (bereich.breite < 20 || bereich.hoehe < 20) {
    return {
      karten: [{ ...bereich }],
      inhalt: { ...bereich },
      dunkelModus: false,
      kartenGrund: 255,
      seitenGrund: 255,
      verfahren: 'zu klein zum Messen',
      hinweise: ['Der Bereich ist zu klein, um ihn zu zerlegen.'],
    }
  }

  const daten = messpuffer(quelle, bereich, ZEILENPUFFER_BREITE, Math.round(bereich.hoehe))
  if (!daten) {
    return {
      karten: [{ ...bereich }],
      inhalt: { ...bereich },
      dunkelModus: false,
      kartenGrund: 255,
      seitenGrund: 255,
      verfahren: 'kein Zeichenkontext',
      hinweise: ['Der Browser stellt keinen 2D-Zeichenkontext bereit.'],
    }
  }

  // Der Rand des Ausschnitts zeigt die Seite, die Mitte zeigt die Karte.
  const seitenGrund = haeufigsteHelligkeit(daten, 0, 0, daten.width, Math.max(2, daten.height * 0.02))
  const kartenGrund = haeufigsteHelligkeit(
    daten, daten.width * 0.2, daten.height * 0.25, daten.width * 0.8, daten.height * 0.75
  )
  const dunkelModus = kartenGrund < 110

  const { mittel, streuung } = zeilenprofil(daten)
  const massstabY = bereich.hoehe / daten.height
  const fund = kartenkanten(
    mittel, streuung, kartenGrund, seitenGrund, Math.max(8, mindestHoehe / massstabY)
  )

  if (fund.kanten.length < 2) {
    hinweise.push('In diesem Bild war kein Text zu finden.')
    return {
      karten: [{ ...bereich }],
      inhalt: { ...bereich },
      dunkelModus,
      kartenGrund,
      seitenGrund,
      verfahren: fund.verfahren,
      hinweise,
    }
  }

  // Zurueck auf die Bildpunkte des Originals. Der Anfang wird abgerundet, das Ende
  // aufgerundet. Andersherum faellt bei jeder Karte die oberste Textzeile ab.
  /** @type {import('../kern/typen.js').Rechteck[]} */
  const karten = []
  /** @type {number[]} */
  const verworfen = []
  for (let i = 0; i < fund.kanten.length - 1; i++) {
    const vonMess = fund.kanten[i] ?? 0
    const bisMess = fund.kanten[i + 1] ?? 0
    const y0 = Math.floor(bereich.y + vonMess * massstabY)
    const y1 = Math.ceil(bereich.y + bisMess * massstabY)
    const hoehe = y1 - y0
    if (hoehe < mindestHoehe) {
      // NICHT wortlos ueberspringen. Ein unten abgeschnittener Schein oder eine
      // flache Zusammenfassungszeile faellt hier heraus, und danach sagt nichts
      // mehr, dass es sie gab. Bei zwei Karten faengt der Notweg weiter unten
      // das noch ab, bei drei verschwindet die flache lautlos zwischen zwei
      // erfolgreichen. Aussortiertes bleibt sichtbar.
      verworfen.push(hoehe)
      continue
    }
    karten.push({
      x: Math.floor(bereich.x),
      y: Math.max(0, y0),
      breite: Math.ceil(bereich.breite),
      hoehe: Math.min(vollHoehe - Math.max(0, y0), hoehe),
    })
  }

  if (verworfen.length > 0) {
    hinweise.push(
      `${verworfen.length} Stueck(e) waren flacher als ${mindestHoehe} Bildpunkte ` +
        `(${verworfen.join(', ')}) und wurden nicht als Karte genommen. ` +
        'Wenn dort ein Schein stand, fehlt er jetzt.'
    )
  }

  let verfahren = fund.verfahren
  if (karten.length === 0) {
    hinweise.push('Es liess sich keine Karte abgrenzen. Das ganze Bild wird als eine Karte behandelt.')
    karten.push({ ...bereich })
    verfahren = 'ungeteilt'
  }

  if (dunkelModus) {
    hinweise.push('Das Bild ist im dunklen Modus aufgenommen. Es wird vor dem Lesen umgekehrt.')
  }
  if (!fund.unterscheidbar) {
    hinweise.push(
      'Karten- und Seitenhintergrund sind fast gleich hell. Die Trennung ist deshalb unsicher, ' +
        'bitte die Schnittkanten pruefen.'
    )
  }

  return {
    karten,
    inhalt: {
      x: Math.floor(bereich.x),
      y: Math.floor(bereich.y + fund.oben * massstabY),
      breite: Math.ceil(bereich.breite),
      hoehe: Math.ceil((fund.unten - fund.oben) * massstabY),
    },
    dunkelModus,
    kartenGrund,
    seitenGrund,
    verfahren,
    hinweise,
  }
}

/**
 * Hinweis zur Fenstersuche in einem Vollbild-Screenshot.
 *
 * Es gab hier eine Funktion findePanel, die auf einem ganzen Browserfenster
 * selbst nach der Wettliste suchen sollte. Sie ist absichtlich wieder entfernt.
 *
 * Der Grund: auf einer Buchmacherseite gibt es mehrere gleichmaessige Listen.
 * Die Menueleiste links, die Marktliste in der Mitte, die Quotenkaesten rechts.
 * Jede Regel, die eine davon ausschloss, liess die naechste gewinnen. Zuletzt
 * lieferte die Suche selbstbewusst einen Bereich, dessen linke Kante um 250
 * Bildpunkte danebenlag. Der Ausschnitt haette dann Text von der Seite dahinter
 * mit in die Texterkennung genommen.
 *
 * Ein selbstbewusst falscher Vorschlag kostet mehr, als er spart. Deshalb zieht
 * der Nutzer den Rahmen selbst, siehe oberflaeche/ansicht_aufnahme.js. Das dauert
 * drei Sekunden und ist immer richtig.
 */


/**
 * Sucht den Inhaltsbereich in der Breite, also die linke und rechte Kante des Panels.
 *
 * @param {CanvasImageSource & {width: number, height: number}} quelle
 * @returns {{x: number, breite: number, sicher: boolean}}
 */
export function findeInhaltsspalte(quelle) {
  const breite = quelle.width
  const hoehe = quelle.height
  if (breite < 20 || hoehe < 20) return { x: 0, breite, sicher: false }

  const daten = messpuffer(
    quelle, { x: 0, y: 0, breite, hoehe }, breite, Math.min(SPALTENPUFFER_HOEHE, hoehe)
  )
  if (!daten) return { x: 0, breite, sicher: false }

  const { streuung } = spaltenprofil(daten)
  const schwelle = Math.max(5, otsuUeberReihe(streuung) * 0.5)

  const abschnitte = findeAbschnitte((x) => (streuung[x] ?? 0) >= schwelle, daten.width)
  if (abschnitte.length === 0) return { x: 0, breite, sicher: false }

  // Genommen wird der umschliessende Rahmen von der ersten bis zur letzten Spalte
  // mit Inhalt, NICHT der breiteste zusammenhaengende Block.
  //
  // Der Grund: eine Wettkarte hat Text in mehreren Gruppen nebeneinander, links
  // der Tipp, in der Mitte der Einsatz, rechts die Auszahlung. Dazwischen liegt
  // Leerraum. Wer den breitesten zusammenhaengenden Block nimmt, erwischt nur die
  // linke Gruppe und schneidet Einsatz und Auszahlung ab. Genau die beiden Zahlen,
  // um die es geht. Der umschliessende Rahmen kann diesen Fehler nicht machen.
  const erster = abschnitte[0]
  const letzter = abschnitte[abschnitte.length - 1]
  if (!erster || !letzter) return { x: 0, breite, sicher: false }

  const massstab = breite / daten.width
  const x = Math.max(0, Math.floor(erster.von * massstab) - 4)
  const rechts = Math.min(breite, Math.ceil(letzter.bis * massstab) + 4)
  const gefundeneBreite = rechts - x

  // Bleibt kaum etwas uebrig, war ohnehin nichts abzugrenzen. Dann lieber das
  // ganze Bild nehmen, als versehentlich etwas wegzuschneiden.
  if (gefundeneBreite > breite * 0.92 || gefundeneBreite < breite * 0.2) {
    return { x: 0, breite, sicher: false }
  }
  return { x, breite: gefundeneBreite, sicher: true }
}

/**
 * Sucht senkrechte Gassen, also ob die Karten nebeneinander statt untereinander liegen.
 *
 * @param {CanvasImageSource & {width: number, height: number}} quelle
 * @param {import('../kern/typen.js').Rechteck} [bereich]
 * @returns {{von: number, bis: number}[]}  Spaltenbereiche im Original.
 */
export function findeSpalten(quelle, bereich) {
  const b = bereich ?? { x: 0, y: 0, breite: quelle.width, hoehe: quelle.height }
  if (b.breite < 40) return [{ von: b.x, bis: b.x + b.breite }]

  const daten = messpuffer(quelle, b, Math.round(b.breite), Math.min(SPALTENPUFFER_HOEHE, Math.round(b.hoehe)))
  if (!daten) return [{ von: b.x, bis: b.x + b.breite }]

  const { streuung } = spaltenprofil(daten)
  const schwelle = Math.max(5, otsuUeberReihe(streuung) * 0.4)
  const inhalt = findeAbschnitte((x) => (streuung[x] ?? 0) >= schwelle, daten.width)

  // Die Regel ist bewusst streng.
  //
  // Innerhalb EINER Wettkarte steht Text ebenfalls in Gruppen nebeneinander:
  // links der Tipp, in der Mitte der Einsatz, rechts die Auszahlung. Wer diese
  // Gruppen fuer Spalten haelt, zerschneidet jede Karte senkrecht und verliert
  // genau die Zahlen, um die es geht.
  //
  // Echte Kartenspalten erkennt man daran, dass sie breit sind und dass sie
  // ungefaehr gleich breit sind. Ein uebersehener Spaltenschnitt ist laestig und
  // von Hand zu beheben. Ein falscher Spaltenschnitt verdirbt die Zahlen.
  const gassenMindest = Math.max(20, daten.width * 0.05)
  const spaltenMindest = daten.width * 0.3

  /** @type {{von: number, bis: number}[]} */
  const spalten = []
  let laufend = null
  for (const abschnitt of inhalt) {
    if (laufend === null) {
      laufend = { von: abschnitt.von, bis: abschnitt.bis }
      continue
    }
    if (abschnitt.von - laufend.bis < gassenMindest) {
      laufend.bis = abschnitt.bis
    } else {
      spalten.push(laufend)
      laufend = { von: abschnitt.von, bis: abschnitt.bis }
    }
  }
  if (laufend) spalten.push(laufend)

  const breit = spalten.filter((s) => s.bis - s.von >= spaltenMindest)
  if (breit.length <= 1) return [{ von: b.x, bis: b.x + b.breite }]

  // Kartenspalten sind ungefaehr gleich breit. Sind sie das nicht, war es
  // wahrscheinlich doch nur die innere Aufteilung einer einzelnen Karte.
  const breiten = breit.map((s) => s.bis - s.von)
  const schmalste = Math.min(...breiten)
  const breiteste = Math.max(...breiten)
  if (breiteste / schmalste > 1.6) return [{ von: b.x, bis: b.x + b.breite }]

  return breit.map((s) => ({ von: b.x + s.von, bis: b.x + s.bis }))
}
