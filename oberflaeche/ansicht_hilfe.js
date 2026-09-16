// @ts-check
/**
 * Ansicht "Hilfe".
 *
 * Karam am 16.09.2026: "es ist mir ein bisschen zu kompliziert, wirklich.
 * Erklaer bitte jeden Bereich. Gib auch wirklich so eine Page, wo steht, was
 * man machen soll, wie man es machen soll, dass es nicht kompliziert ist."
 *
 * Diese Seite ist die Antwort darauf. Sie erklaert erst den Weg von einem Foto
 * bis zur Excel-Datei, dann jeden Reiter einzeln: was dort steht, was man dort
 * tut, und woran man erkennt, dass etwas nicht stimmt.
 *
 * WARUM SCHAUBILDER UND KEINE BILDSCHIRMFOTOS
 *
 * Ein Bildschirmfoto veraltet mit der naechsten Aenderung, und dann erklaert
 * die Hilfe eine Oberflaeche, die es nicht mehr gibt. Das ist schlimmer als
 * keine Hilfe, weil man ihr glaubt. Die Schaubilder hier sind absichtlich
 * grob: sie zeigen, WO etwas liegt, nicht wie es aussieht.
 *
 * Diese Datei rechnet nichts und speichert nichts. Sie setzt nur Klassennamen,
 * Farben und Groessen stehen in stil/.
 */

import { el, fuelle } from './werkzeug.js'
import * as Zustand from './zustand.js'
import * as Anleitung from './anleitung.js'

/**
 * Zeichnet die Ansicht.
 *
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  // Aus welcher Ansicht heraus die Erklaerung geoeffnet wurde. Der
  // Erklaerungsknopf im Kopf schreibt das hinein. Ist es leer, faengt die
  // Seite von vorne an.
  const herkunft = Zustand.hole().hilfeZu ?? null

  fuelle(ziel, [
    el('.hilfeseite', {}, [
      einleitung(),
      wieManSichBewegt(),
      derWeg(),
      ...BEREICHE.map((b) => bereich(b, b.schluessel === herkunft)),
      begriffe(),
      wennEtwasNichtStimmt(),
    ]),
  ])

  // Zu dem Abschnitt springen, aus dem Karam gekommen ist. Ohne das landet er
  // ganz oben und muss eine lange Seite herunterblaettern, um zu lesen, was
  // die Seite erklaert, auf der er eben noch stand.
  if (herkunft) {
    const ziel2 = ziel.querySelector('[data-bereich="' + herkunft + '"]')
    // scrollIntoView und keine gerechnete Position: die Hoehe der Kopfzeile
    // haengt am Design, und die darf hier nicht nachgebaut werden
    // (Projektregel 5).
    if (ziel2 && typeof ziel2.scrollIntoView === 'function') {
      ziel2.scrollIntoView({ block: 'start' })
    }
  }
}

/**
 * Wie man sich im Programm bewegt.
 *
 * Karam am 16.09.2026: "der erklaert jede einzelne Seite in der Website, wie
 * man das navigieren soll." Das ist der zweite Teil davon: nicht was auf einer
 * Seite steht, sondern wie man ueberhaupt von einer zur naechsten kommt.
 *
 * @returns {HTMLElement}
 */
