// @ts-check
/**
 * Massenausschnitt: ein schwebender Mini-Knopf, jeder Druck nimmt den ganzen
 * Bildschirm, Doppelklick bringt das Programm mit der Vorschau zurueck.
 *
 * Karam am 19.09.2026: "Wenn ich auf diesen Knopf druecke, verkleinert sich
 * das Programm, wird so ein Mini-Knopf, der ist einfach auf dem Bildschirm,
 * den kann man noch bewegen. Und immer wenn ich drauf druecke, kann ich den
 * aktuellen gesamten Bildschirm einfach ausschneiden. Wenn ich mit dem
 * Massenausschneiden fertig bin, tue ich doppelklicken, dann oeffnet sich das
 * Programm wieder und hat eine Preview von allen Screenshots."
 *
 * WIE DER MINI-KNOPF SCHWEBT
 *
 * Eine Webseite kann ihr eigenes Fenster nicht verkleinern. Was sie kann, ist
 * ein BILD-IM-BILD-FENSTER oeffnen (documentPictureInPicture): das ist das
 * einzige Fenster, das IMMER ueber allen anderen liegt, sich frei verschieben
 * laesst und eigenen Inhalt tragen darf. Genau das ist der Mini-Knopf. Chrome
 * und Edge koennen das; wo es fehlt (Firefox, Safari, Telefon), schwebt der
 * Knopf stattdessen IN der Seite, und dann muss das Programmfenster sichtbar
 * bleiben. Der Unterschied steht am Knopf, nicht im Kleingedruckten
 * (Falle 7: eine Einschraenkung ohne ihr Warum liest sich wie Absicht).
 *
 * WAS AUFGENOMMEN WIRD (seit dem 19.09.2026 abends, zweite Runde): ein Klick
 * friert das aktuelle Bild ein und oeffnet SOFORT den Rahmen zum Markieren,
 * wie beim Snipping-Werkzeug: Rechteck ziehen, Eingabetaste uebernimmt,
 * Escape verwirft genau diese eine Aufnahme. Keine Fensterwahl dazwischen,
 * kein Nachfragen. Der Rahmen selbst ist zeigeZuschnitt aus
 * bildschirmfoto.js, dieselbe eine Stelle wie beim normalen Ausschneiden
 * (Projektregel 8).
 *
 * WO DER RAHMEN LIEGT (dritte Runde, 19.09.2026 nachts): im schwebenden
 * Mini-Fenster SELBST, das dafuer kurz gross wird und nach dem Uebernehmen
 * wieder auf Knopfgroesse schrumpft. Bis dahin lag der Rahmen im
 * Programmfenster, das dafuer mit window.focus() nach vorn geholt wurde,
 * und genau das war Karams Fehlerbericht: "nach jedem Screenshot oeffnet
 * sich aus irgendeinem Grund die Kombi Exchange. Ich will: Bild machen,
 * uebernehmen, das naechste Bild machen." Jetzt bleibt das Programmfenster
 * hinten; nur wo das Wachsen des Mini-Fensters NACHWEISLICH scheitert
 * (nachgemessen an der Fensterbreite, nicht angenommen), faellt es auf den
 * alten Weg zurueck, damit der Rahmen nie in einem 104 Pixel breiten
 * Fenster landet.
 *
 * Die Fensterwahl kommt genau EINMAL (oeffneBildschirmstrom), danach beliebig
 * viele Aufnahmen. Beendet wird mit Doppelklick, Escape, dem Schliessen des
 * Mini-Fensters oder dem Beenden der Freigabe im Browser: alle vier Wege
 * enden im selben Aufraeumen, keiner laesst den Strom offen.
 *
 * Diese Datei setzt nur Klassennamen. Farben und Groessen stehen in stil/,
 * auch fuer das Bild-im-Bild-Fenster: dessen Dokument bekommt dieselben
 * Stilblaetter verlinkt.
 */

