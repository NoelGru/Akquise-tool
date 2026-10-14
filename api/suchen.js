// Sucht Sportanlagen in einem Gebiet über OpenStreetMap (Overpass).
// POST { gebiet: "München", ebene: "6" }  ->  { treffer: [...] }

const SERVER = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Exakte Treffer statt Suchausdruck: Overpass nutzt dafür seinen Index.
const SPORT = ['tennis','squash','badminton','padel','paddle_tennis','table_tennis',
               '10pin','bowls','beachvolleyball'];

const RAUS = ['urbansportsclub', 'facebook', 'instagram', 'google.', 'wikipedia',
              'eversports.de', 'stadt.muenchen.de'];

function abfrage(gebiet, ebene) {
  const g = String(gebiet).replace(/["\\]/g, '');
  const teile = SPORT.map(s => `  nwr["sport"="${s}"](area.a);`).join('\n');
  return `[out:json][timeout:90];
area["name"="${g}"]["admin_level"="${ebene}"]->.a;
(
${teile}
  nwr["leisure"="sports_centre"](area.a);
);
out tags center;`;
}

function domain(roh) {
  try {
    const u = new URL(roh.startsWith('http') ? roh : 'https://' + roh);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ fehler: 'Nur POST' });

  const { gebiet, ebene = '6' } = req.body || {};
  if (!gebiet) return res.status(400).json({ fehler: 'Gebiet fehlt' });

  const koerper = new URLSearchParams({ data: abfrage(gebiet, ebene) });
  let elemente = null, letzter = '';

  for (const adresse of SERVER) {
    try {
      const steuerung = new AbortController();
      const uhr = setTimeout(() => steuerung.abort(), 55000);
      const antwort = await fetch(adresse, {
        method: 'POST',
        body: koerper,
        headers: { 'User-Agent': 'akquise-tool/1.0 (Recherche)' },
        signal: steuerung.signal,
      });
      clearTimeout(uhr);
      if (!antwort.ok) {
        letzter = antwort.status === 504 || antwort.status === 429
          ? 'Der Kartendienst ist gerade ausgelastet'
          : 'HTTP ' + antwort.status;
        continue;
      }
      elemente = (await antwort.json()).elements;
      break;
    } catch (e) {
      letzter = e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e);
    }
  }

  if (!elemente) {
    return res.status(503).json({
      fehler: letzter + '. Das passiert bei dem freien Dienst öfter.',
      erneut: true,
    });
  }

  const nach = new Map();
  for (const x of elemente) {
    const t = x.tags || {};
    const web = t.website || t['contact:website'];
    if (!web || !t.name) continue;
    const d = domain(web);
    if (!d || !d.includes('.') || RAUS.some(r => d.includes(r))) continue;
    const sport = t.sport || t.leisure || '';
    const vorhanden = nach.get(d);
    if (vorhanden && vorhanden.sport.length >= sport.length) continue;
    nach.set(d, {
      name: t.name,
      domain: d,
      sport,
      strasse: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') || null,
      ort: [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ') || null,
      telefon: t.phone || t['contact:phone'] || null,
      mail: t.email || t['contact:email'] || null,
      osm_id: `${x.type}/${x.id}`,
      gebiet,
    });
  }

  res.status(200).json({ gesamt: elemente.length, treffer: [...nach.values()] });
}
