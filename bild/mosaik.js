// @ts-check
/**
 * Der Riesenschein als Bild.
 *
 * Aus den einzelnen Kartenausschnitten wird ein grosses Blatt gesetzt, mit Kopfzeile,
 * Gesamtzahlen und einer Beschriftung je Schein. Das ist das Blatt, das Karam
 * weiterschicken will: man sieht auf einen Blick, wo ueberall gesetzt wurde.
 *
 * Diese Datei bringt ihre eigenen Farben mit und laeuft auch dann, wenn der
 * gesamte Ordner stil geloescht wird. Wer eigene Farben will, reicht sie herein.
 *
 * Zwei Fallen, die hier beachtet sind:
 *   Leinwaende haben eine Hoechstgroesse. Wird sie ueberschritten, kommt KEINE
 *   Fehlermeldung, es wird nur nichts mehr gezeichnet. Deshalb wird vorher gemessen.
 *   willReadFrequently schaltet die Beschleunigung ab. Beim Zusammensetzen waere das
 *   fatal, hier wird es deshalb bewusst NICHT gesetzt.
 */

import { formatiere, formatiereQuote } from '../kern/geld.js'

/** Standardfarben. Bewusst neutral, damit die Datei allein lauffaehig bleibt. */
export const STANDARDFARBEN = {
  grund: '#0b0f16',
  flaeche: '#111725',
  linie: '#22304a',
  schrift: '#e8eef8',
  schriftLeise: '#8fa3c0',
  gut: '#18c98a',
  schlecht: '#ff5f6d',
  offen: '#f0b429',
  betonung: '#4da3ff',
}

/** Schriftfamilien. Zahlen brauchen eine Schrift mit fester Breite, sonst springt die Spalte. */
const SCHRIFT = {
  text: '"Segoe UI", system-ui, -apple-system, Arial, sans-serif',
  zahl: '"JetBrains Mono", "Cascadia Mono", Consolas, "Courier New", monospace',
}

/**
 * Ermittelt, wie gross eine Leinwand in diesem Browser hoechstens sein darf.
 *
 * Es gibt dafuer keine Auskunftsstelle, also wird es ausprobiert. Das Ergebnis
 * wird gemerkt, damit die Probe nur einmal laeuft.
 *
 * @returns {{maxKante: number, maxFlaeche: number}}
 */
export const leinwandGrenze = (() => {
  /** @type {{maxKante: number, maxFlaeche: number}|null} */
  let gemerkt = null

  return function grenze() {
    if (gemerkt) return gemerkt

    const kantenKandidaten = [32767, 16384, 8192, 4096]
    let maxKante = 4096
    for (const kante of kantenKandidaten) {
      if (kannZeichnen(kante, 1)) {
        maxKante = kante
        break
      }
    }

    const flaechenKandidaten = [268435456, 134217728, 67108864, 33554432, 16777216, 4194304]
    let maxFlaeche = 4194304
    for (const flaeche of flaechenKandidaten) {
      const seite = Math.floor(Math.sqrt(flaeche))
      if (seite <= maxKante && kannZeichnen(seite, seite)) {
        maxFlaeche = flaeche
        break
      }
    }

    gemerkt = { maxKante, maxFlaeche }
    return gemerkt
  }
})()

/**
 * Prueft, ob auf eine Leinwand dieser Groesse wirklich gezeichnet wird.
 *
 * Der Trick: einen Punkt setzen und ihn wieder auslesen. Ist die Leinwand zu gross,
 * bleibt er schwarz, ohne dass ein Fehler geworfen wird.
 *
 * @param {number} breite
 * @param {number} hoehe
 * @returns {boolean}
 */
