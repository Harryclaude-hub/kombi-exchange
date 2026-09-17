// @ts-check
/**
 * Was geteilt wird, und was nicht.
 *
 * Karam am 17.09.2026, zum zweiten Mal an einem Tag: "Was soll diese Anzeige
 * 'nur auf diesem Laptop'? Eigentlich soll alles auf jedem Laptop sein. Nur auf
 * diesem Laptop soll es nicht geben. Alles, was ich hier eingebe, sieht die
 * Person zeitgleich bei sich."
 *
 * ER HAT RECHT, UND DIE ANZEIGE HATTE AUCH RECHT. Das ist der Punkt.
 *
 * Es gibt genau einen Zugang zu diesem Programm. Wer den Code hat, sieht
 * alles. Projekte, Scheine, Riesenscheine, Namen, Notizen und Ausgaenge liegen
 * in Supabase und sind fuer beide sofort da. Zwei Sachen liegen es nicht, und
 * beide sind keine Entscheidung, sondern etwas, das noch fehlt:
 *
 *   Die ORDNER fuer Riesenscheine, solange supabase/migrations/0009 nicht
 *   gelaufen ist. Dann ist es eine fehlende Spalte.
 *
 *   Die BILDSCHIRMFOTOS. Die liegen in der Browserdatenbank des Geraets, auf
 *   dem sie hochgeladen wurden. In kombi.bilder stehen nur die Angaben dazu:
 *   Dateiname, Groesse, Pruefsumme. Das Bild selbst geht nirgends hin.
 *
 * WARUM DIESE DATEI EXISTIERT
 *
 * Weil ich es zweimal falsch aufgeschrieben habe. Beide Male stand im Programm
 * ein Satz wie "bleibt auf diesem Geraet", und beide Male las sich das wie eine
 * Eigenschaft des Programms statt wie eine Luecke. Karam hat danach seine
 * Arbeit darauf eingerichtet, und das ist das Schlimmste, was ein
 * missverstaendlicher Satz anrichten kann.
 *
 * Deshalb steht hier eine LISTE und kein Satz: je Sache eine Zeile, mit einem
 * klaren Ja oder Nein, dem Grund und, wo es einen gibt, dem Weg zur Behebung.
 * Was geteilt wird, steht ausdruecklich mit dabei; eine Liste nur der Luecken
 * liest sich, als sei nichts in Ordnung.
 *
 * GERATEN WIRD NICHTS. Ob die Ordner geteilt werden, sieht app.js beim Laden an
 * den Zeilen aus der Datenbank nach. Wie viel Platz die Bilder belegen, misst
 * der Browser.
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5).
 */

import { el } from './werkzeug.js'

/**
 * @typedef {object} Sache
 * @property {string} name
 * @property {boolean|null} geteilt  null heisst: noch nicht festzustellen.
 * @property {string} grund
 */

/**
 * Was geteilt wird und was nicht, zum Anzeigen.
 *
 * @param {any} stand
 * @param {{anzahl: number, bytes: number, mittel: number}|null} [mass]
 *   Wie viele Bilder es sind und wie gross sie sind, GEMESSEN.
 * @returns {Sache[]}
 */
