/*
  Der Dienstarbeiter. Macht aus der Seite ein Programm, das man installieren
  kann und das ohne Netz weiterlaeuft.

  Karam am 18.09.2026: "Ich will, dass du jetzt in einem Zug das Programm als
  eine Download-Website machst. Das heisst, ich habe den Button, das zu
  downloaden. In deinem Desktop oder auf mein Handy."

  ------------------------------------------------------------------
  DIE EINE ENTSCHEIDUNG, AN DER ALLES HAENGT: IMMER ZUERST DAS NETZ
  ------------------------------------------------------------------

  Ein Zwischenspeicher kann mit der Fassungspruefung in daten/fassung.js in
  Streit geraten, und der Streit endet in einer Endlosschleife: der Speicher
  liefert alte Dateien, die Pruefung sieht eine Abweichung zu fassung.json,
  laedt die Seite neu, bekommt WIEDER die alten Dateien, laedt wieder neu. Das
  Programm waere unbenutzbar, und zwar genau bei dem, der es am dringendsten
  braucht: bei dem, der gerade aktualisiert hat.

  Diese Schleife ist hier nicht unwahrscheinlich, sondern unmoeglich, und das
  laesst sich beweisen. Sie braucht zwei Dinge gleichzeitig:

    1. eine erfolgreich geholte fassung.json, denn sonst meldet pruefeFassung
       die Art "unbekannt" und es wird ueberhaupt nie neu geladen,
    2. und alte Programmdateien.

  Kommt fassung.json durch, gibt es Netz. Gibt es Netz, liefert "Netz zuerst"
  jede Programmdatei frisch. Der Fall "fassung.json frisch, Dateien alt" kann
  bei Netz also nicht eintreten, und ohne Netz kommt fassung.json nicht durch.
  Die beiden Bedingungen schliessen einander aus.

  Der Preis ist ehrlich: online wird nichts schneller. Gewonnen wird die
  Installation als Programm und der Betrieb ohne Netz. Das war der Auftrag.

  ------------------------------------------------------------------
  DREI KLASSEN VON ANFRAGEN
  ------------------------------------------------------------------

  A  GAR NICHT ANFASSEN: alles Fremde (die Datenbank, spaeter die KI) und alles,
     was nicht GET ist. Eine aus dem Speicher beantwortete Datenbankabfrage
     waere ein erfundener Wert, und das verbietet Projektregel 1.
  B  NUR NETZ, NIE SPEICHER: fassung.json und diese Datei selbst. Scheitert es,
     scheitert es, und das Programm startet mit Art "unbekannt", genau wie
     heute ohne Dienstarbeiter.
  C  NETZ ZUERST, SPEICHER ALS NOTFALL: alles Uebrige vom eigenen Ursprung.

  Geschrieben wird der Speicher AUSSCHLIESSLICH einmal beim Einrichten. Ein
  Speicher, der nebenbei mitschreibt, wird mit der Zeit zwangslaeufig eine
  Mischung aus mehreren Fassungen, und genau das soll es nicht geben.

  ------------------------------------------------------------------
  WARUM DIE FASSUNG HIER WOERTLICH STEHT
  ------------------------------------------------------------------

  Der Browser holt diese Datei neu und vergleicht ihre BYTES. Aendern sie sich
  nicht, wird der alte Dienstarbeiter nie ersetzt. Eine Datei, die ihre Fassung
  erst zur Laufzeit aus fassung.json liest, aendert ihre eigenen Bytes nie und
  bliebe fuer immer stehen.

  Deshalb ist das die DRITTE Stelle derselben Kennung, neben
  daten/einstellungen.js und fassung.json. werkzeug/pruefe.mjs vergleicht alle
  drei bei jedem Durchlauf, damit sie nicht auseinanderlaufen.
*/

const FASSUNG = '2026-09-18-g'
const SPEICHER = `kombi-${FASSUNG}`

