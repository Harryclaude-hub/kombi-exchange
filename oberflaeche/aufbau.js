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
 * Die Zeichen der Stufen. EINZIGE Stelle dafuer.
 *
 * Karam am 17.09.2026: "Ordner brauchen ein eigenes Symbol, wenn man
 * draufklickt. Die Riesenscheine brauchen ein Symbol und die Scheine brauchen
 * auch ein eigenes Symbol."
 *
 * WARUM FUENF UND NICHT VIER
 *
 * Weil das Wort "Ordner" auf ZWEI Ebenen vorkommt: in der Ablage ordnen Ordner
 * PROJEKTE, in der Uebersicht ordnen sie RIESENSCHEINE. Genau davor hatte
 * Karam Angst. Zwei verschiedene Sachen mit demselben Wort brauchen zwei
 * verschiedene Zeichen, sonst hilft das Zeichen nicht, sondern taeuscht.
 *
 * WO ES AM MEISTEN GEBRAUCHT WIRD, nachgemessen am 17.09.2026: in der Spalte
 * links stehen Riesenscheine und Scheine beide als laufende Nummer im gleichen
 * Kasten (oberflaeche/app.js, panelRiesenscheine und panelScheine). Gleiche
 * Zahl, gleicher Kasten, verschiedene Ebene. Auf dem Telefon ist die Spalte
 * schmal, und dann ist dieser Kasten fast alles, was zu sehen ist.
 *
 * HIER STEHT NUR EIN BUCHSTABE UND EIN MERKMALSWORT (Projektregel 5). Form,
 * Farbe und Groesse stehen in stil/bauteile.css. Wird stil/ geloescht, bleibt
 * der Buchstabe stehen: er sagt immer noch, welche Stufe gemeint ist, und
 * keine einzige Zahl im Programm aendert sich.
 *
 * Der Buchstabe ist nicht Zierde, sondern der Rueckfall. Deshalb ist er der
 * Anfangsbuchstabe der Stufe und nicht irgendein huebsches Zeichen.
 *
 * @type {Record<string, {buchstabe: string, name: string}>}
 */
export const ZEICHEN = {
  projekt: { buchstabe: 'P', name: 'Projekt' },
  'ordner-projekt': { buchstabe: 'O', name: 'Ordner für Projekte' },
  'ordner-riesenschein': { buchstabe: 'O', name: 'Ordner für Riesenscheine' },
  riesenschein: { buchstabe: 'R', name: 'Riesenschein' },
  schein: { buchstabe: 'S', name: 'Einzelner Schein' },
}

/**
 * Baut das Zeichen einer Stufe.
 *
 * Gebaut wie anbieterzeichen() in oberflaeche/werkzeug.js: das Programm setzt
 * das Merkmalswort und den Inhalt, sonst nichts.
 *
 * MIT NUMMER, WENN ES EINE GIBT. Karam am 19.09.2026: "diese Symbole da
 * drinnen immer die Nummerierung von jedem." Steht eine Nummer im Kasten,
 * wandert der Buchstabe in den Vorlesetext; welche Stufe gemeint ist, sagen
 * weiter Farbe und Strichart (blau ist die Projektseite, violett die
 * Wettseite, gestrichelt haelt andere Sachen, durchgezogen ist selbst eine),
 * und der Titel sagt es in Worten.
 *
 * @param {'projekt'|'ordner-projekt'|'ordner-riesenschein'|'riesenschein'|'schein'} stufe
 * @param {string} [dazu]  Was daneben steht, fuer den Vorlesetext.
 * @param {number|string|null} [nummer]  Die laufende Nummer im Kasten.
 * @returns {HTMLElement}
 */
export function stufenzeichen(stufe, dazu = '', nummer = null) {
  const z = ZEICHEN[stufe]
  if (!z) {
    // Eine unbekannte Stufe bekommt ein Fragezeichen und sagt es. Ein leerer
    // Fleck saehe aus wie Absicht (Projektregel 1).
    return el('span.stufenzeichen', {
      daten: { stufe: 'unbekannt' },
      title: 'Unbekannte Stufe',
      text: '?',
    })
  }
  const mitNummer = nummer !== null && nummer !== undefined && String(nummer).trim() !== ''
  const name = mitNummer ? `${z.name} ${nummer}` : z.name
  return el('span.stufenzeichen', {
    daten: mitNummer ? { stufe, nummer: 'true' } : { stufe },
    title: dazu ? `${name}: ${dazu}` : name,
    text: mitNummer ? String(nummer) : z.buchstabe,
  })
}

/**
 * @typedef {object} Pfadschritt
 * @property {'projekt'|'ordner-projekt'|'ordner-riesenschein'|'riesenschein'|'schein'} stufe
 * @property {string} text
 * @property {number|string|null} [nummer]  Die laufende Nummer im Zeichen.
 * @property {(() => void)|null} [dahin]    Klick fuehrt dorthin. Ohne: hier ist man.
 */

/**
 * Die Pfadleiste: wo man gerade steht, von aussen nach innen, anklickbar.
 *
 * Karam am 19.09.2026: "mach's wirklich viel strukturierter und viel klarer,
 * wie man zu navigieren hat. Vom Projekt zum Ordner, vom Ordner zum
 * Riesenschein, zum Schein."
 *
 * Jeder Schritt traegt sein Stufenzeichen mit Nummer und seinen Namen. Alles
 * ausser dem letzten Schritt ist ein Knopf und fuehrt eine Ebene hinauf. Der
 * letzte ist der Ort, an dem man steht, und deshalb kein Knopf: ein Knopf,
 * der nichts tut, waere eine Luege.
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5).
 *
 * @param {Pfadschritt[]} schritte
 * @returns {HTMLElement}
 */
export function pfadleiste(schritte) {
  return el(
    'nav.pfadleiste',
    { 'aria-label': 'Wo du gerade bist' },
    (schritte ?? []).flatMap((schritt, i) => {
      const hier = i === schritte.length - 1 || !schritt.dahin
      const inhalt = [
        stufenzeichen(schritt.stufe, schritt.text, schritt.nummer ?? null),
        el('span.pfadtext', { text: schritt.text }),
      ]
      return [
        i > 0 ? el('span.pfadpfeil', { text: '›', 'aria-hidden': 'true' }) : null,
        hier
          ? el('span.pfadschritt', { daten: { hier: 'true' }, 'aria-current': 'page' }, inhalt)
          : el(
              'button.pfadschritt',
              {
                type: 'button',
                title: `Zurück zu: ${schritt.text}`,
                onclick: schritt.dahin ?? undefined,
              },
              inhalt
            ),
      ]
    })
  )
}

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
