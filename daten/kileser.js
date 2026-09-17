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
  properties: {
    scheine: {
      type: 'array',
      description: 'Jeder Wettschein auf dem Bild, einer je Eintrag. Auch wenn mehrere nebeneinander stehen.',
      items: {
        type: 'object',
        properties: {
          scheinNr: { type: ['string', 'null'], description: 'Die Wett- oder Schein-Nummer, wie sie dasteht.' },
          buchmacher: { type: ['string', 'null'], description: 'Der Anbieter, wie er im Bild genannt ist.' },
          einsatz: { type: ['number', 'null'], description: 'Der Einsatz als Zahl, ohne Währungszeichen.' },
          quoteDezimal: { type: ['number', 'null'], description: 'Die Gesamtquote als Dezimalzahl. Amerikanische Quoten (-157, +140) hier umrechnen.' },
          auszahlung: { type: ['number', 'null'], description: 'Die mögliche Auszahlung EINSCHLIESSLICH Einsatz.' },
          ausgezahlt: { type: ['number', 'null'], description: 'Was wirklich zurückkam, falls der Schein entschieden ist.' },
          waehrung: { type: ['string', 'null'], description: 'EUR, USD, GBP, CHF oder das Kürzel der Kryptowährung.' },
          status: { type: ['string', 'null'], description: 'offen, gewonnen, verloren, halb_gewonnen, halb_verloren, storniert oder cashout.' },
          gratiswette: { type: ['boolean', 'null'], description: 'Steht Freebet, Gratiswette oder Bonus dabei?' },
          eachWay: { type: ['boolean', 'null'], description: 'Steht Each Way dabei? Dann gilt der doppelte Einsatz.' },
          auswahlen: {
            type: 'array',
            description: 'Die einzelnen Wetten der Kombination, in der Reihenfolge des Bildes.',
            items: { type: 'string' },
          },
          unsicher: {
            type: 'array',
            description: 'Namen der Felder, bei denen du dir NICHT sicher bist. Lieber eines zu viel als eines zu wenig.',
            items: { type: 'string' },
          },
        },
        required: ['einsatz', 'quoteDezimal', 'auszahlung', 'waehrung', 'status', 'auswahlen', 'unsicher'],
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

2. MEHRERE SCHEINE JE BILD SIND NORMAL. Manche Anbieter stellen vier Scheine in zwei Spalten nebeneinander. Gib jeden einzeln zurueck.

3. DIE AUSZAHLUNG IST MIT EINSATZ. Steht auf dem Schein nur der Gewinn ohne Einsatz, rechne ihn NICHT dazu, sondern gib die Auszahlung als null und schreib "auszahlung" in unsicher. Welcher Anbieter es wie meint, entscheidet das Programm.

4. QUOTEN. Amerikanische Quoten rechnest du um: -157 wird 1.637, +140 wird 2.40. Bruchquoten ebenso: 7/4 wird 2.75. Steht die Gesamtquote nicht da, gib null, auch wenn du sie aus den Einzelquoten multiplizieren koenntest. Das tut das Programm.

5. ZAHLEN OHNE TRENNZEICHEN. Gib 1234.56, nicht "1.234,56" und nicht "$1,234.56". Achte auf das Gebiet: "1.250" heisst deutsch tausendzweihundertfuenfzig und englisch eins Komma zwei fuenf. Bist du unsicher, schreib das Feld in unsicher.

6. UNSICHER IST KEINE SCHANDE. Jedes Feld, bei dem du zoegerst, gehoert in die Liste unsicher. Das Programm rechnet danach gegen und fragt notfalls den Menschen. Ein stiller Fehler kostet Geld, eine gemeldete Unsicherheit kostet drei Sekunden.

7. DER STAND. offen heisst noch nicht entschieden. cashout heisst vorzeitig ausgezahlt. Steht "Verloren", ist ausgezahlt null und status verloren.`

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
  const teile = [
    { type: 'text', text: ANWEISUNG },
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
        max_tokens: 2000,
        tools: [
          {
            name: 'scheine_melden',
            description: 'Gib die abgelesenen Wettscheine zurück.',
            input_schema: BAUPLAN,
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