function wieManSichBewegt() {
  const wege = [
    [
      'Das Panel links',
      'Steht immer da, auf jeder Seite. Oben die Wege zu allen Seiten, darunter das, was du dir angeheftet hast. Der Knopf oben im Panel klappt es schmal, dann bleiben nur die Zeichen stehen. Ganz weg geht es nie.',
    ],
    [
      'Die Reiter im Kopf',
      'Dieselben Wege noch einmal, als Reiter. Die Zahl neben einem Reiter sagt, wie viel dort liegt.',
    ],
    [
      'Anheften',
      'An jedem Riesenschein sitzt oben rechts der Knopf "Anheften". Was angeheftet ist, steht im Panel links und ist von jeder Seite aus einen Klick entfernt. Bei sechzig Scheinen ist das der Unterschied zwischen Suchen und Finden.',
    ],
    [
      'Die drei Zahlen ganz oben',
      'Sie stehen ueber jeder Seite und aendern sich nie mit der Seite: gesetzt, moeglich, und was schon feststeht oder noch im Risiko ist.',
    ],
    [
      'Der Knopf mit dem Datum',
      'Oben rechts steht die Fassung, mit der dieses Fenster laeuft. Siehst du eine Aenderung nicht, obwohl sie fertig sein soll, klick darauf: die Seite wird dann wirklich neu geholt und nicht aus dem Zwischenspeicher des Browsers.',
    ],
    [
      'Hinweise',
      'Stimmt etwas nicht, erscheint unten eine ruhige Leiste statt eines Kastens, den du wegklicken musst. Ein Klick darauf klappt alle Hinweise auf.',
    ],
  ]

  return el('.hilfeblock', {}, [
    el('h2.hilfetitel', { text: 'Wie du dich bewegst' }),
    el('p.hilfetext', {
      text: 'Es gibt zwei Wege zu jeder Seite, und einen Weg, dir zu merken, was du oft brauchst.',
    }),
    el('dl.hilfebegriffe', {}, wege.flatMap(([wort, was]) => [
      el('dt.hilfewort', { text: wort }),
      el('dd.hilfeerklaerung', { text: was }),
    ])),
  ])
}

/** @returns {HTMLElement} */
function einleitung() {
  return el('.hilfeblock.hilfe-einleitung', {}, [
    el('h2.hilfetitel', { text: 'Was dieses Programm macht' }),
    el('p.hilfetext', {
      text:
        'Du setzt dieselbe Wette bei vielen Anbietern gleichzeitig. Von jedem Wettschein machst ' +
        'du ein Bildschirmfoto. Dieses Programm liest die Fotos, fuehrt gleiche Wetten zu einem ' +
        'Riesenschein zusammen und sagt dir: wie viel hast du gesetzt, was kann herauskommen, ' +
        'und was ist am Ende wirklich herausgekommen.',
    }),
    el('p.hilfetext', {
      text:
        'Du musst nichts abtippen. Aber du musst hinsehen: wo das Programm sich nicht sicher ist, ' +
        'sagt es das, und dann entscheidest du. Alles, was rot oder gelb ist, will angesehen werden.',
    }),

    // Der Weg zur gefuehrten Anleitung, gleich oben auf der Erklaerung.
    // Diese Seite ist zum Nachschlagen, die Anleitung fuehrt in neun Schritten
    // durch den Weg. Wer hier landet und eigentlich das andere sucht, soll es
    // finden, ohne die ganze Seite zu lesen.
    el('.hilfeanleitung', {}, [
      el('p.hilfetext', {
        text:
          'Lieber Schritt fuer Schritt durchgefuehrt werden? Die Anleitung geht in neun Schritten ' +
          'durch den ganzen Weg, vom ersten Foto bis zur Buchhaltung ueber eine ganze Saison.',
      }),
      el('button.knopf.knopf-haupt', {
        type: 'button',
        text: 'Anleitung starten',
        onclick: () => Anleitung.zeige(),
      }),
    ]),
  ])
}

