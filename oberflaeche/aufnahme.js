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
import { starteLeserGruppe } from '../lesen/ocr.js'
import { leseSchein } from '../kern/parser.js'
import {
  erkenneBuchmacher,
  erkenneKonto,
  erkenneKontostand,
  BUCHMACHER_NACH_SCHLUESSEL,
  schluesselFuerName,
} from '../kern/buchmacher.js'
import { pruefsumme, legeBildAb, loescheBild, aktualisiereBildAngaben } from '../daten/ablage.js'
// Der Ordner auf der Platte, in den jedes Foto sofort mitgeschrieben wird.
// Siehe daten/plattenspeicher.js.
import * as Platte from '../daten/plattenspeicher.js'
import { neueKennung, jetzt, atmen } from './werkzeug.js'
import * as Bildspeicher from './bildspeicher.js'
import * as Zustand from './zustand.js'

/** @type {Awaited<ReturnType<typeof starteLeserGruppe>>|null} */
let leser = null
/** @type {Promise<any>|null} */
let leserStartet = null
/** Mit welchen Einstellungen der laufende Leser gestartet wurde. */
/** @type {{sprachen: string, gruendlich: boolean}|null} */
let leserEinstellungen = null

/**
 * Startet den Leser einmalig und gibt ihn danach immer wieder zurueck.
 *
 * C3 der Fehlersuche vom 17.09.2026: die Einstellungen wurden nur beim
 * ALLERERSTEN Start gelesen, und beendeLeser rief niemand. Wer den Haken
 * "Geldfelder einzeln nachlesen" umstellte, las trotzdem bis zum Schliessen
 * des Fensters mit der alten Einstellung. Jetzt wird verglichen: haben sich
 * Gruendlichkeit oder Sprachen geaendert, wird der Leser beendet und mit den
 * neuen Einstellungen frisch gestartet.
 *
 * @returns {Promise<Awaited<ReturnType<typeof starteLeserGruppe>>>}
 */