function kannZeichnen(breite, hoehe) {
  try {
    const leinwand = document.createElement('canvas')
    leinwand.width = breite
    leinwand.height = hoehe
    const kontext = leinwand.getContext('2d', { willReadFrequently: true })
    if (!kontext) return false
    kontext.fillStyle = '#ff0000'
    kontext.fillRect(breite - 1, hoehe - 1, 1, 1)
    const punkt = kontext.getImageData(breite - 1, hoehe - 1, 1, 1).data
    return (punkt[0] ?? 0) > 200
  } catch {
    return false
  }
}

/**
 * @typedef {object} Mosaikschein
 * @property {import('../kern/typen.js').Schein} schein
 * @property {CanvasImageSource & {width: number, height: number}} bild  Das Quellbild.
 * @property {import('../kern/typen.js').Rechteck} ausschnitt
 */

/**
 * @typedef {object} Mosaikeinstellungen
 * @property {string} titel
 * @property {string} [untertitel]
 * @property {number} [spaltenBreite]   Breite einer Kartenspalte in Bildpunkten.
 * @property {number} [spalten]         Feste Spaltenzahl, sonst automatisch.
 * @property {typeof STANDARDFARBEN} [farben]
 * @property {'de'|'en'} [gebiet]
 * @property {boolean} [mitKopf]        Kopfzeile mit den Summen. Vorgabe true.
 * @property {boolean} [mitBeschriftung] Beschriftung je Schein. Vorgabe true.
 */

/**
 * Setzt den Riesenschein zusammen.
 *
 * @param {Mosaikschein[]} posten
 * @param {import('../kern/typen.js').Rechnung} rechnung
 * @param {Mosaikeinstellungen} einstellungen
 * @returns {{leinwand: HTMLCanvasElement, hinweise: string[]}}
 */