import { el } from './werkzeug.js'
import {
  oeffneBildschirmstrom,
  greifeEinzelbild,
  beendeStrom,
  alsDatei,
  zeigeZuschnitt,
} from './bildschirmfoto.js'

/**
 * Wie lange nach einem Klick auf ein zweites geklickt gewartet wird, bevor er
 * als EINZELNER Klick gilt (Aufnahme). Kommt in der Spanne ein zweiter, war
 * es ein Doppelklick (fertig). Gemessen an der ueblichen Doppelklickzeit von
 * Windows (500 ms Vorgabe): 300 ms trifft beides, zuegiges Aufnehmen und
 * bequemes Doppelklicken.
 */
const DOPPELKLICK_SPANNE = 300

/**
 * Die Ruhegroesse des Mini-Fensters ("um die Haelfte oder fast ein Viertel",
 * Karam am 19.09.2026 abends). Sie steht als Konstante, weil das Fenster nach
 * jedem Rahmen wieder GENAU hierauf zurueckschrumpfen muss.
 */
const MINI_BREITE = 104
const MINI_HOEHE = 112

/**
 * Ab welcher Fensterbreite ein Rahmen brauchbar zu ziehen ist. Darunter gilt
 * das Wachsen als gescheitert und der Rahmen geht ins Programmfenster.
 */
const RAHMEN_MINDESTBREITE = 300

/**
 * Wie gross das Mini-Fenster zum Rahmenziehen werden soll: fast der ganze
 * Bildschirm, aber nie mehr, als der Arbeitsbereich hergibt.
 *
 * Als eigene reine Funktion, damit test/massenlese.test.mjs sie ohne Fenster
 * pruefen kann.
 *
 * @param {{availWidth?: number, availHeight?: number}|null|undefined} schirm
 * @returns {{breite: number, hoehe: number}}
 */
export function grosseFuerRahmen(schirm) {
  const breit = Number(schirm?.availWidth) || 1280
  const hoch = Number(schirm?.availHeight) || 800
  return {
    breite: Math.min(breit, Math.max(480, Math.round(breit * 0.9))),
    hoehe: Math.min(hoch, Math.max(360, Math.round(hoch * 0.9))),
  }
}

/**
 * Wartet, bis ein Fenstermass eine Bedingung erfuellt, hoechstens die Frist.
 *
 * GEMESSEN STATT ANGENOMMEN: resizeTo() kann still verpuffen (alte
 * Chrome-Fassung, verbrauchte Nutzereingabe, Fensterverwalter sagt nein).
 * Das gilt fuer das Wachsen (sonst laege der Rahmen in einem 104 Pixel
 * breiten Fenster) genauso wie fuer das Schrumpfen (sonst bliebe ein fast
 * bildschirmgrosses Immer-oben-Fenster stehen und stuende in der naechsten
 * Aufnahme mit im Bild).
 *
 * DIE WECKER LAUFEN AUF DEM GEMESSENEN FENSTER, nicht auf dem
 * Programmfenster: das liegt beim Massenausschnitt absichtlich verdeckt
 * hinten, und Chrome drosselt die Wecker verdeckter Fenster auf etwa einen
 * Schlag je Sekunde. Das Mini-Fenster ist als Immer-oben-Fenster nie
 * verdeckt.
 *
 * @param {Window} fenster
 * @param {() => boolean} passt  Wird abgesichert gerufen; ein geschlossenes
 *   Fenster gilt als "passt nicht".
 * @param {number} [frist]  In Millisekunden.
 * @returns {Promise<boolean>}
 */
