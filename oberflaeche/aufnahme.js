// @ts-check
/**
 * Aufnahme: vom Bildschirmfoto zum gelesenen Schein.
 *
 * Ablauf je Bild:
 *   1. Datei einlesen, Fingerabdruck bilden, gegen doppeltes Hochladen pruefen.
 *   2. Inhaltsspalte und Kartengrenzen suchen. Der Nutzer kann jede Grenze verschieben.
 *   3. Kopfbereich lesen, um Anbieter und Konto zu bestimmen.
 *   4. Jede Karte vorbereiten, lesen und in einen Schein uebersetzen.
 *   5. Alles neu gruppieren.
 *
 * Der Nutzer sieht jeden Zwischenschritt und kann eingreifen. Ein stiller
 * Fehlschnitt, der zwei Wetten zu einer macht, waere sonst nicht zu bemerken
 * und wuerde die Summen verderben.
 */

import { ladeBild, bereiteVor } from '../bild/vorverarbeitung.js'
import { zerlege, findeInhaltsspalte, findeSpalten } from '../bild/segmentierung.js'
// Es gibt bewusst keine automatische Fenstersuche. Warum, steht in bild/segmentierung.js.
import { starteLeser } from '../lesen/ocr.js'
import { leseSchein } from '../kern/parser.js'
import { erkenneBuchmacher, erkenneKonto, erkenneKontostand, BUCHMACHER_NACH_SCHLUESSEL } from '../kern/buchmacher.js'
import { pruefsumme, legeBildAb } from '../daten/ablage.js'
import { neueKennung, jetzt, atmen } from './werkzeug.js'
import * as Zustand from './zustand.js'

/** @type {Awaited<ReturnType<typeof starteLeser>>|null} */
let leser = null
/** @type {Promise<any>|null} */
let leserStartet = null

/**
 * Startet den Leser einmalig und gibt ihn danach immer wieder zurueck.
 *
 * @returns {Promise<Awaited<ReturnType<typeof starteLeser>>>}
 */
export async function holeLeser() {
  if (leser) return leser
  if (leserStartet) return leserStartet

  const einstellungen = Zustand.hole().einstellungen
  leserStartet = starteLeser({
    sprachen: einstellungen.sprachen,
    gruendlich: einstellungen.gruendlich,
    fortschritt: ({ schritt, anteil }) => {
      Zustand.arbeite(true, uebersetzeSchritt(schritt), anteil)
    },
  })
    .then((fertig) => {
      leser = fertig
      leserStartet = null
      return fertig
    })
    .catch((fehler) => {
      leserStartet = null
      throw fehler
    })

  return leserStartet
}

/** Beendet den Leser und gibt den Speicher frei. */
export async function beendeLeser() {
  if (leser) {
    await leser.beenden()
    leser = null
  }
}

/**
 * @param {string} schritt
 * @returns {string}
 */
function uebersetzeSchritt(schritt) {
  const woerter = {
    'loading tesseract core': 'Texterkennung wird geladen',
    'initializing tesseract': 'Texterkennung wird eingerichtet',
    'loading language traineddata': 'Sprachmodell wird geladen',
    'initializing api': 'Texterkennung wird gestartet',
    'recognizing text': 'Text wird gelesen',
  }
  return woerter[schritt] ?? (schritt ? `${schritt}` : 'Arbeitet')
}

/**
 * Nimmt Dateien entgegen und bereitet sie vor, ohne sie schon zu lesen.
 *
 * @param {FileList|File[]} dateien
 * @returns {Promise<{aufgenommen: number, uebersprungen: number}>}
 */