/** Der Weg von einem Foto bis zur Excel, in fuenf Schritten. */
function derWeg() {
  const schritte = [
    {
      nr: '1',
      titel: 'Fotos hereinholen',
      wo: 'Reiter Aufnahme',
      text:
        'Mit Windows-Taste + Umschalt + S einen Ausschnitt machen, dann hier Strg+V druecken. ' +
        'Oder die Bilder mit der Maus in das gestrichelte Feld ziehen. Schneide am besten so zu, ' +
        'dass nur die Wetten drauf sind, die zusammengehoeren.',
    },
    {
      nr: '2',
      titel: 'Lesen lassen',
      wo: 'Reiter Aufnahme, Knopf unten',
      text:
        'Das Programm zerlegt jedes Bild in einzelne Wettscheine und liest sie. Rechne mit etwa ' +
        'zwei Sekunden je Schein. Ueber jedem Bild steht danach, wie viele Scheine gefunden wurden.',
    },
    {
      nr: '3',
      titel: 'Nachsehen und berichtigen',
      wo: 'Reiter Scheine',
      text:
        'Jede gelesene Zahl steht hier in einem Feld und laesst sich aendern. Die Farbe hinter ' +
        'einem Feld sagt, wie sicher sich das Programm war. Was du von Hand einträgst, wird nie ' +
        'wieder ueberschrieben.',
    },
    {
      nr: '4',
      titel: 'Den Riesenschein ansehen',
      wo: 'Reiter Riesenscheine',
      text:
        'Gleiche Wetten stehen jetzt als eine Position zusammen: Gesamteinsatz, moegliche ' +
        'Auszahlung, Multiplikator, und was bisher zurueckkam.',
    },
    {
      nr: '5',
      titel: 'Ausgeben',
      wo: 'Reiter Ausgabe',
      text: 'Als Excel-Mappe oder als CSV herunterladen. Eine Zeile je Schein, dazu die Summen.',
    },
  ]

  return el('.hilfeblock', {}, [
    el('h2.hilfetitel', { text: 'Der Weg, in fuenf Schritten' }),
    el(
      'ol.hilfeschritte',
      {},
      schritte.map((s) =>
        el('li.hilfeschritt', {}, [
          el('span.schrittnummer', { text: s.nr }),
          el('.schrittinhalt', {}, [
            el('.schritttitel', { text: s.titel }),
            el('.schrittwo', { text: s.wo }),
            el('p.hilfetext', { text: s.text }),
          ]),
        ])
      )
    ),
  ])
}

/**
 * Ein grobes Schaubild eines Bereichs.
 *
 * Bewusst schematisch: es zeigt, WO etwas liegt, nicht wie es aussieht. Alle
 * Farben kommen ueber currentColor aus dem Stylesheet, hier steht keine.
 *
 * @param {{x: number, y: number, b: number, h: number, name: string, betont?: boolean}[]} kaesten
 * @returns {SVGElement}
 */
function schaubild(kaesten) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 320 150')
  svg.setAttribute('class', 'hilfebild')
  svg.setAttribute('role', 'img')

  for (const k of kaesten) {
    const r = document.createElementNS(NS, 'rect')
    r.setAttribute('x', String(k.x))
    r.setAttribute('y', String(k.y))
    r.setAttribute('width', String(k.b))
    r.setAttribute('height', String(k.h))
    r.setAttribute('rx', '4')
    r.setAttribute('class', k.betont ? 'bildkasten bildkasten-betont' : 'bildkasten')
    svg.append(r)

    const t = document.createElementNS(NS, 'text')
    t.setAttribute('x', String(k.x + k.b / 2))
    t.setAttribute('y', String(k.y + k.h / 2 + 3))
    t.setAttribute('text-anchor', 'middle')
    t.setAttribute('class', 'bildschrift')
    t.textContent = k.name
    svg.append(t)
  }
  return svg
}