function warteAufMass(fenster, passt, frist = 500) {
  return new Promise((fertig) => {
    const sicher = () => {
      try {
        return passt()
      } catch {
        return false
      }
    }
    /** @type {number|null} */
    let uhr = null
    /** @type {number|null} */
    let ende = null
    /** @type {ReturnType<typeof setTimeout>|null} */
    let netz = null
    let fertigGemeldet = false
    const aufhoeren = (wert) => {
      if (fertigGemeldet) return
      fertigGemeldet = true
      try {
        if (uhr !== null) fenster.clearInterval(uhr)
        if (ende !== null) fenster.clearTimeout(ende)
      } catch {
        // Ein geschlossenes Fenster nimmt seine Wecker selbst mit.
      }
      if (netz !== null) clearTimeout(netz)
      fertig(wert)
    }

    if (sicher()) {
      aufhoeren(true)
      return
    }

    let zu = true
    try {
      zu = fenster.closed === true
    } catch {
      // Nicht einmal die Frage nach closed beantwortet: das Fenster ist weg.
    }
    if (zu) {
      aufhoeren(sicher())
      return
    }

    try {
      uhr = fenster.setInterval(() => {
        if (sicher()) aufhoeren(true)
      }, 50)
      ende = fenster.setTimeout(() => aufhoeren(sicher()), frist)
    } catch {
      // Kein Fenster, keine Wecker: dann zaehlt die eine Messung von eben.
      aufhoeren(false)
      return
    }
    /*
      SICHERHEITSNETZ IM PROGRAMMFENSTER: schliesst das gemessene Fenster
      WAEHREND der Frist, sterben seine Wecker mit ihm, und dieses
      Versprechen bliebe sonst fuer immer offen; nimmAuf hinge daran fest.
      Das Netz darf gedrosselt sein, es ist der letzte Ausweg, nicht der
      Regelfall.
    */
    netz = setTimeout(() => aufhoeren(sicher()), frist + 1500)
  })
}

/**
 * Gibt es hier ein echtes schwebendes Fenster?
 *
 * @returns {boolean}
 */
