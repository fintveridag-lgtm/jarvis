// Klikkbare "planeter" som roterer i bane rundt orbens ytterskall.
// Hover viser et infokort (delt kort-element, som overlay-panelet);
// klikk fester/løsner kortet. For å legge til en ny planet: legg til en
// oppføring i PLANETS + et /api/planets/<id>-endepunkt på serveren.

const REFRESH_MS = 10 * 60 * 1000;

function fmt(num, digits = 0) {
  return typeof num === 'number'
    ? num.toLocaleString('nb-NO', { maximumFractionDigits: digits })
    : num;
}

function renderWeather(d) {
  if (!d) return '<p class="empty">Henter været i Ålesund…</p>';
  if (d.error) return `<p class="empty error">Kunne ikke hente vær: ${d.error}</p>`;
  const hours = (d.hours || [])
    .map((h) => `<div class="wh"><span>${h.time}</span><span>${h.icon}</span><span>${h.temp}°</span></div>`)
    .join('');
  return `
    <div class="weather-main">
      <span class="weather-temp">${d.temp}°</span>
      <div>
        <div>${d.icon} ${d.condition}</div>
        <div class="dim">Føles som ${d.feelsLike}° · Vind ${d.windMs} m/s (kast ${d.gustMs})</div>
      </div>
    </div>
    ${hours ? `<div class="weather-hours">${hours}</div>` : ''}`;
}

function renderAccount(d) {
  if (!d) return '<p class="empty">Henter kontotall…</p>';
  if (d.error) return `<p class="empty error">Feil: ${d.error}</p>`;
  if (!d.configured) {
    return `<p class="empty">Kontotall er ikke lagt inn ennå.</p>
      <p class="dim">Legg feltet <code>account</code> i <code>data/claude-data.json</code> (se README), så vises saldoen her.</p>`;
  }
  const rows = d.accounts
    .map((a) => `<div class="account-row"><span>${a.name}</span><strong>${fmt(a.balance)} ${d.currency}</strong></div>`)
    .join('');
  return `
    <div class="account-total"><span class="weather-temp">${fmt(d.total)}</span><span class="dim"> ${d.currency}</span></div>
    ${rows}
    ${d.updated ? `<p class="dim" style="margin:8px 0 0">Oppdatert ${d.updated}</p>` : ''}`;
}

const PLANETS = [
  {
    id: 'weather',
    label: 'Vær — Ålesund',
    icon: '🌤️',
    endpoint: '/api/planets/weather',
    className: 'planet-weather',
    phase: 0.6,
    speed: 0.11,
    render: renderWeather,
  },
  {
    id: 'account',
    label: 'Konto',
    icon: '💰',
    endpoint: '/api/planets/account',
    className: 'planet-account',
    phase: 0.6 + Math.PI,
    speed: 0.11,
    render: renderAccount,
  },
];

let wrap = null;
let card = null;
let cardOwner = null;   // planeten kortet viser nå
let pinnedOwner = null; // planeten kortet er festet til (klikk)
let lastT = 0;

async function ensureData(p) {
  const fresh = p.fetchedAt && Date.now() - p.fetchedAt < REFRESH_MS;
  if (fresh || p.loading) return;
  p.loading = true;
  try {
    const res = await fetch(p.endpoint);
    p.data = await res.json();
    p.fetchedAt = Date.now();
  } catch (err) {
    p.data = { error: err.message };
  } finally {
    p.loading = false;
    if (cardOwner === p) renderCard(p);
  }
}

function renderCard(p) {
  card.innerHTML = `
    <h3>${p.icon} ${p.label}</h3>
    <div class="planet-card-body">${p.render(p.data)}</div>
    <p class="planet-hint">${pinnedOwner === p ? 'Festet — klikk planeten for å løsne.' : 'Klikk planeten for å feste kortet.'}</p>`;
}

function showCard(p) {
  cardOwner = p;
  renderCard(p);
  card.classList.add('visible');
  positionCard(p);
}

function hideCard() {
  cardOwner = null;
  card.classList.remove('visible');
}

function positionCard(p) {
  const rect = p.el.getBoundingClientRect();
  const margin = 14;
  const cw = card.offsetWidth || 260;
  const ch = card.offsetHeight || 160;
  let x = rect.right + margin;
  if (x + cw > window.innerWidth - 8) x = rect.left - margin - cw;
  let y = rect.top + rect.height / 2 - ch / 2;
  y = Math.max(8, Math.min(y, window.innerHeight - ch - 8));
  card.style.left = `${Math.max(8, x)}px`;
  card.style.top = `${y}px`;
}

export function initPlanets(orbWrap) {
  wrap = orbWrap;

  card = document.createElement('div');
  card.className = 'planet-card';
  document.body.appendChild(card);

  for (const p of PLANETS) {
    p.angle = p.phase;
    p.el = document.createElement('button');
    p.el.className = `planet ${p.className}`;
    p.el.setAttribute('aria-label', p.label);
    p.el.title = p.label;
    wrap.appendChild(p.el);

    p.el.addEventListener('mouseenter', () => {
      p.hovered = true;
      ensureData(p);
      if (!pinnedOwner || pinnedOwner === p) showCard(p);
    });
    p.el.addEventListener('mouseleave', () => {
      p.hovered = false;
      if (pinnedOwner !== p && cardOwner === p) {
        if (pinnedOwner) showCard(pinnedOwner);
        else hideCard();
      }
    });
    p.el.addEventListener('click', (e) => {
      e.stopPropagation();
      ensureData(p);
      if (pinnedOwner === p) {
        pinnedOwner = null;
        renderCard(p); // oppdater hint-teksten
      } else {
        pinnedOwner = p;
        showCard(p);
      }
    });
  }

  // klikk utenfor planet/kort løsner og skjuler kortet
  document.addEventListener('click', (e) => {
    if (card.contains(e.target)) return;
    if (PLANETS.some((p) => p.el.contains(e.target))) return;
    pinnedOwner = null;
    hideCard();
  });

  return PLANETS;
}

export function updatePlanets(t) {
  if (!wrap) return;
  const dt = lastT ? Math.min(t - lastT, 0.1) : 0;
  lastT = t;

  const w = wrap.offsetWidth;
  const h = wrap.offsetHeight;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.52; // rett utenfor orbens ytterskall
  const ry = h * 0.40;

  for (const p of PLANETS) {
    const frozen = p.hovered || pinnedOwner === p;
    if (!frozen) p.angle += dt * p.speed * Math.PI * 2 * 0.16;

    const x = cx + rx * Math.cos(p.angle);
    const y = cy + ry * Math.sin(p.angle);
    // dybdefølelse: litt større og klarere nederst ("nærmest" oss)
    const depth = 0.5 + 0.5 * Math.sin(p.angle);
    const scale = 0.75 + depth * 0.45;

    p.el.style.left = `${x}px`;
    p.el.style.top = `${y}px`;
    p.el.style.opacity = 0.65 + depth * 0.35;
    p.el.style.setProperty('--planet-scale', frozen ? Math.max(scale, 1.15) : scale);

    if (cardOwner === p) positionCard(p);
  }
}
