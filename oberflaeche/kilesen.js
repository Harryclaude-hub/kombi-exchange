// @ts-check
/**
 * Ein ganzes Foto von der KI lesen lassen und daraus Scheine machen.
 *
 * Karam am 17.09.2026: "Es muss wirklich geil sein. Es darf jetzt nicht Fehler
 * machen, vor allem bei BetOnline. Da kommen ein paar hundert Scheine taeglich
 * und mehrere Scheine in einem Foto."
 *
 * WARUM DAS GANZE FOTO UND NICHT DIE EINZELNEN KARTEN
 *
 * Genau da liegt sein Problem. Die oertliche Kette zerlegt das Foto zuerst in
 * Karten (bild/segmentierung.js) und liest jede einzeln. An seinen echten
 * Fotos ist gemessen: bei Stake werden von vier Wetten zwei Karten gefunden,
 * und bei Betway schneidet die Zerlegung eine Karte an der Spielstandsbox
 * durch. Der Fehler passiert also, BEVOR ueberhaupt gelesen wird, und kein
 * besserer Leser kann ihn danach noch beheben.
 *
 * Die KI sieht das ganze Bild auf einmal. Sie braucht keine Zerlegung und gibt
 * jeden Schein einzeln zurueck, auch vier nebeneinander in zwei Spalten.
 *
 * WAS SIE TROTZDEM NICHT DARF: entscheiden.
 *
 * Jeder Wert laeuft danach durch kern/quoten.js, versoehne(): Einsatz mal
 * Quote gleich Auszahlung, und diese Rechnung steht auf dem Schein SELBST.
 * Besteht die Antwort sie, hat die KI abgelesen. Besteht sie sie nicht, hat
 * die KI sich verraten, und der Schein bekommt einen Hinweis und wartet auf
 * den Menschen.
 *
 * Das ist Karams Regel, auf die KI angewandt: wo es einen Pruefstein gibt,
 * darf die Automatik entscheiden, wo keiner ist, entscheidet der Mensch.
 * MAN MUSS DER KI NIE GLAUBEN.
 */

import * as KI from '../daten/kileser.js'
import * as Zustand from './zustand.js'
import { el, neueKennung, jetzt } from './werkzeug.js'
import { schluesselFuerName, BUCHMACHER_NACH_SCHLUESSEL } from '../kern/buchmacher.js'
import { versoehne } from '../kern/quoten.js'

/**
 * Macht aus einem Wert der KI ein Feld, wie es das Programm kennt.
 *
 * QUELLE IST 'ocr' UND NICHT ETWA 'ki'. Fuer alles Weitere im Programm ist die
 * KI ein zweiter Leser, kein Orakel: ihre Werte duerfen von der Reparatur
 * berichtigt werden, sie duerfen Handkorrekturen NICHT ueberschreiben, und sie
 * tragen eine Sicherheit unter eins. Eine eigene Quelle haette all diese
 * Regeln einzeln noch einmal gebraucht (Projektregel 8).
 *
 * @template T
 * @param {T|null|undefined} wert
 * @param {boolean} unsicher  Hat die KI dieses Feld selbst als unsicher gemeldet?
 * @returns {{wert: T|null, sicherheit: number, quelle: 'ocr'|'vorgabe'}}
 */
function feld(wert, unsicher) {
  if (wert === null || wert === undefined || wert === '') {
    return { wert: null, sicherheit: 0, quelle: 'vorgabe' }
  }
  /*
    0.55 fuer ein selbst gemeldetes "unsicher", 0.9 sonst.

    Die 0.55 liegt mit Absicht unter der Schwelle, ab der die Oberflaeche ein
    Feld als sicher faerbt: ein Feld, bei dem die KI selbst gezoegert hat,
    soll Karam ansehen.
  */
  return { wert, sicherheit: unsicher ? 0.55 : 0.9, quelle: 'ocr' }
}

/**
 * Baut aus einem Schein der KI einen Schein des Programms.
 *
 * NACH AUSSEN GEGEBEN, damit es eine Probe dafuer geben kann.
 *
 * Nicht aus Bequemlichkeit: an genau dieser Umwandlung sind bis zum 18.09.2026
 * drei Fehler hintereinander aufgetreten, und jeder einzelne hat entweder das
 * Zusammenfassen zum Absturz gebracht oder Geldbetraege verfaelscht (siehe die
 * Erklaerung bei zahl()). Alle drei liefen unter 316 gruenen Proben durch, weil
 * diese Umwandlung von aussen nicht erreichbar war und nur ueber leseMitKI
 * lief, das ohne echten Schluessel nicht laeuft.
 *
 * Eine Stelle, die dreimal falsch war, braucht eine eigene Probe.
 *
 * @param {any} roh
 * @param {{bildId: string, projektId: string}} wo
 */
