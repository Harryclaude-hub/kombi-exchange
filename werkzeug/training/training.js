// @ts-check
/**
 * Trainingsseite: echte Bildschirmfotos einlesen, pruefen, berichtigen,
 * und daraus dauerhafte Pruefaelle machen.
 *
 * WOZU
 *
 * Das Leseprogramm laesst sich nur an echten Bildern verbessern. Nachgebaute
 * Bilder haben immer die Schrift, die Aufloesung und die Kantenglaettung
 * dessen, der sie gebaut hat, und genau daran scheitert eine Texterkennung
 * nicht. Sie scheitert an dem, was der echte Buchmacher wirklich hinschreibt.
 *
 * WIE ES LAEUFT
 *
 *   1. Bilder auswaehlen. Zwanzig, hundert, egal.
 *   2. Die Seite laesst den GANZEN echten Weg darueber laufen: Zerlegung in
 *      Karten, Anbietererkennung, Texterkennung, Auswertung. Nicht nachgebaut,
 *      sondern dieselben Bausteine, die die Anwendung benutzt.
 *   3. Es zeigt, was herauskam, und was es sich dabei gedacht hat.
 *   4. Was falsch ist, wird berichtigt.
 *   5. "Als Pruefaelle sichern" legt eine Datei ab, die in test/ gehoert.
 *
 * WAS DABEI GESICHERT WIRD
 *
 * NICHT das Bild, sondern die Textzeilen, die die Texterkennung daraus gemacht
 * hat, zusammen mit der berichtigten Wahrheit. Das hat zwei Vorteile: die
 * Pruefaelle laufen danach in Sekunden in node statt in Minuten im Browser,
 * und es verlaesst kein Bild das Geraet.
 *
 * WAS DAS TRAINING NICHT IST
 *
 * Hier wird kein neuronales Netz nachtrainiert. "Trainieren" heisst hier:
 * jeder Fehler, den ein echtes Bild zeigt, wird zu einem Pruefall, der ab dann
 * fuer immer geprueft wird. Das Programm wird dadurch messbar besser und kann
 * nicht wieder schlechter werden, ohne dass es auffaellt.
 */

import * as Zustand from '../../oberflaeche/zustand.js'
import { nimmAuf, leseBilder, beendeLeser } from '../../oberflaeche/aufnahme.js'
import { el, fuelle, neueKennung, jetzt } from '../../oberflaeche/werkzeug.js'

const ziel = /** @type {HTMLElement} */ (document.getElementById('inhalt'))
const stapel = /** @type {HTMLInputElement} */ (document.getElementById('dateien'))
const knopfLesen = /** @type {HTMLButtonElement} */ (document.getElementById('lesen'))
const knopfSichern = /** @type {HTMLButtonElement} */ (document.getElementById('sichern'))
const lage = /** @type {HTMLElement} */ (document.getElementById('lage'))

/**
 * Die Felder, die geprueft werden. Reihenfolge ist die Anzeigereihenfolge.
 * @type {{feld: string, name: string, art: 'zahl'|'text'}[]}
 */
const FELDER = [
  { feld: 'buchmacher', name: 'Anbieter', art: 'text' },
  { feld: 'konto', name: 'Konto', art: 'text' },
  { feld: 'scheinNr', name: 'Schein-Nr', art: 'text' },
  { feld: 'einsatz', name: 'Einsatz', art: 'zahl' },
  { feld: 'quoteDezimal', name: 'Quote', art: 'zahl' },
  { feld: 'auszahlung', name: 'Auszahlung', art: 'zahl' },
  { feld: 'waehrung', name: 'Waehrung', art: 'text' },
]

/** Die Berichtigungen, die von Hand eingetragen wurden. scheinId -> feld -> Wert */
const berichtigt = new Map()

Zustand.hoerZu(() => zeichne())

// Ein Projekt nur im Speicher. Die Trainingsseite fasst die Datenbank nicht an:
// hier wird geprueft, nicht gearbeitet, und Pruefdaten haben in den echten
// Projekten nichts verloren.
Zustand.aendere({
  angemeldet: true,
  token: '',
  projekt: {
    id: neueKennung(),
    name: 'Training',
    notiz: '',
    waehrung: 'UNBEKANNT',
    angelegtAm: jetzt(),
    geaendertAm: jetzt(),
  },
  projekte: [],
})

stapel.addEventListener('change', async () => {
  const dateien = stapel.files
  if (!dateien || dateien.length === 0) return
  melde(`${dateien.length} Bild(er) werden aufgenommen ...`)
  const ergebnis = await nimmAuf(dateien)
  melde(
    `${ergebnis.aufgenommen} aufgenommen` +
      (ergebnis.uebersprungen > 0 ? `, ${ergebnis.uebersprungen} uebersprungen (schon da)` : '')
  )
  knopfLesen.disabled = Zustand.hole().bilder.size === 0
})

