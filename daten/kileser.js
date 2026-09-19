// @ts-check
/**
 * Ein Wettschein von einer KI lesen lassen.
 *
 * Karam am 17.09.2026: "Waere das moeglich, dass ich einen Anthropic API-Key
 * besorge, das in das Programm reintue, und dass es dann einfach die Fotos
 * liest und die Daten fuer mich rausliest?"
 *
 * JA, UND ZWAR OHNE SERVER. Das ist der ganze Grund, warum diese Datei so kurz
 * sein kann.
 *
 * DER SCHLUESSEL STEHT NIRGENDS IM QUELLTEXT
 *
 * Er wird von Karam eingegeben und liegt nur in seinem Browser. Dieses
 * Programm ist eine statische Seite auf GitHub Pages, das Repository ist
 * OEFFENTLICH. Ein Schluessel im Quelltext waere fuer jeden lesbar, der die
 * Seite aufruft, und jeder koennte auf Karams Rechnung Anfragen stellen.
 *
 * Der Unterschied zwischen "im Quelltext" und "vom Nutzer eingegeben" ist der
 * ganze Unterschied. Anthropic erlaubt den zweiten Fall ausdruecklich, und
 * dafuer gibt es einen eigenen Kopf: `anthropic-dangerous-direct-browser-
 * access`. Ohne ihn weist die API eine Anfrage aus einem Browser ab.
 *
 * WAS HIER NICHT PASSIERT
 *
 * Diese Datei ENTSCHEIDET NICHTS. Sie fragt, bekommt Zahlen zurueck und gibt
 * sie weiter. Ob die Zahlen stimmen, entscheidet der Pruefstein in
 * kern/quoten.js, versoehne(): Einsatz mal Quote gleich Auszahlung, und diese
 * Rechnung steht auf dem Schein SELBST.
 *
 * Das ist der Kern von Karams Regel, auf die KI angewandt: wo es einen
 * Pruefstein gibt, darf die Automatik entscheiden, wo keiner ist, entscheidet
 * der Mensch. Eine KI, deren Antwort die Rechnung besteht, hat nicht geraten,
 * sondern abgelesen. Eine, deren Antwort sie nicht besteht, hat sich verraten.
 * MAN MUSS IHR NIE GLAUBEN.
 *
 * Deshalb kommt jeder Wert hier mit Quelle 'ocr' und einer Sicherheit zurueck,
 * genau wie ein Wert aus der oertlichen Texterkennung. Fuer alles Weitere im
 * Programm ist die KI nur ein zweiter Leser, kein Orakel.
 */

/** Wo der Schluessel liegt. NUR hier, nur in diesem Browser. */
const SCHLUESSELFACH = 'kombi.apischluessel'

/** Welches Modell gefragt wird. */
const MODELLFACH = 'kombi.apimodell'

/**
 * Die Modelle, die dafuer taugen, mit dem Preis je Million Zeichen.
 *
 * Am 17.09.2026 auf claude.com/pricing nachgesehen.
 *
 * SONNET IST DIE VORGABE, nicht Haiku, obwohl Haiku billiger ist: Haiku
 * verkleinert ein Telefonfoto auf 724 Bildpunkte Breite, und genau die
 * achtstelligen Stake-Betraege und der einzelne Formatbuchstabe bei PS3838
 * sind das, was dabei verschwindet.
 */