export function sachen(stand, mass = null) {
  const megabyte = mass && mass.bytes > 0 ? Math.round((mass.bytes / (1024 * 1024)) * 10) / 10 : null
  const mittelKb = mass && mass.mittel > 0 ? Math.round(mass.mittel / 1024) : null

  return [
    {
      name: 'Projekte, Scheine, Riesenscheine',
      geteilt: true,
      grund: 'Liegen in der Datenbank. Dein Kollege sieht jede Änderung, sobald er neu lädt.',
    },
    {
      name: 'Namen, Notizen, Ausgänge',
      geteilt: true,
      grund: 'Ebenfalls in der Datenbank, am Schein und am Riesenschein.',
    },
    {
      name: 'Ordner für Riesenscheine',
      geteilt: stand.ordnerGeteilt,
      grund:
        stand.ordnerGeteilt === true
          ? 'Liegen am Riesenschein und damit in der Datenbank.'
          : stand.ordnerGeteilt === null
            ? 'Noch nicht festzustellen: in diesem Projekt liegt kein Riesenschein.'
            : 'Der Datenbank fehlt die Spalte dafür. Ein Befehl behebt das, siehe unten.',
    },
    {
      name: 'Bildschirmfotos',
      geteilt: false,
      grund:
        'Die Bilder liegen in diesem Browser, auf dem Gerät, auf dem du sie hochgeladen hast. ' +
        'In die Datenbank gehen nur die gelesenen Zahlen und die Angaben zum Bild. ' +
        'Dein Kollege sieht die Zahlen, aber nicht die Fotos.' +
        /*
          DIE GEMESSENE GROESSE, weil davon alles Weitere abhaengt.

          Karam am 17.09.2026: "Wie viel Speicher habe ich bei Supabase, und wie
          viele Fotos koennte das aushalten? Ich glaube, wir sind schon bei 10
          bis 100.000 Fotos in der Saison."

          Der Unterschied zwischen 200 Kilobyte und 2 Megabyte je Foto ist in
          seiner Groessenordnung der Unterschied zwischen 20 und 200 Gigabyte
          ueber eine Saison. Das laesst sich nicht schaetzen, das muss gemessen
          werden, und zwar an SEINEN Fotos auf SEINEM Geraet.

          Steht hier nichts, ist noch kein Bild da. Dann wird auch keine Zahl
          erfunden (Projektregel 1).
        */
        (megabyte === null
          ? ''
          : ` Hier liegen ${mass.anzahl} Bild(er) mit ${megabyte} MB, im Mittel ${mittelKb} KB je Bild.`),
    },
    {
      name: 'Anordnung und eingeklapptes Panel',
      geteilt: false,
      grund:
        'Absichtlich je Gerät. Wie du sortierst, ist eine Frage an den Bildschirm, ' +
        'vor dem du sitzt, nicht an das Projekt.',
    },
  ]
}

/**
 * Bleiben die Bilder liegen, und wie lange reicht der Platz.
 *
 * Karam am 17.09.2026: "Ich will wirklich, dass immer die Fotos gespeichert
 * bleiben, dann geht nichts verloren, wenn man etwas im Browser besucht. Das
 * ist mir sehr wichtig, sehr, sehr wichtig. Du musst sicherstellen, dass bei
 * Riesenmengen an Fotos noch immer alle Fotos gespeichert werden koennen,
 * langfristig."
 *
 * Und im selben Atemzug: "Ich habe keinen Bock, so viel auf Supabase zu machen,
 * wenn das dann Geld kostet."
 *
 * BEIDES ZUSAMMEN GEHT NUR AUF DIESEM GERAET. Der kostenlose Plan bei Supabase
 * gibt ein Gigabyte Dateispeicher, das sind bei einem Megabyte je Foto etwa
 * tausend Stueck. Der Browser gibt ein Vielfaches davon, kostenlos, und sagt
 * auf Nachfrage, wie viel.
 *
 * ZWEI FRAGEN, ZWEI ANTWORTEN, beide gemessen:
 *   Wirft der Browser die Bilder von selbst weg?   sorgeFuerDauer()
 *   Wie viele passen noch hinein?                  platz() und die Mittelgroesse
 *
 * @param {{dauerhaft: boolean, moeglich: boolean}|null} dauer
 * @param {{belegt: number, moeglich: number}|null} platz
 * @param {{anzahl: number, bytes: number, mittel: number}|null} mass
 * @returns {HTMLElement|null}
 */
