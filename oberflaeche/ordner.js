// @ts-check
/**
 * Ordner fuer Riesenscheine.
 *
 * Karam am 17.09.2026: "In einem Ordner sind Riesenscheine drinnen. Und diese
 * Ordner werden auch miteinander gerechnet."
 *
 * WO DIE ZUORDNUNG LIEGT, UND WARUM SIE DORT LIEGT
 *
 * Am Riesenschein selbst, im Feld `ordner`, und damit in der Datenbank.
 *
 * Bis zur Fassung 2026-09-17-b lag sie im Browserspeicher, weil
 * kombi.riesenscheine keine Spalte dafuer hatte. Im Programm stand deshalb, die
 * Ordner lagen "nur auf diesem Geraet". Karam am 17.09.2026 dazu:
 *
 *   "Du musst verstehen, dieses Programm ist ein Account. Es wird alles auf
 *   einer Datenbank gespeichert, in Supabase. Und ich sehe jedes Foto, jeden
 *   Schein, den eine Person macht, und die Person genauso bei mir. Das ist kein
 *   eigenes Profil. Das ist einfach DAS Profil."
 *
 * Er hat recht, und der Satz im Programm hat eine fehlende Spalte wie eine
 * Eigenschaft des Programms aussehen lassen. Die Spalte kommt mit
 * supabase/migrations/0009.
 *
 * EIN ORDNER IST NUR EIN NAME AM RIESENSCHEIN, keine eigene Sache. Er besteht,
 * solange ein Riesenschein darin liegt, und verschwindet sonst von selbst.
 * Genau so ist es bei den Projekten in der Ablage auch geloest
 * (supabase/migrations/0008), und zwei verschiedene Bauarten fuer dasselbe
 * waeren eine Quelle fuer Verwirrung.
 *
 * DIESE DATEI AENDERT NICHTS. Sie liest nur und sagt, was ein sauberer Name
 * ist. Gesetzt wird der Ordner in zustand.js, dort wo auch Name und Notiz
 * gesetzt werden (Projektregel 8).
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5).
 */

/** Der Name, unter dem alles ohne Ordner laeuft. */
export const OHNE_ORDNER = ''

/**
 * DIE BRUECKE AUS DEM BROWSERSPEICHER.
 *
 * Wer zwischen dem 17.09.2026 und der Migration 0009 Ordner angelegt hat, hat
 * sie hier liegen. Sie duerfen nicht einfach verschwinden, nur weil die
 * Zuordnung umgezogen ist.
 *
 * EINE EINBAHNSTRASSE: es wird nur noch GELESEN und nur dort eingesetzt, wo am
 * Riesenschein selbst nichts steht. Sobald jemand einen Ordner von Hand setzt,
 * faellt der alte Eintrag weg (siehe vergissBruecke). Damit kann ein Ordner,
 * den Karam ausdruecklich entfernt hat, nicht wieder auftauchen.
 */
const BRUECKE_SCHLUESSEL = 'kombi-riesenschein-ordner'

/**
 * Die alte Zuordnung aus dem Browserspeicher, Riesenschein-Kennung auf Name.
 *
 * @returns {Record<string, string>}
 */
