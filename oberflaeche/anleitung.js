// @ts-check
/**
 * Die Anleitung beim ersten Mal.
 *
 * Karam am 16.09.2026: "wenn man sich neu anmeldet, also das erste Mal, wo man
 * mit diesem Browser reingeht, kann man eine Anleitung bekommen, was jeder
 * Knopf macht und wie man einen Riesenschein macht und wie man das ueber eine
 * ganze Saison gescheit in der Buchhaltung eintraegt. Man kann es
 * ueberspringen, und bitte fuege einen Button hinzu, wo diese Erklaerung drauf
 * ist, und man kann dieses Tutorial nochmal starten, wenn man will."
 *
 * WARUM IM BROWSER UND NICHT IN DER DATENBANK
 *
 * "Habe ich die Anleitung schon gesehen" ist eine Frage an das GERAET, nicht
 * an das Konto. Wer sich zum ersten Mal an einem neuen Rechner anmeldet, soll
 * sie wieder bekommen: dort kennt er die Oberflaeche ja noch nicht. Deshalb
 * localStorage und nicht kombi.projekte.
 *
 * WARUM EIN <dialog> UND KEIN EIGENER KASTEN
 *
 * showModal() bringt die Tastaturfalle, die Esc-Taste und das Abdunkeln des
 * Hintergrunds von sich aus mit. Selbst gebaut waeren das drei Stellen, an
 * denen man etwas vergisst, und eine davon ist immer der Tastaturweg.
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5). Faellt stil/ weg,
 * ist die Anleitung ein schlichter Kasten mit Text und Knoepfen und laesst
 * sich immer noch lesen und schliessen.
 */

import { el, fuelle } from './werkzeug.js'

/** Unter welchem Schluessel steht, dass die Anleitung schon lief. */
const SCHLUESSEL = 'kombi-anleitung-gesehen'

/**
 * Die Schritte.
 *
 * Reihenfolge nach dem Weg durch das Programm, nicht nach der Reihenfolge der
 * Reiter: zuerst wofuer das Ganze gut ist, dann der Weg vom Foto zur Zahl,
 * dann was man ueber eine ganze Saison damit macht.
 *
 * "wo" ist der Reiter, um den es geht, damit die Anleitung sagen kann, wohin
 * man klicken muss. Der Schluessel ist derselbe wie in ANSICHTEN in app.js.
 */
