// @ts-check
/**
 * Ansicht "Uebersicht": die Startseite.
 *
 * Karam am 16.09.2026: "Aufnahme soll bitte bleiben, aber nicht ins Mainpage.
 * Ich will, dass eine Homepage, eine Uebersicht gemacht wird."
 *
 * WARUM DIE AUFNAHME NICHT MEHR DIE STARTSEITE IST
 *
 * Das Programm oeffnete bisher mit dem Reiter Aufnahme. Das ist der Arbeitsgang
 * von zehn Minuten am Sonntagabend. Den Rest der Woche, und die Saison laeuft
 * bis naechsten Sommer, will Karam beim Aufmachen nicht Bilder hochladen,
 * sondern SEHEN, wie er steht. Die Aufnahme ist damit nicht weg, sie ist nur
 * nicht mehr das Erste.
 *
 * DIESE DATEI RECHNET NICHT. Jede Zahl kommt aus kern/rechnung.js, genau wie
 * in der Ansicht Riesenscheine. Steht hier eine andere Zahl als dort, ist es
 * ein Fehler in der Anzeige, nie eine zweite Rechnung (Projektregel 8).
 */

import { el, fuelle, zeitText, anbieterzeichen } from './werkzeug.js'
import { formatiere, formatiereQuote } from '../kern/geld.js'
import { rechneProjekt } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'
import { fotoknoepfe } from './fotoknoepfe.js'

/**
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  const stand = Zustand.hole()
  const rechnungen = stand.riesenscheine.map((r) => Zustand.rechnungVon(r.id))
  const gesamt = rechneProjekt(rechnungen)

  fuelle(ziel, [
    projektkopfzeile(stand),
    stand.riesenscheine.length === 0 ? erstesMal() : null,
    stand.riesenscheine.length > 0 ? grossezahlen(gesamt) : null,
    stand.riesenscheine.length > 0 ? wettenliste(stand, rechnungen) : null,
    naechsteSchritte(stand),
  ])
}

/**
 * Die Zeile, die sagt, WO man gerade ist.
 *
 * Karam: "ich moechte, dass jeder Riesenschein oben hat, eine Anzeige, zu
 * welchem Projekt der gehoert. Projekte koennen ueber Monate oder ueber Jahre
 * gehen."
 *
 * Deshalb steht hier nicht nur der Name, sondern auch die Spanne: wann das
 * Projekt angelegt wurde und wann zuletzt daran gearbeitet wurde. Bei einem
 * Projekt, das eine ganze NFL-Saison traegt, ist das die Angabe, an der man
 * merkt, ob man im richtigen ist.
 *
 * @param {any} stand
 * @returns {HTMLElement}
 */
function projektkopfzeile(stand) {
  const p = stand.projekt
  if (!p) {
    return el('.projektfahne', {}, [
      el('span.projektfahne-marke', { text: 'PROJEKT' }),
      el('span.projektfahne-name', { text: 'Noch kein Projekt geoeffnet' }),
    ])
  }

  const von = p.angelegtAm ? zeitText(p.angelegtAm) : ''
  const bis = p.geaendertAm ? zeitText(p.geaendertAm) : ''
  const spanne = von && bis && von.slice(0, 10) !== bis.slice(0, 10) ? `${von} bis ${bis}` : von || bis

  return el('.projektfahne', {}, [
    el('span.projektfahne-marke', { text: 'PROJEKT' }),
    el('span.projektfahne-name', { text: p.name || 'Ohne Namen' }),
    spanne ? el('span.projektfahne-zeit', { text: spanne }) : null,
    p.notiz ? el('span.projektfahne-notiz', { text: p.notiz }) : null,
  ])
}

/**
 * Die drei Zahlen, wegen derer man herschaut, in gross.
 *
 * Es sind DIESELBEN drei wie in der Kopfleiste und im Projektkopf der
 * Riesenscheine. Das ist Absicht und kein Versehen: die Kopfleiste ist immer
 * da und deshalb klein, hier ist Platz, und hier darf man sie ohne Brille
 * lesen koennen.
 *
 * @param {any} gesamt
 * @returns {HTMLElement}
 */
