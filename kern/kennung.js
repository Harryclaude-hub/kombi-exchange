// @ts-check
/**
 * Wettkennung und Aehnlichkeit.
 *
 * Zwei Scheine gehoeren zum selben Riesenschein, wenn sie dieselbe Wette tragen.
 * Der Haken: verschiedene Buchmacher schreiben dieselbe Wette verschieden.
 * "San Francisco 49ers @ Los Angeles Rams" und "LA Rams vs SF 49ers" sind dasselbe Spiel.
 *
 * Deshalb wird nie ueber den blossen Text verglichen, sondern ueber mehrere unabhaengige
 * Merkmale: Tipp, Beteiligte, Marktart, Thema und Linie. Erst wenn mehrere zusammenpassen,
 * gilt es als dieselbe Wette. Das ist Karams Regel gegen Namensgleichheit ohne Sachbezug.
 *
 * Reine Logik. Keine Anzeige.
 */

/** Woerter ohne Unterscheidungskraft. Sie werden beim Vergleich weggelassen. */
const FUELLWOERTER = new Set([
  'fc', 'sc', 'sv', 'tsv', 'vfb', 'vfl', 'bsc', 'cf', 'ac', 'as', 'ss', 'us', 'afc', 'cfc',
  'the', 'der', 'die', 'das', 'and', 'und', 'of', 'von', 'at', 'vs', 'v', 'gegen', 'geg',
  'team', 'club', 'city', 'united', 'utd', 'fk', 'sk', 'bk', 'if', 'ik',
  'will', 'have', 'to', 'be', 'wird', 'hat', 'in', 'im', 'am', 'auf', 'fuer', 'für',
  'total', 'totals', 'player', 'spieler', 'game', 'spiel', 'match', 'markt', 'market',
])

/** Marktarten und ihre Schreibweisen. Laengere Begriffe stehen zuerst. */
const MARKTARTEN = [
  { art: 'spread', muster: /\b(?:spread|handicap|hcp|asian handicap|ah|hdp)\b/i },
  { art: 'moneyline', muster: /\b(?:moneyline|money line|ml|sieg|siegwette|1x2|match winner|win outright)\b/i },
  { art: 'ueber', muster: /\b(?:over|ueber|über|o\/u over|mehr als)\b/i },
  { art: 'unter', muster: /\b(?:under|unter|weniger als)\b/i },
  { art: 'doppelchance', muster: /\b(?:double chance|doppelte chance|doppelchance|1x|x2|12)\b/i },
  { art: 'btts', muster: /\b(?:both teams to score|btts|beide treffen)\b/i },
  { art: 'korrekt', muster: /\b(?:correct score|exaktes ergebnis|endstand)\b/i },
]

/**
 * @typedef {object} Wettkennung
 * @property {string[]} tipp          Kennzeichnende Woerter des Tipps.
 * @property {string[]} beteiligte    Kennzeichnende Woerter der Begegnung.
 * @property {string} marktart        ueber, unter, spread, moneyline, sonstiges ...
 * @property {string[]} thema         Kennzeichnende Woerter des Marktes ohne die Marktart.
 * @property {number|null} linie      Die Linie oder das Handicap.
 * @property {string} text            Der zusammengesetzte Originaltext, nur zur Anzeige.
 */

/**
 * Zerlegt einen Text in kennzeichnende Woerter.
 *
 * @param {string|null|undefined} text
 * @returns {string[]}
 */
export function woerter(text) {
  if (typeof text !== 'string' || text.trim() === '') return []
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 1 && !FUELLWOERTER.has(w))
}

/**
 * Bestimmt die Marktart aus einem Markttext.
 *
 * @param {string|null|undefined} markt
 * @returns {string}
 */
export function marktart(markt) {
  if (typeof markt !== 'string') return 'sonstiges'
  for (const eintrag of MARKTARTEN) {
    if (eintrag.muster.test(markt)) return eintrag.art
  }
  return 'sonstiges'
}

/**
 * Baut die Kennung einer einzelnen Auswahl.
 *
 * @param {import('./typen.js').Auswahl} auswahl
 * @returns {Wettkennung}
 */
export function bildeKennung(auswahl) {
  const markttext = auswahl.markt.wert ?? ''
  const art = marktart(markttext)

  // Die Marktart und die Linie werden aus dem Thema entfernt, damit sie nicht doppelt zaehlen.
  const themaText = markttext
    .replace(/\b(?:over|under|ueber|über|unter|spread|handicap|hcp|ah|moneyline|ml)\b/gi, ' ')
    .replace(/[+-]?\d+(?:[.,]\d+)?/g, ' ')

  return {
    tipp: woerter(auswahl.tipp.wert),
    beteiligte: woerter(auswahl.ereignis.wert),
    marktart: art,
    thema: woerter(themaText),
    linie: auswahl.linie.wert,
    text: [auswahl.tipp.wert, auswahl.ereignis.wert, auswahl.markt.wert]
      .filter((t) => typeof t === 'string' && t !== '')
      .join(' | '),
  }
}

