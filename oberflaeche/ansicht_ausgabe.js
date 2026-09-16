// @ts-check
/**
 * Ansicht "Ausgabe".
 *
 * Hier entsteht, was Karam weiterschickt: der Riesenschein als ein einziges Blatt
 * und dieselbe Sache noch einmal als Excel-Mappe zum Nachrechnen.
 *
 * Das Blatt wird zuerst angezeigt und erst dann heruntergeladen. Wer ein Blatt
 * ungesehen verschickt, merkt einen Fehlschnitt erst beim Empfaenger.
 */

import { el, fuelle, atmen } from './werkzeug.js'
import { formatiere } from '../kern/geld.js'
import { baueMosaik, alsDatei, statusText } from '../bild/mosaik.js'
import { baueMappe } from '../ausgabe/excel.js'
import { baueCsv, biete, sichererName, zeitstempel } from '../ausgabe/datei.js'
import { barEinsatz, realisierterRueckfluss } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'

/** Der zuletzt gebaute Riesenschein, damit er nicht bei jedem Neuzeichnen neu entsteht. */
let vorschau = { id: '', leinwand: /** @type {HTMLCanvasElement|null} */ (null), hinweise: /** @type {string[]} */ ([]) }

/**
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  const stand = Zustand.hole()

  if (stand.riesenscheine.length === 0) {
    fuelle(ziel, [
      erklaerzeile(),
      el('.leerhinweis', {}, [
        el('p.leer-titel', { text: 'Noch nichts auszugeben.' }),
        el('p.leer-text', { text: 'Erst Bilder lesen, dann entsteht hier der Riesenschein.' }),
      ]),
    ])
    return
  }

  const gewaehlt = stand.auswahl ?? stand.riesenscheine[0]?.id ?? ''

  fuelle(ziel, [
    erklaerzeile(),
    el('.ausgabekopf', {}, [
      el('span.feldname', { text: 'Riesenschein' }),
      el(
        'select.feldwahl.feldwahl-breit',
        {
          onchange: (e) => {
            vorschau = { id: '', leinwand: null, hinweise: [] }
            Zustand.aendere({ auswahl: /** @type {HTMLSelectElement} */ (e.target).value })
          },
        },
        stand.riesenscheine.map((r) =>
          el('option', { value: r.id, text: r.name, selected: r.id === gewaehlt ? 'selected' : null })
        )
      ),
    ]),

    el('.ausgabeknoepfe', {}, [
      el('button.knopf.knopf-haupt', {
        type: 'button',
        text: 'Blatt erzeugen',
        onclick: () => erzeugeBlatt(gewaehlt, ziel),
      }),
      el('button.knopf', {
        type: 'button',
        text: 'Blatt herunterladen',
        disabled: vorschau.leinwand ? null : 'disabled',
        onclick: () => ladeBlattHerunter(gewaehlt),
      }),
      el('button.knopf', {
        type: 'button',
        text: 'Excel für diesen Riesenschein',
        onclick: () => ladeExcelHerunter([gewaehlt]),
      }),
      el('button.knopf', {
        type: 'button',
        text: 'Excel für das ganze Projekt',
        onclick: () => ladeExcelHerunter(stand.riesenscheine.map((r) => r.id)),
      }),
      el('button.knopf', {
        type: 'button',
        text: 'CSV aller Scheine',
        onclick: () => ladeCsvHerunter(),
      }),
    ]),

    vorschau.hinweise.length > 0
      ? el('.hinweisblock.block-warnung', {}, [
          el('.blocktitel', { text: 'Zum Blatt' }),
          el('ul.blockliste', {}, vorschau.hinweise.map((h) => el('li', { text: h }))),
        ])
      : null,

    el('.vorschaubereich', { id: 'vorschaubereich' }, [
      vorschau.leinwand && vorschau.id === gewaehlt
        ? vorschau.leinwand
        : el('p.leer-text', {
            text: 'Auf "Blatt erzeugen" tippen. Das Blatt erscheint hier und kann dann heruntergeladen werden.',
          }),
    ]),
  ])
}

/**
 * Baut das Blatt und zeigt es an.
 *
 * @param {string} riesenscheinId
 * @param {HTMLElement} ziel
 */