knopfLesen.addEventListener('click', async () => {
  const ids = [...Zustand.hole().bilder.keys()]
  if (ids.length === 0) return
  knopfLesen.disabled = true
  melde('Wird gelesen. Bei vielen Bildern dauert das ein paar Minuten.')
  const begonnen = performance.now()
  const ergebnis = await leseBilder(ids, { gruendlich: true })
  const dauer = (performance.now() - begonnen) / 1000
  melde(
    `${ergebnis.gelesen} Schein(e) gelesen, ${ergebnis.fehler} Fehler, ` +
      `${dauer.toFixed(1)} Sekunden (${(dauer / Math.max(1, ids.length)).toFixed(1)} je Bild).`
  )
  knopfLesen.disabled = false
  knopfSichern.disabled = Zustand.hole().scheine.length === 0
})

knopfSichern.addEventListener('click', () => sichere())

/** @param {string} text */
function melde(text) {
  lage.textContent = text
}

/**
 * Holt den gelesenen Wert eines Feldes.
 * @param {any} schein
 * @param {string} feld
 */
function gelesen(schein, feld) {
  const roh = schein[feld]
  if (roh && typeof roh === 'object' && 'wert' in roh) return roh.wert
  return roh
}

/**
 * Holt die Sicherheit, mit der ein Feld gelesen wurde.
 * @param {any} schein
 * @param {string} feld
 */
function sicherheit(schein, feld) {
  const roh = schein[feld]
  if (roh && typeof roh === 'object' && 'sicherheit' in roh) return Number(roh.sicherheit) || 0
  return 1
}

function zeichne() {
  const stand = Zustand.hole()

  if (stand.arbeit.laeuft) {
    fuelle(ziel, [
      el('p.hinweis', { text: `${stand.arbeit.text} (${Math.round(stand.arbeit.anteil * 100)} %)` }),
    ])
    return
  }

  if (stand.scheine.length === 0) {
    fuelle(ziel, [
      el('p.hinweis', {
        text:
          'Noch nichts gelesen. Bilder auswaehlen, dann auf "Alles lesen". ' +
          'Es wird nichts in die Datenbank geschrieben und kein Bild verlaesst das Geraet.',
      }),
    ])
    return
  }

  fuelle(ziel, [uebersicht(stand.scheine), ...stand.scheine.map((s, i) => scheinkarte(s, i))])
}

/**
 * Wie viel wurde mit welcher Sicherheit gelesen.
 * @param {any[]} scheine
 */
function uebersicht(scheine) {
  const zeilen = FELDER.map(({ feld, name }) => {
    const gefunden = scheine.filter((s) => {
      const w = gelesen(s, feld)
      return w !== null && w !== undefined && w !== ''
    }).length
    const unsicher = scheine.filter((s) => sicherheit(s, feld) < 0.7).length
    return el('tr', {}, [
      el('td', { text: name }),
      el('td.zahl', { text: `${gefunden} / ${scheine.length}` }),
      el('td.zahl', { text: unsicher > 0 ? `${unsicher} unsicher` : '' }),
    ])
  })

  const mitWarnung = scheine.filter((s) =>
    (s.hinweise ?? []).some((/** @type {any} */ h) => h.schwere !== 'hinweis')
  ).length

  return el('section.uebersicht', {}, [
    el('h2', { text: `${scheine.length} Schein(e) gelesen` }),
    el('table', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Feld' }),
          el('th', { text: 'gefunden' }),
          el('th', { text: '' }),
        ]),
      ]),
      el('tbody', {}, zeilen),
    ]),
    mitWarnung > 0
      ? el('p.warnung', {
          text: `${mitWarnung} Schein(e) haben eine Warnung. Die sind es, die zuerst angesehen gehoeren.`,
        })
      : el('p.gut', { text: 'Kein Schein hat eine Warnung.' }),
  ])
}

/**
 * @param {any} schein
 * @param {number} nummer
 */