export function zuSchein(roh, wo) {
  const unsicher = new Set(Array.isArray(roh?.unsicher) ? roh.unsicher : [])
  const u = (name) => unsicher.has(name)

  const anbietername = typeof roh?.buchmacher === 'string' ? roh.buchmacher : ''
  const schluessel = schluesselFuerName(anbietername)
  const profil = schluessel ? BUCHMACHER_NACH_SCHLUESSEL[schluessel] : null

  /*
    DIE WAEHRUNG KOMMT VOM ANBIETER, WENN DIE KI KEINE NENNT.

    Nicht geraten: jedes Buchmacherprofil traegt seine Waehrung, und die ist
    eine Eigenschaft des Kontos, nicht des Bildes. Kennt das Programm den
    Anbieter nicht, bleibt die Waehrung leer, und die Summen verweigern sich
    lieber, als ueber Waehrungen hinweg zu addieren.
  */
  const waehrung = typeof roh?.waehrung === 'string' && roh.waehrung
    ? roh.waehrung.toUpperCase()
    : (profil?.waehrung ?? null)

  const status = typeof roh?.status === 'string' ? roh.status.toLowerCase().trim() : 'unbekannt'
  const erlaubt = ['offen', 'gewonnen', 'verloren', 'halb_gewonnen', 'halb_verloren', 'storniert', 'cashout']

  const auswahlen = (Array.isArray(roh?.auswahlen) ? roh.auswahlen : [])
    .filter((a) => a && typeof a === 'object')
    .map((a, i) => zuAuswahl(a, i, unsicher))

  /*
    DIE VOLLE FORM, JEDES FELD.

    Am 18.09.2026 zweimal hintereinander daran gescheitert: erst fehlte
    auswahl.markt, dann schein.gesetztAm. Beide Male ist kern/gruppierung.js
    mit einem Fehler stehengeblieben, BEVOR irgendetwas zusammengefasst
    werden konnte.

    Das ist die schlimmste Stelle fuer so einen Fehler, denn das
    Zusammenfassen ist Karams eigentliches Ziel. Deshalb steht hier jedes
    Feld aus kern/typen.js, auch die, die die KI nie liefert: leer, aber
    vorhanden. Ein fehlendes Feld ist ein Absturz, ein leeres Feld ist eine
    Luecke mit Warnung (Projektregel 1).
  */
  const leer = { wert: null, sicherheit: 0, quelle: /** @type {const} */ ('vorgabe') }

  return {
    id: neueKennung(),
    projektId: wo.projektId,
    bildId: wo.bildId,
    gruppeId: null,
    buchmacher: feld(profil?.name ?? anbietername ?? null, u('buchmacher') || !profil),
    konto: feld(text(roh?.konto) || null, u('konto')),
    scheinNr: feld(roh?.scheinNr ?? null, u('scheinNr')),
    gesetztAm: feld(text(roh?.gesetztAm) || null, u('gesetztAm')),
    einsatz: feld(zahl(roh?.einsatz), u('einsatz')),
    waehrung: feld(waehrung, u('waehrung')),
    quoteDezimal: feld(zahl(roh?.quoteDezimal), u('quoteDezimal')),
    quoteAmerikanisch: leer,
    auszahlung: feld(zahl(roh?.auszahlung), u('auszahlung')),
    ausgezahlt: feld(zahl(roh?.ausgezahlt), u('ausgezahlt')),
    status: erlaubt.includes(status) ? status : 'unbekannt',
    art: auswahlen.length > 1 ? 'kombi' : auswahlen.length === 1 ? 'einzel' : 'unbekannt',
    auswahlen,
    gratiswette: roh?.gratiswette === true,
    eachWay: roh?.eachWay === true,
    ausschnitt: null,
    geaendertAm: jetzt(),
    vonHand: false,
    hinweise: [],
  }
}

