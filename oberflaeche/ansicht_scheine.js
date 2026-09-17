// @ts-check
/**
 * Ansicht "Scheine".
 *
 * Jede gelesene Zeile steht hier und laesst sich von Hand berichtigen.
 * Was von Hand gesetzt wurde, wird spaeter nie wieder ueberschrieben.
 *
 * Die Farbe hinter einem Feld sagt, wie sicher die Texterkennung war.
 * Alles, was unter der Sicherheitsschwelle liegt, faellt sofort ins Auge,
 * statt in einer langen Liste unterzugehen.
 */

import { el, fuelle, ausschnittbild } from './werkzeug.js'
import { formatiere, formatiereQuote } from '../kern/geld.js'
import { barEinsatz } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'
import * as Dialog from './dialog.js'

/*
  DIE EINGABEFELDER STEHEN SEIT DEM 17.09.2026 IN oberflaeche/scheinfelder.js.

  Sie standen bis dahin hier, als eigene Funktionen dieser Datei. Seit es die
  dritte Ebene bei den Riesenscheinen gibt, wird derselbe Schein an zwei
  Stellen von Hand berichtigt. Zwei Abschriften waeren zwei Stellen, an denen
  sich das Verhalten auseinanderentwickelt (Projektregel 8).

  Es ist nichts geloescht und nichts geaendert worden: die Funktionen sind
  wortgleich umgezogen und haben nur einen zusaetzlichen Zusatz fuer die
  Klasse der Huelle bekommen, weil dieselben Felder in der Tabelle anders
  liegen als im grossen Formular.
*/
import {
  textfeld,
  zahlfeld,
  quotenfeld,
  zeitfeld,
  statuswahl,
  schalter,
} from './scheinfelder.js'

/** @type {{nurProbleme: boolean, suche: string, offen: Set<string>}} */
const filter = { nurProbleme: false, suche: '', offen: new Set() }

/**
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  const stand = Zustand.hole()

  let scheine = stand.scheine
  if (filter.nurProbleme) {
    scheine = scheine.filter((s) => s.hinweise.some((h) => h.schwere !== 'info'))
  }
  if (filter.suche.trim() !== '') {
    const suche = filter.suche.toLowerCase()
    scheine = scheine.filter((s) =>
      [
        s.buchmacher.wert,
        s.konto.wert,
        s.scheinNr.wert,
        s.rohtext,
        ...s.auswahlen.map((a) => `${a.tipp.wert} ${a.ereignis.wert} ${a.markt.wert}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(suche)
    )
  }

  const mitFehler = stand.scheine.filter((s) => s.hinweise.some((h) => h.schwere === 'fehler')).length
  const mitWarnung = stand.scheine.filter(
    (s) => s.hinweise.some((h) => h.schwere === 'warnung') && !s.hinweise.some((h) => h.schwere === 'fehler')
  ).length

  fuelle(ziel, [
    kopfleiste(stand.scheine.length, mitFehler, mitWarnung),
    stand.verdacht.length > 0 ? verdachtsleiste(stand) : null,
    stand.restposten.length > 0 ? resttopf(stand) : null,
    scheine.length === 0
      ? el('.leerhinweis', {}, [
          el('p.leer-titel', {
            text: stand.scheine.length === 0 ? 'Noch keine Scheine gelesen.' : 'Kein Schein passt zum Filter.',
          }),
        ])
      : el('.scheintabelle', {}, [kopfzeile(), ...scheine.map((s) => scheinzeile(s, stand))]),
  ])
}

/**
 * @param {number} gesamt
 * @param {number} mitFehler
 * @param {number} mitWarnung
 * @returns {HTMLElement}
 */
function kopfleiste(gesamt, mitFehler, mitWarnung) {
  return el('.werkzeugleiste', {}, [
    el('.leistenzahlen', {}, [
      el('span.zahlchip', { text: `${gesamt} Scheine` }),
      mitFehler > 0
        ? el('span.zahlchip.chip-fehler', { text: `${mitFehler} mit Fehler` })
        : el('span.zahlchip.chip-gut', { text: 'keine Fehler' }),
      mitWarnung > 0 ? el('span.zahlchip.chip-warnung', { text: `${mitWarnung} zu prüfen` }) : null,
    ]),
    el('input.suchfeld', {
      type: 'search',
      placeholder: 'Suchen nach Anbieter, Spieler, Nummer ...',
      value: filter.suche,
      oninput: (e) => {
        filter.suche = /** @type {HTMLInputElement} */ (e.target).value
        Zustand.aendere({})
      },
    }),
    el('label.schalter', {}, [
      el('input', {
        type: 'checkbox',
        checked: filter.nurProbleme ? 'checked' : null,
        onchange: (e) => {
          filter.nurProbleme = /** @type {HTMLInputElement} */ (e.target).checked
          Zustand.aendere({})
        },
      }),
      el('span', { text: 'Nur Scheine mit Anmerkung' }),
    ]),
  ])
}

