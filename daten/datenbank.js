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
import { VORSILBE, TUEREN, istEigeneTuer } from './grenze.js'

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
 * Fehlercode der Datenbank, wenn jemand anderes schneller war.
 *
 * Das ist KEIN Fehler im Sinne von kaputt. Es heisst: dieses Fenster arbeitet
 * mit einem veralteten Stand, und die Datenbank hat deshalb nichts
 * ueberschrieben. Die Oberflaeche muss das anders behandeln als einen Ausfall,
 * sonst wirkt ein bewusst verhinderter Datenverlust wie eine Stoerung.
 */
export const WIDERSPRUCH = 'K0409'

/** Fehlercode, wenn das Projekt inzwischen geloescht wurde. */
export const PROJEKT_WEG = 'K0404'

// Weitergereicht, damit niemand eine zweite Fassung davon anlegt.
export { VORSILBE, TUEREN } from './grenze.js'

/*
  DIE GRENZE ZWISCHEN DEN PROGRAMMEN, UND SIE STEHT HIER AM EINZIGEN DURCHLASS.

  Karam am 18.09.2026: "Mach klare Trennungen zwischen den Projekten in der
  Datenbank. Ich will nie, dass sich irgendwas mischt. Und auch fuer die neuen
  Chats, wenn ich da was arbeite und mit der Datenbank mache, muss das wirklich
  klar getrennt sein, keine Fehler, kein Durcheinander."

  In derselben Supabase-Datenbank liegen drei Programme:

    Kombi Exchange   Schema kombi, Tueren public.kombi_*   (dieses hier)
    Kombi Tafel      public.kt_*                            22 Tabellen
    immo-check       public, ohne Vorsilbe                  13 Tabellen

  Am 18.09.2026 in der laufenden Datenbank nachgemessen: keine einzige
  kombi-Funktion greift nach draussen, keine fremde Funktion greift nach kombi,
  und ueber die Schemagrenze laeuft kein einziger Fremdschluessel. Kombi
  Exchange benutzt nicht einmal die Anmeldung von Supabase, sondern den eigenen
  Sperrcode. Die Trennung ist heute vollstaendig.

  Sie bleibt es aber nicht von selbst. Ein spaeterer Chat, der schnell etwas
  nachsehen will, schreibt rufe('kt_wetten_lesen') und hat die Grenze
  uebertreten, ohne es zu merken. Eine Anleitung in einer Datei haette das nicht
  verhindert, denn Anleitungen werden ueberlesen. Diese Wand nicht.

  WAS SIE NICHT LEISTET: sie prueft Namen, die durch rufe() gehen. Wer in einer
  neuen Datei selbst ein fetch auf /rest/v1/ baut, kommt an ihr vorbei. Genau
  das faengt die Regel "eine einzige Tuer" in werkzeug/pruefe.mjs ab: ausser
  dieser Datei und einstellungen.js darf keine einzige die Adresse der Datenbank
  auch nur erwaehnen.

  Die Namen selbst stehen in daten/grenze.js und nirgends sonst.
*/

/**
 * Laesst nur Namen durch, die zu diesem Programm gehoeren.
 *
 * Wirft mit Absicht, statt einen Fehler zurueckzugeben. Ein falscher Name ist
 * kein Betriebsfall wie ein Netzausfall, sondern ein Fehler im Quelltext. Der
 * muss beim ersten Versuch krachen und nicht als stille rote Meldung
 * durchrutschen, die man fuer ein Netzproblem haelt.
 *
 * @param {string} name
 */