export const MODELLE = [
  { wert: 'claude-sonnet-5', name: 'Sonnet 5', hinweis: 'Empfohlen. 2 USD je Million gelesen, 10 je Million geschrieben.' },
  { wert: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', hinweis: 'Billiger, verkleinert das Bild aber. Kleine Zahlen gehen verloren.' },
  { wert: 'claude-opus-5', name: 'Opus 5', hinweis: 'Teuerster, nur für das, was Sonnet nicht löst.' },
]

/** Was gilt, wenn nichts gewaehlt wurde. */
export const MODELL_VORGABE = 'claude-sonnet-5'

/**
 * Liest den Schluessel aus dem Browser.
 *
 * @returns {string}
 */
export function schluessel() {
  try {
    return localStorage.getItem(SCHLUESSELFACH) ?? ''
  } catch {
    return ''
  }
}

/**
 * Legt den Schluessel ab oder nimmt ihn heraus.
 *
 * @param {string} wert  Leer heisst: vergessen.
 */
export function setzeSchluessel(wert) {
  try {
    const sauber = String(wert ?? '').trim()
    if (sauber === '') localStorage.removeItem(SCHLUESSELFACH)
    else localStorage.setItem(SCHLUESSELFACH, sauber)
  } catch {
    // Ein Browser ohne Speicher kann den Schluessel nicht behalten. Dann
    // fragt er eben bei jedem Start neu; das ist unbequem, aber nicht falsch.
  }
}

/** @returns {string} */
export function modell() {
  try {
    return localStorage.getItem(MODELLFACH) || MODELL_VORGABE
  } catch {
    return MODELL_VORGABE
  }
}

/** @param {string} wert */
export function setzeModell(wert) {
  try {
    if (MODELLE.some((m) => m.wert === wert)) localStorage.setItem(MODELLFACH, wert)
  } catch {
    // siehe oben
  }
}

/**
 * Steht ein Schluessel bereit?
 *
 * @returns {boolean}
 */
export function bereit() {
  return schluessel().length > 0
}

/**
 * Zeigt den Schluessel so, dass man ihn wiedererkennt, ohne ihn zu verraten.
 *
 * Nie den ganzen Wert anzeigen: wer neben Karam steht oder ihm beim Teilen
 * des Bildschirms zusieht, haette ihn sonst.
 *
 * @returns {string}
 */
export function schluesselkurz() {
  const s = schluessel()
  if (s.length === 0) return ''
  if (s.length <= 12) return '...'
  return `${s.slice(0, 7)}...${s.slice(-4)}`
}

/**
 * Was die KI zurueckgeben MUSS. Nichts anderes wird angenommen.
 *
 * Die Beschreibungen sind Teil der Anweisung: sie stehen in der Anfrage und
 * sagen der KI, was gemeint ist. Deshalb sind sie deutsch und ausfuehrlich.
 */
const BAUPLAN = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scheine: {
      type: 'array',
      description: 'Jeder Wettschein auf dem Bild, einer je Eintrag. Auch wenn mehrere nebeneinander stehen.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          scheinNr: { type: ['string', 'null'], description: 'Die Wett- oder Schein-Nummer, wie sie dasteht.' },
          gesetztAm: { type: ['string', 'null'], description: 'Wann der Schein gesetzt wurde, als Text genau wie im Bild, zum Beispiel "Sep 13, 6:39 PM" oder "14.09.26 15:30".' },
          konto: { type: ['string', 'null'], description: 'Der Kontoname, falls sichtbar, zum Beispiel "Auer" oder "Frohnwieser". Viele Konten beim selben Anbieter sind normal.' },
          buchmacher: { type: ['string', 'null'], description: 'Der Anbieter, wie er im Bild genannt ist.' },
          einsatz: { type: ['number', 'null'], description: 'Der Einsatz als Zahl, ohne Währungszeichen.' },
          quoteDezimal: { type: ['number', 'null'], description: 'Die Gesamtquote als Dezimalzahl. Amerikanische Quoten (-157, +140) hier umrechnen.' },
          auszahlung: { type: ['number', 'null'], description: 'Die mögliche Auszahlung EINSCHLIESSLICH Einsatz.' },
          ausgezahlt: { type: ['number', 'null'], description: 'Was wirklich zurückkam, falls der Schein entschieden ist.' },
          waehrung: { type: ['string', 'null'], description: 'EUR, USD, GBP, CHF oder das Kürzel der Kryptowährung.' },
          status: { type: ['string', 'null'], description: 'offen, gewonnen, verloren, halb_gewonnen, halb_verloren, push, storniert oder cashout.' },
          gratiswette: { type: ['boolean', 'null'], description: 'Steht Freebet, Gratiswette oder Bonus dabei?' },
          eachWay: { type: ['boolean', 'null'], description: 'Steht Each Way dabei? Dann gilt der doppelte Einsatz.' },
          auswahlen: {
            type: 'array',
            description:
              'Die einzelnen Wetten der Kombination, in der Reihenfolge des Bildes. ' +
              'ZERLEGT und nicht als ein Satz: nur so kann das Programm dieselbe Wette ' +
              'bei verschiedenen Anbietern wiedererkennen.',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ereignis: { type: ['string', 'null'], description: 'Die Begegnung, zum Beispiel "Denver Broncos - Kansas City Chiefs".' },
                tipp: { type: ['string', 'null'], description: 'Worauf gesetzt wurde, meist der Spielername, zum Beispiel "RJ Harvey".' },
                markt: { type: ['string', 'null'], description: 'Die Wettart, zum Beispiel "Rushing Yards" oder "Anytime Touchdown Scorer".' },
                richtung: { type: ['string', 'null'], description: 'over, under oder leer. Auf Deutsch über und unter, hier trotzdem over oder under.' },
                linie: { type: ['number', 'null'], description: 'Die Linie als Zahl, zum Beispiel 18.5. Ohne Linie null.' },
                quote: { type: ['number', 'null'], description: 'Die Quote dieser einzelnen Wette als Dezimalzahl, falls sie dasteht.' },
              },
              required: ['ereignis', 'tipp', 'markt', 'richtung', 'linie', 'quote'],
            },
          },
          unsicher: {
            type: 'array',
            description: 'Namen der Felder, bei denen du dir NICHT sicher bist. Lieber eines zu viel als eines zu wenig.',
            items: { type: 'string' },
          },
        },
        // Mit strict: true (unten am Werkzeug) prueft die API jede Antwort
        // gegen genau diesen Bauplan. Dafuer muss JEDES Feld unter required
        // stehen; wo nichts im Bild steht, ist der Wert null, nie fehlend.
        required: [
          'scheinNr', 'gesetztAm', 'konto', 'buchmacher',
          'einsatz', 'quoteDezimal', 'auszahlung', 'ausgezahlt',
          'waehrung', 'status', 'gratiswette', 'eachWay',
          'auswahlen', 'unsicher',
        ],
      },
    },
  },
  required: ['scheine'],
}

