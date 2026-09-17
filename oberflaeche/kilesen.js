// @ts-check
/**
 * Ein ganzes Foto von der KI lesen lassen und daraus Scheine machen.
 *
 * Karam am 17.09.2026: "Es muss wirklich geil sein. Es darf jetzt nicht Fehler
 * machen, vor allem bei BetOnline. Da kommen ein paar hundert Scheine taeglich
 * und mehrere Scheine in einem Foto."
 *
 * WARUM DAS GANZE FOTO UND NICHT DIE EINZELNEN KARTEN
 *
 * Genau da liegt sein Problem. Die oertliche Kette zerlegt das Foto zuerst in
 * Karten (bild/segmentierung.js) und liest jede einzeln. An seinen echten
 * Fotos ist gemessen: bei Stake werden von vier Wetten zwei Karten gefunden,
 * und bei Betway schneidet die Zerlegung eine Karte an der Spielstandsbox
 * durch. Der Fehler passiert also, BEVOR ueberhaupt gelesen wird, und kein
 * besserer Leser kann ihn danach noch beheben.
 *
 * Die KI sieht das ganze Bild auf einmal. Sie braucht keine Zerlegung und gibt
 * jeden Schein einzeln zurueck, auch vier nebeneinander in zwei Spalten.
 *
 * WAS SIE TROTZDEM NICHT DARF: entscheiden.
 *
 * Jeder Wert laeuft danach durch kern/quoten.js, versoehne(): Einsatz mal
 * Quote gleich Auszahlung, und diese Rechnung steht auf dem Schein SELBST.
 * Besteht die Antwort sie, hat die KI abgelesen. Besteht sie sie nicht, hat
 * die KI sich verraten, und der Schein bekommt einen Hinweis und wartet auf
 * den Menschen.
 *
 * Das ist Karams Regel, auf die KI angewandt: wo es einen Pruefstein gibt,
 * darf die Automatik entscheiden, wo keiner ist, entscheidet der Mensch.
 * MAN MUSS DER KI NIE GLAUBEN.
 */

import * as KI from '../daten/kileser.js'
import * as Zustand from './zustand.js'
import { el, neueKennung, jetzt } from './werkzeug.js'
import { schluesselFuerName, BUCHMACHER_NACH_SCHLUESSEL } from '../kern/buchmacher.js'
import { versoehne } from '../kern/quoten.js'

/**
 * Macht aus einem Wert der KI ein Feld, wie es das Programm kennt.
 *
 * QUELLE IST 'ocr' UND NICHT ETWA 'ki'. Fuer alles Weitere im Programm ist die
 * KI ein zweiter Leser, kein Orakel: ihre Werte duerfen von der Reparatur
 * berichtigt werden, sie duerfen Handkorrekturen NICHT ueberschreiben, und sie
 * tragen eine Sicherheit unter eins. Eine eigene Quelle haette all diese
 * Regeln einzeln noch einmal gebraucht (Projektregel 8).
 *
 * @template T
 * @param {T|null|undefined} wert
 * @param {boolean} unsicher  Hat die KI dieses Feld selbst als unsicher gemeldet?
 * @returns {{wert: T|null, sicherheit: number, quelle: 'ocr'|'vorgabe'}}
 */
function feld(wert, unsicher) {
  if (wert === null || wert === undefined || wert === '') {
    return { wert: null, sicherheit: 0, quelle: 'vorgabe' }
  }
  /*
    0.55 fuer ein selbst gemeldetes "unsicher", 0.9 sonst.

    Die 0.55 liegt mit Absicht unter der Schwelle, ab der die Oberflaeche ein
    Feld als sicher faerbt: ein Feld, bei dem die KI selbst gezoegert hat,
    soll Karam ansehen.
  */
  return { wert, sicherheit: unsicher ? 0.55 : 0.9, quelle: 'ocr' }
}

/**
 * Baut aus einem Schein der KI einen Schein des Programms.
 *
 * @param {any} roh
 * @param {{bildId: string, projektId: string}} wo
 */