const SCHRITTE = [
  {
    wo: '',
    titel: 'Wofuer dieses Programm da ist',
    text:
      'Du setzt dieselbe Wette bei vielen Anbietern gleichzeitig, zusammen über zwanzigtausend ' +
      'Euro. Danach weiß niemand mehr auf einen Blick, wie viel insgesamt draußen ist und was ' +
      'zurückkommen kann. Genau das rechnet dieses Programm aus, aus deinen Bildschirmfotos.',
    punkte: [
      'Du tippst nichts ab. Du machst Fotos, das Programm liest sie.',
      'Gleiche Wetten werden zu EINEM Riesenschein zusammengefasst.',
      'Wo das Programm sich nicht sicher ist, sagt es das und fragt dich.',
    ],
    achtung:
      'Alles, was rot oder gelb ist, will angesehen werden. Das Programm erfindet lieber nichts, ' +
      'als etwas zu raten.',
  },
  {
    wo: 'start',
    titel: 'Die Uebersicht: deine Startseite',
    text:
      'Hier landest du beim Aufmachen. Ganz oben steht, in welchem Projekt du bist und über ' +
      'welchen Zeitraum es läuft. Darunter die drei Zahlen, wegen derer du herschaust.',
    punkte: [
      'INSGESAMT GESETZT: was wirklich an Geld draussen ist.',
      'KANN ZURÜCKKOMMEN: was hereinkäme, wenn alles Offene gewinnt, mit Einsatz.',
      'NOCH IM RISIKO: was noch verloren gehen kann. Sobald etwas entschieden ist, steht dort stattdessen ERGEBNIS BISHER.',
      'Darunter jeder Riesenschein als Kachel. Ein Klick oeffnet ihn ganz.',
    ],
    achtung:
      'Steht dort der rote Kasten "Währungen gemischt", sind Euro, Dollar und Krypto in einer ' +
      'Summe gelandet. Das Programm rechnet NIE um. Die Zahlen daneben sind dann keine Summen.',
  },
  {
    wo: 'aufnahme',
    titel: 'Aufnahme: aus einem Foto wird ein Schein',
    text:
      'Drei Wege hinein, und der dritte geht immer. Danach ein Druck auf den Leseknopf, und das ' +
      'Programm liest jede Karte einzeln.',
    punkte: [
      'BILDSCHIRMFOTO: der Browser fragt, welches Fenster. Danach ziehst du den Rahmen selbst.',
      'AUS ZWISCHENABLAGE: Windows-Taste, Umschalt, S. Dann Strg+V irgendwo auf der Seite.',
      'FOTO HOCHLADEN: der gewohnte Dateidialog, auch für viele Bilder auf einmal.',
      'Rechne mit etwa zwei Sekunden je Schein. Bei hundert Scheinen also gut drei Minuten.',
    ],
    achtung:
      'Bei einem ganzen Browserfenster schneidet das Programm quer durch die Seite. Zieh dann ' +
      'einen Rahmen um die Wettliste, sonst landet Text aus der Menüleiste in deinen Scheinen.',
  },
  {
    wo: 'scheine',
    titel: 'Scheine: nachsehen und berichtigen',
    text:
      'Jeder gelesene Wettschein ist eine Zeile. Hier gehst du einmal durch, von oben nach unten. ' +
      'Zuerst alles mit Fehler, dann alles mit Warnung.',
    punkte: [
      'Eine falsche Zahl einfach ueberschreiben. Komma und Punkt gehen beide.',
      'Der Streifen links an einer Zeile ist rot bei Fehler und gelb bei Warnung.',
      'Ganz unten steht der Resttopf: Scheine, die zu keiner Wette passen. Die sind nicht weg, du kannst sie einzeln mitzählen lassen.',
      'Die Tabelle lässt sich nach rechts schieben, dort stehen die letzten Spalten.',
    ],
    achtung:
      'Die Farbe hinter einem Feld ist die Lesesicherheit, nicht die Richtigkeit. Ein grünes Feld ' +
      'kann falsch sein. Wo Einsatz mal Quote die Auszahlung ergibt, hat das Programm selbst ' +
      'gegengerechnet, und darauf ist Verlass.',
  },
  {
    wo: 'positionen',
    titel: 'Wie ein Riesenschein entsteht',
    text:
      'Das ist der wichtigste Punkt: einen Riesenschein LEGST DU NICHT AN. Er entsteht von selbst, ' +
      'sobald zwei Scheine dieselbe Wette tragen. Das Programm vergleicht Spieler, Spiel, Marktart ' +
      'und Linie und führt zusammen, was zusammengehört.',
    punkte: [
      'Gleiche Wette bei acht Anbietern: ein Riesenschein mit acht Scheinen darin.',
      'In der Mitte stehen seine Zahlen, rechts jeder einzelne Schein nummeriert.',
      'Oben rechts kannst du jederzeit ein Foto nachreichen. Der Schein wird gelesen und faellt in diesen Riesenschein.',
      'Passt einer doch nicht dazu, trennst du ihn im Reiter Scheine in der Spalte Riesenschein.',
    ],
    achtung:
      'Das Programm fasst mit Absicht NICHT zusammen, wenn es sich nicht sicher ist. Gibbs auf ' +
      'ueber 84.5 und Gibbs auf ueber 82.5 sind zwei verschiedene Wetten mit verschiedenem Risiko. ' +
      'Nicht zusammenfassen ist sicher, falsch zusammenfassen wäre es nicht.',
  },
  {
    wo: 'positionen',
    titel: 'Der Multiplikator, und warum er nicht die angezeigte Quote ist',
    text:
      'Die Quote, die der Buchmacher anzeigt, ist gerundet. Steht auf dem Schein Einsatz UND ' +
      'Auszahlung, rechnet das Programm den genauen Multiplikator zurück, statt der Anzeige zu ' +
      'glauben.',
    punkte: [
      'Stake zeigt 1,84. Aus 5.000 Einsatz und 9.175,9955 Auszahlung ergeben sich 1,8351991.',
      '5.000 mal 1,84 wären 9.200. Das sind vierundzwanzig Euro Unterschied auf EINEM Schein.',
      'Bei vier von fuenf deiner Anbieter ist die angezeigte Quote nicht die echte.',
    ],
    achtung:
      'Deshalb ist die EFFEKTIVE QUOTE im Riesenschein einsatzgewichtet und nicht der Mittelwert ' +
      'der angezeigten Quoten. Ein Mittelwert waere bei ungleichen Einsaetzen schlicht falsch.',
  },
  {
    wo: 'ablage',
    titel: 'Eine ganze Saison ordentlich fuehren',
    text:
      'Die NFL-Saison läuft bis nächsten Sommer. Damit du im Februar noch weißt, was im ' +
      'September war, brauchst du eine Ordnung, und die ist bewusst einfach gehalten.',
    punkte: [
      'EIN PROJEKT IST EINE RUNDE. Alles, was du in einem Zeitraum gesetzt hast, mit Fotos, Scheinen und Riesenscheinen. Ein Spieltag, eine Woche, ein Monat, wie du willst.',
      'EIN ORDNER IST NUR EINE SCHUBLADE dafür. Er entsteht, sobald du ein Projekt hineinziehst, und verschwindet von selbst, wenn du das letzte herausnimmst. Du musst ihn nicht anlegen und nicht aufräumen.',
      'Vorschlag für die Saison: ein Ordner je Monat, ein Projekt je Spieltag. Dann findest du im Februar den 14. September in zwei Klicks.',
      'Was du oft brauchst, pinnst du an. Angepinntes steht immer oben, egal wie sortiert wird.',
      'Das Datum steht an jeder Zeile. Umbenennen per Doppelklick auf den Namen.',
    ],
    achtung:
      'Löschen nimmt alle Scheine, Riesenscheine und Bilder des Projekts mit und lässt sich ' +
      'nicht rueckgaengig machen. Die Rueckfrage nennt deshalb die Namen.',
  },
  {
    wo: 'ausgabe',
    titel: 'Ausgabe: die Zahlen fuer die Buchhaltung',
    text:
      'Das Programm ist kein Archiv für die Steuer. Die Excel-Mappe ist es. Lade sie regelmäßig ' +
      'herunter, am besten nach jedem abgeschlossenen Spieltag.',
    punkte: [
      'Ein Knopf für den offenen Riesenschein, einer für das ganze Projekt.',
      'Die Mappe hat mehrere Blätter: jeder einzelne Schein eine Zeile, jede zusammengefasste Wette eine Zeile, dazu ein Blatt je Anbieter und eines mit allen Hinweisen.',
      'CSV ist dasselbe als einfache Textdatei, für Programme, die kein Excel lesen.',
      'In der Mappe kannst du eigene Spalten daneben rechnen, ohne hier etwas zu ändern.',
    ],
    achtung:
      'Die Summenzeile ist nur bei EINER Währung aussagekräftig. Steht eine Warnung darunter, ' +
      'sind Euro und Dollar in derselben Spalte gelandet.',
  },
  {
    wo: '',
    titel: 'Die Knöpfe, die immer da sind',
    text: 'Diese findest du auf jeder Seite, egal wo du gerade bist.',
    punkte: [
      'PANEL LINKS: die Wege zu allen Seiten, darunter das Angeheftete. Der Knopf oben im Panel klappt es schmal, ganz weg geht es nie.',
      'ERKLÄRUNG oben im Kopf: springt zu der Seite, auf der du gerade stehst, und erklärt sie ausführlich.',
      'ANLEITUNG oben im Kopf: startet genau diese Anleitung noch einmal.',
      'DIE NUMMER MIT DEM DATUM oben rechts ist kein Datum, sondern die Fassung des Programms, die dein Browser geladen hat. Siehst du eine Änderung nicht, klick darauf: die Seite wird dann wirklich neu geholt und nicht aus dem Zwischenspeicher genommen.',
      'ANSICHT: schaltet zwischen System, Hell und Dunkel.',
      'Stimmt etwas nicht, erscheint unten eine ruhige Leiste. Ein Klick klappt alle Hinweise auf.',
    ],
    achtung:
      'Der Zugangscode steht nirgends im Programm und ist auch in der Datenbank nicht abrufbar, ' +
      'dort liegt nur ein Fingerabdruck. Bewahr ihn auf. "Code wechseln" oben im Kopf gibt dir ' +
      'einen neuen, solange du noch angemeldet bist.',
  },
]