/**
 * Ueberlappungsmass zweier Wortmengen.
 *
 * Bewusst nicht Jaccard, sondern der Anteil an der kleineren Menge. So zaehlt
 * "SF 49ers" gegen "San Francisco 49ers" noch als hohe Uebereinstimmung,
 * obwohl die eine Schreibweise viel kuerzer ist.
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number} Zwischen 0 und 1. Bei zwei leeren Mengen wird -1 geliefert,
 *                   was "kein Urteil moeglich" bedeutet.
 */
export function ueberlappung(a, b) {
  const mengeA = new Set(a)
  const mengeB = new Set(b)
  if (mengeA.size === 0 && mengeB.size === 0) return -1
  if (mengeA.size === 0 || mengeB.size === 0) return 0

  let gemeinsam = 0
  for (const wort of mengeA) {
    if (mengeB.has(wort)) gemeinsam++
  }
  return gemeinsam / Math.min(mengeA.size, mengeB.size)
}

/**
 * Gewichte der einzelnen Merkmale. Sie werden auf die tatsaechlich vergleichbaren
 * Merkmale umgelegt, damit ein fehlendes Feld das Ergebnis nicht nach unten zieht.
 */
const GEWICHTE = { tipp: 0.32, beteiligte: 0.26, thema: 0.22, linie: 0.2 }

/**
 * Vergleicht zwei Auswahlen.
 *
 * @param {Wettkennung} a
 * @param {Wettkennung} b
 * @returns {{punkte: number, marktartGleich: boolean, linieGleich: boolean, vergleichbar: boolean}}
 */
export function vergleicheKennung(a, b) {
  const marktartGleich = a.marktart === b.marktart

  let linieGleich
  if (a.linie === null && b.linie === null) linieGleich = true
  else if (a.linie === null || b.linie === null) linieGleich = false
  else linieGleich = Math.abs(a.linie - b.linie) < 1e-9

  let summe = 0
  let gewichtSumme = 0

  const tipp = ueberlappung(a.tipp, b.tipp)
  if (tipp >= 0) {
    summe += tipp * GEWICHTE.tipp
    gewichtSumme += GEWICHTE.tipp
  }

  const beteiligte = ueberlappung(a.beteiligte, b.beteiligte)
  if (beteiligte >= 0) {
    summe += beteiligte * GEWICHTE.beteiligte
    gewichtSumme += GEWICHTE.beteiligte
  }

  const thema = ueberlappung(a.thema, b.thema)
  if (thema >= 0) {
    summe += thema * GEWICHTE.thema
    gewichtSumme += GEWICHTE.thema
  }

  if (a.linie !== null || b.linie !== null) {
    summe += (linieGleich ? 1 : 0) * GEWICHTE.linie
    gewichtSumme += GEWICHTE.linie
  }

  const vergleichbar = gewichtSumme > 0
  const punkte = vergleichbar ? summe / gewichtSumme : 0

  return { punkte, marktartGleich, linieGleich, vergleichbar }
}

/**
 * @typedef {object} Scheinvergleich
 * @property {number} punkte          Zwischen 0 und 1.
 * @property {boolean} gleicheAnzahl  Haben beide Scheine gleich viele Beine.
 * @property {string[]} gruende       Was dafuer oder dagegen spricht.
 */

/**
 * Vergleicht zwei Scheine auf dieselbe Wette.
 *
 * Es wird verlangt, dass die Anzahl der Beine uebereinstimmt. Eine Dreierkombi und
 * eine Viererkombi sind niemals dieselbe Wette, auch wenn drei Beine gleich sind.
 *
 * @param {import('./typen.js').Schein} a
 * @param {import('./typen.js').Schein} b
 * @returns {Scheinvergleich}
 */
