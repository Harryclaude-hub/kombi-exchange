// @ts-check
/**
 * Die fuenf Ansichten, von denen Karam am 13.09.2026 Bildschirmfotos geschickt
 * hat, als Bild nachgebaut.
 *
 * WOZU: um den GANZEN Weg zu messen, nicht nur die Textebene. Zerlegung in
 * Karten, Anbietererkennung, Texterkennung, Auswertung.
 *
 * WAS DAS BEWEIST UND WAS NICHT
 *
 * Ein schlechtes Ergebnis hier beweist, dass es NICHT reicht: die Struktur
 * stimmt dann nicht, und das haengt nicht an der Schriftart.
 *
 * Ein gutes Ergebnis hier beweist NICHT, dass es an echten Fotos reicht.
 * Nachgebaute Bilder haben die Schrift, die Kantenglaettung und die
 * Pixeldichte dessen, der sie gebaut hat. Genau daran scheitert eine
 * Texterkennung nicht. Sie scheitert an dem, was der echte Anbieter wirklich
 * auf den Schirm zeichnet. Das ist die Untergrenze, nicht der Beweis.
 *
 * Die Schriftgroessen sind bewusst so klein wie auf den echten Fotos, also 12
 * bis 15 Bildpunkte. Gross gezeichnete Bilder waeren geschummelt.
 *
 * Diese Datei zeichnet Bilder und braucht dafuer echte Farben. Sie gehoert
 * deshalb nicht zur Designschicht und ist von der Farbpruefung ausgenommen
 * (werkzeug/probe, siehe werkzeug/pruefe.mjs).
 */

/** @param {number} n */
const en = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** @param {number} n */
const de = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * @param {number} breite
 * @param {number} hoehe
 * @param {string} grund
 */
function leinwand(breite, hoehe, grund) {
  const c = document.createElement('canvas')
  c.width = breite
  c.height = hoehe
  const k = c.getContext('2d')
  if (!k) throw new Error('Kein Zeichenkontext.')
  k.fillStyle = grund
  k.fillRect(0, 0, breite, hoehe)
  k.textBaseline = 'top'
  return { c, k }
}

/**
 * PS3838: Wettverlauf als Tabelle, helle Zeilen, Kopfzeile rot.
 *
 * @param {{zeilen: {nr: string, quote: number, einsatz: number, gewinn: number, gewonnen: boolean}[]}} wunsch
 */
export function baueP3838(wunsch) {
  const zeilen = wunsch.zeilen
  const B = 1280
  const kopf = 26
  const zh = 86
  const { c, k } = leinwand(B, kopf + zeilen.length * zh + 8, '#ffffff')

  // Kopfzeile der Tabelle.
  k.fillStyle = '#9b1c2e'
  k.fillRect(0, 0, B, kopf)
  k.fillStyle = '#ffffff'
  k.font = 'bold 11px Arial'
  const spalten = [
    ['#', 8], ['Product', 30], ['Detail', 150], ['Selection', 420],
    ['Odds', 700], ['Stake (EUR)', 800], ['Win/Loss', 960], ['Commission', 1070], ['Status', 1200],
  ]
  for (const [text, x] of spalten) k.fillText(String(text), Number(x), 7)

  zeilen.forEach((z, i) => {
    const y = kopf + i * zh
    k.fillStyle = i % 2 ? '#fbe9e9' : '#f7dede'
    k.fillRect(0, y, B, zh - 2)

    k.fillStyle = '#333333'
    k.font = '12px Arial'
    k.fillText(String(i + 1), 8, y + 30)
    k.fillText('Sportsbook', 30, y + 30)

    // Detail: Scheinnummer kursiv rot, darunter Sportart und zwei Zeitpunkte.
    k.fillStyle = '#a03050'
    k.font = 'italic 11px Arial'
    k.fillText(z.nr, 150, y + 6)
    k.fillStyle = '#333333'
    k.font = 'bold 11px Arial'
    k.fillText('Football', 150, y + 22)
    k.font = '11px Arial'
    k.fillText('2026-09-13 15:57:21', 150, y + 38)
    k.fillText('2026-09-13 11:35:43', 150, y + 52)

    // Selection: mehrere Zeilen, die erste teils blau.
    k.fillStyle = '#1a4b9c'
    k.font = 'bold 12px Arial'
    k.fillText('Over', 480, y + 5)
    k.fillStyle = '#c0392b'
    k.fillText('84.5', 516, y + 5)
    k.font = '12px Arial'
    k.fillText('Rushing Yards', 552, y + 5)
    k.font = '11px Arial'
    k.fillText('Jahmyr Gibbs Total Rushing Yards', 450, y + 21)
    k.fillText('Detroit Lions-vs-New Orleans Saints', 440, y + 35)
    k.fillText('Player Props', 580, y + 49)
    k.fillStyle = '#333333'
    k.fillText('NFL @ 2026-09-13', 540, y + 63)

    // Odds: Zahl und darunter der Formatbuchstabe.
    k.fillStyle = '#333333'
    k.font = '12px Arial'
    k.fillText(z.quote.toFixed(3), 700, y + 28)
    k.fillStyle = '#1a4b9c'
    k.font = '11px Arial'
    k.fillText('D', 706, y + 44)

    // Stake.
    k.fillStyle = '#333333'
    k.font = '12px Arial'
    k.fillText(`Risk: ${en(z.einsatz)}`, 800, y + 22)
    k.fillText(`(${en(z.einsatz)})`, 810, y + 38)

    // Win/Loss und Commission.
    k.fillStyle = z.gewonnen ? '#333333' : '#c0392b'
    k.fillText(z.gewonnen ? en(z.gewinn) : '-' + en(z.einsatz), 960, y + 30)
    k.fillStyle = '#c0392b'
    k.fillText('0.00', 1075, y + 30)

    // Status.
    k.fillStyle = '#1a4b9c'
    k.font = '12px Arial'
    k.fillText('Settled', 1200, y + 22)
    k.fillStyle = z.gewonnen ? '#1e8449' : '#c0392b'
    k.font = 'bold 12px Arial'
    k.fillText(z.gewonnen ? 'WIN' : 'LOSE', 1205, y + 38)
  })

  return c
}

