// @ts-check
/**
 * Die grosse Suche: findet Scheine, Riesenscheine und Ordner.
 *
 * Karam am 19.09.2026: "wenn ich bei einer Uebersicht bin, moechte ich, dass
 * da noch eine Suchleiste ist, da kann ich nach Quoten, nach Datum, nach Name,
 * nach Emoji suchen, nach den Scheinen und nach den Ordnern. Und wenn ich
 * will, kann ich auch in allen Projekten suchen. Ich weiss nicht, wo ein
 * Schein gespeichert wird."
 *
 * WARUM DAS IM KERN LIEGT
 *
 * Hier wird nur verglichen, nie geladen und nie gezeichnet. Was durchsucht
 * wird, reicht der Aufrufer als fertigen Bestand herein; ob der aus dem
 * offenen Projekt kommt oder aus der Datenbank eines anderen, sieht diese
 * Datei nicht. So laesst sich jede Regel ohne Browser pruefen
 * (test/suche.test.mjs), und die Suche rechnet garantiert an genau einer
 * Stelle (Projektregel 8).
 *
 * WAS EIN BESTAND IST
 *
 *   { projektId, projektName, riesenscheine, scheine }
 *
 * Die Riesenscheine kommen mit AUFGELOESTEM Ordner herein (r.ordner ist der
 * gueltige Name oder leer). Das Aufloesen ist Sache von oberflaeche/ordner.js,
 * denn nur dort lebt die Bruecke zu alten Geraete-Zuordnungen; der Kern
 * bekaeme sonst eine Abhaengigkeit auf den Browserspeicher.
 *
 * DIE REGELN, dieselben wie in der kleinen Suche (oberflaeche/reihenfolge.js):
 *
 *   Mehrere Woerter muessen ALLE vorkommen, in beliebiger Reihenfolge.
 *   Zahlen zaehlen in BEIDEN Schreibweisen: "5481" und "5.481,00",
 *   Quoten als "1,84" und "1.84", amerikanisch als "-157".
 *   Ein Datum zaehlt als "17.09.2026", als "17.09." und als roher ISO-Text.
 *   Emojis sind gewoehnliche Zeichen im Namen und werden mitgefunden.
 *
 * Jeder Treffer sagt, WO er liegt (Projekt, Ordner, Riesenschein) und IN
 * WELCHEM FELD er gefunden wurde. Wer sucht, weiss ja gerade nicht mehr, wo
 * etwas liegt; ein Treffer ohne Ort waere nur ein zweites Raetsel.
 */

/**
 * @typedef {object} Suchtreffer
 * @property {'ordner'|'riesenschein'|'schein'} art
 * @property {string} projektId
 * @property {string} projektName
 * @property {string} ordner            Leer, wenn in keinem Ordner.
 * @property {string|null} riesenscheinId
 * @property {string} riesenscheinName
 * @property {string|null} scheinId
 * @property {string} name              Was in der Trefferzeile steht.
 * @property {string[]} gefundenIn      Die Felder, in denen ein Suchwort stand.
 */

/**
 * Eine Zahl in den Schreibweisen, in denen Karam sie tippt.
 *
 * @param {unknown} wert
 * @returns {string[]}
 */
export function zahlSchreibweisen(wert) {
  // Number(null) waere 0. Aus nichts eine Null zu machen hiesse, jeder
  // Suche nach "0" jeden leeren Schein zu liefern (Projektregel 1).
  if (wert === null || wert === undefined || String(wert).trim() === '') return []
  const zahl = Number(wert)
  if (!Number.isFinite(zahl)) return []
  const mitKomma = zahl.toFixed(2).replace('.', ',')
  const tausender = mitKomma.replace(/\B(?=(\d{3})+(?=,))/g, '.')
  return [String(zahl), String(Math.round(zahl)), zahl.toFixed(2), mitKomma, tausender]
}

/**
 * Ein Zeitpunkt in den Schreibweisen, in denen man ihn sucht.
 *
 * Ohne new Date(): der Text wird zerlegt, nicht gedeutet. Ein unlesbarer
 * Zeitpunkt liefert nur sich selbst, nie ein erfundenes Datum
 * (Projektregel 1).
 *
 * @param {unknown} iso
 * @returns {string[]}
 */
export function datumSchreibweisen(iso) {
  const text = String(iso ?? '').trim()
  if (text === '') return []
  const teile = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (!teile) return [text]
  const [, jahr, monat, tag] = teile
  return [text, `${tag}.${monat}.${jahr}`, `${tag}.${monat}.`]
}

/**
 * Ein Stueck Heuhaufen: der Feldname fuer die Anzeige und sein Text.
 *
 * @param {string} feld
 * @param {unknown[]} texte
 * @returns {{feld: string, text: string}|null}
 */
function stueck(feld, texte) {
  const text = texte
    .map((t) => String(t ?? '').trim())
    .filter((t) => t !== '')
    .join(' ')
    .toLowerCase()
  return text === '' ? null : { feld, text }
}

