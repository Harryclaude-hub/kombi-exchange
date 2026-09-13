// @ts-check
/**
 * Scheine zu Riesenscheinen zusammenfuehren.
 *
 * Der Kern des Programms: dieselbe Wette wurde bei vielen Buchmachern gesetzt,
 * und alle diese Scheine gehoeren zu einer Position.
 *
 * Zwei Regeln aus Karams Fehlerliste stecken hier drin:
 *   - Nichts wird geloescht. Was nicht zugeordnet werden kann, landet sichtbar
 *     im Resttopf mit Begruendung.
 *   - Nie ueber den Namen allein verknuepfen. Es wird immer mit vollstaendiger
 *     Verkettung gearbeitet: ein Schein kommt nur in eine Gruppe, wenn er zu
 *     JEDEM Schein darin passt, nicht nur zum ersten.
 *
 * Reine Logik. Keine Anzeige.
 */

import { vergleicheScheine, bildeSignatur } from './kennung.js'
import { statusRang } from './status.js'

/** Ab hier wird ohne Rueckfrage zusammengefuehrt. */
export const SCHWELLE_SICHER = 0.8

/** Ab hier wird ein Vorschlag gemacht, den der Nutzer bestaetigen muss. */
export const SCHWELLE_VORSCHLAG = 0.6

/**
 * @typedef {object} Gruppe
 * @property {string} id
 * @property {string} signatur
 * @property {string[]} scheinIds
 * @property {number} punkteSchwaechste  Der schlechteste Vergleich innerhalb der Gruppe.
 * @property {boolean} vonHand           true, wenn der Nutzer die Gruppe festgelegt hat.
 */

/**
 * @typedef {object} Zuordnungsvorschlag
 * @property {string} scheinId
 * @property {string} gruppeId
 * @property {number} punkte
 * @property {string[]} gruende
 */

/**
 * @typedef {object} Gruppierungsergebnis
 * @property {Gruppe[]} gruppen
 * @property {import('./typen.js').Restposten[]} restposten
 * @property {Zuordnungsvorschlag[]} vorschlaege
 * @property {Doppelfund[]} doppelte
 */

/**
 * @typedef {object} Doppelfund
 * @property {string} scheinId
 * @property {string} gleichWieScheinId
 * @property {string} grund
 * @property {number} sicherheit
 * @property {boolean} sicher  true, wenn ohne Rueckfrage zusammengefuehrt werden darf.
 */

/**
 * Erzeugt den Schluessel, an dem sich derselbe physische Schein wiedererkennen laesst.
 *
 * Er unterscheidet sich bewusst vom Gruppenschluessel:
 *   Dieser hier beantwortet "ist das dieselbe Wette, die ich einmal abgegeben habe".
 *   Der Gruppenschluessel beantwortet "ist das derselbe Tipp".
 *
 * Die Scheinnummer allein reicht nicht. Sie ist nur beim selben Anbieter eindeutig,
 * und wer zwei Konten beim selben Anbieter hat, kann dieselbe Nummer zweimal sehen.
 * Deshalb gehoeren Anbieter, Konto und Waehrung mit hinein.
 *
 * @param {import('./typen.js').Schein} schein
 * @returns {string|null} null, wenn keine sichere Kennung moeglich ist.
 */
