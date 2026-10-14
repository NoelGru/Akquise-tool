// Prüft Websites auf fehlende Buchung, fehlende Handy-Ansicht, HTTPS und Altlasten.
// POST { domains: ["a.de", "b.de"] }  (höchstens 12)  ->  { ergebnisse: [...] }

const KOPF = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'de-DE,de;q=0.9',
};

const ANBIETER = ['eversports', 'platzbuchung.de', 'courtbooking', 'sportsnow', 'playtomic',
                  'book-and-play', 'tennis04', 'gotcourts', 'etennis', 'clubdesk', 'supersaas'];
const WORTE = ['online buchen', 'platz buchen', 'plätze buchen', 'platz reservieren',
               'online-buchung', 'online buchung', 'jetzt buchen', 'buchungssystem',
               'belegungsplan', 'platzbelegung', 'buchungskalender'];

const TECHNIK = [
  ['Flash', /\.swf\b/], ['Frameset', /<frameset/],
  ['Tabellenlayout', /<table[^>]+(?:width=|border="?[1-9])/],
  ['jQuery 1.x', /jquery[-./](?:1\.\d)/], ['Typo3', /typo3temp|typo3conf/],
  ['Joomla', /\/media\/jui\/|com_content/], ['WordPress', /wp-content/],
  ['Jimdo', /jimdo/], ['Wix', /wix\.com|wixstatic/], ['Webnode', /webnode/],
  ['IONOS-Baukasten', /ionos|1and1/], ['Google Sites', /sites\.google\.com/],
];
const VERALTET = ['Flash', 'Frameset', 'Tabellenlayout', 'jQuery 1.x'];
const BAUKASTEN = ['Jimdo', 'Wix', 'Webnode', 'IONOS-Baukasten', 'Google Sites'];

const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TEL_LINK = /href="tel:([^"]+)"/gi;
// Wörter, deren Umfeld verrät, wie der Verein heute arbeitet.
const STICHWORTE = ['reservier', 'platzbuchung', 'belegung', 'anmeld', 'mitglied werden',
                    'aufnahmeantrag', 'formular', 'kursplan', 'schnupper'];

const ANSCHRIFT = /([A-ZÄÖÜ][\wäöüßÄÖÜ.\- ]{2,38}?(?:straße|strasse|str\.|weg|allee|platz|ring|gasse|damm)\s*\d+\s*[a-zA-Z]?)[\s,]+(\d{5})\s+([A-ZÄÖÜ][\wäöüßÄÖÜ.\- ]{2,28})/;

function entschaerfen(roh) {
  return roh.replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
            .replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function hole(url, ms = 9000) {
  const steuerung = new AbortController();
  const uhr = setTimeout(() => steuerung.abort(), ms);
  try {
    const a = await fetch(url, { headers: KOPF, redirect: 'follow', signal: steuerung.signal });
    const text = (await a.text()).slice(0, 900000);
    return { text, ziel: a.url, code: a.status };
  } finally {
    clearTimeout(uhr);
  }
}

function impressumLink(html, basis) {
  const re = /href="([^"]+)"[^>]*>([^<]{0,60})/gi;
  let m;
  while ((m = re.exec(html))) {
    const ziel = m[1], beschriftung = (m[2] || '').toLowerCase();
    if (beschriftung.includes('impressum') || ziel.toLowerCase().includes('impressum')
        || beschriftung.includes('kontakt')) {
      try { return new URL(ziel, basis).href; } catch { return null; }
    }
  }
  return null;
}

