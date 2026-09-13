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
import { nimmAuf, leseBilder, setzeKarten, setzeBuchmacher } from './aufnahme.js'
import { BUCHMACHER } from '../kern/buchmacher.js'

/** Mindesthoehe einer Karte im Originalbild. */
const MINDESTHOEHE = 40

/**
 * Zeichnet die Ansicht.
 *
 * @param {HTMLElement} ziel
 */
export function zeichne(ziel) {
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
      onclick: () => eingabe.click(),
    },
    [
      el('.ablage-zeichen', { text: '+' }),
      el('.ablage-titel', { text: 'Bildschirmfotos hierher ziehen' }),
      el('.ablage-text', { text: 'oder klicken zum Auswaehlen. Die Bilder bleiben auf diesem Geraet.' }),
      eingabe,
    ]
  )
  return flaeche
}

/**
 * @param {import('./zustand.js').Bildeintrag} eintrag
 * @returns {HTMLElement}
 */
function bildkarte(eintrag) {
  const anzahl = eintrag.karten.length

  return el('.bildkarte', { daten: { bild: eintrag.bild.id } }, [
    el('.bildkopf', {}, [
      el('.bildname', { text: eintrag.bild.dateiname }),
      el('.bildmasse', { text: `${eintrag.bild.breite} x ${eintrag.bild.hoehe}` }),
      el('.bildzahl', {
        text: anzahl === 1 ? '1 Schein erkannt' : `${anzahl} Scheine erkannt`,
      }),
    ]),
    anbieterwahl(eintrag),
    schnittflaeche(eintrag),
    eintrag.hinweise.length > 0
      ? el('ul.bildhinweise', {}, eintrag.hinweise.map((h) => el('li', { text: h })))
      : null,
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
  })

  const flaeche = el('.schnittflaeche', {}, [bild])

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
