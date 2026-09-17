// @ts-check
/**
 * Bildablage im Browser.
 *
 * Die Bildschirmfotos bleiben auf dem Geraet. Sie werden nie hochgeladen, denn
 * gelesen werden sie ohnehin hier, und hochgeladen waeren sie nur ein Risiko.
 * In die Datenbank gehen ausschliesslich die gelesenen Zahlen.
 *
 * Gespeichert wird in der Datenbank des Browsers, nicht im einfachen Speicher.
 * Der einfache Speicher fasst nur wenige Megabyte, ein einziges Bildschirmfoto
 * belegt davon schon einen grossen Teil.
 */

const DATENBANKNAME = 'kombi-exchange'
const FASSUNG = 1
const LAGER_BILDER = 'bilder'
const LAGER_STAND = 'stand'

/** @type {Promise<IDBDatabase>|null} */
let verbindung = null

/**
 * Oeffnet die Browserdatenbank.
 *
 * @returns {Promise<IDBDatabase>}
 */
function oeffne() {
  if (verbindung) return verbindung

  verbindung = new Promise((erfuellen, ablehnen) => {
    if (!('indexedDB' in globalThis)) {
      ablehnen(new Error('Dieser Browser kennt keine lokale Datenbank. Bilder können nicht gemerkt werden.'))
      return
    }
    const anfrage = indexedDB.open(DATENBANKNAME, FASSUNG)

    anfrage.onupgradeneeded = () => {
      const db = anfrage.result
      if (!db.objectStoreNames.contains(LAGER_BILDER)) {
        const lager = db.createObjectStore(LAGER_BILDER, { keyPath: 'id' })
        lager.createIndex('projekt', 'projektId', { unique: false })
        lager.createIndex('pruefsumme', 'pruefsumme', { unique: false })
      }
      if (!db.objectStoreNames.contains(LAGER_STAND)) {
        db.createObjectStore(LAGER_STAND, { keyPath: 'schluessel' })
      }
    }
    anfrage.onsuccess = () => erfuellen(anfrage.result)
    anfrage.onerror = () => {
      verbindung = null
      ablehnen(anfrage.error ?? new Error('Die lokale Datenbank ließ sich nicht öffnen.'))
    }
    anfrage.onblocked = () => {
      ablehnen(new Error('Die lokale Datenbank ist von einem anderen Fenster belegt. Bitte andere Fenster schließen.'))
    }
  })

  return verbindung
}

/**
 * @template T
 * @param {string} lager
 * @param {IDBTransactionMode} art
 * @param {(lager: IDBObjectStore) => IDBRequest} arbeit
 * @returns {Promise<T>}
 */
async function imLager(lager, art, arbeit) {
  const db = await oeffne()
  return new Promise((erfuellen, ablehnen) => {
    const vorgang = db.transaction(lager, art)
    const anfrage = arbeit(vorgang.objectStore(lager))
    anfrage.onsuccess = () => erfuellen(/** @type {any} */ (anfrage.result))
    anfrage.onerror = () => ablehnen(anfrage.error ?? new Error('Die lokale Datenbank meldet einen Fehler.'))
  })
}

/**
 * Legt ein Bild ab.
 *
 * @param {{id: string, projektId: string, dateiname: string, pruefsumme: string, breite: number, hoehe: number, inhalt: Blob}} bild
 * @returns {Promise<void>}
 */
export async function legeBildAb(bild) {
  await imLager(LAGER_BILDER, 'readwrite', (lager) => lager.put(bild))
}

/**
 * Holt ein Bild.
 *
 * @param {string} id
 * @returns {Promise<{id: string, projektId: string, dateiname: string, pruefsumme: string, breite: number, hoehe: number, inhalt: Blob}|null>}
 */
export async function holeBild(id) {
  const treffer = await imLager(LAGER_BILDER, 'readonly', (lager) => lager.get(id))
  return /** @type {any} */ (treffer ?? null)
}

/**
 * Holt alle Bilder eines Projekts.
 *
 * @param {string} projektId
 * @returns {Promise<any[]>}
 */
export async function holeBilderZuProjekt(projektId) {
  const db = await oeffne()
  return new Promise((erfuellen, ablehnen) => {
    const vorgang = db.transaction(LAGER_BILDER, 'readonly')
    const anfrage = vorgang.objectStore(LAGER_BILDER).index('projekt').getAll(projektId)
    anfrage.onsuccess = () => erfuellen(anfrage.result ?? [])
    anfrage.onerror = () => ablehnen(anfrage.error ?? new Error('Die Bilder liessen sich nicht laden.'))
  })
}

/**
 * Loescht ein Bild.
 *
 * @param {string} id
 */
export async function loescheBild(id) {
  await imLager(LAGER_BILDER, 'readwrite', (lager) => lager.delete(id))
}

/**
 * Merkt den Arbeitsstand, damit nach einem Neuladen nichts verloren ist.
 *
 * @param {string} schluessel
 * @param {unknown} wert
 */
export async function merkeStand(schluessel, wert) {
  await imLager(LAGER_STAND, 'readwrite', (lager) => lager.put({ schluessel, wert }))
}

/**
 * @param {string} schluessel
 * @returns {Promise<any>}
 */
export async function holeStand(schluessel) {
  const treffer = await imLager(LAGER_STAND, 'readonly', (lager) => lager.get(schluessel))
  return /** @type {any} */ (treffer)?.wert ?? null
}