function zuSchein(roh, wo) {
  const unsicher = new Set(Array.isArray(roh?.unsicher) ? roh.unsicher : [])
  const u = (name) => unsicher.has(name)

  const anbietername = typeof roh?.buchmacher === 'string' ? roh.buchmacher : ''
  const schluessel = schluesselFuerName(anbietername)
  const profil = schluessel ? BUCHMACHER_NACH_SCHLUESSEL[schluessel] : null

  /*
    DIE WAEHRUNG KOMMT VOM ANBIETER, WENN DIE KI KEINE NENNT.

    Nicht geraten: jedes Buchmacherprofil traegt seine Waehrung, und die ist
    eine Eigenschaft des Kontos, nicht des Bildes. Kennt das Programm den
    Anbieter nicht, bleibt die Waehrung leer, und die Summen verweigern sich
    lieber, als ueber Waehrungen hinweg zu addieren.
  */
  const waehrung = typeof roh?.waehrung === 'string' && roh.waehrung
    ? roh.waehrung.toUpperCase()
    : (profil?.waehrung ?? null)

  const status = typeof roh?.status === 'string' ? roh.status.toLowerCase().trim() : 'unbekannt'
  const erlaubt = ['offen', 'gewonnen', 'verloren', 'halb_gewonnen', 'halb_verloren', 'storniert', 'cashout']

  return {
    id: neueKennung(),
    bildId: wo.bildId,
    gruppeId: '',
    scheinNr: feld(roh?.scheinNr ?? null, u('scheinNr')),
    buchmacher: feld(profil?.name ?? anbietername ?? null, u('buchmacher') || !profil),
    konto: { wert: null, sicherheit: 0, quelle: /** @type {const} */ ('vorgabe') },
    einsatz: feld(zahl(roh?.einsatz), u('einsatz')),
    quoteDezimal: feld(zahl(roh?.quoteDezimal), u('quoteDezimal')),
    auszahlung: feld(zahl(roh?.auszahlung), u('auszahlung')),
    ausgezahlt: feld(zahl(roh?.ausgezahlt), u('ausgezahlt')),
    waehrung: feld(waehrung, u('waehrung')),
    status: erlaubt.includes(status) ? status : 'unbekannt',
    gratiswette: roh?.gratiswette === true,
    eachWay: roh?.eachWay === true,
    auswahlen: (Array.isArray(roh?.auswahlen) ? roh.auswahlen : [])
      .filter((a) => typeof a === 'string' && a.trim() !== '')
      .map((text) => ({ text: String(text).trim() })),
    ausschnitt: null,
    geaendertAm: jetzt(),
    vonHand: false,
    hinweise: [],
  }
}

/** @param {unknown} w */
function zahl(w) {
  const n = typeof w === 'number' ? w : Number(w)
  return Number.isFinite(n) ? n : null
}

/**
 * Laesst die Bilder von der KI lesen und legt die Scheine an.
 *
 * @param {string[]} bildIds
 * @returns {Promise<{gelesen: number, scheine: number, fehler: number}>}
 */
export async function leseMitKI(bildIds) {
  const stand = Zustand.hole()
  const projektId = stand.projekt?.id ?? ''
  if (!projektId) {
    Zustand.melde('fehler', 'Es ist kein Projekt geöffnet.')
    return { gelesen: 0, scheine: 0, fehler: 0 }
  }
  if (!KI.bereit()) {
    Zustand.melde('fehler', 'Es ist kein API-Schlüssel hinterlegt. Siehe den Kasten über dieser Liste.')
    return { gelesen: 0, scheine: 0, fehler: 0 }
  }

  let gelesen = 0
  let fehler = 0
  /** @type {any[]} */
  const neue = []

  for (let i = 0; i < bildIds.length; i += 1) {
    const eintrag = Zustand.hole().bilder.get(bildIds[i])
    if (!eintrag?.inhalt) {
      fehler += 1
      continue
    }

    Zustand.arbeite(true, `Foto ${i + 1} von ${bildIds.length} wird gelesen`, i / bildIds.length)

    const antwort = await KI.leseBild(eintrag.inhalt, {
      anbieter: eintrag.bild?.buchmacher?.wert ?? '',
    })

    if (!antwort.gelungen) {
      fehler += 1
      Zustand.melde('warnung', `"${eintrag.bild.dateiname}": ${antwort.meldung}`)
      continue
    }

    gelesen += 1
    for (const roh of antwort.scheine) {
      const schein = zuSchein(roh, { bildId: bildIds[i], projektId })

      /*
        DER PRUEFSTEIN. Hier und nirgends sonst entscheidet sich, ob die
        Antwort der KI gilt.

        versoehne() rechnet Einsatz mal Quote gegen die Auszahlung und
        beruecksichtigt dabei den Stand: bei einem verlorenen Schein ist eine
        Auszahlung von null kein Widerspruch. Geht die Rechnung nicht auf,
        kommen Hinweise zurueck, und die stehen dann am Schein.
      */
      const probe = versoehne({
        einsatz: schein.einsatz.wert,
        auszahlung: schein.auszahlung.wert,
        dezimal: schein.quoteDezimal.wert,
        status: schein.status,
        einsatzWirdZurueckgezahlt: !schein.gratiswette,
      })
      schein.hinweise = probe.hinweise ?? []

      neue.push(schein)
    }
  }

  Zustand.arbeite(false)

  if (neue.length > 0) {
    Zustand.ordneNeu([...Zustand.hole().scheine, ...neue])
    const mitHinweis = neue.filter((s) => s.hinweise.length > 0).length
    Zustand.melde(
      'erfolg',
      `${neue.length} Schein(e) aus ${gelesen} Foto(s) gelesen.` +
        (mitHinweis > 0
          ? ` ${mitHinweis} davon hat die Gegenrechnung nicht bestanden und wartet auf dich.`
          : ' Alle haben die Gegenrechnung bestanden.')
    )
  } else if (fehler === 0) {
    Zustand.melde('warnung', 'Die KI hat auf diesen Fotos keinen Schein gefunden.')
  }

  return { gelesen, scheine: neue.length, fehler }
}

