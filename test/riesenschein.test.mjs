import test from 'node:test'
import assert from 'node:assert/strict'

import { leseSchein } from '../kern/parser.js'
import {
  gruppiere,
  findeDoppelte,
  verschmelzeDoppelte,
  verschmelze,
  schlageNamenVor,
} from '../kern/gruppierung.js'
import { vergleicheScheine, ueberlappung, woerter, marktart } from '../kern/kennung.js'
import {
  rechne,
  realisierterRueckfluss,
  rechneProjekt,
  barEinsatz,
} from '../kern/rechnung.js'

function umgebung(id, zusatz = {}) {
  return {
    id,
    projektId: 'P1',
    bildId: `B-${id}`,
    ausschnitt: { x: 0, y: 0, breite: 100, hoehe: 100 },
    positionImBild: 0,
    gebiet: 'en',
    waehrung: 'USD',
    quotenformat: 'amerikanisch',
    bezugsjahr: 2026,
    bezugsmonat: 9,
    zeitstempel: '2026-09-13T00:00',
    ocrSicherheit: 0.9,
    buchmacher: 'BetOnline',
    buchmacherSicherheit: 0.98,
    ...zusatz,
  }
}

function nahe(a, b, genauigkeit = 1e-8) {
  assert.ok(a !== null && a !== undefined, 'Wert fehlt')
  assert.ok(Math.abs(a - b) < genauigkeit, `erwartet ${b}, bekommen ${a}`)
}

/** Baut einen Schein von Hand, ohne Texterkennung. */
function bau(id, status, einsatz, quote, zusatz = {}) {
  return {
    id,
    projektId: 'P1',
    gruppeId: null,
    buchmacher: { wert: 'Test', sicherheit: 1, quelle: 'hand' },
    konto: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
    scheinNr: { wert: id, sicherheit: 1, quelle: 'hand' },
    gesetztAm: { wert: '2026-09-10T20:00', sicherheit: 1, quelle: 'hand' },
    einsatz: { wert: einsatz, sicherheit: 1, quelle: 'hand' },
    waehrung: { wert: 'EUR', sicherheit: 1, quelle: 'hand' },
    quoteDezimal: { wert: quote, sicherheit: 1, quelle: 'hand' },
    quoteAmerikanisch: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
    auszahlung: { wert: einsatz * quote, sicherheit: 1, quelle: 'berechnet' },
    ausgezahlt: { wert: null, sicherheit: 0, quelle: 'vorgabe' },
    status,
    art: 'einzel',
    auswahlen: [],
    gratiswette: false,
    eachWay: false,
    bildId: 'B',
    ausschnitt: { x: 0, y: 0, breite: 1, hoehe: 1 },
    positionImBild: 0,
    rohtext: '',
    ocrSicherheit: 1,
    hinweise: [],
    vonHand: true,
    ausgeschlossen: false,
    angelegtAm: '2026-09-13T00:00',
    geaendertAm: '2026-09-13T00:00',
    ...zusatz,
  }
}

// Die drei echten Scheine aus Karams Screenshot. Dieselbe Wette, drei Mal gesetzt.
function dieDreiEchten() {
  const a = leseSchein(
    [
      '#396228612 Sep 10, 10:42 PM won',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'FINAL PLAYER SCORE: 4',
      'Odds: -157        Stake: $ 181        Returns: $ 296.84',
    ],
    umgebung('S1')
  )
  const b = leseSchein(
    [
      '#396228581 Sep 10, 10:41 PM won',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'FINAL PLAYER SCORE: 4',
      'Odds: -157        Stake: $ 300        Returns: $ 492',
    ],
    umgebung('S2')
  )
  const c = leseSchein(
    [
      '#396228545 Sep 10, 10:41 PM won',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'FINAL PLAYER SCORE: 4',
      'Odds: -157        Stake: $ 300        Returns: $ 492',
    ],
    umgebung('S3')
  )
  return [a, b, c]
}

// Der vierte Schein aus dem Screenshot. Er gehoert NICHT dazu.
function derVierte() {
  return leseSchein(
    [
      '#381217420 Feb 8, 11:37 PM won',
      'LONGEST RUSH - KENNETH WALKER III - OVER 14.5 (SEA @ NE)',
      'Seattle Seahawks @ New England Patriots',
      'Odds: -121        Stake: $ 2        Returns: $ 3.66',
    ],
    umgebung('S4')
  )
}