async function erzeugeBlatt(riesenscheinId, ziel) {
  const stand = Zustand.hole()
  const riesenschein = stand.riesenscheine.find((r) => r.id === riesenscheinId)
  if (!riesenschein) return

  const scheine = Zustand.scheineVon(riesenscheinId)
  const rechnung = Zustand.rechnungVon(riesenscheinId)

  const posten = []
  const fehlend = []
  for (const schein of scheine) {
    const bild = stand.bilder.get(schein.bildId)
    if (!bild || !bild.element) {
      fehlend.push(schein.scheinNr.wert ?? schein.id)
      continue
    }
    posten.push({ schein, bild: bild.element, ausschnitt: schein.ausschnitt })
  }

  if (posten.length === 0) {
    Zustand.melde(
      'fehler',
      'Zu keinem dieser Scheine liegt noch ein Bild vor. Die Bilder bleiben nur auf diesem Gerät, ' +
        'bitte die Bildschirmfotos noch einmal hochladen.'
    )
    return
  }

  Zustand.arbeite(true, 'Das Blatt wird gesetzt', 0.3)
  await atmen()

  try {
    const ergebnis = baueMosaik(posten, rechnung, {
      titel: riesenschein.name,
      untertitel:
        `${rechnung.anzahlScheine} Scheine bei ${rechnung.anzahlBuchmacher} Anbieter(n), ` +
        `Gesamteinsatz ${formatiere(rechnung.einsatzGesamt, rechnung.waehrung, 'de')}`,
      gebiet: 'de',
    })

    const hinweise = [...ergebnis.hinweise]
    if (fehlend.length > 0) {
      hinweise.push(
        `Zu ${fehlend.length} Schein(en) fehlt das Bild, sie sind nicht auf dem Blatt: ${fehlend.join(', ')}.`
      )
    }

    ergebnis.leinwand.classList.add('blattvorschau')
    vorschau = { id: riesenscheinId, leinwand: ergebnis.leinwand, hinweise }
    Zustand.arbeite(false)
    zeichne(ziel)
  } catch (fehler) {
    Zustand.arbeite(false)
    Zustand.melde(
      'fehler',
      `Das Blatt liess sich nicht bauen: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
  }
}

/**
 * @param {string} riesenscheinId
 */
async function ladeBlattHerunter(riesenscheinId) {
  if (!vorschau.leinwand || vorschau.id !== riesenscheinId) {
    Zustand.melde('warnung', 'Bitte zuerst das Blatt erzeugen.')
    return
  }
  const stand = Zustand.hole()
  const riesenschein = stand.riesenscheine.find((r) => r.id === riesenscheinId)

  Zustand.arbeite(true, 'Das Bild wird gespeichert', 0.6)
  await atmen()
  try {
    const datei = await alsDatei(vorschau.leinwand)
    const endung = datei.type.includes('jpeg') ? 'jpg' : 'png'
    biete(datei, `Riesenschein_${sichererName(riesenschein?.name ?? 'ohne-namen')}_${zeitstempel()}.${endung}`)
    Zustand.melde('erfolg', 'Das Blatt wurde heruntergeladen.')
  } catch (fehler) {
    Zustand.melde(
      'fehler',
      `Das Bild liess sich nicht speichern: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
  } finally {
    Zustand.arbeite(false)
  }
}

/**
 * @param {string[]} riesenscheinIds
 */
async function ladeExcelHerunter(riesenscheinIds) {
  const stand = Zustand.hole()
  Zustand.arbeite(true, 'Die Excel-Mappe wird gebaut', 0.2)
  await atmen()

  try {
    const posten = riesenscheinIds
      .map((id) => {
        const riesenschein = stand.riesenscheine.find((r) => r.id === id)
        if (!riesenschein) return null
        return {
          riesenschein,
          scheine: Zustand.scheineVon(id),
          rechnung: Zustand.rechnungVon(id),
        }
      })
      .filter(/** @returns {p is NonNullable<typeof p>} */ (p) => Boolean(p))

    if (posten.length === 0) {
      Zustand.melde('warnung', 'Es gibt nichts auszugeben.')
      return
    }

    // Das Blatt mit hineinlegen, wenn es zum gewaehlten Riesenschein passt.
    /** @type {Blob|null} */
    let belegBild = null
    /** @type {{breite: number, hoehe: number}|undefined} */
    let belegMasse
    if (riesenscheinIds.length === 1 && vorschau.leinwand && vorschau.id === riesenscheinIds[0]) {
      belegBild = await alsDatei(vorschau.leinwand, { art: 'png' })
      const breite = Math.min(1000, vorschau.leinwand.width)
      belegMasse = {
        breite,
        hoehe: Math.round((vorschau.leinwand.height / vorschau.leinwand.width) * breite),
      }
    }

    Zustand.arbeite(true, 'Die Excel-Mappe wird gebaut', 0.6)
    await atmen()

    const titel =
      riesenscheinIds.length === 1
        ? posten[0]?.riesenschein.name ?? 'Riesenschein'
        : `${stand.projekt?.name ?? 'Projekt'}: ${posten.length} Riesenscheine`

    const mappe = await baueMappe(posten, {
      titel,
      gebiet: 'de',
      belegBild,
      belegMasse,
      restposten: stand.restposten,
      scheinNachId: new Map(stand.scheine.map((s) => [s.id, s])),
    })

    biete(mappe, `Kombi_${sichererName(titel)}_${zeitstempel()}.xlsx`)
    Zustand.melde('erfolg', 'Die Excel-Mappe wurde heruntergeladen.')
  } catch (fehler) {
    Zustand.melde(
      'fehler',
      `Die Excel-Mappe liess sich nicht bauen: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
  } finally {
    Zustand.arbeite(false)
  }
}

function ladeCsvHerunter() {
  const stand = Zustand.hole()
  const nachGruppe = new Map(stand.riesenscheine.map((r) => [r.id, r.name]))

  const kopf = [
    'Nr', 'Riesenschein', 'Anbieter', 'Konto', 'Schein-Nr', 'Gesetzt am', 'Art', 'Status',
    'Einsatz', 'Aufwand', 'Waehrung', 'Quote dezimal', 'Quote amerikanisch',
    'Moegliche Auszahlung', 'Tatsaechlich zurueck', 'Gratiswette', 'Each Way',
    'Lesesicherheit', 'Hinweise',
  ]

  const zeilen = stand.scheine.map((schein, i) => {
    const rueckfluss = realisierterRueckfluss(schein)
    return [
      i + 1,
      nachGruppe.get(schein.gruppeId ?? '') ?? '',
      schein.buchmacher.wert ?? '',
      schein.konto.wert ?? '',
      schein.scheinNr.wert ?? '',
      schein.gesetztAm.wert ? schein.gesetztAm.wert.replace('T', ' ') : '',
      schein.art,
      statusText(schein.status),
      schein.einsatz.wert,
      barEinsatz(schein),
      schein.waehrung.wert ?? '',
      schein.quoteDezimal.wert,
      schein.quoteAmerikanisch.wert === null ? null : Math.round(schein.quoteAmerikanisch.wert),
      schein.auszahlung.wert,
      rueckfluss.bekannt ? rueckfluss.wert : null,
      schein.gratiswette ? 'ja' : '',
      schein.eachWay ? 'ja' : '',
      Math.round(schein.ocrSicherheit * 100),
      schein.hinweise.map((h) => `[${h.schwere}] ${h.text}`).join(' | '),
    ]
  })

  const datei = baueCsv(kopf, zeilen, { gebiet: 'de' })
  biete(datei, `Kombi_Scheine_${zeitstempel()}.csv`)
  Zustand.melde('erfolg', 'Die CSV-Datei wurde heruntergeladen.')
}

/**
 * Zwei Saetze darueber, wozu diese Seite da ist.
 *
 * Karam am 16.09.2026: "Ausgabe, Ablage bitte mehr erklaeren, was das ist."
 *
 * Die ausfuehrliche Fassung steht im Reiter Erklaerung. Hier stehen zwei
 * Saetze an der Stelle, an der die Frage wirklich aufkommt: auf der Seite.
 *
 * @returns {HTMLElement}
 */
function erklaerzeile() {
  return el('.erklaerzeile', {}, [
    el('.erklaerzeile-titel', { text: 'Was diese Seite ist' }),
    el('p.erklaerzeile-text', {
      text:
        'Hier holst du deine Zahlen aus dem Programm heraus. Die Excel-Mappe enthält jeden ' +
        'einzelnen Schein als Zeile, jede zusammengefasste Wette als Zeile, dazu ein Blatt je ' +
        'Anbieter und eines mit allen Hinweisen. Zum Aufheben, zum Verschicken und um eigene ' +
        'Spalten daneben zu rechnen. CSV ist dasselbe als einfache Textdatei.',
    }),
  ])
}