export function baueMosaik(posten, rechnung, einstellungen) {
  /** @type {string[]} */
  const hinweise = []
  const farben = { ...STANDARDFARBEN, ...(einstellungen.farben ?? {}) }
  const gebiet = einstellungen.gebiet ?? 'de'
  const mitKopf = einstellungen.mitKopf !== false
  const mitBeschriftung = einstellungen.mitBeschriftung !== false

  if (posten.length === 0) {
    throw new Error('Ohne Scheine laesst sich kein Riesenschein bauen.')
  }

  const rand = 28
  const abstand = 20
  const beschriftungHoehe = mitBeschriftung ? 54 : 0

  // Die Spaltenbreite richtet sich nach den Ausschnitten selbst. Wer sie fest
  // vorgibt, skaliert jeden Ausschnitt hoch oder runter und macht die Schrift
  // darin unscharf. Genau die Schrift, die man auf dem Blatt lesen will.
  const quellbreiten = posten.map((p) => p.ausschnitt.breite).sort((a, b) => a - b)
  const mittlereBreite = quellbreiten[Math.floor(quellbreiten.length / 2)] ?? 540
  let spaltenBreite = einstellungen.spaltenBreite ?? Math.round(Math.min(760, Math.max(380, mittlereBreite)))

  // ---- Spaltenzahl waehlen. ----
  // Bei vielen Scheinen wird das Blatt sonst so lang, dass es niemand mehr ansieht.
  let spalten = einstellungen.spalten ?? 1
  if (!einstellungen.spalten) {
    if (posten.length > 24) spalten = 4
    else if (posten.length > 12) spalten = 3
    else if (posten.length > 5) spalten = 2
  }

  // ---- Hoehe je Schein nach dem Skalieren auf die Spaltenbreite. ----
  /** @param {number} breite */
  const masseFuer = (breite) =>
    posten.map((p) => {
      const faktor = breite / Math.max(1, p.ausschnitt.breite)
      return Math.round(p.ausschnitt.hoehe * faktor) + beschriftungHoehe
    })

  const grenze = leinwandGrenze()

  /**
   * Rechnet die Gesamtmasse fuer eine gegebene Spaltenbreite aus.
   * @param {number} breite
   * @param {number} anzahlSpalten
   */
  const planen = (breite, anzahlSpalten) => {
    const hoehen = masseFuer(breite)
    const spaltenHoehen = new Array(anzahlSpalten).fill(0)
    /** @type {{spalte: number, y: number, hoehe: number}[]} */
    const plaetze = []
    for (let i = 0; i < posten.length; i++) {
      // Immer in die kuerzeste Spalte, dann bleibt das Blatt kompakt.
      let ziel = 0
      for (let s = 1; s < anzahlSpalten; s++) {
        if ((spaltenHoehen[s] ?? 0) < (spaltenHoehen[ziel] ?? 0)) ziel = s
      }
      const hoehe = hoehen[i] ?? 0
      plaetze.push({ spalte: ziel, y: spaltenHoehen[ziel] ?? 0, hoehe })
      spaltenHoehen[ziel] = (spaltenHoehen[ziel] ?? 0) + hoehe + abstand
    }
    const inhaltsHoehe = Math.max(...spaltenHoehen, 0)
    const gesamtBreite = rand * 2 + anzahlSpalten * breite + (anzahlSpalten - 1) * abstand
    const kopfHoehe = mitKopf ? kopfhoeheFuer(gesamtBreite) : 0
    return {
      plaetze,
      breite: gesamtBreite,
      hoehe: rand * 2 + kopfHoehe + inhaltsHoehe,
      kopfHoehe,
      spaltenBreite: breite,
      spalten: anzahlSpalten,
    }
  }

  let plan = planen(spaltenBreite, spalten)

  // ---- Notfalls verkleinern, bis die Leinwand erlaubt ist. ----
  let versuche = 0
  while (
    (plan.breite > grenze.maxKante ||
      plan.hoehe > grenze.maxKante ||
      plan.breite * plan.hoehe > grenze.maxFlaeche) &&
    versuche < 12
  ) {
    versuche++
    if (plan.hoehe > plan.breite * 2.5 && spalten < 6) {
      spalten++
    } else {
      spaltenBreite = Math.round(spaltenBreite * 0.85)
    }
    if (spaltenBreite < 160) {
      hinweise.push(
        'Der Riesenschein ist zu gross fuer eine einzige Bilddatei. Bitte in mehrere ' +
          'Riesenscheine aufteilen oder ohne Beschriftung ausgeben.'
      )
      break
    }
    plan = planen(spaltenBreite, spalten)
  }
  if (versuche > 0) {
    hinweise.push(
      `Das Blatt wurde auf ${plan.spalten} Spalte(n) mit ${plan.spaltenBreite} Bildpunkten ` +
        'Breite verkleinert, damit es der Browser noch zeichnen kann.'
    )
  }

  // ---- Zeichnen. Hier bewusst OHNE willReadFrequently. ----
  const leinwand = document.createElement('canvas')
  leinwand.width = plan.breite
  leinwand.height = plan.hoehe
  const k = leinwand.getContext('2d')
  if (!k) throw new Error('Der Browser stellt keinen 2D-Zeichenkontext bereit.')

  k.fillStyle = farben.grund
  k.fillRect(0, 0, leinwand.width, leinwand.height)

  if (mitKopf) {
    zeichneKopf(k, plan.breite, plan.kopfHoehe, rechnung, einstellungen, farben, gebiet)
  }

  for (let i = 0; i < posten.length; i++) {
    const posten_i = posten[i]
    const platz = plan.plaetze[i]
    if (!posten_i || !platz) continue

    const x = rand + platz.spalte * (plan.spaltenBreite + abstand)
    const y = rand + plan.kopfHoehe + platz.y
    const bildHoehe = platz.hoehe - beschriftungHoehe

    // Rahmen und Flaeche.
    k.fillStyle = farben.flaeche
    k.fillRect(x - 6, y - 6, plan.spaltenBreite + 12, platz.hoehe + 12)
    k.strokeStyle = farben.linie
    k.lineWidth = 1
    k.strokeRect(x - 6.5, y - 6.5, plan.spaltenBreite + 13, platz.hoehe + 13)

    // Der Kartenausschnitt.
    k.drawImage(
      posten_i.bild,
      posten_i.ausschnitt.x,
      posten_i.ausschnitt.y,
      posten_i.ausschnitt.breite,
      posten_i.ausschnitt.hoehe,
      x,
      y,
      plan.spaltenBreite,
      bildHoehe
    )

    if (mitBeschriftung) {
      zeichneBeschriftung(
        k,
        posten_i.schein,
        i + 1,
        x,
        y + bildHoehe,
        plan.spaltenBreite,
        beschriftungHoehe,
        farben,
        gebiet
      )
    }
  }

  return { leinwand, hinweise }
}