async function pruefe(d) {
  const z = { domain: d, erreichbar: false, https: false, zertifikat_ok: true, mobil: false,
              buchung: false, anbieter: null, technik: null, jahr: null, punkte: null,
              mail: null, telefon: null, strasse: null, ort: null, fehler: null,
              titel: null, beschreibung: null, stoff: null };

  let seite = null;
  try {
    seite = await hole('https://' + d);
    z.https = seite.ziel.startsWith('https://');
  } catch (e) {
    if (String(e).includes('certificate') || String(e).includes('CERT')) z.zertifikat_ok = false;
    try { seite = await hole('http://' + d); } catch (e2) { z.fehler = e2.name || 'Fehler'; }
  }
  if (!seite) return z;

  z.erreichbar = true;
  const html = seite.text;
  const tief = html.toLowerCase();

  z.mobil = /<meta[^>]+name=["']?viewport/i.test(html);
  const anbieter = ANBIETER.find(a => tief.includes(a));
  const wort = WORTE.find(w => tief.includes(w));
  z.buchung = Boolean(anbieter || wort);
  z.anbieter = anbieter || wort || null;
  const technik = TECHNIK.filter(([, muster]) => muster.test(tief)).map(([bez]) => bez);
  z.technik = technik.join(', ') || null;
  const jahre = [...tief.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,25}(20\d\d)/g)].map(m => +m[1]);
  if (jahre.length) z.jahr = Math.max(...jahre);

  // Gesprächsstoff: das, woran ein Anschreiben andocken kann.
  const titel = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titel) z.titel = entschaerfen(titel[1]).slice(0, 160);
  const besch = /<meta[^>]+name=["']?description["']?[^>]+content=["']([^"']+)/i.exec(html);
  if (besch) z.beschreibung = entschaerfen(besch[1]).slice(0, 300);

  const klartext = entschaerfen(html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
                                    .replace(/<[^>]+>/g, ' '));
  const teile = [];
  const ueber = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map(m => entschaerfen(m[1])).filter(Boolean).slice(0, 8);
  if (ueber.length) teile.push('Überschriften: ' + ueber.join(' · '));
  for (const w of STICHWORTE) {
    const t = new RegExp(`[^.!?]{0,120}${w}[^.!?]{0,120}[.!?]`, 'i').exec(klartext);
    if (t) teile.push(`„${w}“: ${t[0].trim()}`);
    if (teile.length > 6) break;
  }
  const jahreImText = [...klartext.matchAll(/\b(20[12]\d)\b/g)]
    .map(m => +m[1]).filter(j => j <= new Date().getFullYear());
  if (jahreImText.length) teile.push('Jüngstes Jahr auf der Seite: ' + Math.max(...jahreImText));
  if (/\.pdf/i.test(html)) teile.push('Es gibt PDF-Dateien, oft Anmeldeformulare zum Ausdrucken.');
  z.stoff = teile.join('\n').slice(0, 1800) || null;

  let text = html;
  const imp = impressumLink(html, seite.ziel);
  if (imp) {
    try { text += ' ' + (await hole(imp, 7000)).text; } catch { /* egal */ }
  }
  const mails = (text.match(MAIL) || []).filter(m => !/\.(png|jpe?g|gif|webp|svg)$/i.test(m));
  if (mails.length) z.mail = mails.sort((a, b) => a.length - b.length)[0];
  const tel = [...text.matchAll(TEL_LINK)].map(m => m[1].trim())
    .filter(t => (t.replace(/\D/g, '')).length >= 9);
  if (tel.length) z.telefon = tel[0];
  const adr = ANSCHRIFT.exec(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  if (adr) { z.strasse = adr[1].trim(); z.ort = `${adr[2]} ${adr[3].trim()}`; }

  let p = 0;
  if (!z.buchung) p += 4;
  if (!z.mobil) p += 4;
  if (!z.https) p += 3;
  if (!z.zertifikat_ok) p += 3;
  if (z.jahr && z.jahr <= new Date().getFullYear() - 3) p += 2;
  if (technik.some(t => VERALTET.includes(t))) p += 2;
  if (technik.some(t => BAUKASTEN.includes(t))) p += 1;
  z.punkte = p;
  return z;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ fehler: 'Nur POST' });
  const { domains } = req.body || {};
  if (!Array.isArray(domains) || !domains.length) {
    return res.status(400).json({ fehler: 'Keine Domains übergeben' });
  }
  const liste = domains.slice(0, 12);
  const ergebnisse = await Promise.all(liste.map(d => pruefe(String(d)).catch(e => ({
    domain: d, erreichbar: false, punkte: null, fehler: String(e.message || e),
  }))));
  res.status(200).json({ ergebnisse });
}
