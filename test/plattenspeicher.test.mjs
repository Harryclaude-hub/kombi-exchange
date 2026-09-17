import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Der Dateiname, unter dem ein Foto auf der Platte landet.
 *
 * Karam am 17.09.2026: "Du musst wirklich sicherstellen, dass der Speicherplatz
 * immer optimal gespeichert wird. Dass der Nutzer immer seine Fotos irgendwo
 * hat. Also am besten noch auf dem Desktop, den er gerade nutzt."
 *
 * DIE GEFAHR AN DIESER STELLE IST DAS UEBERSCHREIBEN.
 *
 * Bildschirmfotos heissen bei jedem gleich: "Screenshot.png", "Bild.jpg",
 * "Screenshot 2026-09-17 um 12.04.55.png". Wer sechzig davon an einem Spieltag
 * in denselben Ordner schreibt, hat am Ende eines, wenn der Name nicht
 * eindeutig ist. Das waere genau der stille Verlust, gegen den der ganze Ordner
 * gedacht ist.
 *
 * Deshalb traegt jeder Name die Kennung des Bildes. Sie ist eine UUID und kommt
 * kein zweites Mal vor.
 *
 * DIE ZWEITE GEFAHR IST DER PFAD. Ein Dateiname, der aus einem Bild kommt, ist
 * fremder Text. Enthielte er Schraegstriche oder zwei Punkte, liesse sich damit
 * aus dem gewaehlten Ordner herausschreiben. getFileHandle wuerde das zwar
 * ablehnen, aber sich darauf zu verlassen waere die falsche Reihenfolge: was
 * nie hineinkommt, muss auch nicht abgefangen werden.
 */

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

const Platte = await import('../daten/plattenspeicher.js')

test('zwei gleich benannte Bildschirmfotos ueberschreiben sich NICHT', () => {
  const a = Platte.dateinameFuer({ id: 'aaa-111', dateiname: 'Screenshot.png' })
  const b = Platte.dateinameFuer({ id: 'bbb-222', dateiname: 'Screenshot.png' })
  assert.notEqual(a, b)
  assert.ok(a.includes('aaa-111'))
  assert.ok(b.includes('bbb-222'))
})

test('der lesbare Teil des Namens bleibt erhalten', () => {
  // Wer den Ordner im Dateimanager aufmacht, soll sein Foto wiedererkennen.
  const name = Platte.dateinameFuer({
    id: 'abc-123',
    dateiname: 'Screenshot 2026-09-17 um 12.04.55.png',
  })
  assert.ok(name.startsWith('Screenshot 2026-09-17 um 12'), name)
  assert.ok(name.endsWith('.png'), name)
})

test('kein Schraegstrich und kein Punktpunkt kommen durch', () => {
  const name = Platte.dateinameFuer({ id: 'ddd', dateiname: '../../woanders/bild.jpg' })
  assert.ok(!name.includes('/'), name)
  assert.ok(!name.includes('\\'), name)
  assert.ok(!name.includes('..'), name)
  assert.ok(name.endsWith('.jpg'), name)
})

test('ohne Dateinamen entsteht trotzdem ein brauchbarer', () => {
  const name = Platte.dateinameFuer({ id: 'ccc', dateiname: '' })
  assert.equal(name, 'bild__ccc.png')
})

test('eine unsinnige Endung wird zu png', () => {
  // Ein Dateiname wie "bild.tar.gz " oder "foto." darf keinen leeren oder
  // seltsamen Anhang ergeben.
  assert.ok(Platte.dateinameFuer({ id: 'e1', dateiname: 'foto.' }).endsWith('.png'))
  assert.ok(Platte.dateinameFuer({ id: 'e2', dateiname: 'foto.PNG' }).endsWith('.png'))
})

test('ein sehr langer Name wird gekuerzt, die Kennung bleibt', () => {
  const lang = 'x'.repeat(300)
  const name = Platte.dateinameFuer({ id: 'lang-1', dateiname: `${lang}.png` })
  assert.ok(name.length < 120, `zu lang: ${name.length}`)
  assert.ok(name.includes('lang-1'))
})

test('ohne gewaehlten Ordner wird nichts behauptet und nichts geworfen', async () => {
  // Das Sichern darf das Aufnehmen NIE aufhalten. Faellt es aus, sagt es das,
  // statt eine Ausnahme nach oben zu werfen.
  const ergebnis = await Platte.sichere({ id: 'x', dateiname: 'a.png', inhalt: { size: 10 } })
  assert.equal(ergebnis.geschrieben, false)
  assert.match(ergebnis.grund, /Ordner/)
})

test('ohne Inhalt wird nichts geschrieben', async () => {
  const ergebnis = await Platte.sichere({ id: 'y', dateiname: 'a.png', inhalt: null })
  assert.equal(ergebnis.geschrieben, false)
  assert.equal(ergebnis.grund, 'kein Inhalt')
})

test('ohne Browserunterstuetzung sagt das Modul es, statt zu raten', () => {
  // In node gibt es kein showDirectoryPicker. Genau so ist es in Firefox und
  // Safari, und das Programm muss dort einen anderen Weg anbieten.
  assert.equal(Platte.moeglich(), false)
})
