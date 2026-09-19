import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Was die KI NICHT lesen konnte, muss eine Luecke bleiben.
 *
 * Bis zum 18.09.2026 war es eine Null, und das ist der teuerste Fehler, den
 * dieses Programm hatte. zahl() in oberflaeche/kilesen.js rechnete
 * Number(null), das ist 0, und Number.isFinite(0) ist true. Aus jedem
 * ausdruecklichen null der KI wurde also ein abgelesener Wert 0.
 *
 * Und null schickt die KI auf Befehl: der Bauplan in daten/kileser.js fuehrt
 * einsatz, quoteDezimal und auszahlung unter required mit dem Typ
 * ['number','null'], und die ANWEISUNG sagt woertlich "Steht ein Wert nicht im
 * Bild, ist er null". Bei PS3838 steht auf dem Schein gar keine Auszahlung,
 * sondern nur der Gewinn. Dort MUSS null stehen.
 *
 * Die Folge, mit Karams neun echten PS3838-Scheinen nachgerechnet:
 *
 *     richtig    Einsatz 17.717,48   moeglich 20.222,73   bestenfalls  +2.505,25
 *     gerechnet  Einsatz 17.717,48   moeglich      0,00   bestenfalls -17.717,48
 *
 * Diese Probe haelt beides fest: dass die Umwandlung eine Luecke liefert, UND
 * dass die Rechnung danach warnt statt still falsch zu rechnen.
 */

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}
// crypto bringt node seit Fassung 19 selbst mit, und zwar nur als Lesezugriff:
// eine Zuweisung darauf wirft "Cannot set property crypto of #<Object> which
// has only a getter".

const { zuSchein } = await import('../oberflaeche/kilesen.js')
const { rechne } = await import('../kern/rechnung.js')

const WO = { bildId: 'bild-1', projektId: 'projekt-1' }

/** Ein Schein, wie ihn die KI fuer PS3838 liefern MUSS: ohne Auszahlung. */
function ps3838(ueberschreibe = {}) {
  return {
    buchmacher: 'PS3838',
    scheinNr: '4711',
    gesetztAm: 'Sep 13, 6:39 PM',
    einsatz: 500,
    waehrung: 'EUR',
    quoteDezimal: 1.854,
    auszahlung: null,
    ausgezahlt: null,
    status: 'offen',
    auswahlen: [
      {
        ereignis: 'Denver Broncos - Kansas City Chiefs',
        tipp: 'RJ Harvey',
        markt: 'Rushing Yards',
        richtung: 'under',
        linie: 18.5,
        quote: 1.854,
      },
    ],
    ...ueberschreibe,
  }
}

test('ein null der KI wird zur Luecke, nicht zur Null', () => {
  const schein = zuSchein(ps3838(), WO)

  assert.equal(schein.auszahlung.wert, null, 'die Auszahlung ist eine Luecke')
  assert.equal(schein.auszahlung.quelle, 'vorgabe', 'und sie gilt nicht als abgelesen')
  assert.equal(schein.auszahlung.sicherheit, 0, 'Sicherheit null, nicht 0,9')

  assert.equal(schein.ausgezahlt.wert, null)
  assert.equal(schein.einsatz.wert, 500, 'was dastand, steht weiter da')
  assert.equal(schein.quoteDezimal.wert, 1.854)
})

test('DIE WICHTIGSTE: PS3838 rechnet wieder mit 20.222,73 statt mit 0', () => {
  /*
    Ohne abgelesene Auszahlung muss die Rechnung auf Einsatz mal Quote
    ausweichen. Das tut sie nur, wenn der Wert null ist: kern/rechnung.js
    prueft auf !== null, und die alte 0 ging daran vorbei.
  */
  const einer = zuSchein(ps3838(), WO)
  const ergebnis = rechne([einer])

  assert.ok(
    Math.abs(ergebnis.auszahlungMoeglich - 927.0) < 0.01,
    `moeglich waren ${ergebnis.auszahlungMoeglich}, erwartet 927,00`
  )
  assert.ok(ergebnis.gewinnMoeglich > 0, 'ein Schein mit Quote 1,854 kann gewinnen')
})

test('neun Scheine, so wie sie wirklich dalagen', () => {
  // Die Zahlen stammen aus Karams Fotos, festgehalten in UEBERGABE.md.
  const einsaetze = [500, 1000, 2000, 2217.48, 3000, 1500, 2500, 3000, 2000]
  const scheine = einsaetze.map((e, i) =>
    zuSchein(ps3838({ einsatz: e, scheinNr: `nr-${i}` }), WO)
  )

  const ergebnis = rechne(scheine)

  assert.ok(Math.abs(ergebnis.einsatzGesamt - 17717.48) < 0.01, 'der Einsatz stimmt')
  assert.ok(
    ergebnis.auszahlungMoeglich > 20000,
    `moeglich waren ${ergebnis.auszahlungMoeglich}, vor der Behebung stand hier 0`
  )
  assert.ok(
    ergebnis.gewinnMoeglich > 0,
    `bestenfalls ${ergebnis.gewinnMoeglich}, vor der Behebung stand hier -17.717,48`
  )
})

