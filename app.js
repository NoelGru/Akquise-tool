/* Akquise — Oberfläche. Vanilla JS, Daten über Supabase. */
(function () {
  'use strict';

  const sb = window.supabase.createClient(window.KONFIG.url, window.KONFIG.schluessel);

  const STATUS = [
    ['neu', 'Neu'], ['brief_raus', 'Brief raus'], ['nachgefasst', 'Nachgefasst'],
    ['gespraech', 'Gespräch'], ['angebot', 'Angebot'], ['kunde', 'Kunde'],
    ['kein_interesse', 'Kein Interesse'], ['ungeeignet', 'Ungeeignet'],
  ];
  const LABEL = Object.fromEntries(STATUS);

  const VORLAGEN = [
    {
      name: 'Brief · Online-Buchung',
      text: `{anschrift}

Online-Buchung für Ihre Plätze

Sehr geehrte Damen und Herren,

ich baue Websites und kleine Anwendungen für Vereine und kleine Betriebe und habe mir Ihre Seite {domain} angesehen. {befundsatz}

Gerade die Platzbuchung ist etwas, das Ihnen Arbeit abnehmen würde. Statt Anrufen und einem Belegungsplan an der Wand sehen Mitglieder online, was frei ist, und tragen sich selbst ein. Für Sie heißt das weniger Telefonate, für die Mitglieder weniger Rückfragen.

Ob dafür ein fertiges Buchungssystem reicht oder etwas Eigenes sinnvoller ist, hängt davon ab, wie Sie heute arbeiten. Das schaue ich mir gern einmal mit Ihnen an, unverbindlich und ohne Kosten.

Wenn Sie mögen, rufen Sie mich an oder schreiben Sie mir kurz. Sonst melde ich mich in den nächsten Wochen noch einmal telefonisch.

Mit freundlichen Grüßen

Noel Gruber
noel.gruber98@gmail.com · noelgruber.de`,
    },
    {
      name: 'Brief · Website veraltet',
      text: `{anschrift}

Ihre Website

Sehr geehrte Damen und Herren,

ich bin über Ihre Seite {domain} gestolpert. {befundsatz}

Für Ihre Mitglieder ist vor allem die Handy-Ansicht wichtig, weil die meisten unterwegs nachsehen, wann etwas stattfindet. Eine Seite, die dafür nicht gebaut ist, verliert genau dort Leute.

Ich baue solche Seiten für Vereine und kleine Betriebe, von der ersten Skizze bis online, und kümmere mich danach auf Wunsch weiter darum. Was Sie bisher haben, können wir dabei übernehmen.

Wenn das interessant klingt, melden Sie sich gern. Ein kurzes Telefonat reicht meistens, um einzuschätzen, ob es passt.

Mit freundlichen Grüßen

Noel Gruber
noel.gruber98@gmail.com · noelgruber.de`,
    },
    {
      name: 'Telefonleitfaden',
      text: `{name} · {telefon}

Einstieg
„Grüß Gott, mein Name ist Noel Gruber. Ich baue Websites für Vereine hier aus der Gegend. Ich habe gesehen, dass man bei Ihnen Plätze nicht online buchen kann. Wer kümmert sich bei Ihnen um die Website?“

Falls der Richtige dran ist
{befundsatz}
Frage: Wie läuft das heute bei Ihnen mit den Reservierungen?
Zuhören. Nicht verkaufen.

Mögliche Einwände
„Haben wir keinen Bedarf.“ → Verstehe. Wie viele Anrufe kommen denn so am Wochenende?
„Zu teuer.“ → Kommt drauf an, was es können soll. Deshalb vorher reden.
„Macht jemand aus dem Verein.“ → Gut, dann will ich dem nichts wegnehmen. Vielleicht nur die Buchung?

Ziel des Anrufs
Kein Abschluss, sondern ein Termin oder die Erlaubnis, Unterlagen zu schicken.`,
    },
  ];

  const SPORT = {
    tennis:'Tennis', squash:'Squash', badminton:'Badminton', padel:'Padel',
    paddle_tennis:'Padel', table_tennis:'Tischtennis', '10pin':'Bowling', bowls:'Kegeln',
    beachvolleyball:'Beachvolleyball', sports_centre:'Sportzentrum', ice_stock:'Eisstock',
    soccer:'Fußball', fitness:'Fitness', climbing:'Klettern', swimming:'Schwimmen',
    multi:'Mehrere Sparten', gymnastics:'Turnen', basketball:'Basketball',
    volleyball:'Volleyball', handball:'Handball', billiards:'Billard', darts:'Darts',
    shooting:'Schießen', yoga:'Yoga', boules:'Boule', skateboard:'Skateboard',
  };
  const sportText = v => (v.sport || '').split(';').filter(Boolean)
    .map(t => SPORT[t] || t.replace(/_/g, ' ')).join(', ') || '—';

  const $ = s => document.querySelector(s);
  const el = (t, k, x) => { const n = document.createElement(t); if (k) n.className = k; if (x != null) n.textContent = x; return n; };

  let alle = [], gewaehlt = null, filterStatus = '', sortierung = { feld: 'punkte', ab: true };

  /* ── Anmeldung ───────────────────────────── */
  async function start() {
    const { data } = await sb.auth.getSession();
    if (data.session) zeigeApp(); else zeigeTor();
  }
  function zeigeTor() { $('#tor').hidden = false; $('#app').hidden = true; }
  async function zeigeApp() {
    $('#tor').hidden = true; $('#app').hidden = false;
    vorlagenFuellen(); statusFuellen(); await laden();
  }

  $('#anmeldung').addEventListener('submit', async e => {
    e.preventDefault();
    const h = $('#tor-hinweis'); h.className = 'hinweis'; h.textContent = 'Moment …';
    const { error } = await sb.auth.signInWithPassword({ email: $('#mail').value.trim(), password: $('#pw').value });
    if (error) { h.className = 'hinweis fehler'; h.textContent = 'Anmeldung fehlgeschlagen.'; return; }
    h.textContent = ''; zeigeApp();
  });
  $('#knopf-abmelden').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

  /* ── Daten laden ─────────────────────────── */
  async function laden() {
    const { data, error } = await sb.from('vereine').select('*').order('punkte', { ascending: false });
    if (error) { alert('Laden fehlgeschlagen: ' + error.message); return; }
    alle = data || [];
    zeichneReiter(); zeichne();
  }

  function sichtbar() {
    const suche = $('#filter-text').value.trim().toLowerCase();
    return alle.filter(v => {
      if (filterStatus && v.status !== filterStatus) return false;
      if (!suche) return true;
      return [v.name, v.domain, v.ort, v.sport].filter(Boolean).join(' ').toLowerCase().includes(suche);
    }).sort((a, b) => {
      const f = sortierung.feld;
      let x = a[f], y = b[f];
      if (x == null) x = f === 'punkte' ? -1 : '';
      if (y == null) y = f === 'punkte' ? -1 : '';
      const r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'de');
      return sortierung.ab ? -r : r;
    });
  }

  function zeichneReiter() {
    const n = $('#reiter'); n.innerHTML = '';
    const zaehler = s => alle.filter(v => v.status === s).length;
    const mach = (wert, text, zahl) => {
      const b = el('button', null, text);
      if (zahl != null) { const z = el('span', 'zahl', zahl); b.append(z); }
      b.setAttribute('aria-pressed', filterStatus === wert);
      b.addEventListener('click', () => { filterStatus = wert; zeichneReiter(); zeichne(); });
      n.append(b);
    };
    mach('', 'Alle', alle.length);
    STATUS.forEach(([w, t]) => { const z = zaehler(w); if (z) mach(w, t, z); });
  }

  function befunde(v) {
    const b = [];
    if (v.erreichbar === false) return ['nicht erreichbar'];
    if (v.buchung === false) b.push('keine Buchung');
    if (v.mobil === false) b.push('nicht mobil');
    if (v.https === false) b.push('kein HTTPS');
    if (v.zertifikat_ok === false) b.push('Zertifikat ungültig');
    if (v.jahr && v.jahr <= new Date().getFullYear() - 3) b.push('Stand ' + v.jahr);
    if (v.technik) v.technik.split(', ').forEach(t => b.push(t));
    return b;
  }

  function zeichne() {
    const k = $('#zeilen'); k.innerHTML = '';
    const liste = sichtbar();
    $('#leer').hidden = liste.length > 0;
    const heute = new Date().toISOString().slice(0, 10);

    for (const v of liste) {
      const tr = el('tr');
      tr.setAttribute('aria-selected', gewaehlt && gewaehlt.id === v.id);

      const p = v.punkte == null ? '–' : v.punkte;
      const stufe = v.punkte >= 8 ? 'hoch' : v.punkte >= 4 ? 'mittel' : 'gut';
      const tdP = el('td', 'pkt ' + (v.punkte == null ? '' : stufe), String(p));

      const tdN = el('td');
      tdN.append(el('div', 'vname', v.name), el('div', 'vdom', v.domain));

      const tdS = el('td', null, sportText(v));
      const tdO = el('td', null, v.ort || '—');

      const tdB = el('td');
      const m = el('div', 'marken');
      befunde(v).slice(0, 4).forEach(t => {
        const s = el('span', /Buchung|mobil|HTTPS|Zertifikat|erreichbar/.test(t) ? 'warn' : '', t);
        m.append(s);
      });
      tdB.append(m);

      const tdSt = el('td');
      const chip = el('span', 'stat', LABEL[v.status] || v.status);
      chip.dataset.s = v.status; tdSt.append(chip);

      const tdW = el('td', v.wiedervorlage && v.wiedervorlage <= heute ? 'faellig' : '',
                     v.wiedervorlage ? v.wiedervorlage.split('-').reverse().join('.') : '—');

      tr.append(tdP, tdN, tdS, tdO, tdB, tdSt, tdW);
      tr.addEventListener('click', () => oeffne(v));
      k.append(tr);
    }
  }

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const f = th.dataset.sort;
      sortierung = { feld: f, ab: sortierung.feld === f ? !sortierung.ab : true };
      zeichne();
    });
  });
  $('#filter-text').addEventListener('input', zeichne);

  /* ── Detailbereich ───────────────────────── */
  function statusFuellen() {
    const s = $('#d-status'); s.innerHTML = '';
    STATUS.forEach(([w, t]) => s.append(new Option(t, w)));
  }
  function vorlagenFuellen() {
    const s = $('#d-vorlage'); s.innerHTML = '';
    VORLAGEN.forEach((v, i) => s.append(new Option(v.name, String(i))));
  }

  function befundsatz(v) {
    const t = [];
    if (v.buchung === false) t.push('Plätze lassen sich bei Ihnen online nicht buchen');
    if (v.mobil === false) t.push('die Seite ist nicht für Handys gebaut');
    if (v.https === false) t.push('sie läuft noch ohne Verschlüsselung, Browser warnen inzwischen davor');
    if (v.zertifikat_ok === false) t.push('das Sicherheitszertifikat ist abgelaufen');
    if (!t.length) return 'Mir ist aufgefallen, dass sich online keine Plätze buchen lassen.';
    if (t.length === 1) return 'Mir ist aufgefallen: ' + t[0] + '.';
    return 'Mir sind dabei ein paar Dinge aufgefallen: ' + t.slice(0, -1).join(', ') + ' und ' + t.at(-1) + '.';
  }

  function briefText(v) {
    const vorlage = VORLAGEN[Number($('#d-vorlage').value) || 0];
    const anschrift = [v.name, v.strasse, v.ort].filter(Boolean).join('\n');
    return vorlage.text
      .replaceAll('{name}', v.name)
      .replaceAll('{anschrift}', anschrift)
      .replaceAll('{domain}', v.domain)
      .replaceAll('{telefon}', v.telefon || 'keine Nummer hinterlegt')
      .replaceAll('{befundsatz}', befundsatz(v))
      .replaceAll('{datum}', new Date().toLocaleDateString('de-DE'));
  }

  function briefingText(v) {
    const zeilen = [
      `Verein: ${v.name}`,
      `Website: https://${v.domain}`,
      `Sportart: ${sportText(v)}`,
    ];
    const ort = [v.strasse, v.ort].filter(Boolean).join(', ');
    if (ort) zeilen.push(`Anschrift: ${ort}`);
    const kontakt = [v.telefon, v.mail].filter(Boolean).join(' · ');
    if (kontakt) zeilen.push(`Kontakt: ${kontakt}`);
    zeilen.push(`Befunde: ${befunde(v).join(', ') || 'keine'}`);
    if (v.titel) zeilen.push(`Seitentitel: ${v.titel}`);
    if (v.beschreibung) zeilen.push(`Selbstbeschreibung: ${v.beschreibung}`);
    if (v.stoff) zeilen.push('', 'Auf der Seite gefunden:', v.stoff);
    zeilen.push('', 'Schreib mir dazu bitte ein persönliches Anschreiben: Brief, Sie-Form, '
      + 'kurz, ohne Verkaufssprache, mit einem Aufhänger, der nur auf diesen Verein passt. '
      + 'Schau dir die Seite dafür gern selbst an.');
    return zeilen.join('\n');
  }

  async function oeffne(v) {
    gewaehlt = v;
    $('#lade').hidden = false;
    $('#d-name').textContent = v.name;
    $('#d-unter').innerHTML = `<a href="https://${v.domain}" target="_blank" rel="noopener">${v.domain} ↗</a>` +
      (v.ort ? ' · ' + v.ort : '');
    $('#d-status').value = v.status;
    $('#d-wv').value = v.wiedervorlage || '';
    $('#d-notiz').value = v.notiz || '';

    const bf = $('#d-befunde'); bf.innerHTML = '';
    befunde(v).forEach(t => bf.append(el('span', '', t)));

    const dl = $('#d-daten'); dl.innerHTML = '';
    const zeile = (k, w) => { if (!w && w !== 0) return; dl.append(el('dt', '', k), el('dd', '', String(w))); };
    zeile('Punkte', v.punkte);
    zeile('Sportart', sportText(v));
    zeile('Anschrift', [v.strasse, v.ort].filter(Boolean).join(', '));
    zeile('Telefon', v.telefon);
    zeile('E-Mail', v.mail);
    zeile('Buchung über', v.anbieter);
    zeile('Technik', v.technik);
    zeile('Geprüft', v.geprueft_am ? new Date(v.geprueft_am).toLocaleDateString('de-DE') : null);

    $('#d-brief').value = v.anschreiben || briefText(v);
    $('#d-brief-stand').textContent = v.anschreiben
      ? 'Eigener Text, gespeichert.'
      : 'Aus der Vorlage erzeugt. Sobald du hier etwas änderst, wird es gespeichert.';
    const st = $('#d-stoff');
    st.textContent = [v.titel && 'Seitentitel: ' + v.titel,
                      v.beschreibung && 'Selbstbeschreibung: ' + v.beschreibung,
                      v.stoff].filter(Boolean).join('\n') || '';
    await verlaufLaden(v.id);
    zeichne();
  }

  $('#d-vorlage').addEventListener('change', () => {
    if (!gewaehlt) return;
    $('#d-brief').value = briefText(gewaehlt);
    aendere('anschreiben', null);
    $('#d-brief-stand').textContent = 'Aus der Vorlage erzeugt.';
  });

  let briefTipp;
  $('#d-brief').addEventListener('input', e => {
    clearTimeout(briefTipp);
    briefTipp = setTimeout(() => {
      aendere('anschreiben', e.target.value);
      $('#d-brief-stand').textContent = 'Eigener Text, gespeichert.';
    }, 800);
  });

  $('#knopf-briefing').addEventListener('click', async () => {
    if (!gewaehlt) return;
    await navigator.clipboard.writeText(briefingText(gewaehlt));
    const b = $('#knopf-briefing'); b.textContent = 'Kopiert';
    setTimeout(() => (b.textContent = 'Briefing kopieren'), 1500);
  });
  $('#knopf-zu').addEventListener('click', () => { $('#lade').hidden = true; gewaehlt = null; zeichne(); });

  async function aendere(feld, wert) {
    if (!gewaehlt) return;
    const { error } = await sb.from('vereine').update({ [feld]: wert || null }).eq('id', gewaehlt.id);
    if (error) { alert('Speichern fehlgeschlagen: ' + error.message); return; }
    gewaehlt[feld] = wert || null;
    const i = alle.findIndex(x => x.id === gewaehlt.id);
    if (i >= 0) alle[i] = gewaehlt;
    zeichneReiter(); zeichne();
    if (feld === 'status') verlaufLaden(gewaehlt.id);
  }
  $('#d-status').addEventListener('change', e => aendere('status', e.target.value));
  $('#d-wv').addEventListener('change', e => aendere('wiedervorlage', e.target.value));
  let tipp; $('#d-notiz').addEventListener('input', e => {
    clearTimeout(tipp); tipp = setTimeout(() => aendere('notiz', e.target.value), 700);
  });

  async function verlaufLaden(id) {
    const { data } = await sb.from('aktivitaeten').select('*').eq('verein_id', id).order('am', { ascending: false });
    const o = $('#d-verlauf'); o.innerHTML = '';
    (data || []).forEach(a => {
      const li = el('li');
      li.append(el('time', '', new Date(a.am).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })));
      li.append(el('div', '', (a.art === 'status' ? 'Status: ' : a.art[0].toUpperCase() + a.art.slice(1) + ': ') + (a.text || '')));
      o.append(li);
    });
  }

  $('#verlauf-neu').addEventListener('submit', async e => {
    e.preventDefault();
    if (!gewaehlt) return;
    const art = $('#v-art').value, text = $('#v-text').value.trim();
    if (!text) return;
    await sb.from('aktivitaeten').insert({ verein_id: gewaehlt.id, art, text });
    $('#v-text').value = '';
    verlaufLaden(gewaehlt.id);
  });

  $('#knopf-kopieren').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('#d-brief').value);
    $('#knopf-kopieren').textContent = 'Kopiert';
    setTimeout(() => ($('#knopf-kopieren').textContent = 'Text kopieren'), 1500);
  });

  $('#knopf-drucken').addEventListener('click', () => {
    let d = document.getElementById('druckbereich');
    if (!d) { d = document.createElement('div'); d.id = 'druckbereich'; document.body.append(d); }
    d.textContent = $('#d-brief').value;
    window.print();
  });

  $('#knopf-brief-notiert').addEventListener('click', async () => {
    if (!gewaehlt) return;
    await sb.from('aktivitaeten').insert({ verein_id: gewaehlt.id, art: 'brief', text: 'Anschreiben verschickt' });
    const wv = new Date(); wv.setDate(wv.getDate() + 14);
    await aendere('status', 'brief_raus');
    await aendere('wiedervorlage', wv.toISOString().slice(0, 10));
    $('#d-wv').value = wv.toISOString().slice(0, 10);
    verlaufLaden(gewaehlt.id);
  });

  /* ── Aufrufe an die eigenen Funktionen ───── */
  async function ruf(pfad, koerper) {
    let a;
    try {
      a = await fetch(pfad, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper),
      });
    } catch (e) {
      throw new Error('Keine Verbindung zum Server.');
    }
    const roh = await a.text();
    let j = null;
    try { j = JSON.parse(roh); } catch (e) { j = null; }
    if (j === null) {
      if (a.status === 401 || a.status === 403 || /sso|authenticate/i.test(roh.slice(0, 400))) {
        throw new Error('Die Vercel-Anmeldung ist abgelaufen. Seite neu laden und erneut anmelden.');
      }
      const f = new Error(a.status === 504 || a.status === 502
        ? 'Die Suche hat zu lange gedauert.'
        : `Der Server hat keine Daten geliefert (HTTP ${a.status}).`);
      f.erneut = a.status === 504 || a.status === 502;
      throw f;
    }
    if (!a.ok) {
      const f = new Error(j.fehler || `Fehler (HTTP ${a.status}).`);
      f.erneut = Boolean(j.erneut);
      throw f;
    }
    return j;
  }

  /* ── Kartendienst, direkt aus dem Browser ──
     Bewusst nicht über eine eigene Funktion: Der freie Overpass-Dienst drosselt nach
     IP-Adresse, und die Server von Vercel teilen sich ihre Adressen mit vielen anderen.
     Aus dem Browser zählt die Adresse deines Anschlusses, die hat ihr eigenes Kontingent.
     Keine eigenen Kopfzeilen setzen, sonst verlangt der Browser eine Vorabanfrage,
     die der Dienst mit 406 ablehnt. */
  const KARTE = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  const SPORTARTEN = ['tennis', 'squash', 'badminton', 'padel', 'paddle_tennis',
                      'table_tennis', '10pin', 'bowls', 'beachvolleyball'];
  const RAUS = ['urbansportsclub', 'facebook', 'instagram', 'google.', 'wikipedia',
                'eversports.de', 'stadt.muenchen.de'];

  const warte = ms => new Promise(r => setTimeout(r, ms));

  function osmAbfrage(gebiet, ebene) {
    const g = String(gebiet).replace(/["\\]/g, '');
    const teile = SPORTARTEN.map(x => `  nwr["sport"="${x}"](area.a);`).join('\n');
    return `[out:json][timeout:90];
area["name"="${g}"]["admin_level"="${ebene}"]->.a;
(
${teile}
  nwr["leisure"="sports_centre"](area.a);
);
out tags center;`;
  }

  function osmDomain(roh) {
    try {
      const u = new URL(roh.startsWith('http') ? roh : 'https://' + roh);
      return u.hostname.toLowerCase().replace(/^www\./, '');
    } catch { return null; }
  }

  function osmAufbereiten(elemente, gebiet) {
    const nach = new Map();
    for (const x of elemente || []) {
      const t = x.tags || {};
      const web = t.website || t['contact:website'];
      if (!web || !t.name) continue;
      const d = osmDomain(web);
      if (!d || !d.includes('.') || RAUS.some(r => d.includes(r))) continue;
      const sport = t.sport || t.leisure || '';
      const da = nach.get(d);
      if (da && da.sport.length >= sport.length) continue;
      nach.set(d, {
        name: t.name, domain: d, sport,
        strasse: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') || null,
        ort: [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ') || null,
        telefon: t.phone || t['contact:phone'] || null,
        mail: t.email || t['contact:email'] || null,
        osm_id: `${x.type}/${x.id}`, gebiet,
      });
    }
    return [...nach.values()];
  }

  async function anlagenHolen(gebiet, ebene, melde) {
    const koerper = new URLSearchParams({ data: osmAbfrage(gebiet, ebene) });
    let nr = 0, grund = '';
    for (let runde = 1; runde <= 5; runde++) {
      for (const adresse of KARTE) {
        nr++;
        melde(`Frage den Kartendienst, Versuch ${nr} …`);
        try {
          const steuerung = new AbortController();
          const uhr = setTimeout(() => steuerung.abort(), 25000);
          const a = await fetch(adresse, { method: 'POST', body: koerper, signal: steuerung.signal });
          clearTimeout(uhr);
          const roh = await a.text();
          // Overpass meldet Fehler teils mit HTTP 200 und einer HTML-Seite.
          if (!a.ok || !roh.trimStart().startsWith('{')) {
            grund = !a.ok ? `Server antwortet mit HTTP ${a.status}` : 'Server meldet Überlastung';
            continue;
          }
          return osmAufbereiten(JSON.parse(roh).elements, gebiet);
        } catch (e) {
          grund = e.name === 'AbortError' ? 'Server antwortet nicht' : 'Server nicht erreichbar';
        }
      }
      if (runde < 5) {
        melde(`${grund}. Ich warte 25 Sekunden und probiere weiter, Runde ${runde} von 5 …`);
        await warte(25000);
      }
    }
    throw new Error(`Der Kartendienst ist seit mehreren Minuten überlastet (${grund}). `
      + 'Nimm so lange ein vorbereitetes Gebiet oder versuch es später noch einmal.');
  }

  /* ── Vorbereitete Gebiete ────────────────── */
  async function vorbereiteteAnbieten() {
    let liste;
    try {
      liste = await (await fetch('daten/index.json')).json();
    } catch (e) { return; }
    const k = $('#s-fertig-knoepfe'); k.innerHTML = '';
    liste.forEach(g => {
      const b = el('button', 'btn btn--klein btn--still', `${g.titel} · ${g.anzahl}`);
      b.type = 'button';
      b.addEventListener('click', () => vorbereitetesLaden(g, b));
      k.append(b);
    });
    $('#s-fertig').hidden = liste.length === 0;
  }

  async function vorbereitetesLaden(g, knopf) {
    const h = $('#s-hinweis');
    knopf.disabled = true;
    h.className = 'hinweis'; h.textContent = `${g.titel} wird geladen …`;
    try {
      const j = await (await fetch('daten/' + g.datei)).json();
      const { error } = await sb.from('vereine').upsert(j.eintraege, {
        onConflict: 'besitzer,domain', ignoreDuplicates: true,
      });
      if (error) throw new Error(error.message);
      dlg.close();
      await laden();
    } catch (e) {
      h.className = 'hinweis fehler'; h.textContent = 'Laden fehlgeschlagen: ' + e.message;
    } finally { knopf.disabled = false; }
  }

  /* ── Suche und Prüfung ───────────────────── */
  const dlg = $('#dialog-suche');
  $('#knopf-suche').addEventListener('click', () => {
    $('#s-hinweis').textContent = ''; $('#s-hinweis').className = 'hinweis';
    vorbereiteteAnbieten();
    dlg.showModal();
  });

  function fortschritt(an, anteil, text) {
    const b = $('#balken');
    b.hidden = !an;
    $('#balken-fuell').style.width = Math.round(anteil * 100) + '%';
    $('#balken-text').textContent = text || '';
  }

  $('#s-start').addEventListener('click', async () => {
    const gebiet = $('#s-gebiet').value.trim();
    if (!gebiet) return;
    const h = $('#s-hinweis'); h.className = 'hinweis'; h.textContent = 'Suche läuft, das dauert bis zu einer Minute …';
    let treffer;
    try {
      treffer = await anlagenHolen(gebiet, $('#s-ebene').value, t => {
        h.className = 'hinweis'; h.textContent = t;
      });
    } catch (e) {
      h.className = 'hinweis fehler'; h.textContent = String(e.message || e); return;
    }
    if (!treffer.length) { h.className = 'hinweis fehler'; h.textContent = 'Keine Anlagen mit Website gefunden.'; return; }

    const { error } = await sb.from('vereine').upsert(
      treffer.map(t => ({ ...t, besitzer: undefined })),
      { onConflict: 'besitzer,domain', ignoreDuplicates: true }
    );
    if (error) { h.className = 'hinweis fehler'; h.textContent = 'Speichern: ' + error.message; return; }

    dlg.close();
    await laden();
    await pruefeAlle(alle.filter(v => v.punkte == null).map(v => v.domain));
  });

  async function pruefeAlle(domains) {
    if (!domains.length) return;
    const stueck = 10;
    for (let i = 0; i < domains.length; i += stueck) {
      const teil = domains.slice(i, i + stueck);
      fortschritt(true, i / domains.length, `Prüfe Websites … ${i} von ${domains.length}`);
      try {
        const { ergebnisse } = await ruf('/api/pruefen', { domains: teil });
        for (const e of ergebnisse || []) {
          const v = alle.find(x => x.domain === e.domain);
          if (!v) continue;
          await sb.from('vereine').update({
            erreichbar: e.erreichbar, https: e.https, zertifikat_ok: e.zertifikat_ok,
            mobil: e.mobil, buchung: e.buchung, anbieter: e.anbieter, technik: e.technik,
            jahr: e.jahr, punkte: e.punkte, geprueft_am: new Date().toISOString(),
            titel: e.titel, beschreibung: e.beschreibung, stoff: e.stoff,
            telefon: v.telefon || e.telefon, mail: v.mail || e.mail,
            strasse: v.strasse || e.strasse, ort: v.ort || e.ort,
          }).eq('id', v.id);
        }
      } catch (e) { console.warn('Prüfung fehlgeschlagen', e); }
    }
    fortschritt(false, 1, '');
    await laden();
  }

  $('#knopf-neu-pruefen').addEventListener('click', () => pruefeAlle(sichtbar().map(v => v.domain)));

  /* ── Ansicht ─────────────────────────────── */
  $('#knopf-thema').addEventListener('click', () => {
    const jetzt = document.documentElement.getAttribute('data-theme');
    const dunkel = jetzt ? jetzt === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const neu = dunkel ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', neu);
    try { localStorage.setItem('theme', neu); } catch (e) {}
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#lade').hidden) { $('#lade').hidden = true; gewaehlt = null; zeichne(); }
  });

  start();
})();
