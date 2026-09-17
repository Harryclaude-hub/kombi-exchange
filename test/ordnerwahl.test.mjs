import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Der Bauplan fuer die Ordnerauswahl.
 *
 * Karam am 17.09.2026: "Wenn ich was speichere, kann ich einen Ordner
 * aussuchen oder ich kann direkt einen neuen Ordner anlegen. Entweder ich kann
 * den Ordner leer lassen oder einen Ordner rein oder direkt einen neuen
 * erstellen."
 *
 * Drei Wege, und alle drei muessen ZU SEHEN sein. Vorher hing an dem Textfeld
 * nur eine Liste, die sich erst beim Tippen zeigt; wer seine Ordner nicht
 * auswendig wusste, sah sie gar nicht.
 */

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

const Ordner = await import('../oberflaeche/ordner.js')

test('"Kein Ordner" steht immer an erster Stelle', () => {
  // Auch wenn es noch gar keinen Ordner gibt. Der Weg "lass es lose" darf nie
  // fehlen, sonst sieht es aus, als MUESSE man sich fuer einen entscheiden.
  const leer = Ordner.ordnerfeldbauplan([])
  assert.equal(leer.auswahl.length, 1)
  assert.equal(leer.auswahl[0].wert, Ordner.OHNE_ORDNER)

  const voll = Ordner.ordnerfeldbauplan(['Spieltag 3', 'Longshots'])
  assert.equal(voll.auswahl[0].wert, Ordner.OHNE_ORDNER)
  assert.equal(voll.auswahl.length, 3)
})

test('der jetzige Ordner wird NICHT herausgefiltert', () => {
  /*
    Vorher filterte frageNachOrdner den jetzigen Ordner aus der Liste. Das war
    gut gemeint und schlecht: wer aus Versehen auf "Ordner aendern" drueckt,
    fand den Ordner, in dem der Riesenschein GERADE liegt, nicht wieder und
    musste ihn abtippen, um alles so zu lassen, wie es war.
  */
  const bauplan = Ordner.ordnerfeldbauplan(['Spieltag 3', 'Longshots'], 'Spieltag 3')
  const namen = bauplan.auswahl.map((a) => a.wert)
  assert.ok(namen.includes('Spieltag 3'), namen.join(', '))
  assert.equal(bauplan.wert, 'Spieltag 3')
})

test('am Knopf steht, wie viele darin liegen', () => {
  // Sonst waere "Spieltag 3" eine Behauptung; so ist es eine Angabe.
  const bauplan = Ordner.ordnerfeldbauplan(
    ['Spieltag 3', 'Longshots'],
    '',
    new Map([
      ['Spieltag 3', 12],
      ['Longshots', 1],
    ])
  )
  const spieltag = bauplan.auswahl.find((a) => a.wert === 'Spieltag 3')
  const longshots = bauplan.auswahl.find((a) => a.wert === 'Longshots')
  assert.equal(spieltag.zusatz, '12 Stück')
  assert.equal(longshots.zusatz, '1 Stück', 'Einzahl bei genau einem')
})

test('ohne Anzahlen steht keine erfundene Zahl da', () => {
  // Projektregel 1: lieber eine Luecke als ein erfundener Wert.
  const bauplan = Ordner.ordnerfeldbauplan(['Spieltag 3'])
  assert.equal(bauplan.auswahl[1].zusatz, undefined)

  const mitNull = Ordner.ordnerfeldbauplan(['Spieltag 3'], '', new Map([['Spieltag 3', 0]]))
  assert.equal(mitNull.auswahl[1].zusatz, undefined)
})

test('leere und doppelte Namen kommen nicht in die Auswahl', () => {
  // OHNE_ORDNER ist der leere Name. Stuende er auch in der Liste, gaebe es
  // zwei Knoepfe fuer denselben Weg.
  const bauplan = Ordner.ordnerfeldbauplan(['', 'Spieltag 3', Ordner.OHNE_ORDNER])
  assert.equal(bauplan.auswahl.length, 2)
  assert.equal(bauplan.auswahl.filter((a) => a.wert === Ordner.OHNE_ORDNER).length, 1)
})

test('der Bauplan nimmt NAMEN, nicht Riesenscheine', () => {
  /*
    Das ist die wichtigste Eigenschaft dieser Schnittstelle. In der Ablage
    ordnen Ordner PROJEKTE, in der Uebersicht RIESENSCHEINE. Waeren
    Riesenscheine der Parameter, waere die Funktion fuer die Ablage
    unbrauchbar, und daneben entstuende eine zweite. Genau die Verwechslung
    der beiden Ebenen ist das, wovor Karam ausdruecklich Angst hatte.
  */
  const ausProjekten = Ordner.ordnerfeldbauplan(['Saison 2026', 'Archiv'])
  assert.equal(ausProjekten.auswahl.length, 3)
  assert.equal(ausProjekten.auswahl[1].name, 'Saison 2026')
})

test('das Feld heisst ordner und traegt einen Platzhalter fuer den neuen', () => {
  const bauplan = Ordner.ordnerfeldbauplan([])
  assert.equal(bauplan.name, 'ordner')
  assert.ok(bauplan.platzhalter.length > 0)
  assert.ok(bauplan.neuHilfe.length > 0, 'der dritte Weg braucht einen Satz')
})
