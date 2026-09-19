// Die grosse Suche: kern/suche.js.
//
// Jede Regel, die Karam am 19.09.2026 verlangt hat, steht hier als Probe:
// "nach Quoten, nach Datum, nach Name, nach Emoji suchen, nach den Scheinen
// und nach den Ordnern."

import test from 'node:test'
import assert from 'node:assert/strict'
import { durchsucheBestand, zahlSchreibweisen, datumSchreibweisen } from '../kern/suche.js'

/** Ein Feld, wie es im Programm liegt. */
const feld = (wert) => ({ wert, sicherheit: 1, quelle: 'hand' })

function schein(extra = {}) {
  return {
    id: extra.id ?? 's1',
    buchmacher: feld(extra.buchmacher ?? 'DraftKings'),
    scheinNr: feld(extra.scheinNr ?? 'AB123'),
    konto: feld(extra.konto ?? null),
    gesetztAm: feld(extra.gesetztAm ?? '2026-09-17T20:15:00'),
    einsatz: feld(extra.einsatz ?? 5481),
    quoteDezimal: feld(extra.quoteDezimal ?? 1.84),
    quoteAmerikanisch: feld(extra.quoteAmerikanisch ?? -119),
    auswahlen: extra.auswahlen ?? [],
    angelegtAm: extra.angelegtAm ?? '2026-09-18T09:00:00',
    notiz: extra.notiz,
  }
}

function bestand(extra = {}) {
  return {
    projektId: 'p1',
    projektName: 'Saison 2026',
    riesenscheine: extra.riesenscheine ?? [
      {
        id: 'r1',
        name: '🔥 Gibbs Anytime',
        ordner: 'Spieltag 3',
        notiz: 'Absicherung offen',
        angelegtAm: '2026-09-17T18:00:00',
        scheinIds: ['s1'],
      },
      {
        id: 'r2',
        name: 'Parlay Abend',
        ordner: '',
        notiz: '',
        angelegtAm: '2026-09-19T18:00:00',
        scheinIds: [],
      },
    ],
    scheine: extra.scheine ?? [schein()],
  }
}

test('leerer Suchtext findet nichts, mit Absicht', () => {
  assert.deepEqual(durchsucheBestand(bestand(), ''), [])
  assert.deepEqual(durchsucheBestand(bestand(), '   '), [])
})

test('Riesenschein nach Name, auch nach dem Emoji darin', () => {
  const nachName = durchsucheBestand(bestand(), 'gibbs')
  assert.equal(nachName.filter((t) => t.art === 'riesenschein').length, 1)
  assert.equal(nachName.find((t) => t.art === 'riesenschein')?.riesenscheinId, 'r1')

  const nachEmoji = durchsucheBestand(bestand(), '🔥')
  assert.equal(nachEmoji.some((t) => t.art === 'riesenschein' && t.riesenscheinId === 'r1'), true)
})

test('Ordner als eigener Treffer, genau einmal', () => {
  const treffer = durchsucheBestand(bestand(), 'spieltag')
  const ordner = treffer.filter((t) => t.art === 'ordner')
  assert.equal(ordner.length, 1)
  assert.equal(ordner[0].name, 'Spieltag 3')
  // Der Riesenschein im Ordner wird MIT gefunden, denn sein Ordnername
  // gehoert zu ihm; der Treffer sagt, in welchem Feld.
  const riesen = treffer.find((t) => t.art === 'riesenschein')
  assert.ok(riesen)
  assert.deepEqual(riesen.gefundenIn, ['Ordner'])
})

test('Schein nach Anbieter und Scheinnummer, mit Heimatangabe', () => {
  const treffer = durchsucheBestand(bestand(), 'draftkings')
  const s = treffer.find((t) => t.art === 'schein')
  assert.ok(s)
  assert.equal(s.riesenscheinId, 'r1')
  assert.equal(s.ordner, 'Spieltag 3')
  assert.deepEqual(s.gefundenIn, ['Anbieter'])

  assert.equal(
    durchsucheBestand(bestand(), 'ab123').some((t) => t.art === 'schein'),
    true
  )
})

test('Quote in beiden Schreibweisen und amerikanisch', () => {
  for (const suche of ['1,84', '1.84', '-119']) {
    const s = durchsucheBestand(bestand(), suche).find((t) => t.art === 'schein')
    assert.ok(s, `Quote "${suche}" muss den Schein finden`)
    assert.ok(s.gefundenIn.includes('Quote'), `"${suche}" muss als Quote gelten`)
  }
})

test('Quote aus einer Auswahl des Kombischeins zaehlt mit', () => {
  const b = bestand({
    scheine: [
      schein({
        quoteDezimal: null,
        quoteAmerikanisch: null,
        auswahlen: [
          { ereignis: feld('49ers @ Rams'), markt: feld('OVER 2.5'), tipp: feld('Deebo'), quoteDezimal: feld(2.96) },
        ],
      }),
    ],
  })
  assert.equal(durchsucheBestand(b, '2,96').some((t) => t.art === 'schein'), true)
  const nachTipp = durchsucheBestand(b, 'deebo').find((t) => t.art === 'schein')
  assert.ok(nachTipp)
  assert.deepEqual(nachTipp.gefundenIn, ['Auswahl'])
})

test('Datum als 17.09.2026, als 17.09. und roh', () => {
  for (const suche of ['17.09.2026', '17.09.', '2026-09-17']) {
    const treffer = durchsucheBestand(bestand(), suche)
    assert.equal(treffer.some((t) => t.art === 'schein'), true, `"${suche}" muss treffen`)
  }
})

test('Einsatz als 5481 und als 5.481,00', () => {
  for (const suche of ['5481', '5.481,00']) {
    const s = durchsucheBestand(bestand(), suche).find((t) => t.art === 'schein')
    assert.ok(s, `Einsatz "${suche}" muss den Schein finden`)
    assert.ok(s.gefundenIn.includes('Einsatz'))
  }
})

test('mehrere Woerter muessen ALLE passen, ueber Felder hinweg', () => {
  assert.equal(
    durchsucheBestand(bestand(), 'spieltag gibbs').some((t) => t.art === 'riesenschein'),
    true
  )
  assert.deepEqual(
    durchsucheBestand(bestand(), 'gibbs draftkings').filter((t) => t.art === 'riesenschein'),
    []
  )
})

test('ein Schein ohne Riesenschein bleibt findbar, ehrlich ohne Heimat', () => {
  const b = bestand({ scheine: [schein({ id: 's9' })] })
  b.riesenscheine = b.riesenscheine.map((r) => ({ ...r, scheinIds: [] }))
  const s = durchsucheBestand(b, 'draftkings').find((t) => t.art === 'schein')
  assert.ok(s)
  assert.equal(s.riesenscheinId, null)
  assert.equal(s.ordner, '')
})

test('zahlSchreibweisen: Tausenderpunkt und Komma', () => {
  assert.ok(zahlSchreibweisen(5481).includes('5.481,00'))
  assert.ok(zahlSchreibweisen(1.84).includes('1,84'))
  assert.deepEqual(zahlSchreibweisen(null), [])
  assert.deepEqual(zahlSchreibweisen('quatsch'), [])
})

test('datumSchreibweisen: unlesbares bleibt nur es selbst', () => {
  assert.deepEqual(datumSchreibweisen('2026-09-17T20:15:00'), [
    '2026-09-17T20:15:00',
    '17.09.2026',
    '17.09.',
  ])
  assert.deepEqual(datumSchreibweisen('irgendwann'), ['irgendwann'])
  assert.deepEqual(datumSchreibweisen(''), [])
})