// Derselbe Tipp bei einem anderen Buchmacher, anders geschrieben.
function beiEinemAnderenAnbieter() {
  return leseSchein(
    [
      '#77001 Sep 10, 10:30 PM won',
      'Deebo Samuel',
      'SF 49ers vs LA Rams',
      'RECEPTIONS OVER 2.5',
      'Odds: -160   Risk: $ 200   To Win: $ 125',
    ],
    umgebung('S5', { buchmacher: 'Bovada' })
  )
}

test('die drei echten Scheine landen in einem Riesenschein', () => {
  const ergebnis = gruppiere(dieDreiEchten())
  assert.equal(ergebnis.gruppen.length, 1, 'Es darf nur eine Gruppe geben')
  assert.deepEqual(ergebnis.gruppen[0].scheinIds.sort(), ['S1', 'S2', 'S3'])
  assert.deepEqual(ergebnis.restposten, [])
})

test('der vierte Schein wird nicht dazugezaehlt', () => {
  const ergebnis = gruppiere([...dieDreiEchten(), derVierte()])
  assert.equal(ergebnis.gruppen.length, 2, 'Es muessen zwei getrennte Wetten sein')
  const klein = ergebnis.gruppen.find((g) => g.scheinIds.length === 1)
  assert.ok(klein, 'Die Einzelwette fehlt')
  assert.deepEqual(klein.scheinIds, ['S4'])
})

test('derselbe Tipp bei einem anderen Anbieter wird trotz anderer Schreibweise erkannt', () => {
  const ergebnis = gruppiere([...dieDreiEchten(), beiEinemAnderenAnbieter()])
  assert.equal(ergebnis.gruppen.length, 1, 'Alle vier gehoeren zusammen')
  assert.equal(ergebnis.gruppen[0].scheinIds.length, 4)
})

test('derselbe Tipp an einem anderen Spieltag wird NICHT zusammengefuehrt', () => {
  // Das ist die gefaehrlichste Verwechslung: derselbe Spieler, derselbe Markt,
  // dieselbe Linie, aber ein anderes Spiel sieben Wochen spaeter.
  const [erster] = dieDreiEchten()
  const spaeter = leseSchein(
    [
      '#399999999 Oct 29, 9:15 PM won',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157        Stake: $ 250        Returns: $ 410',
    ],
    umgebung('S9', { bezugsmonat: 10 })
  )

  const vergleich = vergleicheScheine(erster, spaeter)
  assert.ok(
    vergleich.punkte < 0.8,
    `Sieben Wochen Abstand muessen die Punktzahl druecken, waren aber ${vergleich.punkte}`
  )

  const ergebnis = gruppiere([erster, spaeter])
  assert.equal(ergebnis.gruppen.length, 2, 'Zwei verschiedene Spieltage, zwei Riesenscheine')
})

test('der Vergleich beurteilt die Aehnlichkeit nachvollziehbar', () => {
  const [a] = dieDreiEchten()
  const nah = vergleicheScheine(a, beiEinemAnderenAnbieter())
  assert.ok(nah.punkte >= 0.8, `erwartet mindestens 0.8, bekommen ${nah.punkte}`)
  const fern = vergleicheScheine(a, derVierte())
  assert.ok(fern.punkte < 0.6, `erwartet unter 0.6, bekommen ${fern.punkte}`)
})

test('derselbe Schein zweimal erfasst wird erkannt und nicht doppelt gezaehlt', () => {
  const scheine = dieDreiEchten()
  const nochmal = leseSchein(
    [
      '#396228612 Sep 10, 10:42 PM won',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157        Stake: $ 181        Returns: $ 296.84',
    ],
    umgebung('S1-nochmal')
  )
  const alle = [...scheine, nochmal]

  const funde = findeDoppelte(alle)
  assert.equal(funde.length, 1)
  assert.equal(funde[0].sicher, true)
  assert.equal(funde[0].scheinId, 'S1-nochmal')

  const ergebnis = gruppiere(alle)
  assert.equal(ergebnis.restposten.length, 1)
  assert.equal(ergebnis.restposten[0].scheinId, 'S1-nochmal')

  // Die Summe bleibt bei 781, der doppelte Schein zaehlt nicht mit.
  const gruppe = ergebnis.gruppen[0]
  const dabei = alle.filter((s) => gruppe.scheinIds.includes(s.id))
  nahe(rechne(dabei).einsatzGesamt, 781)
})

