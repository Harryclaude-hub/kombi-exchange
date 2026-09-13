// @ts-check
/**
 * Quoten-Mathematik.
 *
 * Einzige Quelle fuer alle Umrechnungen zwischen amerikanischer Quote, Dezimalquote,
 * Bruchquote und Wahrscheinlichkeit, und fuer den Zusammenhang zwischen Einsatz,
 * Quote und Auszahlung.
 *
 * Wichtigste Festlegung dieser Datei, sie gilt im ganzen Programm:
 *   AUSZAHLUNG  = Einsatz mal Dezimalquote. Der Einsatz ist darin enthalten.
 *   GEWINN      = Auszahlung minus Einsatz. Der Einsatz ist NICHT darin enthalten.
 * Buchmacher benennen das unterschiedlich. "Returns", "Payout", "Auszahlung" meinen
 * ueblicherweise die Auszahlung. "To Win", "Profit", "Gewinn" meinen den Gewinn.
 *
 * Reine Logik. Keine Anzeige.
 */

import { runde } from './zahlen.js'
import { geldZeigtPotenzial, erwarteterRueckfluss } from './status.js'

/**
 * Wie weit die angezeigte amerikanische Quote von der wahren abweichen darf.
 * Buchmacher zeigen ganze Zahlen. Aus Dezimalquote 1.64 wird -156.25, angezeigt wird -157.
 * Eine Einheit Spielraum in beide Richtungen deckt Runden und Abschneiden ab.
 */
export const ANZEIGE_UNSCHAERFE = 1

/** Zusaetzliche relative Toleranz beim Vergleich, gegen Gleitkommareste. */
export const RELATIVE_TOLERANZ = 0.002

/** Toleranz beim Vergleich zweier Geldbetraege, in Waehrungseinheiten. */
export const GELD_TOLERANZ = 0.02

/**
 * Amerikanische Quote in Dezimalquote.
 *
 * Bei +100 und bei -100 ist das Ergebnis genau 2.0. Zwischen -100 und +100
 * gibt es keine gueltige amerikanische Quote, dort wird null zurueckgegeben.
 *
 * @param {number} amerikanisch
 * @returns {number|null}
 */
export function amerikanischNachDezimal(amerikanisch) {
  if (!Number.isFinite(amerikanisch)) return null
  if (amerikanisch >= 100) return 1 + amerikanisch / 100
  if (amerikanisch <= -100) return 1 + 100 / Math.abs(amerikanisch)
  return null
}

/**
 * Dezimalquote in amerikanische Quote.
 *
 * Bei genau 2.0 ist das Ergebnis +100. Unterhalb von 2.0 wird die Quote negativ.
 * Werte bis einschliesslich 1.0 sind keine gueltigen Quoten.
 *
 * @param {number} dezimal
 * @returns {number|null}
 */
export function dezimalNachAmerikanisch(dezimal) {
  if (!Number.isFinite(dezimal) || dezimal <= 1) return null
  const wert = dezimal >= 2 ? (dezimal - 1) * 100 : -100 / (dezimal - 1)
  // Rechnerisch kann der Betrag nie unter 100 liegen. Durch Gleitkommareste knapp an
  // der Grenze 2.0 kann aber 99.9999 herauskommen. Das wird auf die Grenze gezogen,
  // damit nie eine ungueltige Quote entsteht.
  if (Math.abs(wert) < 100) return wert >= 0 ? 100 : -100
  return wert
}

/**
 * Die amerikanische Quote so, wie ein Buchmacher sie anzeigen wuerde.
 *
 * Buchmacher runden den Betrag gegen den Wettenden auf, nicht kaufmaennisch.
 * Aus Dezimalquote 1.64 wird so die Anzeige -157 statt -156.
 * Diese Funktion ist nur fuer die Anzeige gedacht. Gerechnet wird immer mit
 * dezimalNachAmerikanisch, weil das die genaue Umkehrung ist.
 *
 * @param {number} dezimal
 * @returns {number|null}
 */
