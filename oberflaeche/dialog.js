// @ts-check
/**
 * Die Fenster, in denen das Programm fragt und Bescheid sagt.
 *
 * Karam am 17.09.2026: "Es gibt viele Pop-Ups, vor allem wenn man irgendwas
 * Neues macht. Und zwar nicht vom Browser oben, das mag ich gar nicht. All
 * diese Pop-Ups vom Browser oben sollen bitte gecustomed sein und ganz
 * uebersichtlich anzeigen, was du ihnen sagen willst. Und du hast einfach die
 * wichtigsten Stichpunkte da zum Anschreiben."
 *
 * WAS VORHER FALSCH WAR
 *
 * Das Programm hat window.prompt, window.confirm und window.alert benutzt, an
 * dreizehn Stellen. Die haengen oben am Browserrand, sehen in jedem Browser
 * anders aus, koennen kein Fettgedrucktes, keine Liste und kein zweites Feld,
 * und auf dem Telefon verdecken sie die halbe Seite. Fuer die Frage "in welchen
 * Ordner soll dieser Riesenschein" war das zu wenig: da gehoert dazu, was
 * ueberhaupt ein Ordner ist und dass man ihn auch weglassen darf.
 *
 * WAS DIESE DATEI TUT
 *
 *   sag()         Bescheid geben, ein Knopf.
 *   bestaetige()  Ja oder nein, mit Stichpunkten dazu.
 *   frage()       Dasselbe mit Feldern zum Ausfuellen.
 *
 * Alle drei geben ein Versprechen zurueck und warten, bis der Mensch geklickt
 * hat. Damit lesen sie sich im Code wie die alten Browserfenster, und die
 * Umstellung hat nirgends die Ablaeufe geaendert (Projektregel 8).
 *
 * WARUM <dialog> UND KEIN EIGENER KASTEN
 *
 * Das Element kann von sich aus, was ein eigener Kasten muehsam nachbauen
 * muesste: es liegt ueber allem, es faengt die Tastatur ein, Escape schliesst,
 * und der Hintergrund ist nicht mehr anklickbar. Selbst gebaut waere das eine
 * Stelle mehr, an der die Tastaturbedienung kaputtgeht, ohne dass es jemand
 * merkt.
 *
 * HIER STEHT KEINE FARBE UND KEINE GROESSE (Projektregel 5). Faellt stil/ weg,
 * bleibt ein schlichtes Fenster mit Ueberschrift, Liste und Knoepfen stehen.
 */

import { el, fuelle } from './werkzeug.js'

/**
 * @typedef {object} Feldbauplan
 * @property {string} name          Unter diesem Schluessel kommt der Wert zurueck.
 * @property {string} beschriftung
 * @property {string} [wert]        Was schon drinsteht.
 * @property {string} [platzhalter]
 * @property {string} [hilfe]       Ein Satz unter dem Feld.
 * @property {string[]} [vorschlaege] Werden als Auswahlliste angeboten.
 */

/**
 * @typedef {object} Bauplan
 * @property {string} titel
 * @property {string} [text]        Ein Satz unter der Ueberschrift.
 * @property {string[]} [punkte]    Die wichtigsten Stichpunkte.
 * @property {Feldbauplan[]} [felder]
 * @property {string} [ja]          Beschriftung des Hauptknopfs.
 * @property {string} [nein]        Beschriftung des Abbruchknopfs.
 * @property {boolean} [gefahr]     true faerbt den Hauptknopf als Warnung.
 * @property {string} [fuss]        Kleingedrucktes ganz unten.
 */

/**
 * Baut das Fenster und gibt es samt Versprechen zurueck.
 *
 * @param {Bauplan} bauplan
 * @param {boolean} mitAbbruch
 * @returns {Promise<Record<string, string>|null>}
 */
