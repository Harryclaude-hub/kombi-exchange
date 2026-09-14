// @ts-check
/**
 * Buchmacher erkennen.
 *
 * Ein Vollbild-Screenshot verraet den Anbieter auf mehreren Wegen gleichzeitig:
 * am Schriftzug im Kopf, an der Adresszeile, am Titel des Browserreiters.
 * Die Adresszeile ist das staerkste Merkmal, weil sie faelschungssicher zum Anbieter gehoert.
 *
 * Nach Karams Regel wird nie ueber einen einzigen Namenstreffer verknuepft.
 * Erst mehrere unabhaengige Merkmale ergeben einen sicheren Treffer.
 *
 * Reine Logik. Keine Anzeige.
 */

/**
 * @typedef {object} Buchmacherprofil
 * @property {string} schluessel   Technischer Schluessel, aendert sich nie.
 * @property {string} name         Anzeigename.
 * @property {string[]} domains    Kennzeichnende Teile der Adresszeile.
 * @property {RegExp[]} schriftzug Muster fuer den Markennamen im Bild.
 * @property {'de'|'en'} gebiet    Schreibweise der Zahlen.
 * @property {'USD'|'EUR'|'GBP'|'CHF'|'UNBEKANNT'} waehrung
 * @property {'amerikanisch'|'dezimal'|'bruch'} quotenformat
 */

/**
 * Bekannte Anbieter.
 * Reihenfolge egal, es wird immer der Eintrag mit der hoechsten Punktzahl genommen.
 * @type {Buchmacherprofil[]}
 */
