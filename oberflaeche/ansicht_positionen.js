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
import { barEinsatz, realisierterRueckfluss, offenePotenzialauszahlung } from '../kern/rechnung.js'
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
  /*
    DIE AUSWAHL MUSS AUF ETWAS ZEIGEN, DAS ES GIBT.

    Karam am 16.09.2026: "einmal das immer als Default, wenn man das aufmacht,
    den aktuellen Riesenschein, den man gerade anhat."

    Vorher stand hier nur ein ?? auf den ersten Eintrag. Das greift aber nur,
    wenn auswahl LEER ist, nicht wenn sie auf einen Riesenschein zeigt, den es
    nicht mehr gibt. Genau das passiert nach jedem Neuordnen: wird ein Wert
    berichtigt, aendert sich die Signatur einer Gruppe, und die alte Kennung
    zeigt ins Leere. Die Mitte blieb dann einfach leer, ohne jede Meldung.

    Jetzt wird geprueft, ob die Auswahl noch existiert, und sonst auf den
    ersten Riesenschein zurueckgefallen. Ein leerer Bildschirm ohne Grund ist
    das Schlimmste, was eine Ansicht tun kann.
  */
  const auswahlLebt =
    stand.auswahl !== null && stand.riesenscheine.some((r) => r.id === stand.auswahl)
  const gewaehlt = auswahlLebt ? stand.auswahl : (stand.riesenscheine[0]?.id ?? null)

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
    /*
      ZWEI SPALTEN, seit dem 16.09.2026, vorher drei.

      Karam: "vor allem bei Riesenscheinen soll dieser linke Panel dafuer sein,
      alle Scheine aufzulisten. Und den grossen Schein einfach hier in der
      Mitte. Und da rechts einfach alle Minischeine."

      Die Auswahlliste stand vorher als eigene Spalte hier drin, und links
      daneben lag NOCH das Panel des Programms. Das waren vier Spalten, zwei
      davon nur zum Auswaehlen. Die Liste ist jetzt im Panel (zeichnePanel in
      app.js), und was hier bleibt, sind die beiden, um die es geht:

        Mitte   der offene Riesenschein mit seinen Zahlen
        rechts  die einzelnen Scheine darin
    */
    el('.positionsspalten', {}, [
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
        return el('.scheinkaertchen', { daten: { status: schein.status } }, [
          el('.kaertchennummer', { text: String(i + 1) }),
          el('.kaertcheninhalt', {}, [
            el('.kaertchenanbieter', {}, [
              anbieterzeichen(schein.buchmacher.wert),
              el('span', { text: schein.buchmacher.wert ?? 'Anbieter offen' }),
            ]),
            schein.konto.wert ? el('.kaertchenkonto', { text: schein.konto.wert }) : null,

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
              el('summary', { text: schein.notiz ? 'Notiz' : 'Notiz hinzufuegen' }),
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
