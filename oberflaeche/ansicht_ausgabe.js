// @ts-check
/**
 * Ansicht "Ausgabe".
 *
 * Hier entsteht, was Karam weitergibt: der Riesenschein als ein einziges BILD,
 * und dieselbe Sache noch einmal als Excel-Mappe zum Nachrechnen.
 *
 * Das Bild wird zuerst angezeigt und erst dann heruntergeladen. Wer ein Bild
 * ungesehen verschickt, merkt einen Fehlschnitt erst beim Empfaenger.
 *
 * DAS WORT "BLATT" STEHT NUR NOCH IM CODE, nicht mehr auf dem Bildschirm. Es
 * kommt aus dem Bau dieses Programms (bild/mosaik.js setzt ein Blatt) und
 * nicht aus Karams Arbeit: er verschickt ein Bild. Die Funktionsnamen heissen
 * weiter erzeugeBlatt und ladeBlattHerunter, damit sie zu mosaik.js passen.
 */

import { el, fuelle, atmen } from './werkzeug.js'
import { formatiere } from '../kern/geld.js'
import { baueMosaik, alsDatei, statusText } from '../bild/mosaik.js'
import { baueMappe } from '../ausgabe/excel.js'
import { baueCsv, biete, sichererName, zeitstempel } from '../ausgabe/datei.js'
import { barEinsatz, realisierterRueckfluss } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'
// Dieselbe Anordnung wie in der Spalte links und in der Uebersicht. Wer dort
// nach Geld sortiert hat, findet den Riesenschein hier an derselben Stelle
// wieder (Projektregel 8).
import * as Reihenfolge from './reihenfolge.js'

/** Der zuletzt gebaute Riesenschein, damit er nicht bei jedem Neuzeichnen neu entsteht. */
let vorschau = { id: '', leinwand: /** @type {HTMLCanvasElement|null} */ (null), hinweise: /** @type {string[]} */ ([]) }