/**
 * @param {import('./zustand.js').Stand} stand
 * @returns {HTMLElement}
 */
function verdachtsleiste(stand) {
  const nachId = new Map(stand.scheine.map((s) => [s.id, s]))
  return el('.hinweisblock.block-warnung', {}, [
    el('.blocktitel', { text: `${stand.verdacht.length} Punkt(e) zum Nachsehen` }),
    el(
      'ul.blockliste',
      {},
      stand.verdacht.slice(0, 12).map((v) => {
        const schein = nachId.get(v.scheinId)
        return el('li', {
          text: `${schein?.scheinNr.wert ?? v.scheinId}: ${v.grund}`,
        })
      })
    ),
  ])
}

/**
 * Der Resttopf. Was hier steht, zaehlt NICHT in den Summen mit.
 * Deshalb steht es gross da und nicht irgendwo versteckt.
 *
 * @param {import('./zustand.js').Stand} stand
 * @returns {HTMLElement}
 */
function resttopf(stand) {
  const nachId = new Map(stand.scheine.map((s) => [s.id, s]))
  return el('.hinweisblock.block-rest', {}, [
    el('.blocktitel', {
      text: `Resttopf: ${stand.restposten.length} Schein(e) zählen nicht mit`,
    }),
    el(
      'ul.blockliste',
      {},
      stand.restposten.map((r) => {
        const schein = nachId.get(r.scheinId)
        return el('li', {}, [
          el('strong', { text: schein?.scheinNr.wert ?? r.scheinId }),
          ' ',
          r.grund,
          ' ',
          schein
            ? el('button.knopf.knopf-klein', {
                type: 'button',
                text: 'trotzdem mitzählen',
                onclick: () => {
                  Zustand.setzeFeld(r.scheinId, 'scheinNr', `${schein.scheinNr.wert ?? ''}-b`)
                  Zustand.melde(
                    'info',
                    'Die Scheinnummer wurde ergänzt, damit der Schein als eigener Schein zählt.'
                  )
                },
              })
            : null,
        ])
      })
    ),
  ])
}

/**
 * @returns {HTMLElement}
 */
function kopfzeile() {
  const spalten = [
    'Nr',
    'Riesenschein',
    'Anbieter',
    'Konto',
    'Schein-Nr',
    'Gesetzt am',
    'Status',
    'Einsatz',
    'Quote',
    'Auszahlung',
    'Aufwand',
    '',
  ]
  return el('.tabellenkopf', {}, spalten.map((s) => el('.kopfzelle', { text: s })))
}

/**
 * @param {import('../kern/typen.js').Schein} schein
 * @param {import('./zustand.js').Stand} stand
 * @returns {HTMLElement}
 */