/** Wie viele Kennzahlen nebeneinander passen, ohne dass sich die Woerter beruehren. */
const KENNZAHLEN = 6

/**
 * @param {number} breite
 * @returns {number}
 */
function kennzahlenProReihe(breite) {
  const innen = breite - 56 - 32
  // Unter etwa 150 Bildpunkten je Spalte laufen Beschriftung und Zahl ineinander.
  const passen = Math.max(1, Math.floor(innen / 150))
  return Math.min(KENNZAHLEN, passen)
}

/**
 * @param {number} breite
 * @returns {number}
 */
function kopfhoeheFuer(breite) {
  const reihen = Math.ceil(KENNZAHLEN / kennzahlenProReihe(breite))
  return 96 + reihen * 52 + 30
}

/**
 * Zeichnet die Kopfzeile mit den Gesamtzahlen.
 *
 * @param {CanvasRenderingContext2D} k
 * @param {number} breite
 * @param {number} hoehe
 * @param {import('../kern/typen.js').Rechnung} rechnung
 * @param {Mosaikeinstellungen} einstellungen
 * @param {typeof STANDARDFARBEN} farben
 * @param {'de'|'en'} gebiet
 */
function zeichneKopf(k, breite, hoehe, rechnung, einstellungen, farben, gebiet) {
  const rand = 28
  const w = rechnung.waehrung

  k.fillStyle = farben.flaeche
  k.fillRect(rand, rand, breite - rand * 2, hoehe - 18)
  k.strokeStyle = farben.linie
  k.lineWidth = 1
  k.strokeRect(rand + 0.5, rand + 0.5, breite - rand * 2 - 1, hoehe - 19)

  k.textBaseline = 'top'

  // Der Titel wird kleiner gesetzt, wenn das Blatt schmal ist, statt ihn abzuschneiden.
  const titelgroesse = breite < 620 ? 18 : breite < 820 ? 22 : 26
  k.fillStyle = farben.schrift
  k.font = `600 ${titelgroesse}px ${SCHRIFT.text}`
  k.fillText(kuerze(k, einstellungen.titel, breite - rand * 2 - 32), rand + 16, rand + 14)

  if (einstellungen.untertitel) {
    k.fillStyle = farben.schriftLeise
    k.font = `400 14px ${SCHRIFT.text}`
    k.fillText(kuerze(k, einstellungen.untertitel, breite - rand * 2 - 32), rand + 16, rand + 48)
  }

  const felder = [
    { name: 'Gesamteinsatz', wert: formatiere(rechnung.einsatzGesamt, w, gebiet), farbe: farben.schrift },
    { name: 'Scheine', wert: String(rechnung.anzahlScheine), farbe: farben.schrift },
    { name: 'Anbieter', wert: String(rechnung.anzahlBuchmacher), farbe: farben.schrift },
    {
      name: 'Effektive Quote',
      wert: formatiereQuote(rechnung.quoteEffektiv, 'dezimal', gebiet),
      farbe: farben.betonung,
    },
    {
      name: 'Moegliche Auszahlung',
      wert: formatiere(rechnung.auszahlungMoeglich, w, gebiet),
      farbe: farben.gut,
    },
    {
      name: rechnung.imRisiko > 0 ? 'Noch im Risiko' : 'Ergebnis',
      wert:
        rechnung.imRisiko > 0
          ? formatiere(rechnung.imRisiko, w, gebiet)
          : formatiere(rechnung.ergebnisRealisiert, w, gebiet),
      farbe:
        rechnung.imRisiko > 0
          ? farben.offen
          : rechnung.ergebnisRealisiert >= 0
            ? farben.gut
            : farben.schlecht,
    },
  ]

  // Die Kennzahlen werden umgebrochen, sobald die Spalten zu schmal werden.
  // Ohne den Umbruch laufen "Gesamteinsatz" und "Scheine" ineinander und man
  // liest auf dem fertigen Blatt "GESAMTEINSATZSCHEINE".
  const innen = breite - rand * 2 - 32
  const proReihe = kennzahlenProReihe(breite)
  const spaltenBreite = innen / proReihe
  const reihenhoehe = 52
  const y = rand + 86

  for (let i = 0; i < felder.length; i++) {
    const feld = felder[i]
    if (!feld) continue
    const spalte = i % proReihe
    const reihe = Math.floor(i / proReihe)
    const x = rand + 16 + spalte * spaltenBreite
    const zeileY = y + reihe * reihenhoehe

    k.fillStyle = farben.schriftLeise
    k.font = `500 11px ${SCHRIFT.text}`
    k.fillText(kuerze(k, feld.name.toUpperCase(), spaltenBreite - 12), x, zeileY)

    k.fillStyle = feld.farbe
    // Bei schmalen Spalten wird die Zahl kleiner gesetzt, statt sie abzuschneiden.
    const zahlgroesse = spaltenBreite < 150 ? 16 : spaltenBreite < 190 ? 19 : 22
    k.font = `600 ${zahlgroesse}px ${SCHRIFT.zahl}`
    k.fillText(kuerze(k, feld.wert, spaltenBreite - 12), x, zeileY + 18)
  }

  // Die Anbieter darunter, damit man sofort sieht, wo gesetzt wurde.
  if (rechnung.proBuchmacher.length > 0) {
    const reihen = Math.ceil(felder.length / proReihe)
    const text = rechnung.proBuchmacher
      .map((b) => `${b.buchmacher} ${formatiere(b.einsatz, w, gebiet)} (${Math.round(b.anteil * 100)} %)`)
      .join('   |   ')
    k.fillStyle = farben.schriftLeise
    k.font = `400 13px ${SCHRIFT.text}`
    k.fillText(kuerze(k, text, innen), rand + 16, y + reihen * reihenhoehe - 4)
  }
}

