// @ts-check
/**
 * Zeitpunkte aus Wettscheinen lesen.
 *
 * Viele Buchmacher lassen die Jahreszahl weg, weil sie nur die letzten Monate anzeigen.
 * Aus "Sep 10, 10:42 PM" laesst sich das Jahr nicht ablesen. In dem Fall wird das
 * Bezugsjahr genommen und der Fund als unvollstaendig gekennzeichnet, damit die
 * Oberflaeche es sichtbar macht. Geraten wird nie stillschweigend.
 *
 * Reine Logik. Keine Anzeige.
 */

const MONATE = new Map([
  ['jan', 1], ['january', 1], ['januar', 1], ['jaen', 1], ['jän', 1],
  ['feb', 2], ['february', 2], ['februar', 2],
  ['mar', 3], ['march', 3], ['mrz', 3], ['maerz', 3], ['märz', 3],
  ['apr', 4], ['april', 4],
  ['may', 5], ['mai', 5],
  ['jun', 6], ['june', 6], ['juni', 6],
  ['jul', 7], ['july', 7], ['juli', 7],
  ['aug', 8], ['august', 8],
  ['sep', 9], ['sept', 9], ['september', 9],
  ['oct', 10], ['okt', 10], ['october', 10], ['oktober', 10],
  ['nov', 11], ['november', 11],
  ['dec', 12], ['dez', 12], ['december', 12], ['dezember', 12],
])

/**
 * @typedef {object} Zeitfund
 * @property {string|null} iso        Zeitpunkt als ISO-Zeichenkette ohne Zeitzone, oder null.
 * @property {boolean} jahrGeraten    true, wenn das Jahr nicht im Text stand.
 * @property {boolean} nurDatum       true, wenn keine Uhrzeit gefunden wurde.
 * @property {string} roh             Der Textabschnitt, aus dem gelesen wurde.
 * @property {number} sicherheit
 */

const LEER = { iso: null, jahrGeraten: false, nurDatum: false, roh: '', sicherheit: 0 }

/**
 * Liest einen Zeitpunkt aus einem Textstueck.
 *
 * @param {string} text
 * @param {object} [einstellungen]
 * @param {number} [einstellungen.bezugsjahr]  Jahr, das bei fehlender Jahreszahl gilt.
 * @param {number} [einstellungen.bezugsmonat] Monat 1 bis 12 des Bezugszeitpunkts.
 * @param {'de'|'en'} [einstellungen.gebiet]   Entscheidet bei 10/09 zwischen Tag und Monat.
 * @returns {Zeitfund}
 */
export function leseZeitpunkt(text, einstellungen = {}) {
  if (typeof text !== 'string' || text.trim() === '') return { ...LEER }

  const jetztJahr = einstellungen.bezugsjahr
  const jetztMonat = einstellungen.bezugsmonat
  const gebiet = einstellungen.gebiet ?? 'en'
  const t = text.normalize('NFKC')

  const uhrzeit = leseUhrzeit(t)

  // ISO zuerst, das ist eindeutig.
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso && iso[1] && iso[2] && iso[3]) {
    return baue(+iso[1], +iso[2], +iso[3], uhrzeit, iso[0], false, 0.97)
  }

  // Monatsname, zum Beispiel "Sep 10, 2026" oder "Sep 10" oder "10. Sep 2026".
  const mitName = t.match(
    /(?:(\d{1,2})\.?\s*)?([A-Za-zäöüÄÖÜ]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,\s*|\s+)(\d{4})?/
  )
  if (mitName) {
    const monatWort = (mitName[2] || '').toLowerCase().replace(/\./g, '')
    const monat = MONATE.get(monatWort)
    if (monat) {
      // Steht die Zahl vor dem Monatsnamen, ist sie der Tag ("10. Sep").
      const tag = mitName[1] ? +mitName[1] : +(mitName[3] || 0)
      const jahrText = mitName[4]
      if (tag >= 1 && tag <= 31) {
        if (jahrText) {
          return baue(+jahrText, monat, tag, uhrzeit, mitName[0], false, 0.95)
        }
        const jahr = jahrRaten(monat, jetztJahr, jetztMonat)
        return baue(jahr.jahr, monat, tag, uhrzeit, mitName[0], true, 0.8)
      }
    }
  }

  // Monatsname vor der Zahl ohne Komma, zum Beispiel "Sep 10".
  const kurz = t.match(/([A-Za-zäöüÄÖÜ]{3,9})\.?\s+(\d{1,2})\b(?!\s*[:.]\d)/)
  if (kurz && kurz[1] && kurz[2]) {
    const monat = MONATE.get(kurz[1].toLowerCase().replace(/\./g, ''))
    const tag = +kurz[2]
    if (monat && tag >= 1 && tag <= 31) {
      const jahr = jahrRaten(monat, jetztJahr, jetztMonat)
      return baue(jahr.jahr, monat, tag, uhrzeit, kurz[0], true, 0.78)
    }
  }

  // Rein numerisch: 10.09.2026, 10/09/2026, 09/10/2026, 10.09.26
  const zahlen = t.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (zahlen && zahlen[1] && zahlen[2] && zahlen[3]) {
    const a = +zahlen[1]
    const b = +zahlen[2]
    let jahr = +zahlen[3]
    if (jahr < 100) jahr += jahr < 70 ? 2000 : 1900

    let tag
    let monat
    if (a > 12) {
      tag = a
      monat = b
    } else if (b > 12) {
      tag = b
      monat = a
    } else if (gebiet === 'de') {
      tag = a
      monat = b
    } else {
      // Im englischen Raum steht bei Punkt und Bindestrich meist der Tag zuerst,
      // beim Schraegstrich meist der Monat.
      const schraeg = zahlen[0].includes('/')
      tag = schraeg ? b : a
      monat = schraeg ? a : b
    }
    if (monat >= 1 && monat <= 12 && tag >= 1 && tag <= 31) {
      const eindeutig = a > 12 || b > 12
      return baue(jahr, monat, tag, uhrzeit, zahlen[0], false, eindeutig ? 0.95 : 0.75)
    }
  }

  // Nur ohne Datum, aber mit Uhrzeit: das ist zu wenig fuer einen Zeitpunkt.
  return { ...LEER, roh: uhrzeit ? uhrzeit.roh : '' }
}

