// @ts-check
/**
 * Testbilder fuer die Bildzerlegung.
 *
 * Die Zerlegung laesst sich nicht mit node pruefen, weil sie eine Leinwand
 * braucht. Deshalb werden die Faelle hier nachgebaut und im Browser geprueft,
 * siehe werkzeug/probe/index.html.
 *
 * Die Faelle bilden ab, was bei echten Buchmachern wirklich vorkommt:
 *   graue Luecke zwischen den Karten, wie bei BetOnline
 *   weisse Liste, nur durch die Rahmenlinie getrennt
 *   Karten mit einer INNEREN Trennlinie ueber der Zeile mit Einsatz und Quote
 *   dunkler Modus
 *   ein ganzes Browserfenster mit Menueleiste und Seiteninhalt
 *
 * Diese Datei zeichnet Bilder und braucht dafuer echte Farben. Sie gehoert
 * deshalb nicht zur Designschicht und ist von der Farbpruefung ausgenommen.
 */

/**
 * @typedef {object} Listenwunsch
 * @property {string} [lueckenfarbe]
 * @property {number} [luecke]
 * @property {boolean} [innenlinie]
 * @property {number} [anzahl]
 * @property {boolean} [dunkel]
 */

/**
 * Baut eine Liste von Wettkarten.
 *
 * @param {Listenwunsch} [wunsch]
 * @returns {HTMLCanvasElement}
 */
export function baueListe(wunsch = {}) {
  const lueckenfarbe = wunsch.lueckenfarbe ?? '#eceff1'
  const luecke = wunsch.luecke ?? 12
  const innenlinie = wunsch.innenlinie !== false
  const anzahl = wunsch.anzahl ?? 3
  const dunkel = wunsch.dunkel === true

  const breite = 740
  const kartenhoehe = 152
  const hoehe = anzahl * kartenhoehe + (anzahl + 1) * luecke

  const leinwand = document.createElement('canvas')
  leinwand.width = breite
  leinwand.height = hoehe
  const k = leinwand.getContext('2d')
  if (!k) throw new Error('Kein Zeichenkontext.')

  const kartenfarbe = dunkel ? '#12161c' : '#ffffff'
  const textfarbe = dunkel ? '#e8eef8' : '#111418'
  const leisefarbe = dunkel ? '#8fa3c0' : '#6b7278'
  const randfarbe = dunkel ? '#2b3b54' : '#dfe3e6'
  const linienfarbe = dunkel ? '#22304a' : '#eceff1'

  k.fillStyle = lueckenfarbe
  k.fillRect(0, 0, breite, hoehe)
  k.textBaseline = 'top'

  for (let i = 0; i < anzahl; i++) {
    const y = luecke + i * (kartenhoehe + luecke)
    k.fillStyle = kartenfarbe
    k.fillRect(0, y, breite, kartenhoehe)
    k.strokeStyle = randfarbe
    k.lineWidth = 1
    k.strokeRect(0.5, y + 0.5, breite - 1, kartenhoehe - 1)

    k.fillStyle = leisefarbe
    k.font = '13px Arial'
    k.fillText(`#39622861${i}`, 12, y + 10)
    k.fillText(`Sep 10, 10:4${i % 10} PM`, 92, y + 10)

    k.fillStyle = textfarbe
    k.font = 'bold 14px Arial'
    k.fillText('Deebo Samuel', 12, y + 38)

    k.fillStyle = leisefarbe
    k.font = '12px Arial'
    k.fillText('San Francisco 49ers @ Los Angeles Rams', 12, y + 58)

    k.fillStyle = textfarbe
    k.font = 'bold 12px Arial'
    k.fillText('WILL HAVE OVER 2.5 RECEPTIONS', 12, y + 78)
    k.fillText('FINAL PLAYER SCORE: 4', 12, y + 96)

    if (innenlinie) {
      k.strokeStyle = linienfarbe
      k.beginPath()
      k.moveTo(0, y + 118.5)
      k.lineTo(breite, y + 118.5)
      k.stroke()
    }

    k.fillStyle = leisefarbe
    k.font = '13px Arial'
    k.fillText('Odds:  -157', 12, y + 128)
    k.fillText('Stake: $ 181', 320, y + 128)
    k.fillText('Returns: $ 296.84', 560, y + 128)
  }

  return leinwand
}

/**
 * Baut ein ganzes Browserfenster mit Adresszeile, Menueleiste, Seiteninhalt
 * und dem Fenster mit der Wettuebersicht in der Mitte.
 *
 * @returns {HTMLCanvasElement}
 */
