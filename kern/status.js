// @ts-check
/**
 * Status eines Scheins und was daraus folgt.
 *
 * Diese Datei ist die EINZIGE Stelle, an der steht, was ein Status bedeutet.
 * Vorher stand dieselbe Liste an zwei Stellen, und genau daraus entsteht die
 * Drift, vor der Karams Fehlerliste warnt.
 *
 * Der wichtigste Punkt hier:
 *   Auf einer Wettuebersicht bedeutet die Spalte "Returns" je nach Status etwas anderes.
 *   Bei einer offenen Wette ist es die MOEGLICHE Auszahlung.
 *   Bei einer entschiedenen Wette ist es die TATSAECHLICHE Auszahlung.
 *   Bei einer verlorenen Wette steht dort 0, bei einer annullierten der Einsatz.
 *   Wer daraus die Quote als Auszahlung durch Einsatz berechnet, bekommt bei
 *   verlorenen Scheinen die Quote 0 und bei annullierten die Quote 1. Beides ist falsch
 *   und wuerde den ganzen Riesenschein verderben.
 *
 * Reine Logik. Keine Anzeige.
 */

/** @typedef {import('./typen.js').Status} Status */

/** Status, bei denen der Ausgang feststeht. */
export const ENTSCHIEDEN = /** @type {ReadonlySet<Status>} */ (
  new Set(['gewonnen', 'verloren', 'halb_gewonnen', 'halb_verloren', 'push', 'storniert', 'cashout'])
)

/** Status, bei denen der Ausgang noch offen ist. */
export const OFFEN = /** @type {ReadonlySet<Status>} */ (new Set(['offen', 'unbekannt']))

/**
 * Status, bei denen der auf dem Schein stehende Betrag die MOEGLICHE Auszahlung ist,
 * also Einsatz mal Quote. Nur dann darf die Quote aus den Betraegen abgeleitet werden.
 *
 * Bei "gewonnen" gilt das ebenfalls, weil die tatsaechliche Auszahlung dort genau
 * Einsatz mal Quote ist. Das ist der Fall aus Karams Screenshot.
 */
export const GELD_IST_POTENZIAL = /** @type {ReadonlySet<Status>} */ (
  new Set(['offen', 'unbekannt', 'gewonnen'])
)

/**
 * @param {Status} status
 * @returns {boolean}
 */
export function istEntschieden(status) {
  return ENTSCHIEDEN.has(status)
}

/**
 * @param {Status} status
 * @returns {boolean}
 */
export function istOffen(status) {
  return !ENTSCHIEDEN.has(status)
}

/**
 * Darf die Quote aus Einsatz und dem angezeigten Betrag berechnet werden?
 *
 * @param {Status} status
 * @returns {boolean}
 */
export function geldZeigtPotenzial(status) {
  return GELD_IST_POTENZIAL.has(status)
}

/**
 * Was bei diesem Status aus dem Einsatz zurueckfliesst, einschliesslich Einsatz.
 *
 * @param {Status} status
 * @param {number|null} einsatz
 * @param {number|null} dezimal
 * @param {boolean} [einsatzWirdZurueckgezahlt]  false bei einer Gratiswette.
 * @returns {{wert: number|null, bekannt: boolean, grund: string}}
 */
export function erwarteterRueckfluss(status, einsatz, dezimal, einsatzWirdZurueckgezahlt = true) {
  if (einsatz === null || !Number.isFinite(einsatz)) {
    return { wert: null, bekannt: false, grund: 'Kein Einsatz bekannt.' }
  }

  switch (status) {
    case 'verloren':
      return { wert: 0, bekannt: true, grund: 'Verloren, nichts zurück.' }

    case 'push':
    case 'storniert':
      // Bei einer Gratiswette gibt es nichts zurueck, der Einsatz war nie Bargeld.
      return einsatzWirdZurueckgezahlt
        ? { wert: einsatz, bekannt: true, grund: 'Einsatz zurück.' }
        : { wert: 0, bekannt: true, grund: 'Gratiswette annulliert, nichts zurück.' }

    case 'gewonnen': {
      if (dezimal === null || !Number.isFinite(dezimal)) {
        return { wert: null, bekannt: false, grund: 'Gewonnen, aber keine Quote bekannt.' }
      }
      return einsatzWirdZurueckgezahlt
        ? { wert: einsatz * dezimal, bekannt: true, grund: 'Einsatz mal Quote.' }
        : { wert: einsatz * (dezimal - 1), bekannt: true, grund: 'Gratiswette: nur der Gewinn.' }
    }

    case 'halb_gewonnen': {
      if (dezimal === null || !Number.isFinite(dezimal)) {
        return { wert: null, bekannt: false, grund: 'Halb gewonnen, aber keine Quote bekannt.' }
      }
      // Halber Einsatz kommt zurueck, halber Einsatz gewinnt.
      return {
        wert: einsatz / 2 + (einsatz / 2) * dezimal,
        bekannt: true,
        grund: 'Halber Einsatz zurück, halber Einsatz gewonnen.',
      }
    }

    case 'halb_verloren':
      return { wert: einsatz / 2, bekannt: true, grund: 'Halber Einsatz zurück.' }

    case 'cashout':
      return {
        wert: null,
        bekannt: false,
        grund:
          'Vorzeitig ausgezahlt. Der Betrag ist frei ausgehandelt und steht in keinem festen ' +
          'Verhaeltnis zu Einsatz und Quote. Er muss von Hand eingetragen werden.',
      }

    default:
      return { wert: null, bekannt: false, grund: 'Noch nicht entschieden.' }
  }
}

/**
 * Rangfolge der Status beim Zusammenfuehren zweier Aufnahmen desselben Scheins.
 *
 * Wer denselben Schein zweimal fotografiert, einmal offen und spaeter entschieden,
 * hat zwei Bilder derselben Wette. Der entschiedene Stand gewinnt, weil er neuer ist.
 *
 * @param {Status} status
 * @returns {number} Je hoeher, desto staerker.
 */
export function statusRang(status) {
  if (status === 'unbekannt') return 0
  if (status === 'offen') return 1
  return 2
}
