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
import { durchsucheBestand } from '../kern/suche.js'
import * as Zustand from './zustand.js'
import * as Reihenfolge from './reihenfolge.js'
import { fotoknoepfe } from './fotoknoepfe.js'
import { bestandAusStand, holeFerneBestaende } from './suchdienst.js'
import { stufenzeichen } from './aufbau.js'

/**
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  const stand = Zustand.hole()
  const rechnungen = stand.riesenscheine.map((r) => Zustand.rechnungVon(r.id))
  const gesamt = rechneProjekt(rechnungen)

  /*
    DIE SUCHE BEHAELT DEN SCHREIBFOKUS.

    Jeder Tastendruck baut diese Ansicht neu, und ein neues Eingabefeld hat
    keinen Fokus mehr. Ohne die zwei Zeilen unten koennte man genau ein
    Zeichen tippen. Dasselbe Muster wie bei der Uebersichtssuche der
    Riesenscheine (ansicht_positionen.js).
  */
  const hatteFokus =
    document.activeElement instanceof HTMLElement &&
    document.activeElement.classList.contains('startsuche')

  fuelle(ziel, [
    projektkopfzeile(stand),
    suchmaschine(stand),
    stand.riesenscheine.length === 0 ? erstesMal() : null,
    stand.riesenscheine.length > 0 ? grossezahlen(gesamt) : null,
    stand.riesenscheine.length > 0 ? wettenliste(stand, rechnungen) : null,
    naechsteSchritte(stand),
  ])

  if (hatteFokus) {
    const feld = ziel.querySelector('.startsuche')
    if (feld instanceof HTMLInputElement) {
      feld.focus()
      feld.setSelectionRange(feld.value.length, feld.value.length)
    }
  }
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
      el('span.projektfahne-name', { text: 'Noch kein Projekt geöffnet' }),
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

/*
  ---------------------------------------------------------------------------
  DIE GROSSE SUCHE.

  Karam am 19.09.2026: "wenn ich bei einer Uebersicht bin, moechte ich, dass
  die Uebersicht noch da ist, das Projekt da ist, aber da noch eine
  Suchleiste. Da kann ich nach Quoten, nach Datum, nach Name, nach Emoji
  suchen, nach den Scheinen und nach den Ordnern. Ganz rechts kann ich mir
  den Ordner und das Projekt aussuchen, oder ich suche ohne Ordner und ohne
  Projekt: er sucht im ganzen Programm."

  WIE DIE TEILE ZUSAMMENSPIELEN: Getippt wird live gegen das, was da ist,
  also immer gegen das offene Projekt und, sobald einmal geladen, gegen den
  Schnappschuss der fremden Projekte. Geladen wird NUR auf Knopfdruck, denn
  jedes fremde Projekt ist ein Gang zur Datenbank, und der soll sichtbar
  sein statt bei jedem Buchstaben heimlich zu passieren. Verglichen wird in
  kern/suche.js, beschafft in suchdienst.js; hier wird nur gezeichnet.
  ---------------------------------------------------------------------------
*/

/** Der Schluessel eines Suchbereichs, fuer den Abgleich mit dem Schnappschuss. */
function bereichsschluessel(stand) {
  return stand.sucheProjekt ?? ''
}

/**
 * Schneidet einen Bestand auf den gewaehlten Ordner zu.
 *
 * Scheine ohne Riesenschein fallen dabei heraus, und das ist richtig: was in
 * keinem Riesenschein liegt, liegt erst recht in keinem Ordner.
 *
 * @param {any} bestand
 * @param {string} wahl  Leer heisst alle, '@ohne' heisst ohne Ordner.
 * @returns {any}
 */
function aufOrdner(bestand, wahl) {
  if (!wahl) return bestand
  const soll = wahl === '@ohne' ? '' : wahl
  const riesenscheine = bestand.riesenscheine.filter((r) => String(r.ordner ?? '') === soll)
  const ids = new Set(riesenscheine.flatMap((r) => r.scheinIds ?? []))
  return { ...bestand, riesenscheine, scheine: bestand.scheine.filter((s) => ids.has(s.id)) }
}

/**
 * Laedt die fremden Projekte des gewaehlten Bereichs, nur lesend.
 */
