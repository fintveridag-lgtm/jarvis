import { createOrb } from './orb.js';
import { ensureAnalyser, resumeAudioContext, getAudioLevels } from './audio-analyser.js';
import { showBox, hideBox, currentBox } from './overlay.js';
import { initPlanets, updatePlanets } from './planets.js';
import './speech.js';

const canvas = document.getElementById('orbCanvas');
const orb = createOrb(canvas);
initPlanets(document.querySelector('.orb-wrap'));
const audio = document.getElementById('briefAudio');
const runBtn = document.getElementById('runBriefBtn');
const statusLine = document.getElementById('statusLine');

let cues = [];
let lastCueBox = null;

function setStatus(msg) {
  statusLine.textContent = msg;
}

function n(num) {
  return typeof num === 'number' ? num.toLocaleString('nb-NO') : num;
}

function setContent(key, html) {
  const el = document.querySelector(`[data-content="${key}"]`);
  if (el) el.innerHTML = html;
}

// ---------- box renderers ----------

function renderInstagram(ig) {
  if (!ig || !ig.configured) {
    setContent('instagram', `<p class="empty">META_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID mangler i .env.</p>`);
    return;
  }
  if (ig.error) {
    setContent('instagram', `<p class="empty error">Feil: ${ig.error}</p>`);
    return;
  }
  if (ig.mode === 'full') {
    setContent(
      'instagram',
      `<div class="stat-grid">
        <div class="stat"><span class="stat-value">${n(ig.reach)}</span><span class="stat-label">Rekkevidde</span></div>
        <div class="stat"><span class="stat-value">${n(ig.profileVisits)}</span><span class="stat-label">Profilbesøk</span></div>
        <div class="stat"><span class="stat-value">${n(ig.interactions)}</span><span class="stat-label">Interaksjoner</span></div>
        <div class="stat"><span class="stat-value">${n(ig.followers)}</span><span class="stat-label">Følgere</span></div>
      </div>`
    );
  } else {
    setContent(
      'instagram',
      `<p class="note">${ig.note}</p>
      <div class="stat-grid">
        <div class="stat"><span class="stat-value">${n(ig.followers)}</span><span class="stat-label">Følgere</span></div>
        <div class="stat"><span class="stat-value">${n(ig.mediaCount)}</span><span class="stat-label">Innlegg</span></div>
      </div>`
    );
  }
}

