// @ts-check
/**
 * Zahlen aus Texterkennung robust lesen.
 *
 * Reine Logik. Keine Anzeige, keine Farben, keine Rundung fuer die Optik.
 * Diese Datei ist die einzige Stelle, an der aus Text eine Zahl wird.
 */

/**
 * Zeichen, die die Texterkennung haeufig mit Ziffern verwechselt.
 * Wird NUR angewendet, wenn der Baustein ohnehin schon ueberwiegend aus Ziffern besteht.
 * Blind angewendet wuerde daraus aus jedem Wort eine Zahl.
 */
const ZIFFERNERSATZ = new Map([
  ['O', '0'], ['o', '0'], ['Q', '0'], ['D', '0'],
  ['l', '1'], ['I', '1'], ['|', '1'], ['i', '1'], ['!', '1'],
  ['Z', '2'], ['z', '2'],
  ['E', '3'],
  ['A', '4'], ['h', '4'],
  ['S', '5'], ['s', '5'],
  ['G', '6'], ['b', '6'],
  ['T', '7'],
  ['B', '8'],
  ['g', '9'], ['q', '9'],
])

/** Alle Zeichen, die als Minus durchgehen. Die Texterkennung liefert hier vieles. */
const MINUSZEICHEN = /[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212~_\u00AD]/g

/**
 * Die Zeichen, die als verlesene Ziffer gelten, als Zeichenkette.
 *
 * WOZU EXPORTIERT: kern/parser.js sucht Zahlen in einem Textabschnitt und
 * braucht dieselbe Liste. Sie stand dort ein zweites Mal, und die zweite war
 * kuerzer: T, Q, D, E, A, h und der senkrechte Strich fehlten. Aus "2QQ" wurde
 * deshalb 2 statt 200, waehrend leseZahl daraus richtig 200 macht.
 *
 * Projektregel 8: Logik lebt an genau einer Stelle. Das hier ist die Stelle.
 */
export const ZIFFERNZEICHEN = [...ZIFFERNERSATZ.keys()].join('')

/**
 * Alles, was wie ein Minus aussieht, als Inhalt einer Zeichenklasse.
 *
 * Ebenfalls exportiert, weil der Parser das Vorzeichen der amerikanischen
 * Quote deuten muss. Dort standen nur vier dieser Zeichen, und bei einem
 * anderen Strich kippte das Vorzeichen: aus der Quote 1,64 wurde 2,57. Das
 * Vorzeichen entscheidet ueber die halbe Rechnung.
 */
// Der Bindestrich steht ABSICHTLICH als \- da. Unmaskiert waere "[+-‐]"
// ein BEREICH von U+002B bis U+2010, und der enthaelt alle Ziffern und
// Buchstaben. Genau das ist beim Einbauen passiert: "157" galt ploetzlich als
// Zahl mit Vorzeichen.
export const MINUS_KLASSE = '\\-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212~_\\u00AD'

/**
 * Macht eine Zeichenkette fuer eine Zeichenklasse sicher.
 *
 * @param {string} zeichen
 */
export function alsKlasse(zeichen) {
  return zeichen.replace(/[\\\]^-]/g, (c) => '\\' + c)
}