function grossezahlen(gesamt) {
  const w = gesamt.waehrung
  const etwasEntschieden = Math.abs(gesamt.ergebnisRealisiert) > 0.005

  return el('.startzahlen', {}, [
    startkachel(
      'Insgesamt gesetzt',
      formatiere(gesamt.einsatzGesamt, w, 'de'),
      'neutral',
      // Einzahl und Mehrzahl getrennt: "1 Anbietern" liest sich wie ein
      // Fehler, und wer einen Fehler in der Sprache sieht, misstraut auch der
      // Zahl daneben.
      `${gesamt.anzahlScheine === 1 ? '1 Schein' : `${gesamt.anzahlScheine} Scheine`}` +
        ` bei ${gesamt.buchmacher.length === 1 ? '1 Anbieter' : `${gesamt.buchmacher.length} Anbietern`}`
    ),
    startkachel(
      'Kann zurueckkommen',
      formatiere(gesamt.auszahlungMoeglich, w, 'de'),
      'gut',
      'Wenn alles Offene gewinnt, einschliesslich Einsatz'
    ),
    etwasEntschieden
      ? startkachel(
          'Ergebnis bisher',
          formatiere(gesamt.ergebnisRealisiert, w, 'de'),
          gesamt.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht',
          'Nur was schon entschieden ist'
        )
      : startkachel(
          'Noch im Risiko',
          formatiere(gesamt.imRisiko, w, 'de'),
          'offen',
          'Kann noch verloren gehen'
        ),

    // Der Hinweis auf gemischte Waehrungen gehoert NEBEN die Zahlen, nicht
    // unter sie: die Summen daneben sind dann naemlich nicht zu gebrauchen,
    // und das muss man im selben Blick sehen.
    gesamt.waehrungGemischt
      ? el('.startkachel.startkachel-fehler', {}, [
          el('.startkachelname', { text: 'Achtung' }),
          el('.startkachelwert', { text: 'Waehrungen gemischt' }),
          el('.startkachelhilfe', {
            text: 'Euro, Dollar und Krypto werden NICHT umgerechnet. Die Summen daneben sind deshalb keine Summen.',
          }),
        ])
      : null,
  ])
}

/**
 * @param {string} name
 * @param {string} wert
 * @param {string} art
 * @param {string} hilfe
 * @returns {HTMLElement}
 */
function startkachel(name, wert, art, hilfe) {
  return el('.startkachel', { daten: { art } }, [
    el('.startkachelname', { text: name }),
    el('.startkachelwert', { text: wert }),
    el('.startkachelhilfe', { text: hilfe }),
  ])
}

/**
 * Jede Wette als eigene Kachel, mit einem Klick zum ganzen Riesenschein.
 *
 * @param {any} stand
 * @param {any[]} rechnungen
 * @returns {HTMLElement}
 */
function wettenliste(stand, rechnungen) {
  return el('.startbereich', {}, [
    el('h2.startbereichtitel', {
      text:
        stand.riesenscheine.length === 1
          ? 'Dein Riesenschein'
          : `Deine ${stand.riesenscheine.length} Riesenscheine`,
    }),
    el('p.startbereichtext', {
      text: 'Ein Klick oeffnet den ganzen Riesenschein mit allen Einzelscheinen darin.',
    }),
    el(
      '.startwetten',
      {},
      stand.riesenscheine.map((r, i) => wettenkachel(r, rechnungen[i], stand))
    ),
  ])
}

/**
 * @param {any} riesenschein
 * @param {any} rechnung
 * @param {any} stand
 * @returns {HTMLElement}
 */
