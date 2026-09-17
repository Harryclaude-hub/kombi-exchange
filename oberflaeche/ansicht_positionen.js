// @ts-check
/**
 * Ansicht "Riesenscheine".
 *
 * Das Herzstueck: dieselbe Wette, viele Male gesetzt, auf einen Blick.
 * Wie viel insgesamt, bei wie vielen Anbietern, zu welcher Quote, was kommt
 * zurueck, was steht noch im Risiko.
 *
 * Die Zahlen werden hier NIE gerechnet. Sie kommen alle aus kern/rechnung.js.
 * Diese Datei stellt nur dar.
 */

import { el, fuelle, zeitText, anbieterzeichen, ausschnittbild } from './werkzeug.js'
import { formatiere, formatiereQuote } from '../kern/geld.js'
import { statusText } from '../bild/mosaik.js'
import { barEinsatz, realisierterRueckfluss, offenePotenzialauszahlung } from '../kern/rechnung.js'
import { rechneProjekt } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'
import * as Ordner from './ordner.js'
import * as Reihenfolge from './reihenfolge.js'
import { fotoknoepfe } from './fotoknoepfe.js'
import { istAngeheftet, heftAn } from './nadeln.js'
// Dieselben Eingabefelder wie im Reiter Scheine, aus einer Quelle
// (Projektregel 8). Siehe oberflaeche/scheinfelder.js.
import {
  textfeld,
  zahlfeld,
  quotenfeld,
  zeitfeld,
  statuswahl,
  schalter,
} from './scheinfelder.js'

/**
 * DREI EBENEN, seit dem 17.09.2026.
 *
 * Karam: "Nummer 1, hier ist die Uebersicht, da sind alle Riesenscheine
 * angezeigt und Folder. Wenn man einen Riesenschein aufmacht, kommt der
 * Riesenschein dann in die Mitte, und ganz links werden dann alle Scheine
 * angezeigt, die in diesem Riesenschein sind. Kann man sie dann separat
 * aufmachen, und dann sieht man im grossen Bereich, welche Einsaetze man hat,
 * da kann man die auch bearbeiten. Man kann dann auch auf Zurueck druecken."
 *
 *   Ebene 1   auswahl ist null                    die Uebersicht
 *   Ebene 2   auswahl gesetzt, scheinAuswahl null ein Riesenschein
 *   Ebene 3   scheinAuswahl gesetzt               ein einzelner Schein
 *
 * Die Ebene steht NICHT eigens im Zustand, sie folgt aus diesen beiden Feldern.
 * Eine dritte Angabe koennte mit ihnen auseinanderlaufen (Projektregel 8).
 *
 * WAS GEPRUEFT WIRD, BEVOR GEZEICHNET WIRD: ob die Auswahl noch auf etwas
 * zeigt, das es gibt. Nach jedem Neuordnen aendert sich die Kennung einer
 * Gruppe mit ihrer Signatur, und eine alte Kennung zeigt ins Leere. Vorher
 * blieb die Mitte dann einfach leer, ohne jede Meldung. Jetzt faellt sie auf
 * die naechsthoehere Ebene zurueck, und man steht wieder auf festem Boden.
 *
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  const stand = Zustand.hole()

  const offenerId =
    stand.auswahl !== null && stand.riesenscheine.some((r) => r.id === stand.auswahl)
      ? stand.auswahl
      : null

  const scheineDrin = offenerId ? Zustand.scheineVon(offenerId) : []
  const scheinId =
    offenerId && stand.scheinAuswahl && scheineDrin.some((s) => s.id === stand.scheinAuswahl)
      ? stand.scheinAuswahl
      : null

  // Ebene 3: ein einzelner Schein, gross und aenderbar.
  if (offenerId && scheinId) {
    fuelle(ziel, [einzelschein(offenerId, scheinId, scheineDrin)])
    return
  }

  // Ebene 2: ein Riesenschein.
  if (offenerId) {
    fuelle(ziel, [
      zurueckleiste('Alle Riesenscheine', 'Zurueck zur Uebersicht', () =>
        Zustand.aendere({ auswahl: null, scheinAuswahl: null })
      ),
      einzelheit(offenerId),
    ])
    return
  }

  // Ebene 1: die Uebersicht.
  fuelle(ziel, [uebersicht(stand)])
}

/**
 * Der Weg zurueck, immer ganz oben und immer gleich aussehend.
 *
 * Karam am 17.09.2026: "man kann dann auch auf Zurueck druecken."
 *
 * @param {string} beschriftung
 * @param {string} hilfe
 * @param {() => void} was
 * @returns {HTMLElement}
 */
function zurueckleiste(beschriftung, hilfe, was) {
  return el('.zurueckleiste', {}, [
    el('button.knopf.knopf-klein.zurueckknopf', {
      type: 'button',
      text: `< ${beschriftung}`,
      title: hilfe,
      onclick: was,
    }),
  ])
}

/**
 * EBENE 1: die Uebersicht. Ordner und Riesenscheine, wie in einem Dateifenster.
 *
 * Karam am 17.09.2026: "Ich moechte bitte, dass man bei der Uebersicht Ordner
 * anlegen kann, das heisst, man kann Sachen in Ordner hinzufuegen. Bei den
 * Riesenscheinen, dass man auch Ordner hat, alle ohne Ordner. Und dann hat man
 * eine Uebersicht von den Ordnern, wenn es ueberhaupt Ordner gibt, kann man die
 * Ordner separat aufmachen, also einen Ordner aufmachen, und dann kommen alle
 * Riesenscheine, die im Ordner sind. Ich will, dass man einfach eine gute
 * Uebersicht hat."
 *
 * OBEN STEHEN ORDNER UND DAS, WAS IN KEINEM ORDNER LIEGT.
 *
 * Nicht Ordner UND zusaetzlich alles. Ein Riesenschein, der in einem Ordner
 * liegt, steht dann naemlich zweimal auf demselben Bildschirm, einmal in der
 * Kachel und einmal darunter, und man raetselt, ob es zwei sind. So macht es
 * auch der Dateimanager, den Karam am 14.09.2026 als Vorbild genannt hat:
 * Ordner und lose Dateien, und was im Ordner liegt, sieht man, wenn man ihn
 * aufmacht.
 *
 * VERLOREN GEHT DABEI NICHTS: die Spalte ganz links fuehrt weiterhin ALLE
 * Riesenscheine des Projekts, mit dem Ordnernamen darunter. Wer springen will,
 * springt dort; wer ordnen will, ordnet hier (Projektregel 9).
 *
 * Gefiltert und angeordnet wird ueber oberflaeche/reihenfolge.js, also mit
 * genau derselben Rechnung wie die Liste links (Projektregel 8).
 *
 * @param {any} stand
 * @returns {HTMLElement}
 */
function uebersicht(stand) {
  const rechnungen = stand.riesenscheine.map((r) => Zustand.rechnungVon(r.id))
  const gesamt = rechneProjekt(rechnungen)
  const ordner = Ordner.alleOrdner(stand.riesenscheine)
  const ohne = Ordner.anzahlOhneOrdner(stand.riesenscheine)

  const offenerOrdner = stand.ordnerFilter

  // Im offenen Ordner: nur seine. Sonst: nur die, die in keinem liegen.
  const gezeigt = Reihenfolge.ordne(
    stand.riesenscheine,
    {
      ordnerFilter: offenerOrdner === null ? Ordner.OHNE_ORDNER : offenerOrdner,
      sortierung: stand.sortierung,
    },
    Zustand.rechnungVon
  )

  if (offenerOrdner !== null) return imOrdner(stand, offenerOrdner, gezeigt)

  return el('.uebersicht', {}, [
    el('.uebersichtkopf', {}, [
      el('.uebersichttitel', {}, [
        el('h2', { text: 'Übersicht' }),
        el('p.uebersichtunter', {
          text:
            stand.riesenscheine.length === 0
              ? 'Noch kein Riesenschein da.'
              : `${stand.riesenscheine.length} Riesenscheine im Projekt ` +
                `${stand.projekt?.name || 'ohne Namen'}` +
                (ordner.length === 0
                  ? ''
                  : `, davon ${stand.riesenscheine.length - ohne} in ${
                      ordner.length === 1 ? '1 Ordner' : `${ordner.length} Ordnern`
                    }`),
        }),
      ]),
      neuerknopf(stand),
    ]),

    ordnerhinweis(stand),

    // Die Projektsumme erst ab zwei Riesenscheinen: bei einem staende dieselbe
    // Zahl zweimal auf dem Bildschirm, und das macht nur unsicher, ob es
    // wirklich dieselbe ist.
    stand.riesenscheine.length > 1 ? projektkopf(gesamt) : null,

    /*
      DIE ORDNER, MIT IHREN SUMMEN.

      Karam am 17.09.2026: "diese Ordner werden auch miteinander gerechnet."

      Gezaehlt wird hier nichts selbst: ordnersumme in reihenfolge.js zaehlt
      zusammen, was kern/rechnung.js je Riesenschein schon ausgerechnet hat.
      Und es wird NIE ueber Waehrungen hinweg summiert: kommen mehrere vor,
      bleibt die Kachel ohne Summe und sagt warum.

      Der Abschnitt faellt ganz weg, solange es keinen Ordner gibt. Eine
      Ueberschrift ueber nichts ist eine Frage an den Leser, keine Auskunft.
    */
    ordner.length > 0
      ? el('.ordnerbereich', {}, [
          el('.teiltitel', {
            text: ordner.length === 1 ? '1 Ordner' : `${ordner.length} Ordner`,
          }),
          el(
            '.ordnerkacheln',
            {},
            ordner.map((o) => ordnerkachel(stand, o.name, o.name, o.anzahl))
          ),
        ])
      : null,

    el('.ordnerbereich', {}, [
      el('.teiltitel', {
        text:
          ordner.length === 0
            ? gezeigt.length === 1
              ? '1 Riesenschein'
              : `${gezeigt.length} Riesenscheine`
            : gezeigt.length === 1
              ? '1 Riesenschein in keinem Ordner'
              : `${gezeigt.length} Riesenscheine in keinem Ordner`,
      }),
      gezeigt.length === 0
        ? el('.leerhinweis', {}, [
            el('p.leer-titel', {
              text:
                stand.riesenscheine.length === 0
                  ? 'Noch kein Riesenschein da.'
                  : 'Alles liegt in Ordnern.',
            }),
            el('p.leer-text', {
              text:
                stand.riesenscheine.length === 0
                  ? 'Mach mit dem Knopf oben einen neuen auf und lade die Bildschirmfotos hinein. ' +
                    'Gleiche Wetten wandern sonst auch von selbst zusammen.'
                  : 'Mach oben einen Ordner auf, dann siehst du, was darin liegt.',
            }),
          ])
        : el(
            '.riesenkarten',
            {},
            gezeigt.map((r) => riesenkarte(r, stand))
          ),
    ]),
  ])
}