/**
 * Die Anweisung. Sie steht ZUERST in der Anfrage und aendert sich nicht.
 *
 * DIE REIHENFOLGE IST KEIN ZUFALL: alles Feste zuerst, das Bild zuletzt. Nur
 * so kann der Zwischenspeicher greifen, und dann kostet dieser Text ab dem
 * zweiten Foto nur ein Zehntel. Steht ein Zeitstempel oder eine wechselnde
 * Kennung vorn, ist der Zwischenspeicher bei jedem Foto leer, und man merkt
 * es nur an den Zahlen in der Antwort.
 */
const ANWEISUNG = `Du liest Wettscheine von Bildschirmfotos ab. Du rechnest nichts aus und du raetst nichts.

REGELN, in dieser Reihenfolge:

1. LIES AB, WAS DASTEHT. Steht ein Wert nicht im Bild, ist er null. Ein erfundener Wert ist schlimmer als eine Luecke, weil er nie wieder auffaellt.

2. MEHRERE SCHEINE JE BILD SIND NORMAL. Manche Anbieter stellen vier Scheine in zwei Spalten nebeneinander, andere neun Zeilen in einer Tabelle. Jeder Schein wird ein eigener Eintrag. Woran du die Grenze erkennst: eine eigene Scheinnummer, ein eigener Rahmen oder eine Karte, oder dieselbe Beschriftung mehrfach (steht zweimal "Einsatz" im Bild, sind es zwei Scheine). Lass keinen aus, auch nicht am Rand angeschnittene: die bekommen unsicher-Eintraege statt geraten zu werden.

3. DER ANBIETER. Nenne den Anbieter, wie er im Bild steht: Logo, Kopfzeile oder Wortmarke (zum Beispiel BetOnline, PS3838, Betway, bet365, Stake). Steht nirgends einer, gib null; rate nicht aus dem Aussehen. Der Kontoname daneben (etwa "Auer" oder "Frohnwieser") gehoert in konto, nicht in buchmacher.

4. DATUM UND UHRZEIT. gesetztAm ist der Zeitpunkt, an dem die Wette abgegeben wurde, als Text GENAU wie im Bild ("Sep 13, 6:39 PM" oder "14.09.26 15:30"). Nichts umrechnen, keine Zeitzone raten. Steht nur die Anstosszeit des Spiels da, gehoert die NICHT in gesetztAm; sie kann im ereignis-Text bleiben.

5. DIE AUSZAHLUNG IST MIT EINSATZ. Steht auf dem Schein nur der Gewinn ohne Einsatz, rechne ihn NICHT dazu, sondern gib die Auszahlung als null und schreib "auszahlung" in unsicher. Welcher Anbieter es wie meint, entscheidet das Programm.

6. QUOTEN. Amerikanische Quoten rechnest du um: -157 wird 1.637, +140 wird 2.40. Bruchquoten ebenso: 7/4 wird 2.75. Steht die Gesamtquote nicht da, gib null, auch wenn du sie aus den Einzelquoten multiplizieren koenntest. Das tut das Programm.

7. ZAHLEN OHNE TRENNZEICHEN. Gib 1234.56, nicht "1.234,56" und nicht "$1,234.56". Achte auf das Gebiet: "1.250" heisst deutsch tausendzweihundertfuenfzig und englisch eins Komma zwei fuenf. Krypto-Betraege mit acht Nachkommastellen ("5,000.00000000") liest du vollstaendig ab. Bist du unsicher, schreib das Feld in unsicher.

8. UNSICHER IST KEINE SCHANDE. Jedes Feld, bei dem du zoegerst, gehoert in die Liste unsicher. Das Programm rechnet danach gegen und fragt notfalls den Menschen. Ein stiller Fehler kostet Geld, eine gemeldete Unsicherheit kostet drei Sekunden.

9. EINZEL ODER KOMBI. Eine Kombination (Kombi, Parlay, Accumulator, Mehrfachwette) hat MEHRERE Eintraege in auswahlen, eine Einzelwette genau einen. Jede Zeile der Kombination wird ein eigener Eintrag, in der Reihenfolge des Bildes. Zaehle nichts zusammen und lass keine Zeile aus: an der Zahl der Auswahlen erkennt das Programm die Kombination.

10. DIE AUSWAHLEN ZERLEGT. Aus "RJ Harvey under 18,5 Rushing Yards" wird
   tipp "RJ Harvey", markt "Rushing Yards", richtung "under", linie 18.5. Das
   ist der wichtigste Teil: nur so erkennt das Programm, dass derselbe Spieler
   bei BetOnline und bei Stake dieselbe Wette ist, und kann die Einsaetze
   zusammenzaehlen. Schreib den Spielernamen genau so, wie er dasteht, aber
   ohne Zusaetze wie die Mannschaft in Klammern. Die Begegnung mit beiden
   Mannschaften gehoert in ereignis.

11. DER STAND. offen heisst noch nicht entschieden. gewonnen und verloren wie beschriftet ("DU HAST GEWONNEN", "WIN", "Verlust", "LOSE"). push heisst unentschieden mit Einsatz zurueck. storniert heisst annulliert oder erstattet ("UNGUELTIG", "Refunded", "Void"). cashout heisst vorzeitig ausgezahlt. Steht "Verloren", ist ausgezahlt null und status verloren.

12. EIGENHEITEN, die diese Anbieter wirklich haben; lies trotzdem ab, was dasteht:
   - BetOnline: amerikanische Quoten, GERUNDET angezeigt. Verlorene Scheine haben gar keine Returns-Spalte.
   - PS3838: eine TABELLE, keine Karten. "Risk: 500.00" ist der Einsatz, die Spalte Win/Loss ist der GEWINN ohne Einsatz (also auszahlung null, Regel 5), der Formatbuchstabe D oder A steht hinter der Quote.
   - Betway: deutsch. "Umsetzen" ist der Einsatz, die Quote steht hinter einem @-Zeichen im Kopf, Beschriftung und Wert stehen oft in getrennten Zeilen.
   - bet365: deutsch. "Gewinn" ist dort die Auszahlung MIT Einsatz.
   - Stake: Krypto mit acht Nachkommastellen, in der Anzeige manchmal abgeschnitten ("..."). Quote deutsch geschrieben (1,90), Betraege englisch (2,000.00), im selben Schein. "Quoten" ist die Beschriftung der Quote.`

