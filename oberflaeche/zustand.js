// @ts-check
/**
 * Der Arbeitsstand des Programms.
 *
 * Eine einzige Stelle, an der steht, was gerade gilt. Wer etwas aendert, ruft
 * aendere auf. Alle Ansichten hoeren zu und zeichnen sich neu.
 *
 * Gerechnete Werte werden NIE hier abgelegt. Summen entstehen immer frisch aus
 * kern/rechnung.js. Sonst haette man zwei Fassungen derselben Zahl, und genau
 * daraus entsteht die Drift, die niemand mehr findet.
 */

import { gruppiere, verschmelzeDoppelte, schlageNamenVor } from '../kern/gruppierung.js'
import { rechne } from '../kern/rechnung.js'
import { neueKennung, jetzt } from './werkzeug.js'
import * as Ordner from './ordner.js'

/**
 * @typedef {object} Meldung
 * @property {string} id
 * @property {'info'|'erfolg'|'warnung'|'fehler'} art
 * @property {string} text
 * @property {string} zeit
 */

/**
 * @typedef {object} Bildeintrag
 * @property {import('../kern/typen.js').Bild} bild
 * @property {HTMLImageElement|null} element
 * @property {Blob|null} inhalt
 * @property {import('../kern/typen.js').Rechteck[]} karten
 * @property {string[]} hinweise
 * @property {import('../kern/typen.js').Rechteck|null} [bereich]
 *   Der vom Nutzer gezogene Rahmen. null heisst: das ganze Bild.
 */

/**
 * @typedef {object} Stand
 * @property {boolean} angemeldet
 * @property {string} token
 * @property {boolean} datenbankErreichbar
 * @property {import('../kern/typen.js').Projekt|null} projekt
 * @property {import('../kern/typen.js').Projekt[]} projekte
 * @property {Map<string, Bildeintrag>} bilder
 * @property {import('../kern/typen.js').Schein[]} scheine
 * @property {import('../kern/typen.js').Riesenschein[]} riesenscheine
 * @property {import('../kern/typen.js').Restposten[]} restposten
 * @property {import('../kern/gruppierung.js').Doppelfund[]} verdacht
 * @property {'start'|'aufnahme'|'scheine'|'positionen'|'ausgabe'|'ablage'|'hilfe'} ansicht
 * @property {string|null} hilfeZu
 * @property {string|null} scheinAuswahl
 * @property {string|null} ordnerFilter
 * @property {'neueste'|'alphabetisch'|'meisteGeld'|'wenigsteGeld'|'zuletztGeoeffnet'} sortierung
 * @property {{id: string, name: string}|null} huelle
 * @property {string|null} auswahl
 * @property {number|null} fassung
 * @property {{laeuft: boolean, text: string, anteil: number}} arbeit
 * @property {Meldung[]} meldungen
 * @property {{gruendlich: boolean, sprachen: 'eng'|'deu'|'eng+deu', bewegung: 0|1|2}} einstellungen
 */