test('offen erfasst und spaeter entschieden erfasst ergibt einen Schein, nicht zwei', () => {
  const offen = leseSchein(
    [
      '#396228612 Sep 10, 10:42 PM pending',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157        Stake: $ 181        Returns: $ 296.84',
    ],
    umgebung('A', { zeitstempel: '2026-09-10T23:00' })
  )
  const entschieden = leseSchein(
    [
      '#396228612 Sep 10, 10:42 PM won',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'FINAL PLAYER SCORE: 4',
      'Odds: -157        Stake: $ 181        Returns: $ 296.84',
    ],
    umgebung('B', { zeitstempel: '2026-09-11T09:00' })
  )
  offen.angelegtAm = '2026-09-10T23:00'
  entschieden.angelegtAm = '2026-09-11T09:00'

  const ergebnis = verschmelzeDoppelte([offen, entschieden])
  assert.equal(ergebnis.scheine.length, 1, 'Aus zwei Aufnahmen wird ein Schein')
  assert.equal(ergebnis.verschmolzen.length, 1)

  const einer = ergebnis.scheine[0]
  assert.equal(einer.status, 'gewonnen', 'Der entschiedene Stand gewinnt')
  nahe(einer.einsatz.wert, 181, 1e-8)

  // Und ganz wichtig: der Einsatz zaehlt nur einmal.
  nahe(rechne(ergebnis.scheine).einsatzGesamt, 181)
})

test('beim Zusammenfuehren gewinnt ein von Hand gesetzter Wert', () => {
  const a = bau('X', 'gewonnen', 100, 2)
  const b = bau('X2', 'gewonnen', 999, 2)
  a.einsatz = { wert: 100, sicherheit: 1, quelle: 'hand' }
  b.einsatz = { wert: 999, sicherheit: 1, quelle: 'ocr' }
  const zusammen = verschmelze(a, b)
  nahe(zusammen.einsatz.wert, 100)
})

test('die Summen der drei echten Scheine stimmen', () => {
  const r = rechne(dieDreiEchten())

  assert.equal(r.anzahlScheine, 3)
  assert.equal(r.anzahlBuchmacher, 1)
  assert.equal(r.waehrung, 'USD')
  assert.equal(r.waehrungGemischt, false)

  nahe(r.einsatzGesamt, 781)
  nahe(r.auszahlungMoeglich, 1280.84)
  nahe(r.gewinnMoeglich, 499.84)
  nahe(r.auszahlungRealisiert, 1280.84)
  nahe(r.ergebnisRealisiert, 499.84)
  nahe(r.imRisiko, 0)
  nahe(r.einsatzOffen, 0)
  nahe(r.einsatzEntschieden, 781)
  nahe(r.quoteEffektiv, 1.64, 1e-9)

  assert.equal(r.proStatus.gewonnen, 3)
  assert.deepEqual(
    r.hinweise.filter((h) => h.schwere === 'fehler'),
    []
  )
})

test('die Kernzahlen widersprechen sich nie', () => {
  const r = rechne(dieDreiEchten())
  nahe(r.einsatzOffen + r.einsatzEntschieden, r.einsatzGesamt, 1e-6)
  nahe(r.gewinnMoeglich, r.bestenfalls, 1e-6)
  nahe(r.bestenfalls, r.ergebnisRealisiert + r.offenesPotenzial, 1e-6)
  nahe(r.schlimmstenfalls, r.ergebnisRealisiert - r.imRisiko, 1e-6)
  assert.ok(r.schlimmstenfalls <= r.bestenfalls)
})

test('ein offener Schein aendert das realisierte Ergebnis NICHT', () => {
  // Das ist der haeufigste und schaedlichste Fehler in Wett-Trackern:
  // den Rueckfluss der entschiedenen Scheine gegen den Einsatz ALLER Scheine rechnen.
  // Dann sinkt das realisierte Ergebnis um genau das offene Risiko, und es sieht
  // plausibel aus, weil es zufaellig dem schlechtesten Fall entspricht.
  const vorher = rechne(dieDreiEchten())
  const offen = bau('OFFEN', 'offen', 250, 2)
  offen.waehrung = { wert: 'USD', sicherheit: 1, quelle: 'hand' }
  const nachher = rechne([...dieDreiEchten(), offen])

  nahe(nachher.ergebnisRealisiert, vorher.ergebnisRealisiert, 1e-9)
  nahe(nachher.auszahlungRealisiert, vorher.auszahlungRealisiert, 1e-9)

  // Aendern duerfen sich nur Einsatz, Risiko und das Band.
  nahe(nachher.einsatzGesamt, vorher.einsatzGesamt + 250, 1e-9)
  nahe(nachher.imRisiko, 250, 1e-9)
  nahe(nachher.schlimmstenfalls, vorher.ergebnisRealisiert - 250, 1e-6)
  nahe(nachher.bestenfalls, vorher.ergebnisRealisiert + 250, 1e-6)
})

