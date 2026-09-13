-- Kombi Exchange: Grundgeruest der Datenbank
--
-- Aufbau in drei Schichten, damit ohne Anmeldung trotzdem nichts offen liegt:
--
--   1. Alle Tabellen liegen im Schema "kombi". Dieses Schema wird der Programmierschnittstelle
--      NICHT bekannt gemacht. Damit ist von aussen keine Tabelle direkt erreichbar.
--   2. Zusaetzlich ist auf jeder Tabelle der Zeilenschutz eingeschaltet, ohne eine einzige
--      Regel. Selbst wenn das Schema versehentlich freigegeben wuerde, kaeme niemand heran.
--   3. Der einzige Weg hinein sind Funktionen im Schema "public", die mit den Rechten ihres
--      Besitzers laufen und als erstes den Sitzungsschluessel pruefen.
--
-- Geld wird ueberall in ganzen Cent als bigint gespeichert. Kommazahlen wuerden sich
-- ueber hunderte Scheine hinweg zu sichtbaren Rundungsfehlern aufsummieren.
--
-- Jede Funktion setzt "set search_path = ''". Das verlangt der Sicherheitspruefer von
-- Supabase. Die Folge ist, dass wirklich JEDER Verweis mit Schema geschrieben werden muss,
-- auch die Verschluesselungsfunktionen, die bei Supabase im Schema "extensions" liegen.

create schema if not exists kombi;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

-- Der Sperrcode. Gespeichert wird nur der Fingerabdruck, nie der Code selbst.
create table if not exists kombi.zugangscodes (
  id           uuid primary key default gen_random_uuid(),
  code_hash    text        not null,
  name         text        not null default 'Hauptcode',
  aktiv        boolean     not null default true,
  angelegt_am  timestamptz not null default now()
);

-- Offene Sitzungen. Gespeichert wird nur der Fingerabdruck des Schluessels.
create table if not exists kombi.sitzungen (
  token_hash      text primary key,
  angelegt_am     timestamptz not null default now(),
  laeuft_ab_am    timestamptz not null,
  letzter_zugriff timestamptz not null default now()
);

create index if not exists sitzungen_ablauf_idx on kombi.sitzungen (laeuft_ab_am);

-- Anmeldeversuche, gegen das Durchprobieren des Codes.
create table if not exists kombi.versuche (
  id        bigserial primary key,
  herkunft  text        not null,
  zeitpunkt timestamptz not null default now(),
  erfolg    boolean     not null
);

create index if not exists versuche_herkunft_zeit_idx on kombi.versuche (herkunft, zeitpunkt desc);