/*
  Was ohne Netz da sein muss.

  NICHT DABEI: lib/tesseract. Gemessen am 18.09.2026 sind das 16.162.819 Bytes,
  also 94,5 Prozent des ganzen Ordners lib. Von den drei Kernen benutzt ein
  Geraet genau einen, zwei davon waeren nachweislich toter Ballast. Und
  Tesseract legt sein Sprachmodell ohnehin selbst in die Browserdatenbank
  (lesen/ocr.js setzt cacheMethod auf write), ein zweiter Vorrat waere eine
  zweite Fassung desselben (Projektregel 8).

  DABEI: lib/exceljs mit 947.746 Bytes. Die Ausgabe als Excel ist etwas, das
  Karam im Zug ohne Netz braucht.

  Die Regel in einem Satz: hinein kommt, was zum Anschauen und Ausgeben noetig
  ist. Was nur zum Lesen NEUER Bilder gebraucht wird, bleibt draussen.

  Zusammen rund 2,0 MB. Das Einrichten ist alles oder nichts (addAll), und
  2 MB ueber Mobilfunk kommen fast immer vollstaendig an. 18 MB nicht.

  werkzeug/pruefe.mjs gleicht diese Liste gegen den Importgraphen ab. Eine neue
  Datei, an die beim Eintragen niemand denkt, waere sonst eine weisse Seite
  ohne Netz, und zwar erst Wochen spaeter im Zug.
*/
const VORRAT = [
  './',
  './index.html',
  './manifest.json',

  /*
    fassung.json steht hier mit Absicht NICHT.

    Sie war zuerst dabei, und im ersten Lauf auf der echten Seite lagen
    deshalb 67 Eintraege im Speicher, einer davon fuer immer unerreichbar: der
    fetch-Horcher gibt fuer fassung.json "netz-nur" zurueck und fragt den
    Speicher gar nicht erst. Ein Eintrag, den niemand je liest, ist kein
    Vorrat, sondern eine Einladung an den naechsten, ihn doch zu lesen.
  */

  './stil/marken.css',
  './stil/grund.css',
  './stil/bauteile.css',
  './stil/buehne.css',
  './stil/logos.css',
  './stil/buehne.js',

  './ausgabe/datei.js',
  './ausgabe/excel.js',
  './bild/mosaik.js',
  './bild/segmentierung.js',
  './bild/vorverarbeitung.js',
  './daten/ablage.js',
  './daten/datenbank.js',
  './daten/einstellungen.js',
  './daten/fassung.js',
  './daten/grenze.js',
  './daten/kileser.js',
  './daten/plattenspeicher.js',
  './kern/buchmacher.js',
  './kern/etiketten.js',
  './kern/geld.js',
  './kern/gruppierung.js',
  './kern/handeingabe.js',
  './kern/kennung.js',
  './kern/parser.js',
  './kern/quoten.js',
  './kern/rechnung.js',
  './kern/reparatur.js',
  './kern/status.js',
  './kern/typen.js',
  './kern/zahlen.js',
  './kern/zeitpunkt.js',
  './lesen/ocr.js',
  './oberflaeche/anleitung.js',
  './oberflaeche/ansicht_ablage.js',
  './oberflaeche/ansicht_aufnahme.js',
  './oberflaeche/ansicht_ausgabe.js',
  './oberflaeche/ansicht_hilfe.js',
  './oberflaeche/ansicht_positionen.js',
  './oberflaeche/ansicht_scheine.js',
  './oberflaeche/ansicht_start.js',
  './oberflaeche/app.js',
  './oberflaeche/aufbau.js',
  './oberflaeche/aufnahme.js',
  './oberflaeche/bildschirmfoto.js',
  './oberflaeche/bildspeicher.js',
  './oberflaeche/dialog.js',
  './oberflaeche/fotoknoepfe.js',
  './oberflaeche/geteilt.js',
  './oberflaeche/installieren.js',
  './oberflaeche/kilesen.js',
  './oberflaeche/nadeln.js',
  './oberflaeche/ordner.js',
  './oberflaeche/reihenfolge.js',
  './oberflaeche/scheinfelder.js',
  './oberflaeche/schnipsel.js',
  './oberflaeche/werkzeug.js',
  './oberflaeche/zustand.js',

  './lib/exceljs/exceljs.min.js',

  './symbole/symbol-192.png',
  './symbole/symbol-512.png',
  './symbole/symbol-512-maskiert.png',
  './symbole/symbol-180.png',
]