/**
 * Zeichnet die Beschriftung unter einem Schein.
 *
 * @param {CanvasRenderingContext2D} k
 * @param {import('../kern/typen.js').Schein} schein
 * @param {number} nummer
 * @param {number} x
 * @param {number} y
 * @param {number} breite
 * @param {number} hoehe
 * @param {typeof STANDARDFARBEN} farben
 * @param {'de'|'en'} gebiet
 */
function zeichneBeschriftung(k, schein, nummer, x, y, breite, hoehe, farben, gebiet) {
  k.fillStyle = farben.flaeche
  k.fillRect(x, y, breite, hoehe)
  k.strokeStyle = farben.linie
  k.beginPath()
  k.moveTo(x, y + 0.5)
  k.lineTo(x + breite, y + 0.5)
  k.stroke()

  k.textBaseline = 'top'

  const anbieter = schein.buchmacher.wert ?? 'Anbieter unbekannt'
  const konto = schein.konto.wert ? ` / ${schein.konto.wert}` : ''
  k.fillStyle = farben.schrift
  k.font = `600 14px ${SCHRIFT.text}`
  k.fillText(kuerze(k, `${nummer}. ${anbieter}${konto}`, breite * 0.62), x + 10, y + 8)

  const nr = schein.scheinNr.wert ? `Nr. ${schein.scheinNr.wert}` : 'ohne Nummer'
  const zeit = (schein.gesetztAm.wert ?? '').replace('T', ' ')
  k.fillStyle = farben.schriftLeise
  k.font = `400 11px ${SCHRIFT.text}`
  k.fillText(kuerze(k, `${nr}   ${zeit}`, breite * 0.62), x + 10, y + 30)

  // Einsatz und Quote rechts, in fester Zeichenbreite.
  const w = schein.waehrung.wert ?? 'UNBEKANNT'
  k.textAlign = 'right'
  k.fillStyle = farben.schrift
  k.font = `600 16px ${SCHRIFT.zahl}`
  k.fillText(formatiere(schein.einsatz.wert, w, gebiet), x + breite - 10, y + 7)

  k.fillStyle = statusfarbe(schein.status, farben)
  k.font = `500 11px ${SCHRIFT.zahl}`
  const quote = formatiereQuote(schein.quoteDezimal.wert, 'dezimal', gebiet)
  k.fillText(`${quote}   ${statusText(schein.status)}`, x + breite - 10, y + 30)
  k.textAlign = 'left'
}

