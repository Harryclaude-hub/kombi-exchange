# -*- coding: utf-8 -*-
"""
Baut die vier Symbole des Programms als PNG.

WOZU

Ein installiertes Programm braucht ein Bild. Android nimmt es fuer den
Startbildschirm, Windows fuer die Verknuepfung, und das iPhone liest die
Symbole aus dem Manifest ueberhaupt nicht, sondern nur aus
<link rel="apple-touch-icon">. Ein SVG allein reicht deshalb nicht, so gern man
es haette.

WARUM VON HAND UND NICHT MIT EINER BIBLIOTHEK

Dieses Projekt hat keinen Bauschritt und keine Abhaengigkeiten. Auf dem Rechner
liegt zwar Pillow, aber ein Werkzeug, das nur laeuft, solange zufaellig etwas
installiert ist, ist kein Werkzeug. PNG von Hand zu schreiben kostet achtzig
Zeilen und braucht nur zlib, und zlib ist in jedem Python dabei.

WANN ES LAEUFT

Von Hand, wenn sich das Symbol aendert:

    python werkzeug/symbole_bauen.py

Das Ergebnis wird eingecheckt. Beim Veroeffentlichen laeuft hier nichts.

DIE FARBEN KOMMEN AUS DER DESIGNSCHICHT

Sie werden aus stil/marken.css gelesen und nicht hier hingeschrieben. Sonst
haette das Programm zwei Wahrheiten ueber sein Gruen, und die eine liefe
irgendwann von der anderen weg (Projektregel 8).
"""

import io
import os
import re
import struct
import sys
import zlib

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIEL = os.path.join(WURZEL, 'symbole')

# Die Zeichnung, in einem Feld von 32 mal 32, genau wie das Zeichen im Reiter
# in index.html. Ein Streckenzug, der von links unten nach rechts oben steigt.
STRECKENZUG = [(6.0, 22.0), (11.0, 14.0), (16.0, 18.0), (26.0, 7.0)]
STRICHBREITE = 2.6
ECKRUNDUNG = 6.0
FELD = 32.0

# Wie fein je Bildpunkt abgetastet wird. Vier mal vier ergibt sechzehn Proben,
# und damit sind die Schraegen des Hakens glatt statt treppenfoermig.
UEBERABTASTUNG = 4


def farbe_aus_css(name):
    """Holt eine Farbe aus dem ERSTEN Block von stil/marken.css.

    Der erste Block ist der dunkle. Weiter unten stehen dieselben Namen noch
    einmal fuer den hellen Anstrich, und die will hier niemand: ein Symbol auf
    dem Startbildschirm wechselt seine Farbe nicht mit der Tageszeit.
    """
    pfad = os.path.join(WURZEL, 'stil', 'marken.css')
    with io.open(pfad, encoding='utf-8') as datei:
        text = datei.read()
    treffer = re.search(r'--' + re.escape(name) + r':\s*#([0-9a-fA-F]{6})\s*;', text)
    if not treffer:
        raise SystemExit('In stil/marken.css steht kein --%s.' % name)
    roh = treffer.group(1)
    return (int(roh[0:2], 16), int(roh[2:4], 16), int(roh[4:6], 16))


def abstand_zur_strecke(px, py, ax, ay, bx, by):
    """Kuerzester Abstand eines Punktes zu einer Strecke, nicht zur Geraden."""
    dx = bx - ax
    dy = by - ay
    laenge = dx * dx + dy * dy
    if laenge == 0.0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = ((px - ax) * dx + (py - ay) * dy) / laenge
    t = max(0.0, min(1.0, t))
    nx = ax + t * dx
    ny = ay + t * dy
    return ((px - nx) ** 2 + (py - ny) ** 2) ** 0.5


def abstand_zum_zug(px, py, zug):
    return min(
        abstand_zur_strecke(px, py, zug[i][0], zug[i][1], zug[i + 1][0], zug[i + 1][1])
        for i in range(len(zug) - 1)
    )


def in_abgerundetem_feld(px, py, seite, rundung):
    """Liegt der Punkt innerhalb des abgerundeten Vierecks?"""
    if rundung <= 0:
        return 0.0 <= px <= seite and 0.0 <= py <= seite
    innen_x = min(max(px, rundung), seite - rundung)
    innen_y = min(max(py, rundung), seite - rundung)
    if px == innen_x or py == innen_y:
        return 0.0 <= px <= seite and 0.0 <= py <= seite
    return ((px - innen_x) ** 2 + (py - innen_y) ** 2) ** 0.5 <= rundung