/** @type {Stand} */
const stand = {
  angemeldet: false,
  token: '',
  datenbankErreichbar: true,
  projekt: null,
  projekte: [],
  // Fassung des offenen Projekts, so wie sie zuletzt gelesen wurde. Sie wandert
  // bei jedem Speichern mit und verhindert, dass ein zweites Fenster mit altem
  // Stand diese Arbeit ueberschreibt. null heisst: noch nichts gelesen.
  fassung: null,
  bilder: new Map(),
  scheine: [],
  riesenscheine: [],
  restposten: [],
  verdacht: [],
  // Die Uebersicht ist die Startseite, seit dem 16.09.2026.
  // Karam: "Aufnahme soll bitte bleiben, aber nicht ins Mainpage."
  /*
    DIE OFFENE HUELLE.

    Karam am 16.09.2026: "einen neuen Riesenschein erstellen, man speichert den
    alten, der bleibt. Es wird taeglich mehrere Riesenscheine gespielt."

    Riesenscheine entstehen sonst von selbst: gleiche Wetten wandern zusammen.
    Eine Huelle dreht das um. Solange eine offen ist, landet JEDER neu gelesene
    Schein darin, ohne Vergleich mit den anderen.

    Das ist bewusst eine Ausnahme und deshalb sichtbar: die Ansicht sagt
    deutlich, dass eine Huelle offen ist und automatisch nicht mehr gruppiert
    wird. Wer das nicht sieht, wundert sich sonst, warum zwei verschiedene
    Wetten in einem Riesenschein landen.

    null heisst: es gibt keine, alles laeuft wie immer.
  */
  huelle: null,
  ansicht: 'start',
  auswahl: null,
  /*
    DREI EBENEN, seit dem 17.09.2026.

    Karam: "ganz links sind entweder Riesenscheine, wenn man noch keinen auf
    hat, oder wenn man einen Riesenschein aufmacht, kommt der in die Mitte, und
    ganz links werden dann alle Scheine angezeigt, die in diesem Riesenschein
    sind. Kann man sie dann separat aufmachen, und dann sieht man im grossen
    Bereich, welche Einsaetze man hat, da kann man sie auch bearbeiten. Man
    kann dann auch auf Zurueck druecken."

      auswahl null                     Ebene 1, alle Riesenscheine
      auswahl gesetzt, scheinAuswahl null   Ebene 2, ein Riesenschein
      scheinAuswahl gesetzt            Ebene 3, ein einzelner Schein

    Die Ebene wird nicht eigens gespeichert, sie folgt aus diesen beiden
    Feldern. Eine dritte Angabe koennte mit ihnen auseinanderlaufen
    (Projektregel 8).
  */
  scheinAuswahl: null,
  /* Welcher Ordner in der linken Spalte gewaehlt ist. null heisst: alle. */
  ordnerFilter: null,
  /* Wonach die Riesenscheine links sortiert sind. */
  sortierung: 'neueste',
  // Aus welcher Ansicht heraus die Erklaerung geoeffnet wurde. Damit springt
  // die Erklaerung an die richtige Stelle. null heisst: von vorne.
  hilfeZu: null,
  arbeit: { laeuft: false, text: '', anteil: 0 },
  meldungen: [],
  einstellungen: { gruendlich: true, sprachen: 'eng', bewegung: 1 },
}

/** @type {Set<(stand: Stand) => void>} */
const zuhoerer = new Set()

/**
 * @returns {Stand}
 */
export function hole() {
  return stand
}

/**
 * @param {(stand: Stand) => void} was
 * @returns {() => void}
 */
export function hoerZu(was) {
  zuhoerer.add(was)
  return () => zuhoerer.delete(was)
}

/**
 * Aendert den Stand und sagt allen Bescheid.
 *
 * @param {Partial<Stand>} aenderung
 */
export function aendere(aenderung) {
  Object.assign(stand, aenderung)
  for (const was of zuhoerer) {
    try {
      was(stand)
    } catch (fehler) {
      // Ein kaputter Zuhoerer darf nicht alle anderen mit hinunterreissen.
      console.error('[Oberflaeche] Ein Teil der Anzeige konnte nicht neu gezeichnet werden.', fehler)
    }
  }
}

/**
 * Traegt eine Meldung ein.
 *
 * @param {'info'|'erfolg'|'warnung'|'fehler'} art
 * @param {string} text
 */
/**
 * Wie lange eine Meldung stehen bleibt, in Millisekunden.
 *
 * WARUM NICHT ALLE GLEICH
 *
 * Eine Bestaetigung ("Bild entfernt") hat ihren Zweck erfuellt, sobald man sie
 * gelesen hat. Sie geht von selbst. Eine Warnung braucht laenger, weil man
 * vielleicht erst zu Ende tippt.
 *
 * Ein FEHLER bleibt stehen, bis der Mensch ihn wegklickt. Das ist die ganze
 * Regel in einem Satz: was Geld betrifft, verschwindet nicht von allein. Eine
 * Fehlermeldung, die nach vier Sekunden weg ist, ist dasselbe wie keine
 * Fehlermeldung, und genau davor warnt die Fehlerklasse "stille Fehlschlaege".
 */