/** Zeichen, die als Tausendertrenner vorkommen (Schweiz, Frankreich, schmales Leerzeichen). */
const TAUSENDERRAUM = /['\u00A0\u2009\u202F\u2019 ]/g

/** Zeichen, die als Luecke zwischen Ziffergruppen auftreten koennen. */
const LUECKENZEICHEN = /[    ']/

/** Ein Baustein, der nur aus Ziffergruppen mit Luecken besteht. */
const NUR_ZIFFERNGRUPPEN = /^[0-9]+(?:[    '][0-9]+)+$/


/**
 * Ergebnis eines Leseversuchs.
 * @typedef {object} Zahlenfund
 * @property {number|null} wert   Der gelesene Wert, null wenn nicht lesbar.
 * @property {boolean} mehrdeutig true, wenn die Trennzeichen nicht eindeutig waren.
 * @property {boolean} ersetzt    true, wenn Zeichen als Ziffern gedeutet wurden.
 * @property {string} bereinigt   Die Zeichenkette nach der Saeuberung.
 * @property {string} roh         Der Ausgangstext.
 * @property {string} grund       Leer bei Erfolg, sonst der Grund des Scheiterns.
 */

/** Zeichen, die innerhalb einer Zahl stehen duerfen, ohne selbst Ziffer zu sein. */
const ZAHLENBEIWERK = new Set(['.', ',', '+', '-', "'", ' ', ' ', ' ', ' ', '\u2019'])

/**
 * Deutet verwechselte Zeichen als Ziffern, aber nur dort, wo es sicher ist.
 *
 * Die Regel arbeitet je Baustein, also je Wort zwischen zwei Leerzeichen, und lautet:
 *   1. Der Baustein muss mindestens eine echte Ziffer enthalten.
 *      Ohne Ziffer ist es ein Wort, kein verlesener Betrag.
 *   2. JEDES uebrige Zeichen muss entweder Zahlenbeiwerk sein oder in der Ersatzliste stehen.
 *      Schon ein einziges fremdes Zeichen laesst den Baustein unangetastet.
 *
 * Damit wird aus "l8l" die Zahl 181, aus "Stake" aber niemals eine Zahl,
 * weil t und k in keiner Ersatzliste stehen.
 *
 * @param {string} text
 * @returns {{text: string, ersetzt: boolean}}
 */
export function ziffernRetten(text) {
  let ersetzt = false
  const teile = text.split(/(\s+)/)
  const heraus = teile.map((teil) => {
    if (teil === '' || /^\s+$/.test(teil)) return teil
    const fund = rettenEinenBaustein(teil)
    if (fund.ersetzt) ersetzt = true
    return fund.text
  })
  return { text: heraus.join(''), ersetzt }
}

/**
 * @param {string} teil
 * @returns {{text: string, ersetzt: boolean}}
 */
function rettenEinenBaustein(teil) {
  if (!/[0-9]/.test(teil)) return { text: teil, ersetzt: false }

  let ersetzt = false
  let heraus = ''
  for (const zeichen of teil) {
    if (zeichen >= '0' && zeichen <= '9') {
      heraus += zeichen
      continue
    }
    if (ZAHLENBEIWERK.has(zeichen)) {
      heraus += zeichen
      continue
    }
    const ziel = ZIFFERNERSATZ.get(zeichen)
    if (ziel === undefined) {
      // Ein fremdes Zeichen: der Baustein bleibt, wie er ist.
      return { text: teil, ersetzt: false }
    }
    heraus += ziel
    ersetzt = true
  }
  return { text: heraus, ersetzt }
}

/**
 * Liest eine Dezimalzahl aus einem Textstueck.
 *
 * Regeln fuer die Trennzeichen, in dieser Reihenfolge:
 *  1. Kommen Punkt und Komma beide vor, ist das letzte Vorkommen das Dezimaltrennzeichen.
 *  2. Kommt dasselbe Trennzeichen mehrfach vor, entscheiden die Gruppenlaengen:
 *     lauter Dreiergruppen heisst Tausendertrennung, eine kuerzere Gruppe am
 *     Ende heisst, dass das LETZTE Zeichen der Dezimaltrenner war. Passt
 *     keines von beiden, gilt die Zahl als mehrdeutig. Frueher galt hier
 *     immer Tausendertrennung, und aus "1,000,00" wurde 100000.
 *  3. Kommt genau ein Trennzeichen vor und stehen danach 1 oder 2 Ziffern,
 *     ist es das Dezimaltrennzeichen.
 *  4. Kommt genau ein Trennzeichen vor und stehen danach genau 3 Ziffern, ist der Fall
 *     mehrdeutig. Dann entscheidet der Gebietshinweis. Ohne Hinweis wird als Tausendertrenner
 *     gelesen und der Fund als mehrdeutig gekennzeichnet, damit er sichtbar bleibt.
 *  5. Stehen danach mehr als 3 Ziffern, ist es das Dezimaltrennzeichen.
 *
 * @param {string} roh
 * @param {object} [einstellungen]
 * @param {'de'|'en'|null} [einstellungen.gebiet]
 *        Schreibweise des Gebiets, entscheidet den mehrdeutigen Fall mit drei Nachkommastellen.
 * @param {boolean} [einstellungen.ziffernRetten]
 *        Vorgabe true. Auf false setzen, wenn der Text sicher sauber ist.
 * @param {boolean} [einstellungen.waehrungBekannt]
 *        Auf true setzen, wenn fuer diese Karte bereits eine Waehrung erkannt wurde.
 *        Dann wird ein fuehrendes S vor Ziffern als verlesenes Waehrungszeichen entfernt,
 *        statt es als Fuenf zu lesen.
 * @returns {Zahlenfund}
 */
export function leseZahl(roh, einstellungen = {}) {
  const gebiet = einstellungen.gebiet ?? null
  const rettenErlaubt = einstellungen.ziffernRetten !== false
  const waehrungBekannt = einstellungen.waehrungBekannt === true

  const leer = {
    wert: /** @type {number|null} */ (null),
    mehrdeutig: false,
    ersetzt: false,
    bereinigt: '',
    roh: typeof roh === 'string' ? roh : String(roh),
    grund: '',
  }
  if (typeof roh !== 'string' || roh.trim() === '') {
    return { ...leer, grund: 'leer' }
  }

  let text = roh.normalize('NFKC').trim()

  // Bei der ersten Spaltengrenze ist Schluss.
  //
  // EIN Leerzeichen kann ein Tausendertrenner sein, "1 234,56" gibt es
  // wirklich. ZWEI oder mehr sind eine Spaltengrenze: keine Sprache trennt
  // Tausender mit zwei Leerzeichen.
  //
  // Ohne diese Zeile wurde aus der Betway-Fusszeile "78,30     136,24" der
  // Betrag 783.013.624 und aus bet365 "250,00      450,00" die Zahl
  // 2.500.045.000. Am 14.09.2026 an nachgebauten Ansichten von Karams
  // Anbietern gemessen, zwei von fuenf waren betroffen.
  // Siehe test/spalten.test.mjs.
  text = text.split(/\s{2,}/)[0] ?? ''

  // Waehrungskuerzel und Waehrungszeichen entfernen, bevor Ziffern gerettet werden.
  // Sonst wuerde aus dem Dollarzeichen eine Fuenf.
  text = text.replace(/US\$|\bUSD\b|\bEUR\b|\bGBP\b|\bCHF\b|Fr\.|[$€£]/gi, ' ')

  // Nur wenn die Waehrung der Karte schon feststeht: ein einzelnes S unmittelbar vor
  // Ziffern ist dann mit hoher Wahrscheinlichkeit ein verlesenes Dollarzeichen.
  // Ohne diesen Hinweis bleibt das S stehen und wird spaeter als Fuenf gelesen,
  // was die Gegenrechnung sofort auffallen laesst.
  if (waehrungBekannt) {
    text = text.replace(/(^|\s)[Ss§](?=[0-9])/g, '$1')
  }

  // Klammern um negative Betraege, wie in der Buchhaltung ueblich.
  let klammerNegativ = false
  const klammer = text.match(/^\s*\(\s*(.+?)\s*\)\s*$/)
  if (klammer && klammer[1] !== undefined) {
    klammerNegativ = true
    text = klammer[1]
  }

  text = text.replace(MINUSZEICHEN, '-')

  let vorzeichen = 1
  const zeichenTreffer = text.match(/^\s*([+-])/)
  if (zeichenTreffer && zeichenTreffer[1] === '-') vorzeichen = -1
  text = text.replace(/^\s*[+-]\s*/, '')

  let ersetzt = false
  if (rettenErlaubt) {
    const gerettet = ziffernRetten(text)
    text = gerettet.text
    ersetzt = gerettet.ersetzt
  }

  // Eine Luecke zwischen Ziffern ist entweder ein Tausendertrenner oder ein
  // verschlucktes Dezimaltrennzeichen.
  //
  // Das laesst sich ENTSCHEIDEN, nicht nur raten: eine Tausendergruppe hat in
  // jeder Sprache immer genau drei Ziffern. "1 234 567" ist eine Million.
  // "296 84" dagegen kann nirgendwo 29684 heissen, weil keine Sprache
  // zweistellige Tausendergruppen kennt. Dort wurde ein Punkt verschluckt.
  //
  // Warum das wichtig ist: die Texterkennung verliert den Punkt vor den Cent
  // regelmaessig, und aus 296.84 wird dann 29684. Ein Fehler um den Faktor
  // hundert, der sich in Einsatz UND Auszahlung gleichzeitig einschleichen und
  // dadurch rechnerisch stimmig bleiben kann. Beobachtet an einem echten Bild
  // am 13.09.2026.
  //
  // Angewendet wird die Regel nur, wenn der ganze Baustein aus Ziffergruppen
  // mit Luecken besteht. Steht noch etwas anderes darin, ist die Zuordnung der
  // Luecken nicht sicher, und dann wird nichts entschieden.
  const gruppentext = text.trim()
  if (NUR_ZIFFERNGRUPPEN.test(gruppentext)) {
    const gruppen = gruppentext.split(LUECKENZEICHEN)
    const hintere = gruppen.slice(1)
    const erste = gruppen[0] ?? ''
    const letzte = hintere[hintere.length - 1] ?? ''

    const vordere = hintere.slice(0, -1)

    if (hintere.every((g) => g.length === 3)) {
      // Lauter Dreiergruppen: echte Tausendertrennung.
      text = gruppen.join('')
    } else if (vordere.length > 0 && vordere.every((g) => g.length === 3) &&
               letzte.length >= 1 && letzte.length <= 2) {
      // Dreiergruppen und am Ende eine kuerzere: die vorderen Luecken trennen
      // Tausender, die letzte war der Dezimalpunkt. So wird aus "5 000 00"
      // richtig 5000.00 und nicht 500000.
      text = [erste, ...vordere].join('') + '.' + letzte
    } else if (hintere.length === 1 && letzte.length <= 2 && letzte.length >= 1) {
      // Genau eine Luecke, danach hoechstens zwei Ziffern: das war der
      // Dezimalpunkt. Bei mehreren Luecken mit unpassenden Gruppen waere die
      // Zuordnung geraten, und dann bleibt der Text lieber ungewoehnlich
      // stehen als still falsch gelesen zu werden.
      text = `${erste}.${letzte}`
    }
  }

  // Abgeschnittene Betraege: das Auslassungszeichen am Ende faellt weg.
  //
  // Stake zeigt Kryptobetraege mit acht Nachkommastellen und schneidet sie in
  // der Anzeige ab: "5,000.000000...". Ohne diese Zeile bleiben die drei
  // Punkte stehen, gelten als Trennzeichen, und die Ziffern werden
  // zusammengeschoben: aus 5.000 wurden 5.000.000.000. Faktor eine Million,
  // ohne jede Warnung. Am 13.09.2026 an Karams echten Fotos gefunden.
  //
  // Weggeschnitten wird NUR am Ende, und nur zwei Punkte oder mehr. Ein
  // einzelner Punkt am Ende ist ein Satzzeichen oder ein Trennzeichen und wird
  // weiter unten behandelt. Mitten in der Zahl wird nichts angefasst.
  text = text.replace(/(?:\.{2,}|…)\s*$/, '')

  // Tausenderraeume entfernen (Apostroph, geschuetztes Leerzeichen, schmales Leerzeichen).
  text = text.replace(TAUSENDERRAUM, '')

  // Alles ausser Ziffern, Punkt und Komma faellt weg.
  const bereinigt = text.replace(/[^0-9.,]/g, '')
  if (bereinigt === '' || !/[0-9]/.test(bereinigt)) {
    return { ...leer, bereinigt, ersetzt, grund: 'keine ziffern' }
  }

  const punkte = (bereinigt.match(/\./g) || []).length
  const kommas = (bereinigt.match(/,/g) || []).length

  /** @type {string|null} */
  let dezimaltrenner = null
  let mehrdeutig = false

  if (punkte > 0 && kommas > 0) {
    dezimaltrenner = bereinigt.lastIndexOf('.') > bereinigt.lastIndexOf(',') ? '.' : ','
  } else if (punkte > 1 || kommas > 1) {
    // Dasselbe Zeichen mehrfach. Frueher hiess das immer Tausendertrennung,
    // und aus "1,000,00" wurde 100000. Der Faktor hundert.
    //
    // Die Gegenregel ist dieselbe wie bei den verschluckten Punkten weiter
    // oben und ebenso beweisbar: eine Tausendergruppe hat in JEDER Sprache
    // genau drei Ziffern. Steht am Ende eine Gruppe mit ein oder zwei
    // Ziffern, kann das keine Tausendergruppe sein, also war das letzte
    // Zeichen der Dezimaltrenner.
    //
    // Passt weder das eine noch das andere, wird NICHT geraten: dann gilt die
    // Zahl als mehrdeutig, und der Hinweis macht den Fall sichtbar.
    const trenner = punkte > 1 ? '.' : ','
    const gruppen = bereinigt.split(trenner)
    const hintere = gruppen.slice(1)
    const letzte = hintere[hintere.length - 1] ?? ''
    const vordere = hintere.slice(0, -1)

    if (hintere.every((g) => g.length === 3)) {
      dezimaltrenner = null
    } else if (
      vordere.length > 0 &&
      vordere.every((g) => g.length === 3) &&
      letzte.length >= 1 &&
      letzte.length <= 2
    ) {
      dezimaltrenner = trenner
    } else {
      dezimaltrenner = null
      mehrdeutig = true
    }
  } else if (punkte === 1 || kommas === 1) {
    const trenner = punkte === 1 ? '.' : ','
    const stelle = bereinigt.indexOf(trenner)
    const danach = bereinigt.length - stelle - 1
    const davor = stelle
    if (danach === 3 && davor >= 1) {
      if (gebiet === 'de') {
        // Im deutschen Raum trennt der Punkt Tausender, das Komma trennt Dezimalstellen.
        dezimaltrenner = trenner === ',' ? ',' : null
      } else if (gebiet === 'en') {
        dezimaltrenner = trenner === '.' ? '.' : null
      } else {
        dezimaltrenner = null
        mehrdeutig = true
      }
    } else if (danach === 0) {
      dezimaltrenner = null
    } else {
      dezimaltrenner = trenner
    }
  }

  let ziffernText
  if (dezimaltrenner === null) {
    ziffernText = bereinigt.replace(/[.,]/g, '')
  } else {
    const anderer = dezimaltrenner === '.' ? ',' : '.'
    const ohneAndere = bereinigt.split(anderer).join('')
    const stelle = ohneAndere.lastIndexOf(dezimaltrenner)
    // Vor der letzten Fundstelle koennen weitere gleiche Zeichen stehen, wenn
    // die Texterkennung den Punkt vor den Cent als Komma gelesen hat:
    // "1,000,00". Die davor sind dann Tausendertrenner und fallen weg. Ohne
    // das entstuende "1,000.00", und daraus wird beim Rechnen NaN.
    const vorne = ohneAndere.slice(0, stelle).split(dezimaltrenner).join('')
    ziffernText = vorne + '.' + ohneAndere.slice(stelle + 1)
  }

  const wert = Number(ziffernText)
  if (!Number.isFinite(wert)) {
    return { ...leer, bereinigt, ersetzt, grund: 'nicht rechenbar' }
  }

  const endgueltig = wert * vorzeichen * (klammerNegativ ? -1 : 1)
  return { wert: endgueltig, mehrdeutig, ersetzt, bereinigt, roh, grund: '' }
}

/**
 * Liest eine amerikanische Quote. Sie hat immer ein Vorzeichen und mindestens dreistelligen Betrag.
 *
 * Fehlt das Vorzeichen, wird der Betrag zurueckgegeben und der Fund als mehrdeutig markiert.
 * Das Vorzeichen entscheidet ueber Favorit oder Aussenseiter und damit ueber die halbe Rechnung,
 * deshalb wird es nie stillschweigend geraten.
 *
 * @param {string} roh
 * @returns {Zahlenfund}
 */
export function leseAmerikanischeQuote(roh) {
  if (typeof roh !== 'string') {
    return {
      wert: null, mehrdeutig: false, ersetzt: false,
      bereinigt: '', roh: String(roh), grund: 'leer',
    }
  }
  const text = roh.normalize('NFKC').replace(MINUSZEICHEN, '-').trim()
  const hatMinus = /-\s*\d/.test(text)
  const hatPlus = /\+\s*\d/.test(text)

  const fund = leseZahl(text.replace(/[+-]/g, ''), { gebiet: 'en' })
  if (fund.wert === null) return fund

  const betrag = Math.abs(fund.wert)
  if (betrag < 100) {
    return { ...fund, wert: null, grund: 'amerikanische quote unter 100' }
  }
  if (hatMinus && !hatPlus) return { ...fund, wert: -betrag }
  if (hatPlus && !hatMinus) return { ...fund, wert: betrag }
  return { ...fund, wert: betrag, mehrdeutig: true }
}

/**
 * Erkennt die Waehrung in einem Textstueck.
 *
 * @param {string} text
 * @returns {'USD'|'EUR'|'GBP'|'CHF'|'UNBEKANNT'}
 */
export function erkenneWaehrung(text) {
  if (typeof text !== 'string') return 'UNBEKANNT'
  const t = text.normalize('NFKC')
  if (/US\$|\$|\bUSD\b/i.test(t)) return 'USD'
  if (/€|\bEUR\b/i.test(t)) return 'EUR'
  if (/£|\bGBP\b/i.test(t)) return 'GBP'
  if (/\bCHF\b|Fr\./i.test(t)) return 'CHF'
  return 'UNBEKANNT'
}

/**
 * Rundet kaufmaennisch auf eine feste Anzahl Nachkommastellen.
 *
 * Der winzige Zuschlag faengt Faelle wie 1.005 ab, die binaer knapp unter dem Wert liegen
 * und sonst falsch abgerundet wuerden.
 *
 * @param {number} wert
 * @param {number} [stellen]
 * @returns {number}
 */
export function runde(wert, stellen = 2) {
  if (!Number.isFinite(wert)) return NaN
  const faktor = Math.pow(10, stellen)
  const vorzeichen = wert < 0 ? -1 : 1
  const angehoben = Math.abs(wert) * faktor * (1 + Number.EPSILON * 4)
  return (vorzeichen * Math.round(angehoben)) / faktor
}
