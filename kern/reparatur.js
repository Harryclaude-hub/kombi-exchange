// @ts-check
/**
 * Verlesene Ziffern anhand der Rechnung berichtigen.
 *
 * Der Gedanke: auf einem Wettschein stehen drei Zahlen, die zusammenpassen muessen.
 * Einsatz mal Quote ergibt die Auszahlung. Wenn die Texterkennung eine Ziffer
 * verliest, passt die Rechnung nicht mehr. Dann laesst sich ausrechnen, welche
 * Ziffer es gewesen sein muss.
 *
 * Beispiel aus dem Betrieb: gelesen wurde Einsatz 200, Auszahlung 402, Quote -157.
 * Daraus ergaebe sich Quote 2.01, die angezeigte -157 bedeutet aber 1.64.
 * Probiert man die ueblichen Verwechslungen durch, passt genau eine Kombination:
 * Einsatz 300 und Auszahlung 492. Und zwar als einzige.
 *
 * Zwei Regeln machen das sicher:
 *   1. Es werden nur Ziffern getauscht, die eine Texterkennung wirklich verwechselt.
 *      Aus einer 2 kann eine 3 werden, aus einer 1 keine 6.
 *   2. Berichtigt wird nur, wenn es GENAU EINE Loesung gibt. Gibt es mehrere,
 *      bleibt der Widerspruch stehen und der Nutzer entscheidet. Eine geratene
 *      Berichtigung waere schlimmer als eine sichtbare Warnung.
 *
 * Reine Logik. Keine Anzeige.
 */

import { passtZuAnzeige, nahBei } from './quoten.js'
import { runde } from './zahlen.js'

/**
 * Ziffern, die eine Texterkennung wirklich miteinander verwechselt.
 * Die Liste ist bewusst kurz. Jedes zusaetzliche Paar vergroessert die Gefahr,
 * dass zufaellig mehrere Kombinationen passen und gar nichts mehr berichtigt wird.
 */
const VERWECHSLUNGEN = {
  0: ['8', '6', '9'],
  1: ['7', '4'],
  2: ['3', '7'],
  3: ['8', '2', '9'],
  4: ['9', '1'],
  5: ['6', '8', '3'],
  6: ['8', '5', '0'],
  7: ['1', '2'],
  8: ['6', '3', '0', '5'],
  9: ['4', '0', '3', '8'],
}

/** Mehr Kombinationen werden nicht durchprobiert. Schuetzt vor langen Rechnungen. */
const HOECHSTENS_VARIANTEN = 400

/**
 * Erzeugt alle Schreibweisen einer Zahl mit hoechstens so vielen Ziffertauschen.
 *
 * @param {number} wert
 * @param {number} hoechstens
 * @returns {{wert: number, aenderungen: number}[]}
 */
export function ziffernvarianten(wert, hoechstens = 1) {
  if (!Number.isFinite(wert) || wert < 0) return []

  // Die Zahl wird als Ziffernfolge behandelt, die Stelle des Kommas bleibt.
  const text = String(runde(wert, 2))
  const stellen = [...text]
  const ziffernStellen = []
  for (let i = 0; i < stellen.length; i++) {
    const z = stellen[i]
    if (z !== undefined && z >= '0' && z <= '9') ziffernStellen.push(i)
  }
  if (ziffernStellen.length === 0) return []

  /** @type {Map<string, number>} */
  const gefunden = new Map([[text, 0]])
  let rand = [{ stellen: [...stellen], aenderungen: 0 }]

  for (let runde_ = 0; runde_ < hoechstens; runde_++) {
    /** @type {{stellen: string[], aenderungen: number}[]} */
    const naechste = []
    for (const eintrag of rand) {
      for (const i of ziffernStellen) {
        const alt = eintrag.stellen[i]
        if (alt === undefined) continue
        for (const neu of VERWECHSLUNGEN[/** @type {keyof typeof VERWECHSLUNGEN} */ (alt)] ?? []) {
          const kopie = [...eintrag.stellen]
          kopie[i] = neu
          const geschrieben = kopie.join('')
          // Fuehrende Null waere eine andere Zahl, keine Verwechslung.
          if (geschrieben.startsWith('0') && geschrieben.length > 1 && geschrieben[1] !== '.') continue
          const bisher = gefunden.get(geschrieben)
          if (bisher !== undefined && bisher <= eintrag.aenderungen + 1) continue
          gefunden.set(geschrieben, eintrag.aenderungen + 1)
          naechste.push({ stellen: kopie, aenderungen: eintrag.aenderungen + 1 })
          if (gefunden.size > HOECHSTENS_VARIANTEN) break
        }
        if (gefunden.size > HOECHSTENS_VARIANTEN) break
      }
      if (gefunden.size > HOECHSTENS_VARIANTEN) break
    }
    rand = naechste
    if (gefunden.size > HOECHSTENS_VARIANTEN) break
  }

  /** @type {{wert: number, aenderungen: number}[]} */
  const heraus = []
  for (const [geschrieben, aenderungen] of gefunden) {
    const zahl = Number(geschrieben)
    if (Number.isFinite(zahl) && zahl > 0) heraus.push({ wert: zahl, aenderungen })
  }
  return heraus.sort((a, b) => a.aenderungen - b.aenderungen)
}

