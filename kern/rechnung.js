// @ts-check
/**
 * Die Rechnung eines Riesenscheins.
 *
 * Alle Summen stehen hier. Sie werden immer neu berechnet und nie gespeichert,
 * damit gespeicherte und gerechnete Werte nicht auseinanderlaufen koennen.
 *
 * DIE WICHTIGSTE REGEL DIESER DATEI:
 *   Zuerst wird getrennt, dann gerechnet. Offene und entschiedene Scheine werden
 *   NIE in derselben Summe vermischt.
 *
 *   Das realisierte Ergebnis ist Rueckfluss minus Einsatz, und BEIDE Seiten duerfen
 *   nur aus entschiedenen Scheinen stammen. Wer den Rueckfluss der entschiedenen
 *   Scheine gegen den Einsatz ALLER Scheine rechnet, zieht den Einsatz der noch
 *   offenen Scheine als Verlust ab. Das Ergebnis sieht plausibel aus und ist falsch.
 *   Genau um diesen Betrag, naemlich um das offene Risiko, waere es zu niedrig.
 *
 * Zwei Sonderformen veraendern den Einsatz:
 *   Gratiswette: der Einsatz ist kein eigenes Geld, also null Aufwand und null Risiko.
 *   Each Way:    der angezeigte Einsatz wird doppelt abgebucht, also doppelter Aufwand.
 *
 * Reine Logik. Keine Anzeige.
 */

import { summe, zuCent, vonCent } from './geld.js'
import { effektiveQuote } from './quoten.js'
import { runde } from './zahlen.js'
import { istEntschieden, erwarteterRueckfluss } from './status.js'

/**
 * Der tatsaechliche Geldaufwand fuer einen Schein.
 *
 * Das ist NICHT einfach das Feld einsatz. Eine Gratiswette kostet nichts,
 * eine Each-Way-Wette kostet das Doppelte.
 *
 * @param {import('./typen.js').Schein} schein
 * @returns {number}
 */
export function barEinsatz(schein) {
  if (schein.gratiswette) return 0
  const einsatz = schein.einsatz.wert
  if (einsatz === null || !Number.isFinite(einsatz)) return 0
  return schein.eachWay ? einsatz * 2 : einsatz
}

/**
 * Der Nennwert einer Gratiswette. Er zaehlt nicht als Aufwand, ist aber eine Zahl,
 * die der Nutzer sehen will.
 *
 * @param {import('./typen.js').Schein} schein
 * @returns {number}
 */
export function gratisNennwert(schein) {
  if (!schein.gratiswette) return 0
  const einsatz = schein.einsatz.wert
  return einsatz === null || !Number.isFinite(einsatz) ? 0 : einsatz
}

/**
 * Was bei einem entschiedenen Schein tatsaechlich zurueckgeflossen ist,
 * einschliesslich des Einsatzes.
 *
 * Reihenfolge der Quellen:
 *   1. Ein von Hand eingetragener Betrag schlaegt alles.
 *   2. Ein aus dem Bild gelesener Rueckfluss.
 *   3. Die Rechnung aus Status, Einsatz und Quote.
 *
 * @param {import('./typen.js').Schein} schein
 * @returns {{wert: number|null, bekannt: boolean, grund: string}}
 */
export function realisierterRueckfluss(schein) {
  if (schein.ausgezahlt.quelle === 'hand' && schein.ausgezahlt.wert !== null) {
    return { wert: schein.ausgezahlt.wert, bekannt: true, grund: 'Von Hand eingetragen.' }
  }
  if (!istEntschieden(schein.status)) {
    return { wert: null, bekannt: false, grund: 'Noch nicht entschieden.' }
  }
  if (schein.ausgezahlt.wert !== null && Number.isFinite(schein.ausgezahlt.wert)) {
    return { wert: schein.ausgezahlt.wert, bekannt: true, grund: 'Aus dem Bild gelesen.' }
  }
  return erwarteterRueckfluss(
    schein.status,
    schein.einsatz.wert,
    schein.quoteDezimal.wert,
    !schein.gratiswette
  )
}

/**
 * Die moegliche Auszahlung eines noch offenen Scheins, einschliesslich Einsatz.
 *
 * @param {import('./typen.js').Schein} schein
 * @returns {{wert: number|null, bekannt: boolean}}
 */