export async function holeLeser() {
  const jetzige = Zustand.hole().einstellungen
  if (
    leser &&
    leserEinstellungen &&
    (leserEinstellungen.gruendlich !== jetzige.gruendlich ||
      leserEinstellungen.sprachen !== jetzige.sprachen)
  ) {
    await beendeLeser()
  }
  if (leser) return leser
  if (leserStartet) return leserStartet

  const einstellungen = jetzige
  leserEinstellungen = { sprachen: einstellungen.sprachen, gruendlich: einstellungen.gruendlich }
  // Eine GRUPPE von Lesern, nicht einer. Am Lesen selbst aendert das nichts,
  // es laufen nur mehrere Karten gleichzeitig. Gemessen: 3,74 mal schneller,
  // hundert Scheine in 2,6 statt 9,6 Minuten. Siehe lesen/ocr.js.
  leserStartet = starteLeserGruppe({
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
 * @returns {Promise<{aufgenommen: number, uebersprungen: number, neueIds: string[]}>}
 */
export async function nimmAuf(dateien) {
  const stand = Zustand.hole()
  const projektId = stand.projekt?.id ?? ''
  if (!projektId) {
    Zustand.melde('fehler', 'Es ist kein Projekt geöffnet.')
    return { aufgenommen: 0, uebersprungen: 0, neueIds: [] }
  }

  const liste = [...dateien].filter((d) => d.type.startsWith('image/'))
  if (liste.length === 0) {
    Zustand.melde('warnung', 'Darunter war kein Bild. Bitte Bildschirmfotos hochladen.')
    return { aufgenommen: 0, uebersprungen: 0, neueIds: [] }
  }

  const bekannt = new Set([...stand.bilder.values()].map((b) => b.bild.pruefsumme))
  const bilder = new Map(stand.bilder)
  let aufgenommen = 0
  let uebersprungen = 0
  /** @type {string[]} */
  const neueIds = []

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

      /*
        DIE REIHENFOLGE IST DER GANZE PUNKT.

        Bis zum 17.09.2026 abends stand legeBildAb HIER OBEN und das Schreiben
        auf die Platte darunter. Lief die Browserdatenbank voll, warf
        legeBildAb, der Ablauf sprang in den catch am Ende der Schleife, und
        Platte.sichere wurde NIE erreicht. Das Foto war dann nirgends, obwohl
        auf der Platte noch hunderte Gigabyte frei waren.

        Also zuerst die Platte: sie ist die Kopie, die einen geloeschten
        Browser ueberlebt, sie hat kein Limit ausser der Platte selbst, und
        sichere() wirft nie. Danach der Browser, in einem EIGENEN Versuch, denn
        ein voller Browser darf ein Foto nicht mehr aus der Hand geben, das
        drei Zeilen vorher sicher abgelegt wurde.
      */
      const gesichert = await Platte.sichere({ id, dateiname: datei.name, inhalt: datei })

      let imBrowser = true
      try {
        await legeBildAb({
          id,
          projektId,
          dateiname: datei.name,
          pruefsumme: abdruck,
          breite: element.naturalWidth,
          hoehe: element.naturalHeight,
          inhalt: datei,
          // B5: die Zerlegung und alles spaeter von Hand Eingestellte gehen
          // mit in die Ablage, sonst steht nach einem Neuladen "0 Scheine
          // erkannt" und die Handarbeit an den Grenzen ist weg.
          karten,
          hinweise,
          bereich: null,
          buchmacher: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
          konto: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
        })
      } catch (fehler) {
        imBrowser = false
        const grund = fehler instanceof Error ? fehler.message : String(fehler)
        Zustand.melde(
          'fehler',
          gesichert.geschrieben
            ? `"${datei.name}" konnte nicht in den Browser gelegt werden: ${grund} ` +
                'Das Bild liegt aber in deinem Ordner auf der Platte, es ist nicht verloren. ' +
                'Der Schein wird trotzdem gelesen; nur das Foto ist nach dem Neuladen weg.'
            : `"${datei.name}" konnte NIRGENDS abgelegt werden: ${grund} ` +
                'Wähle einen Ordner auf der Platte, dann liegt jedes Foto zusätzlich dort.'
        )
      }

      if (!gesichert.geschrieben && gesichert.grund && gesichert.grund !== 'kein Ordner gewählt') {
        Zustand.melde(
          'warnung',
          `"${datei.name}" liegt im Browser, konnte aber nicht in deinen Ordner geschrieben werden: ${gesichert.grund}`
        )
      }

      // Nirgends gelandet: dann gibt es auch nichts anzuzeigen. Der Schein
      // waere ohne Bild, und beim naechsten Hochladen kaeme er doppelt.
      if (!imBrowser && !gesichert.geschrieben) continue

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
      neueIds.push(id)
    } catch (fehler) {
      Zustand.melde(
        'fehler',
        `"${datei.name}" ließ sich nicht vorbereiten: ${fehler instanceof Error ? fehler.message : String(fehler)}`
      )
    }
  }

  Zustand.aendere({ bilder })
  Zustand.arbeite(false)
  return { aufgenommen, uebersprungen, neueIds }
}

/**
 * Nimmt Dateien auf und liest sie SOFORT, wenn der Reiter Aufnahme nicht
 * offen ist.
 *
 * C2 der Fehlersuche vom 17.09.2026: "Foto hinzufuegen" ausserhalb des
 * Reiters Aufnahme tat sichtbar nichts. nimmAuf bereitet nur vor, und
 * leseBilder wurde im ganzen Programm nur vom Knopf "Jetzt lesen" im Reiter
 * Aufnahme gerufen. Wer den Knopf am Riesenschein drueckte, lud hoch und sah
 * nichts: kein Schein, keine Meldung, kein Wechsel. Dabei verspricht genau
 * diese Stelle, dass der gelesene Schein unten in der Liste auftaucht.
 *
 * Im Reiter Aufnahme bleibt es beim alten Ablauf: dort richtet der Mensch
 * erst Rahmen und Anbieter ein und drueckt dann selbst auf "Jetzt lesen".
 *
 * @param {FileList|File[]} dateien
 * @returns {Promise<{aufgenommen: number, uebersprungen: number, neueIds: string[]}>}
 */
export async function nimmAufUndLiesSofort(dateien) {
  const ergebnis = await nimmAuf(dateien)
  if (ergebnis.neueIds.length === 0) return ergebnis
  if (Zustand.hole().ansicht === 'aufnahme') return ergebnis
  await leseBilder(ergebnis.neueIds)
  return ergebnis
}

/**
 * Liest den Kopfbereich eines Bildes, um Anbieter und Konto zu bestimmen.
 *
 * @param {HTMLImageElement} element
 * @param {Awaited<ReturnType<typeof starteLeserGruppe>>} derLeser
 * @param {string} [eigenesKontomuster]
 * @returns {Promise<{buchmacher: import('../kern/buchmacher.js').Buchmacherfund, konto: {wert: string|null, sicherheit: number, quelleMuster: string}, kontostand: string|null, kopftext: string}>}
 */
export async function erkenneKopf(element, derLeser, eigenesKontomuster = '') {
  const kopfhoehe = Math.max(60, Math.round(element.naturalHeight * 0.16))
  const bereich = { x: 0, y: 0, breite: element.naturalWidth, hoehe: kopfhoehe }

  const lesung = await derLeser.leseKarte(bereiteVor(element, bereich).leinwand)
  let kopftext = lesung.text
  let fund = erkenneBuchmacher(kopftext, kopftext)

  // Zweiter Blick mit vergroessertem Kopf, wenn der erste nichts gefunden hat.
  //
  // WARUM: waehleFaktor richtet sich nach der BREITE (Ziel 1800). Der
  // Kopfstreifen ist aber immer so breit wie das ganze Bild. Bei einem
  // Browser-Vollbild mit 2560 Bildpunkten kommt daraus Faktor 1, der Kopf wird
  // also gar nicht vergroessert, und die Anbieterzeile steht dort in 13 bis 16
  // Bildpunkten. Genau die Groesse, die vorverarbeitung.js im eigenen
  // Kommentar als zu klein bezeichnet. Bei einem Handybild mit dreifacher
  // Pixeldichte ist die Schrift dagegen schon gross genug. Die Regel ist also
  // je nach Bild richtig oder verkehrt herum.
  //
  // Statt eine feste Zahl zu raten, wird gemessen: der erste Versuch laeuft
  // wie bisher, und nur wenn KEIN Anbieter herauskam, kostet der zweite etwas.
  // Das ist genau der Fall, in dem heute alles Weitere verlorengeht, denn am
  // Anbieterprofil haengen Gebiet, Waehrung und Quotenformat.
  if (!fund.profil) {
    const flaeche = bereich.breite * bereich.hoehe
    // Dieselbe Obergrenze wie in waehleFaktor. Ein flacher Streifen bleibt
    // auch bei Faktor 3 weit darunter, ein sehr hoher Kopf nicht.
    const faktor = Math.min(3, Math.max(1, Math.sqrt(40e6 / Math.max(1, flaeche))))
    if (faktor > 1.1) {
      const zweite = await derLeser.leseKarte(bereiteVor(element, bereich, { faktor }).leinwand)
      const zweiterFund = erkenneBuchmacher(zweite.text, zweite.text)
      // Uebernommen wird nur, was WIRKLICH besser ist. Ein zweiter Durchgang,
      // der auch nichts findet, darf den ersten Text nicht verdraengen.
      if (zweiterFund.profil || zweiterFund.sicherheit > fund.sicherheit) {
        kopftext = zweite.text
        fund = zweiterFund
      }
    }
  }

  return {
    buchmacher: fund,
    konto: erkenneKonto(kopftext, eigenesKontomuster),
    kontostand: erkenneKontostand(kopftext),
    kopftext,
  }
}

/**
 * Liest alle Karten EINES Bildes gleichzeitig.
 *
 * Die Leser-Gruppe verteilt sie auf mehrere Arbeiter (lesen/ocr.js). Am Lesen
 * selbst aendert das nichts, es ist derselbe Weg je Karte, es laufen nur
 * mehrere gleichzeitig. Bei Karams Bildern liegen vier Scheine auf einem Bild.
 *
 * Promise.all behaelt die Reihenfolge bei, die Zuordnung Karte zu Lesung
 * bleibt also stimmig. Ein Fehler bei einer Karte darf die anderen nicht
 * mitreissen, deshalb faengt jede ihren eigenen ab und liefert null.
 *
 * @param {any} eintrag
 * @param {Awaited<ReturnType<typeof starteLeserGruppe>>} derLeser
 */
function leseKartenGleichzeitig(eintrag, derLeser) {
  return Promise.all(
    eintrag.karten.map(async (/** @type {any} */ ausschnitt) => {
      if (!ausschnitt) return null
      try {
        const { leinwand } = bereiteVor(eintrag.element, ausschnitt)
        return await derLeser.leseKarte(leinwand)
      } catch (fehler) {
        Zustand.melde(
          'warnung',
          `Eine Karte aus "${eintrag.bild.dateiname}" ließ sich nicht lesen: ` +
            `${fehler instanceof Error ? fehler.message : String(fehler)}`
        )
        return null
      }
    })
  )
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
    Zustand.melde('fehler', 'Es ist kein Projekt geöffnet.')
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
      `Die Texterkennung ließ sich nicht starten: ${fehler instanceof Error ? fehler.message : String(fehler)}`
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
    if (!eintrag) continue

    /*
      DAS BILD NACHHOLEN, NICHT UEBERSPRINGEN.

      Seit dem 17.09.2026 liegt nach einem Neuladen kein entpacktes Bild mehr
      am Eintrag (oberflaeche/bildspeicher.js). Hier stand vorher ein
      `continue`, und damit haette das Lesen nach jedem Neuladen still
      uebersprungen, was es lesen sollte: keine Scheine, keine Meldung.
    */
    const element = eintrag.element ?? (await Bildspeicher.hole(eintrag))
    if (!element) {
      fehlerzahl += 1
      Zustand.melde('warnung', `"${eintrag.bild.dateiname}" ließ sich nicht öffnen und wurde übersprungen.`)
      continue
    }
    if (!eintrag.element) {
      bilder.set(bildId, { ...eintrag, element })
      eintrag.element = element
    }

    try {
      // Kopfbereich UND alle Karten gleichzeitig.
      //
      // Der Kopf sagt, welcher Anbieter es ist, und daraus kommen Gebiet,
      // Waehrung und Quotenformat. Gebraucht wird das aber erst NACH der
      // Texterkennung, beim Deuten der Zeilen. Die Texterkennung selbst
      // braucht den Anbieter nicht. Also muss sie auch nicht auf ihn warten.
      //
      // Vorher lag der Kopf allein auf einem Arbeiter und die anderen drei
      // standen still. Gemessen: 16 Karten in 39,6 Sekunden.
      Zustand.arbeite(
        true,
        `"${eintrag.bild.dateiname}": Anbieter und ${eintrag.karten.length} Schein(e)`,
        fertigeKarten / Math.max(1, gesamtKarten)
      )
      await atmen()

      const [kopf, lesungen] = await Promise.all([
        erkenneKopf(eintrag.element, derLeser, einstellungen.eigenesKontomuster ?? ''),
        leseKartenGleichzeitig(eintrag, derLeser),
      ])

      // Der Fortschritt springt jetzt je Bild, nicht je Karte. Die Karten
      // laufen gleichzeitig, es gibt also keine Reihenfolge mehr, in der man
      // sie einzeln zaehlen koennte, ohne dass die Anzeige hin und her springt.
      fertigeKarten += eintrag.karten.length
      Zustand.arbeite(
        true,
        `${fertigeKarten} von ${gesamtKarten} Schein(en) gelesen`,
        fertigeKarten / Math.max(1, gesamtKarten)
      )

      /*
        WAS DER MENSCH EINGETRAGEN HAT, BLEIBT STEHEN.

        Karam am 16.09.2026: "diese Anbieter brauche ich alle einfach
        memorisiert. BetOnline muss einfach gemerkt werden."

        HIER LAG DER FEHLER. Es gibt seit jeher ein Auswahlfeld je Bild
        (anbieterwahl in ansicht_aufnahme.js), und setzeBuchmacher schreibt die
        Wahl mit quelle 'hand' ins Bild. Diese Zeilen haben sie danach
        BEDINGUNGSLOS ueberschrieben, sobald gelesen wurde. Wer den Anbieter
        von Hand einstellte und dann auf Lesen drueckte, verlor seine Eingabe.

        Und das ist nicht nur eine Beschriftung. Aus dem Profil kommen weiter
        unten gebiet, waehrung UND quotenformat fuer jeden Schein dieses
        Bildes. Bei BetOnline sind die Quoten AMERIKANISCH (-157). Wird der
        Anbieter nicht erkannt, faellt quotenformat auf 'dezimal' zurueck, und
        dann wird aus -157 etwas ganz anderes als 1,64.

        Fuer den Anbieter gibt es am Bild keinen Pruefstein. Also entscheidet
        der Mensch, und seine Entscheidung schlaegt die Erkennung
        (Projektregel 1). Nur wenn er nichts gesagt hat, zaehlt, was gelesen
        wurde.
      */
      const vonHandGesetzt =
        eintrag.bild.buchmacher.quelle === 'hand' && eintrag.bild.buchmacher.wert !== null

      const profil = vonHandGesetzt
        ? BUCHMACHER_NACH_SCHLUESSEL.get(schluesselFuerName(eintrag.bild.buchmacher.wert)) ??
          kopf.buchmacher.profil
        : kopf.buchmacher.profil

      const kontoWert = kopf.konto.wert ?? kopf.kontostand ?? null

      if (!vonHandGesetzt) {
        eintrag.bild.buchmacher = {
          wert: profil?.name ?? null,
          sicherheit: kopf.buchmacher.sicherheit,
          quelle: 'ocr',
          roh: kopf.buchmacher.merkmale.join(', '),
        }
      }
      eintrag.bild.konto = {
        wert: kontoWert,
        sicherheit: kopf.konto.sicherheit,
        quelle: 'ocr',
        roh: kopf.konto.quelleMuster,
      }
      // Was der Kopf ergeben hat, gehoert mit ins abgelegte Bild (B5), sonst
      // steht der Anbieter nach einem Neuladen wieder auf "nicht erkannt".
      trageBildAngabenNach(bildId, {
        buchmacher: eintrag.bild.buchmacher,
        konto: eintrag.bild.konto,
      })

      if (!profil) {
        Zustand.melde(
          'warnung',
          `Bei "${eintrag.bild.dateiname}" ließ sich der Anbieter nicht erkennen. ` +
            'Bitte oben am Bild von Hand eintragen und noch einmal lesen lassen. ' +
            'Der Anbieter bestimmt Währung und Quotenformat, bei BetOnline zum Beispiel ' +
            'amerikanische Quoten.'
        )
      }

      for (let k = 0; k < eintrag.karten.length; k++) {
        const ausschnitt = eintrag.karten[k]
        if (!ausschnitt) continue

        const lesung = lesungen[k]
        if (!lesung) continue

        if (lesung.zeilentexte.length === 0) {
          Zustand.melde(
            'warnung',
            `Im Ausschnitt ${k + 1} von "${eintrag.bild.dateiname}" war kein Text zu lesen.`
          )
          continue
        }

        // Die Bedingungen, unter denen gelesen wird. Sie stehen hier als
        // eigener Wert, weil sie danach AM SCHEIN vermerkt werden.
        //
        // WARUM AM SCHEIN: aus diesen Zeilen wird in werkzeug/training/ ein
        // dauerhafter Pruefall. Wer ihn spaeter ohne dieselbe Umgebung
        // nachspielt, liest dieselben Zeilen anders als der Lauf, dessen
        // Ergebnis als Wahrheit bestaetigt wurde: derselbe Betrag mit anderem
        // Trennzeichen, dieselbe Quote in anderem Format. Der Fall waere dann
        // grundlos rot oder, schlimmer, gruen mit einer anderen Zahl.
        const leseumgebung = {
          // Ohne erkannten Anbieter gibt es kein Gebiet, und dann wird nicht
          // geraten: 'en' haette aus deutschen 1.250 Euro stillschweigend
          // 1,25 gemacht. null laesst die Frage offen und erzeugt einen
          // sichtbaren Hinweis. Siehe test/gebiet.test.mjs.
          gebiet: profil?.gebiet ?? null,
          waehrung: profil?.waehrung ?? 'UNBEKANNT',
          quotenformat: profil?.quotenformat ?? 'dezimal',
          bezugsjahr: heute.getFullYear(),
          bezugsmonat: heute.getMonth() + 1,
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
          ...leseumgebung,
          zeitstempel: jetzt(),
          ocrSicherheit: lesung.sicherheit,
        })

        schein.leseumgebung = leseumgebung
        // Die Zeilen, die leseSchein wirklich bekommen hat. rohtext ist fuer
        // Menschen gedacht und kann anders zusammengesetzt sein; ein Pruefall
        // braucht genau die Eingabe, nicht eine Fassung davon.
        schein.lesezeilen = lesung.zeilentexte

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
    Zustand.melde('warnung', 'Es ließ sich kein einziger Schein lesen.')
  }

  return { gelesen: neueScheine.length, fehler: fehlerzahl }
}

/**
 * Entfernt ein Bild samt seiner Scheine, aus dem Arbeitsstand UND vom Geraet.
 *
 * WOZU: Karam fotografiert in Mengen. Ein Ausschnitt trifft daneben, ein Foto
 * gehoert gar nicht in dieses Projekt, eine Aufnahme ist doppelt. Bisher gab es
 * nur "Alle Bilder verwerfen", also alles oder nichts.
 *
 * BEIDE SEITEN AUF EINMAL: nur aus dem Arbeitsstand zu entfernen reicht nicht,
 * das Bild kaeme beim naechsten Laden aus der oertlichen Ablage zurueck. Nur aus
 * der Ablage zu loeschen reicht auch nicht, dann stuende es weiter auf dem
 * Bildschirm. Deshalb steht beides hier an einer Stelle, und die Ansicht ruft
 * genau diese eine Stelle auf (Projektregel 8).
 *
 * @param {string} bildId
 * @returns {Promise<number>} wie viele Scheine mit entfernt wurden
 */
export async function entferneBildGanz(bildId) {
  const mitGegangen = Zustand.entferneBild(bildId)
  try {
    await loescheBild(bildId)
  } catch (fehler) {
    // Das Bild ist aus der Ansicht verschwunden, liegt aber noch auf dem
    // Geraet. Das wird gemeldet, nicht verschwiegen: sonst taucht es beim
    // naechsten Laden wieder auf und niemand weiss, warum.
    Zustand.melde(
      'warnung',
      `Das Bild ist aus der Liste entfernt, konnte aber nicht vom Geraet gelöscht werden: ${
        fehler instanceof Error ? fehler.message : String(fehler)
      }. Nach einem Neuladen kann es wieder auftauchen.`
    )
  }
  return mitGegangen
}

/*
  B5: Nachtragen in die Ablage, ohne die Arbeit anzuhalten.

  Scheitert es, wird EINMAL je Sitzung gewarnt, nicht bei jedem Handgriff:
  der haeufigste Grund ist ein Bild, das der volle Browser beim Hochladen gar
  nicht angenommen hat, und dafuer gab es dort schon die laute Meldung.
*/
let bildangabenWarnungGezeigt = false

/**
 * @param {string} bildId
 * @param {Parameters<typeof aktualisiereBildAngaben>[1]} angaben
 */
function trageBildAngabenNach(bildId, angaben) {
  aktualisiereBildAngaben(bildId, angaben).catch((fehler) => {
    if (bildangabenWarnungGezeigt) return
    bildangabenWarnungGezeigt = true
    Zustand.melde(
      'warnung',
      'Die Einstellungen am Bild ließen sich nicht auf dem Gerät merken: ' +
        `${fehler instanceof Error ? fehler.message : String(fehler)} ` +
        'Nach einem Neuladen gelten dort wieder die alten.'
    )
  })
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
  trageBildAngabenNach(bildId, { karten })
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
export async function setzeBereich(bildId, bereich) {
  const stand = Zustand.hole()
  const bilder = new Map(stand.bilder)
  const eintrag = bilder.get(bildId)
  if (!eintrag) return

  // Nach einem Neuladen liegt das Bild nur als Datei da. Zum Zerlegen wird es
  // gebraucht, also wird es hier geholt (oberflaeche/bildspeicher.js).
  const element = eintrag.element ?? (await Bildspeicher.hole(eintrag))
  if (!element) return
  eintrag.element = element

  const voll = {
    x: 0,
    y: 0,
    breite: element.naturalWidth,
    hoehe: element.naturalHeight,
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
    const spalten = findeSpalten(element, gewaehlt)
    for (const spalte of spalten) {
      const ergebnis = zerlege(element, {
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
      `Der Bereich ließ sich nicht zerlegen: ${fehler instanceof Error ? fehler.message : String(fehler)}`
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
  trageBildAngabenNach(bildId, { karten, hinweise, bereich: bereich ? gewaehlt : null })

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
  trageBildAngabenNach(bildId, { buchmacher: eintrag.bild.buchmacher })
}
