-- Der Zugangscode laesst sich nicht mehr aus dem Programm heraus aendern.
--
-- Karam am 19.09.2026: "Ich will, dass du mir jetzt einen Code setzt, den man
-- nicht mehr aendern kann, ausser in diesem Chat."
--
-- Und schon am 16.09.2026, woertlich: "Bitte lass ihn nie wieder aendern,
-- okay? Der soll einfach gleich bleiben. Ausser ich schreibe das in diesen
-- Chat, ich muss diesen Code aendern."
--
-- WAS SICH AENDERT
--
-- public.kombi_code_wechseln bleibt bestehen, aber anon und authenticated
-- duerfen sie nicht mehr aufrufen. Damit ist der Knopf "Code wechseln" im
-- Programm wirkungslos, und zwar nicht erst in der Oberflaeche, sondern schon
-- an der Datenbank. Eine Sperre, die nur in der Oberflaeche steht, ist keine:
-- die Funktion war ueber /rest/v1/rpc fuer jeden erreichbar, der den
-- oeffentlichen Schluessel hat, und der steht im oeffentlichen Quelltext.
--
-- WER IHN JETZT NOCH AENDERN KANN
--
-- Nur, wer im SQL-Editor des Projekts sitzt, also Karam selbst. Der Weg dafuer
-- steht in werkzeug/code_setzen.html: der Code entsteht in seinem Browser, und
-- er fuegt den fertigen Befehl dort ein.
--
-- WARUM NICHT GELOESCHT
--
-- Ein "drop function" waere endgueltig, und die naechste Aenderung des Codes
-- braeuchte dann erst wieder eine Wanderung. Der Entzug der Rechte ist genauso
-- dicht und in einer Zeile zurueckzunehmen, falls Karam es doch anders will.

revoke all on function public.kombi_code_wechseln(text, text, text) from anon, authenticated;

comment on function public.kombi_code_wechseln(text, text, text) is
  'Wechselt den Zugangscode. Seit 0010 NICHT mehr fuer anon freigegeben: der Code wird nur noch von Hand im SQL-Editor gesetzt, siehe werkzeug/code_setzen.html.';
