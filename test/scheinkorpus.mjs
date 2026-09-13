/**
 * Korpus echter Scheinformate.
 *
 * Wozu: "es liest richtig" ist kein Zustand, sondern eine Zahl. Ohne eine
 * Sammlung mit bekannter Wahrheit laesst sich nicht sagen, ob eine Aenderung
 * das Lesen besser oder schlechter macht. Man merkt es erst, wenn ein Betrag
 * falsch ist, und dann ist es zu spaet.
 *
 * Jeder Fall ist so aufgebaut, wie die Texterkennung eine Karte ausgibt:
 * eine Zeile je Bildzeile, Feldname und Wert oft in derselben Zeile.
 *
 * Was hier absichtlich VARIIERT, weil genau daran Leseprogramme scheitern:
 *   Beschriftung        Stake, Risk, Wager, Einsatz, Mise
 *   Quotenformat        amerikanisch (-157), dezimal (1.64), Bruch (8/13)
 *   Trennzeichen        1,234.56 gegen 1.234,56
 *   Waehrungsstellung   $ 181 gegen 181 EUR gegen 181,00 Euro
 *   Bedeutung           Auszahlung (mit Einsatz) gegen Gewinn (ohne Einsatz)
 *   Zustand             offen, gewonnen, verloren, storniert, vorzeitig ausgezahlt
 *   Sonderformen        Gratiswette, mehrere Beine, sehr grosse Betraege
 *
 * Die Wahrheit steht in "erwartet". Nur Felder, die dort stehen, werden
 * geprueft. Was ein Buchmacher gar nicht anzeigt, wird auch nicht verlangt.
 */

/**
 * @typedef {object} Fall
 * @property {string} name
 * @property {string} buchmacher      Nur zur Einordnung, wird nicht geprueft.
 * @property {string[]} zeilen
 * @property {object} umgebung
 * @property {object} erwartet
 */