/**
 * Fingerabdruck einer Datei, gegen doppeltes Hochladen derselben Datei.
 *
 * @param {Blob} datei
 * @returns {Promise<string>}
 */
export async function pruefsumme(datei) {
  const puffer = await datei.arrayBuffer()
  if (!globalThis.crypto?.subtle) {
    // Ohne Verschluesselungsdienste behelfen wir uns mit Groesse und Art.
    return `ohne-pruefsumme-${datei.size}-${datei.type}`
  }
  const abdruck = await crypto.subtle.digest('SHA-256', puffer)
  return [...new Uint8Array(abdruck)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Wie viel die Bilder EINES PROJEKTS belegen, und wie viele es sind.
 *
 * Karam am 17.09.2026: "Wie viel Speicher habe ich bei Supabase, und wie viele
 * Fotos koennte das aushalten? Weil ich glaube, wir sind schon bei 10 bis
 * 100.000 Fotos in der Saison, wenn nicht mehr."
 *
 * Bei der Frage kommt es auf die MITTLERE GROESSE eines Fotos an, und die
 * haengt an seinem Geraet und seiner Aufnahmeart. Raten hilft da nicht: der
 * Unterschied zwischen 200 Kilobyte und 2 Megabyte ist der Unterschied
 * zwischen 20 und 200 Gigabyte in der Saison.
 *
 * Deshalb misst das Programm es. Nach einem Spieltag steht die echte Zahl da.
 *
 * Unterschied zu platz(): das hier zaehlt NUR die Bilder dieses Projekts,
 * platz() fragt den Browser nach allem, was die Seite belegt, einschliesslich
 * anderer Projekte und des gemerkten Arbeitsstands.
 *
 * @param {string} projektId
 * @returns {Promise<{anzahl: number, bytes: number, mittel: number}>}
 */
export async function bildmass(projektId) {
  try {
    const bilder = await holeBilderZuProjekt(projektId)
    let bytes = 0
    let anzahl = 0
    for (const b of bilder) {
      // Ein Eintrag ohne Inhalt zaehlt NICHT mit. Sonst zoege er den Mittelwert
      // nach unten und die Hochrechnung waere zu guenstig.
      const groesse = b?.inhalt?.size
      if (typeof groesse !== 'number' || groesse <= 0) continue
      bytes += groesse
      anzahl += 1
    }
    return { anzahl, bytes, mittel: anzahl > 0 ? Math.round(bytes / anzahl) : 0 }
  } catch {
    // Ohne Browserdatenbank gibt es nichts zu messen. Dann steht die Zeile
    // ohne Zahl da, statt eine erfundene zu zeigen (Projektregel 1).
    return { anzahl: 0, bytes: 0, mittel: 0 }
  }
}

/**
 * Bittet den Browser, die Bilder DAUERHAFT zu behalten.
 *
 * Karam am 17.09.2026: "Ich will wirklich, dass immer die Fotos gespeichert
 * bleiben, dann geht nichts verloren, wenn man etwas im Browser besucht. Das
 * ist mir sehr wichtig, sehr, sehr wichtig."
 *
 * WOVOR DAS SCHUETZT, UND WOVOR NICHT
 *
 * Ein Browser raeumt seinen Speicher von selbst auf, wenn die Platte eng wird.
 * Er sucht sich dann Seiten aus, deren Daten er wegwerfen kann, und eine Seite,
 * die man selten besucht, ist ein guter Kandidat. Genau das ist Karams Sorge,
 * und sie ist berechtigt: die Bilder liegen nur hier.
 *
 * navigator.storage.persist() markiert den Speicher dieser Seite als dauerhaft.
 * Danach wirft der Browser NICHTS mehr von selbst weg. Das ist kein Vertrag und
 * keine Sicherung, es ist genau eine Zusage: nicht ohne Zutun.
 *
 * Es schuetzt NICHT davor, dass jemand die Browserdaten von Hand loescht, und
 * es macht die Bilder nicht auf einem zweiten Geraet sichtbar. Wer beides
 * braucht, braucht eine Kopie ausserhalb des Browsers.
 *
 * KEINE RUECKFRAGE. Chrome und Edge entscheiden still, meistens ja, wenn die
 * Seite regelmaessig benutzt wird. Firefox fragt. Ein Nein ist kein Fehler,
 * es heisst nur: der Browser behaelt sich das Aufraeumen vor. Deshalb wird das
 * Ergebnis ANGEZEIGT und nicht verschwiegen.
 *
 * @returns {Promise<{dauerhaft: boolean, moeglich: boolean}>}
 */
export async function sorgeFuerDauer() {
  if (!navigator.storage?.persist || !navigator.storage?.persisted) {
    return { dauerhaft: false, moeglich: false }
  }
  try {
    // Erst nachsehen. Ein zweites persist() waere ueberfluessig und in Firefox
    // eine zweite Rueckfrage.
    if (await navigator.storage.persisted()) return { dauerhaft: true, moeglich: true }
    const zugesagt = await navigator.storage.persist()
    return { dauerhaft: Boolean(zugesagt), moeglich: true }
  } catch {
    return { dauerhaft: false, moeglich: false }
  }
}

/**
 * Wie viel Platz der Browser noch gibt.
 *
 * @returns {Promise<{belegt: number, moeglich: number}|null>}
 */
export async function platz() {
  if (!navigator.storage?.estimate) return null
  try {
    const schaetzung = await navigator.storage.estimate()
    return { belegt: schaetzung.usage ?? 0, moeglich: schaetzung.quota ?? 0 }
  } catch {
    return null
  }
}