/**
 * EBENE 1 mit offenem Ordner: nur, was darin liegt.
 *
 * Karam am 17.09.2026: "kann man die Ordner separat aufmachen, also einen
 * Ordner aufmachen, und dann kommen alle Riesenscheine, die im Ordner sind."
 *
 * @param {any} stand
 * @param {string} ordner
 * @param {any[]} gezeigt
 * @returns {HTMLElement}
 */
function imOrdner(stand, ordner, gezeigt) {
  const leer = ordner === Ordner.OHNE_ORDNER
  const name = leer ? 'Ohne Ordner' : ordner
  const summe = leer ? null : Reihenfolge.ordnersumme(stand.riesenscheine, ordner, Zustand.rechnungVon)

  return el('.uebersicht', {}, [
    zurueckleiste('Alle Ordner', 'Zurueck zur Uebersicht', () =>
      Zustand.aendere({ ordnerFilter: null })
    ),

    el('.uebersichtkopf', {}, [
      el('.uebersichttitel', {}, [
        el('h2', {}, [leer ? null : el('span.ordnersymbol', { text: 'O', 'aria-hidden': 'true' }), name]),
        el('p.uebersichtunter', {
          text:
            gezeigt.length === 1
              ? '1 Riesenschein darin'
              : `${gezeigt.length} Riesenscheine darin`,
        }),
      ]),
      neuerknopf(stand),
    ]),

    // Die Summe des Ordners, gross und nicht als Kleingedrucktes an der Kachel.
    // Karam rechnet in Geld; wenn er einen Ordner aufmacht, ist das die erste
    // Frage.
    summe === null
      ? null
      : summe.gemischt
        ? el('.kachelreihe.kachelreihe-wichtig', {}, [
            el('.kachel.kachel-fehler', {}, [
              el('.kachelname', { text: 'Achtung' }),
              el('.kachelwert', { text: 'Währungen gemischt' }),
              el('.kachelhilfe', {
                text: `In diesem Ordner liegen ${summe.anzahl} Riesenscheine in mehreren Währungen. Deshalb steht hier keine Summe.`,
              }),
            ]),
          ])
        : el('.kachelreihe.kachelreihe-wichtig', {}, [
            kachel('Ordner: gesamt gesetzt', formatiere(summe.einsatz, summe.waehrung, 'de'), 'neutral',
              `${summe.anzahl} Riesenschein(e) zusammengezählt`),
            kachel('Ordner: kann zurückkommen', formatiere(summe.moeglich, summe.waehrung, 'de'), 'gut',
              'Wenn alles Offene gewinnt, einschließlich Einsatz'),
            kachel('Ordner: Ergebnis bisher', formatiere(summe.ergebnis, summe.waehrung, 'de'),
              summe.ergebnis >= 0 ? 'gut' : 'schlecht', 'Nur entschiedene Scheine'),
          ]),

    gezeigt.length === 0
      ? el('.leerhinweis', {}, [
          el('p.leer-titel', { text: 'Dieser Ordner ist leer.' }),
          el('p.leer-text', {
            text:
              'Ein Ordner besteht nur, solange ein Riesenschein darin liegt. ' +
              'Sobald der letzte heraus ist, verschwindet er von selbst.',
          }),
        ])
      : el(
          '.riesenkarten',
          {},
          gezeigt.map((r) => riesenkarte(r, stand))
        ),
  ])
}

/**
 * Der Satz darueber, ob die Ordner wirklich geteilt werden.
 *
 * Karam am 17.09.2026: "Du musst verstehen, dieses Programm ist ein Account.
 * Es wird alles auf einer Datenbank gespeichert, in Supabase. Und ich sehe
 * jedes Foto, jeden Schein, den eine Person macht."
 *
 * Genau so ist es, und genau deshalb steht hier ein Hinweis, solange die
 * Datenbank die Spalte noch nicht hat: dann ueberlebt ein Ordner das Neuladen
 * nicht, und das muss dastehen, BEVOR jemand dreissig Riesenscheine einsortiert.
 *
 * DIE ZAHL WIRD GEMESSEN, NICHT BEHAUPTET: app.js sieht beim Laden nach, ob die
 * Zeilen aus der Datenbank das Feld mitbringen. Sobald die Migration gelaufen
 * ist, verschwindet dieser Kasten von selbst, ohne dass jemand etwas umstellt.
 *
 * @param {any} stand
 * @returns {HTMLElement|null}
 */
function ordnerhinweis(stand) {
  if (stand.ordnerGeteilt === true) return null
  // null heisst: es kam keine einzige Zeile, also weiss es niemand. Dann wird
  // auch nichts behauptet.
  if (stand.ordnerGeteilt === null) return null

  return el('.ordnerachtung', {}, [
    el('.ordnerachtungtitel', { text: 'Ordner werden noch nicht geteilt' }),
    el('p', {
      text:
        'Der Datenbank fehlt noch eine Spalte für den Ordner. Bis sie da ist, ' +
        'bleibt eine Ordnerzuordnung nur in diesem Browser und überlebt das ' +
        'Neuladen nicht. Alles andere, Scheine, Bilder, Namen, Notizen, wird ' +
        'wie immer geteilt.',
    }),
    el('p', {}, [
      'Ein einziger Befehl behebt das. Er steht fertig auf der Seite ',
      el('a', {
        /*
          Der Weg wird aus der Adresse DIESER Datei gebaut und nicht aus der
          Adresse der Seite. Das Programm liegt unter /, die Probeseite unter
          /werkzeug/probe/, und auf GitHub Pages liegt alles noch einmal unter
          /kombi-exchange/. Ein fester Weg waere in zwei von drei Faellen falsch.
        */
        href: new URL('../werkzeug/datenbank_erweitern.html', import.meta.url).href,
        text: 'Datenbank erweitern',
        target: '_blank',
        rel: 'noopener',
      }),
      ' zum Kopieren.',
    ]),
  ])
}

/**
 * Der Knopf, der einen neuen Riesenschein anlegt.
 *
 * Karam am 17.09.2026: "ein neuer Riesenschein, wenn ich diesen Knopf druecke,
 * komme ich auf einen neuen Riesenschein. Das heisst, ich habe jetzt 10, dann
 * bekomme ich 11. Einen komplett neuen, keine Huelle schliessen, nichts."
 *
 * Es wird deshalb NICHTS gefragt und nichts geschlossen. Der Name kommt von
 * selbst und steht oben im Riesenschein in einem Feld, in das man einfach
 * hineinschreibt.
 *
 * STEHT MAN IN EINEM ORDNER, LANDET ER DARIN. Wer einen Ordner aufgemacht hat
 * und dort auf diesen Knopf drueckt, meint diesen Ordner. Das steht auch am
 * Knopf, damit es niemanden ueberrascht.
 *
 * @param {any} stand
 * @returns {HTMLElement}
 */
function neuerknopf(stand) {
  const inOrdner =
    stand.ordnerFilter !== null && stand.ordnerFilter !== Ordner.OHNE_ORDNER
      ? stand.ordnerFilter
      : ''

  return el('button.knopf.knopf-haupt.neuerknopf', {
    type: 'button',
    text: inOrdner ? `Neuer Riesenschein in "${inOrdner}"` : 'Neuer Riesenschein',
    title:
      'Legt sofort einen neuen, leeren Riesenschein an und macht ihn auf. ' +
      'Alles, was du danach hochlädst, landet darin, bis du den nächsten anlegst.' +
      (inOrdner ? ` Er liegt dann im Ordner "${inOrdner}".` : ''),
    onclick: () => {
      const id = Zustand.macheHuelleAuf(`Riesenschein ${stand.riesenscheine.length + 1}`, inOrdner)
      Reihenfolge.merkeGeoeffnet(id)
    },
  })
}

/**
 * Eine Ordnerkachel. Ein Klick MACHT DEN ORDNER AUF.
 *
 * Karam am 17.09.2026: "kann man die Ordner separat aufmachen, also einen
 * Ordner aufmachen, und dann kommen alle Riesenscheine, die im Ordner sind."
 *
 * Vorher hat dieselbe Kachel nur gefiltert: die anderen Kacheln blieben stehen,
 * und darunter wechselte die Liste. Das ist etwas anderes, als einen Ordner
 * aufzumachen, und man sah nie, ob man nun drin war oder davor.
 *
 * @param {any} stand
 * @param {string} wert
 * @param {string} beschriftung
 * @param {number} anzahl
 * @returns {HTMLElement}
 */