/** @type {Fall[]} */
export const KORPUS = [
  // -------------------------------------------------------------------------
  // Amerikanische Buchmacher, amerikanische Quoten
  // -------------------------------------------------------------------------
  {
    name: 'BetOnline, offene Einzelwette',
    buchmacher: 'BetOnline',
    zeilen: [
      '396228612    Sep 10, 10:45 PM',
      'Deebo Samuel',
      'San Francisco 49ers @ Los Angeles Rams',
      'WILL HAVE OVER 2.5 RECEPTIONS',
      'Odds: -157    Stake: $ 181    Returns: $ 296.84',
    ],
    umgebung: { gebiet: 'us', quotenformat: 'amerikanisch' },
    erwartet: {
      einsatz: 181,
      auszahlung: 296.84,
      quoteDezimal: 1.64,
      waehrung: 'USD',
      scheinNr: '396228612',
    },
  },
  {
    name: 'Bovada, Risk und Win getrennt',
    buchmacher: 'Bovada',
    zeilen: [
      'Straight Bet',
      'Kansas City Chiefs -3.5',
      'RISK $100.00        WIN $164.00',
      'Odds -157',
    ],
    umgebung: { gebiet: 'us', quotenformat: 'amerikanisch' },
    erwartet: {
      einsatz: 100,
      quoteDezimal: 1.64,
      waehrung: 'USD',
    },
  },
  {
    name: 'DraftKings, Wager und To Win und Total Payout',
    buchmacher: 'DraftKings',
    zeilen: [
      'PARLAY  +265',
      'Bet ID 8842019773',
      'WAGER          $50.00',
      'TO WIN         $132.50',
      'TOTAL PAYOUT   $182.50',
    ],
    umgebung: { gebiet: 'us', quotenformat: 'amerikanisch' },
    erwartet: {
      einsatz: 50,
      auszahlung: 182.5,
      quoteDezimal: 3.65,
      waehrung: 'USD',
      scheinNr: '8842019773',
    },
  },
  {
    name: 'FanDuel, nur Wager und To Win',
    buchmacher: 'FanDuel',
    zeilen: [
      'SAME GAME PARLAY',
      '3 Leg Parlay  +410',
      'Wager  $25.00',
      'To Win $102.50',
    ],
    umgebung: { gebiet: 'us', quotenformat: 'amerikanisch' },
    erwartet: {
      einsatz: 25,
      auszahlung: 127.5,
      quoteDezimal: 5.1,
      waehrung: 'USD',
    },
  },
  {
    name: 'Pinnacle, dezimale Quote trotz US-Buchmacher',
    buchmacher: 'Pinnacle',
    zeilen: [
      'Bet ID: 1029384756',
      'Soccer / UEFA Champions League',
      'Real Madrid vs Bayern Munich',
      'Risk    100.00 EUR',
      'Win      64.00 EUR',
      'Odds     1.640',
    ],
    umgebung: { gebiet: 'en', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 100,
      quoteDezimal: 1.64,
      waehrung: 'EUR',
      scheinNr: '1029384756',
    },
  },
  {
    name: 'BetMGM, Potential Payout',
    buchmacher: 'BetMGM',
    zeilen: [
      'Single Bet',
      'Lakers ML  -140',
      'Stake $20.00',
      'Potential Payout $34.29',
    ],
    umgebung: { gebiet: 'us', quotenformat: 'amerikanisch' },
    erwartet: {
      einsatz: 20,
      auszahlung: 34.29,
      quoteDezimal: 1.714,
      waehrung: 'USD',
    },
  },

  // -------------------------------------------------------------------------
  // Britische Buchmacher
  // -------------------------------------------------------------------------
  {
    name: 'bet365, Stake und To Return in Pfund',
    buchmacher: 'bet365',
    zeilen: [
      'Bet Ref: B1234567890',
      'Manchester City - Arsenal',
      'Full Time Result: Manchester City  1.64',
      'Stake      GBP 10.00',
      'To Return  GBP 16.40',
    ],
    umgebung: { gebiet: 'uk', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 10,
      auszahlung: 16.4,
      quoteDezimal: 1.64,
      waehrung: 'GBP',
    },
  },
  {
    name: 'William Hill, Est. Returns und Bruchquote',
    buchmacher: 'William Hill',
    zeilen: [
      'Receipt 55TY8812',
      'Liverpool to Win',
      'Odds 8/13',
      'Stake: GBP 5.00',
      'Est. Returns: GBP 8.08',
    ],
    umgebung: { gebiet: 'uk', quotenformat: 'bruch' },
    erwartet: {
      einsatz: 5,
      auszahlung: 8.08,
      waehrung: 'GBP',
    },
  },

  // -------------------------------------------------------------------------
  // Deutschsprachige Buchmacher, Komma als Dezimalzeichen
  // -------------------------------------------------------------------------
  {
    name: 'Tipico, Einsatz und moeglicher Gewinn',
    buchmacher: 'Tipico',
    zeilen: [
      'Wett-ID 4455667788',
      'Bayern Muenchen - Borussia Dortmund',
      'Endstand: Bayern Muenchen',
      'Einsatz 50,00 EUR    Quote 1,64    Moegl. Gewinn 82,00 EUR',
    ],
    umgebung: { gebiet: 'de', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 50,
      quoteDezimal: 1.64,
      waehrung: 'EUR',
      scheinNr: '4455667788',
    },
  },
  {
    name: 'bwin, Gesamtquote und moegliche Auszahlung',
    buchmacher: 'bwin',
    zeilen: [
      'Kombiwette (3)',
      'Gesamtquote: 2,50',
      'Gesamteinsatz: 100,00 EUR',
      'Moegliche Auszahlung: 250,00 EUR',
    ],
    umgebung: { gebiet: 'de', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 100,
      auszahlung: 250,
      quoteDezimal: 2.5,
      waehrung: 'EUR',
    },
  },
  {
    name: 'Interwetten, Tausenderpunkt und Dezimalkomma',
    buchmacher: 'Interwetten',
    zeilen: [
      'Schein-Nr. 99001122',
      'Kombi 5 Wetten',
      'Quote 12,50',
      'Einsatz 1.600,00 EUR',
      'Auszahlung 20.000,00 EUR',
    ],
    umgebung: { gebiet: 'de', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 1600,
      auszahlung: 20000,
      quoteDezimal: 12.5,
      waehrung: 'EUR',
      scheinNr: '99001122',
    },
  },
  {
    name: 'Admiral, Betrag ohne Waehrungszeichen',
    buchmacher: 'Admiral',
    zeilen: [
      'Tippschein 7712',
      'Einsatz 250,00',
      'Gesamtquote 3,20',
      'Auszahlung 800,00',
    ],
    umgebung: { gebiet: 'de', quotenformat: 'dezimal', waehrung: 'EUR' },
    erwartet: {
      einsatz: 250,
      auszahlung: 800,
      quoteDezimal: 3.2,
      waehrung: 'EUR',
    },
  },

  // -------------------------------------------------------------------------
  // Abgerechnete Scheine
  // -------------------------------------------------------------------------
  {
    name: 'Gewonnen, ausgezahlter Betrag',
    buchmacher: 'BetOnline',
    zeilen: [
      '396228613   WON',
      'Deebo Samuel Over 2.5 Receptions',
      'Odds: -157   Stake: $ 300   Returns: $ 492.00',
    ],
    umgebung: { gebiet: 'us', quotenformat: 'amerikanisch' },
    erwartet: {
      einsatz: 300,
      auszahlung: 492,
      quoteDezimal: 1.64,
      status: 'gewonnen',
      waehrung: 'USD',
    },
  },
  {
    name: 'Verloren',
    buchmacher: 'bet365',
    zeilen: [
      'Settled - Lost',
      'Arsenal to Win  2.10',
      'Stake GBP 20.00',
      'Returns GBP 0.00',
    ],
    umgebung: { gebiet: 'uk', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 20,
      status: 'verloren',
      waehrung: 'GBP',
    },
  },
  {
    name: 'Storniert',
    buchmacher: 'Tipico',
    zeilen: [
      'Wette storniert',
      'Einsatz 75,00 EUR',
      'Quote 1,90',
      'Auszahlung 75,00 EUR',
    ],
    umgebung: { gebiet: 'de', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 75,
      status: 'storniert',
      waehrung: 'EUR',
    },
  },
  {
    name: 'Vorzeitig ausgezahlt',
    buchmacher: 'bet365',
    zeilen: [
      'Cashed Out',
      'Stake GBP 50.00',
      'Cash Out Value GBP 61.25',
      'Odds 2.40',
    ],
    umgebung: { gebiet: 'uk', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 50,
      status: 'cashout',
      waehrung: 'GBP',
    },
  },

  // -------------------------------------------------------------------------
  // Sonderformen
  // -------------------------------------------------------------------------
  {
    name: 'Gratiswette, kein eigenes Geld im Risiko',
    buchmacher: 'DraftKings',
    zeilen: [
      'FREE BET',
      'Bet ID 7781002',
      'WAGER $25.00 (Free Bet)',
      'TO WIN $41.00',
    ],
    umgebung: { gebiet: 'us', quotenformat: 'amerikanisch' },
    erwartet: {
      einsatz: 25,
      gratiswette: true,
      waehrung: 'USD',
    },
  },
  {
    name: 'Mehrere Beine mit Einzelquoten',
    buchmacher: 'bwin',
    zeilen: [
      'Kombiwette',
      'Bayern Muenchen - Borussia Dortmund',
      'Sieg Bayern   1,55',
      'Real Madrid - FC Barcelona',
      'Ueber 2,5 Tore   1,80',
      'Liverpool - Arsenal',
      'Sieg Liverpool   2,00',
      'Gesamtquote 5,58',
      'Einsatz 200,00 EUR',
      'Auszahlung 1.116,00 EUR',
    ],
    umgebung: { gebiet: 'de', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 200,
      auszahlung: 1116,
      quoteDezimal: 5.58,
      waehrung: 'EUR',
    },
  },
  {
    name: 'Grosser Betrag im englischen Tausenderformat',
    buchmacher: 'Pinnacle',
    zeilen: [
      'Bet ID: 5566778899',
      'Risk   5,000.00 USD',
      'Win    3,200.00 USD',
      'Odds   1.640',
    ],
    umgebung: { gebiet: 'en', quotenformat: 'dezimal' },
    erwartet: {
      einsatz: 5000,
      quoteDezimal: 1.64,
      waehrung: 'USD',
    },
  },
]
