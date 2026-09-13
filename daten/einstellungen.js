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

/**
 * Fassung dieses Programms.
 *
 * Wozu: der Browser laedt jede Datei einzeln und merkt sie sich einzeln. Nach
 * einer Aktualisierung kann er deshalb neue und alte Dateien mischen. Das
 * erzeugt Fehler, die sich nicht nachstellen lassen, weil sie nur bei genau
 * dieser Mischung auftreten.
 *
 * Deshalb liegt dieselbe Kennung zweimal: hier, fest in den Programmdateien,
 * und in fassung.json daneben. Beim Start wird fassung.json ohne Zwischenspeicher
 * geholt und verglichen. Weichen sie ab, sind die geladenen Dateien alt, und die
 * Seite laedt sich einmal neu.
 *
 * WICHTIG: dieser Wert und fassung.json muessen uebereinstimmen. werkzeug/pruefe.mjs
 * prueft das bei jedem Durchlauf, damit die beiden nicht auseinanderlaufen.
 */
export const PROGRAMM_FASSUNG = '2026-09-13-d'