/*
  Die Beschreibung jedes Reiters.

  "schluessel" ist derselbe wie in ANSICHTEN in oberflaeche/app.js. Daran
  erkennt die Erklaerung, aus welcher Ansicht Karam gekommen ist, und hebt
  genau diesen Abschnitt hervor. Karam am 16.09.2026: "oben in den Header
  einfach einen Button hinzufuegen, der heisst Erklaerung, und zwar der
  erklaert jede einzelne Seite in der Website, wie man das navigieren soll."
*/
const BEREICHE = [
  {
    schluessel: 'start',
    reiter: 'Uebersicht',
    wofuer: 'Die Startseite: wo du stehst, in einem Blick.',
    bild: [
      { x: 8, y: 8, b: 304, h: 22, name: 'PROJEKT  NFL Saison 2026/27  Sep bis Feb', betont: true },
      { x: 8, y: 36, b: 98, h: 44, name: 'gesetzt' },
      { x: 111, y: 36, b: 98, h: 44, name: 'kann zurueck' },
      { x: 214, y: 36, b: 98, h: 44, name: 'im Risiko' },
      { x: 8, y: 86, b: 150, h: 54, name: 'Riesenschein 1' },
      { x: 162, y: 86, b: 150, h: 54, name: 'Riesenschein 2' },
    ],
    machen: [
      'Ganz oben steht, in welchem Projekt du gerade bist, und ueber welchen Zeitraum es laeuft. Ein Projekt darf Monate oder Jahre umfassen.',
      'Darunter die drei Zahlen: wie viel insgesamt gesetzt ist, was zurueckkommen kann, und was noch im Risiko steht.',
      'Dann jeder Riesenschein als Kachel. Ein Klick darauf oeffnet ihn ganz, mit allen Einzelscheinen.',
      'Ganz unten die Wege: jeder Reiter mit einem Satz dazu, was er tut.',
    ],
    achtung:
      'Steht neben den Zahlen der rote Kasten "Waehrungen gemischt", sind Euro, Dollar und Krypto ' +
      'in derselben Summe gelandet. Dann sind die Zahlen daneben keine Summen, und du darfst dich ' +
      'nicht auf sie verlassen. Das Programm rechnet Waehrungen NIE um.',
  },
  {
    schluessel: 'aufnahme',
    reiter: 'Aufnahme',
    wofuer: 'Hier kommen die Bildschirmfotos herein und werden gelesen.',
    bild: [
      { x: 8, y: 8, b: 304, h: 26, name: 'Bilder hierher ziehen oder Strg+V', betont: true },
      { x: 8, y: 40, b: 98, h: 68, name: 'Foto 1' },
      { x: 111, y: 40, b: 98, h: 68, name: 'Foto 2' },
      { x: 214, y: 40, b: 98, h: 68, name: 'Foto 3' },
      { x: 8, y: 114, b: 304, h: 26, name: 'Alles lesen', betont: true },
    ],
    machen: [
      'Fotos hereinziehen, einfuegen oder direkt aufnehmen.',
      'Die Fotos liegen klein nebeneinander. Ein Klick aufs Bild oder der Knopf "Groesser" macht eines gross.',
      'Steht ueber einem Bild eine andere Zahl Scheine, als wirklich drauf sind, dann zieh einen Rahmen um die Wettliste.',
      'Ein Foto, das nicht hierher gehoert, entfernst du mit "Loeschen". Die daraus gelesenen Scheine gehen mit, du wirst vorher gefragt.',
      'Dann unten auf den Leseknopf.',
    ],
    achtung:
      'Bei einem ganzen Browserfenster schneidet das Programm quer durch die Seite. Dann unbedingt ' +
      'einen Rahmen um die Wettliste ziehen, sonst landet Text aus der Menueleiste in den Scheinen.',
  },
  {
    schluessel: 'scheine',
    reiter: 'Scheine',
    wofuer: 'Jeder gelesene Wettschein als eine Zeile, zum Nachsehen und Berichtigen.',
    bild: [
      { x: 8, y: 8, b: 304, h: 22, name: '12 Scheine   2 mit Fehler   1 zu pruefen', betont: true },
      { x: 8, y: 36, b: 304, h: 20, name: 'Anbieter | Nr | Einsatz | Quote | Auszahlung' },
      { x: 8, y: 60, b: 304, h: 20, name: 'PS3838   3778262388   2.315,98   1,826' },
      { x: 8, y: 84, b: 304, h: 20, name: 'Stake    ohne Nr      5.000,00   1,84' },
      { x: 8, y: 108, b: 304, h: 32, name: 'aufgeklappt: Bild, Notiz, Loeschen', betont: true },
    ],
    machen: [
      'Von oben nach unten durchgehen. Zuerst alles mit Fehler, dann alles mit Warnung.',
      'Eine falsche Zahl einfach ueberschreiben. Komma und Punkt gehen beide.',
      'Auf "mehr" klicken zeigt den Bildausschnitt, den Rohtext, eine Notiz und den Loeschknopf.',
      'Gehoert ein Schein nicht in die Rechnung, gibt es zwei Wege: "Ganz aus der Rechnung nehmen" laesst ihn sichtbar stehen, "Diesen Schein loeschen" entfernt ihn.',
    ],
    achtung:
      'Die Farbe hinter einem Feld ist die Lesesicherheit, nicht die Richtigkeit. Ein gruenes Feld ' +
      'kann falsch sein. Wo Einsatz mal Quote die Auszahlung ergibt, hat das Programm selbst ' +
      'nachgerechnet, und darauf ist Verlass.',
  },
  {
    schluessel: 'positionen',
    reiter: 'Riesenscheine',
    wofuer: 'Dieselbe Wette, viele Male gesetzt, als eine Position.',
    bild: [
      { x: 8, y: 8, b: 92, h: 132, name: 'Liste' },
      { x: 106, y: 8, b: 206, h: 30, name: 'Name der Wette', betont: true },
      { x: 106, y: 44, b: 48, h: 34, name: 'Einsatz' },
      { x: 158, y: 44, b: 48, h: 34, name: 'moeglich' },
      { x: 210, y: 44, b: 48, h: 34, name: 'Quote' },
      { x: 262, y: 44, b: 50, h: 34, name: 'Anzahl' },
      { x: 106, y: 84, b: 206, h: 24, name: 'Notiz' },
      { x: 106, y: 114, b: 206, h: 26, name: 'die einzelnen Scheine' },
    ],
    machen: [
      'Links die Liste aller Riesenscheine, rechts die Einzelheiten des gewaehlten.',
      'Oben die vier Zahlen, wegen derer man herschaut. Der Rest steht einen Klick entfernt unter "Alle Zahlen".',
      'Der Name laesst sich ueberschreiben. Die Notiz ist fuer dich: warum diese Wette, was ist aufgefallen.',
      'Gehoert ein Schein nicht in diese Gruppe, aendere ihn im Reiter Scheine in der Spalte "Riesenschein".',
    ],
    achtung:
      'Stehen mehrere Waehrungen in einer Gruppe, gibt es keine Gesamtsumme. Euro, Dollar und ' +
      'Krypto werden nie zusammengezaehlt und nie umgerechnet.',
  },
  {
    schluessel: 'ausgabe',
    reiter: 'Ausgabe',
    wofuer:
      'Deine Zahlen aus dem Programm herausholen: als Excel-Mappe zum Aufheben und Weiterrechnen.',
    bild: [
      { x: 8, y: 8, b: 148, h: 34, name: 'Excel: dieser Riesenschein', betont: true },
      { x: 164, y: 8, b: 148, h: 34, name: 'Excel: ganzes Projekt', betont: true },
      { x: 8, y: 50, b: 304, h: 90, name: 'Vorschau der Tabelle' },
    ],
    machen: [
      'WOFUER DAS GUT IST: das Programm behaelt deine Zahlen, aber es ist kein Archiv fuer die Steuer und kein Werkzeug zum Weiterrechnen. Die Excel-Mappe ist beides. Du kannst sie aufheben, verschicken und eigene Spalten daneben rechnen.',
      'Ein Knopf fuer den gerade gewaehlten Riesenschein, einer fuer das ganze Projekt.',
      'Die Mappe hat mehrere Blaetter: jeder einzelne Schein eine Zeile, jede zusammengefasste Wette eine Zeile, dazu ein Blatt je Anbieter und eines mit allen Hinweisen.',
      'CSV ist dasselbe als einfache Textdatei, fuer Programme, die kein Excel lesen.',
      'Die Vorschau darunter zeigt, was in der Datei stehen wird, bevor du sie herunterlaedst.',
    ],
    achtung:
      'Die Summenzeile ist nur bei einer einzigen Waehrung aussagekraeftig. Steht eine Warnung ' +
      'darunter, sind Euro und Dollar in derselben Spalte gelandet.',
  },
  {
    schluessel: 'ablage',
    reiter: 'Ablage',
    wofuer:
      'Dein Archiv: alle Projekte in Ordnern, wie im Explorer. Hier liegt, was du frueher gemacht hast.',
    bild: [
      { x: 8, y: 8, b: 88, h: 132, name: 'Ordner' },
      { x: 102, y: 8, b: 210, h: 22, name: 'Auswahlleiste, wenn angehakt', betont: true },
      { x: 102, y: 36, b: 210, h: 26, name: 'Projekt 1' },
      { x: 102, y: 68, b: 210, h: 26, name: 'Projekt 2' },
      { x: 102, y: 100, b: 210, h: 40, name: 'Inhalt des offenen Projekts' },
    ],
    machen: [
      'WAS EIN PROJEKT IST: eine Runde. Alles, was du in einem Zeitraum gesetzt hast, mit allen Fotos, allen Scheinen und allen Riesenscheinen darin. Ein Projekt darf eine Woche umfassen oder eine ganze Saison.',
      'WAS EIN ORDNER IST: nur eine Schublade fuer Projekte. Ein Ordner besteht, solange ein Projekt darin liegt, und verschwindet von selbst, wenn du das letzte herausziehst. Du musst ihn nicht anlegen und nicht aufraeumen.',
      'Ein Klick auf ein Projekt oeffnet es. Doppelklick auf den Namen benennt um.',
      'Mit der Maus auf einen Ordner ziehen verschiebt das Projekt dorthin.',
      'Angepinntes steht immer oben, egal wie sortiert wird.',
      'Das Kaestchen links waehlt ein Projekt aus. Sind mehrere angehakt, erscheint oben die Leiste mit "Ausgewaehlte loeschen".',
    ],
    achtung:
      'Loeschen nimmt alle Scheine, Riesenscheine und Bilder des Projekts mit und laesst sich ' +
      'nicht rueckgaengig machen. Die Rueckfrage nennt deshalb die Namen.',
  },
]

