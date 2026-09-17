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
 * @param {{belegt: number}|null} [platz] Wie viel die Bilder belegen, gemessen.
 * @returns {Sache[]}
 */
export function sachen(stand, platz = null) {
  const megabyte = platz ? Math.round((platz.belegt / (1024 * 1024)) * 10) / 10 : null

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
        (megabyte === null
          ? 'Dein Kollege sieht die Zahlen, aber nicht die Fotos.'
          : `Hier liegen gerade ${megabyte} MB. Dein Kollege sieht die Zahlen, aber nicht die Fotos.`),
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
 * @param {{belegt: number}|null} [platz]
 * @param {string} [wegZurMigration]
 * @returns {HTMLElement}
 */
export function geteiltblock(stand, platz = null, wegZurMigration = '') {
  const liste = sachen(stand, platz)
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
        'einzige Schritt, bei dem Bilder dieses Gerät verlassen, und er kostet Platz in ' +
        'deiner Datenbank. Sag Bescheid, dann baue ich es.',
    }),
  ])
}
