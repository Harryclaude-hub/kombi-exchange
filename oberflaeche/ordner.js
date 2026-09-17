// @ts-check
/**
 * Ordner fuer Riesenscheine.
 *
 * Karam am 17.09.2026: "in einem Ordner sind Riesenscheine drinnen. Und die
 * Ordner werden auch miteinander gerechnet. Ordner und Riesenscheine sorgen
 * fuer Ordnung, Projekte sind komplett separat."
 *
 * WARUM DAS VORERST IM BROWSER LIEGT, UND NICHT IN DER DATENBANK
 *
 * kombi.riesenscheine hat KEINE Spalte ordner. Nachgesehen in
 * supabase/migrations/0001: die Speicherfunktion schreibt id, projekt_id,
 * name, signatur, schein_ids und notiz, sonst nichts. Ein Ordner am
 * Riesenschein braucht also eine neue Migration UND eine Aenderung an
 * kombi_riesenscheine_speichern.
 *
 * Das ist ein Eingriff in Karams laufende Datenbank, und den mache ich nicht
 * ohne sein ausdrueckliches Wort. Bis dahin liegt die Zuordnung hier, im
 * Browser dieses Geraets.
 *
 * WAS DAS BEDEUTET, und es steht auch im Programm:
 *   Es funktioniert sofort und vollstaendig auf DIESEM Geraet.
 *   Es wandert NICHT zu Karams Kollegen, der denselben Zugangscode hat.
 * Sobald die Migration da ist, wird aus dieser Datei eine Fassade auf das
 * Feld am Riesenschein, und der Rest des Programms merkt nichts davon.
 *
 * EIN ORDNER IST NUR EIN NAME AM RIESENSCHEIN, keine eigene Sache. Er besteht,
 * solange ein Riesenschein darin liegt, und verschwindet sonst von selbst.
 * Genau so ist es bei den Projekten in der Ablage auch geloest
 * (supabase/migrations/0008), und zwei verschiedene Bauarten fuer dasselbe
 * waeren eine Quelle fuer Verwirrung.
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5).
 */

/** Unter welchem Schluessel die Zuordnung im Browser liegt. */
const SCHLUESSEL = 'kombi-riesenschein-ordner'

/** Der Name, unter dem alles ohne Ordner laeuft. */
export const OHNE_ORDNER = ''

/** @type {Set<() => void>} */
const zuhoerer = new Set()

/**
 * Die ganze Zuordnung, Riesenschein-Kennung auf Ordnername.
 *
 * @returns {Record<string, string>}
 */
function hole() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    const wert = roh ? JSON.parse(roh) : {}
    if (!wert || typeof wert !== 'object' || Array.isArray(wert)) return {}
    /** @type {Record<string, string>} */
    const sauber = {}
    for (const [id, ordner] of Object.entries(wert)) {
      if (typeof id === 'string' && typeof ordner === 'string') sauber[id] = ordner
    }
    return sauber
  } catch {
    // Ein kaputter Eintrag darf die Ansicht nicht mitnehmen.
    return {}
  }
}

/**
 * @param {Record<string, string>} zuordnung
 */
function merke(zuordnung) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(zuordnung))
  } catch {
    // Kein Platz im Browser: dann haelt die Zuordnung nur, solange das Fenster
    // offen ist. Kein Grund, das Programm anzuhalten.
  }
}

/**
 * In welchem Ordner ein Riesenschein liegt. Leerer Text heisst: in keinem.
 *
 * @param {string} riesenscheinId
 * @returns {string}
 */
export function ordnerVon(riesenscheinId) {
  return hole()[riesenscheinId] ?? OHNE_ORDNER
}

/**
 * Legt einen Riesenschein in einen Ordner. Leerer Name nimmt ihn heraus.
 *
 * @param {string} riesenscheinId
 * @param {string} ordner
 */
export function legeIn(riesenscheinId, ordner) {
  const name = String(ordner ?? '').trim()
  const zuordnung = hole()
  if (name === OHNE_ORDNER) delete zuordnung[riesenscheinId]
  else zuordnung[riesenscheinId] = name
  merke(zuordnung)
  for (const was of zuhoerer) was()
}

