// @ts-check
/**
 * Misst den Farbkontrast der WIRKLICH GEZEICHNETEN Seite.
 *
 * WARUM NICHT DAS CSS LESEN
 *
 * Bis zum 18.09.2026 wurde der Kontrast von Hand geprueft, einmal, und dabei
 * sind an einem Tag neun Fehler gefunden worden. Ein Werkzeug, das die
 * CSS-Dateien liest, haette sie nicht alle gefunden: bei CSS gewinnt die
 * letzte passende Regel, und welche das ist, weiss nur der Browser. Fuenf der
 * neun Fehler kamen genau daher, dass eine Regel eine andere ueberschrieb.
 *
 * Also wird hier nichts gelesen und nichts geraten. Es wird die fertige Seite
 * abgelaufen und bei jedem Element der Browser gefragt, welche Farbe am Ende
 * herauskam.
 *
 * DIE DREI FALLEN, an denen selbstgebaute Messungen scheitern
 *
 * 1. HALBDURCHSICHTIGE FARBEN. Eine Marke wie `--gut-tief` traegt nur zwoelf
 *    Prozent Deckung.
 *    Wer daraus direkt eine Leuchtdichte rechnet, bekommt Unsinn. Die Farbe
 *    muss ZUERST auf ihre Unterlage gerechnet werden, und deren Unterlage
 *    unter Umstaenden auch. Diese Datei sammelt deshalb ALLE Schichten bis zu
 *    einer undurchsichtigen und legt sie von unten nach oben uebereinander.
 *
 * 2. DIE UNTERLAGE IST SELTEN DAS ELTERNELEMENT. Ein Text liegt oft in drei
 *    ineinandergeschachtelten Kaesten, von denen die inneren beiden
 *    durchsichtig sind. Die Farbe dahinter steht dann drei Ebenen hoeher.
 *
 * 3. DIE SCHWELLE HAENGT AN DER SCHRIFTGROESSE. Grosser Text (ab 24 Pixel,
 *    oder ab 18.66 Pixel wenn fett) darf 3:1, normaler Text braucht 4.5:1.
 *    Wer alles ueber einen Kamm schert, meldet entweder zu viel oder zu wenig.
 *
 * WAS NICHT GEMELDET WIRD
 *
 * Abgeschaltete Bedienelemente. Ein ausgegrauter Knopf SOLL blass sein; das
 * ist seine Aussage. Die Norm nimmt sie ausdruecklich aus.
 *
 * ANWENDUNG
 *
 * Dieses Modul einbinden, dann `bericht(misseSeite())` auf die Konsole legen.
 *
 * Oder ueber werkzeug/probe/kontrast.html, das die ganze Oberflaeche in beiden
 * Farbzustaenden und in zwei Breiten durchmisst.
 */

/** Ab hier gilt Text als gross (Pixel). */
const GROSS_AB = 24

/** Ab hier gilt fetter Text als gross (Pixel). */
const GROSS_FETT_AB = 18.66

/** Was normaler Text mindestens braucht. */
const SCHWELLE_NORMAL = 4.5

/** Was grosser Text, Raender und Symbole mindestens brauchen. */
const SCHWELLE_GROSS = 3

/**
 * Was Karam angenehm findet. Ueber der Norm, aber darunter strengt es an.
 *
 * Keine Regel, nur ein Hinweis: alles zwischen SCHWELLE und ANGENEHM wird als
 * "knapp" gemeldet, nicht als Fehler.
 */
const ANGENEHM = 7

/**
 * Macht aus einer Farbangabe des Browsers Zahlen.
 *
 * Der Browser liefert immer 'rgb(r, g, b)' oder 'rgba(r, g, b, a)', nie Hex
 * und nie einen Namen. Bei 'transparent' kommt rgba(0, 0, 0, 0).
 *
 * @param {string} text
 * @returns {{r: number, g: number, b: number, a: number}|null}
 */
export function farbe(text) {
  const treffer = String(text ?? '').match(
    /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)/i
  )
  if (!treffer) return null

  let a = 1
  if (treffer[4] !== undefined) {
    a = treffer[4].endsWith('%') ? parseFloat(treffer[4]) / 100 : parseFloat(treffer[4])
  }
  return {
    r: Number(treffer[1]),
    g: Number(treffer[2]),
    b: Number(treffer[3]),
    a: Number.isFinite(a) ? a : 1,
  }
}

/**
 * Legt eine Farbe auf eine Unterlage.
 *
 * DAS IST DIE STELLE, AN DER SELBSTGEBAUTE MESSUNGEN SCHEITERN. Ohne diesen
 * Schritt ist jede Zahl fuer eine halbdurchsichtige Flaeche falsch.
 *
 * @param {{r: number, g: number, b: number, a: number}} oben
 * @param {{r: number, g: number, b: number, a: number}} unten
 */
export function lege(oben, unten) {
  const a = oben.a + unten.a * (1 - oben.a)
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: (oben.r * oben.a + unten.r * unten.a * (1 - oben.a)) / a,
    g: (oben.g * oben.a + unten.g * unten.a * (1 - oben.a)) / a,
    b: (oben.b * oben.a + unten.b * unten.a * (1 - oben.a)) / a,
    a,
  }
}

