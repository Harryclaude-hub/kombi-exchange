// @ts-check
/**
 * Etiketten: die Woerter, an denen ein Feld auf einem Wettschein haengt.
 *
 * Diese Datei ist bewusst reine Liste. Wer einen neuen Buchmacher unterstuetzen will,
 * traegt hier die Beschriftung nach, ohne die Leselogik anzufassen.
 *
 * Wichtig ist die Spalte bedeutung:
 *   'auszahlung' meint den Gesamtbetrag EINSCHLIESSLICH Einsatz.
 *   'gewinn'     meint den reinen Gewinn OHNE Einsatz.
 *   'unklar'     heisst: das Wort wird je nach Buchmacher fuer beides benutzt.
 *                In dem Fall entscheidet die Gegenrechnung, nicht das Wort.
 */

/**
 * @typedef {object} Etikett
 * @property {string} wort              Kleingeschrieben, ohne Doppelpunkt.
 * @property {'auszahlung'|'gewinn'|'unklar'} [bedeutung]
 */

/** Beschriftungen fuer den Einsatz. */
export const EINSATZ_ETIKETTEN = [
  'stake', 'stakes', 'risk', 'risking', 'wager', 'wagered', 'bet amount', 'amount',
  'buy in', 'total stake', 'total risk', 'unit risk',
  // Das blosse Wort "bet" steht bewusst NICHT in dieser Liste. Es kommt in
  // "Bet ID" vor und wuerde dort die Scheinnummer als Einsatz lesen.
  'einsatz', 'wetteinsatz', 'gesamteinsatz', 'ihr einsatz', 'eingesetzt', 'betrag',
  'mise', 'enjeu', 'importo', 'puntata', 'apuesta', 'inzet', 'insats', 'stawka',
]

/**
 * Beschriftungen fuer die Auszahlung oder den Gewinn.
 * @type {{wort: string, bedeutung: 'auszahlung'|'gewinn'|'unklar'}[]}
 */
export const AUSZAHLUNG_ETIKETTEN = [
  // Eindeutig Gesamtbetrag einschliesslich Einsatz.
  { wort: 'returns', bedeutung: 'auszahlung' },
  { wort: 'return', bedeutung: 'auszahlung' },
  { wort: 'total return', bedeutung: 'auszahlung' },
  { wort: 'total returns', bedeutung: 'auszahlung' },
  { wort: 'payout', bedeutung: 'auszahlung' },
  { wort: 'total payout', bedeutung: 'auszahlung' },
  { wort: 'potential payout', bedeutung: 'auszahlung' },
  { wort: 'potential return', bedeutung: 'auszahlung' },
  { wort: 'paid', bedeutung: 'auszahlung' },
  { wort: 'collect', bedeutung: 'auszahlung' },
  { wort: 'auszahlung', bedeutung: 'auszahlung' },
  { wort: 'gesamtauszahlung', bedeutung: 'auszahlung' },
  { wort: 'moegliche auszahlung', bedeutung: 'auszahlung' },
  { wort: 'mögliche auszahlung', bedeutung: 'auszahlung' },
  { wort: 'mögl. auszahlung', bedeutung: 'auszahlung' },
  { wort: 'ausgezahlt', bedeutung: 'auszahlung' },

  // Eindeutig reiner Gewinn ohne Einsatz.
  { wort: 'to win', bedeutung: 'gewinn' },
  { wort: 'towin', bedeutung: 'gewinn' },
  { wort: 'profit', bedeutung: 'gewinn' },
  { wort: 'net win', bedeutung: 'gewinn' },
  { wort: 'reingewinn', bedeutung: 'gewinn' },

  // Uneindeutig: im deutschen Raum meist der Gesamtbetrag, im englischen der Gewinn.
  // Hier entscheidet die Gegenrechnung.
  { wort: 'win', bedeutung: 'unklar' },
  { wort: 'winnings', bedeutung: 'unklar' },
  { wort: 'potential win', bedeutung: 'unklar' },
  { wort: 'gewinn', bedeutung: 'unklar' },
  { wort: 'moegl. gewinn', bedeutung: 'unklar' },
  { wort: 'mögl. gewinn', bedeutung: 'unklar' },
  { wort: 'moeglicher gewinn', bedeutung: 'unklar' },
  { wort: 'möglicher gewinn', bedeutung: 'unklar' },
  { wort: 'gain', bedeutung: 'unklar' },
  { wort: 'gains', bedeutung: 'unklar' },
  { wort: 'vincita', bedeutung: 'unklar' },
  { wort: 'ganancia', bedeutung: 'unklar' },
]

/** Beschriftungen fuer die Quote. */
export const QUOTE_ETIKETTEN = [
  'odds', 'odd', 'price', 'total odds', 'parlay odds', 'combined odds', 'line',
  'quote', 'gesamtquote', 'kombiquote', 'endquote', 'gesamt-quote',
  'cote', 'cotes', 'quota', 'quote totale', 'cuota', 'kurs',
]