/**
 * Betway: helle Karten, deutsch, gruene Badges.
 *
 * @param {{karten: {quote: number, einsatz: number, auszahlung: number, stand: 'GEWONNEN'|'UNGUELTIG'}[]}} wunsch
 */
export function baueBetway(wunsch) {
  const B = 870
  const kh = 340
  const { c, k } = leinwand(B, wunsch.karten.length * kh + 20, '#f2f2f2')

  wunsch.karten.forEach((z, i) => {
    const y = 10 + i * kh
    k.fillStyle = '#ffffff'
    k.fillRect(20, y, B - 40, kh - 30)

    k.fillStyle = '#111111'
    k.font = 'bold 16px Arial'
    k.fillText('Einzelwette', 36, y + 28)
    k.fillStyle = '#1e8449'
    k.fillText(`@ ${z.quote.toFixed(2)}`, 128, y + 28)

    // Badge rechts.
    const gewonnen = z.stand === 'GEWONNEN'
    k.fillStyle = gewonnen ? '#1e8449' : '#444444'
    k.fillRect(B - 140, y + 22, 100, 22)
    k.fillStyle = '#ffffff'
    k.font = 'bold 11px Arial'
    k.fillText(gewonnen ? 'GEWONNEN' : 'UNGUELTIG', B - 132, y + 28)

    k.fillStyle = '#333333'
    k.font = '13px Arial'
    k.fillText('Los Angeles Rams - San Francisco 49ers', 36, y + 84)

    k.fillStyle = '#f5f5f5'
    k.fillRect(36, y + 112, B - 72, 46)
    k.fillStyle = '#111111'
    k.font = 'bold 12px Arial'
    k.fillText('7', 58, y + 120)
    k.fillText('Los Angeles Rams', 88, y + 120)
    k.fillText('27', 54, y + 142)
    k.fillText('San Francisco 49ers', 88, y + 142)

    k.fillStyle = '#111111'
    k.font = 'bold 14px Arial'
    k.fillText('Deebo Samuel Sr. (SF) Ueber 2.5:', 66, y + 180)
    k.fillStyle = '#555555'
    k.font = '14px Arial'
    k.fillText('Erfolgreiche Annahmen gesamt', 300, y + 180)

    // Fusszeile: links Umsetzen, rechts das Ergebnis.
    k.fillStyle = '#777777'
    k.font = '12px Arial'
    k.fillText('Umsetzen', 36, y + 232)
    k.fillStyle = '#111111'
    k.font = 'bold 20px Arial'
    k.fillText(`€${de(z.einsatz)}`, 36, y + 252)

    k.fillStyle = gewonnen ? '#1e8449' : '#777777'
    k.font = 'bold 12px Arial'
    const rechtsText = gewonnen ? 'DU HAST GEWONNEN' : 'Erstattet'
    const breiteText = k.measureText(rechtsText).width
    k.fillText(rechtsText, B - 56 - breiteText, y + 232)
    k.font = 'bold 20px Arial'
    const betrag = `€${de(z.auszahlung)}`
    k.fillText(betrag, B - 56 - k.measureText(betrag).width, y + 252)
  })

  return c
}

/**
 * bet365: dunkle Karten, deutsch, tuerkise Akzente.
 *
 * @param {{karten: {quote: number, einsatz: number, auszahlung: number}[]}} wunsch
 */
