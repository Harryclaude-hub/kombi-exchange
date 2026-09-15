import test from 'node:test'
import assert from 'node:assert/strict'

import { BUCHMACHER, schluesselFuerName, kuerzelFuer } from '../kern/buchmacher.js'

/**
 * Vom Anzeigenamen zurueck zum Schluessel.
 *
 * WOZU DAS GEBRAUCHT WIRD
 *
 * Karam am 16.09.2026: "es ist sehr wichtig, dass jeder Anbieter mit dem Logo
 * dasteht". Das Logo haengt am technischen Schluessel (ps3838, betway), denn
 * der aendert sich nie. Am Schein steht aber nur der ANZEIGENAME ("PS3838"),
 * weil oberflaeche/aufnahme.js beim Lesen profil.name ablegt, nicht
 * profil.schluessel. Ohne einen Rueckweg findet die Anzeige kein Logo.
 *
 * Der Name ist ausserdem ein freies Textfeld: Karam kann ihn ueberschreiben.
 * Deshalb muss die Suche auch "Bet 365" und " betway " verkraften und bei
 * Unsinn ehrlich null liefern, statt irgendetwas zu raten.
 */

test('jeder Anzeigename findet seinen eigenen Schluessel zurueck', () => {
  // Die harte Runde: alle sechzig Profile, keine Ausnahme.
  for (const profil of BUCHMACHER) {
    assert.equal(
      schluesselFuerName(profil.name),
      profil.schluessel,
      `"${profil.name}" sollte ${profil.schluessel} ergeben`
    )
  }
})

test('Gross- und Kleinschreibung und Leerzeichen sind egal', () => {
  assert.equal(schluesselFuerName('ps3838'), 'ps3838')
  assert.equal(schluesselFuerName('  PS3838  '), 'ps3838')
  assert.equal(schluesselFuerName('BETWAY'), 'betway')
  assert.equal(schluesselFuerName('bet365'), 'bet365')
})

test('eine abweichende Schreibweise wird ueber den Schriftzug gefunden', () => {
  // Karam tippt den Namen von Hand um. "Bet 365" mit Leerzeichen ist dasselbe
  // Haus, und das Logo soll trotzdem erscheinen.
  assert.equal(schluesselFuerName('Bet 365'), 'bet365')
  assert.equal(schluesselFuerName('Bet Online'), 'betonline')
})

test('was kein Anbieter ist, ergibt null und nicht irgendetwas', () => {
  // Projektregel 1: wo nichts belegt ist, wird nichts geraten. Ein falsches
  // Logo waere schlimmer als gar keines, weil es eine Zuordnung behauptet.
  for (const unsinn of ['', '   ', 'Gibt es nicht', 'xyz123']) {
    assert.equal(schluesselFuerName(unsinn), null, `"${unsinn}"`)
  }
  assert.equal(schluesselFuerName(null), null)
  assert.equal(schluesselFuerName(undefined), null)
})

test('das Kuerzel steht fuer den Anbieter, solange kein Bild da ist', () => {
  // Bis Karams echte Logodateien da sind, traegt jeder Anbieter ein kurzes
  // Zeichen aus seinem Namen. Es muss kurz sein (sonst passt es nicht in den
  // Kreis) und darf nie leer sein (sonst steht dort ein leerer Fleck).
  for (const profil of BUCHMACHER) {
    const k = kuerzelFuer(profil.name)
    assert.ok(k.length >= 1 && k.length <= 4, `${profil.name} ergab "${k}"`)
    assert.equal(k, k.toUpperCase(), `${profil.name}: das Kuerzel steht in Grossbuchstaben`)
  }
  assert.equal(kuerzelFuer('PS3838'), 'PS')
  assert.equal(kuerzelFuer('BetOnline'), 'BO')
  assert.equal(kuerzelFuer('bet365'), 'B365')
  assert.equal(kuerzelFuer('Betway'), 'BE')
  assert.equal(kuerzelFuer('Stake'), 'ST')
})

test('auch ein unbekannter Name bekommt ein Kuerzel', () => {
  // Ein Anbieter, den die Liste nicht kennt, soll trotzdem ein Zeichen haben.
  // Sonst waere die Liste der Anbieter optisch loechrig, und genau das wollte
  // Karam nicht.
  assert.equal(kuerzelFuer('Mein Buchmacher'), 'MB')
  assert.equal(kuerzelFuer('Sportwetten'), 'SP')
  assert.ok(kuerzelFuer('').length >= 1, 'auch ohne Namen steht etwas da')
})