const MELDUNG_DAUER = {
  erfolg: 4000,
  info: 5000,
  warnung: 9000,
  fehler: 0,
}

export function melde(art, text) {
  const meldung = { id: neueKennung(), art, text, zeit: jetzt() }
  // Neueste zuerst, hoechstens fuenfzig behalten.
  aendere({ meldungen: [meldung, ...stand.meldungen].slice(0, 50) })

  const dauer = MELDUNG_DAUER[art] ?? 5000
  if (dauer > 0) {
    // setTimeout und nicht requestAnimationFrame: der Merksatz aus diesem
    // Projekt lautet, nichts an der Sichtbarkeit des Fensters aufzuhaengen.
    // In einem verdeckten Reiter wuerde die Meldung sonst nie verschwinden.
    setTimeout(() => meldungWeg(meldung.id), dauer)
  }
  return meldung.id
}

/**
 * @param {string} id
 */
export function meldungWeg(id) {
  aendere({ meldungen: stand.meldungen.filter((m) => m.id !== id) })
}

/**
 * @param {boolean} laeuft
 * @param {string} [text]
 * @param {number} [anteil]
 */
export function arbeite(laeuft, text = '', anteil = 0) {
  aendere({ arbeit: { laeuft, text, anteil } })
}

/**
 * Fuegt neue Scheine hinzu und ordnet danach alles neu.
 *
 * @param {import('../kern/typen.js').Schein[]} neue
 */
export function fuegeScheineHinzu(neue) {
  /*
    IST EINE HUELLE OFFEN, LANDEN DIE NEUEN SCHEINE DARIN.

    gruppeId gesetzt heisst in kern/gruppierung.js: von Hand festgelegt, wird
    nie aufgebrochen (dort Abschnitt 1). Damit entsteht kein zweiter
    Gruppierungsweg, es wird nur der vorhandene benutzt (Projektregel 8).

    Die Sicherheitsnetze bleiben alle: der Pruefstein am einzelnen Schein, die
    Ausreisserpruefung ueber die Quoten des Riesenscheins, und die Hinweise der
    Schwere fehler nehmen einen Schein weiterhin aus der Summe.
  */
  const zugeordnet = stand.huelle
    ? neue.map((s) => ({ ...s, gruppeId: stand.huelle?.id ?? null }))
    : neue
  ordneNeu([...stand.scheine, ...zugeordnet])
}

/**
 * Macht einen neuen, leeren Riesenschein auf UND schlaegt ihn auf.
 *
 * Karam am 17.09.2026: "ein neuer Riesenschein, wenn ich diesen Knopf druecke,
 * komme ich auf einen neuen Riesenschein. Das heisst, ich habe jetzt 10, dann
 * bekomme ich 11. Einen komplett neuen, keine Huelle schliessen, nichts."
 *
 * Es gibt deshalb keine Zeremonie mehr: ein Druck, und der neue Riesenschein
 * ist da und liegt vorne. Der bisherige bleibt unveraendert im Projekt stehen.
 *
 * ALLES, WAS DANACH GELESEN WIRD, WANDERT HINEIN, bis der naechste aufgemacht
 * wird. Das steht so auch am Riesenschein selbst, gut sichtbar: es schaltet
 * die automatische Zuordnung fuer neue Scheine ab, und wer das nicht sieht,
 * wundert sich sonst, warum zwei verschiedene Wetten zusammen liegen. Genau
 * dieser Fall hat am 16.09.2026 drei verschiedene Wetten zu einer Position von
 * 17.717,48 EUR verschmolzen (test/huelle_mischt.test.mjs).
 *
 * @param {string} name
 * @returns {string} die Kennung des neuen Riesenscheins
 */
