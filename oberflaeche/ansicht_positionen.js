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

import { el, fuelle, zeitText, anbieterzeichen } from './werkzeug.js'
import { formatiere, formatiereQuote } from '../kern/geld.js'
import { statusText } from '../bild/mosaik.js'
import { barEinsatz, realisierterRueckfluss } from '../kern/rechnung.js'
import { rechneProjekt } from '../kern/rechnung.js'
import * as Zustand from './zustand.js'
import { fotoknoepfe } from './fotoknoepfe.js'
import { istAngeheftet, heftAn } from './nadeln.js'

/**
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  const stand = Zustand.hole()

  if (stand.riesenscheine.length === 0) {
    fuelle(ziel, [
      el('.leerhinweis', {}, [
        el('p.leer-titel', { text: 'Noch kein Riesenschein da.' }),
        el('p.leer-text', {
          text: 'Sobald Scheine gelesen sind, werden gleiche Wetten hier automatisch zusammengefasst.',
        }),
      ]),
    ])
    return
  }

  const rechnungen = stand.riesenscheine.map((r) => Zustand.rechnungVon(r.id))
  const gesamt = rechneProjekt(rechnungen)
  const gewaehlt = stand.auswahl ?? stand.riesenscheine[0]?.id ?? null

  // Bei genau einem Riesenschein waere der Projektkopf reine Wiederholung:
  // dieselbe Summe stuende dann dreimal auf dem Bildschirm, oben in der Leiste,
  // im Projektkopf und im Riesenschein selbst. Dreimal dieselbe Zahl liest sich
  // nicht dreimal so gut, sie macht nur unsicher, ob es wirklich dieselbe ist.
  //
  // Erst ab zwei Riesenscheinen sagt die Gesamtsumme etwas Neues.
  const mehrereWetten = stand.riesenscheine.length > 1

  fuelle(ziel, [
    mehrereWetten ? projektkopf(gesamt) : null,
    // Die Liste links waehlt zwischen Riesenscheinen aus. Bei nur einem gibt es
    // nichts auszuwaehlen.
    // DREI SPALTEN, seit dem 16.09.2026.
    //
    // Karam: "rechts einfach ein Panel bei den Riesenscheinen, wo alles drauf
    // ist, und dann hat man einfach den offenen Schein in der Main, und links
    // das Panel, da sind alle Scheine drinnen."
    //
    //   links   alle Riesenscheine zum Umschalten
    //   Mitte   der offene Riesenschein mit seinen Zahlen
    //   rechts  die einzelnen Scheine darin, nummeriert, plus Fotoknoepfe
    //
    // Die Liste links faellt weg, wenn es nur einen Riesenschein gibt: dann
    // gaebe es nichts auszuwaehlen. Die Spalte rechts bleibt immer, denn dort
    // liegt der Weg, ein Foto nachzureichen.
    el('.positionsspalten', { daten: { einzeln: String(!mehrereWetten) } }, [
      mehrereWetten
        ? el('.positionsliste', {}, [
            el('.spaltentitel', { text: `${stand.riesenscheine.length} Riesenscheine` }),
            ...stand.riesenscheine.map((r, i) => listeneintrag(r, rechnungen[i], r.id === gewaehlt)),
          ])
        : null,
      gewaehlt ? einzelheit(gewaehlt) : null,
      gewaehlt ? scheinpanel(gewaehlt) : null,
    ]),
  ])
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
  const etwasEntschieden = Math.abs(gesamt.ergebnisRealisiert) > 0.005

  return el('.projektkopf', {}, [
    kachel('Gesamteinsatz', formatiere(gesamt.einsatzGesamt, w, 'de'), 'neutral',
      `${gesamt.anzahlScheine} Scheine bei ${gesamt.buchmacher.length} Anbietern`),
    kachel('Moegliche Auszahlung', formatiere(gesamt.auszahlungMoeglich, w, 'de'), 'gut',
      'Wenn alles Offene gewinnt, einschliesslich Einsatz'),
    // Solange nichts entschieden ist, waere eine Null hier nur Ablenkung.
    etwasEntschieden
      ? kachel('Ergebnis bisher', formatiere(gesamt.ergebnisRealisiert, w, 'de'),
          gesamt.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht', 'Nur entschiedene Scheine')
      : kachel('Noch im Risiko', formatiere(gesamt.imRisiko, w, 'de'), 'offen',
          'Kann noch verloren gehen'),

    gesamt.waehrungGemischt
      ? el('.kachel.kachel-fehler', {}, [
          el('.kachelname', { text: 'Achtung' }),
          el('.kachelwert', { text: 'Waehrungen gemischt' }),
          el('.kachelhilfe', { text: 'Die Summen oben sind deshalb nicht aussagekraeftig.' }),
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

/**
 * @param {import('../kern/typen.js').Riesenschein} riesenschein
 * @param {import('../kern/typen.js').Rechnung|undefined} rechnung
 * @param {boolean} gewaehlt
 * @returns {HTMLElement}
 */