async function starteFerneSuche() {
  const stand = Zustand.hole()
  const schluessel = bereichsschluessel(stand)
  if (schluessel === '') return

  const fremde =
    schluessel === '*'
      ? stand.projekte.filter((p) => p.id !== stand.projekt?.id)
      : stand.projekte.filter((p) => p.id === schluessel)

  Zustand.aendere({ fernBestaende: { stand: 'laedt', schluessel, bestaende: [], fehler: [] } })
  const ergebnis = await holeFerneBestaende(stand.token, fremde)
  Zustand.aendere({
    fernBestaende: {
      stand: 'fertig',
      schluessel,
      bestaende: ergebnis.bestaende,
      fehler: ergebnis.fehler,
    },
  })
}

/**
 * Oeffnet einen Treffer: notfalls erst das fremde Projekt, dann die Stelle.
 *
 * Das Projekt wechselt derselbe Weg wie in der Ablage, das Ereignis
 * kombi-projekt-oeffnen, damit es das Wechseln nur einmal gibt
 * (Projektregel 8). Auswahl und Ordner duerfen sofort danach gesetzt werden:
 * das Neuordnen behaelt eine Auswahl, deren Kennung es wirklich gibt, und
 * die Kennungen der Treffer kommen ja gerade aus diesem Projekt.
 *
 * @param {import('../kern/suche.js').Suchtreffer} t
 */
function oeffneTreffer(t) {
  const stand = Zustand.hole()

  const ziel = {
    ansicht: /** @type {any} */ ('positionen'),
    ordnerFilter: t.art === 'ordner' ? t.ordner : null,
    auswahl: t.art === 'ordner' ? null : t.riesenscheinId,
    scheinAuswahl: t.art === 'schein' ? t.scheinId : null,
  }
  // Ein Schein ohne Riesenschein hat keine Ebene 3. Dann wenigstens die
  // Uebersicht des richtigen Projekts, statt eines halben Zustands.
  if (t.art === 'schein' && !t.riesenscheinId) ziel.scheinAuswahl = null

  if (t.projektId && stand.projekt?.id !== t.projektId) {
    window.dispatchEvent(new CustomEvent('kombi-projekt-oeffnen', { detail: { id: t.projektId } }))
  }
  if (ziel.auswahl) Reihenfolge.merkeGeoeffnet(ziel.auswahl)
  Zustand.aendere(ziel)
}

/**
 * Die Suchleiste mit Bereichswahl und die Treffer darunter.
 *
 * @param {any} stand
 * @returns {HTMLElement}
 */