export function macheHuelleAuf(name) {
  const id = neueKennung()
  aendere({ huelle: { id, name: String(name || '').trim() || 'Neuer Riesenschein' } })
  // ordneNeu setzt den leeren Riesenschein in die Liste, damit man ihn sofort
  // sieht. Es setzt die Auswahl NICHT mehr, das geschieht hier und nur hier.
  ordneNeu()
  aendere({ auswahl: id, scheinAuswahl: null })
  return id
}

/**
 * Schliesst die offene Huelle. Neue Scheine werden danach wieder automatisch
 * zugeordnet. Hat die Huelle schon Scheine, bleibt sie als Riesenschein
 * bestehen, sie nimmt nur nichts Neues mehr auf.
 */
export function schliesseHuelle() {
  if (!stand.huelle) return
  aendere({ huelle: null })
  ordneNeu()
}

/**
 * Ordnet alle Scheine neu zu Riesenscheinen.
 *
 * Zuerst werden Aufnahmen desselben Scheins zusammengefuehrt, dann wird gruppiert.
 * Bestehende Namen bleiben erhalten, damit eine Umbenennung durch den Nutzer
 * nicht bei der naechsten Aufnahme verschwindet.
 *
 * @param {import('../kern/typen.js').Schein[]} [scheine]
 */