export function baueVollbild() {
  const B = 1280
  const H = 651
  const c = document.createElement('canvas')
  c.width = B
  c.height = H
  const k = c.getContext('2d')
  if (!k) throw new Error('Kein Zeichenkontext.')
  k.textBaseline = 'top'

  // Browserleiste mit Reitern und Adresszeile.
  k.fillStyle = '#dee1e6'
  k.fillRect(0, 0, B, 56)
  k.fillStyle = '#ffffff'
  k.fillRect(8, 4, 180, 26)
  k.fillStyle = '#3c4043'
  k.font = '12px Arial'
  k.fillText('P-417 Stefan_Otti_19_7', 22, 10)
  k.fillStyle = '#f1f3f4'
  k.fillRect(196, 4, 180, 26)
  k.fillText('Welcome to Sportsbook', 218, 10)
  k.fillStyle = '#ffffff'
  k.fillRect(90, 32, B - 180, 22)
  k.fillStyle = '#3c4043'
  k.fillText('417 | P-417 Stefan_Otti_19_7', 112, 36)
  k.fillText('betonline.ag/sportsbook/props', 262, 36)

  // Schwarzer Kopf mit Schriftzug und Kontostand.
  k.fillStyle = '#0a0a0a'
  k.fillRect(0, 56, B, 40)
  k.fillStyle = '#ffffff'
  k.font = 'bold 17px Arial'
  k.fillText('BET', 12, 66)
  k.fillStyle = '#e11b22'
  k.fillText('ONLINE', 46, 66)
  k.fillStyle = '#cccccc'
  k.font = '11px Arial'
  let nx = 380
  for (const n of ['SPORTS', 'LIVE BETTING', 'CASINO', 'LIVE CASINO', 'PROMOS', 'POKER', 'OTHER']) {
    k.fillText(n, nx, 71)
    nx += k.measureText(n).width + 22
  }
  k.fillStyle = '#ffffff'
  k.font = '12px Arial'
  k.fillText('$5,600.66', 1090, 70)
  k.fillStyle = '#e11b22'
  k.fillRect(1196, 62, 72, 26)
  k.fillStyle = '#ffffff'
  k.font = 'bold 11px Arial'
  k.fillText('DEPOSIT', 1208, 70)

  // Menueleiste links. Sie ist der Grund, warum ein Vollbild ohne Rahmen nicht geht.
  k.fillStyle = '#1a1a1a'
  k.fillRect(0, 96, 150, H - 96)
  k.fillStyle = '#e11b22'
  k.fillRect(0, 168, 150, 22)
  k.font = '10px Arial'
  const menue = [
    'HIDE MENU', 'HOME', 'LIVE BETTING', 'RACEBOOK', 'PROP SHOP', 'PROPS BUILDER',
    'ODDS BOOSTERS', 'SAME GAME PARLAYS', 'MEGA PARLAYS', 'Top Leagues', 'NCAA Football',
    'NFL Football', 'MLB Baseball', 'MMA Noche UFC', 'La Liga', 'Football', 'Baseball',
    'Basketball', 'Tennis', 'Golf',
  ]
  menue.forEach((m, i) => {
    k.fillStyle = '#dddddd'
    k.fillText(m, 10, 104 + i * 25)
  })

  // Seiteninhalt dahinter.
  k.fillStyle = '#f2f2f2'
  k.fillRect(150, 96, B - 150, H - 96)
  k.fillStyle = '#555555'
  k.font = 'bold 11px Arial'
  k.fillText('PROPS BUILDER', 168, 108)
  k.font = '10px Arial'
  const links = [
    'Over/Under (Passing Yards)', 'Over/Under (Pass Completions)', 'Over/Under (Pass TDs)',
    'Over/Under (Pass Attempts)', 'Over/Under (Rushing Yards)', 'Over/Under (Carries)',
    'Over/Under (Receiving Yards)', 'Over/Under (Receptions)', 'Over/Under (Pass Interceptions)',
    'Over/Under (Sacks)',
  ]
  links.forEach((t, i) => {
    k.fillStyle = '#333333'
    k.fillText(t, 168, 272 + i * 28)
  })
  for (let i = 0; i < 6; i++) {
    k.fillStyle = '#ffffff'
    k.fillRect(985, 264 + i * 28, 285, 22)
    k.fillStyle = '#666666'
    k.fillText('Handicap', 995, 268 + i * 28)
  }

  // Das Fenster mit der Wettuebersicht.
  const MX = 468
  const MY = 100
  const MB = 512
  const MH = 468
  k.fillStyle = '#ffffff'
  k.fillRect(MX, MY, MB, MH)
  k.fillStyle = '#e11b22'
  k.fillRect(MX, MY, MB, 28)
  k.fillStyle = '#ffffff'
  k.font = 'bold 13px Arial'
  k.fillText('My Bets', MX + 10, MY + 6)
  k.fillText('x', MX + MB - 20, MY + 6)
  k.fillStyle = '#f5f5f5'
  k.fillRect(MX, MY + 28, MB / 2, 26)
  k.fillStyle = '#666666'
  k.font = '11px Arial'
  k.fillText('Open Bets', MX + 82, MY + 34)
  k.fillStyle = '#e11b22'
  k.fillRect(MX + MB / 2, MY + 28, MB / 2, 26)
  k.fillStyle = '#ffffff'
  k.fillText('Past Bets', MX + MB / 2 + 88, MY + 34)

  const karten = [
    { nr: '396228612', zeit: 'Sep 10, 10:42 PM', einsatz: '181', ret: '296.84' },
    { nr: '396228581', zeit: 'Sep 10, 10:41 PM', einsatz: '300', ret: '492' },
    { nr: '396228545', zeit: 'Sep 10, 10:41 PM', einsatz: '300', ret: '492' },
  ]
  const KH = 106
  const LU = 8
  karten.forEach((kt, i) => {
    const y = MY + 62 + i * (KH + LU)
    k.fillStyle = '#ffffff'
    k.fillRect(MX + 4, y, MB - 24, KH)
    k.strokeStyle = '#e0e0e0'
    k.lineWidth = 1
    k.strokeRect(MX + 4.5, y + 0.5, MB - 25, KH - 1)
    k.fillStyle = '#777777'
    k.font = '10px Arial'
    k.fillText(`#${kt.nr}`, MX + 12, y + 6)
    k.fillText(kt.zeit, MX + 74, y + 6)
    k.fillStyle = '#b8ead4'
    k.fillRect(MX + MB - 74, y + 4, 38, 15)
    k.fillStyle = '#11603f'
    k.font = 'bold 9px Arial'
    k.fillText('won', MX + MB - 66, y + 7)
    k.fillStyle = '#111111'
    k.font = 'bold 11px Arial'
    k.fillText('Deebo Samuel', MX + 12, y + 24)
    k.fillStyle = '#777777'
    k.font = '9px Arial'
    k.fillText('San Francisco 49ers @ Los Angeles Rams', MX + 12, y + 40)
    k.fillStyle = '#111111'
    k.font = 'bold 9px Arial'
    k.fillText('WILL HAVE OVER 2.5 RECEPTIONS', MX + 12, y + 54)
    k.fillText('FINAL PLAYER SCORE: 4', MX + 12, y + 66)
    // Die innere Trennlinie ueber der Zeile mit Einsatz und Quote.
    k.strokeStyle = '#f0f0f0'
    k.beginPath()
    k.moveTo(MX + 4, y + 82.5)
    k.lineTo(MX + MB - 20, y + 82.5)
    k.stroke()
    k.fillStyle = '#777777'
    k.font = '10px Arial'
    k.fillText('Odds:  -157', MX + 12, y + 90)
    k.fillText(`Stake: $ ${kt.einsatz}`, MX + 220, y + 90)
    k.fillStyle = '#0f9d58'
    k.fillText(`Returns: $ ${kt.ret}`, MX + 370, y + 90)
  })

  // Die vierte Wette, die NICHT dazugehoert, angeschnitten am unteren Rand.
  const y4 = MY + 62 + 3 * (KH + LU)
  k.fillStyle = '#ffffff'
  k.fillRect(MX + 4, y4, MB - 24, MY + MH - y4 - 4)
  k.strokeStyle = '#e0e0e0'
  k.strokeRect(MX + 4.5, y4 + 0.5, MB - 25, MY + MH - y4 - 5)
  k.fillStyle = '#777777'
  k.font = '10px Arial'
  k.fillText('#381217420', MX + 12, y4 + 6)
  k.fillText('Feb 8, 11:37 PM', MX + 74, y4 + 6)
  k.fillStyle = '#111111'
  k.font = 'bold 9px Arial'
  k.fillText('LONGEST RUSH - KENNETH WALKER III - OVER 14.5 (SEA @ NE)', MX + 12, y4 + 24)
  k.fillStyle = '#777777'
  k.font = '10px Arial'
  k.fillText('Odds:  -121', MX + 12, y4 + 44)
  k.fillText('Stake: $ 2', MX + 220, y4 + 44)
  k.fillStyle = '#0f9d58'
  k.fillText('Returns: $ 3.66', MX + 370, y4 + 44)

  return c
}

/** Wo im Vollbild die Wettuebersicht steht. So wuerde der Nutzer den Rahmen ziehen. */
export const VOLLBILD_RAHMEN = { x: 468, y: 100, breite: 512, hoehe: 468 }
