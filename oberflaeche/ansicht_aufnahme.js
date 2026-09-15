// @ts-check
/**
 * Ansicht "Aufnahme".
 *
 * Hier laedt Karam die Bildschirmfotos hoch und sieht sofort, wo das Programm
 * die Schnitte setzen will. Jede Grenze laesst sich mit der Maus verschieben,
 * jede Karte laesst sich abwaehlen. Genau dafuer: die vierte Wette ganz unten
 * gehoert nicht dazu und muss weg, bevor gelesen wird.
 *
 * Diese Datei baut nur Bausteine und setzt Klassennamen. Farben und Groessen
 * stehen ausschliesslich in stil/.
 */

import { el, fuelle, neueKennung } from './werkzeug.js'
import * as Zustand from './zustand.js'
import { nimmAuf, leseBilder, setzeKarten, setzeBuchmacher, setzeBereich } from './aufnahme.js'
import { BUCHMACHER } from '../kern/buchmacher.js'
import {
  kannBildschirmAufnehmen,
  kannZwischenablageLesen,
  nimmBildschirmAuf,
  ausZwischenablage,
  ausBlob,
  zeigeZuschnitt,
  alsDatei,
} from './bildschirmfoto.js'

/** Mindesthoehe einer Karte im Originalbild. */
const MINDESTHOEHE = 40

/** Bei welchen Bildern der Nutzer gerade einen Rahmen zieht. */
const imRahmenmodus = new Set()

/**
 * Zeichnet die Ansicht.
 *
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
  // Einmalig, der Waechter in der Funktion sorgt dafuer.
  horcheAufEinfuegen()

  const stand = Zustand.hole()
  const bilder = [...stand.bilder.values()]

  fuelle(ziel, [
    ablegeflaeche(),
    bilder.length === 0
      ? el('.leerhinweis', {}, [
          el('p.leer-titel', { text: 'Noch keine Bildschirmfotos da.' }),
          el('p.leer-text', {
            text:
              'Zieh die Bilder deiner Wettuebersicht hier herein. Am besten schon so ' +
              'zugeschnitten, dass nur die Wetten drauf sind, die zusammengehoeren. ' +
              'Wenn mehr drauf ist, schneidest du hier gleich nach.',
          }),
        ])
      : el('.bildliste', {}, bilder.map((eintrag) => bildkarte(eintrag))),
    bilder.length > 0 ? leseleiste(bilder) : null,
  ])
}

/**
 * @returns {HTMLElement}
 */
function ablegeflaeche() {
  const eingabe = el('input.versteckt', {
    type: 'file',
    accept: 'image/*',
    multiple: 'multiple',
    onchange: async (e) => {
      const ziel = /** @type {HTMLInputElement} */ (e.target)
      if (ziel.files) await nimmAuf(ziel.files)
      ziel.value = ''
    },
  })

  const flaeche = el(
    '.ablage',
    {
      ondragover: (e) => {
        e.preventDefault()
        flaeche.classList.add('ablage-bereit')
      },
      ondragleave: () => flaeche.classList.remove('ablage-bereit'),
      ondrop: async (e) => {
        e.preventDefault()
        flaeche.classList.remove('ablage-bereit')
        const dateien = /** @type {DragEvent} */ (e).dataTransfer?.files
        if (dateien) await nimmAuf(dateien)
      },
      onclick: (e) => {
        // Ein Klick auf einen der Knoepfe darf nicht zusaetzlich den
        // Dateidialog aufreissen.
        if (/** @type {HTMLElement} */ (e.target).closest('.aufnahmeknopf')) return
        eingabe.click()
      },
    },
    [
      el('.ablage-zeichen', { text: '+' }),
      el('.ablage-titel', { text: 'Bildschirmfotos hierher ziehen' }),
      el('.ablage-text', { text: 'oder klicken zum Auswaehlen. Die Bilder bleiben auf diesem Geraet.' }),
      aufnahmeknoepfe(),
      eingabe,
    ]
  )
  return flaeche
}