/** Beschriftungen fuer die Scheinnummer. */
export const SCHEINNUMMER_ETIKETTEN = [
  'bet id', 'betid', 'bet no', 'bet number', 'ticket', 'ticket id', 'ticket no',
  'reference', 'ref', 'receipt', 'slip', 'slip id', 'transaction',
  'wett-id', 'wettid', 'wettschein', 'schein', 'scheinnummer', 'schein-nr',
  'beleg', 'belegnummer', 'buchungsnummer', 'auftragsnummer', 'tippschein',
]

/**
 * Statuswoerter und der Status, den sie bedeuten.
 * Die Liste wird von oben nach unten geprueft, deshalb stehen laengere Begriffe zuerst.
 * @type {{wort: string, status: import('./typen.js').Status}[]}
 */
export const STATUS_ETIKETTEN = [
  { wort: 'cashed out', status: 'cashout' },
  { wort: 'cash out', status: 'cashout' },
  { wort: 'cashout', status: 'cashout' },
  { wort: 'vorzeitig ausgezahlt', status: 'cashout' },
  { wort: 'half won', status: 'halb_gewonnen' },
  { wort: 'halb gewonnen', status: 'halb_gewonnen' },
  { wort: 'half lost', status: 'halb_verloren' },
  { wort: 'halb verloren', status: 'halb_verloren' },
  { wort: 'push', status: 'push' },
  { wort: 'tie', status: 'push' },
  { wort: 'unentschieden', status: 'push' },
  { wort: 'void', status: 'storniert' },
  { wort: 'voided', status: 'storniert' },
  { wort: 'cancelled', status: 'storniert' },
  { wort: 'canceled', status: 'storniert' },
  { wort: 'storniert', status: 'storniert' },
  { wort: 'annulliert', status: 'storniert' },
  { wort: 'ungueltig', status: 'storniert' },
  { wort: 'ungültig', status: 'storniert' },
  { wort: 'won', status: 'gewonnen' },
  { wort: 'win', status: 'gewonnen' },
  { wort: 'winner', status: 'gewonnen' },
  { wort: 'gewonnen', status: 'gewonnen' },
  { wort: 'lost', status: 'verloren' },
  { wort: 'lose', status: 'verloren' },
  { wort: 'loser', status: 'verloren' },
  { wort: 'verloren', status: 'verloren' },
  { wort: 'pending', status: 'offen' },
  { wort: 'open', status: 'offen' },
  { wort: 'unsettled', status: 'offen' },
  { wort: 'in play', status: 'offen' },
  { wort: 'live', status: 'offen' },
  { wort: 'offen', status: 'offen' },
  { wort: 'laufend', status: 'offen' },
  { wort: 'nicht entschieden', status: 'offen' },
]

/**
 * Woerter, die eine Mehrfachwette ankuendigen, samt der Anzahl Beine falls erkennbar.
 * @type {RegExp[]}
 */
export const KOMBI_MUSTER = [
  /(\d+)\s*[- ]?\s*(?:leg|legs|team|teams|pick|picks|selection|selections)\s*(?:parlay|accumulator|acca|combo)?/i,
  /\b(?:parlay|accumulator|acca|multi|multiple|combo|round robin|teaser|pleaser)\b/i,
  /\bsame game parlay\b|\bsgp\b/i,
  /\bkombi(?:wette)?\s*\(?(\d+)\)?/i,
  /\bmehrfachwette\b|\bkombinationswette\b/i,
  /\bsystemwette\b|\bsystem\s*\d+\s*\/\s*\d+/i,
]

/**
 * Woerter, die eine Gratis- oder Bonuswette kennzeichnen.
 *
 * Das ist rechnerisch bedeutsam: bei einer Gratiswette ist der Einsatz kein eigenes Geld
 * und wird bei einem Gewinn auch nicht mit ausgezahlt. Wer sie mitzaehlt, ueberschaetzt
 * sowohl den Einsatz als auch die moegliche Auszahlung.
 * @type {RegExp[]}
 */
export const GRATIS_MUSTER = [
  /\bfree\s*bet\b/i,
  /\bbonus\s*bet\b/i,
  /\bfreebet\b/i,
  /\brisk[\s-]*free\b/i,
  /\bstake\s*not\s*returned\b/i,
  /\bsnr\b/,
  /\bgratis\s*wette\b/i,
  /\bgratiswette\b/i,
  /\bbonus\s*wette\b/i,
  /\bbonuswette\b/i,
  /\bfreiwette\b/i,
  /\bwettgutschein\b/i,
]

/**
 * Woerter, die eine Each-Way-Wette kennzeichnen.
 * Dort wird der angezeigte Einsatz doppelt abgebucht, einmal auf Sieg und einmal auf Platz.
 * @type {RegExp[]}
 */
export const EACHWAY_MUSTER = [
  /\beach\s*way\b/i,
  /\be\/w\b/i,
  /\bew\s*bet\b/i,
  /\bsieg\s*und\s*platz\b/i,
]

/** Woerter, die eine Systemwette ankuendigen. Systemwetten rechnen anders und werden markiert. */
export const SYSTEM_MUSTER = [
  /\bsystemwette\b/i,
  /\bsystem\s*\d+\s*\/\s*\d+/i,
  /\b(?:trixie|patent|yankee|lucky\s*15|lucky\s*31|lucky\s*63|canadian|heinz|goliath)\b/i,
  /\bround robin\b/i,
]
