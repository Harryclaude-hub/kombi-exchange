// @ts-check
/**
 * Typen.
 *
 * Diese Datei beschreibt nur die Form der Daten. Sie enthaelt keine Logik,
 * keine Rechnung und keine Anzeige. Sie ist die einzige Stelle, an der steht,
 * welche Felder es gibt und was sie bedeuten.
 *
 * Zur Laufzeit exportiert sie nichts ausser einer Fassung. Alles andere sind
 * Beschreibungen fuer die Entwicklungsumgebung.
 */

/** Fassung der Datenform. Wird beim Speichern mitgeschrieben, damit alte Staende erkennbar sind. */
export const DATENFASSUNG = 1

/**
 * @typedef {'USD'|'EUR'|'GBP'|'CHF'|'UNBEKANNT'} Waehrung
 */

/**
 * Status eines Scheins oder einer einzelnen Auswahl.
 * @typedef {'offen'|'gewonnen'|'verloren'|'halb_gewonnen'|'halb_verloren'|'push'|'storniert'|'cashout'|'unbekannt'} Status
 */

/**
 * Woher ein Wert stammt. Wichtig, damit Handkorrekturen nie ueberschrieben werden.
 * @typedef {'ocr'|'hand'|'berechnet'|'gelernt'|'vorgabe'} Quelle
 */

/**
 * Ein einzelnes Feld mit Herkunft und Sicherheit.
 * sicherheit liegt zwischen 0 und 1. Bei Quelle 'hand' ist sie immer 1.
 *
 * @template T
 * @typedef {object} Feld
 * @property {T|null} wert
 * @property {number} sicherheit
 * @property {Quelle} quelle
 * @property {string} [roh]  Der Text, aus dem der Wert gelesen wurde.
 */

/**
 * @typedef {object} Rechteck
 * @property {number} x
 * @property {number} y
 * @property {number} breite
 * @property {number} hoehe
 */

/**
 * @typedef {object} OcrWort
 * @property {string} text
 * @property {number} sicherheit  0 bis 1.
 * @property {Rechteck} kasten
 */

/**
 * @typedef {object} OcrZeile
 * @property {string} text
 * @property {number} sicherheit
 * @property {Rechteck} kasten
 * @property {OcrWort[]} woerter
 */

/**
 * @typedef {object} OcrErgebnis
 * @property {string} text
 * @property {number} sicherheit
 * @property {OcrZeile[]} zeilen
 */

/** @typedef {'info'|'warnung'|'fehler'} Schwere */

/**
 * Ein Hinweis aus der Gegenrechnung.
 * Nichts wird stillschweigend verworfen: jeder Zweifel wird hier sichtbar gemacht.
 *
 * @typedef {object} Hinweis
 * @property {string} code
 * @property {Schwere} schwere
 * @property {string} text
 * @property {string} [feld]
 */

/**
 * Eine einzelne Auswahl, also ein Bein innerhalb eines Scheins.
 *
 * @typedef {object} Auswahl
 * @property {string} id
 * @property {Feld<string>} ereignis   Begegnung, zum Beispiel "San Francisco 49ers @ Los Angeles Rams".
 * @property {Feld<string>} markt      Wettart, zum Beispiel "WILL HAVE OVER 2.5 RECEPTIONS".
 * @property {Feld<string>} tipp       Der getippte Ausgang, zum Beispiel "Deebo Samuel".
 * @property {Feld<number>} linie      Linie oder Handicap, zum Beispiel 2.5.
 * @property {Feld<number>} quoteDezimal
 * @property {Feld<string>} ergebnis   Freitext zum Ausgang, zum Beispiel "FINAL PLAYER SCORE: 4".
 * @property {Status} status
 */

/** @typedef {'einzel'|'kombi'|'system'|'unbekannt'} Scheinart */