function scheinkarte(schein, nummer) {
  const warnungen = (schein.hinweise ?? []).filter((/** @type {any} */ h) => h.schwere !== 'hinweis')

  return el('section.schein', { daten: { warnung: String(warnungen.length > 0) } }, [
    el('h3', { text: `Schein ${nummer + 1}` }),

    el('table.felder', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Feld' }),
          el('th', { text: 'gelesen' }),
          el('th', { text: 'sicher' }),
          el('th', { text: 'richtig waere' }),
        ]),
      ]),
      el(
        'tbody',
        {},
        FELDER.map(({ feld, name, art }) => {
          const wert = gelesen(schein, feld)
          const s = sicherheit(schein, feld)
          const eingabe = el('input.berichtigung', {
            type: art === 'zahl' ? 'number' : 'text',
            step: 'any',
            placeholder: 'nur wenn falsch',
            value: berichtigt.get(schein.id)?.[feld] ?? '',
          })
          eingabe.addEventListener('change', () => {
            const bisher = berichtigt.get(schein.id) ?? {}
            const eingetragen = /** @type {HTMLInputElement} */ (eingabe).value.trim()
            if (eingetragen === '') delete bisher[feld]
            else bisher[feld] = art === 'zahl' ? Number(eingetragen) : eingetragen
            berichtigt.set(schein.id, bisher)
          })

          return el('tr', { daten: { unsicher: String(s < 0.7) } }, [
            el('td', { text: name }),
            el('td.wert', {
              text: wert === null || wert === undefined || wert === '' ? '(nichts)' : String(wert),
            }),
            el('td.zahl', { text: `${Math.round(s * 100)} %` }),
            el('td', {}, [eingabe]),
          ])
        })
      ),
    ]),

    warnungen.length > 0
      ? el(
          'ul.warnungen',
          {},
          warnungen.map((/** @type {any} */ h) =>
            el('li', { text: `[${h.schwere}] ${h.code}: ${h.text}` })
          )
        )
      : null,

    el('details.rohtext', {}, [
      el('summary', { text: 'Was die Texterkennung gesehen hat' }),
      el('pre', { text: schein.rohtext || '(leer)' }),
    ]),
  ])
}

/**
 * Schreibt die Pruefaelle als Datei heraus.
 *
 * Erzeugt wird genau die Form, die test/scheinkorpus.mjs schon benutzt. Die
 * Datei kann als test/korpus_echt.mjs abgelegt werden, und die vorhandenen
 * Tests pruefen sie ab dann mit.
 */
function sichere() {
  const stand = Zustand.hole()

  const faelle = stand.scheine.map((schein, i) => {
    const korrektur = berichtigt.get(schein.id) ?? {}
    /** @type {Record<string, unknown>} */
    const erwartet = {}

    for (const { feld } of FELDER) {
      // Von Hand berichtigt schlaegt immer das Gelesene.
      const wert = feld in korrektur ? korrektur[feld] : gelesen(schein, feld)
      if (wert === null || wert === undefined || wert === '') continue
      // Anbieter und Konto kommen aus dem Bildkopf, nicht aus dem Kartentext.
      // Sie gehoeren deshalb nicht in einen Pruefall fuer leseSchein.
      if (feld === 'buchmacher' || feld === 'konto') continue
      erwartet[feld] = wert
    }
    if (schein.status && schein.status !== 'unbekannt') erwartet.status = schein.status

    return {
      name: `echt ${i + 1}: ${gelesen(schein, 'buchmacher') ?? 'Anbieter unbekannt'}`,
      buchmacher: String(gelesen(schein, 'buchmacher') ?? ''),
      zeilen: String(schein.rohtext ?? '').split('\n').filter((z) => z.trim() !== ''),
      umgebung: {
        gebiet: schein.gebiet ?? 'en',
        quotenformat: gelesen(schein, 'quoteAmerikanisch') !== null ? 'amerikanisch' : 'dezimal',
      },
      erwartet,
      vonHandBerichtigt: Object.keys(korrektur),
    }
  })

  const kopf = [
    '/**',
    ' * Pruefaelle aus ECHTEN Bildschirmfotos.',
    ' *',
    ' * Erzeugt von werkzeug/training/ am ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '.',
    ' *',
    ' * Die Zeilen sind das, was die Texterkennung wirklich aus dem Bild gemacht',
    ' * hat. "erwartet" ist die geprueefte Wahrheit. Faelle mit Eintraegen unter',
    ' * "vonHandBerichtigt" waren beim Erzeugen FALSCH gelesen: das sind die',
    ' * wertvollen. Sie zeigen, woran das Leseprogramm noch scheitert.',
    ' */',
    '',
    'export const KORPUS_ECHT = ',
  ].join('\n')

  const inhalt = kopf + JSON.stringify(faelle, null, 2) + '\n'
  const blob = new Blob([inhalt], { type: 'text/javascript;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'korpus_echt.mjs'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)

  const mitKorrektur = faelle.filter((f) => f.vonHandBerichtigt.length > 0).length
  melde(
    `${faelle.length} Pruefaelle gesichert, davon ${mitKorrektur} mit Berichtigung. ` +
      'Die Datei gehoert nach test/korpus_echt.mjs.'
  )
}

window.addEventListener('beforeunload', () => {
  beendeLeser().catch(() => {})
})

zeichne()