/**
 * Baut aus einer Auswahl der KI eine Auswahl des Programms.
 *
 * DAS IST DAS WICHTIGSTE STUECK DIESER DATEI, und gestern war es falsch.
 *
 * Karams Ziel in einem Satz: "Wetten auf einen Spieler zusammenfassen,
 * Einsatz addieren, pro Buchmacher getrennt." Das Zusammenfassen macht
 * kern/gruppierung.js, und die erkennt dieselbe Wette an der SIGNATUR, die
 * kern/kennung.js aus markt, tipp und linie bildet.
 *
 * Gestern lieferte diese Stelle `{ text: "RJ Harvey under 18,5 Rushing Yards" }`,
 * also einen Satz statt zerlegter Felder. bildeKennung() liest davon
 * auswahl.markt.wert, und das gab es nicht: die Gruppierung waere mit einem
 * Fehler stehengeblieben, noch bevor irgendetwas zusammengefasst werden
 * konnte. Genau das, worum es Karam geht, haette nicht funktioniert.
 *
 * Deshalb liefert die KI die Auswahl jetzt zerlegt, und hier wird daraus die
 * Form, die kern/ kennt.
 *
 * @param {any} a
 * @param {number} i
 * @param {Set<string>} unsicher
 */
function zuAuswahl(a, i, unsicher) {
  const u = unsicher.has('auswahlen')
  const tipp = text(a?.tipp)
  const markt = text(a?.markt)
  const richtung = text(a?.richtung).toLowerCase()

  /*
    DIE RICHTUNG GEHOERT IN DEN MARKT, nicht in ein eigenes Feld.

    kern/kennung.js kennt kein Feld "richtung". Es liest die Wettart aus
    markt UND tipp zusammen, weil je nach Anbieter mal das eine und mal das
    andere sie traegt. "over" und "under" muessen also im Markttext stehen,
    sonst waeren "ueber 18,5" und "unter 18,5" dieselbe Wette, und das waere
    der teuerste denkbare Lesefehler.
  */
  const marktMitRichtung = richtung && markt
    ? `${richtung.toUpperCase()} ${markt}`
    : markt || richtung.toUpperCase()

  return {
    id: neueKennung(),
    ereignis: feld(text(a?.ereignis) || null, u),
    markt: feld(marktMitRichtung || null, u),
    tipp: feld(tipp || null, u),
    linie: feld(zahl(a?.linie), u),
    quoteDezimal: feld(zahl(a?.quote), u),
    ergebnis: { wert: null, sicherheit: 0, quelle: /** @type {const} */ ('vorgabe') },
    status: /** @type {const} */ ('unbekannt'),
  }
}

/** @param {unknown} w */
function text(w) {
  return typeof w === 'string' ? w.trim() : ''
}

/**
 * Macht aus dem, was die KI geschickt hat, eine Zahl oder eine Luecke.
 *
 * HIER STAND DER TEUERSTE FEHLER DIESES PROGRAMMS, und er sah harmlos aus:
 *
 *     const n = typeof w === 'number' ? w : Number(w)
 *     return Number.isFinite(n) ? n : null
 *
 * Number(null) ist 0, und Number.isFinite(0) ist true. Aus jedem null wurde
 * also eine Null. Number('') ist auch 0, Number([]) ist 0, Number(false) ist 0.
 *
 * Und null schickt die KI nicht versehentlich, sondern auf Befehl: der Bauplan
 * in daten/kileser.js fuehrt einsatz, quoteDezimal und auszahlung unter
 * required mit dem Typ ['number','null'], und die ANWEISUNG sagt woertlich
 * "Steht ein Wert nicht im Bild, ist er null". Bei PS3838 steht auf dem Schein
 * ueberhaupt keine Auszahlung, sondern nur der Gewinn, also MUSS dort null
 * stehen.
 *
 * Am 18.09.2026 mit node nachgestellt, mit Karams neun echten PS3838-Scheinen:
 *
 *     richtig    Einsatz 17.717,48   moeglich 20.222,73   bestenfalls  +2.505,25
 *     gerechnet  Einsatz 17.717,48   moeglich      0,00   bestenfalls -17.717,48
 *
 * Auf dem Schirm stuende also, er verliere bestenfalls seinen vollen Einsatz.
 * Schlimmer noch: ein gewonnener Schein, dessen Auszahlung die KI nicht lesen
 * konnte, wurde als Totalverlust gebucht, und rechne() meldete dazu "Alle
 * haben die Gegenrechnung bestanden". Kein Hinweis, keine Warnung. Die
 * Sicherung in kern/rechnung.js prueft auf !== null, und 0 ist nicht null: die
 * Null ging an jeder Pruefung vorbei, weil sie wie ein abgelesener Wert aussah.
 *
 * Es traf auch das Zusammenfassen, also Karams eigentliches Ziel: aus
 * "Ohne Linie null" wurde linie 0, und vergleicheKennung() gab derselben Wette
 * dann nur noch 0,8 statt 1,0 Punkte, einmal von der KI gelesen und einmal
 * oertlich. Dieselbe Wette waere nicht mehr sicher zusammengefasst worden.
 *
 * Deshalb jetzt umgekehrt herum: NUR eine echte Zahl oder eine Zeichenkette,
 * in der wirklich eine Zahl steht, kommt durch. Alles andere ist eine Luecke,
 * und eine Luecke mit Warnung ist besser als ein erfundener Wert
 * (Projektregel 1).
 *
 * Eine Zeichenkette mit Komma, also "1,854" statt "1.854", ergibt NaN und
 * damit ebenfalls eine Luecke. Das ist gewollt: lieber nachfragen als eine
 * Quote um den Faktor tausend verschieben.
 *
 * @param {unknown} w
 * @returns {number|null}
 */