function renderMetaAds(m) {
  if (!m || !m.configured) {
    setContent('metaads', `<p class="empty">META_ACCESS_TOKEN / META_AD_ACCOUNT_ID mangler i .env.</p>`);
    return;
  }
  if (m.error) {
    setContent('metaads', `<p class="empty error">Feil: ${m.error}</p>`);
    return;
  }
  if (!m.campaigns || !m.campaigns.length) {
    setContent('metaads', `<p class="empty">Ingen kampanjedata siste 7 dager.</p>`);
    return;
  }
  const rows = m.campaigns
    .map(
      (c) => `<tr>
        <td>${c.campaignName}</td>
        <td>$${n(c.spend)}</td>
        <td>${n(c.result)} ${c.resultLabel.toLowerCase()}</td>
        <td>${n(c.clicks)}</td>
        <td>${c.ctr}%</td>
        <td>${c.costPerResult != null ? '$' + c.costPerResult : '—'}</td>
      </tr>`
    )
    .join('');
  setContent(
    'metaads',
    `<p class="total">Total spend: $${n(m.totalSpend)}</p>
    <table class="data-table">
      <thead><tr><th>Kampanje</th><th>Spend</th><th>Resultat</th><th>Klikk</th><th>CTR</th><th>Kost/res.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
  );
}

function catmullRomPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function buildCurveSvg(days) {
  if (!days || !days.length) return '<p class="empty">Ingen daglige data enda.</p>';
  const w = 300;
  const h = 70;
  const pad = 6;
  const max = Math.max(...days.map((d) => d.roas), 0.1);
  const pts = days.map((d, i) => {
    const x = pad + (i / Math.max(days.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (d.roas / max) * (h - pad * 2);
    return [x, y];
  });
  const path = catmullRomPath(pts);
  return `<svg class="curve" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${path}" fill="none" stroke="#0090c9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

function renderClientPerf(cp) {
  if (!cp) {
    setContent('clientperf', `<p class="empty">Ingen klientdata.</p>`);
    return;
  }
  const block = (c) => {
    if (!c.configured) {
      return `<div class="client-block"><h3>${c.name}</h3><p class="empty">Ad-konto ikke satt opp i .env (CLIENT_*_AD_ACCOUNT_ID).</p></div>`;
    }
    if (c.error) {
      return `<div class="client-block"><h3>${c.name}</h3><p class="empty error">Feil: ${c.error}</p></div>`;
    }
    return `<div class="client-block">
      <h3>${c.name}</h3>
      <div class="stat-grid">
        <div class="stat"><span class="stat-value">$${n(c.totalSales)}</span><span class="stat-label">Salg</span></div>
        <div class="stat"><span class="stat-value">${c.roas}x</span><span class="stat-label">ROAS</span></div>
        <div class="stat"><span class="stat-value">$${n(c.totalSpend)}</span><span class="stat-label">Annonsekost</span></div>
      </div>
      ${buildCurveSvg(c.days)}
    </div>`;
  };
  setContent('clientperf', block(cp.clientA) + block(cp.clientB));
}

function renderNotion(notion, available) {
  if (!available || !notion) {
    setContent('notion', `<p class="empty">Kjør morgenrutinen for å hente dagens oppgaver fra Notion.</p>`);
    return;
  }
  if (!notion.tasks || !notion.tasks.length) {
    setContent('notion', `<p class="empty">Ingen oppgaver i dag.</p>`);
    return;
  }
  setContent('notion', `<ul class="task-list">${notion.tasks.map((t) => `<li>${t}</li>`).join('')}</ul>`);
}

const WORLD_MAP_DEFS = `
  <defs>
    <filter id="dotGlow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="2.2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" /><feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="360" height="180" fill="#1c2b33" />
  <g fill="#4a6672" stroke="#5d7f8d" stroke-width="0.5">
    <path d="M50,20 L90,15 L105,35 L95,55 L70,70 L55,60 L40,45 L45,25 Z" />
    <path d="M85,80 L100,78 L110,100 L105,130 L90,138 L78,115 L80,90 Z" />
    <path d="M172,22 L195,18 L200,32 L190,45 L175,40 Z" />
    <path d="M170,50 L200,48 L208,75 L200,110 L185,125 L172,110 L165,75 Z" />
    <path d="M205,12 L300,10 L320,35 L305,60 L270,75 L230,70 L208,45 L205,25 Z" />
    <path d="M280,110 L320,108 L328,125 L310,140 L285,135 L278,120 Z" />
  </g>`;

function latLngToXY(lat, lng) {
  return { x: lng + 180, y: 90 - lat };
}

function renderWorldStage(ws, available) {
  if (!available || !ws) {
    setContent('worldstage', `<p class="empty">Kjør morgenrutinen for å hente nyheter og markedspriser.</p>`);
    return;
  }
  const markets = ws.markets || {};
  const marketRow = (label, m) => {
    if (!m) return '';
    const cls = m.changePercent >= 0 ? 'up' : 'down';
    const sign = m.changePercent >= 0 ? '+' : '';
    return `<div class="market"><span>${label}</span><strong class="${cls}">${n(m.value)} (${sign}${m.changePercent}%)</strong></div>`;
  };
  const headlines = (ws.headlines || []).slice(0, 4).map((h) => `<li>${h.title}</li>`).join('');
  const dots = (ws.headlines || [])
    .map((h) => {
      const { x, y } = latLngToXY(h.lat, h.lng);
      return `<circle class="news-dot" filter="url(#dotGlow)" cx="${x}" cy="${y}" r="2.6"><title>${h.title}</title></circle>`;
    })
    .join('');

  setContent(
    'worldstage',
    `<div class="market-grid">
      ${marketRow('S&amp;P 500', markets.sp500)}
      ${marketRow('Gull', markets.gold)}
      ${marketRow('Sølv', markets.silver)}
      ${marketRow('Bitcoin', markets.bitcoin)}
    </div>
    <svg class="world-map" viewBox="0 0 360 180" preserveAspectRatio="xMidYMid meet">
      ${WORLD_MAP_DEFS}
      ${dots}
    </svg>
    <ul class="headline-list">${headlines}</ul>`
  );
}

function renderGmail(gmail, available) {
  if (!available || !gmail) {
    setContent('gmail', `<p class="empty">Kjør morgenrutinen for å hente hastesaker fra Gmail.</p>`);
    return;
  }
  if (!gmail.urgent || !gmail.urgent.length) {
    setContent('gmail', `<p class="empty">Ingen presserende e-poster.</p>`);
    return;
  }
  setContent(
    'gmail',
    `<ul class="mail-list">${gmail.urgent
      .map(
        (m) =>
          `<li><strong>${m.from}</strong><span class="mail-subject">${m.subject}</span>${
            m.reason ? `<span class="mail-reason">${m.reason}</span>` : ''
          }</li>`
      )
      .join('')}</ul>`
  );
}

function renderBoxes(data) {
  renderInstagram(data.instagram);
  renderMetaAds(data.metaAds);
  renderClientPerf(data.clientPerformance);
  renderNotion(data.notion, data.claudeDataAvailable);
  renderWorldStage(data.worldStage, data.claudeDataAvailable);
  renderGmail(data.gmail, data.claudeDataAvailable);
}

// ---------- data + brief ----------

async function loadInitialData() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    renderBoxes(data);
  } catch (err) {
    setStatus(`Kunne ikke hente data: ${err.message}`);
  }
}