export function offenePotenzialauszahlung(schein) {
  const einsatz = schein.einsatz.wert
  if (schein.auszahlung.wert !== null && Number.isFinite(schein.auszahlung.wert)) {
    const faktor = schein.eachWay ? 2 : 1
    return { wert: schein.auszahlung.wert * faktor, bekannt: true }
  }
  const quote = schein.quoteDezimal.wert
  if (einsatz !== null && quote !== null) {
    const grund = schein.gratiswette ? einsatz * (quote - 1) : einsatz * quote
    return { wert: schein.eachWay ? grund * 2 : grund, bekannt: true }
  }
  return { wert: null, bekannt: false }
}

/**
 * Berechnet alle Summen eines Riesenscheins.
 *
 * @param {import('./typen.js').Schein[]} scheine
 * @returns {import('./typen.js').Rechnung}
 */
export function rechne(scheine) {
  /** @type {import('./typen.js').Hinweis[]} */
  const hinweise = []

  const nichtAusgeschlossen = (scheine || []).filter((s) => !s.ausgeschlossen)

  // ---- Scheine, deren Zahlen nicht belastbar sind, kommen nicht in die Summe.
  //
  // Bis zum 15.09.2026 zaehlte jeder Schein mit, den der Mensch nicht
  // ausdruecklich ausgeschlossen hatte. Ein Hinweis der Schwere fehler aenderte
  // daran nichts. So ging eine verschmolzene Stake-Doppelspalte mit einem
  // Einsatz von fuenf Billiarden in den Gesamteinsatz ein, und an der Zahl
  // selbst war nichts zu sehen.
  //
  // Die Regel ist bewusst allgemein und keine Liste von Codes: WER einen Fehler
  // meldet, sagt damit, dass seine Zahlen nicht stimmen. Eine Liste wuerde bei
  // jedem neuen Fehlercode veralten, und dann waere die Luecke wieder da.
  //
  // Genau eine Ausnahme: einsatz_fehlt. Dafuer gibt es seit jeher die sanftere
  // Behandlung weiter unten (einsatz_fehlt_in_summe). Solche Scheine steuern
  // keinen Einsatz bei, bleiben aber Teil des Riesenscheins. Wuerden sie
  // aussortiert, aendert sich das Verhalten fuer jeden verlorenen
  // BetOnline-Schein ohne Returns-Spalte.
  //
  // Weggeworfen wird nichts: Anzahl und Kennungen stehen in mitFehler, und der
  // Hinweis darunter nennt sie (Projektregel 9).
  const istNichtRechenbar = (s) =>
    (s.hinweise || []).some((h) => h.schwere === 'fehler' && h.code !== 'einsatz_fehlt')

  const nichtRechenbare = nichtAusgeschlossen.filter(istNichtRechenbar)
  const gueltige = nichtAusgeschlossen.filter((s) => !istNichtRechenbar(s))

  const mitFehler = {
    anzahl: nichtRechenbare.length,
    scheinIds: nichtRechenbare.map((s) => s.id),
  }

  if (nichtRechenbare.length > 0) {
    const gruende = [
      ...new Set(
        nichtRechenbare.flatMap((s) =>
          (s.hinweise || [])
            .filter((h) => h.schwere === 'fehler' && h.code !== 'einsatz_fehlt')
            .map((h) => h.code)
        )
      ),
    ]
    hinweise.push({
      code: 'scheine_mit_fehler',
      schwere: 'fehler',
      text:
        `${nichtRechenbare.length} Schein(e) sind nicht in die Summe genommen worden, weil ihre ` +
        `Zahlen nicht belastbar sind (${gruende.join(', ')}). Sie stehen weiter in der Liste und ` +
        'koennen von Hand berichtigt werden.',
    })
  }

  // ---- Waehrung. Es wird niemals ueber Waehrungen hinweg summiert. ----
  const waehrungen = new Set(
    gueltige.map((s) => s.waehrung.wert ?? 'UNBEKANNT').filter((w) => w !== 'UNBEKANNT')
  )
  const waehrungGemischt = waehrungen.size > 1
  /** @type {import('./typen.js').Waehrung} */
  const waehrung = waehrungGemischt
    ? 'UNBEKANNT'
    : /** @type {import('./typen.js').Waehrung} */ ([...waehrungen][0] ?? 'UNBEKANNT')

  if (waehrungGemischt) {
    hinweise.push({
      code: 'waehrung_gemischt',
      schwere: 'fehler',
      feld: 'waehrung',
      text:
        `Dieser Riesenschein enthaelt ${waehrungen.size} verschiedene Waehrungen ` +
        `(${[...waehrungen].join(', ')}). Die Summen darunter sind deshalb nicht aussagekraeftig. ` +
        'Bitte die Scheine nach Waehrung trennen.',
    })
  }

  // ---- Scheine ohne Einsatz koennen nicht mitgerechnet werden. ----
  const ohneEinsatz = gueltige.filter((s) => s.einsatz.wert === null)
  if (ohneEinsatz.length > 0) {
    hinweise.push({
      code: 'einsatz_fehlt_in_summe',
      schwere: 'fehler',
      feld: 'einsatz',
      text:
        `${ohneEinsatz.length} Schein(e) haben keinen Einsatz und fehlen deshalb in allen Summen. ` +
        'Bitte den Einsatz von Hand nachtragen.',
    })
  }
  const mitEinsatz = gueltige.filter((s) => s.einsatz.wert !== null)

  // ---- Zuerst trennen. ----
  const offene = mitEinsatz.filter((s) => !istEntschieden(s.status))
  const entschiedene = mitEinsatz.filter((s) => istEntschieden(s.status))

  /** @type {import('./typen.js').Schein[]} */
  const entschiedenBekannt = []
  /** @type {import('./typen.js').Schein[]} */
  const entschiedenUnklar = []
  for (const schein of entschiedene) {
    const rueckfluss = realisierterRueckfluss(schein)
    if (rueckfluss.bekannt && rueckfluss.wert !== null) entschiedenBekannt.push(schein)
    else entschiedenUnklar.push(schein)
  }

  if (entschiedenUnklar.length > 0) {
    hinweise.push({
      code: 'realisiert_unklar',
      schwere: 'warnung',
      feld: 'ausgezahlt',
      text:
        `Bei ${entschiedenUnklar.length} entschiedenen Schein(en) ist der Rueckfluss nicht bekannt, ` +
        'meist wegen einer vorzeitigen Auszahlung. Diese Scheine sind aus dem Ergebnis ' +
        'herausgenommen, damit es nicht falsch wird. Bitte den ausgezahlten Betrag eintragen.',
    })
  }

  // ---- Dann rechnen. ----
  const einsatzGesamt = summe(mitEinsatz.map(barEinsatz))
  const einsatzOffen = summe(offene.map(barEinsatz))
  const einsatzEntschieden = summe(entschiedene.map(barEinsatz))
  const einsatzUnklar = summe(entschiedenUnklar.map(barEinsatz))
  const einsatzEntschiedenBekannt = summe(entschiedenBekannt.map(barEinsatz))
  const gratiswetteNennwert = summe(mitEinsatz.map(gratisNennwert))

  // Realisiert: beide Seiten NUR aus entschiedenen Scheinen mit bekanntem Rueckfluss.
  const auszahlungRealisiert = summe(
    entschiedenBekannt.map((s) => realisierterRueckfluss(s).wert)
  )
  const ergebnisRealisiert = vonCent(
    zuCent(auszahlungRealisiert) - zuCent(einsatzEntschiedenBekannt)
  )

  // Offen: was kaeme zurueck, wenn die offenen Scheine gewinnen.
  /** @type {number[]} */
  const offeneTeile = []
  let offeneOhneWert = 0
  for (const schein of offene) {
    const potenzial = offenePotenzialauszahlung(schein)
    if (potenzial.bekannt && potenzial.wert !== null) offeneTeile.push(potenzial.wert)
    else offeneOhneWert++
  }
  if (offeneOhneWert > 0) {
    hinweise.push({
      code: 'auszahlung_unbekannt',
      schwere: 'warnung',
      feld: 'auszahlung',
      text:
        `${offeneOhneWert} offene(r) Schein(e) haben weder Auszahlung noch Quote. ` +
        'Ihr Gewinnpotenzial fehlt deshalb in der Summe.',
    })
  }
  const offenePotenzialAuszahlung = summe(offeneTeile)
  const offenesPotenzial = vonCent(zuCent(offenePotenzialAuszahlung) - zuCent(einsatzOffen))

  // Die drei Endzahlen.
  const imRisiko = einsatzOffen
  const bestenfalls = vonCent(zuCent(ergebnisRealisiert) + zuCent(offenesPotenzial))
  const schlimmstenfalls = vonCent(zuCent(ergebnisRealisiert) - zuCent(imRisiko))

  const auszahlungMoeglich = vonCent(
    zuCent(auszahlungRealisiert) + zuCent(offenePotenzialAuszahlung)
  )
  const gewinnMoeglich = vonCent(
    zuCent(auszahlungMoeglich) - zuCent(einsatzEntschiedenBekannt) - zuCent(einsatzOffen)
  )

  // ---- Quoten. Jede mit klar benannter Grundgesamtheit. ----
  const alleQuotenPosten = mitEinsatz
    .filter((s) => s.quoteDezimal.wert !== null && barEinsatz(s) > 0)
    .map((s) => ({ einsatz: barEinsatz(s), quote: s.quoteDezimal.wert ?? 0 }))
  const quoteEffektiv = effektiveQuote(alleQuotenPosten)

  const offeneQuotenPosten = offene
    .filter((s) => s.quoteDezimal.wert !== null && barEinsatz(s) > 0)
    .map((s) => ({ einsatz: barEinsatz(s), quote: s.quoteDezimal.wert ?? 0 }))
  const quoteOffen = effektiveQuote(offeneQuotenPosten)

  const gewinnschwelle = quoteOffen !== null && quoteOffen > 0 ? 1 / quoteOffen : null

  /*
    GEWONNEN UND VERLOREN IN EINER POSITION IST EIN WIDERSPRUCH.

    Ein Riesenschein ist DIESELBE Wette bei vielen Buchmachern. Dieselbe Wette
    geht ueberall gleich aus. Steht in einer Position ein gewonnener neben
    einem verlorenen Schein, sind es zwei verschiedene Wetten, und dann sind
    alle Summen darunter sinnlos.

    GEFUNDEN AM 16.09.2026 an der Huelle, die am selben Tag gebaut wurde.
    oberflaeche/zustand.js stempelt bei offener Huelle jeden neu gelesenen
    Schein mit gruppeId. kern/gruppierung.js macht daraus eine HANDGRUPPE, und
    dort steht "if (gruppe.vonHand) continue": eine Handgruppe wird nie
    verglichen, nie aufgebrochen, nie befragt.

    Nachgemessen an den neun echten PS3838-Zeilen aus einem Foto:

      ohne Huelle   3 Gruppen    Gibbs +8.367,28 / Williams +857,14 / Mayfield -6.718,48
      mit Huelle    1 Gruppe     9 Scheine, 17.717,48 Einsatz, drei Linien,
                                 gewonnen UND verloren nebeneinander

    Das ist derselbe Fehler wie der teuerste Fund des Projekts, nur ueber
    17.717,48 statt ueber 9.000 Euro. test/echte_fotos.test.mjs verbietet ihn
    seit dem 14.09. ausdruecklich, aber nur fuer den automatischen Weg.

    AUFGEBROCHEN WIRD NICHTS. Wer die Scheine von Hand in eine Huelle gelegt
    hat, hat entschieden, und gegen diese Entscheidung zu gruppieren waere eine
    Automatik ohne Pruefstein in die Gegenrichtung (Projektregel 1). Gesagt
    werden muss es trotzdem, und zwar laut (Projektregel 9).

    NUR gewonnen gegen verloren, nicht jeder Unterschied: offen neben gewonnen
    ist der Normalfall an einem Spieltag, und eine Annullierung ist kein
    Verlust. Eine Warnung, die staendig kommt, wird nicht mehr gelesen.
  */
  {
    const gewonnene = gueltige.filter((s) => s.status === 'gewonnen' || s.status === 'halb_gewonnen')
    const verlorene = gueltige.filter((s) => s.status === 'verloren' || s.status === 'halb_verloren')

    if (gewonnene.length > 0 && verlorene.length > 0) {
      hinweise.push({
        code: 'gewonnen_und_verloren',
        schwere: 'warnung',
        feld: 'status',
        text:
          `In diesem Riesenschein stehen ${gewonnene.length} gewonnene und ` +
          `${verlorene.length} verlorene Schein(e) nebeneinander. Dieselbe Wette geht bei allen ` +
          'Buchmachern gleich aus, also sind das zwei verschiedene Wetten. Die Summen darunter ' +
          'sind dann nicht aussagekraeftig. Bitte nachsehen und die Scheine trennen. ' +
          'Das Programm aendert hier von sich aus nichts.',
      })
    }
  }

  /*
    DER ZWEITE PRUEFSTEIN: eine Quote, die aus der Reihe faellt.

    Karam am 16.09.2026: "da wird sehr viel gesetzt, taeglich wirklich ueber
    100. Und da muss einfach wirklich fehlerfrei immer die Quote erkannt
    werden. Die Quoten sind natuerlich auch immer aehnlich bei jedem
    Riesenschein."

    Der zweite Satz ist der wertvolle. Ein Riesenschein ist DIESELBE Wette bei
    vielen Buchmachern. Die Quoten unterscheiden sich, weil Buchmacher sich
    unterscheiden, aber sie liegen beieinander. Eine Quote von 184 zwischen
    sechzig Quoten um 1,9 herum ist kein Buchmacherunterschied, das ist ein
    verlesener Punkt.

    WARUM DAS EIN EIGENER PRUEFSTEIN IST, und nicht dasselbe wie der erste:
    Einsatz mal Quote gleich Auszahlung greift nur, wenn beide Betraege auf dem
    Schein stehen. Bei Karams Tabellenansichten steht oft keine Auszahlung da.
    Und der beste Fall fuer diesen hier ist der, den der erste NIE fangen kann:
    liegen Einsatz UND Auszahlung um denselben Faktor daneben (der Fall
    "1,000.00 wird als 1,000,00 gelesen", UEBERGABE.md), stimmt ihr Verhaeltnis
    weiter, und der erste Pruefstein schweigt. Die Nachbarn merken es trotzdem.

    ER BERICHTIGT NICHTS (Projektregel 1). Aus sechzig Quoten laesst sich nicht
    beweisen, wie die einundsechzigste lauten MUSS, nur dass sie nicht passt.
    Also wird gewarnt und der Mensch sieht nach.

    WARUM DER MEDIAN UND NICHT DER MITTELWERT: ein einziger Ausreisser von 184
    zieht einen Mittelwert ueber sechzig Werte um drei nach oben, und danach
    faellt er selbst nicht mehr auf, dafuer aber die gesunden Werte. Der Median
    laesst sich von einzelnen Ausreissern nicht bewegen.

    WARUM DIE GRENZE AM MEDIAN HAENGT UND NICHT FEST IST: bei Quoten um 1,9
    sind 35 Prozent Abstand viel, bei einer Aussenseiterquote von 12,0 waeren
    sie normal. Das Verhaeltnis ist das richtige Mass, nicht die Differenz.
    Die 1,5 ist bewusst weit gesetzt: sie soll verlesene Punkte und
    Zehnerfehler fangen, nicht Buchmacherunterschiede. Gemessen an hundert
    Scheinen zwischen 1,80 und 2,00 schlaegt sie nicht an.

    AB DREI QUOTEN: bei zweien gibt es keine Mitte, der eine Wert ist so gut
    wie der andere, und eine Warnung waere geraten.
  */
  if (alleQuotenPosten.length >= 3) {
    const sortiert = [...alleQuotenPosten].map((p) => p.quote).sort((a, b) => a - b)
    const mitte = sortiert.length % 2 === 1
      ? sortiert[(sortiert.length - 1) / 2]
      : ((sortiert[sortiert.length / 2 - 1] ?? 0) + (sortiert[sortiert.length / 2] ?? 0)) / 2

    if (mitte !== undefined && mitte > 0) {
      const GRENZE = 1.5
      const auffaellig = alleQuotenPosten.filter((p) => {
        const verhaeltnis = p.quote > mitte ? p.quote / mitte : mitte / p.quote
        return verhaeltnis > GRENZE
      })

      if (auffaellig.length > 0) {
        const genannt = auffaellig.slice(0, 5).map((p) => p.quote).join(', ')
        const rest = auffaellig.length > 5 ? ` und ${auffaellig.length - 5} weitere` : ''
        hinweise.push({
          code: 'quote_reisst_aus',
          schwere: 'warnung',
          feld: 'quoteDezimal',
          text:
            `${auffaellig.length} Quote(n) liegen weit neben den anderen: ${genannt}${rest}. ` +
            `Die mittlere Quote dieses Riesenscheins ist ${mitte}. Dieselbe Wette hat bei ` +
            'verschiedenen Buchmachern aehnliche Quoten, deshalb ist das meist ein verlesener ' +
            'Punkt oder eine Ziffer zu viel. Bitte nachsehen und von Hand berichtigen. ' +
            'Das Programm aendert hier von sich aus nichts.',
        })
      }
    }
  }

  if (alleQuotenPosten.length < mitEinsatz.filter((s) => barEinsatz(s) > 0).length) {
    const fehlend = mitEinsatz.filter((s) => barEinsatz(s) > 0).length - alleQuotenPosten.length
    hinweise.push({
      code: 'quote_fehlt_in_schnitt',
      schwere: 'warnung',
      feld: 'quoteDezimal',
      text: `${fehlend} Schein(e) haben keine Quote und fehlen in der effektiven Gesamtquote.`,
    })
  }

  // ---- Aufteilung nach Buchmacher und Konto. ----
  /** @type {Map<string, import('./typen.js').Schein[]>} */
  const nachBuchmacher = new Map()
  for (const schein of mitEinsatz) {
    const name = schein.buchmacher.wert ?? 'Unbekannt'
    const liste = nachBuchmacher.get(name) ?? []
    liste.push(schein)
    nachBuchmacher.set(name, liste)
  }

  /** @type {import('./typen.js').BuchmacherAnteil[]} */
  const proBuchmacher = [...nachBuchmacher.entries()]
    .map(([name, liste]) => {
      const einsatz = summe(liste.map(barEinsatz))
      const posten = liste
        .filter((s) => s.quoteDezimal.wert !== null && barEinsatz(s) > 0)
        .map((s) => ({ einsatz: barEinsatz(s), quote: s.quoteDezimal.wert ?? 0 }))
      const konten = [
        ...new Set(liste.map((s) => s.konto.wert).filter((k) => typeof k === 'string' && k !== '')),
      ].sort()
      return {
        buchmacher: name,
        anzahl: liste.length,
        einsatz,
        anteil: einsatzGesamt > 0 ? einsatz / einsatzGesamt : 0,
        auszahlungMoeglich: summe(
          liste.map((s) => {
            if (istEntschieden(s.status)) return realisierterRueckfluss(s).wert
            return offenePotenzialauszahlung(s).wert
          })
        ),
        quoteSchnitt: effektiveQuote(posten),
        konten: /** @type {string[]} */ (konten),
      }
    })
    .sort((a, b) => b.einsatz - a.einsatz)

  const alleKonten = [
    ...new Set(gueltige.map((s) => s.konto.wert).filter((k) => typeof k === 'string' && k !== '')),
  ].sort()

  // ---- Aufteilung nach Status. ----
  /** @type {Record<import('./typen.js').Status, number>} */
  const proStatus = {
    offen: 0,
    gewonnen: 0,
    verloren: 0,
    halb_gewonnen: 0,
    halb_verloren: 0,
    push: 0,
    storniert: 0,
    cashout: 0,
    unbekannt: 0,
  }
  for (const schein of gueltige) proStatus[schein.status] = (proStatus[schein.status] ?? 0) + 1

  // ---- Gegenproben auf dem zweiten Weg. ----
  // Laufen die beiden Wege auseinander, ist ein Fehler im Programm, kein Datenproblem.
  pruefe(
    hinweise,
    zuCent(einsatzOffen) + zuCent(einsatzEntschieden) === zuCent(einsatzGesamt),
    'einsatz_summe',
    `Einsatz offen ${einsatzOffen} plus entschieden ${einsatzEntschieden} ergibt nicht gesamt ${einsatzGesamt}.`
  )
  pruefe(
    hinweise,
    zuCent(einsatzEntschiedenBekannt) + zuCent(einsatzUnklar) === zuCent(einsatzEntschieden),
    'einsatz_entschieden_summe',
    'Die entschiedenen Einsaetze mit und ohne bekannten Rueckfluss ergeben nicht die Summe.'
  )
  pruefe(
    hinweise,
    Math.abs(zuCent(gewinnMoeglich) - zuCent(bestenfalls)) <= 1,
    'bestenfalls_summe',
    `Moeglicher Gewinn ${gewinnMoeglich} und bester Fall ${bestenfalls} muessen gleich sein.`
  )
  pruefe(
    hinweise,
    zuCent(schlimmstenfalls) <= zuCent(bestenfalls),
    'band_verdreht',
    'Der schlechteste Fall liegt ueber dem besten Fall.'
  )
  if (quoteOffen !== null && offeneQuotenPosten.length === offene.length && offene.length > 0) {
    pruefe(
      hinweise,
      Math.abs(zuCent(quoteOffen * einsatzOffen) - zuCent(offenePotenzialAuszahlung)) <= 2,
      'quote_offen_probe',
      'Offene Quote mal offener Einsatz ergibt nicht die offene Potenzialauszahlung.'
    )
  }

  return {
    anzahlScheine: gueltige.length,
    anzahlBuchmacher: nachBuchmacher.size,
    buchmacher: [...nachBuchmacher.keys()].sort(),
    anzahlKonten: alleKonten.length,
    konten: /** @type {string[]} */ (alleKonten),
    waehrung,
    waehrungGemischt,

    // Was wegen eines Fehlers nicht mitgerechnet wurde. Nie leer verschweigen:
    // die Anzeige zeigt die Zahl, damit niemand eine Summe fuer vollstaendig
    // haelt, die es nicht ist (Projektregel 9).
    mitFehler,

    einsatzGesamt: runde(einsatzGesamt, 2),
    einsatzOffen: runde(einsatzOffen, 2),
    einsatzEntschieden: runde(einsatzEntschieden, 2),
    gratiswetteNennwert: runde(gratiswetteNennwert, 2),

    auszahlungMoeglich: runde(auszahlungMoeglich, 2),
    gewinnMoeglich: runde(gewinnMoeglich, 2),

    auszahlungRealisiert: runde(auszahlungRealisiert, 2),
    ergebnisRealisiert: runde(ergebnisRealisiert, 2),
    imRisiko: runde(imRisiko, 2),
    offenesPotenzial: runde(offenesPotenzial, 2),
    bestenfalls: runde(bestenfalls, 2),
    schlimmstenfalls: runde(schlimmstenfalls, 2),

    quoteEffektiv,
    quoteOffen,
    gewinnschwelle,

    proBuchmacher,
    proStatus,
    hinweise,
  }
}

