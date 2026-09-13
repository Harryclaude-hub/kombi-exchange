// @ts-check
/**
 * Anbindung an die Datenbank.
 *
 * Der hier stehende Schluessel ist der oeffentliche Schluessel von Supabase.
 * Er ist dafuer gemacht, im Browser zu stehen, und oeffnet fuer sich allein gar nichts:
 * alle Tabellen liegen in einem Schema, das von aussen nicht erreichbar ist, und jede
 * Funktion verlangt zuerst einen gueltigen Sitzungsschluessel. Ohne den Sperrcode
 * kommt man mit diesem Schluessel an keine einzige Zeile.
 *
 * Wer das Programm auf einer eigenen Datenbank betreiben will, aendert nur diese Datei.
 */

export const DATENBANK = {
  adresse: 'https://eybwhnvjavovcxvimtxr.supabase.co',
  schluessel: 'sb_publishable_D9sQTI9o_wa24RutdGYRgg_gVxwHno5',
}

/** Wie lange ein Sitzungsschluessel im Browser bleibt, bevor er neu geprueft wird. */
export const SITZUNG_PRUEFEN_NACH_STUNDEN = 12

/** Name, unter dem der Sitzungsschluessel im Browser liegt. */
export const SITZUNG_SCHLUESSEL = 'kombi.sitzung'

/** Name, unter dem die Einstellungen im Browser liegen. */
export const EINSTELLUNG_SCHLUESSEL = 'kombi.einstellungen'