function suchmaschine(stand) {
  const text = String(stand.startsuche ?? '')
  const schluessel = bereichsschluessel(stand)
  const fern = stand.fernBestaende
  const fernPasst = fern !== null && fern.schluessel === schluessel
  const andere = stand.projekte.filter((p) => p.id !== stand.projekt?.id)

  /*
    WELCHE BESTAENDE GERADE IN REICHWEITE SIND.

    Das offene Projekt kommt immer aus dem Arbeitsstand, nie aus dem
    Schnappschuss: was eben getippt wurde, muss die Suche sofort sehen. Ein
    Schnappschuss-Bestand, der inzwischen das OFFENE Projekt waere, wird
    uebersprungen, sonst staende jeder Treffer doppelt da.
  */
  /** @type {any[]} */
  const bestaende = []
  /** @type {string[]} */
  const hinweise = []

  if (schluessel === '') {
    bestaende.push(aufOrdner(bestandAusStand(stand), stand.sucheOrdner))
  } else if (schluessel === '*') {
    bestaende.push(bestandAusStand(stand))
    if (fernPasst && fern.stand === 'fertig') {
      for (const b of fern.bestaende) {
        if (b.projektId !== stand.projekt?.id) bestaende.push(b)
      }
      const fehlen = andere.filter((p) => !fern.bestaende.some((b) => b.projektId === p.id))
      for (const p of fehlen.filter((p) => !fern.fehler.some((f) => f.startsWith(p.name)))) {
        hinweise.push(`"${p.name}" ist seit dem letzten Laden nicht dabei. Drücke Suchen zum Neuladen.`)
      }
    } else if (andere.length > 0 && (!fernPasst || fern.stand !== 'laedt')) {
      hinweise.push('Die anderen Projekte sind noch nicht geladen. Drücke Suchen, dann sind sie dabei.')
    }
  } else {
    const b = fernPasst && fern.stand === 'fertig'
      ? fern.bestaende.find((x) => x.projektId === schluessel)
      : null
    if (b) {
      bestaende.push(aufOrdner(b, stand.sucheOrdner))
    } else if (!fernPasst || fern.stand !== 'laedt') {
      hinweise.push('Dieses Projekt ist noch nicht geladen. Drücke Suchen, dann wird darin gesucht.')
    }
  }

  const laedt = fernPasst && fern.stand === 'laedt'
  const fehler = fernPasst && fern.stand === 'fertig' ? fern.fehler : []

  const gesucht = text.trim() !== ''
  const treffer = gesucht ? bestaende.flatMap((b) => durchsucheBestand(b, text)) : []

  /*
    HOECHSTENS HUNDERT ZEILEN, UND ES STEHT DABEI.

    Eine Grenze ohne Ansage saehe aus wie "mehr gibt es nicht", und genau
    dieses stille Abschneiden verbietet Projektregel 9.
  */
  const gezeigt = treffer.slice(0, 100)

  // Der Ordner laesst sich nur eingrenzen, wo die Ordner bekannt sind: im
  // offenen Projekt sofort, in einem fremden nach dem Laden. Ueber alle
  // Projekte hinweg gibt es keine Ordnerwahl, Ordner gehoeren je einem Projekt.
  const ordnerquelle =
    schluessel === ''
      ? bestandAusStand(stand)
      : schluessel !== '*' && fernPasst && fern.stand === 'fertig'
        ? fern.bestaende.find((x) => x.projektId === schluessel) ?? null
        : null

  return el('.startbereich.startsuchbereich', {}, [
    el('h2.startbereichtitel', { text: 'Suchen' }),
    el('p.startbereichtext', {
      text:
        'Nach Name, Emoji, Quote, Datum, Anbieter, Scheinnummer oder Betrag. ' +
        'Gefunden werden Scheine, Riesenscheine und Ordner.',
    }),

    el('.startsuchleiste', {}, [
      el('input.suchfeld.startsuche', {
        type: 'search',
        value: text,
        placeholder: 'Suchen, zum Beispiel 1,84 oder 17.09. oder DraftKings ...',
        'aria-label': 'Im Programm suchen',
        oninput: (e) =>
          Zustand.aendere({ startsuche: /** @type {HTMLInputElement} */ (e.target).value }),
        onkeydown: (e) => {
          // Eingabetaste laedt den fernen Bereich, wenn er noch fehlt.
          if (e.key === 'Enter' && schluessel !== '' && !laedt) starteFerneSuche()
        },
      }),

      el(
        'select.feldwahl.startsuchwahl',
        {
          'aria-label': 'In welchem Projekt gesucht wird',
          title: 'In welchem Projekt gesucht wird',
          onchange: (e) => {
            const wert = /** @type {HTMLSelectElement} */ (e.target).value
            Zustand.aendere({ sucheProjekt: wert === '' ? null : wert, sucheOrdner: '' })
          },
        },
        [
          el('option', {
            value: '',
            text: `Dieses Projekt: ${stand.projekt?.name || 'Ohne Namen'}`,
            selected: schluessel === '' ? 'selected' : null,
          }),
          ...andere.map((p) =>
            el('option', {
              value: p.id,
              text: `Projekt: ${p.name || 'Ohne Namen'}`,
              selected: schluessel === p.id ? 'selected' : null,
            })
          ),
          andere.length > 0
            ? el('option', {
                value: '*',
                text: 'Alle Projekte, das ganze Programm',
                selected: schluessel === '*' ? 'selected' : null,
              })
            : null,
        ]
      ),

      schluessel !== '*'
        ? el(
            'select.feldwahl.startsuchwahl',
            {
              'aria-label': 'In welchem Ordner gesucht wird',
              title: ordnerquelle
                ? 'In welchem Ordner gesucht wird'
                : 'Die Ordner dieses Projekts sind erst nach dem Laden bekannt',
              disabled: ordnerquelle ? null : 'disabled',
              onchange: (e) =>
                Zustand.aendere({
                  sucheOrdner: /** @type {HTMLSelectElement} */ (e.target).value,
                }),
            },
            [
              el('option', {
                value: '',
                text: 'Alle Ordner',
                selected: stand.sucheOrdner === '' ? 'selected' : null,
              }),
              ...(ordnerquelle
                ? [
                    ordnerquelle.riesenscheine.some((r) => String(r.ordner ?? '') === '')
                      ? el('option', {
                          value: '@ohne',
                          text: 'Ohne Ordner',
                          selected: stand.sucheOrdner === '@ohne' ? 'selected' : null,
                        })
                      : null,
                    ...[...new Set(
                      ordnerquelle.riesenscheine
                        .map((r) => String(r.ordner ?? '').trim())
                        .filter((n) => n !== '')
                    )].map((name) =>
                      el('option', {
                        value: name,
                        text: `Ordner: ${name}`,
                        selected: stand.sucheOrdner === name ? 'selected' : null,
                      })
                    ),
                  ]
                : []),
            ]
          )
        : null,

      schluessel !== ''
        ? el('button.knopf.knopf-klein', {
            type: 'button',
            text: laedt ? 'Lädt ...' : fernPasst && fern.stand === 'fertig' ? 'Neu laden' : 'Suchen',
            title: 'Liest die gewählten Projekte aus der Datenbank, nur lesend',
            disabled: laedt ? 'disabled' : null,
            onclick: () => starteFerneSuche(),
          })
        : null,
    ]),

    laedt ? el('p.suchhinweis', { text: 'Die Projekte werden geladen ...' }) : null,
    ...hinweise.map((h) => el('p.suchhinweis', { text: h })),
    ...fehler.map((f) => el('p.suchhinweis.suchfehler', { text: `Ließ sich nicht laden: ${f}` })),

    gesucht
      ? el('p.suchstand', {
          text:
            treffer.length === 0
              ? 'Kein Treffer.'
              : treffer.length === 1
                ? '1 Treffer'
                : `${treffer.length} Treffer`,
        })
      : null,

    gezeigt.length > 0
      ? el(
          '.suchtrefferliste',
          {},
          gezeigt.map((t) =>
            el(
              'button.suchtreffer',
              {
                type: 'button',
                daten: { art: t.art },
                title:
                  t.art === 'ordner'
                    ? `Den Ordner "${t.name}" aufmachen`
                    : t.art === 'riesenschein'
                      ? `Den Riesenschein "${t.name}" aufmachen`
                      : 'Diesen Schein aufmachen',
                onclick: () => oeffneTreffer(t),
              },
              [
                stufenzeichen(
                  t.art === 'ordner'
                    ? 'ordner-riesenschein'
                    : t.art === 'riesenschein'
                      ? 'riesenschein'
                      : 'schein'
                ),
                el('span.suchtrefferkern', {}, [
                  el('span.suchtreffername', { text: t.name }),
                  el('span.suchtrefferort', {
                    text: [
                      t.projektName,
                      t.ordner || null,
                      t.art === 'schein' ? t.riesenscheinName || null : null,
                    ]
                      .filter(Boolean)
                      .join(' > '),
                  }),
                ]),
                el('span.suchtrefferwo', { text: `gefunden in: ${t.gefundenIn.join(', ')}` }),
              ]
            )
          )
        )
      : null,

    treffer.length > gezeigt.length
      ? el('p.suchhinweis', {
          text: `Nur die ersten ${gezeigt.length} von ${treffer.length} Treffern stehen hier. Grenze die Suche weiter ein.`,
        })
      : null,
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
      'Kann zurückkommen',
      formatiere(gesamt.auszahlungMoeglich, w, 'de'),
      'gut',
      'Wenn alles Offene gewinnt, einschließlich Einsatz'
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
          el('.startkachelwert', { text: 'Währungen gemischt' }),
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
      text: 'Ein Klick öffnet den ganzen Riesenschein mit allen Einzelscheinen darin.',
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
      title: `Riesenschein "${riesenschein.name || 'Ohne Namen'}" öffnen`,
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
        'Zahlen heraus, und gleiche Wetten werden zu einem Riesenschein zusammengeführt. ' +
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
        'Scheine prüfen',
        hatScheine
          ? `${stand.scheine.length} gelesene Scheine durchsehen und wo nötig von Hand berichtigen.`
          : 'Hier stehen die gelesenen Scheine, sobald es welche gibt.',
        'scheine'
      ),
      startweg(
        'Riesenscheine ansehen',
        'Gleiche Wetten zusammengefasst: Einsatz, möglicher Gewinn, Multiplikator.',
        'positionen'
      ),
      startweg(
        'Ausgabe',
        'Alles als Excel-Mappe oder CSV herunterladen, zum Aufheben und zum Weiterrechnen.',
        'ausgabe'
      ),
      startweg(
        'Ablage',
        'Deine Projekte und Ordner. Hier liegt, was du früher gemacht hast, über Monate und Jahre.',
        'ablage'
      ),
      startweg('Erklärung', 'Jede Seite dieses Programms, Schritt für Schritt erklärt.', 'hilfe'),
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