export function kannMiniFenster() {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

/**
 * Der ganze Durchgang: Mini-Knopf zeigen, sammeln, aufraeumen.
 *
 * Loest mit den aufgenommenen Dateien auf, mit einer leeren Liste bei Abbruch
 * ohne Aufnahme. Wirft nur, wenn schon die Bildschirmfreigabe scheitert; das
 * behandelt der Aufrufer wie beim normalen Ausschneiden.
 *
 * @returns {Promise<File[]>}
 */
export async function massenDurchgang() {
  const { strom, video } = await oeffneBildschirmstrom()

  /** @type {HTMLCanvasElement[]} */
  const bilder = []

  try {
    await sammleImMiniKnopf(strom, video, bilder)
  } finally {
    // Alle Endwege muenden hier: der Browser zeigt sonst unbegrenzt weiter
    // an, dass der Bildschirm geteilt wird.
    beendeStrom(strom, video)
  }

  /** @type {File[]} */
  const dateien = []
  for (let i = 0; i < bilder.length; i++) {
    dateien.push(await alsDatei(bilder[i], `masse-${String(i + 1).padStart(2, '0')}`))
  }
  return dateien
}

/**
 * Zeigt den Mini-Knopf und sammelt Aufnahmen, bis Schluss ist.
 *
 * @param {MediaStream} strom
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement[]} bilder
 * @returns {Promise<void>}
 */
async function sammleImMiniKnopf(strom, video, bilder) {
  /** @type {Window|null} */
  let miniFenster = null
  if (kannMiniFenster()) {
    try {
      // Klein, wie von Karam verlangt ("um die Haelfte oder fast ein
      // Viertel"): vorher 168 mal 168, jetzt gut ein Drittel der Flaeche.
      miniFenster = await /** @type {any} */ (window).documentPictureInPicture.requestWindow({
        width: MINI_BREITE,
        height: MINI_HOEHE,
      })
    } catch {
      // Verweigert oder nicht verfuegbar: dann der Weg in der Seite.
      miniFenster = null
    }
  }

  const dokument = miniFenster ? miniFenster.document : document

  if (miniFenster) {
    // Die Stilblaetter des Programms auch im Mini-Fenster, damit hier keine
    // einzige Farbe im JavaScript steht (Projektregel 5). grund.css gehoert
    // dazu, seit der ganze Zuschnitt in diesem Fenster erscheint: Schriftart,
    // Zeilenmass und box-sizing kommen NUR von dort, ohne sie stuende der
    // Rahmen in der Serifen-Vorgabeschrift des Browsers. Dieselbe
    // Reihenfolge wie in index.html.
    for (const blatt of ['stil/marken.css', 'stil/grund.css', 'stil/bauteile.css']) {
      const glied = dokument.createElement('link')
      glied.rel = 'stylesheet'
      glied.href = new URL(blatt, document.baseURI).href
      dokument.head.append(glied)
    }
    dokument.title = 'Massenausschnitt'
    // Nur Merkmale, kein Aussehen: dasselbe Farbthema wie das Programm, und
    // eine Klasse, an der stil/bauteile.css das kleine Fenster erkennt.
    const thema = document.documentElement.dataset.theme
    if (thema) dokument.documentElement.dataset.theme = thema
    dokument.body.className = 'minifenster'
  }

  return new Promise((fertigMelden) => {
    let vorbei = false
    /** @type {number|ReturnType<typeof setTimeout>|null} */
    let klickWecker = null

    /*
      ALLE WECKER DIESER SERIE LAUFEN AUF DEM MINI-FENSTER, wo es eines gibt.

      Das Programmfenster liegt waehrend der Serie absichtlich verdeckt
      hinten, und Chrome drosselt die Wecker verdeckter Fenster auf etwa
      einen Schlag je Sekunde. Mit dem Wecker des Programmfensters wuerde
      aus der Doppelklick-Spanne von 300 Millisekunden praktisch eine
      Sekunde: zwei zuegige EINZELklicks gaelten als Doppelklick und
      beendeten die ganze Serie. Das Mini-Fenster ist als
      Immer-oben-Fenster nie verdeckt und nie gedrosselt.
    */
    const uhren = miniFenster ?? window

    const zaehler = dokument.createElement('span')
    zaehler.className = 'miniknopfzahl'
    zaehler.textContent = '0'

    const knopf = dokument.createElement('button')
    knopf.type = 'button'
    knopf.className = 'miniknopf'
    knopf.title =
      'Klick oder Eingabetaste: Bild einfrieren und mit der Maus markieren, ' +
      'Enter übernimmt den Ausschnitt. Doppelklick oder Escape hier: fertig, zurück zur Vorschau.'
    knopf.append(zaehler)

    // Der Ruhetext steht als Konstante, weil der Hinweis zwischendurch
    // ehrliche Ausnahmen traegt (Fenster noch gross, Rahmen im
    // Programmfenster) und danach hierauf zurueck muss.
    const hinweisRuhe = miniFenster
      ? 'Doppelklick: fertig'
      : 'Dieses Fenster muss sichtbar bleiben (kein schwebendes Fenster in diesem Browser). Doppelklick: fertig'

    const hinweis = dokument.createElement('p')
    hinweis.className = 'miniknopfhinweis'
    hinweis.textContent = hinweisRuhe

    const huelle = dokument.createElement('div')
    huelle.className = 'miniknopfhuelle'
    huelle.append(knopf, hinweis)

    /** Im Rueckfall ohne Mini-Fenster laesst sich die Huelle ziehen. */
    if (!miniFenster) {
      huelle.dataset.inSeite = 'true'
      macheZiehbar(huelle)
    }

    dokument.body.append(huelle)
    knopf.focus()

    /*
      EIN KLICK: BILD EINFRIEREN, RAHMEN ZIEHEN, ENTER UEBERNIMMT.

      DER RAHMEN LIEGT IM SCHWEBENDEN FENSTER SELBST (seit dem 19.09.2026
      nachts). Das Mini-Fenster waechst dafuer kurz fast auf Bildschirmgroesse
      (resizeTo braucht die frische Nutzereingabe, und Klick wie Eingabetaste
      liefern sie) und schrumpft nach dem Uebernehmen zurueck. Das
      Programmfenster bleibt hinten, Karams Fehlerbericht: "ich will nicht,
      dass jedes Mal sich die Kombi Exchange oeffnet."

      Ob das Wachsen gelungen ist, wird an der Fensterbreite NACHGEMESSEN
      (warteAufMass): ein still verpufftes resizeTo liesse den Rahmen sonst
      in einem 104 Pixel breiten Fenster erscheinen. Nur in diesem Fall wird
      das Programmfenster nach vorn geholt, der alte Weg.

      Solange ein Rahmen offen ist, tut ein weiterer Druck auf den
      Mini-Knopf nichts: zwei Rahmen uebereinander waeren zwei Wahrheiten
      ueber dieselbe Aufnahme.
    */
    let imRahmen = false

    /*
      OB DAS SCHRUMPFEN NOCH AUSSTEHT.

      resizeTo() verlangt eine frische Nutzereingabe und VERBRAUCHT sie.
      Klick, Eingabetaste und die Rahmenknoepfe stiften eine; die
      Escape-Taste stiftet laut HTML-Standard ausdruecklich KEINE. Wer den
      Rahmen also mit Escape verwirft, ohne vorher zu ziehen, laesst dem
      Schrumpfen nichts uebrig: das Immer-oben-Fenster bliebe fast
      bildschirmgross stehen und stuende in der NAECHSTEN Aufnahme mit im
      Bild. Deshalb wird das Schrumpfen NACHGEMESSEN, und steht es noch
      aus, ist der naechste Klick ein Reparaturklick: er macht nur das
      Fenster wieder klein (seine Eingabe wird genau dafuer verbraucht)
      und nimmt nichts auf. Das steht im Hinweis, nicht im Kleingedruckten.
    */
    let schrumpfenSteht = false
    const istKlein = () => miniFenster !== null && miniFenster.innerWidth <= RAHMEN_MINDESTBREITE

    /**
     * @param {HTMLCanvasElement} ganz
     * @returns {Promise<HTMLCanvasElement|null>}
     */
    const rahmenZiehen = async (ganz) => {
      if (miniFenster) {
        try {
          const gross = grosseFuerRahmen(miniFenster.screen)
          miniFenster.resizeTo(gross.breite, gross.hoehe)
        } catch {
          // Kein Wachsen erlaubt: unten der alte Weg.
        }
        const gewachsen = await warteAufMass(
          miniFenster,
          () => miniFenster.innerWidth >= RAHMEN_MINDESTBREITE
        )
        if (vorbei) return null
        if (gewachsen) {
          // Der Knopf verschwindet, solange der Rahmen die Flaeche braucht.
          huelle.hidden = true
          try {
            return await zeigeZuschnitt(ganz, miniFenster)
          } finally {
            huelle.hidden = false
            try {
              miniFenster.resizeTo(MINI_BREITE, MINI_HOEHE)
            } catch {
              // Nachgemessen wird gleich; verpufft ist verpufft.
            }
            if (!(await warteAufMass(miniFenster, istKlein, 400)) && !vorbei) {
              schrumpfenSteht = true
              hinweis.textContent =
                'Das Fenster ist noch groß (Escape trägt keine frische Eingabe). ' +
                'Der nächste Klick macht es nur wieder klein.'
            }
          }
        }
      }

      if (vorbei) return null

      /*
        DER ALTE WEG, nur noch als nachgemessener Rueckfall: Rahmen im
        Programmfenster, das dafuer nach vorn kommt. Das WARUM steht am
        Mini-Fenster dran (Falle 7), sonst laese sich der Rueckfall wie
        genau der Fehler, den Karam gemeldet hat. Ein spaet doch noch
        gewachsenes Mini-Fenster wird vorher zurueckgeschrumpft, damit es
        nicht fast bildschirmgross ueber dem Rahmen haengt.
      */
      if (miniFenster) {
        try {
          miniFenster.resizeTo(MINI_BREITE, MINI_HOEHE)
        } catch {
          // Wenn nicht einmal das geht, war es nie gewachsen.
        }
        hinweis.textContent =
          'Das schwebende Fenster durfte nicht wachsen; der Rahmen liegt im Programmfenster.'
      }
      try {
        window.focus()
      } catch {
        // Manche Browser verweigern das Nachvornholen. Dann klickt Karam
        // das Programmfenster selbst an; der Rahmen wartet dort.
      }
      return await zeigeZuschnitt(ganz)
    }

    const nimmAuf = async () => {
      if (imRahmen || vorbei) return
      imRahmen = true
      try {
        if (schrumpfenSteht && miniFenster) {
          // Der Reparaturklick: nur klein werden, nichts aufnehmen. Die
          // frische Eingabe dieses Klicks geht in genau dieses resizeTo.
          try {
            miniFenster.resizeTo(MINI_BREITE, MINI_HOEHE)
          } catch {
            // Dann bleibt der Hinweis stehen und der naechste Klick
            // versucht es wieder.
          }
          if (await warteAufMass(miniFenster, istKlein, 400)) {
            schrumpfenSteht = false
            hinweis.textContent = hinweisRuhe
          }
          return
        }

        const ganz = await greifeEinzelbild(video, uhren)
        if (vorbei) return
        const ausschnitt = await rahmenZiehen(ganz)
        /*
          NACH DEN LANGEN SCHRITTEN NOCHMAL FRAGEN, OB DIE SERIE NOCH LEBT.
          Endet sie mittendrin (Freigabe beendet, Mini-Fenster zu,
          Doppelklick), ist bilder schon ausgewertet: ein spaeter push
          landete in einem Feld, das nie wieder jemand liest, und das Bild
          waere wortlos weg, der teuerste Fehlertyp.
        */
        if (ausschnitt && !vorbei) {
          bilder.push(ausschnitt)
          zaehler.textContent = String(bilder.length)
          // Kurzes Aufleuchten als Quittung. Nur ein Merkmal, das Aussehen
          // steht in stil/bauteile.css.
          knopf.dataset.genommen = 'true'
          try {
            uhren.setTimeout(() => {
              knopf.dataset.genommen = 'false'
            }, 180)
          } catch {
            // Ohne Wecker bleibt die Quittung eben stehen.
          }
        }
      } catch (fehler) {
        knopf.title = `Die Aufnahme schlug fehl: ${
          fehler instanceof Error ? fehler.message : String(fehler)
        }`
      } finally {
        imRahmen = false
        try {
          knopf.focus()
        } catch {
          // Ein geschlossenes Mini-Fenster braucht keinen Fokus mehr.
        }
      }
    }

    const schluss = () => {
      if (vorbei) return
      vorbei = true
      if (klickWecker !== null) {
        try {
          uhren.clearTimeout(klickWecker)
        } catch {
          // Ein geschlossenes Fenster hat seine Wecker schon mitgenommen.
        }
      }
      /*
        EIN OFFENER RAHMEN IM PROGRAMMFENSTER WIRD MITGESCHLOSSEN: das
        kuenstliche Escape loest zeigeZuschnitt dort mit null auf, genau
        wie ein echtes. Sonst bliebe die Schicht als Waise unter der
        Vorschau stehen, und ein spaeter bestaetigter Ausschnitt
        versickerte im schon ausgewerteten bilder-Feld. Ein Rahmen im
        Mini-Fenster stirbt gleich mit dessen close() von selbst.
      */
      if (imRahmen) {
        try {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        } catch {
          // Dann bleibt die Schicht stehen und Escape von Hand schliesst sie.
        }
      }
      huelle.remove()
      if (miniFenster) {
        try {
          miniFenster.close()
        } catch {
          // Ein schon geschlossenes Fenster ist kein Fehler.
        }
      }
      /*
        DER EINE GEWOLLTE FOKUSWECHSEL. Karam: "wenn ich fertig bin, tue
        ich doppelklicken, dann oeffnet sich das Programm wieder und hat
        eine Preview von allen Screenshots." Waehrend der Serie bleibt das
        Programmfenster jetzt hinten; showModal hebt aber kein
        Betriebssystemfenster an, die Vorschau ginge also unsichtbar
        HINTER der Wettseite auf, und sichtbar passierte gar nichts.
      */
      try {
        window.focus()
      } catch {
        // Wo der Browser das verweigert, holt Karam das Fenster selbst vor.
      }
      fertigMelden()
    }

    /*
      EIN KLICK NIMMT AUF, EIN DOPPELKLICK BEENDET.

      Der Browser feuert bei einem Doppelklick ZWEI click-Ereignisse und dann
      dblclick. Wer beim ersten click sofort aufnimmt, hat beim Beenden immer
      eine ungewollte Aufnahme zu viel. Deshalb wartet der erste Klick die
      Doppelklick-Spanne ab: kommt ein zweiter, war es das Fertigzeichen.
      Die Eingabetaste nimmt SOFORT auf, sie kann kein Doppelklick sein.
    */
    knopf.addEventListener('click', () => {
      // imRahmen gehoert auch hier dazu: im Seiten-Rueckfall schwebt der
      // Knopf UEBER der Zuschnittschicht, und ein Doppelklick beendete
      // sonst die Serie mitten im offenen Rahmen.
      if (vorbei || imRahmen) return
      if (klickWecker !== null) {
        try {
          uhren.clearTimeout(klickWecker)
        } catch {
          // Ein toter Wecker feuert ohnehin nicht mehr.
        }
        klickWecker = null
        schluss()
        return
      }
      try {
        klickWecker = uhren.setTimeout(() => {
          klickWecker = null
          void nimmAuf()
        }, DOPPELKLICK_SPANNE)
      } catch {
        // Ohne Wecker gibt es keinen Doppelklick zu unterscheiden: dann
        // nimmt der Klick eben sofort auf.
        klickWecker = null
        void nimmAuf()
      }
    })

    dokument.addEventListener('keydown', (e) => {
      /*
        SOLANGE EIN RAHMEN OFFEN IST, GEHOERT DIE TASTATUR IHM. Der Rahmen
        liegt jetzt im selben Fenster wie dieser Horcher; ohne den Waechter
        beendete das Escape, das nur die EINE Aufnahme verwerfen soll, die
        ganze Serie (zeigeZuschnitt horcht am Fenster, das kommt in der
        Ereignisreihenfolge NACH diesem Dokument-Horcher).
      */
      if (vorbei || imRahmen) return
      if (e.key === 'Enter') {
        e.preventDefault()
        void nimmAuf()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        schluss()
      }
    })

    // Wer die Freigabe ueber die Browserleiste beendet oder das Mini-Fenster
    // schliesst, ist genauso fertig wie mit dem Doppelklick.
    for (const spur of strom.getVideoTracks()) {
      spur.addEventListener('ended', schluss)
    }
    if (miniFenster) {
      miniFenster.addEventListener('pagehide', schluss)
    }
  })
}

/**
 * Macht die Huelle in der Seite mit der Maus verschiebbar (nur der Rueckfall
 * ohne Mini-Fenster; das echte Mini-Fenster verschiebt der Betriebssystem-
 * Fensterrahmen selbst).
 *
 * @param {HTMLElement} ziel
 */
function macheZiehbar(ziel) {
  let fasstAn = false
  let abstandX = 0
  let abstandY = 0

  ziel.addEventListener('pointerdown', (e) => {
    // Der Knopf selbst bleibt Knopf; gezogen wird an der Huelle daneben.
    if (/** @type {HTMLElement} */ (e.target).closest('.miniknopf')) return
    fasstAn = true
    const kasten = ziel.getBoundingClientRect()
    abstandX = e.clientX - kasten.left
    abstandY = e.clientY - kasten.top
    ziel.setPointerCapture(e.pointerId)
  })
  ziel.addEventListener('pointermove', (e) => {
    if (!fasstAn) return
    ziel.style.setProperty('--mini-links', `${Math.max(0, e.clientX - abstandX)}px`)
    ziel.style.setProperty('--mini-oben', `${Math.max(0, e.clientY - abstandY)}px`)
  })
  ziel.addEventListener('pointerup', () => {
    fasstAn = false
  })
}

/**
 * Die Vorschau aller Aufnahmen, mit dem Knopf "Analysieren".
 *
 * Karam: "oeffnet sich das Programm dann wieder und hat eine Preview von
 * allen Screenshots. Und dann kann ich auf Analysieren druecken."
 *
 * Einzelne Aufnahmen lassen sich vorher wegwerfen: ein danebengegangener
 * Schuss soll nicht mitgelesen werden. Loest mit den behaltenen Dateien auf,
 * mit null beim Verwerfen.
 *
 * @param {File[]} dateien
 * @param {string} wohin  Ein ehrlicher Satz, wo die Scheine landen werden.
 * @returns {Promise<File[]|null>}
 */
export function zeigeMassenVorschau(dateien, wohin) {
  return new Promise((erfuelle) => {
    /** @type {Set<number>} */
    const verworfen = new Set()
    /** @type {string[]} */
    const adressen = []

    const fenster = /** @type {HTMLDialogElement} */ (
      el('dialog.dialog.dialogfenster.massenvorschau', { 'aria-labelledby': 'massentitel' })
    )

    const titel = () =>
      `Massenausschnitt: ${dateien.length - verworfen.size} von ${dateien.length} Aufnahme(n) behalten`

    const ueberschrift = el('h2.dialogtitel', { id: 'massentitel', text: titel() })

    const kacheln = dateien.map((datei, i) => {
      const adresse = URL.createObjectURL(datei)
      adressen.push(adresse)
      const bild = el('img.massenbild', { src: adresse, alt: `Aufnahme ${i + 1}` })
      const kachel = el('.massenkachel', { daten: { weg: 'false' } }, [
        bild,
        el('span.massennummer', { text: String(i + 1) }),
        el('button.knopf.knopf-winzig.massenweg', {
          type: 'button',
          text: 'wegwerfen',
          title: 'Diese Aufnahme nicht mitlesen.',
          onclick: () => {
            if (verworfen.has(i)) verworfen.delete(i)
            else verworfen.add(i)
            kachel.dataset.weg = String(verworfen.has(i))
            const knopfEl = kachel.querySelector('.massenweg')
            if (knopfEl) knopfEl.textContent = verworfen.has(i) ? 'doch behalten' : 'wegwerfen'
            ueberschrift.textContent = titel()
          },
        }),
      ])
      return kachel
    })

    let geantwortet = false
    /** @param {File[]|null} ergebnis */
    const antworte = (ergebnis) => {
      if (geantwortet) return
      geantwortet = true
      for (const adresse of adressen) URL.revokeObjectURL(adresse)
      if (fenster.open) fenster.close()
      fenster.remove()
      erfuelle(ergebnis)
    }

    const formular = el('form.dialoginhalt', { method: 'dialog' }, [
      ueberschrift,
      el('p.dialogtext', { text: wohin }),
      el('.massenreihe', {}, kacheln),
      el('.dialogknoepfe', {}, [
        el('button.knopf', {
          type: 'button',
          text: 'Alles verwerfen',
          onclick: () => antworte(null),
        }),
        el('button.knopf.knopf-haupt', { type: 'submit', text: 'Analysieren' }),
      ]),
    ])

    formular.addEventListener('submit', (e) => {
      e.preventDefault()
      antworte(dateien.filter((_, i) => !verworfen.has(i)))
    })
    fenster.addEventListener('cancel', (e) => {
      e.preventDefault()
      antworte(null)
    })

    fuelleFenster(fenster, formular)
    document.body.append(fenster)
    fenster.showModal()
  })
}

/**
 * @param {HTMLDialogElement} fenster
 * @param {HTMLElement} inhalt
 */
function fuelleFenster(fenster, inhalt) {
  fenster.replaceChildren(inhalt)
}
