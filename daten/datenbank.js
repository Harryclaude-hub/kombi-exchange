// @ts-check
/**
 * Zugriff auf die Datenbank.
 *
 * Bewusst ohne fremde Bibliothek, nur mit fetch. Es werden ausschliesslich
 * Funktionen aufgerufen, nie Tabellen. Die Tabellen sind von aussen gar nicht
 * erreichbar, siehe supabase/migrations.
 *
 * Drei Zustaende, nie zwei. Ein leeres Ergebnis ist etwas anderes als ein Fehler,
 * und beides ist etwas anderes als Erfolg mit Daten. Wer das vermischt, sucht
 * spaeter stundenlang nach Daten, die nie angekommen sind.
 */

import { DATENBANK } from './einstellungen.js'

/**
 * @typedef {object} Antwort
 * @template T
 * @property {'daten'|'leer'|'fehler'} art
 * @property {T|null} daten
 * @property {string} meldung
 * @property {string} code
 */

/** Wie lange auf die Datenbank gewartet wird, bevor abgebrochen wird. */
const WARTEZEIT = 20000

/**
 * Ruft eine Datenbankfunktion auf.
 *
 * @param {string} name
 * @param {Record<string, unknown>} argumente
 * @returns {Promise<{art: 'daten'|'leer'|'fehler', daten: any, meldung: string, code: string}>}
 */
