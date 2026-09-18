import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Die Grenze zwischen den Programmen in derselben Datenbank.
 *
 * Karam am 18.09.2026: "Mach klare Trennungen zwischen den Projekten in der
 * Datenbank. Ich will nie, dass sich irgendwas mischt. Weder Daten noch
 * irgendwas. Und auch fuer die neuen Chats, wenn ich da was arbeite und mit der
 * Datenbank mache, muss das wirklich klar getrennt sein, keine Fehler, kein
 * Durcheinander."
 *
 * In einer Supabase-Datenbank liegen drei Programme nebeneinander: Kombi
 * Exchange (Schema kombi, Tueren public.kombi_*), Kombi Tafel (public.kt_*) und
 * immo-check (public, ohne Vorsilbe). Am 18.09.2026 nachgemessen war die
 * Trennung vollstaendig: keine Funktion griff ueber die Grenze, kein
 * Fremdschluessel lief hinueber.
 *
 * Diese Probe haelt den Zustand fest. Sie prueft nicht die Datenbank, sondern
 * das Programm: dass es GAR NICHT ERST in der Lage ist, etwas Fremdes
 * anzusprechen.
 */

/*
  Kein Netz in dieser Probe.

  Die Grenze wird geprueft, BEVOR ueberhaupt ein fetch gebaut wird. Bei den
  erlaubten Namen muss aber trotzdem etwas antworten, sonst haenge die Probe
  zwanzig Sekunden am Zeitablauf. Deshalb ein Platzhalter, der sofort eine
  leere Liste liefert.
*/
const gerufen = []
globalThis.fetch = async (adresse) => {
  gerufen.push(String(adresse))
  return {
    ok: true,
    status: 200,
    text: async () => '[]',
  }
}

const Datenbank = await import('../daten/datenbank.js')

test('die eigenen Tueren gehen auf', async () => {
  const eigene = [
    'kombi_code_einloesen',
    'kombi_sitzung_pruefen',
    'kombi_projekte_lesen',
    'kombi_projekt_speichern',
    'kombi_projekt_loeschen',
    'kombi_projekt_leeren',
    'kombi_scheine_lesen',
    'kombi_scheine_speichern',
    'kombi_schein_loeschen',
    'kombi_riesenscheine_lesen',
    'kombi_riesenscheine_speichern',
    'kombi_bilder_lesen',
    'kombi_bilder_speichern',
    'kombi_code_wechseln',
  ]

  for (const name of eigene) {
    const antwort = await Datenbank.rufe(name, {})
    assert.equal(antwort.art, 'leer', `${name} haette durchgehen muessen`)
  }

  assert.equal(gerufen.length, 14, 'alle vierzehn sind wirklich losgeschickt worden')
  for (const adresse of gerufen) {
    assert.match(adresse, /\/rest\/v1\/rpc\/kombi_/, adresse)
  }
})

test('DIE WICHTIGSTE: fremde Tueren bleiben zu', async () => {
  /*
    Das sind echte Namen aus derselben Datenbank. Sie gehoeren Kombi Tafel und
    immo-check. Genau so koennte ein spaeterer Chat sie hinschreiben, weil sie
    ja da sind und funktionieren wuerden.
  */
  const fremde = [
    'kt_wetten_archivieren',
    'kt_ist_admin',
    'kt_darf_lesen',
    'kt_admin_userliste',
    'kt_schein_nummer_geben',
    'is_active_user',
    'is_admin',
    'handle_new_user',
    'touch_updated_at',
    'auto_confirm_email',
  ]

  const vorher = gerufen.length

  for (const name of fremde) {
    await assert.rejects(
      () => Datenbank.rufe(name, {}),
      (fehler) => {
        assert.match(fehler.message, /keine Tuer von Kombi Exchange/)
        return true
      },
      `${name} haette abgewiesen werden muessen`
    )
  }

  assert.equal(gerufen.length, vorher, 'und es ist nichts davon im Netz gelandet')
})

test('auch schrages Zeug kommt nicht durch', async () => {
  /*
    Ein Name, der nur zufaellig mit kombi_ anfaengt, aber in Wahrheit einen Weg
    woandershin baut. /rest/v1/rpc/ ist ein Pfad, und ein Name mit Schraegstrich
    oder Punkt waere ein Ausbruch daraus.
  */
  const schraeg = [
    'kombi_scheine_lesen/../../kt_wetten',
    'kombi_scheine_lesen?select=*',
    'kombi.scheine',
    'kombi_Scheine_Lesen',
    'KOMBI_scheine_lesen',
    '',
    'kombi_',
    'kombi_1',
  ]

  const vorher = gerufen.length

  for (const name of schraeg) {
    await assert.rejects(() => Datenbank.rufe(name, {}), `${name} haette abgewiesen werden muessen`)
  }

  assert.equal(gerufen.length, vorher, 'nichts davon ist im Netz gelandet')
})

test('die Vorsilbe steht als Wert zur Verfuegung', () => {
  // Damit die lebende Pruefung und pruefe.mjs denselben Wert benutzen koennen
  // und nicht jeder seinen eigenen mitbringt.
  assert.equal(Datenbank.VORSILBE, 'kombi_')
})