/**
 * Der Kasten, in dem der Schluessel eingegeben wird.
 *
 * ER STEHT IM PROGRAMM UND NICHT IN EINER DATEI. Das ist der ganze
 * Unterschied: dieses Programm ist eine statische Seite in einem
 * OEFFENTLICHEN Repository. Ein Schluessel im Quelltext waere fuer jeden
 * lesbar, der die Seite aufruft. Vom Menschen eingegeben liegt er nur in
 * seinem Browser.
 *
 * @param {() => void} neuZeichnen
 * @returns {HTMLElement}
 */
export function schluesselkasten(neuZeichnen) {
  const da = KI.bereit()

  const feldEl = /** @type {HTMLInputElement} */ (
    el('input.dialogeingabe', {
      type: 'password',
      value: '',
      placeholder: da ? KI.schluesselkurz() : 'sk-ant-...',
      autocomplete: 'off',
      spellcheck: 'false',
    })
  )

  return el('.hinweisblock', { daten: { art: da ? 'gut' : 'info' } }, [
    el('.hinweisart', { text: da ? 'KI-Leser bereit' : 'KI-Leser einrichten' }),
    el('p.geteilttext', {
      text: da
        ? `Der Schlüssel ${KI.schluesselkurz()} liegt in diesem Browser. Neue Fotos kannst du mit ` +
          '"Mit KI lesen" lesen lassen; die KI findet auch mehrere Scheine auf einem Foto.'
        : 'Ohne Schlüssel liest das Programm nur örtlich. Die örtliche Bildzerlegung findet bei ' +
          'mehreren Scheinen auf einem Foto nicht alle. Die KI sieht das ganze Bild auf einmal.',
    }),
    el('ul.blockliste', {}, [
      el('li', { text: 'Den Schlüssel bekommst du bei Anthropic: console.anthropic.com, unter API keys.' }),
      el('li', { text: 'Er liegt NUR in diesem Browser. Er geht nie in die Datenbank und nie ins Repository.' }),
      el('li', { text: 'Setz dort ein Ausgabenlimit, dann kann dir nichts davonlaufen.' }),
      el('li', { text: 'Jeder gelesene Wert wird danach gegengerechnet: Einsatz mal Quote gleich Auszahlung.' }),
    ]),
    el('.dialogfeld', {}, [
      el('span.dialogfeldname', { text: da ? 'Anderen Schlüssel eintragen' : 'API-Schlüssel' }),
      feldEl,
    ]),
    el('.dialogfeld', {}, [
      el('span.dialogfeldname', { text: 'Modell' }),
      el(
        'select.feldwahl.feldwahl-breit',
        {
          onchange: (e) => {
            KI.setzeModell(/** @type {HTMLSelectElement} */ (e.target).value)
            neuZeichnen()
          },
        },
        KI.MODELLE.map((m) =>
          el('option', {
            value: m.wert,
            text: `${m.name} \u2013 ${m.hinweis}`,
            selected: KI.modell() === m.wert ? 'selected' : null,
          })
        )
      ),
    ]),
    el('.ausgabeknoepfe', {}, [
      el('button.knopf.knopf-haupt', {
        type: 'button',
        text: da ? 'Schlüssel ersetzen' : 'Schlüssel speichern',
        onclick: () => {
          const wert = feldEl.value.trim()
          if (wert === '') {
            Zustand.melde('warnung', 'Es wurde nichts eingegeben.')
            return
          }
          KI.setzeSchluessel(wert)
          feldEl.value = ''
          Zustand.melde('erfolg', `Der Schlüssel ${KI.schluesselkurz()} ist hinterlegt.`)
          neuZeichnen()
        },
      }),
      da
        ? el('button.knopf.knopf-klein', {
            type: 'button',
            text: 'Schlüssel entfernen',
            onclick: () => {
              KI.setzeSchluessel('')
              Zustand.melde('info', 'Der Schlüssel ist aus diesem Browser entfernt.')
              neuZeichnen()
            },
          })
        : null,
    ]),
  ])
}
