import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Der KI-Leser.
 *
 * Karam am 17.09.2026: "Waere das moeglich, dass ich einen Anthropic API-Key
 * besorge, das in das Programm reintue, und dass es dann einfach die Fotos
 * liest?"
 *
 * WAS HIER GEPRUEFT WIRD, ist nicht die KI. Die kann niemand testen, ohne sie
 * zu fragen. Geprueft wird, dass das Programm sich richtig verhaelt: dass der
 * Schluessel nur dort liegt, wo er hingehoert, dass ein Ausfall das Aufnehmen
 * nicht anhaelt, und dass jede Fehlerlage einen Satz bekommt, der sagt, was
 * zu tun ist.
 *
 * Der letzte Schritt, der echte Aufruf, laesst sich nur mit einem echten
 * Schluessel beweisen. Das steht so in der Uebergabe.
 */

/** Ein Browserspeicher, der sich merkt, was hineingelegt wurde. */
const fach = new Map()
globalThis.localStorage = {
  getItem: (k) => (fach.has(k) ? fach.get(k) : null),
  setItem: (k, v) => fach.set(k, String(v)),
  removeItem: (k) => fach.delete(k),
}

/** Ein Blob, den FileReader lesen kann. */
globalThis.FileReader = class {
  readAsDataURL(blob) {
    queueMicrotask(() => {
      this.result = `data:${blob.type || 'image/png'};base64,AAAA`
      this.onload?.()
    })
  }
}

const KI = await import('../daten/kileser.js')

/** @param {object} antwort @param {number} [status] */
function holeMit(antwort, status = 200) {
  const gerufen = []
  const hole = async (adresse, wahl) => {
    gerufen.push({ adresse, wahl })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => antwort,
    }
  }
  return { hole, gerufen }
}

const BILD = { type: 'image/png' }

test('ohne Schluessel wird nicht gefragt, und es wird auch nichts geworfen', async () => {
  KI.setzeSchluessel('')
  const { hole, gerufen } = holeMit({})
  const ergebnis = await KI.leseBild(BILD, { hole })

  assert.equal(ergebnis.gelungen, false)
  assert.equal(gerufen.length, 0, 'es darf keine Anfrage hinausgehen')
  assert.match(ergebnis.meldung, /Schlüssel/)
})

test('der Schluessel geht in den Kopf, nicht in die Adresse', async () => {
  /*
    Eine Adresse landet im Verlauf des Browsers, in Zwischenspeichern und in
    jedem Protokoll dazwischen. Ein Kopf nicht. Das ist der Unterschied
    zwischen einem Schluessel, der nur Karam gehoert, und einem, der irgendwo
    mitgeschrieben wird.
  */
  KI.setzeSchluessel('sk-ant-probe-0000')
  const { hole, gerufen } = holeMit({
    content: [{ type: 'tool_use', input: { scheine: [] } }],
    usage: { input_tokens: 10, output_tokens: 5 },
  })
  await KI.leseBild(BILD, { hole })

  const anfrage = gerufen[0]
  assert.ok(!anfrage.adresse.includes('sk-ant'), 'der Schluessel steht NICHT in der Adresse')
  assert.equal(anfrage.wahl.headers['x-api-key'], 'sk-ant-probe-0000')
  assert.equal(
    anfrage.wahl.headers['anthropic-dangerous-direct-browser-access'],
    'true',
    'ohne diesen Kopf weist die API eine Anfrage aus dem Browser ab'
  )
})

