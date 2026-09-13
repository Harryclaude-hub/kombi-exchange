// @ts-check
/**
 * Ein Bildschirmfoto in einzelne Wettkarten zerlegen.
 *
 * Der Kniff steckt in den Messpuffern. Wer das Bild vor der Messung in BEIDEN
 * Richtungen verkleinert, macht aus einer 1 Bildpunkt duennen Trennlinie nichts
 * und aus einem schwachen Kartenrand einen halb so starken. Deshalb wird je
 * Richtung ein eigener Puffer gebaut, der in der gemessenen Richtung die volle
 * Aufloesung behaelt und nur quer dazu verkleinert wird. Das ist schnell und
 * verliert genau das nicht, worauf es ankommt.
 *
 * Erkannt wird ueber Mittelwert UND Streuung je Zeile. Die Helligkeit allein
 * reicht nicht: eine weisse Karte und eine hellgraue Seite sind beide "ohne Text",
 * aber nur die eine ist eine Luecke zwischen zwei Karten.
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

/** Eine Luecke muss mindestens so hoch sein, in Bildpunkten des Originals. */
const LUECKE_MINDESTHOEHE = 5

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
 * Zeichnet ein Bild deckend auf eine Leinwand.
 *
 * Das Weiss darunter ist wichtig: bei einem PNG mit Transparenz liefert
 * getImageData sonst Unsinn in den durchsichtigen Bereichen.
 *
 * @param {CanvasImageSource} quelle
 * @param {number} breite
 * @param {number} hoehe
 * @returns {ImageData}
 */