/**
 * Ein einzelner Wettschein, gelesen aus genau einer Karte eines Bildes.
 *
 * @typedef {object} Schein
 * @property {string} id
 * @property {string} projektId
 * @property {string|null} gruppeId    Zu welchem Riesenschein er gehoert. null heisst: noch offen.
 *
 * @property {Feld<string>} buchmacher
 * @property {Feld<string>} konto      Kontokennung, falls im Bild sichtbar.
 * @property {Feld<string>} scheinNr
 * @property {Feld<string>} gesetztAm  Zeitpunkt als ISO-Zeichenkette.
 *
 * @property {Feld<number>} einsatz    Der auf dem Schein stehende Einsatz je Einheit.
 * @property {Feld<Waehrung>} waehrung
 * @property {Feld<number>} quoteDezimal
 * @property {Feld<number>} quoteAmerikanisch  Der angezeigte Wert, gerundet wie beim Buchmacher.
 * @property {Feld<number>} auszahlung Moegliche Auszahlung einschliesslich Einsatz.
 * @property {Feld<number>} ausgezahlt Tatsaechlicher Rueckfluss bei entschiedenen Scheinen.
 *
 * @property {Status} status
 * @property {Scheinart} art
 * @property {Auswahl[]} auswahlen
 *
 * @property {boolean} gratiswette
 *   true bei einer Gratis- oder Bonuswette. Der Einsatz ist dann kein eigenes Geld und
 *   wird bei einem Gewinn nicht mit ausgezahlt. Ein solcher Schein darf weder in den
 *   Gesamteinsatz noch in das Risiko einfliessen.
 * @property {boolean} eachWay
 *   true bei einer Each-Way-Wette. Der angezeigte Einsatz wird doppelt abgebucht,
 *   einmal auf Sieg und einmal auf Platz. Der tatsaechliche Aufwand ist das Doppelte.
 *
 * @property {string} bildId
 * @property {Rechteck} ausschnitt     Bereich im Quellbild, aus dem gelesen wurde.
 * @property {number} positionImBild   Reihenfolge im Quellbild, von oben nach unten.
 *
 * @property {string} rohtext
 * @property {string[]} [lesezeilen]
 *   Die Zeilen, die leseSchein wirklich bekommen hat. rohtext ist fuer Menschen
 *   gedacht, das hier ist die genaue Eingabe. Nur gesetzt, wenn der Schein aus
 *   einem Bild stammt.
 * @property {object} [leseumgebung]
 *   Unter welchen Bedingungen gelesen wurde: Gebiet, Waehrung, Quotenformat,
 *   Bezugsmonat. Wird in werkzeug/training/ gebraucht, damit ein Pruefall
 *   spaeter unter genau denselben Bedingungen laeuft wie der Lauf, aus dem
 *   seine Wahrheit stammt. Sonst prueft er etwas anderes.
 * @property {number} ocrSicherheit
 * @property {Hinweis[]} hinweise
 * @property {boolean} vonHand         true, sobald ein Feld von Hand gesetzt wurde.
 * @property {boolean} ausgeschlossen  true, wenn der Nutzer ihn bewusst herausgenommen hat.
 * @property {string} angelegtAm       Zeitpunkt der Aufnahme. Entscheidet beim Zusammenfuehren.
 * @property {string} geaendertAm
 */

/**
 * Ein hochgeladenes Bild.
 *
 * @typedef {object} Bild
 * @property {string} id
 * @property {string} projektId
 * @property {string} dateiname
 * @property {number} breite
 * @property {number} hoehe
 * @property {string} quelle           Data-URL oder Speicheradresse.
 * @property {string} pruefsumme       Fingerabdruck der Datei, gegen doppeltes Hochladen.
 * @property {Feld<string>} buchmacher
 * @property {Feld<string>} konto
 * @property {string} angelegtAm
 */

/**
 * Der Riesenschein: dieselbe Wette, viele Male gesetzt.
 *
 * Hier werden nur Zugehoerigkeit und Handkorrekturen gespeichert. Alle Summen werden
 * bei Bedarf berechnet und nie gespeichert, damit sie nicht auseinanderlaufen koennen.
 *
 * @typedef {object} Riesenschein
 * @property {string} id
 * @property {string} projektId
 * @property {string} name
 * @property {string} signatur
 * @property {string[]} scheinIds      Reihenfolge im Riesenschein, vom Nutzer aenderbar.
 * @property {string} notiz
 * @property {string} angelegtAm
 * @property {string} geaendertAm
 */

