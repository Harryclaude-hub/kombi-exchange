// @ts-check
/**
 * Texterkennung.
 *
 * Laeuft vollstaendig im Browser des Nutzers. Es wird nichts hochgeladen und
 * nichts an einen Dienst geschickt. Alle Dateien, die dafuer noetig sind, liegen
 * im Ordner lib und gehoeren zum Programm.
 *
 * Gelesen wird in zwei Durchgaengen:
 *
 *   Durchgang 1  Die ganze Karte auf einmal. Ergebnis sind Zeilen und Woerter
 *                mit ihren Kaesten im Bild.
 *   Durchgang 2  Nur die Stellen, an denen Geld oder Quoten stehen, jede einzeln
 *                und mit einem Zeichenfilter. Wenn nur Ziffern erlaubt sind, kann
 *                aus einer 8 keine B mehr werden. Genau dort passieren sonst die
 *                Fehler, die am meisten kosten.
 *
 * Der zweite Durchgang ersetzt den ersten nur dann, wenn er sicherer ist UND
 * sich daraus eine Zahl lesen laesst. Verschlechtern kann er also nie.
 *
 * Reine Leselogik. Keine Anzeige.
 */

import { findeEtikettstellen } from '../kern/parser.js'

/** Wo die mitgelieferten Dateien liegen, immer als vollstaendige Adresse. */
function pfade() {
  // Die Pfade gehen vom MODUL aus, nicht von der Seite.
  //
  // Vorher stand hier document.baseURI. Das funktioniert, solange die Seite im
  // Wurzelverzeichnis liegt. Sobald eine Seite in einem Unterordner dieses
  // Modul benutzt, etwa werkzeug/training/, sucht sie die Texterkennung unter
  // werkzeug/training/lib/ und findet nichts.
  //
  // import.meta.url zeigt immer auf diese Datei, ganz gleich wer sie laedt.
  // Von lesen/ocr.js aus ist die Wurzel genau eine Ebene hoeher.
  const basis = new URL('../', import.meta.url)
  return {
    workerPath: new URL('lib/tesseract/worker.min.js', basis).href,
    // Muss ein Ordner sein, ohne Dateinamen und ohne Schraegstrich am Ende.
    corePath: new URL('lib/tesseract/core', basis).href,
    langPath: new URL('lib/tesseract/sprachen', basis).href,
  }
}

/**
 * Zeichenfilter je Feldart.
 *
 * Der Filter ist das schaerfste Werkzeug gegen Zahlendreher, darf aber nur dort
 * eingesetzt werden, wo wirklich nur diese Zeichen vorkommen koennen.
 */
const FELDARTEN = {
  geld: { zeichen: '0123456789.,', psm: '7' },
  quoteAmerikanisch: { zeichen: '+-0123456789', psm: '8' },
  quoteDezimal: { zeichen: '0123456789.,/', psm: '8' },
  nummer: { zeichen: '#0123456789', psm: '8' },
}

/** @typedef {keyof typeof FELDARTEN} Feldart */

/**
 * @typedef {object} Leseeinstellungen
 * @property {'eng'|'deu'|'eng+deu'} [sprachen]
 * @property {boolean} [gruendlich]  Zweiten Durchgang fahren. Vorgabe true.
 * @property {(stand: {schritt: string, anteil: number}) => void} [fortschritt]
 */

/**
 * @typedef {object} Kartenlesung
 * @property {string} text
 * @property {number} sicherheit            0 bis 1.
 * @property {import('../kern/typen.js').OcrZeile[]} zeilen
 * @property {string[]} zeilentexte         Die Zeilen als reiner Text, fuer den Parser.
 * @property {{feld: string, vorher: string, nachher: string, uebernommen: boolean}[]} nachlese
 */

let leserZaehler = 0

/**
 * Startet den Leser. Das dauert beim ersten Mal einige Sekunden, weil das
 * Sprachmodell geladen wird. Danach liegt es im Browserspeicher.
 *
 * @param {Leseeinstellungen} [einstellungen]
 * @returns {Promise<{leseKarte: (quelle: HTMLCanvasElement, art?: {gebiet?: 'de'|'en'}) => Promise<Kartenlesung>, beenden: () => Promise<void>, kennung: number}>}
 */