/**
 * Schreibweisen derselben Zahl mit verschobenem Komma.
 *
 * WARUM DAS NOETIG IST
 *
 * Bei echten Bildschirmfotos verschluckt die Texterkennung regelmaessig den
 * Dezimalpunkt. Aus "296.84" wird "296 84", und daraus liest das Programm
 * 29684. Ein Fehler um den Faktor hundert, und zwar einer, der NICHT auffaellt,
 * weil er in Einsatz, Quote und Auszahlung gleichzeitig passieren kann und die
 * Rechnung dann in sich stimmig bleibt.
 *
 * WARUM NICHT FRUEHER REPARIEREN
 *
 * Beim Zahlenlesen selbst darf man das nicht: im Franzoesischen ist das
 * Leerzeichen ein echtes Tausendertrennzeichen, "296 84" koennte also gewollt
 * 29684 heissen. Ohne Prüfstein waere jede Entscheidung geraten.
 *
 * An dieser Stelle gibt es den Prüfstein: Einsatz mal Quote muss die Auszahlung
 * ergeben, und die angezeigte Quote sagt, welche es sein muss.
 *
 * Probiert werden nur die Verschiebungen, die wirklich vorkommen: zwei Stellen
 * (verschluckter Punkt vor den Cent) und eine Stelle. In beide Richtungen, denn
 * die Texterkennung setzt auch mal einen Punkt zu viel.
 *
 * @param {number} wert
 * @returns {{wert: number, aenderungen: number}[]}
 */
export function kommavarianten(wert) {
  if (!Number.isFinite(wert) || wert <= 0) return []

  /** @type {{wert: number, aenderungen: number}[]} */
  const heraus = []
  for (const faktor of [100, 10, 0.1, 0.01]) {
    const neu = runde(wert / faktor, 2)
    if (!Number.isFinite(neu) || neu <= 0) continue
    // Muss sich wirklich unterscheiden und darf nicht in Centbruchteile laufen.
    if (Math.abs(neu - wert) < 0.005) continue
    if (Math.abs(runde(neu, 2) - neu) > 1e-9) continue
    heraus.push({ wert: neu, aenderungen: 1 })
  }
  return heraus
}

/**
 * @typedef {object} Reparatur
 * @property {boolean} gelungen
 * @property {number|null} einsatz
 * @property {number|null} auszahlung
 * @property {number} aenderungen     Wie viele Ziffern getauscht wurden.
 * @property {number} loesungen       Wie viele Kombinationen gepasst haetten.
 * @property {string} begruendung
 */

/**
 * Versucht, Einsatz und Auszahlung so zu berichtigen, dass sie zur angezeigten
 * amerikanischen Quote passen.
 *
 * @param {object} eingabe
 * @param {number|null} eingabe.einsatz
 * @param {number|null} eingabe.auszahlung
 * @param {number|null} eingabe.amerikanisch
 * @param {number} [eingabe.hoechstensJeZahl]  Ziffertausche je Zahl, Vorgabe 1.
 * @returns {Reparatur}
 */