function wettenkachel(riesenschein, rechnung, stand) {
  const w = rechnung.waehrung
  const scheine = Zustand.scheineVon(riesenschein.id)
  const anbieter = [...new Set(scheine.map((s) => s.buchmacher.wert).filter(Boolean))]

  return el(
    'button.startwette',
    {
      type: 'button',
      title: `Riesenschein "${riesenschein.name || 'Ohne Namen'}" oeffnen`,
      onclick: () => {
        Zustand.aendere({ ansicht: 'positionen', auswahl: riesenschein.id })
      },
    },
    [
      // Zu welchem Projekt der Riesenschein gehoert, steht AN ihm, nicht nur
      // oben auf der Seite. Wer ihn spaeter in der Ablage wiederfindet, sieht
      // die Zugehoerigkeit dann immer noch.
      el('.startwette-projekt', { text: stand.projekt?.name || 'Ohne Projekt' }),
      el('.startwette-name', { text: riesenschein.name || 'Ohne Namen' }),
      el('.startwette-anbieter', {}, [
        ...anbieter.slice(0, 8).map((name) => anbieterzeichen(name)),
        anbieter.length > 8 ? el('span.startwette-mehr', { text: `+${anbieter.length - 8}` }) : null,
      ]),
      el('.startwette-zahlen', {}, [
        startwert('Einsatz', formatiere(rechnung.einsatzGesamt, w, 'de'), 'neutral'),
        startwert('Moeglich', formatiere(rechnung.auszahlungMoeglich, w, 'de'), 'gut'),
        // Der Multiplikator kommt als quoteEffektiv aus kern/rechnung.js und
        // wird hier NICHT nachgerechnet. Eine zweite Rechnung an dieser Stelle
        // waere genau die Art Doppelung, vor der Projektregel 8 warnt.
        startwert(
          'Multiplikator',
          formatiereQuote(rechnung.quoteEffektiv, 'dezimal', 'de'),
          'neutral'
        ),
      ]),
      el('.startwette-fuss', {
        text: scheine.length === 1 ? '1 Schein' : `${scheine.length} Scheine`,
      }),
    ]
  )
}

/**
 * @param {string} name
 * @param {string} wert
 * @param {string} art
 * @returns {HTMLElement}
 */
function startwert(name, wert, art) {
  return el('.startwert', { daten: { art } }, [
    el('span.startwertname', { text: name }),
    el('span.startwertzahl', { text: wert }),
  ])
}

/**
 * Was zu tun ist, wenn noch gar nichts da ist.
 *
 * Ein leerer Bildschirm sagt nicht, was man tun soll. Diese Seite schon.
 *
 * @returns {HTMLElement}
 */
function erstesMal() {
  return el('.startleer', {}, [
    el('h2.startleertitel', { text: 'Noch nichts erfasst.' }),
    el('p.startleertext', {
      text:
        'So geht es los: du machst von jedem Wettschein ein Bildschirmfoto, das Programm liest die ' +
        'Zahlen heraus, und gleiche Wetten werden zu einem Riesenschein zusammengefuehrt. ' +
        'Du musst nichts abtippen.',
    }),
    el('.startleerknoepfe', {}, [fotoknoepfe({ titel: 'Ersten Schein aufnehmen' })]),
  ])
}

/**
 * Die Wege weiter, als richtige Knoepfe statt als Text.
 *
 * @param {any} stand
 * @returns {HTMLElement}
 */
function naechsteSchritte(stand) {
  const hatScheine = stand.scheine.length > 0

  return el('.startbereich', {}, [
    el('h2.startbereichtitel', { text: 'Was du hier tun kannst' }),
    el('.startwege', {}, [
      startweg(
        'Schein aufnehmen',
        'Bildschirmfoto machen oder eine Bilddatei einlesen. Daraus entstehen die Scheine.',
        'aufnahme'
      ),
      startweg(
        'Scheine pruefen',
        hatScheine
          ? `${stand.scheine.length} gelesene Scheine durchsehen und wo noetig von Hand berichtigen.`
          : 'Hier stehen die gelesenen Scheine, sobald es welche gibt.',
        'scheine'
      ),
      startweg(
        'Riesenscheine ansehen',
        'Gleiche Wetten zusammengefasst: Einsatz, moeglicher Gewinn, Multiplikator.',
        'positionen'
      ),
      startweg(
        'Ausgabe',
        'Alles als Excel-Mappe oder CSV herunterladen, zum Aufheben und zum Weiterrechnen.',
        'ausgabe'
      ),
      startweg(
        'Ablage',
        'Deine Projekte und Ordner. Hier liegt, was du frueher gemacht hast, ueber Monate und Jahre.',
        'ablage'
      ),
      startweg('Erklaerung', 'Jede Seite dieses Programms, Schritt fuer Schritt erklaert.', 'hilfe'),
    ]),
  ])
}

/**
 * @param {string} name
 * @param {string} text
 * @param {string} ansicht
 * @returns {HTMLElement}
 */
function startweg(name, text, ansicht) {
  return el(
    'button.startweg',
    {
      type: 'button',
      onclick: () => Zustand.aendere({ ansicht }),
    },
    [el('span.startwegname', { text: name }), el('span.startwegtext', { text })]
  )
}