/**
 * Laesst ein Bild von der KI lesen.
 *
 * WIRFT NIE. Faellt es aus, steht das im Ergebnis, und das Programm liest
 * oertlich weiter. Ein Leser, der das Aufnehmen anhalten kann, waere
 * schlimmer als keiner.
 *
 * @param {Blob} bild
 * @param {object} [wahl]
 * @param {string} [wahl.anbieter]   Was die oertliche Erkennung vermutet.
 * @param {string[]} [wahl.merkliste] Gelernte Regeln fuer diesen Anbieter.
 * @param {typeof fetch} [wahl.hole]  Nur fuer die Probe.
 * @returns {Promise<{gelungen: boolean, scheine: any[], meldung: string, marken: {gelesen: number, geschrieben: number, ausSpeicher: number}|null}>}
 */
export async function leseBild(bild, wahl = {}) {
  const leer = { gelungen: false, scheine: [], meldung: '', marken: null }

  const key = schluessel()
  if (!key) return { ...leer, meldung: 'Kein API-Schlüssel hinterlegt.' }
  if (!bild) return { ...leer, meldung: 'Kein Bild übergeben.' }

  let daten
  try {
    daten = await alsBase64(bild)
  } catch (fehler) {
    return { ...leer, meldung: `Das Bild ließ sich nicht umwandeln: ${satzVon(fehler)}` }
  }

  const hole = wahl.hole ?? fetch

  // Alles Feste zuerst, das Bild zuletzt. Siehe ANWEISUNG.
  //
  // DER ZWISCHENSPEICHER WIRD ANGEFORDERT, NICHT NUR ERHOFFT: cache_control
  // an der Anweisung setzt den Haltepunkt. Ohne diese Marke speichert die
  // API gar nichts, und der Satz "ab dem zweiten Foto ein Zehntel" oben
  // waere eine Behauptung. Ob es greift, steht in marken.ausSpeicher, und
  // die Oberflaeche zeigt es an.
  const teile = [
    { type: 'text', text: ANWEISUNG, cache_control: { type: 'ephemeral' } },
  ]
  if (wahl.merkliste && wahl.merkliste.length > 0) {
    teile.push({
      type: 'text',
      text:
        `Was bei diesem Anbieter schon einmal falsch gelesen wurde, und wie es richtig ist:\n` +
        wahl.merkliste.map((r) => `- ${r}`).join('\n'),
    })
  }
  if (wahl.anbieter) {
    teile.push({ type: 'text', text: `Das Programm vermutet den Anbieter: ${wahl.anbieter}. Prüfe das am Bild.` })
  }
  teile.push({
    type: 'image',
    source: { type: 'base64', media_type: daten.art, data: daten.text },
  })

  try {
    const antwort = await hole('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // OHNE DIESEN KOPF weist die API eine Anfrage aus einem Browser ab.
        // Er heisst "dangerous", weil ein Schluessel im Quelltext wirklich
        // gefaehrlich waere. Hier gibt ihn der Mensch selbst ein.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modell(),
        /*
          16000 UND NICHT 2000. Auf Karams Fotos stehen bis zu neun
          Kombischeine; deren Antwort passt in 2000 Ausgabetoken nicht, und
          eine abgeschnittene Antwort verliert Scheine STILL, denn was fehlt,
          faellt in keiner Summe auf. 16000 ist eine Obergrenze, kein
          Verbrauch: bezahlt wird nur, was wirklich geschrieben wird.
          Zusaetzlich wird unten stop_reason geprueft, damit ein Abschneiden
          nie als Erfolg gilt.
        */
        max_tokens: 16000,
        tools: [
          {
            name: 'scheine_melden',
            description: 'Gib die abgelesenen Wettscheine zurück.',
            input_schema: BAUPLAN,
            // strict laesst die API selbst pruefen, dass die Antwort genau
            // dem Bauplan entspricht. Ein erfundenes Feld oder ein falscher
            // Typ kommt damit gar nicht erst hier an.
            strict: true,
          },
        ],
        tool_choice: { type: 'tool', name: 'scheine_melden' },
        messages: [{ role: 'user', content: teile }],
      }),
    })

    if (!antwort.ok) {
      return { ...leer, meldung: await fehlersatz(antwort) }
    }

    const roh = await antwort.json()

    // Eine abgeschnittene Antwort ist KEIN Erfolg. Bei max_tokens fehlen
    // Scheine, und was fehlt, faellt in keiner Summe auf (stiller Verlust).
    if (roh?.stop_reason === 'max_tokens') {
      return {
        ...leer,
        meldung:
          'Die Antwort der KI war laenger als erlaubt und wurde abgeschnitten. ' +
          'Es wurde NICHTS uebernommen, damit kein Schein still fehlt. ' +
          'Bitte das Foto in kleinere Ausschnitte teilen und noch einmal lesen lassen.',
      }
    }

    const werkzeug = (roh?.content ?? []).find((t) => t?.type === 'tool_use')
    if (!werkzeug?.input?.scheine) {
      return { ...leer, meldung: 'Die Antwort enthielt keine Scheine.' }
    }

    return {
      gelungen: true,
      scheine: werkzeug.input.scheine,
      meldung: '',
      marken: {
        gelesen: roh?.usage?.input_tokens ?? 0,
        geschrieben: roh?.usage?.output_tokens ?? 0,
        ausSpeicher: roh?.usage?.cache_read_input_tokens ?? 0,
      },
    }
  } catch (fehler) {
    return { ...leer, meldung: `Die Anfrage kam nicht durch: ${satzVon(fehler)}` }
  }
}