export function ordneNeu(scheine) {
  const roh = scheine ?? stand.scheine
  const zusammengefuehrt = verschmelzeDoppelte(roh)

  if (zusammengefuehrt.verschmolzen.length > 0) {
    melde(
      'info',
      `${zusammengefuehrt.verschmolzen.length} Schein(e) waren doppelt erfasst und wurden zu je einem zusammengefuehrt.`
    )
  }

  const ergebnis = gruppiere(zusammengefuehrt.scheine, { gruppenId: () => neueKennung() })

  /** @type {Map<string, import('../kern/typen.js').Riesenschein>} */
  const alteNachId = new Map(stand.riesenscheine.map((r) => [r.id, r]))
  /** @type {Map<string, import('../kern/typen.js').Riesenschein>} */
  const alteNachSignatur = new Map(stand.riesenscheine.map((r) => [r.signatur, r]))

  /** @type {Map<string, import('../kern/typen.js').Schein>} */
  const nachId = new Map(zusammengefuehrt.scheine.map((s) => [s.id, s]))

  /*
    WER WAR VORHER WER.

    gruppiere() vergibt bei jedem Lauf neue Kennungen. Alles, was am
    Riesenschein haengt und NICHT im Riesenschein selbst steht, muss deshalb
    hier mitwandern, und zwar an dieser einen Stelle: hier und nur hier wird
    aus einer alten Kennung eine neue (Projektregel 8).

    Bisher wanderten Name und Notiz mit, weil sie im Riesenschein stehen. Die
    Ordnerzuordnung liegt aber daneben, im Browser, und ging deshalb bei jedem
    Neuordnen verloren. Gemessen am 17.09.2026: vier Ordner gesetzt, einmal
    "Neuer Riesenschein" gedrueckt, alle vier weg.
  */
  /** @type {[string, string][]} */
  const umzuege = []

  const riesenscheine = ergebnis.gruppen.map((gruppe) => {
    const dabei = gruppe.scheinIds.map((id) => nachId.get(id)).filter(Boolean)
    const alt = alteNachId.get(gruppe.id) ?? alteNachSignatur.get(gruppe.signatur)
    if (alt && alt.id !== gruppe.id) umzuege.push([alt.id, gruppe.id])
    return {
      id: gruppe.id,
      projektId: stand.projekt?.id ?? '',
      name: alt?.name || schlageNamenVor(/** @type {any} */ (dabei)),
      signatur: gruppe.signatur,
      scheinIds: gruppe.scheinIds,
      notiz: alt?.notiz ?? '',
      angelegtAm: alt?.angelegtAm ?? jetzt(),
      geaendertAm: jetzt(),
    }
  })

  /*
    DIE LEERE HUELLE UEBERLEBT DAS NEUORDNEN.

    gruppiere() baut die Liste vollstaendig aus den Scheinen. Eine Gruppe ohne
    Scheine entsteht dabei nicht, sie kann gar nicht entstehen. Eine Huelle,
    die noch auf ihre Fotos wartet, waere also sofort wieder weg.

    Deshalb wird sie hier wieder eingesetzt, und zwar GANZ VORNE: sie ist das,
    woran gerade gearbeitet wird. Sobald der erste Schein hineinlaeuft, hat
    gruppiere() sie selbst gebaut (die Scheine tragen ihre gruppeId), und dann
    steht sie schon in der Liste und wird hier nicht noch einmal angehaengt.

    Die Signatur bleibt leer: eine Huelle ohne Scheine hat keine Wette, ueber
    die sich etwas sagen liesse. Nichts zu behaupten ist richtiger, als etwas
    zu erfinden (Projektregel 1).
  */
  if (stand.huelle && !riesenscheine.some((r) => r.id === stand.huelle?.id)) {
    const alteHuelle = alteNachId.get(stand.huelle.id)
    riesenscheine.unshift({
      id: stand.huelle.id,
      name: stand.huelle.name,
      signatur: '',
      scheinIds: [],
      notiz: alteHuelle?.notiz ?? '',
      angelegtAm: alteHuelle?.angelegtAm ?? jetzt(),
      geaendertAm: jetzt(),
    })
  }

  // Die Ordner auf die neuen Kennungen umziehen. Siehe oberflaeche/ordner.js,
  // wandere(): dort steht, was am 17.09.2026 dabei verloren ging.
  Ordner.wandere(umzuege, new Set(riesenscheine.map((r) => r.id)))

  // Die Zugehoerigkeit auch auf den Scheinen vermerken, damit sie beim Speichern
  // mitgeht und beim naechsten Laden erhalten bleibt.
  for (const riesenschein of riesenscheine) {
    for (const id of riesenschein.scheinIds) {
      const schein = nachId.get(id)
      if (schein) schein.gruppeId = riesenschein.id
    }
  }

  /*
    DIE AUSWAHL WIRD HIER NUR NOCH GEPRUEFT, NICHT MEHR GESETZT.

    Bis zum 17.09.2026 stand hier zweierlei, und beides ist seit den drei
    Ebenen falsch:

    1. "ist eine Huelle offen, ist sie die Auswahl". Die Huelle bleibt jetzt
       offen, bis der naechste Riesenschein aufgemacht wird (Karam am
       17.09.2026: "keine Huelle schliessen, nichts"). Mit der alten Zeile
       haette JEDES Neuordnen, also jede berichtigte Zahl, die Ansicht zurueck
       auf den zuletzt angelegten Riesenschein gerissen. Man haette mitten im
       Bearbeiten den Schein unter den Haenden gewechselt bekommen.

    2. "sonst der erste Riesenschein". Damit gaebe es die Uebersicht gar nicht:
       auswahl null IST die Uebersicht (Ebene 1), und jedes Neuordnen haette
       sie sofort wieder verlassen.

    Aufgemacht wird jetzt genau dort, wo jemand darauf drueckt. Hier wird nur
    noch aufgeraeumt, was ins Leere zeigt: das passiert nach jedem Neuordnen,
    weil sich die Kennung einer Gruppe mit ihrer Signatur aendert.
  */
  const auswahl =
    stand.auswahl && riesenscheine.some((r) => r.id === stand.auswahl) ? stand.auswahl : null
  const scheinNochDa =
    auswahl !== null &&
    stand.scheinAuswahl !== null &&
    (riesenscheine.find((r) => r.id === auswahl)?.scheinIds ?? []).includes(stand.scheinAuswahl)

  aendere({
    scheine: zusammengefuehrt.scheine,
    riesenscheine,
    restposten: ergebnis.restposten,
    verdacht: [...zusammengefuehrt.verdacht, ...ergebnis.vorschlaege.map(vorschlagAlsVerdacht)],
    auswahl,
    scheinAuswahl: scheinNochDa ? stand.scheinAuswahl : null,
  })
}