export async function nimmAuf(dateien) {
  const stand = Zustand.hole()
  const projektId = stand.projekt?.id ?? ''
  if (!projektId) {
    Zustand.melde('fehler', 'Es ist kein Projekt geoeffnet.')
    return { aufgenommen: 0, uebersprungen: 0 }
  }

  const liste = [...dateien].filter((d) => d.type.startsWith('image/'))
  if (liste.length === 0) {
    Zustand.melde('warnung', 'Darunter war kein Bild. Bitte Bildschirmfotos hochladen.')
    return { aufgenommen: 0, uebersprungen: 0 }
  }

  const bekannt = new Set([...stand.bilder.values()].map((b) => b.bild.pruefsumme))
  const bilder = new Map(stand.bilder)
  let aufgenommen = 0
  let uebersprungen = 0

  for (let i = 0; i < liste.length; i++) {
    const datei = liste[i]
    if (!datei) continue
    Zustand.arbeite(true, `Bild ${i + 1} von ${liste.length} wird vorbereitet`, (i + 1) / liste.length)
    await atmen()

    try {
      const abdruck = await pruefsumme(datei)
      if (bekannt.has(abdruck)) {
        uebersprungen++
        Zustand.melde('warnung', `"${datei.name}" wurde schon einmal hochgeladen und wird uebersprungen.`)
        continue
      }
      bekannt.add(abdruck)

      const element = await ladeBild(datei)
      const id = neueKennung()

      // Inhaltsspalte suchen, damit die Umgebung der Seite wegfaellt.
      const spalte = findeInhaltsspalte(element)
      const spalten = findeSpalten(element, {
        x: spalte.x,
        y: 0,
        breite: spalte.breite,
        hoehe: element.naturalHeight,
      })

      /** @type {import('../kern/typen.js').Rechteck[]} */
      let karten = []
      /** @type {string[]} */
      const hinweise = []

      for (const bereich of spalten) {
        const ergebnis = zerlege(element, {
          bereich: {
            x: bereich.von,
            y: 0,
            breite: bereich.bis - bereich.von,
            hoehe: element.naturalHeight,
          },
        })
        karten.push(...ergebnis.karten)
        hinweise.push(...ergebnis.hinweise)
      }

      if (spalten.length > 1) {
        hinweise.push(
          `Die Karten liegen in ${spalten.length} Spalten nebeneinander. Sie wurden spaltenweise getrennt.`
        )
      }
      karten = karten.sort((a, b) => a.x - b.x || a.y - b.y)

      await legeBildAb({
        id,
        projektId,
        dateiname: datei.name,
        pruefsumme: abdruck,
        breite: element.naturalWidth,
        hoehe: element.naturalHeight,
        inhalt: datei,
      })

      bilder.set(id, {
        bild: {
          id,
          projektId,
          dateiname: datei.name,
          breite: element.naturalWidth,
          hoehe: element.naturalHeight,
          quelle: '',
          pruefsumme: abdruck,
          buchmacher: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
          konto: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
          angelegtAm: jetzt(),
        },
        element,
        inhalt: datei,
        karten,
        hinweise,
      })
      aufgenommen++
    } catch (fehler) {
      Zustand.melde(
        'fehler',
        `"${datei.name}" liess sich nicht vorbereiten: ${fehler instanceof Error ? fehler.message : String(fehler)}`
      )
    }
  }

  Zustand.aendere({ bilder })
  Zustand.arbeite(false)
  return { aufgenommen, uebersprungen }
}

/**
 * Liest den Kopfbereich eines Bildes, um Anbieter und Konto zu bestimmen.
 *
 * @param {HTMLImageElement} element
 * @param {Awaited<ReturnType<typeof starteLeser>>} derLeser
 * @param {string} [eigenesKontomuster]
 * @returns {Promise<{buchmacher: import('../kern/buchmacher.js').Buchmacherfund, konto: {wert: string|null, sicherheit: number, quelleMuster: string}, kontostand: string|null, kopftext: string}>}
 */
export async function erkenneKopf(element, derLeser, eigenesKontomuster = '') {
  const kopfhoehe = Math.max(60, Math.round(element.naturalHeight * 0.16))
  const { leinwand } = bereiteVor(element, {
    x: 0,
    y: 0,
    breite: element.naturalWidth,
    hoehe: kopfhoehe,
  })

  const lesung = await derLeser.leseKarte(leinwand)
  const kopftext = lesung.text

  return {
    buchmacher: erkenneBuchmacher(kopftext, kopftext),
    konto: erkenneKonto(kopftext, eigenesKontomuster),
    kontostand: erkenneKontostand(kopftext),
    kopftext,
  }
}

/**
 * Liest alle Karten der angegebenen Bilder.
 *
 * @param {string[]} bildIds
 * @param {{eigenesKontomuster?: string}} [einstellungen]
 * @returns {Promise<{gelesen: number, fehler: number}>}
 */