function scheinzeile(schein, stand) {
  const nummer = stand.scheine.indexOf(schein) + 1
  const offen = filter.offen.has(schein.id)
  const schwere = schein.hinweise.some((h) => h.schwere === 'fehler')
    ? 'fehler'
    : schein.hinweise.some((h) => h.schwere === 'warnung')
      ? 'warnung'
      : 'gut'
  const w = schein.waehrung.wert ?? 'UNBEKANNT'

  const zeile = el('.tabellenzeile', { daten: { schwere, ausgeschlossen: String(schein.ausgeschlossen) } }, [
    el('.zelle.zelle-nummer', { text: String(nummer) }),

    gruppenwahl(schein, stand),
    textfeld(schein, 'buchmacher', 'Anbieter'),
    textfeld(schein, 'konto', 'Konto'),
    textfeld(schein, 'scheinNr', 'Nummer'),

    zeitfeld(schein),
    statuswahl(schein),

    zahlfeld(schein, 'einsatz', w),
    quotenfeld(schein),
    zahlfeld(schein, 'auszahlung', w),

    el('.zelle.zelle-zahl', {
      text: formatiere(barEinsatz(schein), w, 'de'),
      title: schein.gratiswette
        ? 'Gratiswette: kein eigenes Geld im Spiel'
        : schein.eachWay
          ? 'Each Way: der Einsatz wird doppelt abgebucht'
          : 'Tatsaechlicher Geldaufwand',
    }),

    el('.zelle.zelle-knoepfe', {}, [
      el('button.knopf.knopf-klein', {
        type: 'button',
        text: offen ? 'zu' : 'mehr',
        onclick: () => {
          if (offen) filter.offen.delete(schein.id)
          else filter.offen.add(schein.id)
          Zustand.aendere({})
        },
      }),
      schein.hinweise.length > 0
        ? el('span.anmerkung', {
            daten: { schwere },
            text: String(schein.hinweise.filter((h) => h.schwere !== 'info').length || ''),
            title: schein.hinweise.map((h) => h.text).join('\n'),
          })
        : null,
    ]),
  ])

  if (!offen) return zeile
  return el('.zeilengruppe', {}, [zeile, aufklappung(schein, stand)])
}

/**
 * @param {import('../kern/typen.js').Schein} schein
 * @param {import('./zustand.js').Stand} stand
 * @returns {HTMLElement}
 */
function gruppenwahl(schein, stand) {
  return el('.zelle', {}, [
    el(
      'select.feldwahl.feldwahl-breit',
      {
        onchange: (e) => {
          const wert = /** @type {HTMLSelectElement} */ (e.target).value
          if (wert === 'neu') {
            // Einen eigenen Riesenschein aufmachen, nur fuer diesen Schein.
            //
            // WOZU: Karam am 16.09.2026, "man kann auch einen Riesenschein
            // erstellen". Die Automatik fasst zusammen, was sie als dieselbe
            // Wette erkennt. Wo sie das nicht kann, weil die Anbieter die
            // Wette verschieden schreiben, macht es der Mensch: hier einen
            // neuen aufmachen, und die uebrigen Scheine in derselben Spalte
            // hineinziehen.
            //
            // Die Zuordnung von Hand haelt: gruppiere() bricht Handgruppen
            // nicht wieder auf.
            Zustand.neuerRiesenschein(schein.id)
            return
          }
          Zustand.verschiebeSchein(schein.id, wert === '' ? null : wert)
        },
      },
      [
        el('option', { value: '', text: 'automatisch zuordnen' }),
        el('option', { value: 'neu', text: 'neuen Riesenschein aufmachen' }),
        ...stand.riesenscheine.map((r) =>
          el('option', {
            value: r.id,
            text: r.name.length > 46 ? `${r.name.slice(0, 46)}...` : r.name,
            selected: r.id === schein.gruppeId ? 'selected' : null,
          })
        ),
      ]
    ),
  ])
}

/**
 * Der aufgeklappte Bereich mit Auswahlen, Hinweisen und dem Ausschnitt.
 *
 * @param {import('../kern/typen.js').Schein} schein
 * @param {import('./zustand.js').Stand} stand
 * @returns {HTMLElement}
 */
