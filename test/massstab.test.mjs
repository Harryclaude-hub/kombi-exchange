import test from 'node:test'
import assert from 'node:assert/strict'

import { leseSchein } from '../kern/parser.js'
import { gruppiere, verschmelzeDoppelte, findeDoppelte } from '../kern/gruppierung.js'
import { rechne, rechneProjekt } from '../kern/rechnung.js'

/**
 * Karams eigentlicher Fall.
 *
 * Dieselbe Kombi wird bei vielen Anbietern gesetzt, oft bis zu sechzig Mal,
 * zusammen zwanzigtausend Euro und mehr. Alles davon muss in EINEN
 * Riesenschein, und die Summe muss auf den Cent stimmen.
 *
 * Die bisherigen Tests haben mit drei Scheinen gearbeitet. Drei sagt nichts
 * darueber, ob die Bildung der Gruppe bei sechzig noch traegt. Bei einer
 * Gruppenbildung, die jeden mit jedem vergleicht, aendert sich das Verhalten
 * mit der Anzahl: es gibt mehr Gelegenheiten, sich zu irren, und ein einziger
 * falsch zugeordneter Schein verschiebt die Gesamtsumme.
 */

const ANBIETER = [
  'BetOnline', 'SportsBetting.ag', 'LowVig.ag', 'Bovada', 'MyBookie', 'BetUS',
  'Everygame', 'Xbet', 'Heritage Sports', 'BetAnySports', 'Pinnacle', 'DraftKings',
  'FanDuel', 'BetMGM', 'Caesars', 'ESPN BET', 'Fanatics Sportsbook', 'PointsBet',
]

/**
 * Baut einen Schein ueber das echte Leseprogramm, nicht von Hand.
 *
 * Wichtig: es wird wirklich Text gelesen. Ein Test, der die Felder direkt
 * setzt, prueft die Gruppenbildung, aber nicht das Lesen. Hier soll beides
 * zusammen laufen, so wie im Betrieb.
 */
function scheinVon(nummer, anbieter, einsatz, kontoNr) {
  const zeilen = [
    `#${39622000 + nummer}  Sep 10, 10:4${nummer % 10} PM`,
    'Deebo Samuel',
    'San Francisco 49ers @ Los Angeles Rams',
    'WILL HAVE OVER 2.5 RECEPTIONS',
    `Odds: -157   Stake: $ ${einsatz}   Returns: $ ${(einsatz * 1.6369426751592357).toFixed(2)}`,
  ]
  return leseSchein(zeilen, {
    id: `S${nummer}`,
    projektId: 'P1',
    bildId: `B${nummer}`,
    ausschnitt: { x: 0, y: 0, breite: 100, hoehe: 100 },
    positionImBild: 0,
    gebiet: 'us',
    waehrung: 'USD',
    quotenformat: 'amerikanisch',
    bezugsjahr: 2026,
    bezugsmonat: 9,
    zeitstempel: '2026-09-13T00:00',
    ocrSicherheit: 0.9,
    buchmacher: anbieter,
    buchmacherSicherheit: 0.95,
    konto: kontoNr,
  })
}

/** Sechzig Scheine derselben Wette, verteilt auf achtzehn Anbieter. */
function sechzigScheine() {
  const scheine = []
  let summe = 0
  for (let i = 0; i < 60; i++) {
    const anbieter = ANBIETER[i % ANBIETER.length]
    // Unterschiedliche Einsaetze, so wie es wirklich ist: mal 181, mal 300,
    // mal 500. Zusammen kommt eine grosse Summe heraus.
    const einsatz = [181, 300, 500, 250, 420][i % 5]
    summe += einsatz
    scheine.push(scheinVon(i, anbieter, einsatz, `P-${400 + (i % 7)}`))
  }
  return { scheine, summe }
}

test('sechzig Scheine derselben Wette landen in EINEM Riesenschein', () => {
  const { scheine } = sechzigScheine()
  const ergebnis = gruppiere(scheine)

  assert.equal(
    ergebnis.gruppen.length,
    1,
    `erwartet 1 Gruppe, bekommen ${ergebnis.gruppen.length}: ` +
      ergebnis.gruppen.map((g) => g.scheinIds.length).join(' + ')
  )
  assert.equal(ergebnis.gruppen[0].scheinIds.length, 60)
  assert.equal(ergebnis.restposten.length, 0, 'kein Schein darf liegenbleiben')
})

test('die Summe von sechzig Scheinen stimmt auf den Cent', () => {
  const { scheine, summe } = sechzigScheine()
  const gruppen = gruppiere(scheine)
  const r = rechne(scheine)

  assert.equal(r.einsatzGesamt, summe, `Gesamteinsatz erwartet ${summe}`)

  // Gegenrechnung auf einem zweiten Weg: Einsatz mal Quote, Schein fuer Schein.
  let vonHand = 0
  for (const s of scheine) vonHand += Math.round(s.einsatz.wert * s.quoteDezimal.wert * 100) / 100
  assert.ok(
    Math.abs(r.auszahlungMoeglich - vonHand) < 0.5,
    `Auszahlung: Programm ${r.auszahlungMoeglich}, von Hand ${vonHand}`
  )

  assert.deepEqual(
    r.hinweise.filter((h) => h.schwere === 'fehler'),
    [],
    'bei sechzig stimmigen Scheinen darf kein Fehler entstehen'
  )
  assert.equal(gruppen.gruppen.length, 1)
})