/**
 * Traegt einen Fehler ein, wenn eine Gegenprobe nicht aufgeht.
 *
 * @param {import('./typen.js').Hinweis[]} hinweise
 * @param {boolean} bedingung
 * @param {string} code
 * @param {string} text
 */
function pruefe(hinweise, bedingung, code, text) {
  if (bedingung) return
  hinweise.push({
    code: `probe_${code}`,
    schwere: 'fehler',
    text: `Gegenprobe fehlgeschlagen: ${text} Das ist ein Fehler im Programm, nicht in den Daten.`,
  })
}

/**
 * Summiert mehrere Riesenscheine zu einer Projektuebersicht.
 *
 * @param {import('./typen.js').Rechnung[]} rechnungen
 * @returns {{einsatzGesamt: number, auszahlungMoeglich: number, ergebnisRealisiert: number, imRisiko: number, bestenfalls: number, schlimmstenfalls: number, anzahlScheine: number, anzahlRiesenscheine: number, buchmacher: string[], konten: string[], waehrungGemischt: boolean, waehrung: import('./typen.js').Waehrung}}
 */
export function rechneProjekt(rechnungen) {
  const liste = rechnungen || []
  const waehrungen = new Set(liste.map((r) => r.waehrung).filter((w) => w !== 'UNBEKANNT'))
  const gemischt = waehrungen.size > 1 || liste.some((r) => r.waehrungGemischt)

  /** @type {Set<string>} */
  const buchmacher = new Set()
  /** @type {Set<string>} */
  const konten = new Set()
  for (const r of liste) {
    for (const b of r.buchmacher) buchmacher.add(b)
    for (const k of r.konten) konten.add(k)
  }

  return {
    einsatzGesamt: summe(liste.map((r) => r.einsatzGesamt)),
    auszahlungMoeglich: summe(liste.map((r) => r.auszahlungMoeglich)),
    ergebnisRealisiert: summe(liste.map((r) => r.ergebnisRealisiert)),
    imRisiko: summe(liste.map((r) => r.imRisiko)),
    bestenfalls: summe(liste.map((r) => r.bestenfalls)),
    schlimmstenfalls: summe(liste.map((r) => r.schlimmstenfalls)),
    anzahlScheine: liste.reduce((n, r) => n + r.anzahlScheine, 0),
    anzahlRiesenscheine: liste.length,
    buchmacher: [...buchmacher].sort(),
    konten: [...konten].sort(),
    waehrungGemischt: gemischt,
    waehrung: gemischt
      ? 'UNBEKANNT'
      : /** @type {import('./typen.js').Waehrung} */ ([...waehrungen][0] ?? 'UNBEKANNT'),
  }
}
