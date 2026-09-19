import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * B5 der Fehlersuche vom 17.09.2026: was am Foto von Hand eingestellt wird,
 * muss ein Neuladen ueberleben.
 *
 * Abgelegt wurden bis dahin nur Datei, Masse und Pruefsumme. Der von Hand
 * gesetzte Anbieter, der gezogene Rahmen und die Kartengrenzen lebten allein
 * im Arbeitsstand: nach einem Neuladen stand bei jedem Bild "0 Scheine
 * erkannt", und die ganze Handarbeit an den Grenzen war weg. Aus dem Foto
 * liess sich ohne sie nichts mehr lesen.
 *
 * Die Browserdatenbank gibt es unter node nicht; hier steht ein Nachbau, der
 * genau die Handgriffe kann, die daten/ablage.js benutzt, einschliesslich der
 * Regel, dass beim Schreiben erst der ABSCHLUSS des Vorgangs zaehlt.
 */

class FakeAnfrage {
  constructor() {
    this.onsuccess = null
    this.onerror = null
    this.result = undefined
    this.error = null
  }
}

class FakeVorgang {
  /** @param {Map<string, any>} lagerInhalt @param {string} schluesselFeld */
  constructor(lagerInhalt, schluesselFeld) {
    this.lagerInhalt = lagerInhalt
    this.schluesselFeld = schluesselFeld
    this.oncomplete = null
    this.onerror = null
    this.onabort = null
    this.error = null
    this.offen = 0
    this.abgeschlossen = false
  }

  objectStore() {
    const vorgang = this
    const inhalt = this.lagerInhalt
    const feld = this.schluesselFeld
    return {
      put(eintrag) {
        return vorgang.plane((anfrage) => {
          inhalt.set(eintrag[feld], eintrag)
          anfrage.result = eintrag[feld]
        })
      },
      get(schluessel) {
        return vorgang.plane((anfrage) => {
          anfrage.result = inhalt.get(schluessel)
        })
      },
      delete(schluessel) {
        return vorgang.plane(() => void inhalt.delete(schluessel))
      },
      index(name) {
        return {
          getAll(wert) {
            return vorgang.plane((anfrage) => {
              anfrage.result = [...inhalt.values()].filter((e) => e[name === 'projekt' ? 'projektId' : name] === wert)
            })
          },
        }
      },
    }
  }

  /** @param {(anfrage: FakeAnfrage) => void} arbeit */
  plane(arbeit) {
    const anfrage = new FakeAnfrage()
    this.offen += 1
    queueMicrotask(() => {
      arbeit(anfrage)
      if (anfrage.onsuccess) anfrage.onsuccess()
      this.offen -= 1
      queueMicrotask(() => {
        if (this.offen === 0 && !this.abgeschlossen) {
          this.abgeschlossen = true
          if (this.oncomplete) this.oncomplete()
        }
      })
    })
    return anfrage
  }
}

function baueFakeDatenbank() {
  /** @type {Map<string, {inhalt: Map<string, any>, schluesselFeld: string}>} */
  const lager = new Map()
  const db = {
    objectStoreNames: {
      contains: (name) => lager.has(name),
    },
    createObjectStore(name, einstellungen) {
      lager.set(name, { inhalt: new Map(), schluesselFeld: einstellungen.keyPath })
      return { createIndex: () => {} }
    },
    transaction(name) {
      const eintrag = lager.get(name)
      if (!eintrag) throw new Error(`Kein Lager ${name}`)
      return new FakeVorgang(eintrag.inhalt, eintrag.schluesselFeld)
    },
  }
  return {
    open() {
      const anfrage = new FakeAnfrage()
      queueMicrotask(() => {
        anfrage.result = db
        if (anfrage.onupgradeneeded) anfrage.onupgradeneeded()
        if (anfrage.onsuccess) anfrage.onsuccess()
      })
      anfrage.onupgradeneeded = null
      anfrage.onblocked = null
      return anfrage
    },
  }
}

globalThis.indexedDB = baueFakeDatenbank()

const Ablage = await import('../daten/ablage.js')

const feld = (wert, quelle = 'ocr') => ({ wert, sicherheit: 1, quelle, roh: '' })

test('Kartengrenzen, Rahmen und Anbieter liegen mit dem Bild in der Ablage', async () => {
  await Ablage.legeBildAb({
    id: 'b1',
    projektId: 'p1',
    dateiname: 'Screenshot.png',
    pruefsumme: 'abc',
    breite: 1170,
    hoehe: 2532,
    inhalt: /** @type {any} */ ({ groesse: 'bleibt' }),
    karten: [{ x: 0, y: 0, breite: 100, hoehe: 50 }],
    hinweise: ['eine Spalte'],
    bereich: null,
    buchmacher: feld(null, 'vorgabe'),
    konto: feld(null, 'vorgabe'),
  })

  // Der Nutzer zieht den Rahmen neu und setzt den Anbieter von Hand.
  const nachgetragen = await Ablage.aktualisiereBildAngaben('b1', {
    karten: [
      { x: 10, y: 10, breite: 80, hoehe: 40 },
      { x: 10, y: 60, breite: 80, hoehe: 40 },
    ],
    bereich: { x: 5, y: 5, breite: 90, hoehe: 100 },
    buchmacher: feld('BetOnline', 'hand'),
  })
  assert.equal(nachgetragen, true)

  const [bild] = await Ablage.holeBilderZuProjekt('p1')
  assert.ok(bild)
  assert.equal(bild.karten.length, 2, 'die verschobenen Grenzen sind da')
  assert.equal(bild.bereich.breite, 90, 'der gezogene Rahmen ist da')
  assert.equal(bild.buchmacher.wert, 'BetOnline')
  assert.equal(bild.buchmacher.quelle, 'hand', 'die Handentscheidung bleibt eine Handentscheidung')
  assert.deepEqual(bild.inhalt, { groesse: 'bleibt' }, 'die Datei selbst wird beim Nachtragen nicht angefasst')
  assert.equal(bild.dateiname, 'Screenshot.png')
})

test('Nachtragen an einem Bild, das der Browser nie bekommen hat, meldet es ehrlich', async () => {
  // Der Speicher war beim Hochladen voll, das Bild liegt nur im Plattenordner.
  // Dann gibt es nichts nachzutragen, und das darf nicht wie Erfolg aussehen.
  const nachgetragen = await Ablage.aktualisiereBildAngaben('gibt-es-nicht', {
    karten: [{ x: 0, y: 0, breite: 1, hoehe: 1 }],
  })
  assert.equal(nachgetragen, false)
})
