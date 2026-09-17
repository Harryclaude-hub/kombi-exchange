// @ts-check
/**
 * Wie dieses Programm aufgebaut ist, in vier Stufen.
 *
 * Karam am 17.09.2026: "Bitte stell sicher, dass dieses System auch wirklich
 * im Projekt steht. Ein Projekt ist ein komplett separater Bereich, zum
 * Beispiel fuer eine Saison, fuer eine bestimmte Sportart. Und da die Ordner
 * sind einfach nur zum Ordnen der Riesenscheine. Und jeder Riesenschein sind
 * einfach hunderte oder mehrere Scheine. Ich habe einfach Angst, dass das
 * nicht funktioniert."
 *
 * WARUM DAS EINE EIGENE DATEI IST
 *
 * Dieselben vier Saetze stehen jetzt an fuenf Stellen: in der Uebersicht, in
 * der Ausgabe, in der Ablage, auf der Erklaerungsseite und in den Fenstern,
 * die beim Anlegen fragen. Staenden sie fuenfmal im Quelltext, wuerde die
 * naechste Praezisierung an vier Stellen vergessen, und dann stuende dasselbe
 * Wort an zwei Orten verschieden erklaert (Projektregel 8).
 *
 * Es sind bewusst VIER Stufen und keine drei: Karam hat vier genannt, und die
 * Verwechslung, vor der er Angst hat, sitzt genau zwischen Ordner und
 * Riesenschein.
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5).
 */

import { el } from './werkzeug.js'

/**
 * Die vier Stufen, von aussen nach innen. Die EINE Quelle fuer diesen Text.
 */
export const STUFEN = [
  {
    name: 'Projekt',
    kurz: 'Ein eigener Arbeitsplatz.',
    lang:
      'Ein komplett getrennter Bereich, zum Beispiel eine Saison oder eine Sportart. ' +
      'Ein Projekt teilt NICHTS mit den anderen: keine Scheine, keine Bilder, keine Summen. ' +
      'Du wechselst es oben in der Kopfzeile.',
  },
  {
    name: 'Ordner',
    kurz: 'Nur zum Ordnen.',
    lang:
      'Ein Ordner sortiert Riesenscheine innerhalb EINES Projekts, mehr tut er nicht. ' +
      'Er rechnet seine Riesenscheine zusammen, und er darf auch leer bleiben: ' +
      'ein Riesenschein muss in keinem Ordner liegen.',
  },
  {
    name: 'Riesenschein',
    kurz: 'EINE Wette, viele Male gesetzt.',
    lang:
      'Dieselbe Kombination, die du bei vielen Anbietern gespielt hast. ' +
      'Hier stehen der Gesamteinsatz, die Durchschnittsquote und der höchstmögliche Gewinn.',
  },
  {
    name: 'Scheine',
    kurz: 'Die einzelnen Wettscheine.',
    lang:
      'Hunderte oder mehr je Riesenschein, einer je Anbieter. ' +
      'Jeder kommt aus einem Bildschirmfoto, und das Bild bleibt daneben stehen.',
  },
]

/**
 * Der Aufbau als Kette, zum Darüberschreiben einer Seite.
 *
 * Kurz gehalten: wer die Seite schon kennt, soll nicht jedes Mal vier Absaetze
 * ueberspringen muessen. Ausfuehrlich steht es im Aufklapper darunter und auf
 * der Erklaerungsseite.
 *
 * @returns {HTMLElement}
 */
export function aufbaukette() {
  return el(
    '.aufbaukette',
    { title: STUFEN.map((s) => `${s.name}: ${s.kurz}`).join('  |  ') },
    STUFEN.flatMap((s, i) => [
      i > 0 ? el('span.aufbaupfeil', { text: '>', 'aria-hidden': 'true' }) : null,
      el('span.aufbaustufe', {}, [
        el('span.aufbauname', { text: s.name }),
        el('span.aufbaukurz', { text: s.kurz }),
      ]),
    ])
  )
}

/**
 * Der Aufbau ausfuehrlich, zugeklappt.
 *
 * Ein <details> und kein eigenes Auf und Zu: faellt stil/ weg, klappt es
 * trotzdem, und es braucht keinen Zustand, der mit irgendetwas auseinanderlaufen
 * koennte.
 *
 * @param {string} [titel]
 * @returns {HTMLElement}
 */
export function aufbaublock(titel = 'Wie dieses Programm aufgebaut ist') {
  return el('details.aufbaublock', {}, [
    el('summary', { text: titel }),
    el(
      'ol.aufbauliste',
      {},
      STUFEN.map((s) =>
        el('li', {}, [
          el('strong.aufbaulistename', { text: s.name }),
          el('span.aufbaulisttext', { text: s.lang }),
        ])
      )
    ),
  ])
}