test('zwanzigtausend Euro gehen nicht in Rundung verloren', () => {
  // Vierzig Scheine zu 500, das sind genau 20000.
  const scheine = []
  for (let i = 0; i < 40; i++) {
    scheine.push(scheinVon(i, ANBIETER[i % ANBIETER.length], 500, 'P-417'))
  }
  const r = rechne(scheine)
  assert.equal(r.einsatzGesamt, 20000, 'genau zwanzigtausend, keine Abweichung')

  // Und ueber die Projektebene, wo noch einmal summiert wird.
  const projekt = rechneProjekt([r])
  assert.equal(projekt.einsatzGesamt, 20000)
  assert.equal(projekt.anzahlScheine, 40)
})

test('achtzehn Anbieter werden alle einzeln erkannt', () => {
  const { scheine } = sechzigScheine()
  const r = rechne(scheine)
  assert.equal(
    r.buchmacher.length,
    ANBIETER.length,
    `erwartet ${ANBIETER.length} Anbieter, gezaehlt ${r.buchmacher.length}: ${r.buchmacher.join(', ')}`
  )
  for (const a of ANBIETER) {
    assert.ok(r.buchmacher.includes(a), `${a} fehlt in der Aufstellung`)
  }
})

test('derselbe Schein zweimal hochgeladen wird zusammengefuehrt, nicht doppelt gezaehlt', () => {
  const { scheine, summe } = sechzigScheine()

  // Zwanzig davon noch einmal, als waere ein Bildschirmfoto zweimal hochgeladen.
  // Gleiche Scheinnummer, gleicher Anbieter, gleiches Konto, gleiche Waehrung.
  const doppelt = scheine.slice(0, 20).map((s) => ({ ...s, id: `${s.id}-nochmal` }))
  const alle = [...scheine, ...doppelt]

  const gefunden = findeDoppelte(alle)
  assert.equal(gefunden.length, 20, `erwartet 20 Doppelpaare, gefunden ${gefunden.length}`)

  const bereinigt = verschmelzeDoppelte(alle)
  assert.equal(bereinigt.scheine.length, 60, 'nach dem Zusammenfuehren wieder sechzig')

  const r = rechne(bereinigt.scheine)
  assert.equal(
    r.einsatzGesamt,
    summe,
    'der doppelt hochgeladene Schein darf den Einsatz NICHT verdoppeln'
  )
})

test('sechzig Scheine sind in Sekundenbruchteilen gerechnet', () => {
  // Die Gruppenbildung vergleicht jeden mit jedem. Bei sechzig sind das
  // 1770 Vergleiche. Das muss schnell genug sein, dass die Oberflaeche nicht
  // stehenbleibt, sonst wirkt das Programm kaputt.
  const { scheine } = sechzigScheine()
  const start = process.hrtime.bigint()
  gruppiere(scheine)
  rechne(scheine)
  const dauerMs = Number(process.hrtime.bigint() - start) / 1e6

  assert.ok(dauerMs < 1500, `Gruppenbildung und Rechnung brauchten ${dauerMs.toFixed(0)} ms`)
})

test('eine fremde Wette dazwischen wird NICHT mit eingruppiert', () => {
  const { scheine } = sechzigScheine()

  // Ein ganz anderes Spiel, mitten in den Stapel gelegt.
  const fremd = leseSchein(
    [
      '#39699999  Sep 11, 08:15 PM',
      'Patrick Mahomes',
      'Kansas City Chiefs @ Buffalo Bills',
      'WILL HAVE OVER 275.5 PASSING YARDS',
      'Odds: -110   Stake: $ 200   Returns: $ 381.82',
    ],
    {
      id: 'FREMD',
      projektId: 'P1',
      bildId: 'BF',
      ausschnitt: { x: 0, y: 0, breite: 100, hoehe: 100 },
      positionImBild: 0,
      gebiet: 'us',
      waehrung: 'USD',
      quotenformat: 'amerikanisch',
      bezugsjahr: 2026,
      bezugsmonat: 9,
      zeitstempel: '2026-09-13T00:00',
      ocrSicherheit: 0.9,
      buchmacher: 'BetOnline',
      buchmacherSicherheit: 0.95,
    }
  )

  const ergebnis = gruppiere([...scheine, fremd])

  const grosse = ergebnis.gruppen.find((g) => g.scheinIds.length >= 50)
  assert.ok(grosse, 'die grosse Gruppe muss es weiterhin geben')
  assert.equal(grosse.scheinIds.length, 60, 'die fremde Wette darf nicht mit hinein')

  // Sie muss sichtbar bleiben, entweder als eigene Gruppe oder als Restposten.
  const woanders =
    ergebnis.gruppen.some((g) => g.scheinIds.includes('FREMD')) ||
    ergebnis.restposten.some((r) => r.scheinId === 'FREMD' || r.id === 'FREMD')
  assert.ok(woanders, 'die fremde Wette darf nicht verschwinden')
})
