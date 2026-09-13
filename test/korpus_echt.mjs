/**
 * Pruefaelle aus ECHTEN Bildschirmfotos.
 *
 * DIESE DATEI IST NOCH LEER. Sie wird nicht von Hand geschrieben.
 *
 * So entsteht ihr Inhalt:
 *
 *   node werkzeug/server.mjs
 *   http://localhost:4173/werkzeug/training/
 *
 * Dort laufen echte Fotos durch den echten Leseweg, falsch Gelesenes wird von
 * Hand berichtigt, jeder Schein wird abgehakt, und "Als Pruefaelle sichern"
 * legt eine fertige `korpus_echt.mjs` ab. Die ersetzt diese Datei hier.
 *
 * Ab dann prueft `test/korpus_echt.test.mjs` jeden dieser Faelle bei jeder
 * Aenderung mit, und `node werkzeug/messe_lesen.mjs` zeigt, wie gut echte
 * Fotos gelesen werden. Solange hier nichts steht, sagt die Messlatte
 * ausdruecklich, dass ihre hundert Prozent nur fuer nachgebaute Bilder gelten.
 *
 * Die Form eines Falls steht in `test/korpus_pruefer.mjs`.
 */

/** @type {any[]} */
export const KORPUS_ECHT = []
