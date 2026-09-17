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
  assert.equal(kuerzelFuer('Stake'), 'ST')

  // Betway hiess bis zum 17.09.2026 "BE", und "BE" hiessen auch Betano,
  // Bet3000, Betfair, Betfred und Betsson. Siehe die naechste Probe.
  assert.equal(kuerzelFuer('Betway'), 'BTW')
})

test('KEINE ZWEI ANBIETER TRAGEN DASSELBE KUERZEL', () => {
  /*
    Am 17.09.2026 gemessen, vor der Berichtigung: 60 Anbieter, 47
    verschiedene Kuerzel, 9 Kollisionen. Die schlimmste:

      BE: Betano, Bet3000, Betway, Betfair, Betfred, Betsson

    SECHS Anbieter mit demselben Zeichen, darunter Betway, einer von Karams
    fuenf. In einer Liste von sechzig Scheinen standen sie als sechs gleiche
    graue Kaestchen untereinander. Das Zeichen soll sagen, WER gesetzt hat,
    und sagte es nicht. Genau darum hat Karam nach echten Logos gefragt.

    Diese Probe ist die eigentliche Sicherung: wer einen Anbieter dazunimmt,
    dessen Name mit einem vorhandenen kollidiert, erfaehrt es hier und nicht
    erst, wenn zwei Zeichen in der Liste gleich aussehen.
  */
  const gesehen = new Map()
  for (const profil of BUCHMACHER) {
    const k = kuerzelFuer(profil.name)
    const schon = gesehen.get(k)
    assert.equal(schon, undefined, `"${k}" tragen ${schon} UND ${profil.name}`)
    gesehen.set(k, profil.name)
  }
  assert.equal(gesehen.size, BUCHMACHER.length)
})

test('die Kuerzel bleiben lesbar, auch wo sie ausweichen mussten', () => {
  /*
    Eindeutig allein reicht nicht. Wer bei einer Kollision einfach
    verlaengert, bekommt BET, BETW, BETF, BETS: vier Kuerzel, die sich erst
    am letzten Zeichen unterscheiden, auf einem Kaestchen von 24 Pixeln.

    Deshalb wird zuerst der erste Buchstabe mit dem ersten Buchstaben
    DAHINTER versucht, der die Namen trennt.
  */
  assert.equal(kuerzelFuer('Betway'), 'BTW')
  assert.equal(kuerzelFuer('Betfair'), 'BF')
  assert.equal(kuerzelFuer('Betsson'), 'BS')
  assert.equal(kuerzelFuer('Bovada'), 'BV')
  assert.equal(kuerzelFuer('Cashpoint'), 'CS')
  assert.equal(kuerzelFuer('Tipwin'), 'TP')

  // Und keines wird laenger als der Kreis breit ist.
  for (const profil of BUCHMACHER) {
    assert.ok(kuerzelFuer(profil.name).length <= 4, profil.name)
  }
})

test('auch ein unbekannter Name bekommt ein Kuerzel', () => {
  // Ein Anbieter, den die Liste nicht kennt, soll trotzdem ein Zeichen haben.
  // Sonst waere die Liste der Anbieter optisch loechrig, und genau das wollte
  // Karam nicht.
  assert.equal(kuerzelFuer('Mein Buchmacher'), 'MB')
  assert.equal(kuerzelFuer('Sportwetten'), 'SP')
  assert.ok(kuerzelFuer('').length >= 1, 'auch ohne Namen steht etwas da')
})