function ordnerkachel(stand, wert, beschriftung, anzahl) {
  const summe =
    wert === Ordner.OHNE_ORDNER
      ? null
      : Reihenfolge.ordnersumme(stand.riesenscheine, wert, Zustand.rechnungVon)

  return el(
    'button.ordnerkachel',
    {
      type: 'button',
      title: `Ordner "${beschriftung}" aufmachen`,
      onclick: () => Zustand.aendere({ ordnerFilter: wert, auswahl: null, scheinAuswahl: null }),
    },
    [
      el('.ordnerkachelname', {}, [
        el('span.ordnersymbol', { text: 'O', 'aria-hidden': 'true' }),
        beschriftung,
      ]),
      el('.ordnerkachelzahl', {
        text: anzahl === 1 ? '1 Riesenschein' : `${anzahl} Riesenscheine`,
      }),
      summe === null
        ? null
        : summe.gemischt
          ? el('.ordnerkachelwarnung', {
              text: 'Währungen gemischt, deshalb keine Summe',
            })
          : el('.ordnerkachelsumme', {}, [
              el('span', { text: 'gesetzt' }),
              el('strong', { text: formatiere(summe.einsatz, summe.waehrung, 'de') }),
              el('span', { text: 'kann zurück' }),
              el('strong', { text: formatiere(summe.moeglich, summe.waehrung, 'de') }),
            ]),
    ]
  )
}

/**
 * Eine Karte je Riesenschein in der Uebersicht.
 *
 * SIE IST KEIN KNOPF MEHR, sondern eine Karte MIT Knoepfen.
 *
 * Karam am 17.09.2026: "man kann Sachen in Ordner hinzufuegen." Dafuer braucht
 * die Karte einen zweiten Weg neben dem Aufmachen, und ein Knopf in einem Knopf
 * ist kein gueltiges HTML: der Browser zieht ihn heraus, und dann liegt er
 * irgendwo. Die Karte oeffnet weiterhin beim Anklicken, der Knopf "Öffnen" ist
 * der sichtbare Weg, so wie in der Ablage seit dem 17.09.2026 auch.
 *
 * @param {import('../kern/typen.js').Riesenschein} riesenschein
 * @param {any} stand
 * @returns {HTMLElement}
 */
function riesenkarte(riesenschein, stand) {
  const rechnung = Zustand.rechnungVon(riesenschein.id)
  const w = rechnung.waehrung
  const liegtIn = Ordner.ordnerVon(riesenschein)
  const empfaengt = stand.huelle?.id === riesenschein.id
  const etwasEntschieden = rechnung.einsatzEntschieden > 0.005
  const schwere = rechnung.hinweise.some((h) => h.schwere === 'fehler')
    ? 'fehler'
    : rechnung.hinweise.some((h) => h.schwere === 'warnung')
      ? 'warnung'
      : 'gut'

  const aufmachen = () => {
    Reihenfolge.merkeGeoeffnet(riesenschein.id)
    Zustand.aendere({ auswahl: riesenschein.id, scheinAuswahl: null })
  }

  const karte = el('.riesenkarte', { daten: { schwere } }, [
    el('.riesenkartekopf', {}, [
      el('.riesenkartename', { text: riesenschein.name || 'Ohne Namen' }),
      liegtIn ? el('span.ordnermarke', { text: liegtIn }) : null,
      /*
        WER NEUE FOTOS AUFNIMMT, MUSS SEHEN, WO SIE LANDEN.

        Solange ein Riesenschein neu aufgemacht ist, wandert alles Gelesene
        hinein, und die automatische Zuordnung ist dafuer abgeschaltet. Am
        16.09.2026 hat genau das drei verschiedene Wetten zu einer Position
        von 17.717,48 EUR verschmolzen. Aufgebrochen wird trotzdem nichts:
        Karam legt die Scheine selbst dorthin, und gegen seine Entscheidung
        zu gruppieren waere eine Automatik ohne Pruefstein in die
        Gegenrichtung (Projektregel 1). Gesagt werden muss es aber, und zwar
        da, wo man hinsieht (Projektregel 9).
      */
      empfaengt ? el('span.empfangsmarke', { text: 'nimmt neue Fotos auf' }) : null,
    ]),
    el('.riesenkartezahlen', {}, [
      zahlenpaar('Gesetzt', formatiere(rechnung.einsatzGesamt, w, 'de'), 'neutral'),
      zahlenpaar('Kann zurück', formatiere(rechnung.auszahlungMoeglich, w, 'de'), 'gut'),
      etwasEntschieden
        ? zahlenpaar(
            'Ergebnis',
            formatiere(rechnung.ergebnisRealisiert, w, 'de'),
            rechnung.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht'
          )
        : zahlenpaar('Im Risiko', formatiere(rechnung.imRisiko, w, 'de'), 'offen'),
    ]),
    el('.riesenkartefuss', {}, [
      el('span.riesenkartezahl', {
        text:
          `${rechnung.anzahlScheine} Schein(e) bei ${rechnung.anzahlBuchmacher} Anbieter(n)` +
          (rechnung.hinweise.length > 0 ? `, ${rechnung.hinweise.length} Anmerkung(en)` : ''),
      }),
      el('.riesenkarteknoepfe', {}, [
        el('button.knopf.knopf-klein.knopf-haupt', {
          type: 'button',
          text: 'Öffnen',
          title: `"${riesenschein.name || 'Ohne Namen'}" aufmachen`,
          onclick: (e) => {
            e.stopPropagation()
            aufmachen()
          },
        }),
        el('button.knopf.knopf-klein', {
          type: 'button',
          text: liegtIn ? 'Ordner ändern' : 'In Ordner legen',
          title: liegtIn
            ? `Liegt im Ordner "${liegtIn}". Leeren nimmt ihn wieder heraus.`
            : 'Legt diesen Riesenschein in einen Ordner. Gibt es den Namen noch nicht, entsteht der Ordner dabei.',
          onclick: (e) => {
            e.stopPropagation()
            frageNachOrdner(riesenschein, liegtIn)
          },
        }),
      ]),
    ]),
  ])

  // Die ganze Karte macht auf, so wie die Zeile in der Ablage. Die Knoepfe
  // darin halten ihren Klick selbst an, sonst oeffnete "In Ordner legen"
  // nebenbei auch noch den Riesenschein.
  karte.addEventListener('click', aufmachen)
  return karte
}

/**
 * Fragt, in welchen Ordner ein Riesenschein soll, und legt ihn hinein.
 *
 * EINE STELLE FUER BEIDE WEGE: die Karte in der Uebersicht und der Kopf des
 * offenen Riesenscheins fragen dasselbe und schreiben ueber dieselbe Funktion
 * (Projektregel 8).
 *
 * @param {import('../kern/typen.js').Riesenschein} riesenschein
 * @param {string} jetzigerOrdner
 */
function frageNachOrdner(riesenschein, jetzigerOrdner) {
  const bekannte = Ordner.alleOrdner(Zustand.hole().riesenscheine)
    .map((o) => o.name)
    .filter((n) => n !== jetzigerOrdner)

  const name = window.prompt(
    `In welchen Ordner soll "${riesenschein.name || 'Ohne Namen'}"?\n\n` +
      'Ein Ordner ist nur eine Beschriftung. Er besteht, solange ein Riesenschein ' +
      'darin liegt. Leer lassen nimmt ihn aus seinem Ordner heraus.' +
      (bekannte.length > 0 ? `\n\nSchon da: ${bekannte.join(', ')}` : ''),
    jetzigerOrdner
  )
  if (name === null) return
  Zustand.setzeOrdner(riesenschein.id, name)
}

/**
 * Der Kopf ueber allen Riesenscheinen.
 *
 * Bewusst nur DREI Zahlen. Vorher standen hier sieben, und darunter im
 * Riesenschein noch einmal acht. Fuenfzehn Zahlen auf einem Bildschirm liest
 * niemand, und was niemand liest, faellt auch nicht auf, wenn es falsch ist.
 *
 * Die drei sind die Fragen, die man wirklich hat:
 *   Wie viel ist raus?   Wie viel kann zurueckkommen?   Was steht schon fest?
 *
 * Alles Weitere steht weiterhin da, einen Klick entfernt. Nichts ist geloescht.
 *
 * @param {any} gesamt
 * @returns {HTMLElement}
 */