test('die Anweisung steht VOR dem Bild', async () => {
  /*
    Nur so kann der Zwischenspeicher greifen, und dann kostet der feste Text
    ab dem zweiten Foto ein Zehntel. Steht etwas Wechselndes vorn, ist der
    Speicher bei jedem Foto leer, und man merkt es nur an der Abrechnung.
  */
  KI.setzeSchluessel('sk-ant-probe-0000')
  const { hole, gerufen } = holeMit({ content: [{ type: 'tool_use', input: { scheine: [] } }] })
  await KI.leseBild(BILD, { hole, anbieter: 'Betway', merkliste: ['Umsetzen heisst Einsatz'] })

  const teile = JSON.parse(gerufen[0].wahl.body).messages[0].content
  assert.equal(teile[0].type, 'text', 'zuerst die Anweisung')
  assert.equal(teile[teile.length - 1].type, 'image', 'zuletzt das Bild')
  assert.ok(teile.some((t) => t.text?.includes('Umsetzen heisst Einsatz')), 'die Merkliste ist dabei')
})

test('die gelesenen Scheine kommen durch', async () => {
  KI.setzeSchluessel('sk-ant-probe-0000')
  const { hole } = holeMit({
    content: [
      {
        type: 'tool_use',
        input: {
          scheine: [
            { einsatz: 500, quoteDezimal: 1.8, auszahlung: 900, waehrung: 'EUR', status: 'offen', auswahlen: ['X'], unsicher: [] },
          ],
        },
      },
    ],
    usage: { input_tokens: 3822, output_tokens: 700, cache_read_input_tokens: 1800 },
  })
  const ergebnis = await KI.leseBild(BILD, { hole })

  assert.equal(ergebnis.gelungen, true)
  assert.equal(ergebnis.scheine.length, 1)
  assert.equal(ergebnis.scheine[0].einsatz, 500)
  assert.equal(ergebnis.marken.gelesen, 3822)
  assert.equal(ergebnis.marken.ausSpeicher, 1800, 'der Zwischenspeicher wird mitgezaehlt')
})

test('JEDE Fehlerlage bekommt einen Satz, der sagt was zu tun ist', async () => {
  /*
    "HTTP 401" sagt Karam nichts. Jede dieser Lagen hat genau eine Handlung,
    und die muss dabeistehen, sonst steht er da und weiss nicht weiter.
  */
  KI.setzeSchluessel('sk-ant-probe-0000')

  const faelle = [
    [401, {}, /Schlüssel/],
    [400, { error: { message: 'credit balance is too low' } }, /Guthaben/],
    [429, {}, /warten/],
    [500, {}, /Störung/],
  ]

  for (const [status, koerper, erwartet] of faelle) {
    const { hole } = holeMit(koerper, status)
    const ergebnis = await KI.leseBild(BILD, { hole })
    assert.equal(ergebnis.gelungen, false, `${status} darf nicht als Erfolg gelten`)
    assert.match(ergebnis.meldung, erwartet, `${status}: ${ergebnis.meldung}`)
  }
})

test('ein Netzausfall haelt das Aufnehmen nicht an', async () => {
  // Ein Leser, der das Aufnehmen anhalten kann, waere schlimmer als keiner.
  KI.setzeSchluessel('sk-ant-probe-0000')
  const hole = async () => {
    throw new Error('Netz weg')
  }
  const ergebnis = await KI.leseBild(BILD, { hole })
  assert.equal(ergebnis.gelungen, false)
  assert.match(ergebnis.meldung, /Netz weg/)
})

test('eine Antwort ohne Scheine gilt NICHT als Erfolg', async () => {
  KI.setzeSchluessel('sk-ant-probe-0000')
  const { hole } = holeMit({ content: [{ type: 'text', text: 'Ich kann das nicht lesen.' }] })
  const ergebnis = await KI.leseBild(BILD, { hole })
  assert.equal(ergebnis.gelungen, false)
  assert.equal(ergebnis.scheine.length, 0)
})

test('der verkuerzte Schluessel verraet ihn nicht', async () => {
  // Wer neben Karam steht oder ihm beim Teilen des Bildschirms zusieht, soll
  // ihn nicht mitlesen koennen.
  KI.setzeSchluessel('sk-ant-api03-GEHEIMERTEIL-1234')
  const kurz = KI.schluesselkurz()
  assert.ok(!kurz.includes('GEHEIMERTEIL'), kurz)
  assert.ok(kurz.length < 20, kurz)
  assert.ok(kurz.includes('...'))
})