function zahl(w) {
  if (typeof w === 'number') return Number.isFinite(w) ? w : null
  if (typeof w !== 'string') return null
  const roh = w.trim()
  if (roh === '') return null
  const n = Number(roh)
  return Number.isFinite(n) ? n : null
}

/**
 * Laesst die Bilder von der KI lesen und legt die Scheine an.
 *
 * @param {string[]} bildIds
 * @returns {Promise<{gelesen: number, scheine: number, fehler: number}>}
 */
export async function leseMitKI(bildIds) {
  const stand = Zustand.hole()
  const projektId = stand.projekt?.id ?? ''
  if (!projektId) {
    Zustand.melde('fehler', 'Es ist kein Projekt geöffnet.')
    return { gelesen: 0, scheine: 0, fehler: 0 }
  }
  if (!KI.bereit()) {
    Zustand.melde('fehler', 'Es ist kein API-Schlüssel hinterlegt. Siehe den Kasten über dieser Liste.')
    return { gelesen: 0, scheine: 0, fehler: 0 }
  }

  let gelesen = 0
  let fehler = 0
  /** @type {any[]} */
  const neue = []

  for (let i = 0; i < bildIds.length; i += 1) {
    const eintrag = Zustand.hole().bilder.get(bildIds[i])
    if (!eintrag?.inhalt) {
      fehler += 1
      continue
    }

    Zustand.arbeite(true, `Foto ${i + 1} von ${bildIds.length} wird gelesen`, i / bildIds.length)

    const antwort = await KI.leseBild(eintrag.inhalt, {
      anbieter: eintrag.bild?.buchmacher?.wert ?? '',
    })

    if (!antwort.gelungen) {
      fehler += 1
      Zustand.melde('warnung', `"${eintrag.bild.dateiname}": ${antwort.meldung}`)
      continue
    }

    gelesen += 1
    for (const roh of antwort.scheine) {
      const schein = zuSchein(roh, { bildId: bildIds[i], projektId })

      /*
        DER PRUEFSTEIN. Hier und nirgends sonst entscheidet sich, ob die
        Antwort der KI gilt.

        versoehne() rechnet Einsatz mal Quote gegen die Auszahlung und
        beruecksichtigt dabei den Stand: bei einem verlorenen Schein ist eine
        Auszahlung von null kein Widerspruch. Geht die Rechnung nicht auf,
        kommen Hinweise zurueck, und die stehen dann am Schein.
      */
      const probe = versoehne({
        einsatz: schein.einsatz.wert,
        auszahlung: schein.auszahlung.wert,
        dezimal: schein.quoteDezimal.wert,
        status: schein.status,
        einsatzWirdZurueckgezahlt: !schein.gratiswette,
      })
      schein.hinweise = probe.hinweise ?? []

      neue.push(schein)
    }
  }

  Zustand.arbeite(false)

  if (neue.length > 0) {
    Zustand.ordneNeu([...Zustand.hole().scheine, ...neue])
    const mitHinweis = neue.filter((s) => s.hinweise.length > 0).length
    Zustand.melde(
      'erfolg',
      `${neue.length} Schein(e) aus ${gelesen} Foto(s) gelesen.` +
        (mitHinweis > 0
          ? ` ${mitHinweis} davon hat die Gegenrechnung nicht bestanden und wartet auf dich.`
          : ' Alle haben die Gegenrechnung bestanden.')
    )
  } else if (fehler === 0) {
    Zustand.melde('warnung', 'Die KI hat auf diesen Fotos keinen Schein gefunden.')
  }

  return { gelesen, scheine: neue.length, fehler }
}