async function runBrief() {
  runBtn.disabled = true;
  setStatus('Henter data og genererer stemme…');
  ensureAnalyser(audio);
  resumeAudioContext();

  try {
    const res = await fetch('/api/brief', { method: 'POST' });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Ukjent feil');

    renderBoxes(payload.data);
    cues = payload.cues || [];
    lastCueBox = null;

    audio.src = payload.audioUrl;
    await audio.play();
    setStatus('Jarvis briefer nå…');

    audio.addEventListener(
      'ended',
      () => {
        setStatus('Brief fullført.');
        if (lastCueBox) hideBox();
        lastCueBox = null;
      },
      { once: true }
    );
  } catch (err) {
    setStatus(`Feil under brief: ${err.message}`);
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener('click', runBrief);
window.addEventListener('jarvis:wake', runBrief);

document.querySelectorAll('.box').forEach((box) => {
  box.querySelector('header').addEventListener('click', () => {
    const key = box.dataset.box;
    if (currentBox() === key) hideBox();
    else showBox(key);
  });
});

// ---------- master render loop: orb + choreography ----------

function frame(now) {
  const t = now / 1000;
  let level = 0.15 + 0.05 * Math.sin(t * 0.8); // idle breathing
  let bass = level;
  let treble = level * 0.6;

  if (!audio.paused && !audio.ended && audio.currentTime > 0) {
    const levels = getAudioLevels();
    level = Math.max(levels.level * 2.2, 0.05);
    bass = levels.bass;
    treble = levels.treble;

    const ms = audio.currentTime * 1000;
    const active = cues.find((c) => ms >= c.startMs && ms < c.endMs);
    const boxKey = active ? active.box : null;
    if (boxKey !== lastCueBox) {
      if (boxKey) showBox(boxKey);
      else hideBox();
      lastCueBox = boxKey;
    }
  }

  orb.render(t, level, bass, treble);
  updatePlanets(t);
  requestAnimationFrame(frame);
}

loadInitialData();
requestAnimationFrame(frame);