function zeige(bauplan, mitAbbruch) {
  return new Promise((erfuelle) => {
    /** @type {HTMLInputElement[]} */
    const felder = []

    const fenster = /** @type {HTMLDialogElement} */ (
      el('dialog.dialog.dialogfenster', { 'aria-labelledby': 'dialogtitel' })
    )

    /*
      EIN FORMULAR, damit die Eingabetaste den Hauptknopf drueckt.

      Ohne das muesste man nach dem Tippen erst zur Maus greifen. Karam legt
      an einem Spieltag mehrere Riesenscheine an; jedes Mal zur Maus zu wechseln
      waere genau die Zaehigkeit, die er weghaben wollte.
    */
    const formular = el('form.dialoginhalt', { method: 'dialog' }, [
      el('h2.dialogtitel', { id: 'dialogtitel', text: bauplan.titel }),

      bauplan.text ? el('p.dialogtext', { text: bauplan.text }) : null,

      /*
        DIE STICHPUNKTE.

        Karam: "du hast einfach die wichtigsten Stichpunkte da zum Anschreiben."
        Eine Liste liest sich in zwei Sekunden, ein Absatz nicht. Wo es um Geld
        geht, steht hier, was der Klick mit dem Geld macht.
      */
      bauplan.punkte && bauplan.punkte.length > 0
        ? el(
            'ul.dialogpunkte',
            {},
            bauplan.punkte.map((p) => el('li', { text: p }))
          )
        : null,

      ...(bauplan.felder ?? []).map((f, i) => {
        const listenId = f.vorschlaege && f.vorschlaege.length > 0 ? `dialogliste-${i}` : null
        const eingabe = /** @type {HTMLInputElement} */ (
          el('input.dialogeingabe', {
            type: 'text',
            name: f.name,
            value: f.wert ?? '',
            placeholder: f.platzhalter ?? '',
            list: listenId,
            autocomplete: 'off',
          })
        )
        felder.push(eingabe)
        return el('label.dialogfeld', {}, [
          el('span.dialogfeldname', { text: f.beschriftung }),
          eingabe,
          listenId
            ? el(
                'datalist',
                { id: listenId },
                (f.vorschlaege ?? []).map((v) => el('option', { value: v }))
              )
            : null,
          f.hilfe ? el('span.dialogfeldhilfe', { text: f.hilfe }) : null,
        ])
      }),

      bauplan.fuss ? el('p.dialogfuss', { text: bauplan.fuss }) : null,

      el('.dialogknoepfe', {}, [
        mitAbbruch
          ? el('button.knopf', {
              type: 'button',
              text: bauplan.nein ?? 'Abbrechen',
              onclick: () => antworte(false),
            })
          : null,
        el(`button.knopf.knopf-haupt${bauplan.gefahr ? '.knopf-weg' : ''}`, {
          type: 'submit',
          value: 'ja',
          text: bauplan.ja ?? 'Weiter',
        }),
      ]),
    ])

    fuelle(fenster, [formular])

    /*
      DAS ERGEBNIS HAENGT AM ABSENDEN, NICHT AM SCHLIESSEN.

      Zuerst hing es am Ereignis close. Im Browser gemessen am 17.09.2026: ein
      Klick auf den Hauptknopf setzt returnValue auf "ja" und schliesst das
      Fenster, aber close kam nicht an. Das Versprechen loeste sich nie ein, das
      Fenster blieb im Dokument stehen, und der neue Riesenschein entstand
      nicht. Von aussen sah es aus wie ein Knopf, der nichts tut.

      Jetzt haengt jeder der drei Wege an seinem eigenen Ereignis:
        submit  der Hauptknopf
        click   der Abbruchknopf
        cancel  die Escape-Taste
      Keiner davon ist geraten, alle drei sind unten nachgemessen.

      antworte() darf nur EINMAL durchkommen. Sonst koennte ein zweiter Weg ein
      bereits gegebenes Ergebnis ueberschreiben, und bei der Frage "in welchen
      Ordner" waere das ein stiller Datenverlust.
    */
    let schonGeantwortet = false
    const antworte = (mitWerten) => {
      if (schonGeantwortet) return
      schonGeantwortet = true
      /** @type {Record<string, string>} */
      const antwort = {}
      for (const f of felder) antwort[f.name] = f.value.trim()
      if (fenster.open) fenster.close()
      fenster.remove()
      erfuelle(mitWerten ? antwort : null)
    }

    formular.addEventListener('submit', (e) => {
      // Ohne das laedt die Seite neu, falls method="dialog" einmal nicht
      // greift. Ein Neuladen mitten im Anlegen waere der schlimmste Ausgang.
      e.preventDefault()
      antworte(true)
    })
    fenster.addEventListener('cancel', (e) => {
      e.preventDefault()
      antworte(false)
    })
    fenster.addEventListener('close', () => antworte(fenster.returnValue === 'ja'))

    document.body.append(fenster)
    fenster.showModal()

    // In das erste Feld springen, sonst muesste man erst hineinklicken.
    if (felder[0]) {
      felder[0].focus()
      felder[0].select()
    }
  })
}

/**
 * Bescheid geben. Ein Knopf, kein Abbruch.
 *
 * @param {Bauplan} bauplan
 * @returns {Promise<void>}
 */
export async function sag(bauplan) {
  await zeige({ ja: 'Verstanden', ...bauplan }, false)
}

/**
 * Ja oder nein.
 *
 * @param {Bauplan} bauplan
 * @returns {Promise<boolean>}
 */
export async function bestaetige(bauplan) {
  const antwort = await zeige(bauplan, true)
  return antwort !== null
}

/**
 * Nach einem oder mehreren Werten fragen.
 *
 * Gibt null zurueck, wenn abgebrochen wurde. Ein LEERES Feld ist etwas
 * anderes als ein Abbruch: bei der Ordnerfrage heisst leer ausdruecklich
 * "in keinen Ordner", und das muss sich sagen lassen.
 *
 * @param {Bauplan} bauplan
 * @returns {Promise<Record<string, string>|null>}
 */
export function frage(bauplan) {
  return zeige(bauplan, true)
}