function messpuffer(quelle, breite, hoehe) {
  const leinwand = document.createElement('canvas')
  leinwand.width = Math.max(1, Math.round(breite))
  leinwand.height = Math.max(1, Math.round(hoehe))
  const kontext = leinwand.getContext('2d', { willReadFrequently: true, alpha: false })
  if (!kontext) throw new Error('Der Browser stellt keinen 2D-Zeichenkontext bereit.')

  kontext.fillStyle = '#ffffff'
  kontext.fillRect(0, 0, leinwand.width, leinwand.height)
  kontext.imageSmoothingEnabled = true
  kontext.imageSmoothingQuality = 'high'
  kontext.drawImage(quelle, 0, 0, leinwand.width, leinwand.height)
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
 * Mittelwert und Streuung je Zeile, gemessen im mittleren Teil der Breite.
 *
 * @param {ImageData} daten
 * @param {number} [fenster]  Anteil der Breite, der gemessen wird.
 * @returns {{mittel: Float32Array, streuung: Float32Array}}
 */
export function zeilenprofil(daten, fenster = MESSFENSTER) {
  const { width: breite, height: hoehe, data: pixel } = daten
  const rand = Math.floor((breite * (1 - fenster)) / 2)
  const von = Math.max(0, rand)
  const bis = Math.min(breite, breite - rand)
  const anzahl = Math.max(1, bis - von)

  const mittel = new Float32Array(hoehe)
  const streuung = new Float32Array(hoehe)

  for (let y = 0; y < hoehe; y++) {
    let summe = 0
    let summeQuadrat = 0
    for (let x = von; x < bis; x++) {
      const wert = helligkeit(pixel, (y * breite + x) * 4)
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

  // ---- Messpuffer fuer die Zeilen: quer verkleinert, in der Hoehe voll. ----
  const zeilenLeinwand = document.createElement('canvas')
  zeilenLeinwand.width = ZEILENPUFFER_BREITE
  zeilenLeinwand.height = Math.round(bereich.hoehe)
  const zk = zeilenLeinwand.getContext('2d', { willReadFrequently: true, alpha: false })
  if (!zk) throw new Error('Der Browser stellt keinen 2D-Zeichenkontext bereit.')
  zk.fillStyle = '#ffffff'
  zk.fillRect(0, 0, zeilenLeinwand.width, zeilenLeinwand.height)
  zk.imageSmoothingEnabled = true
  zk.imageSmoothingQuality = 'high'
  zk.drawImage(
    quelle,
    bereich.x, bereich.y, bereich.breite, bereich.hoehe,
    0, 0, zeilenLeinwand.width, zeilenLeinwand.height
  )
  const zeilenDaten = zk.getImageData(0, 0, zeilenLeinwand.width, zeilenLeinwand.height)

  // ---- Hintergrundfarben bestimmen. ----
  // Der Rand des Bildes zeigt die Seite, die Mitte zeigt die Karte.
  const seitenGrund = haeufigsteHelligkeit(
    zeilenDaten, 0, 0, zeilenDaten.width, Math.max(2, zeilenDaten.height * 0.02)
  )
  const kartenGrund = haeufigsteHelligkeit(
    zeilenDaten,
    zeilenDaten.width * 0.2, zeilenDaten.height * 0.25,
    zeilenDaten.width * 0.8, zeilenDaten.height * 0.75
  )
  const dunkelModus = kartenGrund < 110

  const { mittel, streuung } = zeilenprofil(zeilenDaten)

  // ---- Schwelle fuer "hier steht etwas". ----
  // Text erzeugt Streuung. Eine leere Flaeche hat fast keine, egal wie hell sie ist.
  const streuungSchwelle = Math.max(6, otsuUeberReihe(streuung) * 0.5)

  // Eine Luecke zwischen zwei Karten hat wenig Streuung UND liegt naeher am
  // Seitenhintergrund als am Kartenhintergrund. Eine leere Zeile innerhalb einer
  // Karte hat ebenfalls wenig Streuung, liegt aber beim Kartenhintergrund.
  const grundUnterschied = Math.abs(kartenGrund - seitenGrund)
  const kannUnterscheiden = grundUnterschied >= 6

  /** @param {number} y */
  const istLuecke = (y) => {
    if ((streuung[y] ?? 0) >= streuungSchwelle) return false
    if (!kannUnterscheiden) return true
    const abstandKarte = Math.abs((mittel[y] ?? 0) - kartenGrund)
    const abstandSeite = Math.abs((mittel[y] ?? 0) - seitenGrund)
    return abstandSeite <= abstandKarte
  }

  const luecken = findeAbschnitte(istLuecke, zeilenDaten.height)
  const inhaltAbschnitte = findeAbschnitte((y) => !istLuecke(y), zeilenDaten.height)

  if (inhaltAbschnitte.length === 0) {
    hinweise.push('In diesem Bild war kein Text zu finden.')
    return {
      karten: [{ ...bereich }],
      inhalt: { ...bereich },
      dunkelModus,
      kartenGrund,
      seitenGrund,
      verfahren: 'kein Inhalt gefunden',
      hinweise,
    }
  }

  // ---- Welche Luecken trennen Karten, welche trennen nur Textzeilen? ----
  // Die Luecken zwischen Textzeilen sind klein, die zwischen Karten deutlich groesser.
  // Die Grenze wird aus der Verteilung selbst gewonnen, nicht fest vorgegeben.
  const innere = luecken.filter(
    (l) => l.von > (inhaltAbschnitte[0]?.von ?? 0) && l.bis < (inhaltAbschnitte[inhaltAbschnitte.length - 1]?.bis ?? zeilenDaten.height)
  )
  const laengen = innere.map((l) => l.bis - l.von).sort((a, b) => a - b)

  let trennSchwelle = Math.max(LUECKE_MINDESTHOEHE, 6)
  let verfahren = 'feste Mindestluecke'
  if (laengen.length >= 3) {
    const grenze = otsuUeberReihe(Float32Array.from(laengen.map((l) => Math.min(255, l))))
    if (grenze > trennSchwelle) {
      trennSchwelle = grenze
      verfahren = 'Luecken nach Otsu getrennt'
    }
  }

  const trennende = innere.filter((l) => l.bis - l.von >= trennSchwelle)

  // ---- Schnittkanten setzen. ----
  // Geschnitten wird in der MITTE der Luecke, nicht am dunkelsten Punkt.
  // Karten haben oft einen weichen Schatten unter sich, und der dunkelste Punkt
  // liegt dann schon unterhalb der Karte. Ein Schnitt dort nimmt den Schatten mit.
  const oben = inhaltAbschnitte[0]?.von ?? 0
  const unten = inhaltAbschnitte[inhaltAbschnitte.length - 1]?.bis ?? zeilenDaten.height

  const kanten = [oben]
  for (const luecke of trennende) {
    kanten.push(Math.round((luecke.von + luecke.bis) / 2))
  }
  kanten.push(unten)

  // ---- Zurueck auf die Bildpunkte des Originals. ----
  // Der Anfang wird abgerundet, das Ende aufgerundet. Andersherum faellt bei jeder
  // Karte die oberste Textzeile ab.
  const massstabY = bereich.hoehe / zeilenDaten.height

  /** @type {import('../kern/typen.js').Rechteck[]} */
  const karten = []
  for (let i = 0; i < kanten.length - 1; i++) {
    const vonMess = kanten[i] ?? 0
    const bisMess = kanten[i + 1] ?? 0
    const y0 = Math.floor(bereich.y + vonMess * massstabY)
    const y1 = Math.ceil(bereich.y + bisMess * massstabY)
    const hoehe = y1 - y0
    if (hoehe < mindestHoehe) continue
    karten.push({
      x: Math.floor(bereich.x),
      y: Math.max(0, y0),
      breite: Math.ceil(bereich.breite),
      hoehe: Math.min(vollHoehe - Math.max(0, y0), hoehe),
    })
  }

  if (karten.length === 0) {
    hinweise.push(
      'Es liess sich keine Karte abgrenzen. Das ganze Bild wird als eine Karte behandelt.'
    )
    karten.push({ ...bereich })
    verfahren = 'ungeteilt'
  }

  const inhalt = {
    x: Math.floor(bereich.x),
    y: Math.floor(bereich.y + oben * massstabY),
    breite: Math.ceil(bereich.breite),
    hoehe: Math.ceil((unten - oben) * massstabY),
  }

  if (dunkelModus) {
    hinweise.push('Das Bild ist im dunklen Modus aufgenommen. Es wird vor dem Lesen umgekehrt.')
  }
  if (!kannUnterscheiden) {
    hinweise.push(
      'Karten- und Seitenhintergrund sind fast gleich hell. Die Trennung ist deshalb unsicher, ' +
        'bitte die Schnittkanten pruefen.'
    )
  }

  return { karten, inhalt, dunkelModus, kartenGrund, seitenGrund, verfahren, hinweise }
}

/**
 * Sucht den Inhaltsbereich in der Breite, also die linke und rechte Kante des Panels.
 *
 * Bei einem Vollbild-Screenshot steht die Wettuebersicht als Fenster ueber einer
 * unruhigen Seite. Die Spaltenmessung findet die Kanten dieses Fensters.
 *
 * @param {CanvasImageSource & {width: number, height: number}} quelle
 * @returns {{x: number, breite: number, sicher: boolean}}
 */
export function findeInhaltsspalte(quelle) {
  const breite = quelle.width
  const hoehe = quelle.height
  if (breite < 20 || hoehe < 20) return { x: 0, breite, sicher: false }

  const daten = messpuffer(quelle, breite, Math.min(SPALTENPUFFER_HOEHE, hoehe))
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
 * Wird das uebersehen, schneidet jeder waagrechte Schnitt durch mehrere Karten
 * gleichzeitig und liefert unbrauchbare Haelften.
 *
 * @param {CanvasImageSource & {width: number, height: number}} quelle
 * @param {import('../kern/typen.js').Rechteck} [bereich]
 * @returns {{von: number, bis: number}[]}  Spaltenbereiche im Original.
 */
export function findeSpalten(quelle, bereich) {
  const b = bereich ?? { x: 0, y: 0, breite: quelle.width, hoehe: quelle.height }
  if (b.breite < 40) return [{ von: b.x, bis: b.x + b.breite }]

  const leinwand = document.createElement('canvas')
  leinwand.width = Math.round(b.breite)
  leinwand.height = Math.min(SPALTENPUFFER_HOEHE, Math.round(b.hoehe))
  const kontext = leinwand.getContext('2d', { willReadFrequently: true, alpha: false })
  if (!kontext) return [{ von: b.x, bis: b.x + b.breite }]
  kontext.fillStyle = '#ffffff'
  kontext.fillRect(0, 0, leinwand.width, leinwand.height)
  kontext.drawImage(quelle, b.x, b.y, b.breite, b.hoehe, 0, 0, leinwand.width, leinwand.height)

  const daten = kontext.getImageData(0, 0, leinwand.width, leinwand.height)
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