export function doppelSchluessel(schein) {
  const buchmacher = (schein.buchmacher.wert ?? '').toLowerCase().trim()
  const nummer = (schein.scheinNr.wert ?? '').replace(/[#\s]/g, '').toUpperCase()
  if (!buchmacher || !nummer) return null
  const konto = (schein.konto.wert ?? '').toLowerCase().trim()
  const waehrung = schein.waehrung.wert ?? 'UNBEKANNT'
  return [buchmacher, konto, waehrung, nummer].join('|')
}

/**
 * Sucht Scheine, die zweimal erfasst wurden.
 *
 * Zwei Stufen:
 *   sicher   Gleicher Anbieter, gleiches Konto, gleiche Waehrung, gleiche Scheinnummer.
 *            Das ist derselbe physische Schein und darf ohne Rueckfrage zusammengefuehrt werden.
 *            Genau dieser Fall entsteht, wenn derselbe Schein einmal offen und spaeter
 *            entschieden abfotografiert wurde.
 *   unsicher Ohne Scheinnummer: gleicher Anbieter, gleicher Einsatz, gleiche Quote,
 *            gleiche Minute und gleiche Wette. Das kann auch eine bewusste Aufstockung
 *            sein, also zwei echte Wetten. Deshalb NIE von allein zusammenfuehren.
 *
 * @param {import('./typen.js').Schein[]} scheine
 * @returns {Doppelfund[]}
 */
export function findeDoppelte(scheine) {
  /** @type {Doppelfund[]} */
  const funde = []
  /** @type {Map<string, string>} */
  const nachNummer = new Map()
  /** @type {Map<string, string>} */
  const nachMerkmalen = new Map()

  for (const schein of scheine) {
    const schluessel = doppelSchluessel(schein)

    if (schluessel) {
      const vorher = nachNummer.get(schluessel)
      if (vorher) {
        funde.push({
          scheinId: schein.id,
          gleichWieScheinId: vorher,
          grund: `Gleicher Anbieter, gleiches Konto und gleiche Scheinnummer ${schein.scheinNr.wert}.`,
          sicherheit: 0.98,
          sicher: true,
        })
        continue
      }
      nachNummer.set(schluessel, schein.id)
      continue
    }

    // Ohne Nummer: mehrere Merkmale zusammen, aber nur als Verdacht.
    const buchmacher = (schein.buchmacher.wert ?? '').toLowerCase().trim()
    const einsatz = schein.einsatz.wert
    const quote = schein.quoteDezimal.wert
    const zeit = schein.gesetztAm.wert
    if (buchmacher && einsatz !== null && quote !== null && zeit) {
      const merkmal = [
        buchmacher,
        (schein.konto.wert ?? '').toLowerCase().trim(),
        einsatz.toFixed(2),
        quote.toFixed(4),
        zeit.slice(0, 16),
        bildeSignatur(schein),
      ].join('|')
      const vorher = nachMerkmalen.get(merkmal)
      if (vorher) {
        funde.push({
          scheinId: schein.id,
          gleichWieScheinId: vorher,
          grund:
            'Gleicher Anbieter, gleicher Einsatz, gleiche Quote, gleiche Minute und gleiche Wette. ' +
            'Das kann auch eine bewusste zweite Wette sein, deshalb bitte selbst entscheiden.',
          sicherheit: 0.7,
          sicher: false,
        })
        continue
      }
      nachMerkmalen.set(merkmal, schein.id)
    }
  }

  return funde
}

/**
 * Fuehrt zwei Aufnahmen desselben Scheins zu einer zusammen.
 *
 * Regeln:
 *   Status:  der weiter fortgeschrittene gewinnt. Entschieden schlaegt offen.
 *            Bei gleichem Rang gewinnt die spaetere Aufnahme.
 *   Felder:  je Feld gewinnt die hoehere Sicherheit. Ein von Hand gesetzter Wert
 *            gewinnt immer, egal wie sicher die Texterkennung war.
 *   Hinweise: werden zusammengelegt, nichts faellt weg.
 *
 * Es wird NIE addiert. Zwei Aufnahmen desselben Scheins sind ein Schein, nicht zwei.
 *
 * @param {import('./typen.js').Schein} alt
 * @param {import('./typen.js').Schein} neu
 * @returns {import('./typen.js').Schein}
 */
export function verschmelze(alt, neu) {
  const neuerIstJuenger = (neu.angelegtAm ?? '') >= (alt.angelegtAm ?? '')
  const rangAlt = statusRang(alt.status)
  const rangNeu = statusRang(neu.status)

  let status = alt.status
  if (rangNeu > rangAlt) status = neu.status
  else if (rangNeu === rangAlt && neuerIstJuenger) status = neu.status

  /**
   * @template T
   * @param {import('./typen.js').Feld<T>} a
   * @param {import('./typen.js').Feld<T>} b
   * @returns {import('./typen.js').Feld<T>}
   */
  const besseres = (a, b) => {
    if (a.quelle === 'hand' && b.quelle !== 'hand') return a
    if (b.quelle === 'hand' && a.quelle !== 'hand') return b
    if (a.wert === null) return b
    if (b.wert === null) return a
    return b.sicherheit > a.sicherheit ? b : a
  }

  const fuehrend = neuerIstJuenger ? neu : alt

  /** @type {import('./typen.js').Hinweis[]} */
  const hinweise = []
  const gesehen = new Set()
  for (const hinweis of [...alt.hinweise, ...neu.hinweise]) {
    const schluessel = `${hinweis.code}|${hinweis.feld ?? ''}`
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    hinweise.push(hinweis)
  }
  hinweise.push({
    code: 'zusammengefuehrt',
    schwere: 'info',
    text:
      `Dieser Schein wurde aus zwei Aufnahmen zusammengefuehrt (${alt.id} und ${neu.id}). ` +
      'Er zaehlt nur einmal.',
  })

  return {
    ...fuehrend,
    id: alt.id,
    projektId: alt.projektId,
    gruppeId: alt.gruppeId ?? neu.gruppeId,

    buchmacher: besseres(alt.buchmacher, neu.buchmacher),
    konto: besseres(alt.konto, neu.konto),
    scheinNr: besseres(alt.scheinNr, neu.scheinNr),
    gesetztAm: besseres(alt.gesetztAm, neu.gesetztAm),
    einsatz: besseres(alt.einsatz, neu.einsatz),
    waehrung: besseres(alt.waehrung, neu.waehrung),
    quoteDezimal: besseres(alt.quoteDezimal, neu.quoteDezimal),
    quoteAmerikanisch: besseres(alt.quoteAmerikanisch, neu.quoteAmerikanisch),
    auszahlung: besseres(alt.auszahlung, neu.auszahlung),
    ausgezahlt: besseres(alt.ausgezahlt, neu.ausgezahlt),

    status,
    auswahlen: alt.auswahlen.length >= neu.auswahlen.length ? alt.auswahlen : neu.auswahlen,
    gratiswette: alt.gratiswette || neu.gratiswette,
    eachWay: alt.eachWay || neu.eachWay,

    ocrSicherheit: Math.max(alt.ocrSicherheit, neu.ocrSicherheit),
    hinweise,
    vonHand: alt.vonHand || neu.vonHand,
    ausgeschlossen: alt.ausgeschlossen && neu.ausgeschlossen,
    angelegtAm: alt.angelegtAm,
    geaendertAm: fuehrend.geaendertAm,
  }
}

/**
 * Fuehrt alle sicheren Doppelfunde zusammen.
 *
 * @param {import('./typen.js').Schein[]} scheine
 * @returns {{scheine: import('./typen.js').Schein[], verschmolzen: Doppelfund[], verdacht: Doppelfund[]}}
 */
export function verschmelzeDoppelte(scheine) {
  const funde = findeDoppelte(scheine)
  const sichere = funde.filter((f) => f.sicher)
  const verdacht = funde.filter((f) => !f.sicher)

  if (sichere.length === 0) {
    return { scheine: [...scheine], verschmolzen: [], verdacht }
  }

  /** @type {Map<string, import('./typen.js').Schein>} */
  const nachId = new Map(scheine.map((s) => [s.id, s]))
  const entfernt = new Set()

  for (const fund of sichere) {
    const alt = nachId.get(fund.gleichWieScheinId)
    const neu = nachId.get(fund.scheinId)
    if (!alt || !neu) continue
    nachId.set(fund.gleichWieScheinId, verschmelze(alt, neu))
    entfernt.add(fund.scheinId)
  }

  const heraus = scheine
    .filter((s) => !entfernt.has(s.id))
    .map((s) => nachId.get(s.id) ?? s)

  return { scheine: heraus, verschmolzen: sichere, verdacht }
}

/**
 * Fuehrt Scheine zu Gruppen zusammen.
 *
 * @param {import('./typen.js').Schein[]} scheine
 * @param {object} [einstellungen]
 * @param {number} [einstellungen.schwelleSicher]
 * @param {number} [einstellungen.schwelleVorschlag]
 * @param {(n: number) => string} [einstellungen.gruppenId]  Erzeugt die Kennung einer neuen Gruppe.
 * @returns {Gruppierungsergebnis}
 */
export function gruppiere(scheine, einstellungen = {}) {
  const schwelleSicher = einstellungen.schwelleSicher ?? SCHWELLE_SICHER
  const schwelleVorschlag = einstellungen.schwelleVorschlag ?? SCHWELLE_VORSCHLAG
  const gruppenId = einstellungen.gruppenId ?? ((n) => `G${n}`)

  /** @type {Gruppe[]} */
  const gruppen = []
  /** @type {import('./typen.js').Restposten[]} */
  const restposten = []
  /** @type {Zuordnungsvorschlag[]} */
  const vorschlaege = []

  const doppelte = findeDoppelte(scheine)
  // Nur die SICHEREN Doppelfunde werden aus den Summen herausgenommen, denn sie wuerden
  // denselben Einsatz zweimal zaehlen. Ein blosser Verdacht bleibt drin und wird nur
  // gemeldet, sonst wuerde eine echte zweite Wette stillschweigend verschwinden.
  const doppelteIds = new Set(doppelte.filter((d) => d.sicher).map((d) => d.scheinId))

  /** @type {Map<string, import('./typen.js').Schein>} */
  const nachId = new Map(scheine.map((s) => [s.id, s]))

  // 1. Von Hand festgelegte Gruppen zuerst. Sie werden nie aufgebrochen.
  /** @type {Map<string, Gruppe>} */
  const handgruppen = new Map()
  for (const schein of scheine) {
    if (!schein.gruppeId) continue
    let gruppe = handgruppen.get(schein.gruppeId)
    if (!gruppe) {
      gruppe = {
        id: schein.gruppeId,
        signatur: bildeSignatur(schein),
        scheinIds: [],
        punkteSchwaechste: 1,
        vonHand: true,
      }
      handgruppen.set(schein.gruppeId, gruppe)
      gruppen.push(gruppe)
    }
    gruppe.scheinIds.push(schein.id)
  }

  // 2. Der Rest wird verglichen.
  const offen = scheine.filter((s) => !s.gruppeId)

  for (const schein of offen) {
    if (schein.ausgeschlossen) {
      restposten.push({ scheinId: schein.id, grund: 'Vom Nutzer ausgeschlossen.' })
      continue
    }
    if (schein.auswahlen.length === 0) {
      restposten.push({
        scheinId: schein.id,
        grund: 'Keine Auswahl erkannt. Ohne Auswahl laesst sich nicht sagen, zu welcher Wette der Schein gehoert.',
      })
      continue
    }
    if (doppelteIds.has(schein.id)) {
      const fund = doppelte.find((d) => d.scheinId === schein.id)
      restposten.push({
        scheinId: schein.id,
        grund:
          `Derselbe Schein wurde schon einmal erfasst. ${fund ? fund.grund : ''} ` +
          'Er ist aus den Summen herausgenommen, damit der Einsatz nicht doppelt zaehlt.',
      })
      continue
    }

    /** @type {{gruppe: Gruppe, punkte: number, gruende: string[]}|null} */
    let bestePassung = null

    for (const gruppe of gruppen) {
      if (gruppe.vonHand) continue

      // Vollstaendige Verkettung: der schlechteste Vergleich in der Gruppe zaehlt.
      let schlechteste = 1
      /** @type {string[]} */
      let gruende = []
      let vergleichbar = true

      for (const mitgliedId of gruppe.scheinIds) {
        const mitglied = nachId.get(mitgliedId)
        if (!mitglied) continue
        const vergleich = vergleicheScheine(schein, mitglied)
        if (!vergleich.gleicheAnzahl) {
          vergleichbar = false
          break
        }
        if (vergleich.punkte < schlechteste) {
          schlechteste = vergleich.punkte
          gruende = vergleich.gruende
        }
      }

      if (!vergleichbar) continue
      if (bestePassung === null || schlechteste > bestePassung.punkte) {
        bestePassung = { gruppe, punkte: schlechteste, gruende }
      }
    }

    if (bestePassung && bestePassung.punkte >= schwelleSicher) {
      bestePassung.gruppe.scheinIds.push(schein.id)
      bestePassung.gruppe.punkteSchwaechste = Math.min(
        bestePassung.gruppe.punkteSchwaechste,
        bestePassung.punkte
      )
      continue
    }

    if (bestePassung && bestePassung.punkte >= schwelleVorschlag) {
      vorschlaege.push({
        scheinId: schein.id,
        gruppeId: bestePassung.gruppe.id,
        punkte: bestePassung.punkte,
        gruende: bestePassung.gruende,
      })
    }

    // Eigene Gruppe aufmachen.
    gruppen.push({
      id: gruppenId(gruppen.length + 1),
      signatur: bildeSignatur(schein),
      scheinIds: [schein.id],
      punkteSchwaechste: 1,
      vonHand: false,
    })
  }

  return { gruppen, restposten, vorschlaege, doppelte }
}

/**
 * Schlaegt einen Namen fuer einen Riesenschein vor.
 *
 * @param {import('./typen.js').Schein[]} scheine  Die Scheine der Gruppe.
 * @returns {string}
 */
export function schlageNamenVor(scheine) {
  const erster = scheine.find((s) => s.auswahlen.length > 0)
  if (!erster) return 'Ohne Auswahl'

  const teile = erster.auswahlen.map((a) => {
    const tipp = a.tipp.wert ?? ''
    const markt = a.markt.wert ?? ''
    const kurz = markt.length > 42 ? `${markt.slice(0, 42)}...` : markt
    return [tipp, kurz].filter((t) => t !== '').join(' ')
  })

  if (teile.length === 1) return teile[0] || 'Ohne Namen'
  return `${teile.length}er Kombi: ${teile.join(' + ')}`
}