function projektkopf(gesamt) {
  const w = gesamt.waehrung
  /*
    EINE BILANZ VON GENAU NULL IST EINE AUSSAGE, KEIN LEERSTAND.

    Vorher stand hier Math.abs(...) > 0.005. Heben sich Gewinn und Verlust
    genau auf, ist das Ergebnis 0,00, die Bedingung faellt durch, und statt
    "ERGEBNIS 0,00" stand dort "NOCH IM RISIKO". Das ist doppelt falsch: es
    verschweigt, dass entschieden wurde, und es zeigt ein Risiko, das es nicht
    mehr gibt.

    Richtig ist die Frage, ob ueberhaupt etwas entschieden ist, und die
    beantwortet einsatzEntschieden aus kern/rechnung.js.
  */
  const etwasEntschieden = gesamt.einsatzEntschieden > 0.005

  /*
    DIESE ZEILE IST DIE SUMME DES PROJEKTS, NICHT DIE DES RIESENSCHEINS.

    Karam am 16.09.2026, nachdem er eine neue Huelle aufgemacht hatte: "wenn
    ich einen Riesenschein erstelle, dann ist wieder alles blank."

    Blank wird der RIESENSCHEIN, und das ist er auch. Diese Zeile darueber
    zaehlt aber alle Riesenscheine des Projekts zusammen und stand vorher ohne
    Kennzeichnung da. Wer eine frische, leere Huelle aufmacht und darueber
    8.036,00 liest, glaubt, sie sei nicht leer.

    Deshalb traegt jede Kachel jetzt das Wort Projekt im Namen, und die Zeile
    hat eine Ueberschrift. Verschwiegen wird nichts: die Projektsumme ist eine
    Zahl, die man sehen will, sie muss nur sagen, wovon sie die Summe ist.
  */
  return el('.projektkopf', {}, [
    el('.projektkopf-titel', {
      text: `Das ganze Projekt, ${gesamt.anzahlScheine} Schein(e) in allen Riesenscheinen zusammen`,
    }),
    kachel('Projekt: gesamt gesetzt', formatiere(gesamt.einsatzGesamt, w, 'de'), 'neutral',
      `${gesamt.anzahlScheine} Scheine bei ${gesamt.buchmacher.length} Anbietern`),
    kachel('Projekt: kann zurueckkommen', formatiere(gesamt.auszahlungMoeglich, w, 'de'), 'gut',
      'Wenn alles Offene gewinnt, einschließlich Einsatz'),
    // Solange nichts entschieden ist, waere eine Null hier nur Ablenkung.
    etwasEntschieden
      ? kachel('Projekt: Ergebnis bisher', formatiere(gesamt.ergebnisRealisiert, w, 'de'),
          gesamt.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht', 'Nur entschiedene Scheine')
      : kachel('Projekt: noch im Risiko', formatiere(gesamt.imRisiko, w, 'de'), 'offen',
          'Kann noch verloren gehen'),

    gesamt.waehrungGemischt
      ? el('.kachel.kachel-fehler', {}, [
          el('.kachelname', { text: 'Achtung' }),
          el('.kachelwert', { text: 'Währungen gemischt' }),
          el('.kachelhilfe', { text: 'Die Summen oben sind deshalb nicht aussagekräftig.' }),
        ])
      : null,
  ])
}

/**
 * @param {string} name
 * @param {string} wert
 * @param {'neutral'|'gut'|'schlecht'|'offen'} art
 * @param {string} [hilfe]
 * @returns {HTMLElement}
 */
function kachel(name, wert, art, hilfe) {
  return el('.kachel', { daten: { art } }, [
    el('.kachelname', { text: name }),
    el('.kachelwert', { text: wert }),
    hilfe ? el('.kachelhilfe', { text: hilfe, title: hilfe }) : null,
  ])
}

function einzelheit(riesenscheinId) {
  const stand = Zustand.hole()
  const riesenschein = stand.riesenscheine.find((r) => r.id === riesenscheinId)
  if (!riesenschein) return el('div')

  const scheine = Zustand.scheineVon(riesenscheinId)
  const rechnung = Zustand.rechnungVon(riesenscheinId)
  const w = rechnung.waehrung

  return el('.positionsdetail', {}, [
    // Der Kopf des Riesenscheins, neu am 16.09.2026.
    //
    // Karam: "ich moechte, dass jeder Riesenschein oben hat, eine Anzeige, zu
    // welchem Projekt der gehoert. Projekte koennen ueber Monate oder ueber
    // Jahre gehen." Und: "man hat einen Button rechts oben, den kann man
    // einfach ein Bildschirmfoto, ein Foto hinzufuegen."
    //
    // Beides steht deshalb in EINER Zeile ganz oben: links die Herkunft,
    // rechts der Weg, etwas hinzuzufuegen.
    riesenkopf(riesenschein, stand),

    // Die vier Zahlen, wegen derer man herschaut. Mehr nicht.
    //
    // Frueher standen hier acht Kacheln nebeneinander, alle gleich gross und
    // gleich laut. Bei acht gleich lauten Zahlen sucht das Auge, statt zu lesen.
    /*
      DIE DREI ZAHLEN, DIE KARAM OBEN SEHEN WILL.

      Karam am 16.09.2026: "ganz oben bei den Riesenscheinen eine Anzeige der
      Durchschnittsquote, was gesamt bis jetzt gesetzt wurde, was der
      hoechstmoegliche Gewinn ist. Bitte macht das so, dass es wirklich
      sichtbar ist."

      Vorher standen hier VIER gleich laute Kacheln, darunter die Verteilung
      (Scheine durch Anbieter). Die ist eine Auskunft, keine Zahl, wegen der
      man herschaut. Sie steht jetzt eine Zeile tiefer bei den uebrigen.

      DURCHSCHNITTSQUOTE heisst im Programm quoteEffektiv, und sie ist
      EINSATZGEWICHTET, nicht der einfache Mittelwert. Bei ungleichen
      Einsaetzen ist der Mittelwert schlicht falsch: fuenftausend zu 1,84 und
      hundert zu 3,00 ergeben im Mittel 2,42, in Wahrheit aber 1,86. Der
      Untertitel sagt das, damit die Zahl nicht missverstanden wird.

      HOECHSTMOEGLICHER GEWINN ist gewinnMoeglich, also ohne den Einsatz. Karam
      hat ausdruecklich vom Gewinn gesprochen, nicht von der Auszahlung. Die
      Auszahlung mit Einsatz steht darunter weiter da, damit beide Zahlen
      auffindbar bleiben (Projektregel 9).
    */
    el('.kachelreihe.kachelreihe-wichtig', {}, [
      kachel('Gesamt gesetzt', formatiere(rechnung.einsatzGesamt, w, 'de'), 'neutral',
        `${rechnung.anzahlScheine} Schein(e) bei ${rechnung.anzahlBuchmacher} Anbieter(n)`),
      kachel('Durchschnittsquote', formatiereQuote(rechnung.quoteEffektiv, 'dezimal', 'de'), 'neutral',
        'Einsatzgewichtet, nicht der einfache Mittelwert'),
      kachel('Hoechstmoeglicher Gewinn', formatiere(rechnung.gewinnMoeglich, w, 'de'), 'gut',
        'Ohne den Einsatz. Mit Einsatz waeren es ' + formatiere(rechnung.auszahlungMoeglich, w, 'de')),
    ]),

    // Alles Weitere ist da, aber zugeklappt. Ein <details> braucht kein
    // Stylesheet und keine Zustandsverwaltung: faellt die Designschicht weg,
    // klappt es trotzdem auf.
    el('details.mehr', {}, [
      el('summary', { text: 'Alle Zahlen und die Aufteilung' }),
      el('.kachelreihe', {}, [
        kachel('Moegliche Auszahlung', formatiere(rechnung.auszahlungMoeglich, w, 'de'), 'gut',
          'Wenn alles Offene gewinnt, einschließlich Einsatz'),
        kachel('Verteilung', `${rechnung.anzahlScheine} / ${rechnung.anzahlBuchmacher}`, 'neutral',
          'Scheine / Anbieter'),
        kachel('Noch im Risiko', formatiere(rechnung.imRisiko, w, 'de'), 'offen',
          'Der Einsatz der noch offenen Scheine'),
        kachel('Ergebnis bisher', formatiere(rechnung.ergebnisRealisiert, w, 'de'),
          rechnung.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht',
          'Nur entschiedene Scheine, auf beiden Seiten der Rechnung'),
        kachel('Konten', String(rechnung.anzahlKonten), 'neutral',
          rechnung.konten.length > 0 ? rechnung.konten.join(', ') : 'kein Konto erkannt'),
        rechnung.gratiswetteNennwert > 0
          ? kachel('Gratiswetten', formatiere(rechnung.gratiswetteNennwert, w, 'de'), 'neutral',
              'Nennwert, zählt nicht als Aufwand')
          : null,
      ]),
      band(rechnung),
      anbieterbalken(rechnung),
    ]),

    // Hinweise bleiben IMMER sichtbar, nie im Aufklapper. Eine Warnung, die
    // man erst aufklappen muss, ist keine Warnung.
    rechnung.hinweise.length > 0 ? rechnungshinweise(rechnung) : null,

    // Karams Gedaechtnis zu dieser Wette: warum sie gesetzt wurde, was beim
    // Abrechnen auffiel, worauf beim naechsten Mal zu achten ist. Ueber eine
    // ganze Saison ist das der Unterschied zwischen einer Liste von Zahlen und
    // einer Liste von Entscheidungen.
    el('.notizblock', {}, [
      el('.teiltitel', { text: 'Notiz zu diesem Riesenschein' }),
      el('textarea.notizfeld', {
        rows: '2',
        placeholder: 'Warum diese Wette, was ist aufgefallen, worauf beim nächsten Mal achten.',
        text: riesenschein.notiz ?? '',
        onchange: (e) =>
          Zustand.setzeRiesenscheinNotiz(
            riesenscheinId,
            /** @type {HTMLTextAreaElement} */ (e.target).value
          ),
      }),
    ]),

    /*
      DIE SCHEINE, AUS DENEN DER RIESENSCHEIN BESTEHT.

      Sie standen bis zum 17.09.2026 in einer eigenen Spalte rechts. Seit es
      die drei Ebenen gibt, listet die Spalte GANZ LINKS die Scheine, und eine
      zweite Auswahlliste daneben waere dieselbe Auskunft zweimal.

      Karam am 17.09.2026: "ganz links werden dann alle Scheine, die in diesem
      Riesenschein sind, angezeigt."

      Was hier steht, gibt es links NICHT: das Foto, die Zeit, die Notiz, die
      Pfeile fuer die Reihenfolge und der Knopf "nach Zeit". Links steht die
      Spur zum Springen, hier steht das Blatt.
    */
    el('.scheinbereichkopf', {}, [
      el('.spaltentitel', {
        text: scheine.length === 1 ? '1 Schein darin' : `${scheine.length} Scheine darin`,
        title: 'Die einzelnen Wettscheine, aus denen dieser Riesenschein besteht',
      }),
      /*
        HIER STEHEN KEINE FOTOKNOEPFE MEHR.

        Sie standen hier, solange die Scheinliste eine eigene Spalte rechts war
        und der Riesenschein eine eigene links: zwei Spalten, zwei Wege zum
        Foto. Seit dem 17.09.2026 steht beides untereinander in DERSELBEN
        Spalte, und dann standen dieselben drei Knoepfe zweimal auf einem
        Bildschirm, keine zwanzig Zentimeter auseinander.

        Zweimal derselbe Knopf ist keine Hilfe, sondern die Frage, ob die
        beiden dasselbe tun. Sie stehen jetzt nur noch oben rechts am
        Riesenschein, so wie Karam es am 16.09.2026 wollte: "man hat einen
        Button rechts oben, da kann man einfach ein Bildschirmfoto, ein Foto
        hinzufuegen."
      */
    ]),
    scheinliste(riesenschein, scheine),
  ])
}

/**
 * Das Band von schlimmstenfalls bis bestenfalls, mit dem heutigen Stand darin.
 *
 * @param {import('../kern/typen.js').Rechnung} rechnung
 * @returns {HTMLElement}
 */
function band(rechnung) {
  const w = rechnung.waehrung
  const unten = rechnung.schlimmstenfalls
  const oben = rechnung.bestenfalls
  const jetzt = rechnung.ergebnisRealisiert
  const spanne = oben - unten

  const nullLinie = spanne > 0 ? ((0 - unten) / spanne) * 100 : 50
  const jetztLinie = spanne > 0 ? ((jetzt - unten) / spanne) * 100 : 50

  return el('.bandbereich', {}, [
    el('.teiltitel', { text: 'Wie es ausgehen kann' }),
    el('.band', {}, [
      el('.bandflaeche', {
        stil: { '--null': `${Math.min(100, Math.max(0, nullLinie))}%` },
      }),
      el('.bandmarke.marke-jetzt', {
        stil: { '--stelle': `${Math.min(100, Math.max(0, jetztLinie))}%` },
        title: `Bereits erzielt: ${formatiere(jetzt, w, 'de')}`,
      }),
      spanne > 0 && nullLinie >= 0 && nullLinie <= 100
        ? el('.bandmarke.marke-null', {
            stil: { '--stelle': `${nullLinie}%` },
            title: 'Plus minus null',
          })
        : null,
    ]),
    el('.bandzahlen', {}, [
      el('span.bandunten', {
        daten: { art: unten >= 0 ? 'gut' : 'schlecht' },
        text: `schlimmstenfalls ${formatiere(unten, w, 'de')}`,
      }),
      el('span.bandmitte', {
        text: rechnung.imRisiko > 0 ? `bereits erzielt ${formatiere(jetzt, w, 'de')}` : 'alles entschieden',
      }),
      el('span.bandoben', {
        daten: { art: oben >= 0 ? 'gut' : 'schlecht' },
        text: `bestenfalls ${formatiere(oben, w, 'de')}`,
      }),
    ]),
  ])
}

/**
 * @param {import('../kern/typen.js').Rechnung} rechnung
 * @returns {HTMLElement}
 */
function anbieterbalken(rechnung) {
  const w = rechnung.waehrung
  const groesster = Math.max(...rechnung.proBuchmacher.map((b) => b.einsatz), 1)

  return el('.anbieterbereich', {}, [
    el('.teiltitel', { text: 'Wo gesetzt wurde' }),
    el(
      '.anbieterliste',
      {},
      rechnung.proBuchmacher.map((b) =>
        el('.anbieterzeile', {}, [
          el('.anbietername', { title: b.konten.join(', ') }, [
            anbieterzeichen(b.buchmacher),
            el('span', { text: b.buchmacher }),
          ]),
          el('.anbieterbalken', {}, [
            el('.balkenfuellung', { stil: { '--breite': `${(b.einsatz / groesster) * 100}%` } }),
          ]),
          el('.anbieterzahl', { text: formatiere(b.einsatz, w, 'de') }),
          el('.anbieteranteil', { text: `${(b.anteil * 100).toFixed(1)} %` }),
          el('.anbieterzahl.zahl-leise', { text: `${b.anzahl}x` }),
          el('.anbieterzahl.zahl-leise', {
            text: formatiereQuote(b.quoteSchnitt, 'dezimal', 'de'),
            title: 'Schnittquote bei diesem Anbieter',
          }),
          b.konten.length > 0
            ? el('.anbieterkonten', { text: b.konten.join(', '), title: b.konten.join(', ') })
            : null,
        ])
      )
    ),
  ])
}

/**
 * @param {import('../kern/typen.js').Rechnung} rechnung
 * @returns {HTMLElement}
 */
function rechnungshinweise(rechnung) {
  const schlimmste = rechnung.hinweise.some((h) => h.schwere === 'fehler') ? 'fehler' : 'warnung'
  return el('.hinweisblock', { daten: { schwere: schlimmste } }, [
    el('.blocktitel', { text: 'Zu dieser Rechnung' }),
    el(
      'ul.blockliste',
      {},
      rechnung.hinweise.map((h) =>
        el('li', { daten: { schwere: h.schwere } }, [
          el('span.hinweisart', { text: h.schwere }),
          el('span.hinweistext', { text: h.text }),
        ])
      )
    ),
  ])
}

/**
 * Die Scheine des Riesenscheins, in der Reihenfolge, die auf dem Blatt erscheint.
 *
 * @param {import('../kern/typen.js').Riesenschein} riesenschein
 * @param {import('../kern/typen.js').Schein[]} scheine
 * @returns {HTMLElement}
 */
function scheinliste(riesenschein, scheine) {
  /*
    DIE REIHENFOLGE HAT JETZT EINE BEDEUTUNG.

    Karam am 16.09.2026: "da rechts einfach alle Minischeine, alle Kombis, mit
    Anbieter und Einsatz, und das muss immer eine Reihenfolge geben, wann er
    was gesetzt hat."

    Die gespeicherte Reihenfolge (riesenschein.scheinIds) bleibt die Wahrheit:
    sie bestimmt, wie das Blatt und die Excel-Mappe aussehen, und sie gehoert
    Karam. Der Knopf unten sortiert sie nach dem Zeitpunkt, an dem gesetzt
    wurde, und ruft dafuer dasselbe setzeReihenfolge auf, das auch die Pfeile
    benutzen. Es wird also nichts neu gerechnet und nichts nebenher sortiert.

    Scheine ohne Zeitpunkt wandern ans Ende statt an den Anfang: sonst stuende
    das Unbekannte vor dem Bekannten, und das liest sich wie eine Aussage.
  */
  const mitZeit = scheine.filter((s) => s.gesetztAm.wert).length

  return el('.scheinbereich', {}, [
    el('.scheinbereichkopf', {}, [
      el('.teiltitel', { text: 'In der Reihenfolge des Blattes' }),
      mitZeit > 1
        ? el('button.knopf.knopf-winzig', {
            type: 'button',
            text: 'nach Zeit',
            title:
              `Nach dem Zeitpunkt sortieren, an dem gesetzt wurde. ` +
              `Bei ${scheine.length - mitZeit} Schein(en) steht keiner auf dem Bild, ` +
              'die wandern ans Ende.',
            onclick: () => {
              const sortiert = [...scheine].sort((a, b) => {
                const za = a.gesetztAm.wert ?? ''
                const zb = b.gesetztAm.wert ?? ''
                if (za === zb) return 0
                if (!za) return 1
                if (!zb) return -1
                return za < zb ? -1 : 1
              })
              Zustand.setzeReihenfolge(riesenschein.id, sortiert.map((s) => s.id))
            },
          })
        : null,
    ]),
    el(
      '.scheinreihe',
      {},
      scheine.map((schein, i) => {
        const w = schein.waehrung.wert ?? 'UNBEKANNT'
        const rueckfluss = realisierterRueckfluss(schein)

        // Der moegliche Gewinn, aus dem Kern geholt und nicht hier gerechnet.
        const potenzial = offenePotenzialauszahlung(schein)
        const einsatzBar = barEinsatz(schein)
        const moeglicherGewinn =
          potenzial.bekannt && potenzial.wert !== null ? potenzial.wert - einsatzBar : null

        // Das Foto, aus dem dieser Schein gelesen wurde.
        const bild = Zustand.hole().bilder.get(schein.bildId)

        return el('.scheinkaertchen', { daten: { status: schein.status } }, [
          el('.kaertchennummer', { text: String(i + 1) }),
          el('.kaertcheninhalt', {}, [
            el('.kaertchenanbieter', {}, [
              anbieterzeichen(schein.buchmacher.wert),
              el('span', { text: schein.buchmacher.wert ?? 'Anbieter offen' }),
            ]),
            schein.konto.wert ? el('.kaertchenkonto', { text: schein.konto.wert }) : null,

            /*
              DAS FOTO IST IMMER DABEI.

              Karam am 16.09.2026: "wenn man die separat aufmacht, moechte ich,
              dass da immer ein Foto dabei ist, das Foto immer angezeigt wird."

              Gezeigt wird genau der Ausschnitt, aus dem gelesen wurde, nicht
              das ganze Bildschirmfoto. Wer eine Zahl nachsehen will, will
              diese Karte sehen und nicht sechzig.

              Nach einem Neuladen sind die Bilder unter Umstaenden nicht mehr
              da, sie liegen auf dem Geraet. Dann bleibt ein leerer Rahmen
              stehen statt zu verschwinden: er sagt, dass hier ein Bild
              hingehoert.
            */
            el('.kaertchenfoto', {}, [ausschnittbild(bild, schein.ausschnitt)]),

            // Wann gesetzt wurde. Steht es nicht auf dem Bild, steht hier
            // auch nichts: eine erfundene Zeit waere schlimmer als keine.
            schein.gesetztAm.wert
              ? el('.kaertchenzeit', {
                  text: zeitText(schein.gesetztAm.wert),
                  title: 'Zeitpunkt, an dem gesetzt wurde, so wie er auf dem Schein steht',
                })
              : el('.kaertchenzeit.kaertchenzeit-leer', {
                  text: 'ohne Zeit',
                  title: 'Auf diesem Schein steht kein Zeitpunkt.',
                }),

            /*
              DREI ZAHLEN JE SCHEIN, nicht zwei.

              Karam am 16.09.2026: "bei der kleinen Anzeige von jedem einzelnen
              Schein bei den Riesenscheinen immer Einsatz, moegliche Gewinn und
              Multiplikator."

              Der moegliche Gewinn kommt aus offenePotenzialauszahlung in
              kern/rechnung.js, minus dem Einsatz. Er wird hier NICHT aus Quote
              mal Einsatz gebaut: das ginge bei einer Gratiswette und bei einer
              Each-Way-Wette daneben, und die Fallunterscheidung dafuer steht
              schon im Kern (Projektregel 8).

              Steht keine Quote auf dem Schein, bleibt die Stelle leer statt
              null zu zeigen. Eine Null waere eine Aussage, und zwar eine
              falsche.
            */
            el('.kaertchenzahlen', {}, [
              zahlenpaar('Einsatz', formatiere(barEinsatz(schein), w, 'de'), 'neutral'),
              zahlenpaar(
                'Gewinn',
                moeglicherGewinn === null ? '-' : formatiere(moeglicherGewinn, w, 'de'),
                moeglicherGewinn === null ? 'neutral' : 'gut'
              ),
              zahlenpaar(
                'Multiplikator',
                formatiereQuote(schein.quoteDezimal.wert, 'dezimal', 'de'),
                'neutral'
              ),
            ]),
            el('.kaertchenstatus', { text: statusText(schein.status) }),
            rueckfluss.bekannt && rueckfluss.wert !== null
              ? el('.kaertchenrueckfluss', { text: `zurueck ${formatiere(rueckfluss.wert, w, 'de')}` })
              : null,

            /*
              NOTIZ AN JEDEM EINZELNEN SCHEIN.

              Karam am 16.09.2026: "man kann auch zu jeder Kombi eine Notiz
              hinzufuegen."

              Es gibt sie schon, aber nur im Reiter Scheine, aufgeklappt unter
              "mehr". Wer hier auf den Riesenschein sieht, wollte deshalb bisher
              woanders hin, um eine Zeile dazuzuschreiben.

              Dasselbe Feld, derselbe setzeScheinNotiz. Zugeklappt, damit
              sechzig leere Felder nicht die Spalte fuellen, und offen, sobald
              etwas drinsteht.
            */
            el('details.kaertchennotiz', { open: schein.notiz ? 'open' : null }, [
              el('summary', { text: schein.notiz ? 'Notiz' : 'Notiz hinzufügen' }),
              el('textarea.notizfeld.notizfeld-klein', {
                rows: '2',
                placeholder: 'Warum dieser Schein, was ist aufgefallen',
                text: schein.notiz ?? '',
                onchange: (e) =>
                  Zustand.setzeScheinNotiz(
                    schein.id,
                    /** @type {HTMLTextAreaElement} */ (e.target).value
                  ),
              }),
            ]),
          ]),
          el('.kaertchenknoepfe', {}, [
            i > 0
              ? el('button.knopf.knopf-winzig', {
                  type: 'button',
                  text: '<',
                  title: 'nach vorne',
                  onclick: () => {
                    const reihe = [...riesenschein.scheinIds]
                    const [weg] = reihe.splice(i, 1)
                    if (weg) reihe.splice(i - 1, 0, weg)
                    Zustand.setzeReihenfolge(riesenschein.id, reihe)
                  },
                })
              : null,
            i < scheine.length - 1
              ? el('button.knopf.knopf-winzig', {
                  type: 'button',
                  text: '>',
                  title: 'nach hinten',
                  onclick: () => {
                    const reihe = [...riesenschein.scheinIds]
                    const [weg] = reihe.splice(i, 1)
                    if (weg) reihe.splice(i + 1, 0, weg)
                    Zustand.setzeReihenfolge(riesenschein.id, reihe)
                  },
                })
              : null,
          ]),
        ])
      })
    ),
  ])
}

/**
 * Die Zeile ganz oben am Riesenschein: woher er kommt und was man mit ihm tun
 * kann.
 *
 * WOHER DIE PROJEKTANGABE KOMMT: aus stand.projekt, also aus dem Projekt, das
 * gerade offen ist. Alle Riesenscheine im Arbeitsstand gehoeren zu diesem
 * einen Projekt; es gibt keine zweite Zuordnung, die hier gelesen oder
 * geschrieben wuerde.
 *
 * @param {import('../kern/typen.js').Riesenschein} riesenschein
 * @param {any} stand
 * @returns {HTMLElement}
 */
function riesenkopf(riesenschein, stand) {
  const p = stand.projekt
  const von = p?.angelegtAm ? zeitText(p.angelegtAm) : ''
  const bis = p?.geaendertAm ? zeitText(p.geaendertAm) : ''
  // Eine Spanne nur dann, wenn es wirklich zwei Tage sind. Sonst stuende dort
  // "16.09.2026 bis 16.09.2026", und das sagt weniger als ein Datum.
  const spanne = von && bis && von.slice(0, 10) !== bis.slice(0, 10) ? `${von} bis ${bis}` : von || bis

  const angeheftet = istAngeheftet(riesenschein.id)

  return el('.riesenkopf', {}, [
    el('.riesenkopf-links', {}, [
      el('.riesenkopf-projekt', {}, [
        el('span', { text: 'Projekt' }),
        el('span', { text: p?.name || 'ohne Projekt' }),
        spanne ? el('span.riesenkopf-zeit', { text: spanne }) : null,
      ]),
      /*
        DER NAME STEHT HIER UND IST AENDERBAR.

        Karam am 16.09.2026: "den aktuellen Riesenschein, den man gerade anhat,
        das soll auch angezeigt werden, welcher Schein das ist. Man kann ihn
        auch immer benennen."

        Das Feld stand vorher weiter unten in einer eigenen Zeile, unter den
        Kacheln. Jetzt steht es ganz oben und gross, direkt unter der Herkunft:
        WO bin ich, und WELCHER ist es. Das sind die beiden Fragen, die man beim
        Aufmachen hat.

        Ein Eingabefeld und keine Ueberschrift mit Stift daneben: man sieht
        sofort, dass man hineinschreiben darf, und braucht keinen Klick vorher.
      */
      el('input.riesenkopf-name', {
        type: 'text',
        value: riesenschein.name,
        placeholder: 'Diesem Riesenschein einen Namen geben',
        'aria-label': 'Name des Riesenscheins',
        title: 'Hineinschreiben benennt den Riesenschein um.',
        onchange: (e) =>
          Zustand.benenneUm(riesenschein.id, /** @type {HTMLInputElement} */ (e.target).value),
      }),
      el('.riesenkopf-zahl', {
        text: `${riesenschein.scheinIds.length === 1 ? '1 Schein' : `${riesenschein.scheinIds.length} Scheine`} darin`,
      }),

      ordnerfeld(riesenschein, stand),
    ]),

    /*
      DER AUSGANG, von Hand gesetzt.

      Karam am 16.09.2026: "am Ende des Tages kann man bei jedem Riesenschein
      einfach hinzufuegen, ob man das gewonnen oder verloren hat. Wenn man es
      gewonnen hat, tut sich der gesamtmoegliche Gewinn zur Balance addieren.
      Wenn man es verliert, ist das, was man eingesetzt hat, einfach verloren.
      Dann kommt auch nichts mehr drauf."

      Genau so verhaelt es sich, und zwar OHNE dass hier etwas gerechnet wird.
      Gesetzt wird nur der Stand jedes Scheins; was daraus an Geld folgt, macht
      kern/rechnung.js wie bisher. Ein zweiter Rechenweg an dieser Stelle waere
      der Anfang vom Auseinanderlaufen (Projektregel 8).

      Warum mit Rueckfrage: es geht um vierstellige Betraege, und ein Klick
      daneben schiebt sie in die Bilanz oder heraus. Die Rueckfrage nennt
      deshalb die Zahl, um die es geht, nicht nur die Anzahl der Scheine.

      Warum ein dritter Knopf "wieder offen": ein Fehlklick muss zurueckzunehmen
      sein, ohne dass man sechzig Scheine einzeln anfasst.
    */
    el('.riesenkopf-ausgang', {}, [
      ausgangsknopf(riesenschein, 'gewonnen'),
      ausgangsknopf(riesenschein, 'verloren'),
      ausgangsknopf(riesenschein, 'offen'),
    ]),

    el('.riesenkopf-rechts', {}, [
      /*
        WOHIN NEUE FOTOS GEHEN, MUSS AM RIESENSCHEIN STEHEN.

        Solange dieser Riesenschein der zuletzt aufgemachte ist, wandert jedes
        neu gelesene Bild hinein, und die automatische Zuordnung ist dafuer
        abgeschaltet (zustand.js, fuegeScheineHinzu). Am 16.09.2026 hat genau
        das drei verschiedene Wetten zu einer Position von 17.717,48 EUR
        verschmolzen, ohne dass es irgendwo stand.

        Karam am 17.09.2026: "keine Huelle schliessen, nichts." Der frueher
        hier stehende Streifen mit dem Knopf "Huelle schliessen" ist deshalb
        weg. Geblieben ist die Auskunft, und ein Weg, sie abzustellen: wer
        gemischte Wetten hochlaedt, soll die automatische Zuordnung wieder
        einschalten koennen, ohne erst einen zweiten Riesenschein anzulegen.
      */
      stand.huelle?.id === riesenschein.id
        ? el('.empfangsleiste', {}, [
            el('span.empfangsmarke', { text: 'nimmt neue Fotos auf' }),
            el('button.knopf.knopf-winzig', {
              type: 'button',
              text: 'nicht mehr',
              title:
                'Neue Scheine werden danach wieder automatisch zugeordnet, ' +
                'also nach der Wette, die auf ihnen steht. Was schon drin ist, bleibt drin.',
              onclick: () => Zustand.schliesseHuelle(),
            }),
          ])
        : null,
      // Die Nadel legt den Riesenschein ins Panel links. Von dort ist er aus
      // jeder Ansicht einen Klick entfernt.
      el('button.knopf.knopf-klein.riesennadel', {
        type: 'button',
        daten: { an: String(angeheftet) },
        text: angeheftet ? 'Angeheftet' : 'Anheften',
        title: angeheftet
          ? 'Steht im Panel links. Klicken nimmt ihn wieder heraus.'
          : 'Legt diesen Riesenschein ins Panel links, dann ist er von überall aus einen Klick entfernt.',
        onclick: () => heftAn(riesenschein.id),
      }),
      // Derselbe Weg wie im Reiter Aufnahme, aus fotoknoepfe.js. Ein Foto
      // hier wird genauso gelesen wie eines dort, und der gelesene Schein
      // taucht unten in der Liste auf.
      fotoknoepfe({ kompakt: true, titel: 'Foto hinzufuegen' }),
    ]),
  ])
}

/**
 * In welchem Ordner dieser Riesenschein liegt.
 *
 * Karam am 17.09.2026: "in einem Ordner sind Riesenscheine drinnen", und "der
 * geht einfach in den Ordner rein".
 *
 * EIN TEXTFELD MIT VORSCHLAEGEN und keine Liste zum Auswaehlen: ein Ordner
 * entsteht dadurch, dass man einen Namen hineinschreibt, und verschwindet,
 * sobald nichts mehr darin liegt. Eine Liste haette eine zweite Verwaltung
 * gebraucht, in der Ordner auch leer bestehen bleiben, und das waere eine
 * zweite Wahrheit ueber dieselbe Sache (Projektregel 8).
 *
 * Wer das Feld leert, nimmt den Riesenschein aus dem Ordner heraus. Der
 * Riesenschein selbst wird dabei nicht angeruehrt.
 *
 * @param {import('../kern/typen.js').Riesenschein} riesenschein
 * @param {any} stand
 * @returns {HTMLElement}
 */
function ordnerfeld(riesenschein, stand) {
  const jetzigerOrdner = Ordner.ordnerVon(riesenschein)
  const bekannte = Ordner.alleOrdner(stand.riesenscheine)
  const listenId = `ordnerliste-${riesenschein.id}`

  return el('label.riesenkopf-ordner', {}, [
    el('span.riesenkopf-ordnerwort', { text: 'Ordner' }),
    el('input.riesenkopf-ordnerfeld', {
      type: 'text',
      value: jetzigerOrdner,
      list: listenId,
      placeholder: 'in keinem Ordner',
      title:
        'Schreib einen Namen hinein, dann liegt dieser Riesenschein in dem Ordner. ' +
        'Gibt es den Namen noch nicht, entsteht der Ordner dabei. Leeren nimmt ihn wieder heraus.',
      // Geschrieben wird ueber zustand.js, dort wo auch Name und Notiz
      // geschrieben werden. Der Ordner steht am Riesenschein und wandert mit
      // ihm in die Datenbank (Projektregel 8).
      onchange: (e) =>
        Zustand.setzeOrdner(riesenschein.id, /** @type {HTMLInputElement} */ (e.target).value),
    }),
    el(
      'datalist',
      { id: listenId },
      bekannte.map((o) => el('option', { value: o.name }))
    ),
  ])
}

/**
 * Ein Knopf, der den Ausgang des ganzen Riesenscheins setzt.
 *
 * @param {import('../kern/typen.js').Riesenschein} riesenschein
 * @param {'gewonnen'|'verloren'|'offen'} ausgang
 * @returns {HTMLElement}
 */
function ausgangsknopf(riesenschein, ausgang) {
  const scheine = Zustand.scheineVon(riesenschein.id)
  const rechnung = Zustand.rechnungVon(riesenschein.id)
  const w = rechnung.waehrung

  // Alle schon auf diesem Stand: dann ist der Knopf der aktuelle Zustand und
  // nicht mehr eine Aufforderung.
  const alleSo = scheine.length > 0 && scheine.every((s) => s.status === ausgang)

  const beschriftung = { gewonnen: 'Gewonnen', verloren: 'Verloren', offen: 'Wieder offen' }[ausgang]

  /*
    WAS DER KLICK BEDEUTET, IN GELD.

    HIER STAND EIN FEHLER, gefunden am 16.09.2026 wenige Stunden nachdem ich
    ihn gebaut hatte. Es stand rechnung.auszahlungMoeglich da, und das ist
    NICHT, was nach dem Klick herauskommt.

    auszahlungMoeglich zaehlt, was aus den NOCH OFFENEN Scheinen kommen kann,
    plus das schon Realisierte. Ein Schein, der bereits auf verloren steht,
    steuert null bei. Der Klick setzt aber ALLE auf gewonnen, auch diesen, und
    dann zahlt er eben doch.

    Nachgerechnet an einem Riesenschein aus einem verlorenen Schein zu 500 und
    einem offenen zu 500 bei Quote 1,8:

      versprochen war          900,00
      zurueck kamen         1.800,00
      Abweichung              900,00, also das Doppelte

    Das ist genau die Zahl, nach der Karam entscheidet. Richtig ist die Summe
    ueber ALLE Scheine so, als waeren sie offen, und die liefert
    offenePotenzialauszahlung aus kern/rechnung.js. Gerechnet wird also
    weiterhin im Kern, hier wird nur zusammengezaehlt (Projektregel 8).

    Bei "verloren" war einsatzGesamt von Anfang an richtig: der tatsaechliche
    Geldaufwand haengt nicht am Stand.
  */
  const alsWaerenAlleOffen = scheine.reduce((summe, sch) => {
    const moeglich = offenePotenzialauszahlung({ ...sch, status: 'offen' })
    return summe + (moeglich.wert ?? 0)
  }, 0)

  const folge = {
    gewonnen: `${formatiere(alsWaerenAlleOffen, w, 'de')} kommen zurueck`,
    verloren: `${formatiere(rechnung.einsatzGesamt, w, 'de')} sind verloren, es kommt nichts zurueck`,
    offen: 'zaehlt wieder als noch nicht entschieden',
  }[ausgang]

  return el('button.knopf.knopf-klein.ausgangsknopf', {
    type: 'button',
    daten: { ausgang, an: String(alleSo) },
    text: beschriftung,
    disabled: alleSo ? 'disabled' : null,
    title: alleSo
      ? `Alle ${scheine.length} Scheine stehen bereits auf "${beschriftung}".`
      : `Setzt alle ${scheine.length} Scheine auf "${beschriftung}": ${folge}.`,
    onclick: () => {
      const frage =
        `"${riesenschein.name || 'Ohne Namen'}" auf ${beschriftung} setzen?\n\n` +
        `Das gilt fuer alle ${scheine.length} Scheine darin.\n` +
        `Danach: ${folge}.`
      if (!confirm(frage)) return
      const anzahl = Zustand.setzeAusgangFuerRiesenschein(riesenschein.id, ausgang)
      Zustand.melde('erfolg', `${anzahl} Schein(e) auf ${beschriftung} gesetzt.`)
    },
  })
}

/**
 * Ein beschriftetes Zahlenpaar im Kaertchen: Wort oben, Zahl darunter.
 *
 * Drei nackte Zahlen nebeneinander liest niemand richtig, weil man raten muss,
 * welche welche ist. Mit Beschriftung sind es drei Angaben statt drei Zahlen.
 *
 * @param {string} name
 * @param {string} wert
 * @param {string} art
 * @returns {HTMLElement}
 */
function zahlenpaar(name, wert, art) {
  return el('.kaertchenpaar', { daten: { art } }, [
    el('span.kaertchenwort', { text: name }),
    el('span.kaertchenzahl', { text: wert }),
  ])
}

/**
 * EBENE 3: ein einzelner Schein, gross und aenderbar.
 *
 * Karam am 17.09.2026: "kann man sie dann separat aufmachen, und dann sieht
 * man im grossen Bereich, welche Einsaetze man hat, da kann man die auch
 * bearbeiten."
 *
 * DIE FELDER KOMMEN AUS oberflaeche/scheinfelder.js, also aus derselben Quelle
 * wie die Tabelle im Reiter Scheine. Eine zweite Abschrift waere eine zweite
 * Stelle, an der sich das Lesen einer Zahl anders verhaelt, und genau daran
 * ist am 16.09.2026 aus "5000.00" schon einmal 500000 geworden
 * (Projektregel 8).
 *
 * GERECHNET WIRD HIER NICHTS. Aufwand, moeglicher Gewinn und Rueckfluss kommen
 * aus kern/rechnung.js.
 *
 * @param {string} riesenscheinId
 * @param {string} scheinId
 * @param {import('../kern/typen.js').Schein[]} alle
 * @returns {HTMLElement}
 */
function einzelschein(riesenscheinId, scheinId, alle) {
  const stand = Zustand.hole()
  const riesenschein = stand.riesenscheine.find((r) => r.id === riesenscheinId)
  const schein = alle.find((s) => s.id === scheinId)
  if (!riesenschein || !schein) return el('div')

  const platz = alle.indexOf(schein)
  const w = schein.waehrung.wert ?? 'UNBEKANNT'
  const rueckfluss = realisierterRueckfluss(schein)
  const potenzial = offenePotenzialauszahlung(schein)
  const einsatzBar = barEinsatz(schein)
  const moeglicherGewinn =
    potenzial.bekannt && potenzial.wert !== null ? potenzial.wert - einsatzBar : null
  const bild = stand.bilder.get(schein.bildId)

  /**
   * Eine beschriftete Zeile im Formular.
   *
   * @param {string} name
   * @param {HTMLElement} feld
   * @param {string} [hilfe]
   * @returns {HTMLElement}
   */
  const feldzeile = (name, feld, hilfe) =>
    el('label.formularzeile', {}, [
      el('span.formularname', { text: name, title: hilfe ?? '' }),
      feld,
      hilfe ? el('span.formularhilfe', { text: hilfe }) : null,
    ])

  /**
   * Einen anderen Schein desselben Riesenscheins aufmachen.
   *
   * @param {number} schritt
   * @returns {HTMLElement|null}
   */
  const nachbarknopf = (schritt) => {
    const ziel = alle[platz + schritt]
    if (!ziel) return null
    return el('button.knopf.knopf-klein', {
      type: 'button',
      text: schritt < 0 ? '< voriger Schein' : 'nächster Schein >',
      title: `Schein ${platz + schritt + 1} von ${alle.length} aufmachen`,
      onclick: () => Zustand.aendere({ scheinAuswahl: ziel.id }),
    })
  }

  return el('.scheingross', {}, [
    /*
      ZWEI WEGE ZURUECK, und beide stehen oben.

      Von einem einzelnen Schein will man entweder zu seinem Riesenschein oder
      gleich zur Uebersicht. Beides steht da: wer den Weg raten muss, klickt
      irgendwohin und findet sich woanders wieder.
    */
    el('.zurueckleiste', {}, [
      el('button.knopf.knopf-klein.zurueckknopf', {
        type: 'button',
        text: `< ${riesenschein.name || 'Riesenschein'}`,
        title: 'Zurueck zum ganzen Riesenschein',
        onclick: () => Zustand.aendere({ scheinAuswahl: null }),
      }),
      el('button.knopf.knopf-klein', {
        type: 'button',
        text: '<< Alle Riesenscheine',
        title: 'Zurueck zur Uebersicht',
        onclick: () => Zustand.aendere({ auswahl: null, scheinAuswahl: null }),
      }),
      el('span.zurueckstand', { text: `Schein ${platz + 1} von ${alle.length}` }),
    ]),

    el('.scheingrosskopf', { daten: { status: schein.status } }, [
      anbieterzeichen(schein.buchmacher.wert),
      el('.scheingrossname', {}, [
        el('strong', { text: schein.buchmacher.wert ?? 'Anbieter offen' }),
        el('span', { text: schein.scheinNr.wert ? `Nr. ${schein.scheinNr.wert}` : 'ohne Nummer' }),
      ]),
      el('span.scheingrossstatus', { text: statusText(schein.status) }),
    ]),

    /*
      DIE DREI ZAHLEN, DIE KARAM AM SCHEIN SEHEN WILL.

      Karam am 16.09.2026: "bei der kleinen Anzeige von jedem einzelnen Schein
      bei den Riesenscheinen immer Einsatz, moeglicher Gewinn und
      Multiplikator." Dasselbe gilt gross.

      Steht keine Quote auf dem Schein, bleibt die Stelle leer statt null zu
      zeigen. Eine Null waere eine Aussage, und zwar eine falsche
      (Projektregel 1).
    */
    el('.kachelreihe.kachelreihe-wichtig', {}, [
      kachel('Einsatz', formatiere(einsatzBar, w, 'de'), 'neutral',
        schein.gratiswette
          ? 'Gratiswette: kein eigenes Geld im Spiel'
          : schein.eachWay
            ? 'Each Way: der Einsatz wird doppelt abgebucht'
            : 'Tatsächlicher Geldaufwand'),
      kachel('Möglicher Gewinn',
        moeglicherGewinn === null ? '-' : formatiere(moeglicherGewinn, w, 'de'),
        moeglicherGewinn === null ? 'neutral' : 'gut',
        'Ohne den Einsatz'),
      kachel('Multiplikator', formatiereQuote(schein.quoteDezimal.wert, 'dezimal', 'de'), 'neutral',
        'Die Quote, wie sie auf dem Schein steht'),
    ]),

    el('.formularblock', {}, [
      el('.teiltitel', { text: 'Was auf dem Schein steht' }),
      el('.formulargitter', {}, [
        feldzeile('Anbieter', textfeld(schein, 'buchmacher', 'Anbieter', '.formularwert')),
        feldzeile('Konto', textfeld(schein, 'konto', 'Konto', '.formularwert')),
        feldzeile('Schein-Nummer', textfeld(schein, 'scheinNr', 'Nummer', '.formularwert')),
        feldzeile('Gesetzt am', zeitfeld(schein, '.formularwert'), 'Leer lassen, wenn nichts draufsteht'),
        feldzeile('Ausgang', statuswahl(schein, '.formularwert')),
        feldzeile('Einsatz', zahlfeld(schein, 'einsatz', w, '.formularwert')),
        feldzeile('Quote', quotenfeld(schein, '.formularwert')),
        feldzeile('Auszahlung', zahlfeld(schein, 'auszahlung', w, '.formularwert'),
          'Einsatz mal Quote, so wie der Anbieter sie anzeigt'),
        feldzeile('Tatsächlich ausgezahlt', zahlfeld(schein, 'ausgezahlt', w, '.formularwert'),
          'Erst eintragen, wenn abgerechnet wurde'),
      ]),
      el('.formularschalter', {}, [
        schalter(schein, 'gratiswette', 'Gratiswette (kein eigenes Geld)'),
        schalter(schein, 'eachWay', 'Each Way (doppelter Einsatz)'),
        schalter(schein, 'ausgeschlossen', 'Ganz aus der Rechnung nehmen'),
      ]),
      rueckfluss.bekannt && rueckfluss.wert !== null
        ? el('p.formularzurueck', {
            text: `Zurückgekommen: ${formatiere(rueckfluss.wert, w, 'de')}`,
          })
        : null,
    ]),

    // Die Beine der Kombination. Nur Anzeige: was der Schein sagt, sagt er.
    schein.auswahlen.length > 0
      ? el('.formularblock', {}, [
          el('.teiltitel', {
            text: schein.auswahlen.length === 1 ? '1 Auswahl' : `${schein.auswahlen.length} Auswahlen`,
          }),
          el(
            'ul.beinliste',
            {},
            schein.auswahlen.map((a) =>
              el('li', {}, [
                el('strong', { text: a.tipp.wert ?? 'Tipp nicht gelesen' }),
                a.ereignis.wert ? el('span', { text: a.ereignis.wert }) : null,
                a.markt.wert ? el('span', { text: a.markt.wert }) : null,
                a.quoteDezimal.wert !== null
                  ? el('span.beinquote', {
                      text: formatiereQuote(a.quoteDezimal.wert, 'dezimal', 'de'),
                    })
                  : null,
              ])
            )
          ),
        ])
      : null,

    // Anmerkungen bleiben IMMER sichtbar, nie im Aufklapper. Eine Warnung, die
    // man erst aufklappen muss, ist keine Warnung.
    schein.hinweise.length > 0
      ? el('.formularblock', {}, [
          el('.teiltitel', { text: 'Anmerkungen zu diesem Schein' }),
          el(
            'ul.blockliste',
            {},
            schein.hinweise.map((h) => el('li', { daten: { schwere: h.schwere }, text: h.text }))
          ),
        ])
      : null,

    el('.formularblock', {}, [
      el('.teiltitel', { text: 'Notiz zu diesem Schein' }),
      el('textarea.notizfeld', {
        rows: '3',
        placeholder: 'Warum dieser Schein, was ist aufgefallen',
        text: schein.notiz ?? '',
        onchange: (e) =>
          Zustand.setzeScheinNotiz(schein.id, /** @type {HTMLTextAreaElement} */ (e.target).value),
      }),
    ]),

    /*
      DAS FOTO IST IMMER DABEI.

      Karam am 16.09.2026: "wenn man die separat aufmacht, moechte ich, dass da
      immer ein Foto dabei ist, das Foto immer angezeigt wird."

      Gezeigt wird genau der Ausschnitt, aus dem gelesen wurde. Nach einem
      Neuladen sind die Bilder unter Umstaenden nicht mehr da, sie liegen auf
      dem Geraet. Dann bleibt ein leerer Rahmen stehen statt zu verschwinden:
      er sagt, dass hier ein Bild hingehoert.
    */
    el('.formularblock', {}, [
      el('.teiltitel', { text: 'Der Ausschnitt, aus dem gelesen wurde' }),
      el('.scheingrossfoto', {}, [ausschnittbild(bild, schein.ausschnitt)]),
    ]),

    el('.scheingrossfuss', {}, [nachbarknopf(-1), nachbarknopf(1)]),
  ])
}