/**
 * DREI SCHRITTE STATT FUENF KNOEPFEN, seit dem 17.09.2026.
 *
 * Karam: "Ich moechte, dass du nach dieser Ueberarbeitung auch die Ausgabe und
 * die Ablage ueberarbeitest, dass es wirklich sehr uebersichtlich ist und die
 * Knoepfe sich sehr, sehr leicht verstehen lassen."
 *
 * WAS VORHER FALSCH WAR
 *
 * Hier standen fuenf gleich laute Knoepfe in einer Reihe: "Blatt erzeugen",
 * "Blatt herunterladen", "Excel fuer diesen Riesenschein", "Excel fuer das
 * ganze Projekt", "CSV aller Scheine". Drei Dinge, die man auseinanderhalten
 * muss, in einer Reihe, ohne dass man sieht, welcher Knopf vor welchem kommt.
 * Der zweite war ausgegraut, ohne dass irgendwo stand, warum.
 *
 * "Blatt" ist ausserdem ein Wort aus dem Bau dieses Programms, nicht aus
 * Karams Arbeit. Er verschickt ein BILD.
 *
 * WAS JETZT DASTEHT
 *
 *   1  Das Bild zum Verschicken     alle Scheine nebeneinander, zum Weitergeben
 *   2  Die Tabelle zum Nachrechnen  Excel, jede Zeile ein Schein
 *   3  Die Rohdaten                 dieselben Zeilen als einfache Textdatei
 *
 * Jeder Schritt hat eine Nummer, eine Ueberschrift, einen Satz und seine
 * eigenen Knoepfe. Wer nur eines davon braucht, findet es, ohne die anderen
 * zu lesen.
 *
 * GERECHNET WIRD HIER NICHTS. Alle Zahlen kommen aus kern/rechnung.js.
 *
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

  /*
    DIE AUSWAHL KANN LEER SEIN, seit es die Uebersicht gibt.

    auswahl null heisst bei den Riesenscheinen: die Uebersicht ist offen, es ist
    keiner aufgeschlagen. Hier braucht es aber einen, sonst waere die Seite
    leer. Faellt also auf den ersten zurueck, und der steht auch im Auswahlfeld.
  */
  const geordnet = Reihenfolge.ordne(
    stand.riesenscheine,
    { ordnerFilter: null, sortierung: stand.sortierung },
    Zustand.rechnungVon
  )
  const gewaehlt =
    stand.auswahl && stand.riesenscheine.some((r) => r.id === stand.auswahl)
      ? stand.auswahl
      : (geordnet[0]?.id ?? '')

  const scheine = Zustand.scheineVon(gewaehlt)
  // Ohne Bild kein Ausschnitt auf dem Bild. Das steht hier, BEVOR man drueckt,
  // und nicht erst als Anmerkung darunter, wenn das Bild schon gebaut ist.
  const mitBild = scheine.filter((s) => stand.bilder.get(s.bildId)?.element).length

  fuelle(ziel, [
    erklaerzeile(),

    schritt('1', 'Das Bild zum Verschicken',
      'Alle Scheine dieses Riesenscheins nebeneinander auf einem Bild, mit den Summen ' +
      'darüber. Das ist es, was du weitergibst.', [
      el('label.ausgabewahl', {}, [
        el('span.feldname', { text: 'Welcher Riesenschein' }),
        el(
          'select.feldwahl.feldwahl-breit',
          {
            onchange: (e) => {
              vorschau = { id: '', leinwand: null, hinweise: [] }
              Zustand.aendere({ auswahl: /** @type {HTMLSelectElement} */ (e.target).value })
            },
          },
          geordnet.map((r) =>
            el('option', {
              value: r.id,
              text: `${r.name || 'Ohne Namen'} (${r.scheinIds.length})`,
              selected: r.id === gewaehlt ? 'selected' : null,
            })
          )
        ),
      ]),

      el('p.ausgabestand', {
        daten: { warnung: String(mitBild < scheine.length) },
        text:
          scheine.length === 0
            ? 'In diesem Riesenschein liegt noch kein Schein.'
            : mitBild === scheine.length
              ? `Zu allen ${scheine.length} Scheinen liegt das Foto vor.`
              : `Zu ${mitBild} von ${scheine.length} Scheinen liegt das Foto noch vor. ` +
                'Die übrigen fehlen auf dem Bild. Fotos bleiben nur auf dem Gerät, ' +
                'auf dem sie hochgeladen wurden.',
      }),

      el('.ausgabeknoepfe', {}, [
        el('button.knopf.knopf-haupt', {
          type: 'button',
          text: 'Bild erzeugen',
          disabled: mitBild === 0 ? 'disabled' : null,
          title:
            mitBild === 0
              ? 'Es liegt kein Foto mehr vor, aus dem sich ein Bild bauen liesse.'
              : 'Baut das Bild und zeigt es hier darunter an.',
          onclick: () => erzeugeBlatt(gewaehlt, ziel),
        }),
        el('button.knopf', {
          type: 'button',
          text: 'Bild speichern',
          disabled: vorschau.leinwand && vorschau.id === gewaehlt ? null : 'disabled',
          // Ein ausgegrauter Knopf ohne Grund ist eine Sackgasse. Der Grund
          // steht jetzt daran, und man liest ihn beim Darueberfahren.
          title:
            vorschau.leinwand && vorschau.id === gewaehlt
              ? 'Lädt das Bild als Datei herunter.'
              : 'Erst auf "Bild erzeugen" drücken. Gespeichert wird genau das, was du dann siehst.',
          onclick: () => ladeBlattHerunter(gewaehlt),
        }),
      ]),

      vorschau.hinweise.length > 0 && vorschau.id === gewaehlt
        ? el('.hinweisblock.block-warnung', {}, [
            el('.blocktitel', { text: 'Zu diesem Bild' }),
            el('ul.blockliste', {}, vorschau.hinweise.map((h) => el('li', { text: h }))),
          ])
        : null,

      el('.vorschaubereich', { id: 'vorschaubereich' }, [
        vorschau.leinwand && vorschau.id === gewaehlt
          ? vorschau.leinwand
          : el('p.leer-text', {
              text: 'Das Bild erscheint hier, sobald du es erzeugt hast. Erst ansehen, dann speichern.',
            }),
      ]),
    ]),

    schritt('2', 'Die Tabelle zum Nachrechnen',
      'Eine Excel-Mappe. Jeder einzelne Schein ist eine Zeile, jeder Riesenschein ist ' +
      'eine Zeile, dazu ein Blatt je Anbieter und eines mit allen Anmerkungen. ' +
      'Zum Aufheben und um eigene Spalten daneben zu rechnen.', [
      el('.ausgabeknoepfe', {}, [
        el('button.knopf', {
          type: 'button',
          text: 'Nur dieser Riesenschein',
          title: 'Eine Mappe mit genau dem Riesenschein, der oben gewählt ist.',
          onclick: () => ladeExcelHerunter([gewaehlt]),
        }),
        el('button.knopf', {
          type: 'button',
          text:
            stand.riesenscheine.length === 1
              ? 'Das ganze Projekt'
              : `Alle ${stand.riesenscheine.length} Riesenscheine`,
          title: `Eine Mappe mit allem aus dem Projekt ${stand.projekt?.name || 'ohne Namen'}.`,
          onclick: () => ladeExcelHerunter(stand.riesenscheine.map((r) => r.id)),
        }),
      ]),
    ]),

    schritt('3', 'Die Rohdaten',
      'Dieselben Zeilen als einfache Textdatei. Für andere Programme, die keine ' +
      'Excel-Mappe lesen.', [
      el('.ausgabeknoepfe', {}, [
        el('button.knopf', {
          type: 'button',
          text:
            stand.scheine.length === 1
              ? '1 Schein als CSV'
              : `Alle ${stand.scheine.length} Scheine als CSV`,
          title: 'Eine Zeile je Schein, mit Semikolon getrennt.',
          onclick: () => ladeCsvHerunter(),
        }),
      ]),
    ]),
  ])
}