export function speicherblock(dauer, platz, mass) {
  if (!dauer && !platz) return null

  const gb = (bytes) => {
    const wert = bytes / (1024 * 1024 * 1024)
    return wert < 10 ? `${Math.round(wert * 10) / 10} GB` : `${Math.round(wert)} GB`
  }

  // Wie viele Fotos noch hineinpassen. Nur mit einer GEMESSENEN Mittelgroesse;
  // ohne sie steht hier keine Zahl statt einer geratenen (Projektregel 1).
  const frei = platz ? Math.max(0, platz.moeglich - platz.belegt) : 0
  const nochFotos = platz && mass && mass.mittel > 0 ? Math.floor(frei / mass.mittel) : null

  return el('.speicherblock', { daten: { dauerhaft: String(Boolean(dauer?.dauerhaft)) } }, [
    el('.speichertitel', {
      text: dauer?.dauerhaft
        ? 'Deine Fotos bleiben auf diesem Gerät liegen'
        : dauer?.moeglich === false
          ? 'Dieser Browser sagt nicht, ob er die Fotos behält'
          : 'Der Browser darf die Fotos aufräumen',
    }),

    el('p.geteilttext', {
      text: dauer?.dauerhaft
        ? 'Der Browser hat zugesagt, sie nicht von selbst wegzuräumen, auch wenn die ' +
          'Festplatte eng wird. Weg sind sie nur, wenn du die Browserdaten selbst löschst.'
        : dauer?.moeglich === false
          ? 'Er kennt die Zusage nicht, die andere Browser geben. Räumt er auf, sind die ' +
            'Bilder weg. Die Zahlen bleiben, die liegen in der Datenbank.'
          : 'Er hat die Zusage nicht gegeben. Wird die Festplatte eng, kann er die Bilder ' +
            'wegräumen. Meistens gibt er sie, sobald du die Seite ein paar Mal benutzt hast. ' +
            'Die Zahlen bleiben in jedem Fall, die liegen in der Datenbank.',
    }),

    platz
      ? el(
          'ul.geteiltliste',
          {},
          [
            el('li.geteiltzeile', {}, [
              el('span.geteiltmarke', { text: gb(platz.belegt) }),
              el('span.geteiltname', { text: 'belegt' }),
              el('span.geteiltgrund', {
                text: 'Alles, was diese Seite auf diesem Gerät liegen hat.',
              }),
            ]),
            el('li.geteiltzeile', {}, [
              el('span.geteiltmarke', { text: gb(frei) }),
              el('span.geteiltname', { text: 'noch frei' }),
              el('span.geteiltgrund', {
                text:
                  nochFotos === null
                    ? 'Wie viele Fotos das sind, steht hier, sobald das erste hochgeladen ist.'
                    : `Das reicht für etwa ${nochFotos.toLocaleString('de-DE')} weitere Fotos ` +
                      `in der Größe, die du bisher hochgeladen hast.`,
              }),
            ]),
          ]
        )
      : null,

    /*
      DIE EHRLICHE GRENZE.

      Der Browser gibt viel, aber er gibt es nur auf DIESEM Geraet. Eine zweite
      Kopie ausserhalb gibt es nicht, und das muss dastehen, bevor jemand eine
      Saison lang darauf baut.
    */
    el('p.geteilttext', {
      text:
        'Eine zweite Kopie gibt es nicht. Formatierst du den Laptop oder löschst du die ' +
        'Browserdaten, sind die Bilder weg. Die Zahlen überleben, die liegen in der Datenbank.',
    }),
  ])
}

/**
 * Der Block, der die Liste zeigt.
 *
 * Er steht IMMER da und nicht nur bei Luecken. Ein Kasten, der sich nur
 * meldet, wenn etwas fehlt, beantwortet die Frage "wird das geteilt" nicht,
 * solange er schweigt.
 *
 * Zugeklappt, wenn alles geteilt wird, was geteilt werden soll. Offen, sobald
 * etwas fehlt, das eigentlich geteilt gehoert.
 *
 * @param {any} stand
 * @param {{anzahl: number, bytes: number, mittel: number}|null} [mass]
 * @param {string} [wegZurMigration]
 * @returns {HTMLElement}
 */