export const BUCHMACHER = [
  // Amerikanisch und international
  { schluessel: 'betonline', name: 'BetOnline', domains: ['betonline.ag', 'betonline.com'], schriftzug: [/bet\s*online/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'sportsbetting_ag', name: 'SportsBetting.ag', domains: ['sportsbetting.ag'], schriftzug: [/sportsbetting/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'lowvig', name: 'LowVig.ag', domains: ['lowvig.ag'], schriftzug: [/low\s*vig/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'bovada', name: 'Bovada', domains: ['bovada.lv', 'bovada.eu'], schriftzug: [/bovada/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'mybookie', name: 'MyBookie', domains: ['mybookie.ag', 'mybookie.eu'], schriftzug: [/my\s*bookie/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'betus', name: 'BetUS', domains: ['betus.com'], schriftzug: [/bet\s*us\b/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'everygame', name: 'Everygame', domains: ['everygame.eu'], schriftzug: [/everygame/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'xbet', name: 'Xbet', domains: ['xbet.ag'], schriftzug: [/\bxbet\b/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'heritage', name: 'Heritage Sports', domains: ['heritagesports.eu'], schriftzug: [/heritage\s*sports/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'betanysports', name: 'BetAnySports', domains: ['betanysports.eu'], schriftzug: [/bet\s*any\s*sports/i, /\bbas\b/], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'pinnacle', name: 'Pinnacle', domains: ['pinnacle.com', 'pinnaclesports'], schriftzug: [/pinnacle/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  // PS3838 ist Pinnacles Zweitmarke. Karam setzt dort (echtes Foto 13.09.2026).
  // Die Ansicht ist eine TABELLE: der Einsatz traegt "Risk:", die Quote steht
  // nackt in ihrer Spalte mit dem Formatbuchstaben D dahinter, und die Spalte
  // Win/Loss ist der GEWINN, nicht die Auszahlung. Sie ist unbeschriftet und
  // wird deshalb bewusst nicht gelesen, siehe kern/parser.js, Abschnitt 4b.
  { schluessel: 'ps3838', name: 'PS3838', domains: ['ps3838.com', 'ps38.com'], schriftzug: [/\bps\s*3838\b/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'draftkings', name: 'DraftKings', domains: ['draftkings.com'], schriftzug: [/draft\s*kings/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'fanduel', name: 'FanDuel', domains: ['fanduel.com'], schriftzug: [/fan\s*duel/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'betmgm', name: 'BetMGM', domains: ['betmgm.com'], schriftzug: [/bet\s*mgm/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'caesars', name: 'Caesars', domains: ['caesars.com', 'williamhill.com/us'], schriftzug: [/caesars/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'espnbet', name: 'ESPN BET', domains: ['espnbet.com'], schriftzug: [/espn\s*bet/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'fanatics', name: 'Fanatics Sportsbook', domains: ['fanatics.com', 'fanaticssportsbook'], schriftzug: [/fanatics/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'pointsbet', name: 'PointsBet', domains: ['pointsbet.com'], schriftzug: [/points\s*bet/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'hardrock', name: 'Hard Rock Bet', domains: ['hardrock.bet', 'hardrockbet'], schriftzug: [/hard\s*rock\s*bet/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'prizepicks', name: 'PrizePicks', domains: ['prizepicks.com'], schriftzug: [/prize\s*picks/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },
  { schluessel: 'underdog', name: 'Underdog Fantasy', domains: ['underdogfantasy.com'], schriftzug: [/underdog/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'amerikanisch' },

  // Deutschsprachiger Raum
  { schluessel: 'bet365', name: 'bet365', domains: ['bet365.com', 'bet365.de'], schriftzug: [/bet\s*365/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'bwin', name: 'bwin', domains: ['bwin.com', 'bwin.de', 'sports.bwin'], schriftzug: [/\bbwin\b/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'tipico', name: 'Tipico', domains: ['tipico.de', 'tipico.com'], schriftzug: [/tipico/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'interwetten', name: 'Interwetten', domains: ['interwetten.com', 'interwetten.de'], schriftzug: [/interwetten/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'admiral', name: 'Admiral', domains: ['admiral.at', 'admiralbet.de', 'admiralbet.it'], schriftzug: [/admiral\s*bet/i, /\badmiral\b/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'winamax', name: 'Winamax', domains: ['winamax.fr', 'winamax.de', 'winamax.es'], schriftzug: [/winamax/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'unibet', name: 'Unibet', domains: ['unibet.com', 'unibet.de'], schriftzug: [/unibet/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'betano', name: 'Betano', domains: ['betano.de', 'betano.com', 'betano.pt'], schriftzug: [/betano/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'betathome', name: 'bet-at-home', domains: ['bet-at-home.com', 'bet-at-home.de'], schriftzug: [/bet[\s-]*at[\s-]*home/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'cashpoint', name: 'Cashpoint', domains: ['cashpoint.com', 'cashpoint.at'], schriftzug: [/cashpoint/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'merkur', name: 'Merkur Bets', domains: ['merkurbets.de', 'merkur-sports'], schriftzug: [/merkur\s*(?:bets|sports)?/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'tipwin', name: 'Tipwin', domains: ['tipwin.com', 'tipwin.de'], schriftzug: [/tipwin/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'xtip', name: 'XTiP', domains: ['xtip.de', 'xtip.com'], schriftzug: [/\bxtip\b/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'happybet', name: 'Happybet', domains: ['happybet.de', 'happybet.at'], schriftzug: [/happy\s*bet/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'bet3000', name: 'Bet3000', domains: ['bet3000.com', 'bet3000.de'], schriftzug: [/bet\s*3000/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'neobet', name: 'NEObet', domains: ['neobet.de'], schriftzug: [/neo\s*bet/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'bildbet', name: 'Bildbet', domains: ['bildbet.de'], schriftzug: [/bild\s*bet/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'sportwettende', name: 'Sportwetten.de', domains: ['sportwetten.de'], schriftzug: [/sportwetten\.de/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'oddset', name: 'Oddset', domains: ['oddset.de'], schriftzug: [/oddset/i], gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal' },

  // Grossbritannien und weltweit
  { schluessel: 'betway', name: 'Betway', domains: ['betway.com', 'betway.de'], schriftzug: [/betway/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'dezimal' },
  { schluessel: 'williamhill', name: 'William Hill', domains: ['williamhill.com'], schriftzug: [/william\s*hill/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'bruch' },
  { schluessel: 'ladbrokes', name: 'Ladbrokes', domains: ['ladbrokes.com'], schriftzug: [/ladbrokes/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'bruch' },
  { schluessel: 'coral', name: 'Coral', domains: ['coral.co.uk'], schriftzug: [/\bcoral\b/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'bruch' },
  { schluessel: 'betfair', name: 'Betfair', domains: ['betfair.com', 'betfair.de'], schriftzug: [/betfair/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'dezimal' },
  { schluessel: 'paddypower', name: 'Paddy Power', domains: ['paddypower.com'], schriftzug: [/paddy\s*power/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'bruch' },
  { schluessel: 'skybet', name: 'Sky Bet', domains: ['skybet.com'], schriftzug: [/sky\s*bet/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'bruch' },
  { schluessel: 'betfred', name: 'Betfred', domains: ['betfred.com'], schriftzug: [/betfred/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'bruch' },
  { schluessel: 'stake', name: 'Stake', domains: ['stake.com', 'stake.bet'], schriftzug: [/\bstake\.com\b/i], gebiet: 'en', waehrung: 'USD', quotenformat: 'dezimal' },
  { schluessel: '1xbet', name: '1xBet', domains: ['1xbet.com', '1xbet.de'], schriftzug: [/1\s*x\s*bet/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: '20bet', name: '20Bet', domains: ['20bet.com'], schriftzug: [/20\s*bet/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: '22bet', name: '22Bet', domains: ['22bet.com'], schriftzug: [/22\s*bet/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'betsson', name: 'Betsson', domains: ['betsson.com'], schriftzug: [/betsson/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'leovegas', name: 'LeoVegas', domains: ['leovegas.com'], schriftzug: [/leo\s*vegas/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: '888sport', name: '888sport', domains: ['888sport.com'], schriftzug: [/888\s*sport/i], gebiet: 'en', waehrung: 'GBP', quotenformat: 'dezimal' },
  { schluessel: 'parimatch', name: 'Parimatch', domains: ['parimatch.com'], schriftzug: [/pari\s*match/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'marathonbet', name: 'Marathonbet', domains: ['marathonbet.com'], schriftzug: [/marathon\s*bet/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'rabona', name: 'Rabona', domains: ['rabona.com'], schriftzug: [/rabona/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
  { schluessel: 'pokerstars', name: 'PokerStars Sports', domains: ['pokerstars.com', 'pokerstarssports'], schriftzug: [/poker\s*stars/i], gebiet: 'en', waehrung: 'EUR', quotenformat: 'dezimal' },
]

/** Schneller Zugriff ueber den Schluessel. */
export const BUCHMACHER_NACH_SCHLUESSEL = new Map(BUCHMACHER.map((b) => [b.schluessel, b]))

/**
 * @typedef {object} Buchmacherfund
 * @property {Buchmacherprofil|null} profil
 * @property {number} sicherheit  Zwischen 0 und 1.
 * @property {string[]} merkmale  Welche Merkmale zum Treffer gefuehrt haben.
 */

/**
 * Erkennt den Buchmacher aus dem gesamten Text eines Bildes.
 *
 * Punktevergabe:
 *   Adresszeile oder Reitertitel mit passender Domain  3 Punkte
 *   Markenschriftzug irgendwo im Bild                  2 Punkte
 *   Markenschriftzug in der oberen Bildhaelfte          1 Punkt zusaetzlich
 *
 * Ein einzelner Schriftzugtreffer allein ergibt hoechstens mittlere Sicherheit.
 * Erst Domain plus Schriftzug gilt als sicher.
 *
 * @param {string} gesamttext       Der gesamte erkannte Text des Bildes.
 * @param {string} [kopftext]       Nur der Text aus dem oberen Bildbereich, falls vorhanden.
 * @returns {Buchmacherfund}
 */
export function erkenneBuchmacher(gesamttext, kopftext = '') {
  if (typeof gesamttext !== 'string' || gesamttext.trim() === '') {
    return { profil: null, sicherheit: 0, merkmale: [] }
  }
  const text = gesamttext.toLowerCase()
  const kopf = (kopftext || '').toLowerCase()

  /** @type {{profil: Buchmacherprofil, punkte: number, merkmale: string[]}[]} */
  const treffer = []

  for (const profil of BUCHMACHER) {
    let punkte = 0
    /** @type {string[]} */
    const merkmale = []

    for (const domain of profil.domains) {
      // Punkte im Text ohne Bedeutung, damit auch eine leicht verlesene Adresse noch passt.
      const muster = new RegExp(domain.replace(/[.]/g, '[.,]?').replace(/[/]/g, '\\/'), 'i')
      if (muster.test(text)) {
        punkte += 3
        merkmale.push(`Adresse ${domain}`)
        break
      }
    }

    for (const muster of profil.schriftzug) {
      if (muster.test(text)) {
        punkte += 2
        merkmale.push('Schriftzug')
        if (kopf && muster.test(kopf)) {
          punkte += 1
          merkmale.push('Schriftzug im Kopfbereich')
        }
        break
      }
    }

    if (punkte > 0) treffer.push({ profil, punkte, merkmale })
  }

  if (treffer.length === 0) return { profil: null, sicherheit: 0, merkmale: [] }

  treffer.sort((a, b) => b.punkte - a.punkte)
  const bester = treffer[0]
  if (!bester) return { profil: null, sicherheit: 0, merkmale: [] }

  const zweiter = treffer[1]
  // Wenn zwei Anbieter gleichauf liegen, ist die Erkennung unsicher.
  const eindeutig = !zweiter || bester.punkte > zweiter.punkte

  let sicherheit
  if (bester.punkte >= 5) sicherheit = 0.98
  else if (bester.punkte >= 3) sicherheit = 0.85
  else sicherheit = 0.55
  if (!eindeutig) sicherheit = Math.min(sicherheit, 0.5)

  return { profil: bester.profil, sicherheit, merkmale: bester.merkmale }
}

/**
 * Muster fuer eine Kontokennung im Kopfbereich eines Vollbild-Screenshots.
 *
 * Wer mit vielen Konten arbeitet, benennt die Browserprofile oder Reiter durch.
 * Genau diese Benennung steht im Screenshot und ist die zuverlaessigste Kontoquelle,
 * weil die Seite selbst den Kontonamen oft gar nicht anzeigt.
 * @type {{name: string, muster: RegExp}[]}
 */
export const KONTO_MUSTER = [
  { name: 'Profilkennung mit Bindestrich', muster: /\b([A-Z]{1,3}-\d{1,5}(?:[ _][A-Za-z0-9_]+)*)\b/ },
  { name: 'Unterstrichkennung', muster: /\b([A-Za-z]+_[A-Za-z]+_[0-9_]+)\b/ },
  { name: 'Begruessung', muster: /\b(?:welcome|hallo|hi|willkommen)[,!]?\s+([A-Za-z0-9._-]{3,30})\b/i },
  { name: 'Kontozeile', muster: /\b(?:account|konto|user|benutzer|kunde)\s*(?:nr\.?|no\.?|id|:)?\s*([A-Za-z0-9._-]{3,30})\b/i },
]

/**
 * Sucht eine Kontokennung im Kopfbereich.
 *
 * @param {string} kopftext            Text aus dem oberen Bildbereich.
 * @param {string} [eigenesMuster]     Zusaetzliches Muster als Zeichenkette, vom Nutzer gesetzt.
 * @returns {{wert: string|null, sicherheit: number, quelleMuster: string}}
 */
export function erkenneKonto(kopftext, eigenesMuster = '') {
  if (typeof kopftext !== 'string' || kopftext.trim() === '') {
    return { wert: null, sicherheit: 0, quelleMuster: '' }
  }

  if (eigenesMuster) {
    try {
      const eigen = new RegExp(eigenesMuster)
      const fund = kopftext.match(eigen)
      if (fund) {
        const wert = fund[1] ?? fund[0]
        return { wert: wert.trim(), sicherheit: 0.95, quelleMuster: 'eigenes Muster' }
      }
    } catch {
      // Ein kaputtes eigenes Muster darf die Erkennung nicht zum Absturz bringen.
      // Es wird uebergangen, der Nutzer sieht das Feld dann leer und kann es richtigstellen.
    }
  }

  for (const eintrag of KONTO_MUSTER) {
    const fund = kopftext.match(eintrag.muster)
    if (fund) {
      const wert = (fund[1] ?? fund[0]).trim()
      if (wert.length >= 3) {
        return { wert, sicherheit: 0.7, quelleMuster: eintrag.name }
      }
    }
  }
  return { wert: null, sicherheit: 0, quelleMuster: '' }
}

/**
 * Sucht den Kontostand im Kopfbereich. Er hilft, zwei Konten desselben Anbieters
 * auseinanderzuhalten, wenn sonst nichts im Bild steht.
 *
 * @param {string} kopftext
 * @returns {string|null}
 */
export function erkenneKontostand(kopftext) {
  if (typeof kopftext !== 'string') return null
  const fund = kopftext.match(/([$€£]\s?[0-9][0-9.,' ]{2,15})/)
  return fund && fund[1] ? fund[1].trim() : null
}