/**
 * Macht aus einer Fehlerantwort einen Satz, der sagt, was zu tun ist.
 *
 * Nicht "HTTP 401": das sagt Karam nichts. Jede dieser Lagen hat genau eine
 * Handlung, und die steht dabei.
 *
 * @param {Response} antwort
 */
async function fehlersatz(antwort) {
  let grund = ''
  try {
    const koerper = await antwort.json()
    grund = koerper?.error?.message ?? ''
  } catch {
    // Eine Antwort ohne lesbaren Koerper ist kein zusaetzlicher Fehler.
  }

  if (antwort.status === 401) {
    return 'Der Schlüssel wurde nicht angenommen. Stimmt er noch? In der Anthropic-Console lässt sich ein neuer anlegen.'
  }
  if (antwort.status === 400 && /credit|balance/i.test(grund)) {
    return 'Auf dem Anthropic-Konto ist kein Guthaben mehr. Nachlegen, dann geht es weiter.'
  }
  if (antwort.status === 429) {
    return 'Zu viele Anfragen auf einmal. Einen Moment warten, dann noch einmal.'
  }
  if (antwort.status >= 500) {
    return 'Anthropic meldet eine Störung. Das Programm liest solange örtlich weiter.'
  }
  return `Die KI antwortete mit Fehler ${antwort.status}${grund ? ': ' + grund : ''}.`
}

/**
 * Macht aus einem Blob das, was die API erwartet.
 *
 * @param {Blob} blob
 * @returns {Promise<{art: string, text: string}>}
 */
function alsBase64(blob) {
  return new Promise((erfuellen, ablehnen) => {
    const leser = new FileReader()
    leser.onerror = () => ablehnen(leser.error ?? new Error('unlesbar'))
    leser.onload = () => {
      const ganz = String(leser.result ?? '')
      const komma = ganz.indexOf(',')
      if (komma < 0) {
        ablehnen(new Error('unerwartete Form'))
        return
      }
      // Die API nimmt png, jpeg, gif und webp. Alles andere geht als png
      // hinaus; kommt es nicht an, sagt es die Fehlermeldung.
      const art = /^data:(image\/(png|jpeg|gif|webp))/.exec(ganz)?.[1] ?? 'image/png'
      erfuellen({ art, text: ganz.slice(komma + 1) })
    }
    leser.readAsDataURL(blob)
  })
}

/** @param {unknown} fehler */
function satzVon(fehler) {
  return fehler instanceof Error ? fehler.message : String(fehler)
}
