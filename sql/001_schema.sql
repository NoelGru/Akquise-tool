-- Akquise-Werkzeug: Schema
-- Alle Tabellen gehören genau einem Benutzer (besitzer), abgesichert über RLS.

create table if not exists vereine (
  id            uuid primary key default gen_random_uuid(),
  besitzer      uuid not null default auth.uid() references auth.users on delete cascade,

  -- Stammdaten
  name          text not null,
  domain        text not null,
  sport         text,
  strasse       text,
  ort           text,
  telefon       text,
  mail          text,
  gebiet        text,
  osm_id        text,

  -- Befunde aus der Prüfung
  erreichbar    boolean,
  https         boolean,
  zertifikat_ok boolean,
  mobil         boolean,
  buchung       boolean,
  anbieter      text,
  technik       text,
  jahr          integer,
  punkte        integer,
  geprueft_am   timestamptz,

  -- Vertrieb
  status        text not null default 'neu'
                check (status in ('neu','brief_raus','nachgefasst','gespraech',
                                  'angebot','kunde','kein_interesse','ungeeignet')),
  wiedervorlage date,
  notiz         text,

  angelegt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),

  unique (besitzer, domain)
);

create index if not exists vereine_besitzer_status on vereine (besitzer, status);
create index if not exists vereine_wiedervorlage   on vereine (besitzer, wiedervorlage);

create table if not exists aktivitaeten (
  id        uuid primary key default gen_random_uuid(),
  besitzer  uuid not null default auth.uid() references auth.users on delete cascade,
  verein_id uuid not null references vereine on delete cascade,
  art       text not null check (art in ('brief','anruf','mail','notiz','status')),
  text      text,
  am        timestamptz not null default now()
);

create index if not exists aktivitaeten_verein on aktivitaeten (verein_id, am desc);

create table if not exists vorlagen (
  id       uuid primary key default gen_random_uuid(),
  besitzer uuid not null default auth.uid() references auth.users on delete cascade,
  name     text not null,
  art      text not null default 'brief' check (art in ('brief','anruf','mail')),
  betreff  text,
  text     text not null,
  angelegt_am timestamptz not null default now()
);

-- geaendert_am automatisch pflegen
create or replace function tr_geaendert() returns trigger
language plpgsql as $$
begin
  new.geaendert_am := now();
  return new;
end $$;

drop trigger if exists vereine_geaendert on vereine;
create trigger vereine_geaendert before update on vereine
  for each row execute function tr_geaendert();

-- Statuswechsel landen automatisch im Verlauf
create or replace function tr_status_protokoll() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into aktivitaeten (besitzer, verein_id, art, text)
    values (new.besitzer, new.id, 'status', old.status || ' → ' || new.status);
  end if;
  return new;
end $$;

drop trigger if exists vereine_status on vereine;
create trigger vereine_status after update on vereine
  for each row execute function tr_status_protokoll();

-- Zugriffsschutz
alter table vereine      enable row level security;
alter table aktivitaeten enable row level security;
alter table vorlagen     enable row level security;

drop policy if exists vereine_eigene on vereine;
create policy vereine_eigene on vereine
  for all to authenticated using (besitzer = auth.uid()) with check (besitzer = auth.uid());

drop policy if exists aktivitaeten_eigene on aktivitaeten;
create policy aktivitaeten_eigene on aktivitaeten
  for all to authenticated using (besitzer = auth.uid()) with check (besitzer = auth.uid());

drop policy if exists vorlagen_eigene on vorlagen;
create policy vorlagen_eigene on vorlagen
  for all to authenticated using (besitzer = auth.uid()) with check (besitzer = auth.uid());