/**
 * Ein nummerierter Schritt mit Ueberschrift, einem Satz und seinen Knoepfen.
 *
 * @param {string} nummer
 * @param {string} titel
 * @param {string} text
 * @param {(HTMLElement|null)[]} inhalt
 * @returns {HTMLElement}
 */
function schritt(nummer, titel, text, inhalt) {
  return el('section.ausgabeschritt', {}, [
    el('.ausgabeschrittkopf', {}, [
      el('span.ausgabenummer', { text: nummer, 'aria-hidden': 'true' }),
      el('.ausgabeschritttext', {}, [
        el('h3.ausgabeschritttitel', { text: titel }),
        el('p.ausgabeschritthilfe', { text }),
      ]),
    ]),
    el('.ausgabeschrittinhalt', {}, inhalt),
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

  Zustand.arbeite(true, 'Das Bild wird gesetzt', 0.3)
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
        `Zu ${fehlend.length} Schein(en) fehlt das Foto, sie stehen nicht auf dem Bild: ${fehlend.join(', ')}.`
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
      `Das Bild ließ sich nicht bauen: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
  }
}

/**
 * @param {string} riesenscheinId
 */
async function ladeBlattHerunter(riesenscheinId) {
  if (!vorschau.leinwand || vorschau.id !== riesenscheinId) {
    Zustand.melde('warnung', 'Bitte zuerst auf "Bild erzeugen" druecken.')
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
    Zustand.melde('erfolg', 'Das Bild wurde heruntergeladen.')
  } catch (fehler) {
    Zustand.melde(
      'fehler',
      `Das Bild ließ sich nicht speichern: ${fehler instanceof Error ? fehler.message : String(fehler)}`
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
      `Die Excel-Mappe ließ sich nicht bauen: ${fehler instanceof Error ? fehler.message : String(fehler)}`
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
    'Einsatz', 'Aufwand', 'Währung', 'Quote dezimal', 'Quote amerikanisch',
    'Mögliche Auszahlung', 'Tatsächlich zurück', 'Gratiswette', 'Each Way',
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
        'Hier holst du deine Zahlen aus dem Programm heraus, auf drei Wegen. ' +
        'Das Bild ist zum Weitergeben: alle Scheine eines Riesenscheins nebeneinander. ' +
        'Die Excel-Mappe ist zum Nachrechnen und Aufheben. ' +
        'Die CSV-Datei ist dasselbe für andere Programme. ' +
        'Nichts davon verlässt dieses Gerät, bevor du es selbst verschickst.',
    }),
  ])
}