/**
 * @param {string} text
 * @returns {{stunde: number, minute: number, roh: string}|null}
 */
function leseUhrzeit(text) {
  const mitHalbtag = text.match(/\b(\d{1,2})[:.](\d{2})\s*([AP])\.?\s?M\.?\b/i)
  if (mitHalbtag && mitHalbtag[1] && mitHalbtag[2] && mitHalbtag[3]) {
    let stunde = +mitHalbtag[1]
    const minute = +mitHalbtag[2]
    const nachmittag = mitHalbtag[3].toUpperCase() === 'P'
    if (stunde === 12) stunde = 0
    if (nachmittag) stunde += 12
    if (stunde <= 23 && minute <= 59) {
      return { stunde, minute, roh: mitHalbtag[0] }
    }
  }
  // Nur der Doppelpunkt gilt als Trennzeichen einer Uhrzeit. Der Punkt wuerde sonst
  // aus dem Datum 10.09.2026 die Uhrzeit 10:09 machen.
  const mitDoppelpunkt = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/)
  if (mitDoppelpunkt && mitDoppelpunkt[1] && mitDoppelpunkt[2]) {
    return { stunde: +mitDoppelpunkt[1], minute: +mitDoppelpunkt[2], roh: mitDoppelpunkt[0] }
  }

  // Die deutsche Schreibweise mit Punkt nur dann, wenn das Wort Uhr danebensteht.
  const mitUhr = text.match(/\b([01]?\d|2[0-3])\.([0-5]\d)\s*Uhr\b/i)
  if (mitUhr && mitUhr[1] && mitUhr[2]) {
    return { stunde: +mitUhr[1], minute: +mitUhr[2], roh: mitUhr[0] }
  }

  return null
}

/**
 * Waehlt das Jahr, wenn im Text keines stand.
 *
 * Zeigt der Buchmacher einen Monat, der spaeter im Jahr liegt als der Bezugsmonat,
 * stammt der Schein aus dem Vorjahr. Sonst aus dem Bezugsjahr.
 *
 * @param {number} monat
 * @param {number|undefined} bezugsjahr
 * @param {number|undefined} bezugsmonat
 * @returns {{jahr: number}}
 */
function jahrRaten(monat, bezugsjahr, bezugsmonat) {
  if (typeof bezugsjahr !== 'number' || !Number.isFinite(bezugsjahr)) {
    return { jahr: 1970 }
  }
  if (typeof bezugsmonat !== 'number' || !Number.isFinite(bezugsmonat)) {
    return { jahr: bezugsjahr }
  }
  // Ein Vorsprung von einem Monat wird geduldet, wegen Zeitzonen und Monatswechsel.
  if (monat > bezugsmonat + 1) return { jahr: bezugsjahr - 1 }
  return { jahr: bezugsjahr }
}

/**
 * @param {number} jahr
 * @param {number} monat
 * @param {number} tag
 * @param {{stunde: number, minute: number, roh: string}|null} uhrzeit
 * @param {string} roh
 * @param {boolean} jahrGeraten
 * @param {number} sicherheit
 * @returns {Zeitfund}
 */
function baue(jahr, monat, tag, uhrzeit, roh, jahrGeraten, sicherheit) {
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31 || jahr < 1970 || jahr > 2200) {
    return { ...LEER, roh }
  }
  // Auf echte Kalendertage pruefen, damit der 31. Februar nicht durchrutscht.
  const probe = new Date(Date.UTC(jahr, monat - 1, tag))
  if (probe.getUTCMonth() !== monat - 1 || probe.getUTCDate() !== tag) {
    return { ...LEER, roh }
  }

  const zwei = (n) => String(n).padStart(2, '0')
  const datumTeil = `${jahr}-${zwei(monat)}-${zwei(tag)}`
  if (!uhrzeit) {
    return { iso: `${datumTeil}T00:00`, jahrGeraten, nurDatum: true, roh, sicherheit: sicherheit * 0.9 }
  }
  return {
    iso: `${datumTeil}T${zwei(uhrzeit.stunde)}:${zwei(uhrzeit.minute)}`,
    jahrGeraten,
    nurDatum: false,
    roh: `${roh} ${uhrzeit.roh}`.trim(),
    sicherheit,
  }
}