/**
 * Die zwei Wege, die ohne Dateiexplorer auskommen.
 *
 * Beide enden im selben nimmAuf wie eine hochgeladene Datei. Ab da kennt der
 * Weg keinen Unterschied mehr, und es gibt deshalb auch keine zweite Fassung
 * der Auswertung, die auseinanderdriften koennte.
 *
 * @returns {HTMLElement}
 */
function aufnahmeknoepfe() {
  const knoepfe = []

  if (kannBildschirmAufnehmen()) {
    knoepfe.push(
      el('button.aufnahmeknopf', {
        type: 'button',
        text: 'Bildschirmfoto aufnehmen',
        title: 'Fenster aussuchen, Rahmen um die Wettliste ziehen, fertig.',
        onclick: async (e) => {
          e.stopPropagation()
          await bildschirmfotoMachen()
        },
      })
    )
  }

  if (kannZwischenablageLesen()) {
    knoepfe.push(
      el('button.aufnahmeknopf', {
        type: 'button',
        text: 'Aus der Zwischenablage',
        title: 'Erst mit Windows-Taste + Umschalt + S ausschneiden, dann hier druecken.',
        onclick: async (e) => {
          e.stopPropagation()
          await ausZwischenablageHolen()
        },
      })
    )
  }

  if (knoepfe.length === 0) {
    return el('.ablage-text', {
      text:
        'Bildschirmfoto direkt aufnehmen geht hier nicht (der Browser erlaubt es nur ueber https). ' +
        'Mach es mit Windows-Taste + Umschalt + S und druecke dann Strg+V.',
    })
  }

  return el('.aufnahmeknoepfe', {}, [
    ...knoepfe,
    el('.ablage-text', { text: 'Oder mit Windows-Taste + Umschalt + S ausschneiden und hier Strg+V druecken.' }),
  ])
}

/** Bildschirm aufnehmen, zuschneiden, aufnehmen lassen. */
async function bildschirmfotoMachen() {
  try {
    const voll = await nimmBildschirmAuf()
    const ausschnitt = await zeigeZuschnitt(voll)
    if (!ausschnitt) {
      Zustand.melde('info', 'Bildschirmfoto verworfen.')
      return
    }
    await nimmAuf([await alsDatei(ausschnitt, 'bildschirm')])
  } catch (fehler) {
    // Ein Abbruch im Auswahlfenster des Browsers ist kein Fehler.
    const text = fehler instanceof Error ? fehler.message : String(fehler)
    const abgebrochen =
      fehler instanceof DOMException &&
      (fehler.name === 'NotAllowedError' || fehler.name === 'AbortError')
    if (abgebrochen) Zustand.melde('info', 'Kein Bildschirmfoto gemacht.')
    else Zustand.melde('fehler', `Bildschirmfoto misslungen: ${text}`)
  }
}