function listeneintrag(riesenschein, rechnung, gewaehlt) {
  if (!rechnung) return el('div')
  const w = rechnung.waehrung

  return el(
    '.positionskarte',
    {
      daten: { gewaehlt: String(gewaehlt) },
      onclick: () => Zustand.aendere({ auswahl: riesenschein.id }),
    },
    [
      el('.positionsname', { text: riesenschein.name, title: riesenschein.name }),
      el('.positionszahlen', {}, [
        el('span.positionswert', { text: formatiere(rechnung.einsatzGesamt, w, 'de') }),
        el('span.positionsunterzeile', {
          text: `${rechnung.anzahlScheine} Scheine / ${rechnung.anzahlBuchmacher} Anbieter`,
        }),
      ]),
      el('.positionsquote', {
        text: formatiereQuote(rechnung.quoteEffektiv, 'dezimal', 'de'),
        title: 'Einsatzgewichtete Gesamtquote',
      }),
      el('.positionsergebnis', { daten: { art: rechnung.imRisiko > 0 ? 'offen' : rechnung.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht' } }, [
        rechnung.imRisiko > 0
          ? `offen: ${formatiere(rechnung.imRisiko, w, 'de')}`
          : formatiere(rechnung.ergebnisRealisiert, w, 'de'),
      ]),
      rechnung.hinweise.some((h) => h.schwere === 'fehler')
        ? el('span.anmerkung', { daten: { schwere: 'fehler' }, text: '!' })
        : null,
    ]
  )
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

    el('.detailkopf', {}, [
      el('input.namenfeld', {
        type: 'text',
        value: riesenschein.name,
        onchange: (e) =>
          Zustand.benenneUm(riesenscheinId, /** @type {HTMLInputElement} */ (e.target).value),
      }),
      el('.detailzeit', {
        text: scheine[0]?.gesetztAm.wert ? `gesetzt ${zeitText(scheine[0].gesetztAm.wert)}` : '',
      }),
    ]),

    // Die vier Zahlen, wegen derer man herschaut. Mehr nicht.
    //
    // Frueher standen hier acht Kacheln nebeneinander, alle gleich gross und
    // gleich laut. Bei acht gleich lauten Zahlen sucht das Auge, statt zu lesen.
    el('.kachelreihe.kachelreihe-wichtig', {}, [
      kachel('Gesamteinsatz', formatiere(rechnung.einsatzGesamt, w, 'de'), 'neutral',
        'Tatsaechlicher Geldaufwand'),
      kachel('Moegliche Auszahlung', formatiere(rechnung.auszahlungMoeglich, w, 'de'), 'gut',
        'Wenn alles Offene gewinnt, einschliesslich Einsatz'),
      kachel('Effektive Quote', formatiereQuote(rechnung.quoteEffektiv, 'dezimal', 'de'), 'neutral',
        'Einsatzgewichtet, nicht der Mittelwert'),
      kachel('Verteilung',
        `${rechnung.anzahlScheine} / ${rechnung.anzahlBuchmacher}`, 'neutral',
        'Scheine / Anbieter'),
    ]),

    // Alles Weitere ist da, aber zugeklappt. Ein <details> braucht kein
    // Stylesheet und keine Zustandsverwaltung: faellt die Designschicht weg,
    // klappt es trotzdem auf.
    el('details.mehr', {}, [
      el('summary', { text: 'Alle Zahlen und die Aufteilung' }),
      el('.kachelreihe', {}, [
        kachel('Moeglicher Gewinn', formatiere(rechnung.gewinnMoeglich, w, 'de'), 'gut', 'Ohne Einsatz'),
        kachel('Noch im Risiko', formatiere(rechnung.imRisiko, w, 'de'), 'offen',
          'Der Einsatz der noch offenen Scheine'),
        kachel('Ergebnis bisher', formatiere(rechnung.ergebnisRealisiert, w, 'de'),
          rechnung.ergebnisRealisiert >= 0 ? 'gut' : 'schlecht',
          'Nur entschiedene Scheine, auf beiden Seiten der Rechnung'),
        kachel('Konten', String(rechnung.anzahlKonten), 'neutral',
          rechnung.konten.length > 0 ? rechnung.konten.join(', ') : 'kein Konto erkannt'),
        rechnung.gratiswetteNennwert > 0
          ? kachel('Gratiswetten', formatiere(rechnung.gratiswetteNennwert, w, 'de'), 'neutral',
              'Nennwert, zaehlt nicht als Aufwand')
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
        placeholder: 'Warum diese Wette, was ist aufgefallen, worauf beim naechsten Mal achten.',
        text: riesenschein.notiz ?? '',
        onchange: (e) =>
          Zustand.setzeRiesenscheinNotiz(
            riesenscheinId,
            /** @type {HTMLTextAreaElement} */ (e.target).value
          ),
      }),
    ]),

  ])
}