/**
 * @typedef {object} Projekt
 * @property {string} id
 * @property {string} name
 * @property {string} notiz
 * @property {Waehrung} waehrung
 * @property {string} angelegtAm
 * @property {string} geaendertAm
 * @property {string} [ordner]
 *   In welchem Ordner der Ablage das Projekt liegt. Leer heisst: ganz oben.
 *   Ein Ordner ist nur ein Name, keine eigene Tabelle. Verschieben heisst:
 *   dieses Feld aendern. Begruendung in supabase/migrations/0008.
 * @property {boolean} [angepinnt]
 *   Angepinnte Projekte stehen in der Ablage immer oben, egal wie sortiert
 *   wird.
 * @property {number} [fassung]
 */

/**
 * Anteil eines Buchmachers an einem Riesenschein.
 *
 * @typedef {object} BuchmacherAnteil
 * @property {string} buchmacher
 * @property {number} anzahl
 * @property {number} einsatz
 * @property {number} anteil          0 bis 1.
 * @property {number} auszahlungMoeglich
 * @property {number|null} quoteSchnitt
 * @property {string[]} konten        Welche Konten bei diesem Anbieter beteiligt sind.
 */

/**
 * Die Rechnung eines Riesenscheins. Immer berechnet, nie gespeichert.
 *
 * Die Zahlen sind bewusst in drei Gruppen getrennt, die sich nie widersprechen duerfen:
 *   Was habe ich eingesetzt   einsatzGesamt, einsatzOffen, einsatzEntschieden
 *   Was ist schon passiert    auszahlungRealisiert, ergebnisRealisiert
 *   Was kann noch passieren   imRisiko, offenesPotenzial, bestenfalls, schlimmstenfalls
 *
 * @typedef {object} Rechnung
 * @property {number} anzahlScheine
 * @property {number} anzahlBuchmacher
 * @property {string[]} buchmacher
 * @property {number} anzahlKonten
 * @property {string[]} konten
 * @property {Waehrung} waehrung
 * @property {boolean} waehrungGemischt
 *
 * @property {number} einsatzGesamt        Tatsaechlicher Geldaufwand ueber alle Scheine.
 * @property {number} einsatzOffen         Aufwand der noch nicht entschiedenen Scheine.
 * @property {number} einsatzEntschieden   Aufwand der bereits entschiedenen Scheine.
 * @property {number} gratiswetteNennwert  Nennwert der Gratiswetten, zaehlt nicht als Aufwand.
 *
 * @property {number} auszahlungMoeglich   Was zurueckkaeme, wenn alles Offene gewinnt, plus das schon Realisierte.
 * @property {number} gewinnMoeglich       auszahlungMoeglich minus einsatzGesamt.
 *
 * @property {number} auszahlungRealisiert Rueckfluss aus entschiedenen Scheinen.
 * @property {number} ergebnisRealisiert   Rueckfluss minus Aufwand, beides nur aus entschiedenen Scheinen.
 * @property {number} imRisiko             Der Aufwand, der noch verloren gehen kann.
 * @property {number} offenesPotenzial     Gewinn aus den offenen Scheinen, wenn sie gewinnen.
 * @property {number} bestenfalls          Endergebnis, wenn ab jetzt alles gewinnt.
 * @property {number} schlimmstenfalls     Endergebnis, wenn ab jetzt alles verliert.
 *
 * @property {number|null} quoteEffektiv   Einsatzgewichtete Quote ueber alle Scheine.
 * @property {number|null} quoteOffen      Einsatzgewichtete Quote nur ueber die offenen Scheine.
 * @property {number|null} gewinnschwelle  Wahrscheinlichkeit, ab der sich die Position rechnet.
 *
 * @property {BuchmacherAnteil[]} proBuchmacher
 * @property {Record<Status, number>} proStatus
 * @property {Hinweis[]} hinweise
 */

/**
 * Ein Schein, der keiner Gruppe zugeordnet werden konnte. Wird immer angezeigt.
 *
 * @typedef {object} Restposten
 * @property {string} scheinId
 * @property {string} grund
 */

export default {}