export function anzeigeAmerikanisch(dezimal) {
  if (!Number.isFinite(dezimal) || dezimal <= 1) return null
  if (dezimal >= 2) return Math.max(100, Math.floor((dezimal - 1) * 100))
  return Math.min(-100, -Math.ceil(100 / (dezimal - 1)))
}

/**
 * Bruchquote in Dezimalquote. 5/2 ergibt 3.5.
 *
 * @param {number} zaehler
 * @param {number} nenner
 * @returns {number|null}
 */
export function bruchNachDezimal(zaehler, nenner) {
  if (!Number.isFinite(zaehler) || !Number.isFinite(nenner) || nenner === 0) return null
  if (zaehler < 0 || nenner < 0) return null
  return 1 + zaehler / nenner
}

/**
 * Implizite Wahrscheinlichkeit einer Dezimalquote, ohne Bereinigung um die Buchmachermarge.
 *
 * @param {number} dezimal
 * @returns {number|null}
 */
export function impliziteWahrscheinlichkeit(dezimal) {
  if (!Number.isFinite(dezimal) || dezimal <= 0) return null
  return 1 / dezimal
}

/**
 * Auszahlung einschliesslich Einsatz.
 *
 * @param {number} einsatz
 * @param {number} dezimal
 * @returns {number|null}
 */
export function auszahlung(einsatz, dezimal) {
  if (!Number.isFinite(einsatz) || !Number.isFinite(dezimal)) return null
  if (einsatz < 0 || dezimal <= 0) return null
  return einsatz * dezimal
}

/**
 * Gewinn ohne Einsatz.
 *
 * @param {number} einsatz
 * @param {number} dezimal
 * @returns {number|null}
 */
export function gewinn(einsatz, dezimal) {
  const gesamt = auszahlung(einsatz, dezimal)
  return gesamt === null ? null : gesamt - einsatz
}

/**
 * Dezimalquote aus Einsatz und Auszahlung.
 *
 * Das ist der genaueste Weg an die Quote heranzukommen, weil Einsatz und Auszahlung
 * ungerundet angezeigt werden, die amerikanische Quote aber gerundet.
 *
 * @param {number} einsatz
 * @param {number} gesamtauszahlung
 * @returns {number|null}
 */
export function dezimalAusBetraegen(einsatz, gesamtauszahlung) {
  if (!Number.isFinite(einsatz) || !Number.isFinite(gesamtauszahlung)) return null
  if (einsatz <= 0) return null
  const d = gesamtauszahlung / einsatz
  return d > 0 ? d : null
}

/**
 * Kombinierte Dezimalquote mehrerer Beine. Leere Liste ergibt null.
 *
 * Achtung bei Kombis aus derselben Begegnung: manche Buchmacher preisen diese
 * abhaengig, dann ist die angezeigte Gesamtquote bewusst NICHT das Produkt der Beine.
 * Deshalb wird das Produkt nie ueber eine angezeigte Gesamtquote drueberbuegelt,
 * sondern nur als Vergleichswert benutzt.
 *
 * @param {number[]} quoten
 * @returns {number|null}
 */
export function kombiquote(quoten) {
  if (!Array.isArray(quoten) || quoten.length === 0) return null
  let produkt = 1
  for (const q of quoten) {
    if (!Number.isFinite(q) || q <= 1) return null
    produkt *= q
  }
  return produkt
}

/**
 * Kombiquote, wenn einzelne Beine annulliert wurden. Annullierte Beine fallen mit Quote 1 heraus.
 *
 * @param {{quote: number, status?: string}[]} beine
 * @returns {number|null}
 */
export function kombiquoteMitAusfall(beine) {
  if (!Array.isArray(beine) || beine.length === 0) return null
  const zaehlende = beine
    .filter((b) => b.status !== 'storniert' && b.status !== 'push')
    .map((b) => b.quote)
  if (zaehlende.length === 0) return 1
  return kombiquote(zaehlende)
}

/**
 * Welche Dezimalquoten passen zu einer angezeigten, ganzzahligen amerikanischen Quote.
 *
 * Beispiel: angezeigt -157 passt zu Dezimalquoten zwischen rund 1.6329 und 1.6410.
 * Die tatsaechlich gesetzte 1.64 liegt darin, obwohl die reine Umrechnung 1.6369 ergibt.
 *
 * @param {number} anzeige      Die angezeigte amerikanische Quote.
 * @param {number} [unschaerfe] Spielraum in ganzen Einheiten, Vorgabe 1.
 * @returns {{min: number, max: number}|null}
 */
