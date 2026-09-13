import test from 'node:test'
import assert from 'node:assert/strict'

import { leseZahl } from '../kern/zahlen.js'
import { leseSchein } from '../kern/parser.js'

/**
 * Das Gebiet entscheidet ueber Punkt und Komma. Wenn es unbekannt ist, darf
 * niemand raten.
 *
 * "1.250" heisst im deutschen Raum eintausendzweihundertfuenfzig und im
 * englischen eins Komma zwei fuenf. Der Unterschied ist der Faktor tausend.
 *
 * Gefunden am 13.09.2026 beim Durchsehen des Bildwegs, bevor die echten Fotos
 * liefen: wird der Anbieter im Bildkopf nicht erkannt, gab es kein Profil und
 * damit kein Gebiet. Beide Stellen haben dann stillschweigend auf 'en'
 * geschaltet, statt die Frage offen zu lassen:
 *
 *   oberflaeche/aufnahme.js   gebiet: profil?.gebiet ?? 'en'
 *   kern/parser.js            const gebiet = umgebung.gebiet ?? 'en'
 *
 * Folge: ein deutscher Schein ueber 1.250 Euro wurde zu 1,25 Euro, ohne jede
 * Warnung. kern/zahlen.js hat den richtigen Zweig dafuer laengst (mehrdeutig),
 * er war nur nicht erreichbar, weil nie null ankam.
 *
 * Das ist Regel 1 des Projekts: wo kein Pruefstein ist, entscheidet der Mensch.
 * Bei Punkt oder Komma gibt es keinen. Also wird gefragt, nicht geraten.
 */

test('kern/zahlen.js kann es laengst: ohne Gebiet ist "1.250" mehrdeutig', () => {
  const ohne = leseZahl('1.250', { gebiet: null })
  assert.equal(ohne.mehrdeutig, true, 'ohne Gebiet muss es als mehrdeutig gelten')
  assert.equal(ohne.wert, 1250, 'im Zweifel die Ziffern stehen lassen, nicht dividieren')

  assert.equal(leseZahl('1.250', { gebiet: 'de' }).wert, 1250)
  assert.equal(leseZahl('1.250', { gebiet: 'en' }).wert, 1.25)
})

test('leseSchein ohne Gebiet macht aus 1.250 nicht stillschweigend 1,25', () => {
  const e = leseSchein(
    ['Bet ID: 8842019773', 'Bayern Muenchen - Dortmund', 'Einsatz: 1.250   Quote: 2,00'],
    {}
  )

  assert.notEqual(
    e.einsatz.wert,
    1.25,
    'Ohne bekanntes Gebiet darf der Punkt nicht als Dezimalpunkt gelten. Das ist der Faktor tausend.'
  )
  assert.equal(e.einsatz.wert, 1250)
  assert.ok(
    e.hinweise.some((h) => h.code === 'trennzeichen_mehrdeutig'),
    'Der Fall muss sichtbar werden. Ein stiller Faktor tausend ist das Schlimmste, was hier passieren kann.'
  )
})

test('mit bekanntem Gebiet bleibt alles wie bisher', () => {
  const zeilen = ['Bet ID: 8842019773', 'Bayern - Dortmund', 'Einsatz: 1.250   Quote: 2,00']

  const deutsch = leseSchein(zeilen, { gebiet: 'de' })
  assert.equal(deutsch.einsatz.wert, 1250)
  assert.ok(
    !deutsch.hinweise.some((h) => h.code === 'trennzeichen_mehrdeutig'),
    'Mit bekanntem Gebiet ist nichts mehrdeutig, sonst warnt das Programm bei jedem Schein'
  )

  const englisch = leseSchein(['Bet ID: 8842019773', 'Stake: 1.250   Odds: 2.00'], { gebiet: 'en' })
  assert.equal(englisch.einsatz.wert, 1.25)
})

test('ein amerikanischer Schein mit Komma-Tausendern bleibt richtig', () => {
  // Die Gegenprobe: der Fall, der durch die Aenderung kaputtgehen koennte.
  const e = leseSchein(
    ['396228612  Sep 10, 10:45 PM', 'Odds: -157   Stake: $ 20,000   Returns: $ 32,800'],
    { gebiet: 'us', quotenformat: 'amerikanisch' }
  )
  assert.equal(e.einsatz.wert, 20000)
  assert.equal(e.auszahlung.wert, 32800)
})