export function vergleicheScheine(a, b) {
  /** @type {string[]} */
  const gruende = []

  if (a.auswahlen.length !== b.auswahlen.length) {
    return {
      punkte: 0,
      gleicheAnzahl: false,
      gruende: [
        `Verschiedene Anzahl Beine: ${a.auswahlen.length} gegen ${b.auswahlen.length}.`,
      ],
    }
  }
  if (a.auswahlen.length === 0) {
    return { punkte: 0, gleicheAnzahl: true, gruende: ['Keine Auswahlen erkannt.'] }
  }

  const kennungenA = a.auswahlen.map(bildeKennung)
  const kennungenB = b.auswahlen.map(bildeKennung)

  // Die Beine koennen in verschiedener Reihenfolge stehen. Deshalb wird jedes Bein
  // dem jeweils besten Gegenstueck zugeordnet, jedes hoechstens einmal.
  const vergeben = new Set()
  let summe = 0
  let marktartenPassen = true
  let linienPassen = true

  for (const kennungA of kennungenA) {
    let bestePunkte = -1
    let besterIndex = -1
    /** @type {{punkte: number, marktartGleich: boolean, linieGleich: boolean, vergleichbar: boolean}|null} */
    let bestes = null

    for (let i = 0; i < kennungenB.length; i++) {
      if (vergeben.has(i)) continue
      const kennungB = kennungenB[i]
      if (!kennungB) continue
      const vergleich = vergleicheKennung(kennungA, kennungB)
      if (vergleich.punkte > bestePunkte) {
        bestePunkte = vergleich.punkte
        besterIndex = i
        bestes = vergleich
      }
    }

    if (besterIndex >= 0 && bestes) {
      vergeben.add(besterIndex)
      summe += bestes.punkte
      if (!bestes.marktartGleich) marktartenPassen = false
      if (!bestes.linieGleich) linienPassen = false
    }
  }

  let punkte = summe / kennungenA.length

  if (!marktartenPassen) {
    punkte *= 0.5
    gruende.push('Die Marktart stimmt nicht bei allen Beinen ueberein.')
  }
  if (!linienPassen) {
    punkte *= 0.5
    gruende.push('Die Linie oder das Handicap stimmt nicht bei allen Beinen ueberein.')
  }

  // Quoten duerfen zwischen Buchmachern abweichen, das ist ja der Sinn der Sache.
  // Eine sehr grosse Abweichung deutet aber auf eine andere Wette hin.
  const quoteA = a.quoteDezimal.wert
  const quoteB = b.quoteDezimal.wert
  if (quoteA !== null && quoteB !== null && quoteA > 0 && quoteB > 0) {
    const verhaeltnis = Math.max(quoteA, quoteB) / Math.min(quoteA, quoteB)
    if (verhaeltnis > 1.35) {
      punkte *= 0.6
      gruende.push(
        `Die Quoten liegen weit auseinander: ${quoteA.toFixed(2)} gegen ${quoteB.toFixed(2)}.`
      )
    } else if (verhaeltnis <= 1.08) {
      gruende.push('Die Quoten liegen dicht beieinander.')
    }
  }

  // Der Zeitpunkt ist das entscheidende zweite Merkmal.
  //
  // Ohne ihn wuerde derselbe Spielertipp aus Spieltag 1 und aus Spieltag 8 zu einem
  // Riesenschein verschmelzen, mit einer Gesamtquote und einem Risiko, die es nie gab.
  // Wer dieselbe Wette auf viele Buchmacher verteilt, tut das innerhalb von Minuten,
  // hoechstens innerhalb desselben Wochenendes. Alles darueber hinaus ist eine andere Wette.
  const tagA = (a.gesetztAm.wert ?? '').slice(0, 10)
  const tagB = (b.gesetztAm.wert ?? '').slice(0, 10)
  if (tagA && tagB) {
    if (tagA === tagB) {
      gruende.push('Beide am selben Tag gesetzt.')
    } else {
      const abstand = Math.abs(Date.parse(`${tagA}T00:00:00Z`) - Date.parse(`${tagB}T00:00:00Z`))
      const tage = abstand / 86400000
      if (!Number.isFinite(tage)) {
        // Unlesbares Datum darf nicht wie ein passendes Datum wirken.
        punkte *= 0.9
        gruende.push('Der Zeitpunkt liess sich nicht vergleichen.')
      } else if (tage <= 2) {
        punkte *= 0.97
        gruende.push(`Die Scheine liegen ${Math.round(tage)} Tag(e) auseinander.`)
      } else if (tage <= 7) {
        punkte *= 0.55
        gruende.push(
          `Die Scheine liegen ${Math.round(tage)} Tage auseinander. Das spricht eher fuer zwei verschiedene Wetten.`
        )
      } else {
        punkte *= 0.2
        gruende.push(
          `Die Scheine liegen ${Math.round(tage)} Tage auseinander. Dieselbe Wette wird nicht ueber ` +
            'Wochen verteilt gesetzt, das ist mit hoher Wahrscheinlichkeit eine andere Begegnung.'
        )
      }
    }
  } else {
    // Fehlt bei einem der beiden der Zeitpunkt, fehlt das zweite unabhaengige Merkmal.
    // Dann wird der Text allein nicht als Beweis akzeptiert.
    punkte *= 0.85
    gruende.push('Bei mindestens einem Schein fehlt der Zeitpunkt.')
  }

  return { punkte: Math.max(0, Math.min(1, punkte)), gleicheAnzahl: true, gruende }
}

/**
 * Kurzer Fingerabdruck einer Wette, fuer schnelles Vorsortieren und fuer die Anzeige.
 *
 * Er wird bewusst NICHT als alleiniges Kriterium fuer die Gruppierung benutzt.
 * Dafuer ist er zu grob, weil verschiedene Buchmacher verschieden schreiben.
 *
 * @param {import('./typen.js').Schein} schein
 * @returns {string}
 */
export function bildeSignatur(schein) {
  const teile = schein.auswahlen
    .map(bildeKennung)
    .map((k) => {
      const tipp = [...k.tipp].sort().join('-')
      const thema = [...k.thema].sort().join('-')
      const linie = k.linie === null ? '' : String(k.linie)
      return `${tipp}~${k.marktart}~${thema}~${linie}`
    })
    .sort()
  return `${schein.auswahlen.length}::${teile.join('||')}`
}