def male(groesse, grund, strich, maskiert):
    """Malt ein Symbol und gibt die Bildzeilen als Liste von Bytes zurueck.

    maskiert heisst: Android legt seine eigene Form darueber und schneidet alles
    ausserhalb weg. Dann muss die Flaeche bis in jede Ecke gehen, und die
    Zeichnung muss weit genug innen bleiben, sonst ist der Haken abgeschnitten.
    """
    # Bei maskiert wird die Zeichnung auf 62,5 Prozent geschrumpft und mittig
    # gesetzt. Sie liegt damit vollstaendig im inneren Kreis mit 80 Prozent
    # Durchmesser, den Android garantiert stehen laesst.
    if maskiert:
        zeichen_massstab = 0.625
        rundung = 0.0
    else:
        zeichen_massstab = 1.0
        rundung = ECKRUNDUNG * groesse / FELD

    versatz = (1.0 - zeichen_massstab) / 2.0 * FELD
    halbe_breite = STRICHBREITE / 2.0

    # Von Bildpunkt nach Zeichenfeld: das Feld ist FELD breit, das Bild groesse.
    je_punkt = FELD / groesse
    teil = 1.0 / UEBERABTASTUNG

    zeilen = []
    for y in range(groesse):
        zeile = bytearray()
        for x in range(groesse):
            rot = gruen = blau = alpha = 0.0
            for uy in range(UEBERABTASTUNG):
                for ux in range(UEBERABTASTUNG):
                    # Mitte der Unterprobe, in Bildpunkten.
                    bx = x + (ux + 0.5) * teil
                    by = y + (uy + 0.5) * teil
                    # Dasselbe im Zeichenfeld.
                    fx = bx * je_punkt
                    fy = by * je_punkt

                    if not in_abgerundetem_feld(bx, by, float(groesse), rundung):
                        continue

                    # Die Zeichnung sitzt versetzt und geschrumpft im Feld.
                    zx = (fx - versatz) / zeichen_massstab
                    zy = (fy - versatz) / zeichen_massstab
                    auf_dem_haken = abstand_zum_zug(zx, zy, STRECKENZUG) <= halbe_breite

                    quelle = strich if auf_dem_haken else grund
                    rot += quelle[0]
                    gruen += quelle[1]
                    blau += quelle[2]
                    alpha += 255.0

            proben = float(UEBERABTASTUNG * UEBERABTASTUNG)
            if alpha == 0.0:
                zeile += bytes((0, 0, 0, 0))
                continue
            # Die Farbe wird ueber die DECKENDEN Proben gemittelt, die
            # Durchsichtigkeit ueber alle. Sonst zieht der leere Rand die Farbe
            # der Kante nach Schwarz, und das Symbol bekommt einen dunklen Saum.
            gewicht = alpha / 255.0
            zeile += bytes(
                (
                    int(round(rot / gewicht)),
                    int(round(gruen / gewicht)),
                    int(round(blau / gewicht)),
                    int(round(alpha / proben)),
                )
            )
        zeilen.append(bytes(zeile))
    return zeilen


def stueck(art, inhalt):
    """Ein PNG-Stueck: Laenge, Art, Inhalt, Pruefsumme."""
    roh = art + inhalt
    return struct.pack('>I', len(inhalt)) + roh + struct.pack('>I', zlib.crc32(roh) & 0xFFFFFFFF)


def schreibe_png(pfad, groesse, zeilen):
    kopf = struct.pack('>IIBBBBB', groesse, groesse, 8, 6, 0, 0, 0)  # 8 Bit, RGBA
    # Jede Bildzeile bekommt ein Filterbyte davor. 0 heisst: kein Filter.
    roh = b''.join(b'\x00' + zeile for zeile in zeilen)
    daten = (
        b'\x89PNG\r\n\x1a\n'
        + stueck(b'IHDR', kopf)
        + stueck(b'IDAT', zlib.compress(roh, 9))
        + stueck(b'IEND', b'')
    )
    with io.open(pfad, 'wb') as datei:
        datei.write(daten)
    return len(daten)


def main():
    grund = farbe_aus_css('grund-tief')
    strich = farbe_aus_css('gut')
    print('Farben aus stil/marken.css: Flaeche #%02x%02x%02x, Zeichen #%02x%02x%02x' % (grund + strich))

    if not os.path.isdir(ZIEL):
        os.makedirs(ZIEL)

    auftraege = [
        ('symbol-192.png', 192, False),
        ('symbol-512.png', 512, False),
        ('symbol-512-maskiert.png', 512, True),
        ('symbol-180.png', 180, False),
    ]

    for name, groesse, maskiert in auftraege:
        zeilen = male(groesse, grund, strich, maskiert)
        bytes_geschrieben = schreibe_png(os.path.join(ZIEL, name), groesse, zeilen)
        print('  %-26s %4d x %-4d %7d Bytes%s' % (
            name, groesse, groesse, bytes_geschrieben, '  (maskierbar)' if maskiert else ''
        ))

    print('Fertig. Die Dateien gehoeren eingecheckt, sie werden nicht erzeugt beim Veroeffentlichen.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
