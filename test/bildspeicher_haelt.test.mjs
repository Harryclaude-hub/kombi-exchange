import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Die Obergrenze fuer entpackte Bilder, nachgemessen.
 *
 * Karam rechnet mit 10.000 bis 100.000 Fotos in einer Saison. Bis zum
 * 17.09.2026 hat das Programm beim Start JEDES Bild eines Projekts entpackt.
 * Ein Bildschirmfoto vom Telefon ist entpackt rund 11 MB gross, gleich ob die
 * Datei 300 KB hat. Bei dreihundert Fotos sind das 3,3 GB und ein toter
 * Reiter, ohne Meldung.
 *
 * Projektregel 3: die Grenze zaehlt erst, wenn sie ausgeloest hat. Hier loest
 * sie aus.
 */

/* Der Browser, so weit er hier gebraucht wird. ---------------------------- */

let naechsteAdresse = 0
const hergegeben = []

globalThis.URL = /** @type {any} */ ({
  createObjectURL: () => `blob:probe/${(naechsteAdresse += 1)}`,
  revokeObjectURL: (/** @type {string} */ adresse) => hergegeben.push(adresse),
})

globalThis.Image = /** @type {any} */ (
  class {
    constructor() {
      this.naturalWidth = 1170
      this.naturalHeight = 2532
      /** @type {string} */
      this._src = ''
      /** @type {null|(() => void)} */
      this.onload = null
      /** @type {null|(() => void)} */
      this.onerror = null
    }
    set src(wert) {
      this._src = wert
      // Der Browser laedt nicht sofort; das tut er hier auch nicht.
      queueMicrotask(() => this.onload?.())
    }
    get src() {
      return this._src
    }
  }
)

const Bildspeicher = await import('../oberflaeche/bildspeicher.js')

/** @param {number} n */
function eintraege(n) {
  return Array.from({ length: n }, (_, i) => ({
    bild: { id: `bild-${i}` },
    element: null,
    // Ein Blob braucht hier keinen Inhalt: das nachgebaute Image sieht ihn nie.
    inhalt: /** @type {any} */ ({ size: 300_000 }),
  }))
}

test('es bleiben nie mehr als die Obergrenze entpackt', async () => {
  Bildspeicher.leere()
  const grenze = Bildspeicher.stand().hoechstens
  assert.ok(grenze > 0 && grenze < 100, `unsinnige Grenze: ${grenze}`)

  // Doppelt so viele wie erlaubt, eines nach dem anderen.
  for (const eintrag of eintraege(grenze * 2)) {
    const element = await Bildspeicher.hole(eintrag)
    assert.ok(element, 'nichts entpackt')
  }

  assert.equal(Bildspeicher.stand().entpackt, grenze)
})

test('das aelteste geht, das juengste bleibt', async () => {
  Bildspeicher.leere()
  const grenze = Bildspeicher.stand().hoechstens
  const liste = eintraege(grenze + 1)
  for (const eintrag of liste) await Bildspeicher.hole(eintrag)

  assert.equal(Bildspeicher.schonDa('bild-0'), null, 'das aelteste haengt noch fest')
  assert.ok(Bildspeicher.schonDa(`bild-${grenze}`), 'das juengste ist weg')
})

test('wer benutzt wird, rutscht ans Ende und faellt nicht heraus', async () => {
  /*
    Ohne das waere die Grenze schaedlich: das eine Bild, das Karam gerade
    ansieht, waere genau das aelteste und flieget bei jedem neuen heraus. Dann
    wuerde es bei jedem Neuzeichnen neu entpackt.
  */
  Bildspeicher.leere()
  const grenze = Bildspeicher.stand().hoechstens
  const liste = eintraege(grenze)
  for (const eintrag of liste) await Bildspeicher.hole(eintrag)

  // Das aelteste noch einmal anfassen, dann eines dazu.
  assert.ok(Bildspeicher.schonDa('bild-0'))
  await Bildspeicher.hole({ bild: { id: 'neu' }, element: null, inhalt: /** @type {any} */ ({ size: 1 }) })

  assert.ok(Bildspeicher.schonDa('bild-0'), 'das benutzte ist herausgefallen')
  assert.equal(Bildspeicher.schonDa('bild-1'), null, 'statt dessen haette bild-1 gehen muessen')
})

test('dasselbe Bild zehnmal gleichzeitig wird EINMAL entpackt', async () => {
  /*
    Auf einer Seite stehen zehn Ausschnitte aus demselben Bildschirmfoto,
    einer je Schein. Ohne diese Sperre entpackte das Programm dasselbe Foto
    zehnmal nebeneinander, also 110 MB fuer ein einziges Bild.
  */
  Bildspeicher.leere()
  const eintrag = {
    bild: { id: 'eins' },
    element: null,
    inhalt: /** @type {any} */ ({ size: 300_000 }),
  }
  const alle = await Promise.all(Array.from({ length: 10 }, () => Bildspeicher.hole(eintrag)))
  const verschieden = new Set(alle)
  assert.equal(verschieden.size, 1, 'es wurde mehr als einmal entpackt')
  assert.equal(Bildspeicher.stand().entpackt, 1)
})

test('ohne Datei wird nichts behauptet', async () => {
  Bildspeicher.leere()
  assert.equal(await Bildspeicher.hole({ bild: { id: 'leer' }, element: null, inhalt: null }), null)
  assert.equal(await Bildspeicher.hole(null), null)
  assert.equal(Bildspeicher.stand().entpackt, 0)
})

test('leere() gibt alles her', async () => {
  Bildspeicher.leere()
  for (const eintrag of eintraege(5)) await Bildspeicher.hole(eintrag)
  assert.equal(Bildspeicher.stand().entpackt, 5)
  Bildspeicher.leere()
  assert.equal(Bildspeicher.stand().entpackt, 0)
  assert.equal(Bildspeicher.schonDa('bild-0'), null)
})