/**
 * @param {typeof BEREICHE[number]} b
 * @param {boolean} hervor  Ob Karam gerade von dieser Seite gekommen ist.
 * @returns {HTMLElement}
 */
function bereich(b, hervor = false) {
  return el('.hilfeblock.hilfe-bereich', { daten: { bereich: b.schluessel, hervor: String(hervor) } }, [
    el('h2.hilfetitel', {}, [
      el('span.hilfereiter', { text: b.reiter }),
      el('span.hilfewofuer', { text: b.wofuer }),
    ]),
    el('.hilfezeile', {}, [
      el('.hilfebildseite', {}, [schaubild(b.bild)]),
      el('.hilfetextseite', {}, [
        el('.teiltitel', { text: 'Was du hier tust' }),
        el('ul.hilfeliste', {}, b.machen.map((m) => el('li', { text: m }))),
        el('.hilfeachtung', {}, [
          el('strong', { text: 'Achtung: ' }),
          b.achtung,
        ]),
      ]),
    ]),
  ])
}

/** Die Woerter, die im Programm vorkommen und nicht selbsterklaerend sind. */
function begriffe() {
  const liste = [
    ['Schein', 'Ein einzelner Wettschein bei einem Anbieter, gelesen aus einer Karte eines Fotos.'],
    ['Riesenschein', 'Dieselbe Wette, bei mehreren Anbietern gesetzt, zusammengefasst zu einer Position.'],
    ['Einsatz', 'Was du gesetzt hast.'],
    ['Auszahlung', 'Was herauskaeme, EINSCHLIESSLICH deines Einsatzes.'],
    ['Gewinn', 'Die Auszahlung ohne den Einsatz. Achtung: manche Anbieter nennen die Auszahlung "Gewinn".'],
    ['Quote, Multiplikator', 'Womit der Einsatz malgenommen wird. Steht auf dem Schein sowohl Einsatz als auch Auszahlung, rechnet das Programm die genaue Quote zurueck, statt der angezeigten zu glauben. Die angezeigte ist bei vier von fuenf Anbietern gerundet.'],
    ['Zurueck', 'Was wirklich geflossen ist. Bei einem verlorenen Schein null, auch wenn eine moegliche Auszahlung dasteht.'],
    ['Im Risiko', 'Der Einsatz der Scheine, die noch offen sind.'],
    ['Resttopf', 'Scheine, die nicht mitgezaehlt werden, mit Grund. Sie werden nie weggeworfen, damit du sie siehst.'],
    ['Lesesicherheit', 'Wie sicher sich die Texterkennung bei einem Feld war. Die Farbe hinter dem Feld.'],
  ]
  return el('.hilfeblock', {}, [
    el('h2.hilfetitel', { text: 'Die Woerter' }),
    el(
      'dl.hilfebegriffe',
      {},
      liste.flatMap(([wort, was]) => [el('dt', { text: wort }), el('dd', { text: was })])
    ),
  ])
}