/**
 * Alle Ordner, die es gerade gibt, mit der Zahl der Riesenscheine darin.
 *
 * Es werden nur Ordner gezaehlt, in denen wirklich etwas liegt: ein Ordner
 * ist kein eigenes Ding, sondern eine Beschriftung.
 *
 * @param {{id: string}[]} riesenscheine
 * @returns {{name: string, anzahl: number}[]}
 */
export function alleOrdner(riesenscheine) {
  const zuordnung = hole()
  /** @type {Map<string, number>} */
  const zaehler = new Map()
  for (const r of riesenscheine) {
    const ordner = zuordnung[r.id] ?? OHNE_ORDNER
    if (ordner === OHNE_ORDNER) continue
    zaehler.set(ordner, (zaehler.get(ordner) ?? 0) + 1)
  }
  return [...zaehler.entries()]
    .map(([name, anzahl]) => ({ name, anzahl }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/**
 * Wie viele Riesenscheine in keinem Ordner liegen.
 *
 * @param {{id: string}[]} riesenscheine
 * @returns {number}
 */
export function anzahlOhneOrdner(riesenscheine) {
  const zuordnung = hole()
  return riesenscheine.filter((r) => (zuordnung[r.id] ?? OHNE_ORDNER) === OHNE_ORDNER).length
}

/**
 * Zieht die Zuordnung auf neue Kennungen um und wirft weg, was ins Leere zeigt.
 *
 * WARUM ES DAS GEBEN MUSS, gefunden am 17.09.2026 im Browser, eine Viertelstunde
 * nachdem die Ordner das erste Mal liefen:
 *
 *   vier Riesenscheine in den Ordner "Spieltag 3" gelegt, gemessen: richtig.
 *   einmal auf "Neuer Riesenschein" gedrueckt, gemessen: alle vier Ordner weg.
 *
 * Der Grund steht in zustand.js, ordneNeu: gruppiere() baut die Riesenscheine
 * bei JEDEM Neuordnen frisch und vergibt dabei neue Kennungen. Stabil ist
 * nicht die Kennung, sondern die Signatur; deshalb rettet ordneNeu den Namen
 * auch ueber die Signatur und nicht ueber die Kennung.
 *
 * Neu geordnet wird nach jeder berichtigten Zahl. Karam haette seine Ordner
 * also mehrmals taeglich verloren, ohne dass irgendwo etwas dagestanden haette.
 *
 * Die Zuordnung wandert deshalb dort mit, wo die Kennungen neu vergeben werden,
 * und nur dort (Projektregel 8).
 *
 * @param {[string, string][]} umzuege Paare von alter auf neue Kennung
 * @param {Set<string>} gueltig alle Kennungen, die es danach noch gibt
 */
export function wandere(umzuege, gueltig) {
  const alt = hole()
  /** @type {Record<string, string>} */
  const neu = {}

  for (const [von, nach] of umzuege) {
    const ordner = alt[von]
    if (ordner !== undefined) neu[nach] = ordner
  }

  // Was schon auf einer gueltigen Kennung sitzt und nicht umgezogen ist,
  // bleibt stehen. Was auf nichts mehr zeigt, faellt weg: sonst waechst die
  // Zuordnung ueber eine Saison hinweg um lauter tote Eintraege.
  for (const [id, ordner] of Object.entries(alt)) {
    if (neu[id] === undefined && gueltig.has(id)) neu[id] = ordner
  }

  merke(neu)
  // KEIN Wecken der Zuhoerer: das hier laeuft mitten in ordneNeu, und das
  // zeichnet danach ohnehin alles neu. Ein zweiter Anstoss waere ein zweites
  // Zeichnen desselben Bildes.
}

/**
 * Sagt Bescheid, wenn sich an der Zuordnung etwas geaendert hat.
 *
 * @param {() => void} was
 */
export function hoerZu(was) {
  zuhoerer.add(was)
}