/** Aus der Zwischenablage holen, zuschneiden, aufnehmen lassen. */
async function ausZwischenablageHolen() {
  try {
    const bild = await ausZwischenablage()
    if (!bild) {
      Zustand.melde('warnung', 'In der Zwischenablage liegt kein Bild.')
      return
    }
    const ausschnitt = await zeigeZuschnitt(bild)
    if (!ausschnitt) {
      Zustand.melde('info', 'Bild verworfen.')
      return
    }
    await nimmAuf([await alsDatei(ausschnitt, 'zwischenablage')])
  } catch (fehler) {
    Zustand.melde(
      'fehler',
      `Zwischenablage: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    )
  }
}

/**
 * Strg+V irgendwo auf der Seite nimmt ein Bild auf.
 *
 * Das ist der Weg, der IMMER geht: er braucht keine Erlaubnis und keine
 * sichere Verbindung. Wer unter Windows mit Windows-Taste + Umschalt + S
 * ausschneidet, hat das Bild danach in der Zwischenablage.
 *
 * Nur in der Aufnahmeansicht, und nie waehrend in ein Feld getippt wird: sonst
 * wuerde ein Einfuegen in ein Textfeld nebenbei ein Bild aufnehmen.
 */
let horchtSchon = false
export function horcheAufEinfuegen() {
  if (horchtSchon) return
  horchtSchon = true
  window.addEventListener('paste', async (e) => {
    if (Zustand.hole().ansicht !== 'aufnahme') return
    const ziel = /** @type {HTMLElement|null} */ (e.target)
    if (ziel && ziel.closest('input, textarea, [contenteditable="true"]')) return

    const stuecke = [...(e.clipboardData?.items ?? [])]
    const bildStueck = stuecke.find((s) => s.type.startsWith('image/'))
    if (!bildStueck) return
    e.preventDefault()

    const blob = bildStueck.getAsFile()
    if (!blob) return
    try {
      const ausschnitt = await zeigeZuschnitt(await ausBlob(blob))
      if (!ausschnitt) {
        Zustand.melde('info', 'Eingefuegtes Bild verworfen.')
        return
      }
      await nimmAuf([await alsDatei(ausschnitt, 'eingefuegt')])
    } catch (fehler) {
      Zustand.melde(
        'fehler',
        `Eingefuegtes Bild: ${fehler instanceof Error ? fehler.message : String(fehler)}`
      )
    }
  })
}

/**
 * @param {import('./zustand.js').Bildeintrag} eintrag
 * @returns {HTMLElement}
 */
/**
 * Welche Bilder gerade gross angezeigt werden.
 *
 * WARUM HIER UND NICHT IM ZUSTAND
 *
 * Das ist reine Ansichtssache und kein Wert, der gerechnet oder gespeichert
 * wird. Im Zustand wuerde er mit jedem Projekt mitgeschleppt und in die
 * Datenbank wandern. Hier lebt er genau so lange wie die Seite offen ist, und
 * er ueberlebt das Neuzeichnen, weil das Modul bestehen bleibt.
 *
 * @type {Set<string>}
 */
const grosseBilder = new Set()

/**
 * Bilder werden klein nebeneinander gezeigt, nicht eines untereinander.
 *
 * Karam laedt zwanzig bis hundert Bildschirmfotos auf einmal hoch. Eines je
 * Bildschirmbreite heisst hundertmal scrollen, um zu sehen, was ueberhaupt da
 * ist. Klein und nebeneinander passen mehrere ins Bild, und wer eines genauer
 * ansehen oder den Rahmen ziehen will, macht es gross.
 *
 * Beim Rahmensetzen wird das Bild IMMER gross, sonst zieht man den Rahmen auf
 * einer Briefmarke.
 *
 * @param {string} bildId
 * @returns {boolean}
 */
function istGross(bildId) {
  return grosseBilder.has(bildId)
}

/**
 * Schaltet ein Bild zwischen klein und gross um.
 *
 * Die Karte wird direkt umgeschaltet, ohne die ganze Ansicht neu zu zeichnen:
 * das ist schneller, und ein offenes Eingabefeld verliert dabei nicht den
 * Schreibzeiger. Die Groesse selbst steht in stil/, hier steht nur, WELCHER
 * Zustand gilt.
 *
 * @param {string} bildId
 * @param {HTMLElement} karte
 */
function schalteGroesse(bildId, karte) {
  if (grosseBilder.has(bildId)) grosseBilder.delete(bildId)
  else grosseBilder.add(bildId)
  karte.dataset.gross = String(grosseBilder.has(bildId))
  const knopf = karte.querySelector('.groessenknopf')
  if (knopf) knopf.textContent = grosseBilder.has(bildId) ? 'Kleiner' : 'Groesser'
}

function bildkarte(eintrag) {
  const anzahl = eintrag.karten.length

  // Ab wann der Rahmen ausdruecklich angeboten wird.
  //
  // Das Mass ist bewusst die Bildbreite und NICHT die Zahl der gefundenen Karten.
  // Bei einem ganzen Browserfenster findet die Zerlegung durchaus mehrere Karten,
  // aber es sind Querschnitte durch die ganze Seite samt Menueleiste. Das sieht
  // nach Erfolg aus und ist der gefaehrlichere Fall, weil niemand hinsieht.
  //
  // Ein zugeschnittener Ausschnitt einer Wettliste ist selten breiter als tausend
  // Bildpunkte, ein Browserfenster fast immer. Wer trotzdem breit zuschneidet,
  // liest hier eine Zeile Text und ignoriert sie.
  const breitesBild = eintrag.bild.breite >= 1000
  const nichtsGetrennt = !eintrag.bereich && breitesBild

  // Beim Rahmensetzen zaehlt nur die grosse Ansicht, sonst zieht man den
  // Rahmen auf einer Briefmarke.
  const gross = istGross(eintrag.bild.id) || imRahmenmodus.has(eintrag.bild.id)

  const karte = el('.bildkarte', { daten: { bild: eintrag.bild.id, gross: String(gross) } }, [
    el('.bildkopf', {}, [
      el('.bildname', { text: eintrag.bild.dateiname, title: eintrag.bild.dateiname }),
      el('.bildmasse', { text: `${eintrag.bild.breite} x ${eintrag.bild.hoehe}` }),
      el('.bildzahl', {
        text: anzahl === 1 ? '1 Schein erkannt' : `${anzahl} Scheine erkannt`,
      }),
      el('button.knopf.knopf-klein.groessenknopf', {
        type: 'button',
        text: gross ? 'Kleiner' : 'Groesser',
        title: 'Dieses Bild gross oder klein anzeigen',
        onclick: (e) => {
          const ziel = /** @type {HTMLElement} */ (e.currentTarget)
          const dieKarte = /** @type {HTMLElement|null} */ (ziel.closest('.bildkarte'))
          if (dieKarte) schalteGroesse(eintrag.bild.id, dieKarte)
        },
      }),
    ]),
    anbieterwahl(eintrag),
    nichtsGetrennt
      ? el('.rahmenaufruf', {}, [
          el('strong', { text: 'Breites Bild: bitte den Rahmen setzen. ' }),
          'Sieht das nach einem ganzen Browserfenster aus, dann zieh unten einen Rahmen ' +
            'um die Wettliste. Ohne Rahmen schneidet das Programm quer durch die Seite, ' +
            'und in den Ausschnitten landet Text aus der Menueleiste. Der Anbieter wird ' +
            'trotzdem aus dem Kopf des Bildes erkannt, der Rahmen aendert daran nichts.',
        ])
      : null,
    rahmenleiste(eintrag),
    schnittflaeche(eintrag),
    eintrag.hinweise.length > 0
      ? el('ul.bildhinweise', {}, eintrag.hinweise.map((h) => el('li', { text: h })))
      : null,
  ])

  return karte
}

/**
 * Die Leiste zum Setzen und Aufheben des Rahmens.
 *
 * @param {import('./zustand.js').Bildeintrag} eintrag
 * @returns {HTMLElement}
 */
function rahmenleiste(eintrag) {
  const aktiv = imRahmenmodus.has(eintrag.bild.id)
  const bereich = eintrag.bereich

  return el('.rahmenleiste', {}, [
    el('button.knopf.knopf-klein', {
      type: 'button',
      daten: { aktiv: String(aktiv) },
      text: aktiv ? 'Ziehen beenden' : 'Rahmen ziehen',
      title: 'Einen Bereich festlegen, in dem nach Scheinen gesucht wird',
      onclick: () => {
        if (aktiv) imRahmenmodus.delete(eintrag.bild.id)
        else imRahmenmodus.add(eintrag.bild.id)
        Zustand.aendere({})
      },
    }),
    bereich
      ? el('button.knopf.knopf-klein', {
          type: 'button',
          text: 'Rahmen aufheben',
          onclick: () => {
            imRahmenmodus.delete(eintrag.bild.id)
            setzeBereich(eintrag.bild.id, null)
          },
        })
      : null,
    el('span.rahmeninfo', {
      text: bereich
        ? `Rahmen: ${bereich.breite} x ${bereich.hoehe} ab ${bereich.x}, ${bereich.y}`
        : aktiv
          ? 'Jetzt mit der Maus einen Rahmen um die Wettliste ziehen.'
          : 'Ohne Rahmen wird das ganze Bild durchsucht.',
    }),
  ])
}

/**
 * @param {import('./zustand.js').Bildeintrag} eintrag
 * @returns {HTMLElement}
 */
function anbieterwahl(eintrag) {
  const erkannt = eintrag.bild.buchmacher.wert
  const sicherheit = eintrag.bild.buchmacher.sicherheit

  const auswahl = el('select.feldwahl', {
    onchange: (e) => setzeBuchmacher(eintrag.bild.id, /** @type {HTMLSelectElement} */ (e.target).value),
  })
  auswahl.append(el('option', { value: '', text: 'Anbieter noch offen' }))
  for (const profil of BUCHMACHER) {
    auswahl.append(
      el('option', {
        value: profil.schluessel,
        text: profil.name,
        selected: profil.name === erkannt ? 'selected' : null,
      })
    )
  }

  return el('.bildanbieter', {}, [
    el('span.feldname', { text: 'Anbieter' }),
    auswahl,
    erkannt
      ? el('span.merkmal', {
          text: `erkannt mit ${Math.round(sicherheit * 100)} Prozent`,
          daten: { stufe: sicherheit >= 0.85 ? 'hoch' : sicherheit >= 0.6 ? 'mittel' : 'niedrig' },
        })
      : el('span.merkmal', { text: 'wird beim Lesen bestimmt', daten: { stufe: 'keine' } }),
    eintrag.bild.konto.wert
      ? el('span.merkmal', { text: `Konto: ${eintrag.bild.konto.wert}`, daten: { stufe: 'mittel' } })
      : null,
  ])
}

/**
 * Das Bild mit den verschiebbaren Schnittkanten.
 *
 * @param {import('./zustand.js').Bildeintrag} eintrag
 * @returns {HTMLElement}
 */
function schnittflaeche(eintrag) {
  const hoehe = eintrag.bild.hoehe || 1
  const bildAdresse = eintrag.inhalt ? URL.createObjectURL(eintrag.inhalt) : ''

  const bild = el('img.schnittbild', {
    src: bildAdresse,
    alt: eintrag.bild.dateiname,
    onload: () => {
      if (bildAdresse) setTimeout(() => URL.revokeObjectURL(bildAdresse), 1000)
    },
    // Ein Klick aufs Bild macht es gross und wieder klein. Beim Rahmenziehen
    // NICHT: dort beginnt der Klick das Aufziehen des Rahmens, und beides
    // zugleich wuerde sich gegenseitig stoeren.
    onclick: (e) => {
      if (imRahmenmodus.has(eintrag.bild.id)) return
      const ziel = /** @type {HTMLElement} */ (e.currentTarget)
      const dieKarte = /** @type {HTMLElement|null} */ (ziel.closest('.bildkarte'))
      if (dieKarte) schalteGroesse(eintrag.bild.id, dieKarte)
    },
  })

  const breiteOriginal = eintrag.bild.breite || 1
  const rahmenmodus = imRahmenmodus.has(eintrag.bild.id)

  const flaeche = el('.schnittflaeche', { daten: { rahmenmodus: String(rahmenmodus) } }, [bild])

  // Den bestehenden Rahmen anzeigen.
  if (eintrag.bereich) {
    flaeche.append(
      el('.rahmen', {
        stil: {
          '--links': `${(eintrag.bereich.x / breiteOriginal) * 100}%`,
          '--oben': `${(eintrag.bereich.y / hoehe) * 100}%`,
          '--breite': `${(eintrag.bereich.breite / breiteOriginal) * 100}%`,
          '--hoehe': `${(eintrag.bereich.hoehe / hoehe) * 100}%`,
        },
      })
    )
  }

  // Ziehen eines neuen Rahmens.
  if (rahmenmodus) {
    flaeche.addEventListener('pointerdown', (start) => {
      if (!(start.target === flaeche || start.target === bild)) return
      start.preventDefault()
      const kasten = flaeche.getBoundingClientRect()
      const startX = start.clientX - kasten.left
      const startY = start.clientY - kasten.top

      const vorschau = el('.rahmen.rahmen-neu')
      flaeche.append(vorschau)
      flaeche.setPointerCapture(start.pointerId)

      const setze = (zug) => {
        const x = Math.min(Math.max(0, zug.clientX - kasten.left), kasten.width)
        const y = Math.min(Math.max(0, zug.clientY - kasten.top), kasten.height)
        const links = Math.min(startX, x)
        const oben = Math.min(startY, y)
        vorschau.style.setProperty('--links', `${(links / kasten.width) * 100}%`)
        vorschau.style.setProperty('--oben', `${(oben / kasten.height) * 100}%`)
        vorschau.style.setProperty('--breite', `${(Math.abs(x - startX) / kasten.width) * 100}%`)
        vorschau.style.setProperty('--hoehe', `${(Math.abs(y - startY) / kasten.height) * 100}%`)
        return { links, oben, breite: Math.abs(x - startX), hoehe: Math.abs(y - startY) }
      }
      setze(start)

      let letzter = { links: startX, oben: startY, breite: 0, hoehe: 0 }
      const bewege = (zug) => {
        letzter = setze(zug)
      }
      const ende = () => {
        flaeche.removeEventListener('pointermove', bewege)
        flaeche.removeEventListener('pointerup', ende)
        flaeche.removeEventListener('pointercancel', ende)
        vorschau.remove()

        // Ein winziger Rahmen war ein Klick, kein Ziehen.
        if (letzter.breite < 12 || letzter.hoehe < 12) return

        const massstab = breiteOriginal / kasten.width
        imRahmenmodus.delete(eintrag.bild.id)
        setzeBereich(eintrag.bild.id, {
          x: Math.round(letzter.links * massstab),
          y: Math.round(letzter.oben * massstab),
          breite: Math.round(letzter.breite * massstab),
          hoehe: Math.round(letzter.hoehe * massstab),
        })
      }

      flaeche.addEventListener('pointermove', bewege)
      flaeche.addEventListener('pointerup', ende)
      flaeche.addEventListener('pointercancel', ende)
    })
  }

  /** Zeichnet die Rahmen und Griffe neu, ohne die ganze Seite anzufassen. */
  const zeichneGrenzen = () => {
    for (const alt of [...flaeche.querySelectorAll('.kartenrahmen, .schnittgriff')]) alt.remove()

    eintrag.karten.forEach((karte, i) => {
      const oben = (karte.y / hoehe) * 100
      const kartenhoehe = (karte.hoehe / hoehe) * 100

      const rahmen = el(
        '.kartenrahmen',
        {
          stil: { '--oben': `${oben}%`, '--hoehe': `${kartenhoehe}%` },
          daten: { nummer: String(i + 1) },
        },
        [
          el('.kartennummer', { text: String(i + 1) }),
          el('button.kartenweg', {
            type: 'button',
            title: 'Diesen Schein nicht lesen',
            text: 'x',
            onclick: (e) => {
              e.stopPropagation()
              const neu = eintrag.karten.filter((_, n) => n !== i)
              setzeKarten(eintrag.bild.id, neu)
            },
          }),
          i > 0
            ? el('button.kartenverbinden', {
                type: 'button',
                title: 'Mit dem Schein darueber zu einem verbinden',
                text: '↑↓',
                onclick: (e) => {
                  e.stopPropagation()
                  const vorher = eintrag.karten[i - 1]
                  if (!vorher) return
                  const verbunden = {
                    x: Math.min(vorher.x, karte.x),
                    y: Math.min(vorher.y, karte.y),
                    breite: Math.max(vorher.breite, karte.breite),
                    hoehe: Math.max(vorher.y + vorher.hoehe, karte.y + karte.hoehe) - Math.min(vorher.y, karte.y),
                  }
                  const neu = eintrag.karten.filter((_, n) => n !== i && n !== i - 1)
                  neu.splice(i - 1, 0, verbunden)
                  setzeKarten(eintrag.bild.id, neu)
                },
              })
            : null,
          el('button.kartenteilen', {
            type: 'button',
            title: 'Diesen Schein in der Mitte teilen',
            text: '✂',
            onclick: (e) => {
              e.stopPropagation()
              if (karte.hoehe < MINDESTHOEHE * 2) return
              const halbe = Math.round(karte.hoehe / 2)
              const neu = [...eintrag.karten]
              neu.splice(
                i,
                1,
                { ...karte, hoehe: halbe },
                { ...karte, y: karte.y + halbe, hoehe: karte.hoehe - halbe }
              )
              setzeKarten(eintrag.bild.id, neu)
            },
          }),
        ]
      )
      flaeche.append(rahmen)

      // Griff an der Unterkante, zum Verschieben der Grenze.
      const griff = el('.schnittgriff', {
        stil: { '--oben': `${oben + kartenhoehe}%` },
        title: 'Grenze verschieben',
      })
      griff.addEventListener('pointerdown', (start) => {
        start.preventDefault()
        griff.setPointerCapture(start.pointerId)
        const kasten = flaeche.getBoundingClientRect()

        const bewege = (zug) => {
          const anteil = Math.min(1, Math.max(0, (zug.clientY - kasten.top) / kasten.height))
          const neueGrenze = Math.round(anteil * hoehe)
          const neu = [...eintrag.karten]
          const diese = neu[i]
          const naechste = neu[i + 1]
          if (!diese) return

          const untereGrenze = diese.y + MINDESTHOEHE
          const obereGrenze = naechste
            ? naechste.y + naechste.hoehe - MINDESTHOEHE
            : hoehe
          const gesetzt = Math.min(Math.max(neueGrenze, untereGrenze), obereGrenze)

          neu[i] = { ...diese, hoehe: gesetzt - diese.y }
          if (naechste) {
            neu[i + 1] = { ...naechste, y: gesetzt, hoehe: naechste.y + naechste.hoehe - gesetzt }
          }
          eintrag.karten = neu
          griff.style.setProperty('--oben', `${(gesetzt / hoehe) * 100}%`)
          const rahmenElement = flaeche.querySelector(`.kartenrahmen[data-nummer="${i + 1}"]`)
          if (rahmenElement instanceof HTMLElement) {
            rahmenElement.style.setProperty('--hoehe', `${((gesetzt - diese.y) / hoehe) * 100}%`)
          }
        }

        const ende = () => {
          griff.removeEventListener('pointermove', bewege)
          griff.removeEventListener('pointerup', ende)
          griff.removeEventListener('pointercancel', ende)
          setzeKarten(eintrag.bild.id, eintrag.karten)
        }

        griff.addEventListener('pointermove', bewege)
        griff.addEventListener('pointerup', ende)
        griff.addEventListener('pointercancel', ende)
      })
      flaeche.append(griff)
    })
  }

  zeichneGrenzen()

  return el('.schnittbereich', {}, [
    flaeche,
    el('.schnitthilfe', {
      text:
        'Die Linien zeigen, wo getrennt wird. Ziehen verschiebt eine Grenze, das Kreuz ' +
        'nimmt einen Schein heraus, die Schere teilt ihn.',
    }),
  ])
}

/**
 * @param {import('./zustand.js').Bildeintrag[]} bilder
 * @returns {HTMLElement}
 */
function leseleiste(bilder) {
  const gesamtKarten = bilder.reduce((n, b) => n + b.karten.length, 0)
  const stand = Zustand.hole()

  return el('.leseleiste', {}, [
    el('.leseinfo', {
      text: `${bilder.length} Bild(er), ${gesamtKarten} Schein(e) bereit zum Lesen.`,
    }),
    el('label.schalter', {}, [
      el('input', {
        type: 'checkbox',
        checked: stand.einstellungen.gruendlich ? 'checked' : null,
        onchange: (e) =>
          Zustand.aendere({
            einstellungen: {
              ...stand.einstellungen,
              gruendlich: /** @type {HTMLInputElement} */ (e.target).checked,
            },
          }),
      }),
      el('span', { text: 'Geldfelder einzeln nachlesen (genauer, dauert laenger)' }),
    ]),
    el('button.knopf.knopf-haupt', {
      type: 'button',
      text: 'Jetzt lesen',
      disabled: stand.arbeit.laeuft ? 'disabled' : null,
      onclick: async () => {
        const ids = [...Zustand.hole().bilder.keys()]
        const ergebnis = await leseBilder(ids)
        if (ergebnis.gelesen > 0) Zustand.aendere({ ansicht: 'scheine' })
      },
    }),
    el('button.knopf', {
      type: 'button',
      text: 'Alle Bilder verwerfen',
      onclick: () => {
        if (!confirm('Alle hochgeladenen Bilder aus der Ansicht nehmen? Gelesene Scheine bleiben erhalten.')) return
        Zustand.aendere({ bilder: new Map() })
      },
    }),
  ])
}

/** Wird von app.js gebraucht, damit eine leere Liste eine Kennung bekommt. */
export const kennung = neueKennung()