export function baueBet365(wunsch) {
  const B = 1280
  const kh = 268
  const { c, k } = leinwand(B, wunsch.karten.length * kh + 16, '#0d0d0d')

  wunsch.karten.forEach((z, i) => {
    const y = 8 + i * kh
    k.fillStyle = '#1c1f22'
    k.fillRect(8, y, B - 16, kh - 20)
    k.strokeStyle = '#2fe0a8'
    k.lineWidth = 2
    k.strokeRect(8, y, B - 16, kh - 20)

    k.fillStyle = '#2fe0a8'
    k.font = 'bold 14px Arial'
    k.fillText(`€${de(z.einsatz)}`, 28, y + 22)
    k.fillStyle = '#2fe0a8'
    k.font = '14px Arial'
    k.fillText('Einzelwetten', 110, y + 22)

    k.fillStyle = '#2fe0a8'
    k.fillRect(B - 140, y - 2, 120, 24)
    k.fillStyle = '#0d0d0d'
    k.font = 'bold 12px Arial'
    k.fillText('GEWONNEN', B - 128, y + 3)

    k.fillStyle = '#ffffff'
    k.font = 'bold 14px Arial'
    k.fillText('Nahshon Wright - Weniger als 2.5', 56, y + 60)
    k.fillStyle = '#dddddd'
    k.font = '14px Arial'
    k.fillText(z.quote.toFixed(2), 290, y + 60)
    k.fillStyle = '#9aa0a6'
    k.font = '11px Arial'
    k.fillText('Tackles Ü/U', 76, y + 80)

    k.fillStyle = '#ffffff'
    k.font = '12px Arial'
    k.fillText('NY Jets', 84, y + 124)
    k.fillText('TEN Titans', 84, y + 146)
    k.fillStyle = '#9aa0a6'
    k.fillText('23', 1230, y + 124)
    k.fillText('10', 1230, y + 146)

    // Fusszeile.
    k.fillStyle = '#9aa0a6'
    k.font = '11px Arial'
    k.fillText('Einsatz:', 56, y + 186)
    k.fillText('Gewinn', 460, y + 186)
    k.fillStyle = '#ffffff'
    k.font = 'bold 15px Arial'
    k.fillText(`€${de(z.einsatz)}`, 56, y + 204)
    k.fillText(`€${de(z.auszahlung)}`, 460, y + 204)

    k.fillStyle = '#2b2f33'
    k.fillRect(870, y + 176, 380, 44)
    k.fillStyle = '#2fe0a8'
    k.font = 'bold 14px Arial'
    k.fillText(`€${de(z.auszahlung)}  Gewinn`, 1000, y + 190)
  })

  return c
}

/**
 * Stake: dunkle Karten in ZWEI Spalten, deutsch, Krypto mit acht Stellen.
 *
 * @param {{karten: {quote: number, einsatz: number, auszahlung: number, gewonnen: boolean}[]}} wunsch
 */