/**
 * Die rechte Spalte: alle Scheine dieses Riesenscheins, nummeriert.
 *
 * WARUM RECHTS UND NICHT UNTEN
 *
 * Ein Riesenschein besteht aus vielen einzelnen Scheinen, oft sechzig. Standen
 * sie unter den Zahlen, musste man scrollen, um ueberhaupt zu sehen, wie viele
 * es sind, und die Zahlen oben waren dann weg. Nebeneinander sieht man beides
 * zugleich: was zusammengerechnet herauskommt, und woraus es sich zusammensetzt.
 *
 * OBEN DIE FOTOKNOEPFE. Karam wollte ausdruecklich, dass sich auch von hier aus
 * ein Bildschirmfoto machen oder eine Datei hochladen laesst. Die Ansicht
 * wechselt dabei NICHT: wer hier ein Foto nachreicht, will hier bleiben.
 *
 * @param {string} riesenscheinId
 * @returns {HTMLElement}
 */
function scheinpanel(riesenscheinId) {
  const stand = Zustand.hole()
  const riesenschein = stand.riesenscheine.find((r) => r.id === riesenscheinId)
  if (!riesenschein) return el('div')
  const scheine = Zustand.scheineVon(riesenscheinId)

  return el('.scheinpanel', {}, [
    el('.spaltentitel', {
      text: scheine.length === 1 ? '1 Schein' : `${scheine.length} Scheine`,
      title: 'Die einzelnen Wettscheine, aus denen dieser Riesenschein besteht',
    }),
    fotoknoepfe({ kompakt: true, titel: 'Foto hinzufuegen' }),
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
  return el('.scheinbereich', {}, [
    el('.teiltitel', { text: 'In der Reihenfolge des Blattes' }),
    el(
      '.scheinreihe',
      {},
      scheine.map((schein, i) => {
        const w = schein.waehrung.wert ?? 'UNBEKANNT'
        const rueckfluss = realisierterRueckfluss(schein)
        return el('.scheinkaertchen', { daten: { status: schein.status } }, [
          el('.kaertchennummer', { text: String(i + 1) }),
          el('.kaertcheninhalt', {}, [
            el('.kaertchenanbieter', {}, [
              anbieterzeichen(schein.buchmacher.wert),
              el('span', { text: schein.buchmacher.wert ?? 'Anbieter offen' }),
            ]),
            schein.konto.wert ? el('.kaertchenkonto', { text: schein.konto.wert }) : null,
            el('.kaertchenzahlen', {}, [
              el('span.kaertcheneinsatz', { text: formatiere(barEinsatz(schein), w, 'de') }),
              el('span.kaertchenquote', {
                text: formatiereQuote(schein.quoteDezimal.wert, 'dezimal', 'de'),
              }),
            ]),
            el('.kaertchenstatus', { text: statusText(schein.status) }),
            rueckfluss.bekannt && rueckfluss.wert !== null
              ? el('.kaertchenrueckfluss', { text: `zurueck ${formatiere(rueckfluss.wert, w, 'de')}` })
              : null,
          ]),
          el('.kaertchenknoepfe', {}, [
            i > 0
              ? el('button.knopf.knopf-winzig', {
                  type: 'button',
                  text: '◀',
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
                  text: '▶',
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
      el('.riesenkopf-name', { text: riesenschein.name || 'Ohne Namen' }),
    ]),

    el('.riesenkopf-rechts', {}, [
      // Die Nadel legt den Riesenschein ins Panel links. Von dort ist er aus
      // jeder Ansicht einen Klick entfernt.
      el('button.knopf.knopf-klein.riesennadel', {
        type: 'button',
        daten: { an: String(angeheftet) },
        text: angeheftet ? 'Angeheftet' : 'Anheften',
        title: angeheftet
          ? 'Steht im Panel links. Klicken nimmt ihn wieder heraus.'
          : 'Legt diesen Riesenschein ins Panel links, dann ist er von ueberall aus einen Klick entfernt.',
        onclick: () => heftAn(riesenschein.id),
      }),
      // Derselbe Weg wie im Reiter Aufnahme, aus fotoknoepfe.js. Ein Foto
      // hier wird genauso gelesen wie eines dort, und der gelesene Schein
      // taucht unten in der Liste auf.
      fotoknoepfe({ kompakt: true, titel: 'Foto hinzufuegen' }),
    ]),
  ])
}