/**
 * Prueft die Stuecke gegen die Suchwoerter.
 *
 * @param {({feld: string, text: string}|null)[]} stuecke
 * @param {string[]} woerter  Schon klein geschrieben.
 * @returns {string[]|null}  Die getroffenen Felder, oder null bei Fehlschlag.
 */
function pruefe(stuecke, woerter) {
  const echte = stuecke.filter((s) => s !== null)
  const alles = echte.map((s) => s.text).join(' ')
  if (!woerter.every((wort) => alles.includes(wort))) return null

  const felder = []
  for (const s of echte) {
    if (woerter.some((wort) => s.text.includes(wort)) && !felder.includes(s.feld)) {
      felder.push(s.feld)
    }
  }
  return felder
}

/**
 * Durchsucht einen Bestand. Leerer Suchtext findet nichts, mit Absicht:
 * "alles" ist kein Suchergebnis, sondern die Uebersicht selbst.
 *
 * @param {{projektId: string, projektName: string, riesenscheine: any[], scheine: any[]}} bestand
 * @param {string} suchtext
 * @returns {Suchtreffer[]}
 */
export function durchsucheBestand(bestand, suchtext) {
  const woerter = String(suchtext ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (woerter.length === 0) return []

  const riesenscheine = bestand.riesenscheine ?? []
  const scheine = bestand.scheine ?? []

  /** @type {Suchtreffer[]} */
  const treffer = []
  const ort = { projektId: bestand.projektId ?? '', projektName: bestand.projektName ?? '' }

  // Die Ordner zuerst: jeder Name genau einmal, in der Reihenfolge des
  // ersten Auftretens. Ein Ordner IST nur sein Name, mehr gibt es nicht
  // zu durchsuchen.
  const gesehen = new Set()
  for (const r of riesenscheine) {
    const name = String(r.ordner ?? '').trim()
    if (name === '' || gesehen.has(name)) continue
    gesehen.add(name)
    const felder = pruefe([stueck('Name', [name])], woerter)
    if (felder) {
      treffer.push({
        ...ort,
        art: 'ordner',
        ordner: name,
        riesenscheinId: null,
        riesenscheinName: '',
        scheinId: null,
        name,
        gefundenIn: felder,
      })
    }
  }

  // Welcher Schein in welchem Riesenschein liegt, sagt scheinIds. Die
  // gruppeId am Schein ist dieselbe Wahrheit von der anderen Seite; hier
  // zaehlt die Liste, weil sie auch die Reihenfolge traegt.
  const heim = new Map()
  for (const r of riesenscheine) {
    for (const id of r.scheinIds ?? []) heim.set(id, r)
  }

  for (const r of riesenscheine) {
    const felder = pruefe(
      [
        stueck('Name', [r.name]),
        stueck('Ordner', [r.ordner]),
        stueck('Notiz', [r.notiz]),
        stueck('Datum', datumSchreibweisen(r.angelegtAm)),
      ],
      woerter
    )
    if (felder) {
      treffer.push({
        ...ort,
        art: 'riesenschein',
        ordner: String(r.ordner ?? '').trim(),
        riesenscheinId: r.id,
        riesenscheinName: String(r.name ?? ''),
        scheinId: null,
        name: String(r.name ?? '') || 'Ohne Namen',
        gefundenIn: felder,
      })
    }
  }

  for (const s of scheine) {
    const auswahlen = Array.isArray(s.auswahlen) ? s.auswahlen : []
    const felder = pruefe(
      [
        stueck('Anbieter', [s.buchmacher?.wert]),
        stueck('Scheinnummer', [s.scheinNr?.wert]),
        stueck('Konto', [s.konto?.wert]),
        stueck('Datum', [
          ...datumSchreibweisen(s.gesetztAm?.wert),
          ...datumSchreibweisen(s.angelegtAm),
        ]),
        stueck('Einsatz', zahlSchreibweisen(s.einsatz?.wert)),
        stueck('Quote', [
          ...zahlSchreibweisen(s.quoteDezimal?.wert),
          ...auswahlen.flatMap((a) => zahlSchreibweisen(a.quoteDezimal?.wert)),
          s.quoteAmerikanisch?.wert !== null && s.quoteAmerikanisch?.wert !== undefined
            ? (s.quoteAmerikanisch.wert > 0 ? '+' : '') + String(s.quoteAmerikanisch.wert)
            : '',
        ]),
        stueck(
          'Auswahl',
          auswahlen.flatMap((a) => [a.ereignis?.wert, a.markt?.wert, a.tipp?.wert])
        ),
        stueck('Notiz', [s.notiz]),
      ],
      woerter
    )
    if (felder) {
      const zuhause = heim.get(s.id) ?? null
      treffer.push({
        ...ort,
        art: 'schein',
        ordner: String(zuhause?.ordner ?? '').trim(),
        riesenscheinId: zuhause?.id ?? null,
        riesenscheinName: String(zuhause?.name ?? ''),
        scheinId: s.id,
        name: String(s.buchmacher?.wert ?? '') || 'Anbieter offen',
        gefundenIn: felder,
      })
    }
  }

  return treffer
}