test('ein leerer Schluessel wird geloescht, nicht als Leerzeichen abgelegt', () => {
  KI.setzeSchluessel('sk-ant-etwas')
  assert.equal(KI.bereit(), true)
  KI.setzeSchluessel('   ')
  assert.equal(KI.bereit(), false)
  assert.equal(KI.schluessel(), '')
})

test('nur bekannte Modelle werden angenommen', () => {
  KI.setzeModell('claude-haiku-4-5-20251001')
  assert.equal(KI.modell(), 'claude-haiku-4-5-20251001')
  KI.setzeModell('irgendwas-erfundenes')
  assert.equal(KI.modell(), 'claude-haiku-4-5-20251001', 'das Unbekannte wurde nicht uebernommen')
})

test('die Anfrage traegt Haltepunkt, strengen Bauplan und genug Platz', async () => {
  /*
    Drei Zusagen vom 19.09.2026, jede an einem echten Loch:

    - cache_control an der Anweisung: ohne den Haltepunkt speichert die API
      gar nichts, und der Zwischenspeicher war nur eine Behauptung.
    - strict am Werkzeug: die API prueft die Antwort selbst gegen den
      Bauplan, ein erfundenes Feld kommt gar nicht erst an.
    - max_tokens weit ueber 2000: neun Kombischeine auf einem Foto passen in
      2000 Ausgabetoken nicht, und was abgeschnitten wird, fehlt STILL.
  */
  KI.setzeSchluessel('sk-ant-probe-0000')
  const { hole, gerufen } = holeMit({ content: [{ type: 'tool_use', input: { scheine: [] } }] })
  await KI.leseBild(BILD, { hole })

  const koerper = JSON.parse(gerufen[0].wahl.body)
  assert.deepEqual(
    koerper.messages[0].content[0].cache_control,
    { type: 'ephemeral' },
    'der Haltepunkt sitzt an der festen Anweisung'
  )
  assert.equal(koerper.tools[0].strict, true)
  assert.ok(koerper.max_tokens >= 8000, `max_tokens ist ${koerper.max_tokens}`)
  assert.equal(koerper.tool_choice.name, 'scheine_melden')
})

test('eine abgeschnittene Antwort gilt NICHT als Erfolg', async () => {
  // stop_reason max_tokens heisst: es fehlen Scheine, und was fehlt, faellt
  // in keiner Summe auf. Lieber gar nichts uebernehmen und laut sagen warum.
  KI.setzeSchluessel('sk-ant-probe-0000')
  const { hole } = holeMit({
    stop_reason: 'max_tokens',
    content: [{ type: 'tool_use', input: { scheine: [{ einsatz: 500 }] } }],
  })
  const ergebnis = await KI.leseBild(BILD, { hole })

  assert.equal(ergebnis.gelungen, false)
  assert.equal(ergebnis.scheine.length, 0, 'nichts halb uebernehmen')
  assert.match(ergebnis.meldung, /abgeschnitten/)
})

test('jedes Feld des Bauplans steht unter required, sonst greift strict nicht', async () => {
  KI.setzeSchluessel('sk-ant-probe-0000')
  const { hole, gerufen } = holeMit({ content: [{ type: 'tool_use', input: { scheine: [] } }] })
  await KI.leseBild(BILD, { hole })

  const bauplan = JSON.parse(gerufen[0].wahl.body).tools[0].input_schema
  const schein = bauplan.properties.scheine.items
  assert.equal(schein.additionalProperties, false)
  assert.deepEqual(
    [...schein.required].sort(),
    Object.keys(schein.properties).sort(),
    'strict verlangt: alles was es gibt, steht unter required'
  )
  const auswahl = schein.properties.auswahlen.items
  assert.equal(auswahl.additionalProperties, false)
  assert.deepEqual([...auswahl.required].sort(), Object.keys(auswahl.properties).sort())
})