export function geteiltblock(stand, mass = null, wegZurMigration = '') {
  const liste = sachen(stand, mass)
  // Die letzte Zeile ist absichtlich je Geraet, sie zaehlt nicht als Luecke.
  const luecken = liste.slice(0, -1).filter((s) => s.geteilt === false)

  return el('details.geteiltblock', { open: luecken.length > 0 ? 'open' : null }, [
    el('summary', {
      text:
        luecken.length === 0
          ? 'Was dein Kollege sieht: alles Wichtige'
          : luecken.length === 1
            ? `Was dein Kollege sieht (1 Sache fehlt noch)`
            : `Was dein Kollege sieht (${luecken.length} Sachen fehlen noch)`,
    }),

    el('p.geteilttext', {
      text:
        'Dieses Programm hat genau einen Zugang. Wer den Code hat, sieht dasselbe wie du. ' +
        'Hier steht, was davon wirklich gilt.',
    }),

    el(
      'ul.geteiltliste',
      {},
      liste.map((s) =>
        el('li.geteiltzeile', { daten: { geteilt: String(s.geteilt) } }, [
          el('span.geteiltmarke', {
            text: s.geteilt === true ? 'geteilt' : s.geteilt === null ? 'unklar' : 'nur hier',
          }),
          el('span.geteiltname', { text: s.name }),
          el('span.geteiltgrund', { text: s.grund }),
        ])
      )
    ),

    stand.ordnerGeteilt === false && wegZurMigration
      ? el('p.geteilttext', {}, [
          'Die Ordner lassen sich mit einem einzigen Befehl teilen. Er steht fertig auf der Seite ',
          el('a', { href: wegZurMigration, text: 'Datenbank erweitern', target: '_blank', rel: 'noopener' }),
          ' zum Kopieren.',
        ])
      : null,

    /*
      DIE FOTOS SIND DER GROESSERE PUNKT, und er ist Karams Entscheidung.

      Sie zu teilen heisst, sie hochzuladen, und das kostet Platz in seiner
      Datenbank und ist der einzige Schritt in diesem Programm, bei dem Bilder
      das Geraet verlassen. Ihn ungefragt zu gehen waere genau das, was
      Projektregel 1 verbietet: entscheiden, wo es keinen Pruefstein gibt.

      Deshalb steht hier, was es bedeutet, und nicht ein Knopf, der es tut.
    */
    el('p.geteilttext', {
      text:
        'Die Fotos zu teilen ginge, sie müssten dann mit hochgeladen werden. Das ist der ' +
        'einzige Schritt, bei dem Bilder dieses Gerät verlassen, und er kostet Platz bei ' +
        'Supabase. Sag Bescheid, dann baue ich es.',
    }),

    mass && mass.mittel > 0 ? hochrechnung(mass) : null,
  ])
}

/**
 * Was die gemessene Bildgroesse fuer eine ganze Saison bedeutet.
 *
 * Karam am 17.09.2026: "Ich glaube, wir sind schon bei 10 bis 100.000 Fotos in
 * der Saison, wenn nicht mehr."
 *
 * Gerechnet wird mit SEINER gemessenen Mitteilgroesse, nicht mit einer
 * angenommenen. Die Zahlen daneben sind die Mengen, die Supabase in seinen
 * Plaenen nennt (Stand 17.09.2026, aus der Dokumentation):
 *
 *   Free   1 GB Speicher,     5 GB Datenverkehr im Monat
 *   Pro    100 GB Speicher, 250 GB Datenverkehr im Monat, darueber 0,021 USD je GB
 *
 * DIE BILDER GEHOEREN IN DEN DATEISPEICHER, NICHT IN DIE DATENBANK. Die
 * Datenbank hat im Pro-Plan 8 GB, das waeren bei einem Megabyte je Foto
 * achttausend Stueck. Der Dateispeicher hat das Hundertfache und kostet je
 * Gigabyte einen Bruchteil.
 *
 * @param {{anzahl: number, bytes: number, mittel: number}} mass
 * @returns {HTMLElement}
 */
function hochrechnung(mass) {
  const gb = (anzahl) => {
    const wert = (anzahl * mass.mittel) / (1024 * 1024 * 1024)
    return wert < 10 ? `${Math.round(wert * 10) / 10} GB` : `${Math.round(wert)} GB`
  }

  return el('details.hochrechnung', {}, [
    el('summary', { text: 'Was das über eine Saison bedeutet' }),
    el('p.geteilttext', {
      text:
        `Gerechnet mit deinen gemessenen ${Math.round(mass.mittel / 1024)} KB je Bild. ` +
        'Bei Supabase gehören die Bilder in den Dateispeicher, nicht in die Datenbank: ' +
        'die Datenbank hat im Pro-Plan 8 GB, der Dateispeicher 100 GB.',
    }),
    el(
      'ul.geteiltliste',
      {},
      [10000, 50000, 100000].map((n) =>
        el('li.geteiltzeile', {}, [
          el('span.geteiltmarke', { text: gb(n) }),
          el('span.geteiltname', { text: `${n.toLocaleString('de-DE')} Fotos` }),
          el('span.geteiltgrund', {
            text:
              (n * mass.mittel) / (1024 * 1024 * 1024) <= 100
                ? 'Passt in den Pro-Plan, ohne Aufpreis.'
                : 'Über den 100 GB des Pro-Plans. Darüber etwa 0,021 USD je GB und Monat.',
          }),
        ])
      )
    ),
    el('p.geteilttext', {
      text:
        'Wie viel du gerade wirklich brauchst, steht in deinem Supabase-Konto unter ' +
        'Organization, Usage. Das kann dieses Programm nicht sehen.',
    }),
  ])
}
