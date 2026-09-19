// @ts-check
/**
 * Die Grenze dieses Programms in der gemeinsamen Datenbank.
 *
 * DIE EINZIGE STELLE, AN DER SIE DEFINIERT IST.
 *
 * Karam am 18.09.2026: "Mach klare Trennungen zwischen den Projekten in der
 * Datenbank. Ich will nie, dass sich irgendwas mischt. Weder Daten noch
 * irgendwas. Und auch fuer die neuen Chats, wenn ich da was arbeite und mit der
 * Datenbank mache, muss das wirklich klar getrennt sein, keine Fehler, kein
 * Durcheinander."
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * Die Grenze stand zuerst an drei Stellen: die Vorsilbe in daten/datenbank.js,
 * die Listen der fremden Namen in werkzeug/pruefe.mjs, und die vierzehn Tueren
 * noch einmal in test/trennung.test.mjs. Drei Abschriften derselben Sache sind
 * genau das, was Projektregel 8 verbietet: kommt eine fuenfzehnte Tuer dazu,
 * muss jemand an drei Stellen daran denken, und beim zweiten Vergessen ist die
 * Grenze wieder nur eine Behauptung.
 *
 * Jetzt lesen alle vier von hier: die Wand in daten/datenbank.js, die Pruefung
 * in werkzeug/pruefe.mjs, die Probe in test/trennung.test.mjs und die
 * Beschreibung in supabase/TRENNUNG.md.
 *
 * ZWEI FEINHEITEN, DIE MAN LEICHT FALSCH PRUEFT
 *
 * 1. Die Vorsilbe kombi_ gilt NUR fuer public. Innerhalb des Schemas kombi
 *    heissen die elf internen Funktionen absichtlich ohne sie
 *    (scheine_schreiben, nicht kombi_scheine_schreiben). Eine Regel, die stur
 *    kombi_ verlangt, wuerde diese elf zu Unrecht beanstanden. In Wanderung
 *    0004 werden sie genau deshalb mit "set schema" und "rename to" aus public
 *    herausgezogen.
 *
 * 2. extensions ist GETEILT. pgcrypto liegt dort und gehoert allen drei
 *    Programmen gemeinsam. Deshalb steht es unter den geteilten Schemata und
 *    nicht unter den eigenen, und deshalb darf es niemand fallen lassen.
 */

/** Das Schema, in dem alle Tabellen dieses Programms liegen. */
export const SCHEMA = 'kombi'

/** Die Vorsilbe, die jede Tuer in public tragen muss. */
export const VORSILBE = 'kombi_'

/**
 * Die Tueren in public. Nur diese vierzehn Namen, keiner mehr.
 *
 * Wer eine neue anlegt, traegt sie hier ein UND legt sie in einer Wanderung an.
 * werkzeug/pruefe.mjs gleicht drei Orte gegeneinander ab, diese Liste, die
 * Wanderungen und die Aufrufe in daten/datenbank.js, und meldet jede Abweichung
 * mit der Richtung: vergessener Eintrag, Tippfehler oder tote Tuer.
 */
export const TUEREN = Object.freeze([
  'kombi_bilder_lesen',
  'kombi_bilder_speichern',
  'kombi_code_einloesen',
  'kombi_code_wechseln',
  'kombi_projekt_leeren',
  'kombi_projekt_loeschen',
  'kombi_projekt_speichern',
  'kombi_projekte_lesen',
  'kombi_riesenscheine_lesen',
  'kombi_riesenscheine_speichern',
  'kombi_schein_loeschen',
  'kombi_scheine_lesen',
  'kombi_scheine_speichern',
  'kombi_sitzung_pruefen',
])

/** Die sieben Tabellen im Schema kombi. */
export const EIGENE_TABELLEN = Object.freeze([
  'bilder',
  'projekte',
  'riesenscheine',
  'scheine',
  'sitzungen',
  'versuche',
  'zugangscodes',
])

/**
 * Schemata, die eine Wanderung dieses Programms nennen darf.
 *
 * kombi gehoert uns. public nur mit der Vorsilbe. extensions ist geteilt und
 * wird nur gelesen, nie veraendert. pg_catalog gehoert der Datenbank selbst.
 */
export const ERLAUBTE_SCHEMATA = Object.freeze([
  'kombi',
  'public',
  'extensions',
  'pg_catalog',
])

/** Vorsilben, an denen ein fremdes Programm zu erkennen ist. */
export const FREMDE_VORSILBEN = Object.freeze(['kt_'])

/**
 * Namen anderer Programme in derselben Datenbank, ohne erkennbare Vorsilbe.
 *
 * Das ist immo-check. Es traegt als einziges der drei Programme keine, und
 * genau deshalb muessen seine Namen hier einzeln stehen: "profiles",
 * "templates" oder "categories" sind Woerter, die ein neues Programm ebenso
 * naheliegend fuer sich selbst waehlen wuerde.
 */
export const FREMDE_NAMEN = Object.freeze([
  'categories',
  'criteria',
  'inspection_items',
  'inspection_notes',
  'inspection_plans',
  'inspections',
  'paper_sheets',
  'profiles',
  'properties',
  'property_photos',
  'template_criteria',
  'templates',
  'units',
  'is_active_user',
  'is_admin',
  'handle_new_user',
  'touch_updated_at',
  'auto_confirm_email',
  'guard_profile_update',
])

/**
 * Die Kennung des Supabase-Projekts, in dem alle drei Programme liegen.
 *
 * Steht hier nur zum Nachschlagen. Die Adresse selbst steht in
 * daten/einstellungen.js und wird von dort geholt.
 */
export const PROJEKT_KENNUNG = 'mqmevpyatjsambervgtu'

/**
 * Passt der Name auf eine Tuer dieses Programms?
 *
 * Zwei Tore hintereinander, und beide werden gebraucht:
 *
 *   Das erste ist die Form. Es faengt Pfadausbrueche ab (Schraegstrich, Punkt,
 *   Fragezeichen), bevor irgendetwas zu einer Adresse zusammengebaut wird.
 *   "kombi_scheine_lesen/../../kt_wetten" faengt mit kombi_ an und waere ohne
 *   dieses Tor durchgekommen.
 *
 *   Das zweite ist die Liste. Ein Tippfehler wie kombi_scheine_lsen hat die
 *   richtige Form und stirbt sonst erst draussen als 404, was im Browser wie
 *   ein Netzproblem aussieht. Hier kracht er in der ersten Zeile.
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function istEigeneTuer(name) {
  if (typeof name !== 'string') return false
  if (!/^kombi_[a-z][a-z0-9_]*$/.test(name)) return false
  return TUEREN.includes(name)
}