export function baueStake(wunsch) {
  const B = 1030
  const spaltenBreite = 500
  const kh = 340
  const reihen = Math.ceil(wunsch.karten.length / 2)
  const { c, k } = leinwand(B, reihen * kh + 16, '#0f212e')

  /** Krypto-Betrag mit acht Stellen, ab einer Laenge abgeschnitten. */
  const krypto = (n) => {
    const voll = n.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })
    return voll.length > 14 ? voll.slice(0, 14) + '...' : voll
  }

  wunsch.karten.forEach((z, i) => {
    const sp = i % 2
    const reihe = Math.floor(i / 2)
    const x = 8 + sp * (spaltenBreite + 14)
    const y = 8 + reihe * kh

    k.fillStyle = '#1a2c38'
    k.fillRect(x, y, spaltenBreite, kh - 16)

    k.fillStyle = '#ffffff'
    k.font = 'bold 14px Arial'
    k.fillText('Über 82.5 Rushing Yards', x + 34, y + 16)

    // Badge.
    k.fillStyle = z.gewonnen ? '#1ea55b' : '#3a4a57'
    k.fillRect(x + spaltenBreite - 78, y + 12, 66, 18)
    k.fillStyle = '#ffffff'
    k.font = 'bold 10px Arial'
    k.fillText(z.gewonnen ? 'Gewonnen' : 'Verlust', x + spaltenBreite - 72, y + 16)

    k.fillStyle = '#b1bad3'
    k.font = '12px Arial'
    k.fillText('Jahmyr Gibbs', x + 16, y + 40)

    k.strokeStyle = '#3a4a57'
    k.lineWidth = 1
    k.strokeRect(x + 16, y + 62, 34, 20)
    k.fillStyle = '#ffffff'
    k.font = 'bold 12px Arial'
    k.fillText('156', x + 22, y + 66)

    k.fillStyle = '#b1bad3'
    k.font = '12px Arial'
    k.fillText('So., 13. Sept.  19:00', x + 16, y + 100)

    k.fillStyle = '#ffffff'
    k.font = 'bold 13px Arial'
    k.fillText('Detroit Lions', x + 44, y + 128)
    k.fillText('New Orleans Saints', x + 44, y + 152)
    k.strokeRect(x + spaltenBreite - 54, y + 122, 34, 46)
    k.fillStyle = '#b1bad3'
    k.font = '12px Arial'
    k.fillText('31', x + spaltenBreite - 44, y + 126)
    k.fillText('30', x + spaltenBreite - 44, y + 148)

    // Trennlinie mit dem Schriftzug.
    k.strokeStyle = '#2f4553'
    k.beginPath()
    k.moveTo(x + 16, y + 200)
    k.lineTo(x + spaltenBreite - 16, y + 200)
    k.stroke()
    k.fillStyle = '#ffffff'
    k.font = 'italic bold 20px Georgia'
    k.fillText('Stake', x + spaltenBreite / 2 - 26, y + 188)

    // Die drei Zeilen mit den Zahlen.
    const zeilen = [
      ['Quoten', z.quote.toFixed(2).replace('.', ','), '#4a9eff'],
      ['Einsatz', krypto(z.einsatz), '#ffffff'],
      ['Auszahlung', krypto(z.auszahlung), z.gewonnen ? '#1ea55b' : '#ffffff'],
    ]
    zeilen.forEach(([name, wert, farbe], zi) => {
      const zy = y + 232 + zi * 24
      k.fillStyle = '#b1bad3'
      k.font = '13px Arial'
      k.fillText(String(name), x + 16, zy)
      k.fillStyle = String(farbe)
      k.font = 'bold 13px Arial'
      const t = String(wert)
      k.fillText(t, x + spaltenBreite - 40 - k.measureText(t).width, zy)
      // Das runde Waehrungszeichen rechts.
      k.fillStyle = '#1ea55b'
      k.beginPath()
      k.arc(x + spaltenBreite - 26, zy + 7, 7, 0, Math.PI * 2)
      k.fill()
      k.fillStyle = '#ffffff'
      k.font = 'bold 9px Arial'
      k.fillText('T', x + spaltenBreite - 29, zy + 3)
    })
  })

  return c
}

/**
 * BetOnline: helle Liste, gruener Badge, englisch.
 *
 * @param {{karten: {nr: string, quote: number, einsatz: number, auszahlung: number|null, gewonnen: boolean}[]}} wunsch
 */
export function baueBetOnline(wunsch) {
  const B = 745
  const kh = 155
  const { c, k } = leinwand(B, wunsch.karten.length * kh + 10, '#eceff1')

  wunsch.karten.forEach((z, i) => {
    const y = 5 + i * kh
    k.fillStyle = '#ffffff'
    k.fillRect(8, y, B - 16, kh - 12)

    k.fillStyle = '#333333'
    k.font = '12px Arial'
    k.fillText(`#${z.nr}`, 20, y + 10)
    k.fillStyle = '#8a8a8a'
    k.fillText('Sep 13, 1:28 PM', 100, y + 10)

    k.fillStyle = z.gewonnen ? '#d7f5e6' : '#fde0e0'
    k.fillRect(B - 68, y + 6, 48, 20)
    k.fillStyle = z.gewonnen ? '#1e8449' : '#c0392b'
    k.font = '11px Arial'
    k.fillText(z.gewonnen ? 'won' : 'lost', B - 56, y + 11)

    k.fillStyle = '#111111'
    k.font = 'bold 15px Arial'
    k.fillText('Caleb Williams', 20, y + 32)
    k.fillStyle = '#666666'
    k.font = '12px Arial'
    k.fillText('Chicago Bears @ Carolina Panthers', 20, y + 52)
    k.fillStyle = '#111111'
    k.font = 'bold 12px Arial'
    k.fillText('WILL HAVE OVER 229.5 PASSING YARDS', 20, y + 72)
    k.fillText('FINAL PLAYER SCORE: 268', 20, y + 88)

    k.strokeStyle = '#eceff1'
    k.beginPath()
    k.moveTo(8, y + 108)
    k.lineTo(B - 8, y + 108)
    k.stroke()

    k.fillStyle = '#333333'
    k.font = '12px Arial'
    const us = z.quote >= 2 ? `+${Math.round((z.quote - 1) * 100)}` : `-${Math.round(100 / (z.quote - 1))}`
    k.fillText(`Odds: ${us}`, 20, y + 118)
    k.fillText(`Stake: $ ${en(z.einsatz)}`, 330, y + 118)
    if (z.auszahlung !== null) {
      k.fillText('Returns:', 590, y + 118)
      k.fillStyle = '#1e8449'
      k.fillText(`$ ${en(z.auszahlung)}`, 645, y + 118)
    }
  })

  return c
}