/**
 * @param {import('../kern/typen.js').Status} status
 * @param {typeof STANDARDFARBEN} farben
 * @returns {string}
 */
function statusfarbe(status, farben) {
  if (status === 'gewonnen' || status === 'halb_gewonnen') return farben.gut
  if (status === 'verloren' || status === 'halb_verloren') return farben.schlecht
  if (status === 'offen' || status === 'unbekannt') return farben.offen
  return farben.schriftLeise
}

/**
 * @param {import('../kern/typen.js').Status} status
 * @returns {string}
 */
export function statusText(status) {
  const namen = {
    offen: 'offen',
    gewonnen: 'gewonnen',
    verloren: 'verloren',
    halb_gewonnen: 'halb gewonnen',
    halb_verloren: 'halb verloren',
    push: 'unentschieden',
    storniert: 'storniert',
    cashout: 'vorzeitig ausgezahlt',
    unbekannt: 'unbekannt',
  }
  return namen[status] ?? status
}

/**
 * Kuerzt Text, der nicht in die Breite passt.
 *
 * @param {CanvasRenderingContext2D} k
 * @param {string} text
 * @param {number} breite
 * @returns {string}
 */
function kuerze(k, text, breite) {
  if (k.measureText(text).width <= breite) return text
  let gekuerzt = text
  while (gekuerzt.length > 4 && k.measureText(`${gekuerzt}...`).width > breite) {
    gekuerzt = gekuerzt.slice(0, -1)
  }
  return `${gekuerzt}...`
}

/**
 * Macht aus der Leinwand eine Datei.
 *
 * Bei sehr grossen Blaettern kann das einige Sekunden dauern und viel Speicher
 * brauchen. Deshalb wird bei Bedarf auf JPEG ausgewichen.
 *
 * @param {HTMLCanvasElement} leinwand
 * @param {{art?: 'png'|'jpeg', guete?: number}} [einstellungen]
 * @returns {Promise<Blob>}
 */
export function alsDatei(leinwand, einstellungen = {}) {
  const flaeche = leinwand.width * leinwand.height
  const art = einstellungen.art ?? (flaeche > 40e6 ? 'jpeg' : 'png')
  const guete = einstellungen.guete ?? 0.92

  return new Promise((erfuellen, ablehnen) => {
    leinwand.toBlob(
      (blob) => {
        if (blob) erfuellen(blob)
        else ablehnen(new Error('Das Bild konnte nicht erzeugt werden. Es ist vermutlich zu gross.'))
      },
      art === 'jpeg' ? 'image/jpeg' : 'image/png',
      art === 'jpeg' ? guete : undefined
    )
  })
}