function verlangeEigeneTuer(name) {
  if (istEigeneTuer(name)) return

  const nah = TUEREN.filter((t) => typeof name === 'string' && t.startsWith(String(name).slice(0, 12)))
  const tipp = nah.length > 0 ? ` Gemeint war vielleicht: ${nah.join(', ')}.` : ''

  throw new Error(
    `"${name}" ist keine Tuer von Kombi Exchange. In dieser Datenbank liegen ` +
      `mehrere Programme nebeneinander: Kombi Exchange kennt genau ${TUEREN.length} ` +
      `Funktionen, alle mit der Vorsilbe "${VORSILBE}". Alles andere gehoert Kombi ` +
      'Tafel (kt_) oder immo-check und wird von hier aus nie angefasst.' +
      tipp +
      ' Wer wirklich eine neue Tuer braucht, legt sie in supabase/migrations/ an ' +
      'und traegt sie in daten/grenze.js ein.'
  )
}

/**
 * Ruft eine Datenbankfunktion auf.
 *
 * @param {string} name
 * @param {Record<string, unknown>} argumente
 * @returns {Promise<{art: 'daten'|'leer'|'fehler', daten: any, meldung: string, code: string}>}
 */
export async function rufe(name, argumente = {}) {
  verlangeEigeneTuer(name)

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

  // Die Datenbank meldet einen abgelehnten Code als Ergebnis, nicht als Fehler.
  // Das ist Absicht: eine Ausnahme wuerde den Zaehler der Fehlversuche wieder
  // zurueckrollen, und dann griffe die Bremse gegen Durchprobieren nie.
  // Siehe supabase/migrations/0006.
  if (erste?.fehler) {
    return { gelungen: false, token: '', laeuftAb: '', meldung: String(erste.fehler) }
  }

  if (!erste || !erste.token) {
    return {
      gelungen: false,
      token: '',
      laeuftAb: '',
      meldung: 'Die Datenbank hat keinen Zugang zurückgegeben.',
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
export function speichereProjekt(token, projekt, fassung = null) {
  return rufe('kombi_projekt_speichern', {
    p_token: token,
    p_fassung: fassung,
    p_projekt: {
      id: projekt.id,
      name: projekt.name,
      notiz: projekt.notiz,
      waehrung: projekt.waehrung,
      angelegtAm: projekt.angelegtAm,
      // Ablage: Ordner und Pin. Fehlt eines davon im Aufruf, laesst die
      // Datenbank den alten Wert stehen (coalesce in Migration 0008). Deshalb
      // werden sie nur mitgeschickt, wenn sie am Projekt wirklich stehen.
      ordner: projekt.ordner ?? null,
      angepinnt: projekt.angepinnt ?? null,
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
 * Leert ein Projekt, ohne es zu loeschen. Scheine, Riesenscheine und Bildangaben
 * gehen weg, das Projekt selbst bleibt bestehen.
 *
 * @param {string} token
 * @param {string} projektId
 */
export function leereProjekt(token, projektId) {
  return rufe('kombi_projekt_leeren', { p_token: token, p_id: projektId })
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
export async function speichereScheine(token, projektId, scheine, fassung = null) {
  const haeppchen = 200
  let gesamt = 0
  let stand = fassung

  for (let i = 0; i < scheine.length; i += haeppchen) {
    const teil = scheine.slice(i, i + haeppchen)
    const antwort = await rufe('kombi_scheine_speichern', {
      p_token: token,
      p_projekt: projektId,
      p_scheine: teil,
      p_fassung: stand,
    })
    if (antwort.art === 'fehler') {
      return {
        gelungen: false,
        anzahl: gesamt,
        fassung: stand,
        widerspruch: antwort.code === WIDERSPRUCH,
        meldung: `${antwort.meldung} (${gesamt} von ${scheine.length} waren schon gespeichert)`,
      }
    }
    // Jedes Haeppchen zaehlt die Fassung hoch. Die neue muss ins naechste,
    // sonst laeuft der eigene Speichervorgang gegen sich selbst.
    stand = fassungAus(antwort.daten?.fassung)
    gesamt += Number(antwort.daten?.anzahl ?? teil.length)
  }

  return { gelungen: true, anzahl: gesamt, fassung: stand, widerspruch: false, meldung: '' }
}

/**
 * Liest die Fassung aus einer Antwort. Alles Unlesbare wird null, nie 0:
 * eine geratene Fassung wuerde beim naechsten Speichern einen Widerspruch
 * ausloesen, der keiner ist.
 *
 * GEFUNDEN AM 19.09.2026: hier stand ein Aufruf von zahlOderNull, und diese
 * Funktion gibt es in dieser Datei gar nicht (sie ist eine PRIVATE Funktion
 * von kern/quoten.js). Das Speichern warf deshalb nach dem ersten
 * erfolgreichen Haeppchen einen ReferenceError, der im verzoegert-Wecker als
 * unbehandelte Ablehnung verschwand: das Haeppchen lag in der Datenbank, das
 * Programm behielt die alte Fassung, und jeder weitere Lauf waere als
 * "zweites Fenster" abgelehnt worden. test/datenbank_speichern.test.mjs
 * stellt genau das nach.
 *
 * @param {unknown} wert
 * @returns {number|null}
 */
function fassungAus(wert) {
  const zahl = Number(wert)
  return Number.isFinite(zahl) ? zahl : null
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
export function speichereRiesenscheine(token, projektId, liste, fassung = null) {
  return rufe('kombi_riesenscheine_speichern', {
    p_token: token,
    p_projekt: projektId,
    p_liste: liste,
    p_fassung: fassung,
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
export function speichereBilder(token, projektId, liste, fassung = null) {
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
    p_fassung: fassung,
  })
}

/**
 * Wechselt den Zugangscode.
 *
 * Verlangt ausdruecklich den bisherigen Code, nicht nur eine gueltige Sitzung.
 * Sonst koennte jemand, der einmal an einem offenen Fenster sass, den Code
 * aendern und alle anderen aussperren.
 *
 * Alle anderen Sitzungen werden dabei geschlossen. Genau dafuer wechselt man:
 * der alte Code ist irgendwo gelandet, wo er nicht hingehoert.
 *
 * @param {string} token
 * @param {string} alt
 * @param {string} neu
 * @returns {Promise<{gelungen: boolean, hinausgeworfen: number, meldung: string}>}
 */
export async function wechsleCode(token, alt, neu) {
  const antwort = await rufe('kombi_code_wechseln', {
    p_token: token,
    p_alt: alt,
    p_neu: neu,
  })

  if (antwort.art === 'fehler') {
    return { gelungen: false, hinausgeworfen: 0, meldung: antwort.meldung }
  }

  // Auch hier meldet die Datenbank ein Scheitern als Ergebnis, damit der
  // Zaehler der Fehlversuche stehenbleibt. Siehe supabase/migrations/0006.
  if (!antwort.daten?.gelungen) {
    return {
      gelungen: false,
      hinausgeworfen: 0,
      meldung: String(antwort.daten?.fehler ?? 'Der Wechsel hat nicht geklappt.'),
    }
  }

  return {
    gelungen: true,
    hinausgeworfen: Number(antwort.daten?.hinausgeworfen ?? 0),
    meldung: '',
  }
}

/**
 * Erzeugt einen neuen Zugangscode.
 *
 * Gezogen wird aus dem Zufallsgenerator des Browsers, nicht aus Math.random.
 * Weggelassen sind Zeichen, die man sich beim Vorlesen oder Abtippen verhaut:
 * 0 und O, 1 und I und L.
 *
 * @returns {string}
 */
export function wuerfleCode() {
  const zeichen = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const roh = new Uint32Array(12)
  crypto.getRandomValues(roh)

  const teile = []
  for (let gruppe = 0; gruppe < 3; gruppe++) {
    let block = ''
    for (let i = 0; i < 4; i++) {
      const wert = roh[gruppe * 4 + i] ?? 0
      block += zeichen[wert % zeichen.length]
    }
    teile.push(block)
  }
  return `KMB-${teile.join('-')}`
}