/**
 * @param {import('../kern/gruppierung.js').Zuordnungsvorschlag} vorschlag
 * @returns {import('../kern/gruppierung.js').Doppelfund}
 */
function vorschlagAlsVerdacht(vorschlag) {
  return {
    scheinId: vorschlag.scheinId,
    gleichWieScheinId: vorschlag.gruppeId,
    grund: `Koennte zu einem anderen Riesenschein gehoeren (${Math.round(vorschlag.punkte * 100)} Prozent Uebereinstimmung). ${vorschlag.gruende.join(' ')}`,
    sicherheit: vorschlag.punkte,
    sicher: false,
  }
}

/**
 * Die Scheine eines Riesenscheins, in der gespeicherten Reihenfolge.
 *
 * @param {string} riesenscheinId
 * @returns {import('../kern/typen.js').Schein[]}
 */
export function scheineVon(riesenscheinId) {
  const riesenschein = stand.riesenscheine.find((r) => r.id === riesenscheinId)
  if (!riesenschein) return []
  const nachId = new Map(stand.scheine.map((s) => [s.id, s]))
  return riesenschein.scheinIds
    .map((id) => nachId.get(id))
    .filter(/** @returns {s is import('../kern/typen.js').Schein} */ (s) => Boolean(s))
}

/**
 * Die Rechnung eines Riesenscheins.
 *
 * @param {string} riesenscheinId
 * @returns {import('../kern/typen.js').Rechnung}
 */
export function rechnungVon(riesenscheinId) {
  return rechne(scheineVon(riesenscheinId))
}

/**
 * Aendert ein einzelnes Feld eines Scheins von Hand.
 *
 * Von Hand gesetzte Werte bekommen die Herkunft 'hand' und werden dadurch
 * bei jeder spaeteren Verarbeitung in Ruhe gelassen.
 *
 * @param {string} scheinId
 * @param {string} feldname
 * @param {any} wert
 */
export function setzeFeld(scheinId, feldname, wert) {
  const scheine = stand.scheine.map((schein) => {
    if (schein.id !== scheinId) return schein
    const kopie = { ...schein, geaendertAm: jetzt(), vonHand: true }
    if (feldname === 'status') {
      kopie.status = wert
    } else if (feldname === 'gratiswette' || feldname === 'eachWay' || feldname === 'ausgeschlossen') {
      /** @type {any} */ (kopie)[feldname] = Boolean(wert)
    } else {
      /** @type {any} */ (kopie)[feldname] = {
        wert,
        sicherheit: 1,
        quelle: 'hand',
        roh: /** @type {any} */ (schein)[feldname]?.roh ?? '',
      }
    }
    return kopie
  })
  ordneNeu(scheine)
}