/**
 * Zeigt die Anleitung, wenn dieser Browser sie noch nie gezeigt hat.
 *
 * Wird nach dem Anmelden aufgerufen. Tut nichts, wenn sie schon lief.
 */
export function zeigeWennNeu() {
  let gesehen = false
  try {
    gesehen = localStorage.getItem(SCHLUESSEL) === 'ja'
  } catch {
    // Kein Zugriff auf den Speicher des Browsers: dann lieber einmal zu oft
    // zeigen als nie. Ueberspringen ist einen Klick entfernt.
  }
  if (gesehen) return
  zeige()
}

/**
 * Zeigt die Anleitung, immer. Der Knopf im Kopf ruft das auf.
 */
export function zeige() {
  let schritt = 0

  const inhalt = el('.anleitungsinhalt')
  const punkte = el('.anleitungspunkte')
  const knoepfe = el('.anleitungsknoepfe')

  const dialog = /** @type {HTMLDialogElement} */ (
    el('dialog.dialog.anleitung', {}, [
      el('.anleitungskopf', {}, [
        el('span.anleitungsmarke', { text: 'ANLEITUNG' }),
        punkte,
      ]),
      inhalt,
      knoepfe,
    ])
  )

  function merkeGesehen() {
    try {
      localStorage.setItem(SCHLUESSEL, 'ja')
    } catch {
      // Ohne Gedaechtnis kommt sie beim naechsten Mal wieder. Das ist
      // unangenehm, aber kein Grund, das Programm anzuhalten.
    }
  }

  function schliesse() {
    merkeGesehen()
    dialog.close()
  }

  function zeichne() {
    const s = SCHRITTE[schritt]
    if (!s) return
    const letzter = schritt === SCHRITTE.length - 1

    fuelle(inhalt, [
      el('h2.anleitungstitel', { text: s.titel }),
      s.wo ? el('span.anleitungswo', { text: `Reiter ${reiterName(s.wo)}` }) : null,
      el('p.anleitungstext', { text: s.text }),
      el('ul.anleitungsliste', {}, s.punkte.map((p) => el('li', { text: p }))),
      el('.anleitungsachtung', {}, [el('strong', { text: 'Achtung: ' }), s.achtung]),
    ])

    fuelle(
      punkte,
      SCHRITTE.map((_, i) =>
        el('span.anleitungspunkt', {
          daten: { an: String(i === schritt), erledigt: String(i < schritt) },
          title: `Schritt ${i + 1} von ${SCHRITTE.length}`,
        })
      )
    )

    fuelle(knoepfe, [
      el('button.knopf.knopf-klein.anleitung-weg', {
        type: 'button',
        text: letzter ? 'Schließen' : 'Überspringen',
        title: 'Die Anleitung lässt sich oben im Kopf jederzeit neu starten.',
        onclick: schliesse,
      }),
      el('span.anleitungszaehler', { text: `${schritt + 1} von ${SCHRITTE.length}` }),
      el('button.knopf.knopf-klein', {
        type: 'button',
        text: 'Zurück',
        disabled: schritt === 0 ? 'disabled' : null,
        onclick: () => {
          if (schritt > 0) schritt -= 1
          zeichne()
        },
      }),
      el('button.knopf.knopf-haupt', {
        type: 'button',
        text: letzter ? 'Fertig' : 'Weiter',
        onclick: () => {
          if (letzter) {
            schliesse()
            return
          }
          schritt += 1
          zeichne()
        },
      }),
    ])
  }

  zeichne()
  document.body.append(dialog)
  // Auch die Esc-Taste zaehlt als gesehen. Wer sie drueckt, hat entschieden.
  dialog.addEventListener('close', () => {
    merkeGesehen()
    dialog.remove()
  })
  dialog.showModal()
}

/**
 * Der Name eines Reiters, wie er oben steht.
 *
 * Steht hier und nicht in app.js, damit die Anleitung app.js nicht einbinden
 * muss: app.js bindet seinerseits die Anleitung ein, und das waere ein Ring.
 * Die Namen sind Text und aendern sich selten; laufen sie doch einmal
 * auseinander, faellt es beim Lesen der Anleitung sofort auf.
 *
 * @param {string} schluessel
 * @returns {string}
 */
function reiterName(schluessel) {
  const namen = {
    start: 'Uebersicht',
    positionen: 'Riesenscheine',
    scheine: 'Scheine',
    aufnahme: 'Aufnahme',
    ausgabe: 'Ausgabe',
    ablage: 'Ablage',
    hilfe: 'Erklaerung',
  }
  return namen[schluessel] ?? schluessel
}