test('ein gewonnener Schein ohne lesbare Auszahlung wird nicht als Totalverlust gebucht', () => {
  /*
    Der stillste der drei Faelle. Status gewonnen, ausgezahlt nicht lesbar.
    Vorher: ausgezahlt 0, Ergebnis minus dem vollen Einsatz, und rechne()
    meldete dazu "Alle haben die Gegenrechnung bestanden".
  */
  const schein = zuSchein(ps3838({ status: 'gewonnen', ausgezahlt: null }), WO)
  assert.equal(schein.ausgezahlt.wert, null)

  const ergebnis = rechne([schein])
  assert.ok(
    ergebnis.ergebnisRealisiert > -500,
    `Ergebnis ${ergebnis.ergebnisRealisiert}, vor der Behebung war es genau minus dem Einsatz`
  )
})

test('ein fehlender Einsatz loest die Sicherung aus, statt an ihr vorbeizugehen', () => {
  const schein = zuSchein(ps3838({ einsatz: null }), WO)
  assert.equal(schein.einsatz.wert, null, 'kein erfundener Einsatz von 0')

  const ergebnis = rechne([schein])
  assert.ok(
    ergebnis.hinweise.length > 0,
    'die Rechnung muss etwas sagen, statt still mit 0 Einsatz weiterzurechnen'
  )
})

test('ohne Linie bleibt die Linie leer, sonst faellt das Zusammenfassen auseinander', () => {
  /*
    Das trifft Karams eigentliches Ziel. Der Bauplan sagt "Ohne Linie null".
    Wurde daraus 0, trug bildeKennung() linie 0 statt null, und dieselbe Wette
    bekam einmal von der KI und einmal oertlich gelesen nur noch 0,8 statt 1,0
    Punkte. Sie waere nicht mehr sicher zusammengefasst worden.
  */
  const roh = ps3838()
  roh.auswahlen[0].linie = null
  const schein = zuSchein(roh, WO)

  assert.equal(schein.auswahlen[0].linie.wert, null)
  assert.equal(schein.auswahlen[0].linie.quelle, 'vorgabe')
})

test('leerer Text, leeres Feld und Unsinn ergeben alle eine Luecke', () => {
  const roh = ps3838({ einsatz: '', quoteDezimal: '   ', auszahlung: 'keine Angabe' })
  const schein = zuSchein(roh, WO)

  assert.equal(schein.einsatz.wert, null)
  assert.equal(schein.quoteDezimal.wert, null)
  assert.equal(schein.auszahlung.wert, null)
})

test('eine Zahl als Text kommt durch, eine mit Komma nicht', () => {
  /*
    "500" ist kein erfundener Wert, sondern derselbe Wert in anderer Schreibung.
    "1,854" dagegen waere nach Number() NaN, und eine stillschweigend als 1854
    gelesene Quote waere um den Faktor tausend daneben. Lieber nachfragen.
  */
  const gut = zuSchein(ps3838({ einsatz: '500', quoteDezimal: '1.854' }), WO)
  assert.equal(gut.einsatz.wert, 500)
  assert.equal(gut.quoteDezimal.wert, 1.854)

  const komma = zuSchein(ps3838({ quoteDezimal: '1,854' }), WO)
  assert.equal(komma.quoteDezimal.wert, null, 'lieber eine Luecke als Faktor tausend')
})

test('true, false und eine leere Liste sind keine Zahlen', () => {
  // Number(false) ist 0, Number([]) ist 0, Number(true) ist 1. Alle drei haetten
  // frueher als abgelesener Betrag gegolten.
  for (const unsinn of [true, false, [], {}]) {
    const schein = zuSchein(ps3838({ einsatz: unsinn }), WO)
    assert.equal(schein.einsatz.wert, null, `${JSON.stringify(unsinn)} ist kein Einsatz`)
  }
})

test('push kommt als push an, nicht als unbekannt', () => {
  /*
    push fehlte bis zum 19.09.2026 in der Liste der erlaubten Staende. Ein
    Unentschieden mit Einsatz zurueck waere als "unbekannt" gelandet und
    haette in der Rechnung wie ein offener Schein gezaehlt: der zurueck-
    gezahlte Einsatz haette gefehlt, und das Risiko waere zu hoch gewesen.
  */
  const schein = zuSchein(ps3838({ status: 'push', ausgezahlt: 500 }), WO)
  assert.equal(schein.status, 'push')

  const rechnung = rechne([schein])
  assert.equal(rechnung.auszahlungRealisiert, 500, 'der Einsatz kam zurueck')
  assert.equal(rechnung.ergebnisRealisiert, 0)
})