/**
 * Setzt den Ausgang fuer ALLE Scheine eines Riesenscheins auf einmal.
 *
 * Karam am 16.09.2026: "am Ende des Tages kann man bei jedem Riesenschein
 * einfach hinzufuegen, ob man das gewonnen oder verloren hat. Wenn man es
 * gewonnen hat, tut sich der gesamtmoegliche Gewinn zur Balance addieren. Wenn
 * man es verliert, ist das, was man eingesetzt hat, einfach verloren."
 *
 * HIER WIRD NICHTS GERECHNET. Gesetzt wird allein der Stand jedes Scheins,
 * genau wie wenn man ihn einzeln im Reiter Scheine umstellt. Was daraus an
 * Geld folgt, rechnet kern/rechnung.js wie bisher:
 *
 *   gewonnen   realisierterRueckfluss liefert die Auszahlung, entweder die vom
 *              Bild gelesene oder Einsatz mal Quote. Sie wandert in
 *              ergebnisRealisiert.
 *   verloren   realisierterRueckfluss liefert 0. Der Einsatz ist weg, es kommt
 *              nichts zurueck.
 *
 * Eine zweite Rechnung an dieser Stelle waere genau die Doppelung, vor der
 * Projektregel 8 warnt, und sie wuerde irgendwann von kern/rechnung.js
 * abweichen.
 *
 * WARUM NICHT EINFACH setzeFeld IN EINER SCHLEIFE: setzeFeld ruft am Ende
 * ordneNeu auf, und das gruppiert den gesamten Bestand neu. Bei sechzig
 * Scheinen waeren das sechzig vollstaendige Neugruppierungen fuer einen Klick.
 * Hier wird einmal gesetzt und einmal neu geordnet.
 *
 * Der Mensch entscheidet, nicht die Automatik: dafuer gibt es keinen
 * Pruefstein am Bild (Projektregel 1). Deshalb traegt jeder so gesetzte Schein
 * vonHand true, damit ein spaeterer Lesedurchgang ihn nicht ueberschreibt.
 *
 * @param {string} riesenscheinId
 * @param {import('../kern/typen.js').Status} status
 * @returns {number} Wie viele Scheine geaendert wurden.
 */
export function setzeAusgangFuerRiesenschein(riesenscheinId, status) {
  const gruppe = stand.riesenscheine.find((r) => r.id === riesenscheinId)
  if (!gruppe) return 0

  const gehoertDazu = new Set(gruppe.scheinIds)
  let geaendert = 0

  const scheine = stand.scheine.map((schein) => {
    if (!gehoertDazu.has(schein.id)) return schein
    if (schein.status === status) return schein
    geaendert += 1
    return { ...schein, status, geaendertAm: jetzt(), vonHand: true }
  })

  if (geaendert > 0) ordneNeu(scheine)
  return geaendert
}

/**
 * Verschiebt einen Schein in einen anderen Riesenschein.
 *
 * @param {string} scheinId
 * @param {string|null} zielId
 */
export function verschiebeSchein(scheinId, zielId) {
  const scheine = stand.scheine.map((s) =>
    s.id === scheinId ? { ...s, gruppeId: zielId, vonHand: true, geaendertAm: jetzt() } : s
  )
  ordneNeu(scheine)
}

/**
 * Benennt einen Riesenschein um.
 *
 * @param {string} id
 * @param {string} name
 */
export function benenneUm(id, name) {
  aendere({
    riesenscheine: stand.riesenscheine.map((r) =>
      r.id === id ? { ...r, name, geaendertAm: jetzt() } : r
    ),
  })
}

/**
 * Macht einen neuen, eigenen Riesenschein auf und legt diesen Schein hinein.
 *
 * WOZU: die Automatik fasst zusammen, was sie als dieselbe Wette erkennt. Wo
 * sie das nicht kann, weil zwei Anbieter dieselbe Wette verschieden schreiben,
 * entscheidet der Mensch (Projektregel 1). Er macht hier einen neuen
 * Riesenschein auf und zieht die uebrigen Scheine in der Spalte "Riesenschein"
 * hinein.
 *
 * Die Kennung wird SOFORT vergeben und am Schein vermerkt. Damit bildet
 * gruppiere() daraus eine Handgruppe, und Handgruppen werden nicht wieder
 * aufgebrochen.
 *
 * @param {string} scheinId
 * @returns {string|null} die Kennung des neuen Riesenscheins
 */
export function neuerRiesenschein(scheinId) {
  const schein = stand.scheine.find((s) => s.id === scheinId)
  if (!schein) return null

  const id = neueKennung()
  const scheine = stand.scheine.map((s) =>
    s.id === scheinId ? { ...s, gruppeId: id, vonHand: true, geaendertAm: jetzt() } : s
  )
  ordneNeu(scheine)
  melde('erfolg', 'Neuer Riesenschein aufgemacht. Weitere Scheine lassen sich jetzt hineinziehen.')
  return id
}