export async function rufe(name, argumente = {}) {
  const abbruch = new AbortController()
  const wecker = setTimeout(() => abbruch.abort(), WARTEZEIT)

  try {
    const antwort = await fetch(`${DATENBANK.adresse}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: DATENBANK.schluessel,
        Authorization: `Bearer ${DATENBANK.schluessel}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(argumente),
      signal: abbruch.signal,
    })

    const text = await antwort.text()
    let inhalt = null
    if (text) {
      try {
        inhalt = JSON.parse(text)
      } catch {
        inhalt = text
      }
    }

    if (!antwort.ok) {
      const meldung =
        (inhalt && typeof inhalt === 'object' && (inhalt.message || inhalt.hint || inhalt.details)) ||
        `Die Datenbank antwortet mit ${antwort.status}.`
      const code =
        (inhalt && typeof inhalt === 'object' && inhalt.code) || String(antwort.status)
      return { art: 'fehler', daten: null, meldung: String(meldung), code: String(code) }
    }

    const leer =
      inhalt === null ||
      inhalt === undefined ||
      (Array.isArray(inhalt) && inhalt.length === 0)

    return {
      art: leer ? 'leer' : 'daten',
      daten: inhalt,
      meldung: '',
      code: '',
    }
  } catch (fehler) {
    const abgebrochen = fehler instanceof DOMException && fehler.name === 'AbortError'
    return {
      art: 'fehler',
      daten: null,
      meldung: abgebrochen
        ? 'Die Datenbank hat nicht rechtzeitig geantwortet.'
        : `Verbindung zur Datenbank fehlgeschlagen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
      code: abgebrochen ? 'zeitablauf' : 'verbindung',
    }
  } finally {
    clearTimeout(wecker)
  }
}

/**
 * Loest den Sperrcode ein.
 *
 * @param {string} code
 * @returns {Promise<{gelungen: boolean, token: string, laeuftAb: string, meldung: string}>}
 */
export async function loeseCodeEin(code) {
  const antwort = await rufe('kombi_code_einloesen', { p_code: code })

  if (antwort.art === 'fehler') {
    return { gelungen: false, token: '', laeuftAb: '', meldung: antwort.meldung }
  }
  const erste = Array.isArray(antwort.daten) ? antwort.daten[0] : antwort.daten
  if (!erste || !erste.token) {
    return {
      gelungen: false,
      token: '',
      laeuftAb: '',
      meldung: 'Die Datenbank hat keinen Zugang zurueckgegeben.',
    }
  }
  return {
    gelungen: true,
    token: String(erste.token),
    laeuftAb: String(erste.laeuft_ab ?? ''),
    meldung: '',
  }
}

/**
 * Prueft, ob ein gemerkter Zugang noch gilt.
 *
 * @param {string} token
 * @returns {Promise<{gueltig: boolean, erreichbar: boolean, meldung: string}>}
 */
export async function pruefeSitzung(token) {
  if (!token) return { gueltig: false, erreichbar: true, meldung: '' }
  const antwort = await rufe('kombi_sitzung_pruefen', { p_token: token })
  if (antwort.art === 'fehler') {
    // Wichtig: nicht erreichbar ist NICHT dasselbe wie ungueltig. Wer das
    // gleichsetzt, wirft den Nutzer bei jedem Netzaussetzer hinaus.
    return { gueltig: false, erreichbar: false, meldung: antwort.meldung }
  }
  return { gueltig: antwort.daten === true, erreichbar: true, meldung: '' }
}

/**
 * Alle Projekte holen.
 *
 * @param {string} token
 * @returns {Promise<{art: 'daten'|'leer'|'fehler', daten: any, meldung: string, code: string}>}
 */
export function holeProjekte(token) {
  return rufe('kombi_projekte_lesen', { p_token: token })
}

/**
 * @param {string} token
 * @param {import('../kern/typen.js').Projekt} projekt
 */
export function speichereProjekt(token, projekt) {
  return rufe('kombi_projekt_speichern', {
    p_token: token,
    p_projekt: {
      id: projekt.id,
      name: projekt.name,
      notiz: projekt.notiz,
      waehrung: projekt.waehrung,
      angelegtAm: projekt.angelegtAm,
    },
  })
}

/**
 * @param {string} token
 * @param {string} projektId
 */
export function loescheProjekt(token, projektId) {
  return rufe('kombi_projekt_loeschen', { p_token: token, p_id: projektId })
}

/**
 * Holt alle Scheine eines Projekts, seitenweise.
 *
 * Die Datenbank liefert hoechstens 1000 Zeilen auf einmal. Bei mehr wird
 * weitergeblaettert, statt eine zu grosse Antwort zu erzwingen, die in einen
 * Fehler laeuft.
 *
 * @param {string} token
 * @param {string} projektId
 * @returns {Promise<{art: 'daten'|'leer'|'fehler', daten: import('../kern/typen.js').Schein[], meldung: string, code: string}>}
 */
export async function holeScheine(token, projektId) {
  /** @type {import('../kern/typen.js').Schein[]} */
  const alle = []
  const seitengroesse = 500
  let versatz = 0

  for (;;) {
    const antwort = await rufe('kombi_scheine_lesen', {
      p_token: token,
      p_projekt: projektId,
      p_limit: seitengroesse,
      p_offset: versatz,
    })
    if (antwort.art === 'fehler') {
      return { art: 'fehler', daten: alle, meldung: antwort.meldung, code: antwort.code }
    }
    const zeilen = Array.isArray(antwort.daten) ? antwort.daten : []
    for (const zeile of zeilen) {
      if (zeile && zeile.daten) alle.push(zeile.daten)
    }
    if (zeilen.length < seitengroesse) break
    versatz += seitengroesse
    if (versatz > 20000) break
  }

  return {
    art: alle.length === 0 ? 'leer' : 'daten',
    daten: alle,
    meldung: '',
    code: '',
  }
}

/**
 * Speichert Scheine. Wird selbst in Haeppchen geteilt, weil die Datenbank
 * fuer anonyme Aufrufe nur drei Sekunden Rechenzeit gibt.
 *
 * @param {string} token
 * @param {string} projektId
 * @param {import('../kern/typen.js').Schein[]} scheine
 * @returns {Promise<{gelungen: boolean, anzahl: number, meldung: string}>}
 */
export async function speichereScheine(token, projektId, scheine) {
  const haeppchen = 200
  let gesamt = 0

  for (let i = 0; i < scheine.length; i += haeppchen) {
    const teil = scheine.slice(i, i + haeppchen)
    const antwort = await rufe('kombi_scheine_speichern', {
      p_token: token,
      p_projekt: projektId,
      p_scheine: teil,
    })
    if (antwort.art === 'fehler') {
      return {
        gelungen: false,
        anzahl: gesamt,
        meldung: `${antwort.meldung} (${gesamt} von ${scheine.length} waren schon gespeichert)`,
      }
    }
    gesamt += Number(antwort.daten ?? teil.length)
  }

  return { gelungen: true, anzahl: gesamt, meldung: '' }
}

/**
 * @param {string} token
 * @param {string} scheinId
 */
export function loescheSchein(token, scheinId) {
  return rufe('kombi_schein_loeschen', { p_token: token, p_id: scheinId })
}

/**
 * @param {string} token
 * @param {string} projektId
 */
export function holeRiesenscheine(token, projektId) {
  return rufe('kombi_riesenscheine_lesen', { p_token: token, p_projekt: projektId })
}

/**
 * @param {string} token
 * @param {string} projektId
 * @param {import('../kern/typen.js').Riesenschein[]} liste
 */
export function speichereRiesenscheine(token, projektId, liste) {
  return rufe('kombi_riesenscheine_speichern', {
    p_token: token,
    p_projekt: projektId,
    p_liste: liste,
  })
}

/**
 * @param {string} token
 * @param {string} projektId
 */
export function holeBilder(token, projektId) {
  return rufe('kombi_bilder_lesen', { p_token: token, p_projekt: projektId })
}

/**
 * @param {string} token
 * @param {string} projektId
 * @param {import('../kern/typen.js').Bild[]} liste
 */
export function speichereBilder(token, projektId, liste) {
  // Das Bild selbst bleibt im Browser. Hier gehen nur die Angaben dazu hinaus.
  const ohneInhalt = liste.map((b) => ({
    id: b.id,
    dateiname: b.dateiname,
    breite: b.breite,
    hoehe: b.hoehe,
    pruefsumme: b.pruefsumme,
    buchmacher: b.buchmacher,
    konto: b.konto,
    adresse: null,
  }))
  return rufe('kombi_bilder_speichern', {
    p_token: token,
    p_projekt: projektId,
    p_liste: ohneInhalt,
  })
}