test('gemischte Staende werden getrennt ausgewiesen', () => {
  const [a, b] = dieDreiEchten()
  const offen = leseSchein(
    [
      '#396229999 Sep 12, 6:00 PM pending',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157        Stake: $ 500        Returns: $ 820',
    ],
    umgebung('S6')
  )
  const r = rechne([a, b, offen])

  nahe(r.einsatzGesamt, 981)
  nahe(r.einsatzEntschieden, 481)
  nahe(r.einsatzOffen, 500)
  nahe(r.imRisiko, 500)
  nahe(r.auszahlungRealisiert, 788.84)
  nahe(r.ergebnisRealisiert, 307.84)
  nahe(r.auszahlungMoeglich, 1608.84)
  nahe(r.offenesPotenzial, 320)
  nahe(r.bestenfalls, 627.84)
  nahe(r.schlimmstenfalls, -192.16)
  nahe(r.quoteOffen, 1.64, 1e-9)
  assert.equal(r.proStatus.offen, 1)
  assert.equal(r.proStatus.gewonnen, 2)
})

test('ein verlorener Schein bekommt seine Quote aus dem Quotenfeld, nicht aus dem Rueckfluss', () => {
  // Auf einer Wettuebersicht steht bei einem verlorenen Schein Returns 0.
  // Quote gleich 0 geteilt durch 300 waere Unsinn und wuerde den ganzen
  // Riesenschein verderben.
  const verloren = leseSchein(
    [
      '#396228999 Sep 10, 10:45 PM lost',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157        Stake: $ 300        Returns: $ 0',
    ],
    umgebung('SV')
  )
  assert.equal(verloren.status, 'verloren')
  nahe(verloren.einsatz.wert, 300)
  // Die Quote kommt aus minus 157, nicht aus 0 geteilt durch 300.
  nahe(verloren.quoteDezimal.wert, 1 + 100 / 157, 1e-9)
  // Die moegliche Auszahlung ist berechnet, der Rueckfluss ist 0.
  // Geldbetraege werden auf ganze Cent gebracht, deshalb hier eine halbe Cent Toleranz.
  nahe(verloren.auszahlung.wert, 300 * (1 + 100 / 157), 0.005)
  assert.equal(verloren.auszahlung.wert, 491.08, 'Der Betrag muss auf ganze Cent stehen')
  nahe(verloren.ausgezahlt.wert, 0)

  const r = rechne([verloren])
  nahe(r.einsatzGesamt, 300)
  nahe(r.auszahlungRealisiert, 0)
  nahe(r.ergebnisRealisiert, -300)
  nahe(r.imRisiko, 0)
})

test('ein annullierter Schein bekommt nicht die Quote 1', () => {
  const storniert = leseSchein(
    [
      '#396228888 Sep 10, 10:45 PM void',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157        Stake: $ 300        Returns: $ 300',
    ],
    umgebung('ST')
  )
  assert.equal(storniert.status, 'storniert')
  nahe(storniert.quoteDezimal.wert, 1 + 100 / 157, 1e-9)
  nahe(storniert.ausgezahlt.wert, 300)

  const r = rechne([storniert])
  nahe(r.ergebnisRealisiert, 0, 1e-9)
})

test('verlorene, stornierte und halbe Scheine rechnen richtig zurueck', () => {
  nahe(realisierterRueckfluss(bau('a', 'verloren', 100, 2)).wert, 0)
  nahe(realisierterRueckfluss(bau('b', 'push', 100, 2)).wert, 100)
  nahe(realisierterRueckfluss(bau('c', 'storniert', 100, 2)).wert, 100)
  nahe(realisierterRueckfluss(bau('d', 'gewonnen', 100, 2)).wert, 200)
  nahe(realisierterRueckfluss(bau('e', 'halb_gewonnen', 100, 2)).wert, 150)
  nahe(realisierterRueckfluss(bau('f', 'halb_verloren', 100, 2)).wert, 50)

  const cashout = realisierterRueckfluss(bau('g', 'cashout', 100, 2))
  assert.equal(cashout.bekannt, false)
  assert.equal(cashout.wert, null)
})

test('eine vorzeitige Auszahlung ohne Betrag verfaelscht das Ergebnis nicht', () => {
  const gewonnen = bau('W', 'gewonnen', 100, 2)
  const cashout = bau('C', 'cashout', 100, 2)
  const r = rechne([gewonnen, cashout])

  // Der Cashout-Schein ist aus dem Ergebnis herausgenommen, nicht mit null bewertet.
  nahe(r.ergebnisRealisiert, 100)
  assert.ok(r.hinweise.some((h) => h.code === 'realisiert_unklar'))

  // Mit eingetragenem Betrag rechnet er mit.
  cashout.ausgezahlt = { wert: 150, sicherheit: 1, quelle: 'hand' }
  const r2 = rechne([gewonnen, cashout])
  nahe(r2.ergebnisRealisiert, 150)
})