/**
 * Die Leuchtdichte nach WCAG.
 *
 * @param {{r: number, g: number, b: number}} f
 */
export function leuchtdichte(f) {
  const teil = (wert) => {
    const v = wert / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * teil(f.r) + 0.7152 * teil(f.g) + 0.0722 * teil(f.b)
}

/**
 * Das Kontrastverhaeltnis zweier undurchsichtiger Farben.
 *
 * @param {{r: number, g: number, b: number}} a
 * @param {{r: number, g: number, b: number}} b
 */
export function verhaeltnis(a, b) {
  const la = leuchtdichte(a)
  const lb = leuchtdichte(b)
  const hell = Math.max(la, lb)
  const dunkel = Math.min(la, lb)
  return (hell + 0.05) / (dunkel + 0.05)
}

/**
 * Sucht die Farbe, die WIRKLICH hinter einem Element liegt.
 *
 * Geht nach oben, bis eine undurchsichtige Flaeche kommt, und legt alle
 * halbdurchsichtigen Schichten von unten nach oben uebereinander. Findet sich
 * gar nichts, gilt Weiss: so faerbt der Browser eine Seite ohne Angabe.
 *
 * @param {Element} element
 * @returns {{r: number, g: number, b: number, a: number}}
 */
export function unterlageVon(element) {
  /** @type {{r: number, g: number, b: number, a: number}[]} */
  const schichten = []
  /** @type {Element|null} */
  let stelle = element

  while (stelle) {
    const stil = getComputedStyle(stelle)
    const f = farbe(stil.backgroundColor)
    if (f && f.a > 0) {
      schichten.push(f)
      if (f.a >= 1) break
    }
    stelle = stelle.parentElement
  }

  // Von unten nach oben zusammenlegen. Die zuletzt gefundene Schicht liegt
  // am weitesten unten.
  let ergebnis = { r: 255, g: 255, b: 255, a: 1 }
  for (let i = schichten.length - 1; i >= 0; i -= 1) {
    ergebnis = lege(schichten[i], ergebnis)
  }
  return ergebnis
}

/**
 * Traegt dieses Element eigenen, sichtbaren Text?
 *
 * Nur eigenen: ein Kasten, der bloss andere Kaesten enthaelt, hat keine
 * Schriftfarbe, die jemand liest, und wuerde die Liste mit Dopplungen fuellen.
 *
 * @param {Element} element
 */
function hatEigenenText(element) {
  for (const knoten of element.childNodes) {
    if (knoten.nodeType === 3 && String(knoten.textContent ?? '').trim().length > 0) return true
  }
  return false
}

/**
 * Ist das Element abgeschaltet? Dann gilt die Norm nicht.
 *
 * @param {Element} element
 */
function istAbgeschaltet(element) {
  if (element.closest('[disabled]')) return true
  if (element.closest('[aria-disabled="true"]')) return true
  return false
}

/**
 * Misst eine ganze Seite.
 *
 * @param {ParentNode} [wurzel]
 * @returns {{
 *   geprueft: number,
 *   fehler: {wo: string, text: string, vorn: string, hinten: string, wert: number, noetig: number, groesse: number, fett: boolean}[],
 *   knapp: {wo: string, text: string, vorn: string, hinten: string, wert: number, groesse: number}[],
 * }}
 */
export function misseSeite(wurzel) {
  const ziel = wurzel ?? document.body
  const alle = ziel.querySelectorAll('*')

  const fehler = []
  const knapp = []
  let geprueft = 0

  for (const element of alle) {
    if (!hatEigenenText(element)) continue

    const stil = getComputedStyle(element)
    if (stil.visibility === 'hidden' || stil.display === 'none') continue
    if (Number(stil.opacity) === 0) continue

    const vorn = farbe(stil.color)
    if (!vorn) continue

    /*
      DURCHSICHTIGE SCHRIFT IST KEINE SCHRIFT.

      Seit dem 17.09.2026 tragen die Stufenzeichen ihr Sinnbild als Maske, und
      der Buchstabe darunter steht auf transparent: er ist nur der Rueckfall,
      falls stil/ geloescht wird. Dasselbe gilt fuer ein Anbieterzeichen mit
      echter Logodatei.

      Ohne diese Zeile haette der Messer jedes davon mit 1,00:1 beanstandet,
      also genau die Stellen gemeldet, an denen mit Absicht nichts zu lesen
      ist. Ein Messwerkzeug, das falsche Beanstandungen liefert, wird nach
      drei Tagen ignoriert, und dann faengt es auch die echten nicht mehr.
    */
    if (vorn.a === 0) continue

    const hinten = unterlageVon(element)
    // Halbdurchsichtige Schrift liegt auf ihrer eigenen Unterlage.
    const schrift = vorn.a < 1 ? lege(vorn, hinten) : vorn

    const groesse = parseFloat(stil.fontSize) || 16
    const gewicht = Number(stil.fontWeight) || 400
    const fett = gewicht >= 700
    const gross = groesse >= GROSS_AB || (fett && groesse >= GROSS_FETT_AB)
    const noetig = gross ? SCHWELLE_GROSS : SCHWELLE_NORMAL

    const wert = verhaeltnis(schrift, hinten)
    geprueft += 1

    const wo = beschreibe(element)
    const text = String(element.textContent ?? '').trim().slice(0, 44)

    if (wert < noetig) {
      if (istAbgeschaltet(element)) continue
      fehler.push({
        wo,
        text,
        vorn: `rgb(${Math.round(schrift.r)}, ${Math.round(schrift.g)}, ${Math.round(schrift.b)})`,
        hinten: `rgb(${Math.round(hinten.r)}, ${Math.round(hinten.g)}, ${Math.round(hinten.b)})`,
        wert: Math.round(wert * 100) / 100,
        noetig,
        groesse,
        fett,
      })
    } else if (wert < ANGENEHM && !gross) {
      knapp.push({
        wo,
        text,
        vorn: `rgb(${Math.round(schrift.r)}, ${Math.round(schrift.g)}, ${Math.round(schrift.b)})`,
        hinten: `rgb(${Math.round(hinten.r)}, ${Math.round(hinten.g)}, ${Math.round(hinten.b)})`,
        wert: Math.round(wert * 100) / 100,
        groesse,
      })
    }
  }

  return { geprueft, fehler, knapp }
}

/**
 * Nennt ein Element so, dass man es im Quelltext wiederfindet.
 *
 * @param {Element} element
 */
function beschreibe(element) {
  const teile = [element.tagName.toLowerCase()]
  const klassen = String(element.className ?? '')
  if (typeof klassen === 'string' && klassen.trim()) {
    teile.push('.' + klassen.trim().split(/\s+/).join('.'))
  }
  for (const merkmal of element.getAttributeNames()) {
    if (merkmal.startsWith('data-')) teile.push(`[${merkmal}="${element.getAttribute(merkmal)}"]`)
  }
  return teile.join('')
}

/**
 * Dasselbe fuer Raender und andere Flaechen ohne Text.
 *
 * Ein Rahmen, der ein Feld vom Hintergrund trennt, braucht 3:1. Sonst sieht
 * man nicht, wo das Feld aufhoert. Das trifft besonders Eingabefelder, und
 * genau dort ist es am wichtigsten.
 *
 * @param {ParentNode} [wurzel]
 */
export function misseRaender(wurzel) {
  const ziel = wurzel ?? document.body
  const fehler = []
  let geprueft = 0

  for (const element of ziel.querySelectorAll('input, select, textarea, button, .ausschnitt')) {
    const stil = getComputedStyle(element)
    if (stil.visibility === 'hidden' || stil.display === 'none') continue
    if (istAbgeschaltet(element)) continue
    if (parseFloat(stil.borderTopWidth) === 0) continue

    const rand = farbe(stil.borderTopColor)
    if (!rand || rand.a === 0) continue

    // Der Rand liegt auf dem, was HINTER dem Element ist, nicht auf dessen
    // eigener Flaeche.
    const dahinter = element.parentElement ? unterlageVon(element.parentElement) : { r: 255, g: 255, b: 255, a: 1 }
    const randfarbe = rand.a < 1 ? lege(rand, dahinter) : rand
    const wert = verhaeltnis(randfarbe, dahinter)
    geprueft += 1

    if (wert < SCHWELLE_GROSS) {
      fehler.push({
        wo: beschreibe(element),
        wert: Math.round(wert * 100) / 100,
        rand: `rgb(${Math.round(randfarbe.r)}, ${Math.round(randfarbe.g)}, ${Math.round(randfarbe.b)})`,
        dahinter: `rgb(${Math.round(dahinter.r)}, ${Math.round(dahinter.g)}, ${Math.round(dahinter.b)})`,
      })
    }
  }

  return { geprueft, fehler }
}

/**
 * Macht aus einer Messung einen lesbaren Bericht.
 *
 * @param {ReturnType<typeof misseSeite>} messung
 */
export function bericht(messung) {
  const zeilen = [`${messung.geprueft} Textstellen gemessen.`]

  if (messung.fehler.length === 0) {
    zeilen.push('Keine Beanstandung.')
  } else {
    zeilen.push('', `${messung.fehler.length} unter der Schwelle:`)
    for (const f of messung.fehler.sort((a, b) => a.wert - b.wert)) {
      zeilen.push(
        `  ${f.wert.toFixed(2)}:1  (noetig ${f.noetig})  ${f.wo}`,
        `      "${f.text}"  ${f.vorn} auf ${f.hinten}  ${Math.round(f.groesse)}px${f.fett ? ' fett' : ''}`
      )
    }
  }

  if (messung.knapp.length > 0) {
    zeilen.push('', `${messung.knapp.length} knapp ueber der Schwelle (unter ${ANGENEHM}:1):`)
    for (const k of messung.knapp.sort((a, b) => a.wert - b.wert).slice(0, 20)) {
      zeilen.push(`  ${k.wert.toFixed(2)}:1  ${k.wo}  "${k.text}"`)
    }
  }

  return zeilen.join('\n')
}