export function repariereBetraege(eingabe) {
  const leer = {
    gelungen: false,
    einsatz: eingabe.einsatz,
    auszahlung: eingabe.auszahlung,
    aenderungen: 0,
    loesungen: 0,
    begruendung: '',
  }

  const { einsatz, auszahlung, amerikanisch } = eingabe
  if (einsatz === null || auszahlung === null || amerikanisch === null) {
    return { ...leer, begruendung: 'Es fehlt eine der drei Zahlen.' }
  }
  if (!Number.isFinite(einsatz) || !Number.isFinite(auszahlung) || einsatz <= 0) {
    return { ...leer, begruendung: 'Eine der Zahlen ist unbrauchbar.' }
  }

  // Passt es schon, ist nichts zu tun.
  if (passtZuAnzeige(auszahlung / einsatz, amerikanisch)) {
    return { ...leer, gelungen: false, begruendung: 'Die Zahlen passen bereits zusammen.' }
  }

  const hoechstens = eingabe.hoechstensJeZahl ?? 1
  // Kandidaten sind: der gelesene Wert, Ziffernverwechslungen und ein
  // verschobenes Komma. Das Komma zuerst, weil ein verschlucktes Komma bei
  // echten Bildern haeufiger ist als eine verlesene Ziffer und den groesseren
  // Schaden anrichtet.
  const einsatzVarianten = [
    { wert: einsatz, aenderungen: 0 },
    ...kommavarianten(einsatz),
    ...ziffernvarianten(einsatz, hoechstens),
  ]
  const auszahlungVarianten = [
    { wert: auszahlung, aenderungen: 0 },
    ...kommavarianten(auszahlung),
    ...ziffernvarianten(auszahlung, hoechstens),
  ]

  /** @type {{einsatz: number, auszahlung: number, aenderungen: number}[]} */
  const loesungen = []
  for (const e of einsatzVarianten) {
    for (const a of auszahlungVarianten) {
      if (e.aenderungen + a.aenderungen === 0) continue
      if (a.wert <= e.wert) continue
      if (!passtZuAnzeige(a.wert / e.wert, amerikanisch)) continue
      loesungen.push({ einsatz: e.wert, auszahlung: a.wert, aenderungen: e.aenderungen + a.aenderungen })
    }
  }

  if (loesungen.length === 0) {
    return {
      ...leer,
      begruendung:
        'Keine der ueblichen Ziffernverwechslungen bringt die Zahlen zur Deckung. ' +
        'Vermutlich stimmt etwas anderes nicht, etwa eine Gratiswette oder eine vorzeitige Auszahlung.',
    }
  }

  // Nur die sparsamsten Loesungen zaehlen.
  const wenigste = Math.min(...loesungen.map((l) => l.aenderungen))
  const beste = loesungen.filter((l) => l.aenderungen === wenigste)

  // Loesungen, die auf dieselben Betraege hinauslaufen, sind eine Loesung.
  /** @type {Map<string, {einsatz: number, auszahlung: number, aenderungen: number}>} */
  const eindeutig = new Map()
  for (const l of beste) eindeutig.set(`${l.einsatz}|${l.auszahlung}`, l)

  if (eindeutig.size > 1) {
    return {
      ...leer,
      loesungen: eindeutig.size,
      begruendung:
        `Es gibt ${eindeutig.size} Moeglichkeiten, die Zahlen passend zu machen. ` +
        'Weil nicht eindeutig ist welche stimmt, wird nichts geaendert. Bitte selbst nachsehen.',
    }
  }

  const loesung = [...eindeutig.values()][0]
  if (!loesung) return { ...leer, begruendung: 'Keine Loesung.' }

  const einsatzGeaendert = !nahBei(loesung.einsatz, einsatz, 0.005, 0)
  const auszahlungGeaendert = !nahBei(loesung.auszahlung, auszahlung, 0.005, 0)
  const teile = []
  if (einsatzGeaendert) teile.push(`Einsatz ${einsatz} zu ${loesung.einsatz}`)
  if (auszahlungGeaendert) teile.push(`Auszahlung ${auszahlung} zu ${loesung.auszahlung}`)

  return {
    gelungen: true,
    einsatz: loesung.einsatz,
    auszahlung: loesung.auszahlung,
    aenderungen: loesung.aenderungen,
    loesungen: 1,
    begruendung:
      `${teile.join(' und ')} berichtigt. Nur diese eine Kombination passt zur ` +
      `angezeigten Quote ${amerikanisch}.`,
  }
}