/**
 * Entscheidet, wie eine Anfrage behandelt wird.
 *
 * Als eigene Funktion, damit sie sich ohne Browser pruefen laesst. Sie ist der
 * ganze Verstand dieser Datei; alles andere ist Verwaltung. Siehe
 * test/dienstarbeiter.test.mjs.
 *
 * @param {string} adresse    Die volle Adresse der Anfrage.
 * @param {string} art        GET, POST und so weiter.
 * @param {string} ursprung   Der eigene Ursprung, also self.location.origin.
 * @returns {'nicht-anfassen'|'netz-nur'|'netz-zuerst'}
 */
function entscheide(adresse, art, ursprung) {
  if (art !== 'GET') return 'nicht-anfassen'

  let ziel
  try {
    ziel = new URL(adresse)
  } catch {
    return 'nicht-anfassen'
  }

  if (ziel.origin !== ursprung) return 'nicht-anfassen'

  // Der Fragezeichenteil bleibt aussen vor: fassung.json wird mit einem
  // Zeitstempel geholt, damit kein Zwischenspeicher dazwischenkommt.
  if (ziel.pathname.endsWith('/fassung.json')) return 'netz-nur'
  if (ziel.pathname.endsWith('/dienstarbeiter.js')) return 'netz-nur'

  return 'netz-zuerst'
}

// Fuer die Probe erreichbar machen, im Browser stoert es niemanden.
if (typeof self !== 'undefined') self.__entscheide = entscheide

self.addEventListener('install', (ereignis) => {
  /*
    KEIN skipWaiting.

    Der neue Dienstarbeiter wartet, bis alle Fenster geschlossen sind. Das ist
    nicht Traegheit, sondern der Schutz vor der letzten verbliebenen Mischung:
    uebernaehme er mitten in der Sitzung, loeschte er beim Aufraeumen den
    Speicher der Fassung, mit der das offene Fenster gerade laeuft. Faellt
    danach das Netz aus und das Fenster laedt noch ein Modul nach, bekaeme es
    eine neue Datei in ein altes Programm. index.html tut genau das: der Import
    von stil/buehne.js laeuft erst nach dem Start.
  */
  ereignis.waitUntil(caches.open(SPEICHER).then((speicher) => speicher.addAll(VORRAT)))
})

self.addEventListener('activate', (ereignis) => {
  /*
    Aufraeumen ist keine Pflege, sondern eine Folge: eine neue Fassung hat
    zwangslaeufig einen anderen Speichernamen, der alte ist damit unerreichbar
    und wird hier entfernt.
  */
  ereignis.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(
        namen
          .filter((name) => name.startsWith('kombi-') && name !== SPEICHER)
          .map((name) => caches.delete(name))
      )
    )
  )
})

self.addEventListener('fetch', (ereignis) => {
  const was = entscheide(ereignis.request.url, ereignis.request.method, self.location.origin)

  if (was === 'nicht-anfassen') return

  if (was === 'netz-nur') {
    ereignis.respondWith(fetch(ereignis.request))
    return
  }

  ereignis.respondWith(
    fetch(ereignis.request).catch(async () => {
      const speicher = await caches.open(SPEICHER)
      const gefunden = await speicher.match(ereignis.request)
      if (gefunden) return gefunden

      /*
        Eine Navigation auf eine Adresse, die so nicht im Vorrat steht, muss
        trotzdem die Seite bekommen. Sonst stuende ohne Netz eine
        Browserfehlerseite, obwohl das ganze Programm bereitliegt.
      */
      if (ereignis.request.mode === 'navigate') {
        const seite = await speicher.match('./index.html')
        if (seite) return seite
      }

      return new Response(
        'Ohne Verbindung und ohne Zwischenspeicher gibt es diese Datei nicht.',
        { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    })
  )
})