/**
 * Setzt die Notiz eines Riesenscheins.
 *
 * @param {string} id
 * @param {string} notiz
 */
export function setzeRiesenscheinNotiz(id, notiz) {
  aendere({
    riesenscheine: stand.riesenscheine.map((r) =>
      r.id === id ? { ...r, notiz: String(notiz ?? ''), geaendertAm: jetzt() } : r
    ),
  })
}

/**
 * Setzt die Notiz eines einzelnen Scheins.
 *
 * Eine Notiz ist KEIN Feld mit Herkunft und Sicherheit wie Einsatz oder Quote:
 * sie wird nie gelesen, nie gerechnet und nie gegengeprueft. Sie ist ein
 * schlichter Text am Schein. Deshalb laeuft sie nicht ueber setzeFeld und setzt
 * auch vonHand nicht: wer eine Bemerkung schreibt, hat damit keinen Wert von
 * Hand bestaetigt, und ein spaeteres Neulesen soll den Schein weiter berichtigen
 * duerfen.
 *
 * @param {string} scheinId
 * @param {string} notiz
 */
export function setzeScheinNotiz(scheinId, notiz) {
  aendere({
    scheine: stand.scheine.map((s) =>
      s.id === scheinId ? { ...s, notiz: String(notiz ?? ''), geaendertAm: jetzt() } : s
    ),
  })
}

/**
 * Entfernt einen einzelnen Schein.
 *
 * WOZU: Karam fotografiert in Mengen. Ein Ausschnitt trifft danebem, eine Karte
 * wird doppelt erfasst, ein Schein gehoert gar nicht in dieses Projekt. Ohne
 * einen Weg, genau diesen einen loszuwerden, bleibt nur "alles verwerfen".
 *
 * Der Riesenschein bleibt bestehen, auch wenn er dadurch leer wird: ordneNeu
 * baut die Gruppen aus den verbliebenen Scheinen neu, und Name und Notiz
 * ueberleben ueber die Kennung. Wer den letzten Schein einer Gruppe entfernt,
 * hat die Gruppe damit aufgeloest, und das ist dieselbe Entscheidung.
 *
 * @param {string} scheinId
 */
export function entferneSchein(scheinId) {
  const vorher = stand.scheine.length
  const scheine = stand.scheine.filter((s) => s.id !== scheinId)
  if (scheine.length === vorher) return
  ordneNeu(scheine)
}

/**
 * Entfernt ein Bild und alle Scheine, die daraus gelesen wurden.
 *
 * Beides gehoert zusammen: ein Schein ohne sein Bild laesst sich nie wieder
 * nachpruefen, und ein Bild ohne seine Scheine erzeugt beim naechsten Lesen
 * Doppelgaenger. Wie viele Scheine mitgehen, gibt die Funktion zurueck, damit
 * die Ansicht vorher fragen kann.
 *
 * @param {string} bildId
 * @returns {number} wie viele Scheine mit entfernt wurden
 */
export function entferneBild(bildId) {
  const bilder = new Map(stand.bilder)
  if (!bilder.delete(bildId)) return 0

  const betroffen = stand.scheine.filter((s) => s.bildId === bildId)
  aendere({ bilder })
  if (betroffen.length > 0) {
    ordneNeu(stand.scheine.filter((s) => s.bildId !== bildId))
  }
  return betroffen.length
}

/**
 * Aendert die Reihenfolge der Scheine in einem Riesenschein.
 *
 * @param {string} id
 * @param {string[]} reihenfolge
 */
export function setzeReihenfolge(id, reihenfolge) {
  aendere({
    riesenscheine: stand.riesenscheine.map((r) =>
      r.id === id ? { ...r, scheinIds: reihenfolge, geaendertAm: jetzt() } : r
    ),
  })
}