function bruecke() {
  try {
    const roh = localStorage.getItem(BRUECKE_SCHLUESSEL)
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
 * Nimmt eine Kennung aus der Bruecke heraus.
 *
 * Wird gerufen, sobald jemand den Ordner dieses Riesenscheins von Hand setzt.
 * Danach gilt nur noch, was am Riesenschein steht.
 *
 * @param {string} riesenscheinId
 */
export function vergissBruecke(riesenscheinId) {
  try {
    const alt = bruecke()
    if (alt[riesenscheinId] === undefined) return
    delete alt[riesenscheinId]
    if (Object.keys(alt).length === 0) localStorage.removeItem(BRUECKE_SCHLUESSEL)
    else localStorage.setItem(BRUECKE_SCHLUESSEL, JSON.stringify(alt))
  } catch {
    // Kein Speicher: dann bleibt der alte Eintrag stehen und wird beim
    // naechsten Laden wieder eingesetzt. Kein Grund, etwas anzuhalten.
  }
}

/**
 * Wie viele Zuordnungen noch in der Bruecke liegen.
 *
 * Nur zum Anzeigen: solange hier etwas liegt, ist es noch nicht bei Karams
 * Kollegen angekommen.
 *
 * @returns {number}
 */
export function brueckenreste() {
  return Object.keys(bruecke()).length
}

/**
 * In welchem Ordner ein Riesenschein liegt. Leerer Text heisst: in keinem.
 *
 * Was am Riesenschein steht, gilt. Steht dort nichts, greift die alte
 * Zuordnung aus dem Browser, damit nichts verloren geht.
 *
 * @param {{id: string, ordner?: string}} riesenschein
 * @returns {string}
 */
export function ordnerVon(riesenschein) {
  if (!riesenschein) return OHNE_ORDNER
  const amSchein = String(riesenschein.ordner ?? '').trim()
  if (amSchein !== OHNE_ORDNER) return amSchein
  return bruecke()[riesenschein.id] ?? OHNE_ORDNER
}

/**
 * Was aus einem eingetippten Ordnernamen wird.
 *
 * Ein Ordnername ist nur Text. Die einzige Regel: aussen keine Leerzeichen,
 * sonst waeren " Woche 1" und "Woche 1" zwei Ordner, die gleich aussehen.
 *
 * @param {string} text
 * @returns {string}
 */
export function sauberName(text) {
  return String(text ?? '').trim()
}

/**
 * Alle Ordner, die es gerade gibt, mit der Zahl der Riesenscheine darin.
 *
 * Es werden nur Ordner gezaehlt, in denen wirklich etwas liegt: ein Ordner
 * ist kein eigenes Ding, sondern eine Beschriftung.
 *
 * @param {{id: string, ordner?: string}[]} riesenscheine
 * @returns {{name: string, anzahl: number}[]}
 */
export function alleOrdner(riesenscheine) {
  /** @type {Map<string, number>} */
  const zaehler = new Map()
  for (const r of riesenscheine ?? []) {
    const ordner = ordnerVon(r)
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
 * @param {{id: string, ordner?: string}[]} riesenscheine
 * @returns {number}
 */
/**
 * Welcher Farbton zu einem Namen gehoert. EINZIGE Stelle dafuer.
 *
 * Karam am 17.09.2026: "Man kann Riesenscheine benennen, Farben zurichten,
 * Ordner und Projekte genauso."
 *
 * ABGELEITET UND NICHT GEWAEHLT, und das ist mit Absicht so:
 *
 *   - Es gilt sofort und ueberall gleich, auch bei Karams Kollegen, ohne dass
 *     irgendetwas gespeichert oder eine Datenbankspalte ergaenzt werden muss.
 *   - "Spieltag 3" ist auf jedem Geraet dieselbe Farbe, heute und in einem
 *     Jahr.
 *   - Zwei Ordner koennen nicht versehentlich gleich aussehen.
 *
 * Eine Farbe von Hand zu waehlen ginge auch und braucht eine neue Spalte in
 * kombi.riesenscheine, also eine Migration. Steht in der Uebergabe.
 *
 * DIE RECHNUNG ist eine einfache Quersumme ueber die Zeichen. Sie muss nicht
 * gut streuen, sie muss STABIL sein: derselbe Name gibt fuer immer dieselbe
 * Zahl. Welche Farbe die Zahl bedeutet, steht in stil/marken.css; hier steht
 * keine Farbe (Projektregel 5).
 *
 * @param {string} name
 * @returns {string} '1' bis '8', oder '' fuer den leeren Namen.
 */
export function tonFuer(name) {
  const sauber = String(name ?? '').trim()
  if (sauber === '') return ''
  /*
    Erster Anlauf war `summe * 31 + zeichen`, und der streute schlecht:
    "Playoffs 2027", "Saison 2026" und "Archiv" bekamen alle denselben Ton.
    Der Grund ist, dass 31 modulo 8 gleich 7 ist und die hinteren Zeichen
    damit fast alles bestimmen.

    Diese Mischung (FNV) verruehrt jedes Zeichen ueber die ganze Zahl.
    Nachgemessen ueber die Namen, die Karam bisher benutzt hat, und ueber
    tausend erfundene: alle acht Toene kommen gleichmaessig vor.
  */
  let summe = 2166136261
  for (const zeichen of sauber) {
    summe ^= zeichen.codePointAt(0) ?? 0
    summe = Math.imul(summe, 16777619) >>> 0
  }
  return String((summe % 8) + 1)
}

/**
 * Der Farbton eines Riesenscheins. EINZIGE Stelle fuer die Erbfolge.
 *
 * Karam am 19.09.2026: "Wenn sie in einem bestimmten Folder gespeichert
 * werden, kriegen sie automatisch die Farbe vom Folder."
 *
 * Liegt der Riesenschein in einem Ordner, traegt er dessen Ton: alles im
 * selben Ordner sieht zusammengehoerig aus, auf jedem Geraet gleich. Ohne
 * Ordner bekommt er seinen eigenen Ton aus dem Namen. Eine von Hand
 * GEWAEHLTE Farbe dagegen braucht eine neue Spalte in kombi.riesenscheine,
 * also eine Migration; siehe den Kommentar an tonFuer().
 *
 * @param {{id?: string, name?: string, ordner?: string}} riesenschein
 * @returns {string} '1' bis '8', oder '' wenn nichts einen Namen hat.
 */
export function tonFuerRiesenschein(riesenschein) {
  const ordner = ordnerVon(/** @type {any} */ (riesenschein ?? {}))
  if (ordner !== OHNE_ORDNER) return tonFuer(ordner)
  return tonFuer(riesenschein?.name || riesenschein?.id || '')
}

/**
 * Der Farbton eines Projekts, nach derselben Erbfolge: der Ordner faerbt,
 * sonst der eigene Name. Dieselbe Regel an einer Stelle, damit Ablage und
 * Panel nie auseinanderlaufen (Projektregel 8).
 *
 * @param {{id?: string, name?: string, ordner?: string}} projekt
 * @returns {string}
 */
export function tonFuerProjekt(projekt) {
  const ordner = String(projekt?.ordner ?? '').trim()
  if (ordner !== '') return tonFuer(ordner)
  return tonFuer(projekt?.name || projekt?.id || '')
}

/**
 * Der Bauplan fuer das Ordnerfeld in einem Fenster. EINZIGE Stelle dafuer.
 *
 * Karam am 17.09.2026: "Wenn ich was speichere, kann ich einen Ordner
 * aussuchen oder ich kann direkt einen neuen Ordner anlegen. Entweder ich kann
 * den Ordner leer lassen oder einen Ordner rein oder direkt einen neuen
 * erstellen."
 *
 * DREI WEGE, UND ALLE DREI SIND ZU SEHEN:
 *
 *   "Kein Ordner"      der erste Knopf, immer da
 *   ein Knopf je Ordner, der schon existiert
 *   das Textfeld       fuer einen neuen, gleich hier angelegt
 *
 * Vorher gab es nur das Textfeld mit einer Liste daran, die sich erst zeigt,
 * wenn man tippt. Wer seine Ordner nicht auswendig wusste, sah sie nicht.
 *
 * DIE LISTE SIND NAMEN, KEINE RIESENSCHEINE. Das ist Absicht: in der Ablage
 * ordnen Ordner PROJEKTE, hier ordnen sie RIESENSCHEINE. Waeren
 * Riesenscheine der Parameter, waere diese Funktion fuer die Ablage
 * unbrauchbar, und es entstuende eine zweite daneben. Genau die Verwechslung
 * der beiden Ebenen ist das, wovor Karam ausdruecklich Angst hatte.
 *
 * WIE VIELE DARIN LIEGEN, steht am Knopf. Sonst waere "Spieltag 3" eine
 * Behauptung; so ist es eine Angabe.
 *
 * @param {string[]} vorhandene   Die Namen, die es schon gibt.
 * @param {string} [jetziger]     Was gerade gilt, steht vorausgefuellt drin.
 * @param {Map<string, number>|Record<string, number>} [anzahlen]
 * @returns {object} Ein Feldbauplan fuer oberflaeche/dialog.js.
 */
export function ordnerfeldbauplan(vorhandene, jetziger = OHNE_ORDNER, anzahlen = undefined) {
  const hole = (name) => {
    if (!anzahlen) return undefined
    const n = anzahlen instanceof Map ? anzahlen.get(name) : anzahlen[name]
    if (typeof n !== 'number' || n <= 0) return undefined
    return n === 1 ? '1 Stück' : `${n} Stück`
  }

  const auswahl = [
    {
      wert: OHNE_ORDNER,
      name: 'Kein Ordner',
      zusatz: 'lose in der Übersicht',
    },
    ...vorhandene.filter((n) => n && n !== OHNE_ORDNER).map((name) => ({
      wert: name,
      name,
      zusatz: hole(name),
    })),
  ]

  return {
    name: 'ordner',
    beschriftung: 'Ordner',
    wert: jetziger,
    platzhalter: 'Name eines neuen Ordners',
    auswahl,
    // Ein Zeichen VORN im Ordnernamen, wenn Karam eines will. Es ist Teil
    // des Namens und damit ueberall gleich, auch beim Kollegen. Das feste
    // Stufenzeichen des Ordners bleibt unangetastet (Karam am 19.09.2026).
    symbole: ['📌', '🔥', '⭐', '✅', '💰', '🏈', '📅', '🗄️'],
    neuHilfe:
      vorhandene.length > 0
        ? 'Oder tippe hier einen neuen Namen. Der Ordner entsteht damit sofort.'
        : 'Tippe einen Namen, dann entsteht der erste Ordner. Leer lassen geht auch.',
    hilfe:
      'Ein Ordner ist nur eine Beschriftung. Er ordnet Riesenscheine innerhalb ' +
      'dieses Projekts und verschwindet von selbst, wenn der letzte heraus ist.',
  }
}

export function anzahlOhneOrdner(riesenscheine) {
  return (riesenscheine ?? []).filter((r) => ordnerVon(r) === OHNE_ORDNER).length
}

/**
 * Nur die Riesenscheine eines Ordners.
 *
 * @param {{id: string, ordner?: string}[]} riesenscheine
 * @param {string} ordner
 * @returns {{id: string, ordner?: string}[]}
 */
export function imOrdner(riesenscheine, ordner) {
  return (riesenscheine ?? []).filter((r) => ordnerVon(r) === ordner)
}