export function dezimalSpanneFuerAnzeige(anzeige, unschaerfe = ANZEIGE_UNSCHAERFE) {
  if (!Number.isFinite(anzeige)) return null
  const betrag = Math.abs(anzeige)
  if (betrag < 100) return null

  const unten = Math.max(100, betrag - unschaerfe)
  const oben = betrag + unschaerfe

  if (anzeige < 0) {
    // Je groesser der Betrag, desto kleiner die Dezimalquote.
    const a = amerikanischNachDezimal(-oben)
    const b = amerikanischNachDezimal(-unten)
    if (a === null || b === null) return null
    return { min: Math.min(a, b), max: Math.max(a, b) }
  }
  const a = amerikanischNachDezimal(unten)
  const b = amerikanischNachDezimal(oben)
  if (a === null || b === null) return null
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

/**
 * Prueft, ob eine gemessene Dezimalquote zu einer angezeigten amerikanischen Quote passt.
 *
 * @param {number} gemessen
 * @param {number} anzeige
 * @returns {boolean}
 */
export function passtZuAnzeige(gemessen, anzeige) {
  const spanne = dezimalSpanneFuerAnzeige(anzeige)
  if (spanne === null || !Number.isFinite(gemessen)) return false
  const luft = gemessen * RELATIVE_TOLERANZ
  return gemessen >= spanne.min - luft && gemessen <= spanne.max + luft
}

/**
 * @typedef {object} Versoehnung
 * @property {number|null} einsatz
 * @property {number|null} auszahlung    Moegliche Auszahlung, also Einsatz mal Quote.
 * @property {number|null} ausgezahlt    Tatsaechlicher Rueckfluss, nur bei entschiedenen Scheinen.
 * @property {number|null} dezimal
 * @property {number|null} amerikanisch  Der angezeigte Wert, falls gelesen, sonst berechnet.
 * @property {('gelesen'|'berechnet'|'fehlt')[]} herkunft  Reihenfolge: einsatz, auszahlung, quote
 * @property {{code: string, schwere: 'info'|'warnung'|'fehler', text: string, feld?: string}[]} hinweise
 * @property {boolean} stimmig  true, wenn kein Widerspruch gefunden wurde.
 */

/**
 * Rechnet Einsatz, Quote und Betrag gegeneinander.
 *
 * Das ist die zentrale Gegenrechnung. Sie fuellt fehlende Werte auf und macht
 * Widersprueche sichtbar, statt sie stillschweigend zu ueberschreiben.
 *
 * ENTSCHEIDEND ist der Status, denn davon haengt ab, was der Betrag auf dem Schein bedeutet:
 *
 *   offen oder gewonnen:  Der Betrag ist Einsatz mal Quote. Daraus laesst sich die Quote
 *                         genau zurueckrechnen, weil Einsatz und Betrag ungerundet dastehen,
 *                         die amerikanische Quote aber gerundet ist.
 *   verloren:             Dort steht 0. Quote gleich 0 geteilt durch Einsatz waere Unsinn.
 *   annulliert oder push: Dort steht der Einsatz. Quote gleich 1 waere Unsinn.
 *   vorzeitig ausgezahlt: Dort steht ein frei ausgehandelter Betrag ohne festen Bezug.
 *
 * In den drei letzten Faellen wird die Quote AUSSCHLIESSLICH aus dem Quotenfeld genommen
 * und der Betrag als tatsaechlicher Rueckfluss verbucht.
 *
 * @param {object} eingabe
 * @param {number|null} [eingabe.einsatz]
 * @param {number|null} [eingabe.auszahlung]  Der Betrag, der auf dem Schein steht.
 * @param {number|null} [eingabe.dezimal]
 * @param {number|null} [eingabe.amerikanisch]
 * @param {import('./typen.js').Status} [eingabe.status]
 * @param {boolean} [eingabe.einsatzWirdZurueckgezahlt]  false bei einer Gratiswette.
 * @returns {Versoehnung}
 */
export function versoehne(eingabe) {
  /** @type {{code: string, schwere: 'info'|'warnung'|'fehler', text: string, feld?: string}[]} */
  const hinweise = []

  const status = eingabe.status ?? 'unbekannt'
  const einsatzZurueck = eingabe.einsatzWirdZurueckgezahlt !== false

  let einsatz = zahlOderNull(eingabe.einsatz)
  const betrag = zahlOderNull(eingabe.auszahlung)
  let dezimal = zahlOderNull(eingabe.dezimal)
  let amerikanisch = zahlOderNull(eingabe.amerikanisch)

  /** @type {number|null} */
  let auszahlung = null
  /** @type {number|null} */
  let ausgezahlt = null
  let stimmig = true

  // Amerikanische Quote pruefen und umrechnen.
  let dezimalAusAnzeige = null
  if (amerikanisch !== null) {
    dezimalAusAnzeige = amerikanischNachDezimal(amerikanisch)
    if (dezimalAusAnzeige === null) {
      hinweise.push({
        code: 'quote_ungueltig',
        schwere: 'fehler',
        feld: 'quoteAmerikanisch',
        text:
          `Amerikanische Quote ${amerikanisch} liegt zwischen -100 und +100. ` +
          'So eine Quote gibt es nicht, vermutlich fehlt eine Ziffer.',
      })
      amerikanisch = null
    }
  }

  /** @type {('gelesen'|'berechnet'|'fehlt')[]} */
  const herkunft = [
    einsatz === null ? 'fehlt' : 'gelesen',
    betrag === null ? 'fehlt' : 'gelesen',
    dezimal === null && dezimalAusAnzeige === null ? 'fehlt' : 'gelesen',
  ]

  if (geldZeigtPotenzial(status)) {
    // ---- Fall 1: der Betrag auf dem Schein ist die moegliche Auszahlung. ----
    if (einsatz !== null && einsatz > 0 && betrag !== null && betrag > 0) {
      // Genauester Weg: Quote aus den beiden Betraegen.
      let gemessen = betrag / einsatz
      let betragWarGewinn = false

      if (!einsatzZurueck) {
        // Bei einer Gratiswette wird der Einsatz nicht mit ausgezahlt.
        gemessen = gemessen + 1
        betragWarGewinn = true
      } else if (gemessen <= 1) {
        // Der Betrag ist nicht groesser als der Einsatz. Bei einer echten Quote ueber 1
        // kann das nicht sein. Fast immer ist es eine Gratiswette oder ein reiner Gewinn.
        const alsGewinnGedeutet = gemessen + 1
        if (alsGewinnGedeutet > 1.01) {
          gemessen = alsGewinnGedeutet
          betragWarGewinn = true
          hinweise.push({
            code: 'betrag_ist_gewinn',
            schwere: 'warnung',
            feld: 'auszahlung',
            text:
              'Der angezeigte Betrag ist kleiner als der Einsatz. Das passt nur zu einem reinen ' +
              'Gewinn ohne Einsatz oder zu einer Gratiswette. Bitte pruefen.',
          })
        }
      }

      // Bevor ein Widerspruch gemeldet wird: passt der Betrag vielleicht zum reinen Gewinn?
      // Dann ist es eine Gratiswette oder eine Beschriftung, die den Gewinn statt der
      // Auszahlung zeigt. Das ist kein Fehler und darf keinen Fehlalarm ausloesen.
      const angezeigteQuote = dezimal ?? dezimalAusAnzeige
      const passtAlsQuote =
        angezeigteQuote !== null && nahBei(gemessen, angezeigteQuote, 0.005, 0.002)
      const passtAlsGewinn =
        angezeigteQuote !== null &&
        !passtAlsQuote &&
        nahBei(betrag, einsatz * (angezeigteQuote - 1), GELD_TOLERANZ, 0.002)

      if (passtAlsGewinn && angezeigteQuote !== null) {
        gemessen = angezeigteQuote
        betragWarGewinn = true
        hinweise.push({
          code: 'gratiswette',
          schwere: 'warnung',
          feld: 'auszahlung',
          text:
            'Der angezeigte Betrag entspricht dem reinen Gewinn ohne Einsatz. Das deutet auf eine ' +
            'Gratiswette hin oder darauf, dass der Buchmacher den Gewinn statt der Auszahlung zeigt. ' +
            'Bitte pruefen.',
        })
      } else {
        // Gegen die angezeigte Dezimalquote pruefen.
        if (dezimal !== null && !nahBei(gemessen, dezimal, 0.005, 0.002)) {
          stimmig = false
          hinweise.push({
            code: 'quote_widerspruch',
            schwere: 'warnung',
            feld: 'quoteDezimal',
            text:
              `Aus Einsatz und Betrag ergibt sich Quote ${runde(gemessen, 4)}, ` +
              `gelesen wurde aber ${runde(dezimal, 4)}. Der Wert aus den Betraegen wird verwendet, ` +
              'weil er ungerundet ist.',
          })
        }

        // Gegen die angezeigte amerikanische Quote pruefen.
        if (amerikanisch !== null && !passtZuAnzeige(gemessen, amerikanisch)) {
          stimmig = false
          hinweise.push({
            code: 'quote_widerspruch_us',
            schwere: 'warnung',
            feld: 'quoteAmerikanisch',
            text:
              `Aus Einsatz und Betrag ergibt sich Quote ${runde(gemessen, 4)}. ` +
              `Die angezeigte amerikanische Quote ${amerikanisch} passt dazu nicht.`,
          })
        }
      }

      dezimal = gemessen
      herkunft[2] = 'gelesen'
      // Die moegliche Auszahlung haengt nur daran, ob der Einsatz mit ausgezahlt wird.
      auszahlung = einsatzZurueck ? einsatz * gemessen : einsatz * (gemessen - 1)
      if (status === 'gewonnen') {
        // War der angezeigte Betrag der reine Gewinn, ist der Rueckfluss die volle Auszahlung.
        ausgezahlt = betragWarGewinn ? auszahlung : betrag
      }
    } else if (einsatz !== null && einsatz > 0 && (dezimal !== null || dezimalAusAnzeige !== null)) {
      const d = dezimal ?? dezimalAusAnzeige
      if (d !== null) {
        dezimal = d
        auszahlung = einsatzZurueck ? einsatz * d : einsatz * (d - 1)
        herkunft[1] = 'berechnet'
        hinweise.push({
          code: 'auszahlung_berechnet',
          schwere: 'info',
          feld: 'auszahlung',
          text: 'Die Auszahlung stand nicht im Bild und wurde aus Einsatz mal Quote berechnet.',
        })
        if (status === 'gewonnen') ausgezahlt = auszahlung
      }
    } else if (betrag !== null && betrag > 0 && (dezimal !== null || dezimalAusAnzeige !== null)) {
      const d = dezimal ?? dezimalAusAnzeige
      if (d !== null && d > 1) {
        dezimal = d
        einsatz = einsatzZurueck ? betrag / d : betrag / (d - 1)
        auszahlung = betrag
        herkunft[0] = 'berechnet'
        hinweise.push({
          code: 'einsatz_berechnet',
          schwere: 'info',
          feld: 'einsatz',
          text: 'Der Einsatz stand nicht im Bild und wurde aus Betrag geteilt durch Quote berechnet.',
        })
        if (status === 'gewonnen') ausgezahlt = betrag
      }
    } else {
      if (dezimal === null && dezimalAusAnzeige !== null) dezimal = dezimalAusAnzeige
      if (betrag !== null) auszahlung = betrag
    }
  } else {
    // ---- Fall 2: der Schein ist entschieden und NICHT gewonnen. ----
    // Der Betrag ist der tatsaechliche Rueckfluss und sagt nichts ueber die Quote.
    ausgezahlt = betrag
    if (dezimal === null && dezimalAusAnzeige !== null) {
      dezimal = dezimalAusAnzeige
      herkunft[2] = 'gelesen'
    }
    if (einsatz !== null && dezimal !== null) {
      auszahlung = einsatzZurueck ? einsatz * dezimal : einsatz * (dezimal - 1)
      herkunft[1] = 'berechnet'
    }

    // Gegenprobe: passt der Rueckfluss zu dem, was dieser Status erwarten laesst?
    if (betrag !== null && einsatz !== null) {
      const erwartet = erwarteterRueckfluss(status, einsatz, dezimal, einsatzZurueck)
      if (erwartet.bekannt && erwartet.wert !== null && !nahBei(betrag, erwartet.wert, GELD_TOLERANZ, 0.002)) {
        stimmig = false
        hinweise.push({
          code: 'rueckfluss_widerspruch',
          schwere: 'warnung',
          feld: 'ausgezahlt',
          text:
            `Beim Status "${status}" waeren ${runde(erwartet.wert, 2)} zurueckgeflossen, ` +
            `im Bild stehen aber ${runde(betrag, 2)}. Entweder ist der Status falsch gelesen ` +
            'oder der Betrag. Bitte pruefen.',
        })
      }
    }
  }

  if (dezimal !== null && amerikanisch === null) {
    amerikanisch = dezimalNachAmerikanisch(dezimal)
  }

  // Geldbetraege auf ganze Cent bringen, und zwar genau einmal, hier am Ausgang.
  //
  // Sonst steht im Feld 491.99999999999994 statt 492. Gerechnet wird spaeter zwar
  // ohnehin in ganzen Cent, aber ein solcher Wert im Feld sieht nach Fehler aus
  // und lenkt beim Pruefen von den echten Abweichungen ab.
  // Die Quote bleibt bewusst ungerundet, sie ist kein Geldbetrag.
  if (auszahlung !== null) auszahlung = runde(auszahlung, 2)
  if (ausgezahlt !== null) ausgezahlt = runde(ausgezahlt, 2)
  if (einsatz !== null) einsatz = runde(einsatz, 2)

  if (einsatz !== null && einsatz <= 0) {
    stimmig = false
    hinweise.push({
      code: 'einsatz_ungueltig',
      schwere: 'fehler',
      feld: 'einsatz',
      text: 'Der Einsatz ist null oder negativ. So kann nicht gerechnet werden.',
    })
  }
  if (dezimal !== null && dezimal <= 1) {
    stimmig = false
    hinweise.push({
      code: 'quote_zu_klein',
      schwere: 'fehler',
      feld: 'quoteDezimal',
      text: `Die Quote ${runde(dezimal, 4)} liegt bei oder unter 1.0. Das ergibt keinen Gewinn.`,
    })
  }

  return { einsatz, auszahlung, ausgezahlt, dezimal, amerikanisch, herkunft, hinweise, stimmig }
}

/**
 * Einsatzgewichtete Gesamtquote ueber mehrere Scheine derselben Wette.
 *
 * Formel: Summe aus Einsatz mal Quote, geteilt durch die Summe der Einsaetze.
 * Das ist genau die moegliche Gesamtauszahlung geteilt durch den Gesamteinsatz.
 * Ein einfacher Mittelwert der Quoten waere falsch, sobald die Einsaetze verschieden sind.
 *
 * @param {{einsatz: number, quote: number}[]} posten
 * @returns {number|null}
 */
export function effektiveQuote(posten) {
  if (!Array.isArray(posten) || posten.length === 0) return null
  let einsatzSumme = 0
  let auszahlungSumme = 0
  for (const p of posten) {
    if (!Number.isFinite(p.einsatz) || !Number.isFinite(p.quote)) continue
    if (p.einsatz <= 0 || p.quote <= 0) continue
    einsatzSumme += p.einsatz
    auszahlungSumme += p.einsatz * p.quote
  }
  if (einsatzSumme <= 0) return null
  return auszahlungSumme / einsatzSumme
}

/**
 * Vergleicht zwei Zahlen mit absoluter und relativer Toleranz.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} absolut
 * @param {number} relativ
 * @returns {boolean}
 */
export function nahBei(a, b, absolut, relativ) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  const grenze = Math.max(absolut, Math.abs(b) * relativ)
  return Math.abs(a - b) <= grenze
}

/**
 * @param {unknown} wert
 * @returns {number|null}
 */
function zahlOderNull(wert) {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : null
}