test('eine Gratiswette kostet nichts und zahlt den Einsatz nicht mit aus', () => {
  const gratis = bau('G', 'gewonnen', 100, 3, { gratiswette: true })
  assert.equal(barEinsatz(gratis), 0)

  const r = rechne([gratis])
  nahe(r.einsatzGesamt, 0)
  nahe(r.gratiswetteNennwert, 100)
  // Bei Quote 3 und Einsatz 100 kommen nur die 200 Gewinn zurueck, nicht 300.
  nahe(r.auszahlungRealisiert, 200)
  nahe(r.ergebnisRealisiert, 200)
  nahe(r.imRisiko, 0)
})

test('eine Each-Way-Wette kostet das Doppelte', () => {
  const ew = bau('EW', 'offen', 10, 5, { eachWay: true })
  assert.equal(barEinsatz(ew), 20)
  const r = rechne([ew])
  nahe(r.einsatzGesamt, 20)
  nahe(r.imRisiko, 20)
})

test('gemischte Waehrungen werden als Fehler gemeldet und nicht verrechnet', () => {
  const [a] = dieDreiEchten()
  const euro = leseSchein(
    [
      'Wett-ID 555',
      '10.09.2026 22:00',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'Ueber 2,5 Receptions',
      'Quote: 1,64',
      'Einsatz: 100,00 EUR',
    ],
    umgebung('S7', { gebiet: 'de', waehrung: 'EUR', quotenformat: 'dezimal', buchmacher: 'Tipico' })
  )
  const r = rechne([a, euro])
  assert.equal(r.waehrungGemischt, true)
  assert.ok(r.hinweise.some((h) => h.code === 'waehrung_gemischt' && h.schwere === 'fehler'))
})

test('Scheine ohne Einsatz fehlen in der Summe und das wird gesagt', () => {
  const [a] = dieDreiEchten()
  const ohne = leseSchein(
    [
      '#999 Sep 10, 10:00 PM',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
    ],
    umgebung('S8')
  )
  const r = rechne([a, ohne])
  nahe(r.einsatzGesamt, 181)
  assert.ok(r.hinweise.some((h) => h.code === 'einsatz_fehlt_in_summe' && h.schwere === 'fehler'))
})

test('die Aufteilung nach Buchmacher stimmt und ergibt hundert Prozent', () => {
  const r = rechne([...dieDreiEchten(), beiEinemAnderenAnbieter()])
  assert.equal(r.anzahlBuchmacher, 2)
  nahe(r.einsatzGesamt, 981)
  nahe(
    r.proBuchmacher.reduce((s, b) => s + b.anteil, 0),
    1,
    1e-9
  )

  const betonline = r.proBuchmacher.find((b) => b.buchmacher === 'BetOnline')
  const bovada = r.proBuchmacher.find((b) => b.buchmacher === 'Bovada')
  assert.ok(betonline && bovada)
  nahe(betonline.einsatz, 781)
  nahe(bovada.einsatz, 200)
  assert.equal(betonline.anzahl, 3)
  assert.equal(bovada.anzahl, 1)
})

test('Projektuebersicht summiert mehrere Riesenscheine', () => {
  const gesamt = rechneProjekt([rechne(dieDreiEchten()), rechne([derVierte()])])
  nahe(gesamt.einsatzGesamt, 783)
  assert.equal(gesamt.anzahlScheine, 4)
  assert.equal(gesamt.anzahlRiesenscheine, 2)
  assert.equal(gesamt.waehrung, 'USD')
})

test('Namensvorschlag beschreibt die Wette', () => {
  assert.ok(schlageNamenVor(dieDreiEchten()).includes('Deebo Samuel'))
})

test('Hilfsfunktionen fuer den Vergleich', () => {
  assert.deepEqual(woerter('San Francisco 49ers'), ['san', 'francisco', '49ers'])
  assert.deepEqual(woerter('FC Bayern Muenchen'), ['bayern', 'muenchen'])
  nahe(ueberlappung(['san', 'francisco', '49ers'], ['sf', '49ers']), 0.5)
  assert.equal(ueberlappung([], []), -1)
  assert.equal(marktart('WILL HAVE OVER 2.5 RECEPTIONS'), 'ueber')
  assert.equal(marktart('SPREAD -3.5'), 'spread')
  assert.equal(marktart('MONEYLINE'), 'moneyline')
})