export async function leseBilder(bildIds, einstellungen = {}) {
  const stand = Zustand.hole()
  const projektId = stand.projekt?.id ?? ''
  if (!projektId) {
    Zustand.melde('fehler', 'Es ist kein Projekt geoeffnet.')
    return { gelesen: 0, fehler: 0 }
  }

  let derLeser
  try {
    Zustand.arbeite(true, 'Texterkennung wird vorbereitet', 0)
    derLeser = await holeLeser()
  } catch (fehler) {
    Zustand.arbeite(false)
    Zustand.melde(
      'fehler',
      `Die Texterkennung liess sich nicht starten: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
    return { gelesen: 0, fehler: bildIds.length }
  }

  const bilder = new Map(stand.bilder)
  /** @type {import('../kern/typen.js').Schein[]} */
  const neueScheine = []
  let fehlerzahl = 0

  const heute = new Date()
  const gesamtKarten = bildIds.reduce((n, id) => n + (bilder.get(id)?.karten.length ?? 0), 0)
  let fertigeKarten = 0

  for (const bildId of bildIds) {
    const eintrag = bilder.get(bildId)
    if (!eintrag || !eintrag.element) continue

    try {
      // Kopfbereich fuer Anbieter und Konto.
      Zustand.arbeite(true, `Anbieter wird erkannt (${eintrag.bild.dateiname})`, fertigeKarten / Math.max(1, gesamtKarten))
      await atmen()
      const kopf = await erkenneKopf(eintrag.element, derLeser, einstellungen.eigenesKontomuster ?? '')

      const profil = kopf.buchmacher.profil
      const kontoWert = kopf.konto.wert ?? kopf.kontostand ?? null

      eintrag.bild.buchmacher = {
        wert: profil?.name ?? null,
        sicherheit: kopf.buchmacher.sicherheit,
        quelle: 'ocr',
        roh: kopf.buchmacher.merkmale.join(', '),
      }
      eintrag.bild.konto = {
        wert: kontoWert,
        sicherheit: kopf.konto.sicherheit,
        quelle: 'ocr',
        roh: kopf.konto.quelleMuster,
      }

      if (!profil) {
        Zustand.melde(
          'warnung',
          `Bei "${eintrag.bild.dateiname}" liess sich der Anbieter nicht erkennen. Bitte von Hand eintragen.`
        )
      }

      // Jede Karte einzeln lesen.
      for (let k = 0; k < eintrag.karten.length; k++) {
        const ausschnitt = eintrag.karten[k]
        if (!ausschnitt) continue

        fertigeKarten++
        Zustand.arbeite(
          true,
          `Schein ${fertigeKarten} von ${gesamtKarten} wird gelesen`,
          fertigeKarten / Math.max(1, gesamtKarten)
        )
        await atmen()

        const { leinwand } = bereiteVor(eintrag.element, ausschnitt)
        const lesung = await derLeser.leseKarte(leinwand)

        if (lesung.zeilentexte.length === 0) {
          Zustand.melde(
            'warnung',
            `Im Ausschnitt ${k + 1} von "${eintrag.bild.dateiname}" war kein Text zu lesen.`
          )
          continue
        }

        const schein = leseSchein(lesung.zeilentexte, {
          id: neueKennung(),
          projektId,
          bildId,
          ausschnitt,
          positionImBild: k,
          buchmacher: profil?.name ?? null,
          buchmacherSicherheit: kopf.buchmacher.sicherheit,
          konto: kontoWert,
          kontoSicherheit: kopf.konto.sicherheit,
          gebiet: profil?.gebiet ?? 'en',
          waehrung: profil?.waehrung ?? 'UNBEKANNT',
          quotenformat: profil?.quotenformat ?? 'dezimal',
          bezugsjahr: heute.getFullYear(),
          bezugsmonat: heute.getMonth() + 1,
          zeitstempel: jetzt(),
          ocrSicherheit: lesung.sicherheit,
        })

        // Was der zweite Durchgang geaendert hat, wird vermerkt. So bleibt
        // nachvollziehbar, warum eine Zahl anders aussieht als im Bild.
        for (const eintragNachlese of lesung.nachlese) {
          if (eintragNachlese.uebernommen && eintragNachlese.vorher !== eintragNachlese.nachher) {
            schein.hinweise.push({
              code: 'nachgelesen',
              schwere: 'info',
              feld: eintragNachlese.feld,
              text:
                `Beim genauen Nachlesen wurde "${eintragNachlese.vorher}" zu ` +
                `"${eintragNachlese.nachher}" berichtigt.`,
            })
          }
        }

        neueScheine.push(schein)
      }
    } catch (fehler) {
      fehlerzahl++
      Zustand.melde(
        'fehler',
        `"${eintrag.bild.dateiname}" konnte nicht gelesen werden: ${fehler instanceof Error ? fehler.message : String(fehler)}`
      )
    }
  }

  Zustand.aendere({ bilder })
  Zustand.arbeite(false)

  if (neueScheine.length > 0) {
    Zustand.fuegeScheineHinzu(neueScheine)
    const mitFehler = neueScheine.filter((s) => s.hinweise.some((h) => h.schwere === 'fehler')).length
    if (mitFehler > 0) {
      Zustand.melde(
        'warnung',
        `${neueScheine.length} Schein(e) gelesen, davon ${mitFehler} mit einem Fehler. Bitte unter "Scheine" durchsehen.`
      )
    } else {
      Zustand.melde('erfolg', `${neueScheine.length} Schein(e) gelesen.`)
    }
  } else if (fehlerzahl === 0) {
    Zustand.melde('warnung', 'Es liess sich kein einziger Schein lesen.')
  }

  return { gelesen: neueScheine.length, fehler: fehlerzahl }
}

/**
 * Setzt die Kartengrenzen eines Bildes neu, nachdem der Nutzer sie verschoben hat.
 *
 * @param {string} bildId
 * @param {import('../kern/typen.js').Rechteck[]} karten
 */
export function setzeKarten(bildId, karten) {
  const stand = Zustand.hole()
  const bilder = new Map(stand.bilder)
  const eintrag = bilder.get(bildId)
  if (!eintrag) return
  bilder.set(bildId, { ...eintrag, karten })
  Zustand.aendere({ bilder })
}

/**
 * Setzt den Bereich, in dem gesucht werden soll, und zerlegt ihn neu.
 *
 * Dafuer gibt es diesen Weg statt einer automatischen Fenstersuche: auf einem
 * ganzen Browserfenster gibt es mehrere gleichmaessige Listen, die Menueleiste,
 * die Marktliste, die Quotenkaesten. Jede automatische Regel hat irgendwann die
 * falsche gewaehlt, und zwar ohne es zu merken. Ein Rahmen von Hand dauert drei
 * Sekunden und ist immer richtig.
 *
 * @param {string} bildId
 * @param {import('../kern/typen.js').Rechteck|null} bereich  null hebt den Rahmen auf.
 */
export function setzeBereich(bildId, bereich) {
  const stand = Zustand.hole()
  const bilder = new Map(stand.bilder)
  const eintrag = bilder.get(bildId)
  if (!eintrag || !eintrag.element) return

  const voll = {
    x: 0,
    y: 0,
    breite: eintrag.element.naturalWidth,
    hoehe: eintrag.element.naturalHeight,
  }

  let gewaehlt = voll
  if (bereich) {
    const x = Math.max(0, Math.min(voll.breite - 10, Math.round(bereich.x)))
    const y = Math.max(0, Math.min(voll.hoehe - 10, Math.round(bereich.y)))
    gewaehlt = {
      x,
      y,
      breite: Math.max(20, Math.min(voll.breite - x, Math.round(bereich.breite))),
      hoehe: Math.max(20, Math.min(voll.hoehe - y, Math.round(bereich.hoehe))),
    }
  }

  /** @type {string[]} */
  const hinweise = []
  /** @type {import('../kern/typen.js').Rechteck[]} */
  let karten = []

  try {
    const spalten = findeSpalten(eintrag.element, gewaehlt)
    for (const spalte of spalten) {
      const ergebnis = zerlege(eintrag.element, {
        bereich: { x: spalte.von, y: gewaehlt.y, breite: spalte.bis - spalte.von, hoehe: gewaehlt.hoehe },
      })
      karten.push(...ergebnis.karten)
      hinweise.push(...ergebnis.hinweise)
    }
    if (spalten.length > 1) {
      hinweise.push(`Die Karten liegen in ${spalten.length} Spalten nebeneinander.`)
    }
    karten = karten.sort((a, b) => a.x - b.x || a.y - b.y)
  } catch (fehler) {
    hinweise.push(
      `Der Bereich liess sich nicht zerlegen: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
  }

  if (karten.length === 0) karten = [gewaehlt]

  bilder.set(bildId, {
    ...eintrag,
    karten,
    hinweise,
    bereich: bereich ? gewaehlt : null,
  })
  Zustand.aendere({ bilder })

  if (bereich) {
    Zustand.melde(
      'info',
      karten.length === 1
        ? 'Im Rahmen wurde ein Schein erkannt.'
        : `Im Rahmen wurden ${karten.length} Scheine erkannt.`
    )
  }
}

/**
 * Setzt den Anbieter eines Bildes von Hand.
 *
 * @param {string} bildId
 * @param {string} schluessel  Schluessel aus der Anbieterliste, oder leer.
 */
export function setzeBuchmacher(bildId, schluessel) {
  const stand = Zustand.hole()
  const bilder = new Map(stand.bilder)
  const eintrag = bilder.get(bildId)
  if (!eintrag) return
  const profil = BUCHMACHER_NACH_SCHLUESSEL.get(schluessel)
  eintrag.bild.buchmacher = {
    wert: profil?.name ?? null,
    sicherheit: profil ? 1 : 0,
    quelle: 'hand',
  }
  bilder.set(bildId, { ...eintrag })
  Zustand.aendere({ bilder })
}