export async function starteLeser(einstellungen = {}) {
  const sprachen = einstellungen.sprachen ?? 'eng'
  const gruendlich = einstellungen.gruendlich !== false
  const melde = einstellungen.fortschritt ?? (() => {})

  const modul = await import('../lib/tesseract/tesseract.esm.min.js')
  const createWorker = modul.createWorker ?? modul.default?.createWorker
  if (typeof createWorker !== 'function') {
    throw new Error('Die Texterkennung konnte nicht geladen werden: createWorker fehlt.')
  }

  const kennung = ++leserZaehler

  const arbeiter = await createWorker(sprachen, 1 /* nur das neuronale Netz */, {
    ...pfade(),
    gzip: true,
    cacheMethod: 'write',
    workerBlobURL: true,
    logger: (m) => {
      if (m && typeof m.progress === 'number') {
        melde({ schritt: String(m.status ?? ''), anteil: m.progress })
      }
    },
    errorHandler: (e) => {
      // Nicht verschlucken. Ein stiller Fehler hier fuehrt zu leeren Ergebnissen,
      // die wie "nichts gefunden" aussehen.
      console.error('[Texterkennung]', e)
    },
  })

  /**
   * Liest einen Bildausschnitt mit Zeichenfilter.
   *
   * @param {HTMLCanvasElement} quelle
   * @param {import('../kern/typen.js').Rechteck} kasten
   * @param {Feldart} art
   * @returns {Promise<{text: string, sicherheit: number}>}
   */
  async function leseFeld(quelle, kasten, art) {
    const vorlage = FELDARTEN[art]
    const links = Math.max(0, Math.round(kasten.x))
    const oben = Math.max(0, Math.round(kasten.y))
    const breite = Math.min(quelle.width - links, Math.round(kasten.breite))
    const hoehe = Math.min(quelle.height - oben, Math.round(kasten.hoehe))
    if (breite < 4 || hoehe < 4) return { text: '', sicherheit: 0 }

    const { data } = await arbeiter.recognize(
      quelle,
      {
        rectangle: { left: links, top: oben, width: breite, height: hoehe },
        tessedit_pageseg_mode: vorlage.psm,
        tessedit_char_whitelist: vorlage.zeichen,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      },
      { text: true }
    )
    return {
      text: String(data?.text ?? '').trim(),
      sicherheit: Number(data?.confidence ?? 0) / 100,
    }
  }

  /**
   * Liest eine ganze Karte.
   *
   * @param {HTMLCanvasElement} quelle
   * @returns {Promise<Kartenlesung>}
   */
  async function leseKarte(quelle) {
    // ---- Durchgang 1: die ganze Karte. ----
    const { data } = await arbeiter.recognize(
      quelle,
      {
        tessedit_pageseg_mode: '6', // ein zusammenhaengender Block
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      },
      { text: true, blocks: true }
    )

    const zeilen = sammleZeilen(data)
    const zeilentexte = zeilen.map((z) => z.text)
    /** @type {{feld: string, vorher: string, nachher: string, uebernommen: boolean}[]} */
    const nachlese = []

    if (gruendlich && zeilen.length > 0) {
      for (const stelle of findeZahlenstellen(zeilen)) {
        try {
          const erneut = await leseFeld(quelle, stelle.kasten, stelle.art)
          const besser =
            erneut.text !== '' &&
            /\d/.test(erneut.text) &&
            erneut.sicherheit >= stelle.sicherheit - 0.02
          nachlese.push({
            feld: stelle.name,
            vorher: stelle.text,
            nachher: erneut.text,
            uebernommen: besser,
          })
          if (besser) ersetzeInZeile(zeilen, stelle, erneut.text)
        } catch (fehler) {
          // Ein fehlgeschlagener zweiter Durchgang darf das Ergebnis des ersten
          // nicht verwerfen. Er wird vermerkt und der erste Wert bleibt stehen.
          nachlese.push({
            feld: stelle.name,
            vorher: stelle.text,
            nachher: `Fehler: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
            uebernommen: false,
          })
        }
      }
    }

    const neueTexte = zeilen.map((z) => z.text)
    return {
      text: neueTexte.join('\n'),
      sicherheit: Number(data?.confidence ?? 0) / 100,
      zeilen,
      zeilentexte: neueTexte,
      nachlese,
    }
  }

  async function beenden() {
    try {
      await arbeiter.terminate()
    } catch {
      // Beim Beenden ist ein Fehler ohne Folgen, der Arbeiter verschwindet ohnehin.
    }
  }

  return { leseKarte, beenden, kennung }
}

/**
 * Holt die Zeilen samt Woertern aus dem Ergebnis.
 *
 * Ab Fassung 6 gibt es keine oberste Wortliste mehr. Man muss den Baum aus
 * Bloecken, Absaetzen, Zeilen und Woertern selbst durchlaufen.
 *
 * @param {any} data
 * @returns {import('../kern/typen.js').OcrZeile[]}
 */
export function sammleZeilen(data) {
  /** @type {import('../kern/typen.js').OcrZeile[]} */
  const zeilen = []
  const bloecke = data?.blocks
  if (!Array.isArray(bloecke)) {
    // Ohne Kaesten bleibt nur der reine Text. Dann gibt es keinen zweiten Durchgang,
    // aber lesen laesst sich der Schein trotzdem.
    const text = String(data?.text ?? '')
    for (const roh of text.split('\n')) {
      const zeile = roh.trim()
      if (zeile === '') continue
      zeilen.push({
        text: zeile,
        sicherheit: Number(data?.confidence ?? 0) / 100,
        kasten: { x: 0, y: 0, breite: 0, hoehe: 0 },
        woerter: [],
      })
    }
    return zeilen
  }

  for (const block of bloecke) {
    for (const absatz of block?.paragraphs ?? []) {
      for (const zeile of absatz?.lines ?? []) {
        const woerter = (zeile?.words ?? []).map((w) => ({
          text: String(w?.text ?? ''),
          sicherheit: Number(w?.confidence ?? 0) / 100,
          kasten: ausBbox(w?.bbox),
        }))
        const text = String(zeile?.text ?? '').replace(/\s+/g, ' ').trim()
        if (text === '') continue
        zeilen.push({
          text,
          sicherheit: Number(zeile?.confidence ?? 0) / 100,
          kasten: ausBbox(zeile?.bbox),
          woerter,
        })
      }
    }
  }
  return zeilen
}

/**
 * @param {any} bbox
 * @returns {import('../kern/typen.js').Rechteck}
 */
function ausBbox(bbox) {
  const x0 = Number(bbox?.x0 ?? 0)
  const y0 = Number(bbox?.y0 ?? 0)
  const x1 = Number(bbox?.x1 ?? 0)
  const y1 = Number(bbox?.y1 ?? 0)
  return { x: x0, y: y0, breite: Math.max(0, x1 - x0), hoehe: Math.max(0, y1 - y0) }
}

/**
 * @typedef {object} Zahlenstelle
 * @property {string} name
 * @property {Feldart} art
 * @property {import('../kern/typen.js').Rechteck} kasten
 * @property {number} zeileIndex
 * @property {number} vonWort
 * @property {number} bisWort
 * @property {string} text
 * @property {number} sicherheit
 */

/**
 * Sucht die Stellen, an denen eine Zahl steht, die es wert ist, noch einmal
 * genau gelesen zu werden.
 *
 * Gearbeitet wird auf der Ebene der Woerter, weil nur dort die Kaesten bekannt sind.
 *
 * @param {import('../kern/typen.js').OcrZeile[]} zeilen
 * @returns {Zahlenstelle[]}
 */
export function findeZahlenstellen(zeilen) {
  /** @type {Zahlenstelle[]} */
  const stellen = []

  for (let zi = 0; zi < zeilen.length; zi++) {
    const zeile = zeilen[zi]
    if (!zeile || zeile.woerter.length === 0) continue

    const etiketten = findeEtikettstellen(zeile.text)
    if (etiketten.length === 0) continue

    // Zeichenstellen der Etiketten auf Woerter abbilden.
    const wortStart = []
    let stelle = 0
    for (const wort of zeile.woerter) {
      wortStart.push(stelle)
      stelle += wort.text.length + 1
    }

    for (let ei = 0; ei < etiketten.length; ei++) {
      const etikett = etiketten[ei]
      if (!etikett) continue
      const naechstes = etiketten[ei + 1]

      // Erstes Wort nach dem Etikett.
      let von = zeile.woerter.length
      for (let wi = 0; wi < zeile.woerter.length; wi++) {
        if ((wortStart[wi] ?? 0) >= etikett.ende) {
          von = wi
          break
        }
      }
      // Letztes Wort vor dem naechsten Etikett.
      let bis = zeile.woerter.length
      if (naechstes) {
        for (let wi = von; wi < zeile.woerter.length; wi++) {
          if ((wortStart[wi] ?? 0) >= naechstes.start) {
            bis = wi
            break
          }
        }
      }
      if (bis <= von) continue

      const teil = zeile.woerter.slice(von, bis)
      const text = teil.map((w) => w.text).join(' ').trim()
      if (!/\d|[OolIiSsBbGgZz]/.test(text)) continue

      /** @type {Feldart} */
      let art = 'geld'
      if (etikett.art === 'quote') {
        art = /[+\-\u2212\u2013\u2014]/.test(text) ? 'quoteAmerikanisch' : 'quoteDezimal'
      }

      stellen.push({
        name: etikett.art,
        art,
        kasten: umschliessend(teil.map((w) => w.kasten)),
        zeileIndex: zi,
        vonWort: von,
        bisWort: bis,
        text,
        sicherheit: teil.reduce((s, w) => s + w.sicherheit, 0) / Math.max(1, teil.length),
      })
    }

    // Die Scheinnummer hinter dem Rautezeichen.
    const raute = zeile.woerter.findIndex((w) => /^#?\d{5,}$/.test(w.text.replace(/\s/g, '')))
    if (raute >= 0) {
      const wort = zeile.woerter[raute]
      if (wort) {
        stellen.push({
          name: 'scheinNr',
          art: 'nummer',
          kasten: wort.kasten,
          zeileIndex: zi,
          vonWort: raute,
          bisWort: raute + 1,
          text: wort.text,
          sicherheit: wort.sicherheit,
        })
      }
    }
  }

  return stellen
}

/**
 * Kleinstes Rechteck, das alle uebergebenen enthaelt, mit etwas Luft ringsum.
 *
 * @param {import('../kern/typen.js').Rechteck[]} kaesten
 * @returns {import('../kern/typen.js').Rechteck}
 */
function umschliessend(kaesten) {
  if (kaesten.length === 0) return { x: 0, y: 0, breite: 0, hoehe: 0 }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const k of kaesten) {
    x0 = Math.min(x0, k.x)
    y0 = Math.min(y0, k.y)
    x1 = Math.max(x1, k.x + k.breite)
    y1 = Math.max(y1, k.y + k.hoehe)
  }
  // Etwas Luft, damit keine Zeichenkante abgeschnitten wird.
  const luft = Math.max(2, Math.round((y1 - y0) * 0.25))
  return {
    x: Math.max(0, x0 - luft),
    y: Math.max(0, y0 - luft),
    breite: x1 - x0 + luft * 2,
    hoehe: y1 - y0 + luft * 2,
  }
}

/**
 * Setzt den nachgelesenen Text an die Stelle der urspruenglichen Woerter.
 *
 * @param {import('../kern/typen.js').OcrZeile[]} zeilen
 * @param {Zahlenstelle} stelle
 * @param {string} neuerText
 */
function ersetzeInZeile(zeilen, stelle, neuerText) {
  const zeile = zeilen[stelle.zeileIndex]
  if (!zeile) return
  const sauber = neuerText.replace(/\s+/g, ' ').trim()
  const vorher = zeile.woerter.slice(0, stelle.vonWort).map((w) => w.text)
  const nachher = zeile.woerter.slice(stelle.bisWort).map((w) => w.text)
  zeile.text = [...vorher, sauber, ...nachher].join(' ').replace(/\s+/g, ' ').trim()
}