create table if not exists kombi.projekte (
  id          uuid primary key,
  name        text        not null,
  notiz       text        not null default '',
  waehrung    text        not null default 'UNBEKANNT',
  angelegt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create table if not exists kombi.bilder (
  id          uuid primary key,
  projekt_id  uuid        not null references kombi.projekte (id) on delete cascade,
  dateiname   text        not null default '',
  breite      integer     not null default 0,
  hoehe       integer     not null default 0,
  pruefsumme  text        not null default '',
  buchmacher  text,
  konto       text,
  -- Das Bild selbst wird bewusst NICHT hier abgelegt. Es bleibt im Browser.
  -- Nur wenn der Nutzer es ausdruecklich teilen will, wandert es in den Speicher.
  adresse     text,
  angelegt_am timestamptz not null default now()
);

create index if not exists bilder_projekt_idx on kombi.bilder (projekt_id);
create index if not exists bilder_pruefsumme_idx on kombi.bilder (projekt_id, pruefsumme);

create table if not exists kombi.riesenscheine (
  id           uuid primary key,
  projekt_id   uuid        not null references kombi.projekte (id) on delete cascade,
  name         text        not null default '',
  signatur     text        not null default '',
  schein_ids   uuid[]      not null default '{}',
  notiz        text        not null default '',
  angelegt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index if not exists riesenscheine_projekt_idx on kombi.riesenscheine (projekt_id);
create index if not exists riesenscheine_signatur_idx on kombi.riesenscheine (projekt_id, signatur);

create table if not exists kombi.scheine (
  id             uuid primary key,
  projekt_id     uuid not null references kombi.projekte (id) on delete cascade,
  gruppe_id      uuid,
  bild_id        uuid,

  -- Herausgezogene Spalten, damit sich danach suchen und sortieren laesst.
  buchmacher     text,
  konto          text,
  schein_nr      text,
  waehrung       text not null default 'UNBEKANNT',
  status         text not null default 'unbekannt',
  gesetzt_am     timestamptz,
  einsatz_cent   bigint,
  auszahlung_cent bigint,
  ausgezahlt_cent bigint,
  quote_dezimal  numeric(12, 6),
  signatur       text not null default '',
  gratiswette    boolean not null default false,
  each_way       boolean not null default false,
  ausgeschlossen boolean not null default false,

  -- Der vollstaendige Schein, so wie ihn das Programm kennt. Damit gehen auch
  -- Felder nicht verloren, die spaeter dazukommen.
  daten          jsonb not null,

  angelegt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now()
);

create index if not exists scheine_projekt_idx on kombi.scheine (projekt_id);
create index if not exists scheine_gruppe_idx on kombi.scheine (gruppe_id);
create index if not exists scheine_signatur_idx on kombi.scheine (projekt_id, signatur);
create index if not exists scheine_buchmacher_idx on kombi.scheine (projekt_id, buchmacher);
-- Derselbe Schein darf beim selben Anbieter und Konto nur einmal vorkommen.
create unique index if not exists scheine_doppel_idx
  on kombi.scheine (projekt_id, lower(coalesce(buchmacher, '')), lower(coalesce(konto, '')), waehrung, schein_nr)
  where schein_nr is not null and schein_nr <> '';

-- Dritte Schicht: Zeilenschutz an, keine Regel. Nichts geht ohne die Funktionen unten.
alter table kombi.zugangscodes  enable row level security;
alter table kombi.sitzungen     enable row level security;
alter table kombi.versuche      enable row level security;
alter table kombi.projekte      enable row level security;
alter table kombi.bilder        enable row level security;
alter table kombi.riesenscheine enable row level security;
alter table kombi.scheine       enable row level security;

-- Erste Schicht: das Schema bleibt fuer die Aussenwelt zu.
revoke all on schema kombi from anon, authenticated;
revoke all on all tables in schema kombi from anon, authenticated;
revoke all on all sequences in schema kombi from anon, authenticated;
alter default privileges in schema kombi revoke all on tables from anon, authenticated;
alter default privileges in schema kombi revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen im Schema kombi. Von aussen nicht aufrufbar.
-- ---------------------------------------------------------------------------

-- Woher kommt der Aufruf. Die erste Stelle in x-forwarded-for waere frei waehlbar
-- und damit als Sperre wertlos. cf-connecting-ip wird vom Netz davor gesetzt.
create or replace function kombi.herkunft()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  kopfzeilen json;
  wert text;
begin
  begin
    kopfzeilen := current_setting('request.headers', true)::json;
  exception when others then
    return 'unbekannt';
  end;

  if kopfzeilen is null then
    return 'unbekannt';
  end if;

  wert := kopfzeilen ->> 'cf-connecting-ip';
  if wert is not null and wert <> '' then
    return wert;
  end if;

  -- Ersatzweise die LETZTE Stelle in x-forwarded-for, die vom eigenen Netz stammt.
  wert := kopfzeilen ->> 'x-forwarded-for';
  if wert is not null and wert <> '' then
    return trim(split_part(wert, ',', array_length(string_to_array(wert, ','), 1)));
  end if;

  return 'unbekannt';
end;
$$;

-- Prueft einen Sitzungsschluessel und verlaengert ihn bei Erfolg.
create or replace function kombi.sitzung_gueltig(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  fingerabdruck text;
  gefunden boolean;
begin
  if p_token is null or length(p_token) < 32 then
    return false;
  end if;

  fingerabdruck := encode(extensions.digest(p_token, 'sha256'), 'hex');

  update kombi.sitzungen
     set letzter_zugriff = now()
   where token_hash = fingerabdruck
     and laeuft_ab_am > now()
  returning true into gefunden;

  return coalesce(gefunden, false);
end;
$$;

-- Wirft ab, wenn der Schluessel nicht gilt. Wird von jeder Datenfunktion zuerst gerufen.
create or replace function kombi.verlange_sitzung(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not kombi.sitzung_gueltig(p_token) then
    raise exception 'Kein gueltiger Zugang. Bitte den Code erneut eingeben.'
      using errcode = '28000';
  end if;
end;
$$;

-- Raeumt auf. Wird bei jedem Einloesen nebenbei mitgemacht, damit keine
-- Zeitsteuerung noetig ist, die man einrichten und vergessen kann.
create or replace function kombi.aufraeumen()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from kombi.sitzungen where laeuft_ab_am < now() - interval '1 day';
  delete from kombi.versuche  where zeitpunkt   < now() - interval '7 days';
end;
$$;

-- ---------------------------------------------------------------------------
-- Die einzige Tuer nach draussen: Funktionen im Schema public.
-- ---------------------------------------------------------------------------

-- Code einloesen und einen Sitzungsschluessel bekommen.
drop function if exists public.kombi_code_einloesen(text);
create function public.kombi_code_einloesen(p_code text)
returns table (token text, laeuft_ab timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  woher text;
  fehlversuche integer;
  treffer boolean := false;
  neuer_token text;
  ablauf timestamptz;
begin
  woher := kombi.herkunft();

  select count(*) into fehlversuche
    from kombi.versuche
   where herkunft = woher
     and erfolg = false
     and zeitpunkt > now() - interval '15 minutes';

  if fehlversuche >= 10 then
    insert into kombi.versuche (herkunft, erfolg) values (woher, false);
    raise exception 'Zu viele Fehlversuche. Bitte in 15 Minuten noch einmal probieren.'
      using errcode = '53400';
  end if;

  -- Immer genau einen Vergleich rechnen, auch wenn es gar keinen Code gibt.
  -- Sonst liesse sich an der Antwortzeit ablesen, ob ein Code existiert.
  select exists (
    select 1
      from kombi.zugangscodes z
     where z.aktiv
       and z.code_hash = extensions.crypt(coalesce(p_code, ''), z.code_hash)
  ) into treffer;

  insert into kombi.versuche (herkunft, erfolg) values (woher, treffer);

  if not treffer then
    raise exception 'Der Code stimmt nicht.' using errcode = '28P01';
  end if;

  perform kombi.aufraeumen();

  neuer_token := encode(extensions.gen_random_bytes(32), 'hex');
  ablauf := now() + interval '30 days';

  insert into kombi.sitzungen (token_hash, laeuft_ab_am)
  values (encode(extensions.digest(neuer_token, 'sha256'), 'hex'), ablauf);

  return query select neuer_token, ablauf;
end;
$$;

-- Prueft, ob ein gemerkter Schluessel noch gilt.
drop function if exists public.kombi_sitzung_pruefen(text);
create function public.kombi_sitzung_pruefen(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return kombi.sitzung_gueltig(p_token);
end;
$$;

-- Projekte lesen.
drop function if exists public.kombi_projekte_lesen(text);
create function public.kombi_projekte_lesen(p_token text)
returns setof kombi.projekte
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kombi.sitzung_gueltig(p_token) then
    raise exception 'Kein gueltiger Zugang.' using errcode = '28000';
  end if;
  return query
    select * from kombi.projekte order by geaendert_am desc limit 500;
end;
$$;

-- Projekt anlegen oder aendern.
drop function if exists public.kombi_projekt_speichern(text, jsonb);
create function public.kombi_projekt_speichern(p_token text, p_projekt jsonb)
returns kombi.projekte
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  heraus kombi.projekte;
begin
  perform kombi.verlange_sitzung(p_token);

  insert into kombi.projekte (id, name, notiz, waehrung, angelegt_am, geaendert_am)
  values (
    (p_projekt ->> 'id')::uuid,
    coalesce(p_projekt ->> 'name', 'Ohne Namen'),
    coalesce(p_projekt ->> 'notiz', ''),
    coalesce(p_projekt ->> 'waehrung', 'UNBEKANNT'),
    coalesce((p_projekt ->> 'angelegtAm')::timestamptz, now()),
    now()
  )
  on conflict (id) do update
    set name = excluded.name,
        notiz = excluded.notiz,
        waehrung = excluded.waehrung,
        geaendert_am = now()
  returning * into heraus;

  return heraus;
end;
$$;

drop function if exists public.kombi_projekt_loeschen(text, uuid);
create function public.kombi_projekt_loeschen(p_token text, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform kombi.verlange_sitzung(p_token);
  delete from kombi.projekte where id = p_id;
end;
$$;

-- Scheine lesen, immer mit Grenze. Ohne Grenze laeuft die Antwort in den Zeitablauf.
drop function if exists public.kombi_scheine_lesen(text, uuid, integer, integer);
create function public.kombi_scheine_lesen(
  p_token text,
  p_projekt uuid,
  p_limit integer default 500,
  p_offset integer default 0
)
returns table (id uuid, gruppe_id uuid, daten jsonb, geaendert_am timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kombi.sitzung_gueltig(p_token) then
    raise exception 'Kein gueltiger Zugang.' using errcode = '28000';
  end if;

  return query
    select s.id, s.gruppe_id, s.daten, s.geaendert_am
      from kombi.scheine s
     where s.projekt_id = p_projekt
     order by s.angelegt_am asc, s.id asc
     limit least(greatest(coalesce(p_limit, 500), 1), 1000)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Scheine speichern. Der Aufrufer teilt in Haeppchen von hoechstens 500 Stueck.
drop function if exists public.kombi_scheine_speichern(text, uuid, jsonb);
create function public.kombi_scheine_speichern(p_token text, p_projekt uuid, p_scheine jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  anzahl integer := 0;
begin
  perform kombi.verlange_sitzung(p_token);

  if jsonb_typeof(p_scheine) <> 'array' then
    raise exception 'Es wurde keine Liste von Scheinen uebergeben.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_scheine) > 500 then
    raise exception 'Hoechstens 500 Scheine auf einmal.' using errcode = '22023';
  end if;

  insert into kombi.scheine (
    id, projekt_id, gruppe_id, bild_id,
    buchmacher, konto, schein_nr, waehrung, status, gesetzt_am,
    einsatz_cent, auszahlung_cent, ausgezahlt_cent, quote_dezimal,
    signatur, gratiswette, each_way, ausgeschlossen, daten, geaendert_am
  )
  select
    (e ->> 'id')::uuid,
    p_projekt,
    nullif(e ->> 'gruppeId', '')::uuid,
    nullif(e ->> 'bildId', '')::uuid,
    nullif(e -> 'buchmacher' ->> 'wert', ''),
    nullif(e -> 'konto' ->> 'wert', ''),
    nullif(e -> 'scheinNr' ->> 'wert', ''),
    coalesce(e -> 'waehrung' ->> 'wert', 'UNBEKANNT'),
    coalesce(e ->> 'status', 'unbekannt'),
    nullif(e -> 'gesetztAm' ->> 'wert', '')::timestamptz,
    round((nullif(e -> 'einsatz' ->> 'wert', ''))::numeric * 100)::bigint,
    round((nullif(e -> 'auszahlung' ->> 'wert', ''))::numeric * 100)::bigint,
    round((nullif(e -> 'ausgezahlt' ->> 'wert', ''))::numeric * 100)::bigint,
    (nullif(e -> 'quoteDezimal' ->> 'wert', ''))::numeric,
    coalesce(e ->> 'signatur', ''),
    coalesce((e ->> 'gratiswette')::boolean, false),
    coalesce((e ->> 'eachWay')::boolean, false),
    coalesce((e ->> 'ausgeschlossen')::boolean, false),
    e,
    now()
  from jsonb_array_elements(p_scheine) as e
  on conflict (id) do update
    set gruppe_id       = excluded.gruppe_id,
        bild_id         = excluded.bild_id,
        buchmacher      = excluded.buchmacher,
        konto           = excluded.konto,
        schein_nr       = excluded.schein_nr,
        waehrung        = excluded.waehrung,
        status          = excluded.status,
        gesetzt_am      = excluded.gesetzt_am,
        einsatz_cent    = excluded.einsatz_cent,
        auszahlung_cent = excluded.auszahlung_cent,
        ausgezahlt_cent = excluded.ausgezahlt_cent,
        quote_dezimal   = excluded.quote_dezimal,
        signatur        = excluded.signatur,
        gratiswette     = excluded.gratiswette,
        each_way        = excluded.each_way,
        ausgeschlossen  = excluded.ausgeschlossen,
        daten           = excluded.daten,
        geaendert_am    = now();

  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

drop function if exists public.kombi_schein_loeschen(text, uuid);
create function public.kombi_schein_loeschen(p_token text, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform kombi.verlange_sitzung(p_token);
  delete from kombi.scheine where id = p_id;
end;
$$;

-- Riesenscheine lesen und speichern.
drop function if exists public.kombi_riesenscheine_lesen(text, uuid);
create function public.kombi_riesenscheine_lesen(p_token text, p_projekt uuid)
returns setof kombi.riesenscheine
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kombi.sitzung_gueltig(p_token) then
    raise exception 'Kein gueltiger Zugang.' using errcode = '28000';
  end if;
  return query
    select * from kombi.riesenscheine
     where projekt_id = p_projekt
     order by angelegt_am asc
     limit 1000;
end;
$$;

drop function if exists public.kombi_riesenscheine_speichern(text, uuid, jsonb);
create function public.kombi_riesenscheine_speichern(p_token text, p_projekt uuid, p_liste jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  anzahl integer := 0;
begin
  perform kombi.verlange_sitzung(p_token);

  if jsonb_typeof(p_liste) <> 'array' then
    raise exception 'Es wurde keine Liste uebergeben.' using errcode = '22023';
  end if;

  insert into kombi.riesenscheine (id, projekt_id, name, signatur, schein_ids, notiz, geaendert_am)
  select
    (e ->> 'id')::uuid,
    p_projekt,
    coalesce(e ->> 'name', ''),
    coalesce(e ->> 'signatur', ''),
    coalesce(
      (select array_agg(x::uuid) from jsonb_array_elements_text(e -> 'scheinIds') as x),
      '{}'::uuid[]
    ),
    coalesce(e ->> 'notiz', ''),
    now()
  from jsonb_array_elements(p_liste) as e
  on conflict (id) do update
    set name = excluded.name,
        signatur = excluded.signatur,
        schein_ids = excluded.schein_ids,
        notiz = excluded.notiz,
        geaendert_am = now();

  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

-- Bilder: nur die Angaben dazu, nicht das Bild selbst.
drop function if exists public.kombi_bilder_lesen(text, uuid);
create function public.kombi_bilder_lesen(p_token text, p_projekt uuid)
returns setof kombi.bilder
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kombi.sitzung_gueltig(p_token) then
    raise exception 'Kein gueltiger Zugang.' using errcode = '28000';
  end if;
  return query
    select * from kombi.bilder where projekt_id = p_projekt order by angelegt_am asc limit 1000;
end;
$$;

drop function if exists public.kombi_bilder_speichern(text, uuid, jsonb);
create function public.kombi_bilder_speichern(p_token text, p_projekt uuid, p_liste jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  anzahl integer := 0;
begin
  perform kombi.verlange_sitzung(p_token);

  insert into kombi.bilder (id, projekt_id, dateiname, breite, hoehe, pruefsumme, buchmacher, konto, adresse)
  select
    (e ->> 'id')::uuid,
    p_projekt,
    coalesce(e ->> 'dateiname', ''),
    coalesce((e ->> 'breite')::integer, 0),
    coalesce((e ->> 'hoehe')::integer, 0),
    coalesce(e ->> 'pruefsumme', ''),
    nullif(e -> 'buchmacher' ->> 'wert', ''),
    nullif(e -> 'konto' ->> 'wert', ''),
    nullif(e ->> 'adresse', '')
  from jsonb_array_elements(p_liste) as e
  on conflict (id) do update
    set dateiname = excluded.dateiname,
        breite = excluded.breite,
        hoehe = excluded.hoehe,
        pruefsumme = excluded.pruefsumme,
        buchmacher = excluded.buchmacher,
        konto = excluded.konto,
        adresse = excluded.adresse;

  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte: nur die Funktionen sind erreichbar, sonst nichts.
-- ---------------------------------------------------------------------------

revoke all on function public.kombi_code_einloesen(text) from public;
revoke all on function public.kombi_sitzung_pruefen(text) from public;
revoke all on function public.kombi_projekte_lesen(text) from public;
revoke all on function public.kombi_projekt_speichern(text, jsonb) from public;
revoke all on function public.kombi_projekt_loeschen(text, uuid) from public;
revoke all on function public.kombi_scheine_lesen(text, uuid, integer, integer) from public;
revoke all on function public.kombi_scheine_speichern(text, uuid, jsonb) from public;
revoke all on function public.kombi_schein_loeschen(text, uuid) from public;
revoke all on function public.kombi_riesenscheine_lesen(text, uuid) from public;
revoke all on function public.kombi_riesenscheine_speichern(text, uuid, jsonb) from public;
revoke all on function public.kombi_bilder_lesen(text, uuid) from public;
revoke all on function public.kombi_bilder_speichern(text, uuid, jsonb) from public;

grant execute on function public.kombi_code_einloesen(text) to anon, authenticated;
grant execute on function public.kombi_sitzung_pruefen(text) to anon, authenticated;
grant execute on function public.kombi_projekte_lesen(text) to anon, authenticated;
grant execute on function public.kombi_projekt_speichern(text, jsonb) to anon, authenticated;
grant execute on function public.kombi_projekt_loeschen(text, uuid) to anon, authenticated;
grant execute on function public.kombi_scheine_lesen(text, uuid, integer, integer) to anon, authenticated;
grant execute on function public.kombi_scheine_speichern(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.kombi_schein_loeschen(text, uuid) to anon, authenticated;
grant execute on function public.kombi_riesenscheine_lesen(text, uuid) to anon, authenticated;
grant execute on function public.kombi_riesenscheine_speichern(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.kombi_bilder_lesen(text, uuid) to anon, authenticated;
grant execute on function public.kombi_bilder_speichern(text, uuid, jsonb) to anon, authenticated;

comment on schema kombi is
  'Daten von Kombi Exchange. Bewusst NICHT in den freigegebenen Schemata der Programmierschnittstelle. Zugriff nur ueber die Funktionen public.kombi_*.';