/**
 * Der Kasten, in dem der Schluessel eingegeben wird.
 *
 * ER STEHT IM PROGRAMM UND NICHT IN EINER DATEI. Das ist der ganze
 * Unterschied: dieses Programm ist eine statische Seite in einem
 * OEFFENTLICHEN Repository. Ein Schluessel im Quelltext waere fuer jeden
 * lesbar, der die Seite aufruft. Vom Menschen eingegeben liegt er nur in
 * seinem Browser.
 *
 * @param {() => void} neuZeichnen
 * @returns {HTMLElement}
 */
export function schluesselkasten(neuZeichnen) {
  const da = KI.bereit()

  const feldEl = /** @type {HTMLInputElement} */ (
    el('input.dialogeingabe', {
      type: 'password',
      value: '',
      placeholder: da ? KI.schluesselkurz() : 'sk-ant-...',
      autocomplete: 'off',
      spellcheck: 'false',
    })
  )

  return el('.hinweisblock', { daten: { art: da ? 'gut' : 'info' } }, [
    el('.hinweisart', { text: da ? 'KI-Leser bereit' : 'KI-Leser einrichten' }),
    el('p.geteilttext', {
      text: da
        ? `Der Schlüssel ${KI.schluesselkurz()} liegt in diesem Browser. Neue Fotos kannst du mit ` +
          '"Mit KI lesen" lesen lassen; die KI findet auch mehrere Scheine auf einem Foto.'
        : 'Ohne Schlüssel liest das Programm nur örtlich. Die örtliche Bildzerlegung findet bei ' +
          'mehreren Scheinen auf einem Foto nicht alle. Die KI sieht das ganze Bild auf einmal.',
    }),
    el('ul.blockliste', {}, [
      el('li', { text: 'Den Schlüssel bekommst du bei Anthropic: console.anthropic.com, unter API keys.' }),
      el('li', { text: 'Er liegt NUR in diesem Browser. Er geht nie in die Datenbank und nie ins Repository.' }),
      el('li', { text: 'Setz dort ein Ausgabenlimit, dann kann dir nichts davonlaufen.' }),
      el('li', { text: 'Jeder gelesene Wert wird danach gegengerechnet: Einsatz mal Quote gleich Auszahlung.' }),
    ]),
    el('.dialogfeld', {}, [
      el('span.dialogfeldname', { text: da ? 'Anderen Schlüssel eintragen' : 'API-Schlüssel' }),
      feldEl,
    ]),
    el('.dialogfeld', {}, [
      el('span.dialogfeldname', { text: 'Modell' }),
      el(
        'select.feldwahl.feldwahl-breit',
        {
          onchange: (e) => {
            KI.setzeModell(/** @type {HTMLSelectElement} */ (e.target).value)
            neuZeichnen()
          },
        },
        KI.MODELLE.map((m) =>
          el('option', {
            value: m.wert,
            text: `${m.name} \u2013 ${m.hinweis}`,
            selected: KI.modell() === m.wert ? 'selected' : null,
          })
        )
      ),
    ]),
    el('.ausgabeknoepfe', {}, [
      el('button.knopf.knopf-haupt', {
        type: 'button',
        text: da ? 'Schlüssel ersetzen' : 'Schlüssel speichern',
        onclick: () => {
          const wert = feldEl.value.trim()
          if (wert === '') {
            Zustand.melde('warnung', 'Es wurde nichts eingegeben.')
            return
          }
          KI.setzeSchluessel(wert)
          feldEl.value = ''
          Zustand.melde('erfolg', `Der Schlüssel ${KI.schluesselkurz()} ist hinterlegt.`)
          neuZeichnen()
        },
      }),
      da
        ? el('button.knopf.knopf-klein', {
            type: 'button',
            text: 'Schlüssel entfernen',
            onclick: () => {
              KI.setzeSchluessel('')
              Zustand.melde('info', 'Der Schlüssel ist aus diesem Browser entfernt.')
              neuZeichnen()
            },
          })
        : null,
    ]),
  ])
}
