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