function aufklappung(schein, stand) {
  const bild = stand.bilder.get(schein.bildId)
  const w = schein.waehrung.wert ?? 'UNBEKANNT'

  return el('.aufklappung', {}, [
    el('.aufklapp-spalten', {}, [
      el('.aufklapp-teil', {}, [
        el('.teiltitel', { text: 'Auswahlen' }),
        schein.auswahlen.length === 0
          ? el('p.leer-text', { text: 'Keine Auswahl erkannt.' })
          : el(
              'ul.auswahlliste',
              {},
              schein.auswahlen.map((a, i) =>
                el('li', {}, [
                  el('span.beinnummer', { text: String(i + 1) }),
                  el('.beininhalt', {}, [
                    el('.beintipp', { text: a.tipp.wert ?? 'ohne Tipp' }),
                    el('.beinereignis', { text: a.ereignis.wert ?? '' }),
                    el('.beinmarkt', { text: a.markt.wert ?? '' }),
                    a.ergebnis.wert ? el('.beinergebnis', { text: a.ergebnis.wert }) : null,
                  ]),
                  a.quoteDezimal.wert !== null
                    ? el('span.beinquote', { text: formatiereQuote(a.quoteDezimal.wert, 'dezimal', 'de') })
                    : null,
                ])
              )
            ),

        el('.teiltitel', { text: 'Sonderformen' }),
        el('.schalterreihe', {}, [
          schalter(schein, 'gratiswette', 'Gratiswette (kein eigenes Geld)'),
          schalter(schein, 'eachWay', 'Each Way (doppelter Einsatz)'),
          schalter(schein, 'ausgeschlossen', 'Ganz aus der Rechnung nehmen'),
        ]),

        el('.teiltitel', { text: 'Tatsächlich zurückgeflossen' }),
        el('.feldreihe', {}, [
          zahlfeld(schein, 'ausgezahlt', w),
          el('span.feldhilfe', {
            text: 'Nur nötig bei vorzeitiger Auszahlung oder wenn der Anbieter anders abgerechnet hat.',
          }),
        ]),

        // Eine Notiz je Schein. Sie wird nie gelesen und nie gerechnet, sie ist
        // Karams Gedaechtnis: warum dieser Schein anders ist als die anderen.
        el('.teiltitel', { text: 'Notiz zu diesem Schein' }),
        el('textarea.notizfeld', {
          rows: '2',
          placeholder: 'Eigene Bemerkung, zum Beispiel warum dieser Schein anders ist.',
          text: schein.notiz ?? '',
          onchange: (e) => {
            Zustand.setzeScheinNotiz(schein.id, /** @type {HTMLTextAreaElement} */ (e.target).value)
          },
        }),

        // Diesen einen Schein weg, nicht alle. Mit Rueckfrage, denn er ist
        // danach wirklich weg: ein Neulesen des Bildes bringt ihn zurueck, eine
        // Handkorrektur daran nicht.
        el('.teiltitel', { text: 'Schein entfernen' }),
        el('.feldreihe', {}, [
          el('button.knopf.knopf-klein.knopf-weg', {
            type: 'button',
            text: 'Diesen Schein löschen',
            title: 'Nur diesen Schein. Das Bild und die übrigen Scheine bleiben.',
            onclick: async () => {
              const name = schein.scheinNr.wert ? `Nr. ${schein.scheinNr.wert}` : 'diesen Schein'
              const ja = await Dialog.bestaetige({
                titel: `${name} wirklich löschen?`,
                punkte: [
                  'Nur dieser eine Schein verschwindet aus der Rechnung.',
                  'Das Bild bleibt erhalten, du kannst ihn daraus neu lesen lassen.',
                ],
                ja: 'Schein löschen',
                gefahr: true,
              })
              if (!ja) return
              Zustand.entferneSchein(schein.id)
              Zustand.melde('info', 'Schein gelöscht. Das Bild ist noch da.')
            },
          }),
          el('span.feldhilfe', {
            text:
              'Der Riesenschein bleibt bestehen. Soll der Schein nur aus der Rechnung heraus, ' +
              'aber sichtbar bleiben, nimm oben "Ganz aus der Rechnung nehmen".',
          }),
        ]),
      ]),

      el('.aufklapp-teil', {}, [
        el('.teiltitel', { text: 'Anmerkungen' }),
        schein.hinweise.length === 0
          ? el('p.leer-text', { text: 'Nichts zu beanstanden.' })
          : el(
              'ul.hinweisliste',
              {},
              schein.hinweise.map((h) =>
                el('li', { daten: { schwere: h.schwere } }, [
                  el('span.hinweisart', { text: h.schwere }),
                  el('span.hinweistext', { text: h.text }),
                ])
              )
            ),

        el('.teiltitel', { text: 'So stand es im Bild' }),
        el('pre.rohtext', { text: schein.rohtext || 'kein Text' }),
      ]),

      bild && bild.inhalt
        ? el('.aufklapp-teil', {}, [
            el('.teiltitel', { text: 'Ausschnitt' }),
            ausschnittbild(bild, schein.ausschnitt),
          ])
        : null,
    ]),
  ])
}


/*
  ausschnittbild ist am 16.09.2026 nach oberflaeche/werkzeug.js gewandert,
  weil die Ansicht Riesenscheine jetzt dasselbe braucht. Eine Fassung fuer
  beide (Projektregel 8).
*/
