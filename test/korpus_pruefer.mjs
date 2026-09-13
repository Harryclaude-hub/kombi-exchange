/**
 * Der eine Rechenweg, nach dem ein Korpus geprueft wird.
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * Es gibt zwei Korpora, den nachgebauten (test/scheinkorpus.mjs) und den
 * echten aus Karams Fotos (test/korpus_echt.mjs). Dazu kommt die Messlatte
 * werkzeug/messe_lesen.mjs. Vorher stand der Vergleich dreimal da, jedes Mal
 * leicht anders. Genau das ist die Fehlerklasse "Drift zwischen zwei
 * Fassungen": eine wird gepflegt, die andere nicht, und irgendwann sagt der
 * Test etwas anderes als die Messung.
 *
 * Projektregel 8: Logik lebt an genau einer Stelle. Hier ist sie.
 *
 * DIE FORM EINES FALLS
 *
 *   name          Wie der Fall heisst. Steht im Testnamen.
 *   buchmacher    Nur zur Einordnung, wird nicht geprueft.
 *   zeilen        Was die Texterkennung aus der Karte gemacht hat.
 *   umgebung      Unter welchen Bedingungen gelesen wurde. Muss dieselbe sein
 *                 wie beim Lauf, aus dem die Wahrheit stammt, sonst prueft der
 *                 Fall etwas anderes als das, was gesehen wurde.
 *   erwartet      Die geprueefte Wahrheit. NUR was hier steht, wird verlangt.
 *   nichtVorhanden  Felder, die auf dem Schein ausdruecklich NICHT stehen.
 *                 Ein Wert dort ist ein Fehler. Ohne diese Liste haette das
 *                 Programm keinen Weg, "hier steht in Wahrheit nichts" zu
 *                 pruefen, und ein erfundener Wert waere fuer immer Wahrheit.
 *   durchgesehen  Nur beim echten Korpus. Fehlt es oder ist es false, hat
 *                 niemand hingesehen, und der Fall wird uebersprungen statt
 *                 ungeprueftes Maschinenergebnis zur Wahrheit zu erklaeren.
 */

import { leseSchein } from '../kern/parser.js'

/** Geld gilt als richtig, wenn es auf den Cent stimmt. */
export const CENT = 0.005
/** Quoten gelten als richtig, wenn sie auf drei Nachkommastellen stimmen. */
export const QUOTE = 0.0015

/**
 * Holt einen Wert aus dem Ergebnis, egal ob er als Feld oder blank dasteht.
 *
 * @param {any} ergebnis
 * @param {string} feld
 */
export function wert(ergebnis, feld) {
  const roh = ergebnis[feld]
  if (roh && typeof roh === 'object' && 'wert' in roh) return roh.wert
  return roh
}

/**
 * @param {unknown} ist
 * @param {unknown} soll
 * @param {string} feld
 * @returns {boolean}
 */
export function stimmt(ist, soll, feld) {
  if (typeof soll === 'number' && typeof ist === 'number') {
    const spielraum = feld === 'quoteDezimal' ? QUOTE : CENT
    return Math.abs(ist - soll) <= spielraum
  }
  return ist === soll
}

/**
 * Gilt ein gelesener Wert als "nichts"?
 *
 * 'UNBEKANNT' gehoert dazu. Der Parser setzt das bei der Waehrung als
 * Platzhalter, nicht als Ergebnis. Wer es als Wahrheit festschreibt, verlangt
 * fuer immer, dass die Waehrung NICHT erkannt wird, und jede spaetere
 * Verbesserung macht den Test rot. Genau umgekehrt zu seinem Zweck.
 *
 * @param {unknown} w
 */
export function istNichts(w) {
  return w === null || w === undefined || w === '' || w === 'UNBEKANNT'
}

/**
 * Prueft einen Fall und gibt je geprueftem Feld eine Zeile zurueck.
 *
 * Wirft nie. Ein Absturz im Leseprogramm kommt als eigene Zeile heraus, damit
 * ihn sowohl der Test als auch die Messlatte sieht.
 *
 * @param {any} fall
 * @returns {{feld: string, soll: unknown, ist: unknown, gut: boolean, grund: string}[]}
 */
export function pruefeFall(fall) {
  let ergebnis
  try {
    ergebnis = leseSchein(fall.zeilen, fall.umgebung ?? {})
  } catch (fehler) {
    return [
      {
        feld: '(Absturz)',
        soll: '-',
        ist: fehler instanceof Error ? fehler.message : String(fehler),
        gut: false,
        grund: 'Das Leseprogramm ist an diesem Fall abgestuerzt.',
      },
    ]
  }

  const zeilen = []

  for (const [feld, soll] of Object.entries(fall.erwartet ?? {})) {
    const ist = wert(ergebnis, feld)
    zeilen.push({
      feld,
      soll,
      ist: ist === undefined ? '(nicht gefunden)' : ist,
      gut: stimmt(ist, soll, feld),
      grund: '',
    })
  }

  for (const feld of fall.nichtVorhanden ?? []) {
    const ist = wert(ergebnis, feld)
    zeilen.push({
      feld,
      soll: '(steht nicht auf dem Schein)',
      ist: ist === undefined ? '(nicht gefunden)' : ist,
      gut: istNichts(ist),
      grund: 'Auf dem Schein steht dazu nichts. Das Programm hat trotzdem einen Wert gefunden.',
    })
  }

  return zeilen
}

/**
 * Meldet einen ganzen Korpus als node-Tests an.
 *
 * @param {any} test  Die Funktion test aus node:test.
 * @param {any} assert  assert aus node:assert/strict.
 * @param {any[]} korpus
 * @param {{praefix?: string, nurDurchgesehene?: boolean}} [einstellungen]
 */
export function alsTests(test, assert, korpus, einstellungen = {}) {
  const praefix = einstellungen.praefix ?? 'liest'
  const nurDurchgesehene = einstellungen.nurDurchgesehene === true

  for (const fall of korpus) {
    // Ein Fall, den niemand angesehen hat, ist keine Wahrheit, sondern ein
    // Maschinenergebnis. Er wird sichtbar uebersprungen, nicht stillschweigend
    // geglaubt.
    const ungeprueft = nurDurchgesehene && fall.durchgesehen !== true

    test(
      `${praefix}: ${fall.name}`,
      ungeprueft ? { skip: 'nicht durchgesehen, deshalb keine geprueefte Wahrheit' } : {},
      () => {
        const zeilen = pruefeFall(fall)
        assert.ok(
          zeilen.length > 0,
          'Dieser Fall prueft gar nichts. Ein Fall ohne erwartete Werte ist wertlos.'
        )
        for (const z of zeilen) {
          assert.ok(
            z.gut,
            `${z.feld}: erwartet ${JSON.stringify(z.soll)}, gelesen ${JSON.stringify(z.ist)}` +
              (z.grund ? ` (${z.grund})` : '')
          )
        }
      }
    )
  }
}
