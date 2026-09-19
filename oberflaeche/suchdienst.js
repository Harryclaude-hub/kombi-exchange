// @ts-check
/**
 * Beschafft der grossen Suche ihre Bestaende.
 *
 * Karam am 19.09.2026: "Wenn ich will, kann ich auch in allen Projekten
 * suchen. Ich weiss nicht, wo ein Schein gespeichert wird. Er sucht im ganzen
 * Programm fuer mich nach diesem Schein oder nach diesem Ordner oder nach
 * diesem Riesenschein."
 *
 * WAS DIESE DATEI TUT UND WAS NICHT
 *
 * Sie LIEST fremde Projekte aus der Datenbank (kombi_riesenscheine_lesen und
 * kombi_scheine_lesen, beides reine Lesewege) und macht daraus Bestaende fuer
 * kern/suche.js. Sie schreibt NIE: die Suche darf ein fremdes Projekt
 * ansehen, aber niemals anfassen. Gesucht wird dann im Kern, gezeichnet in
 * ansicht_start.js; hier wird nur beschafft.
 *
 * DREI ZUSTAENDE JE PROJEKT, nie zwei: Daten, leer, Fehler. Ein Projekt, das
 * sich nicht laden liess, verschwindet nicht stumm aus der Suche, es steht
 * namentlich in den Fehlern (Projektregel: stille Fehlschlaege sind die
 * teuersten).
 */

import * as Datenbank from '../daten/datenbank.js'
import * as Ordner from './ordner.js'

/**
 * @typedef {object} Suchbestand
 * @property {string} projektId
 * @property {string} projektName
 * @property {any[]} riesenscheine  Ordner schon aufgeloest.
 * @property {any[]} scheine
 */

/**
 * Der Bestand des OFFENEN Projekts, aus dem Arbeitsstand statt aus der
 * Datenbank: was Karam gerade eben getippt hat, muss die Suche sofort
 * finden, nicht erst nach dem naechsten Speichern.
 *
 * @param {any} stand
 * @returns {Suchbestand}
 */
export function bestandAusStand(stand) {
  return {
    projektId: stand.projekt?.id ?? '',
    projektName: stand.projekt?.name ?? 'Ohne Projekt',
    // ordnerVon loest auch die alte Geraete-Zuordnung auf, deshalb hier und
    // nicht im Kern (der darf den Browserspeicher nicht kennen).
    riesenscheine: (stand.riesenscheine ?? []).map((r) => ({ ...r, ordner: Ordner.ordnerVon(r) })),
    scheine: stand.scheine ?? [],
  }
}

/**
 * Laedt die Bestaende fremder Projekte, nur lesend.
 *
 * @param {string} token
 * @param {import('../kern/typen.js').Projekt[]} projekte  OHNE das offene.
 * @returns {Promise<{bestaende: Suchbestand[], fehler: string[]}>}
 */
export async function holeFerneBestaende(token, projekte) {
  /** @type {Suchbestand[]} */
  const bestaende = []
  /** @type {string[]} */
  const fehler = []

  for (const projekt of projekte) {
    const riesenscheine = await Datenbank.holeRiesenscheine(token, projekt.id)
    if (riesenscheine.art === 'fehler') {
      fehler.push(`${projekt.name || projekt.id}: ${riesenscheine.meldung}`)
      continue
    }

    const scheine = await Datenbank.holeScheine(token, projekt.id)
    if (scheine.art === 'fehler') {
      fehler.push(`${projekt.name || projekt.id}: ${scheine.meldung}`)
      continue
    }

    const rohe = Array.isArray(riesenscheine.daten) ? riesenscheine.daten : []
    bestaende.push({
      projektId: projekt.id,
      projektName: projekt.name || 'Ohne Namen',
      riesenscheine: rohe
        .map(Datenbank.riesenscheinAusZeile)
        .map((r) => ({ ...r, ordner: Ordner.ordnerVon(r) })),
      scheine: scheine.daten ?? [],
    })
  }

  return { bestaende, fehler }
}