/** Was tun, wenn etwas nicht stimmt. */
function wennEtwasNichtStimmt() {
  const faelle = [
    ['Ueber einem Bild steht die falsche Zahl Scheine', 'Rahmen um die Wettliste ziehen und noch einmal lesen lassen. Oder die Kartengrenzen mit der Maus verschieben.'],
    ['Ein Schein hat keinen Einsatz', 'Das Programm sagt es als Fehler. Einsatz im Reiter Scheine von Hand eintragen, dann zaehlt er wieder mit.'],
    ['Ein Schein meldet "zwei Karten in einer"', 'Auf dem Ausschnitt liegen zwei Wetten nebeneinander. Das Foto noch einmal enger zuschneiden, sodass nur eine Wette drauf ist.'],
    ['Eine Summe sieht zu gross oder zu klein aus', 'Nachsehen, ob unter der Summe eine Warnung steht. Gemischte Waehrungen und Scheine mit Fehler zaehlen nicht mit, und das steht dort.'],
    ['Die Quote stimmt nicht mit dem Schein ueberein', 'Das ist meist richtig so. Stehen Einsatz und Auszahlung beide da, rechnet das Programm die genaue Quote zurueck. Der Anbieter zeigt eine gerundete.'],
    ['Etwas ist weg nach dem Neuladen', 'Kartengrenzen und Rahmen ueberleben ein Neuladen noch nicht. Das ist bekannt und steht auf der Liste.'],
  ]
  return el('.hilfeblock', {}, [
    el('h2.hilfetitel', { text: 'Wenn etwas nicht stimmt' }),
    el(
      '.hilfefaelle',
      {},
      faelle.map(([fall, was]) =>
        el('.hilfefall', {}, [el('.fallfrage', { text: fall }), el('.fallantwort', { text: was })])
      )
    ),
    el('p.hilfetext', {
      text:
        'Grundregel: wo auf dem Schein Einsatz und Auszahlung beide stehen, rechnet das Programm ' +
        'nach und darf selbst entscheiden. Wo nur eines dasteht, entscheidest du. Deshalb gibt es ' +
        'lieber eine Luecke mit Warnung als eine erfundene Zahl.',
    }),
  ])
}
