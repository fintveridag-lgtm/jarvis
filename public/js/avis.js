// Dagsavisen — henter /api/avis og viser saker filtrert på tidsrom.
// Ren vanilla JS, ingen build. Serveres ferskt ved reload.

const VALID_TAGS = ['fakta', 'forskning', 'debatt', 'spekulasjon'];
let state = { data: null, period: 'day' };
let flatItems = []; // saker slik de vises nå, indeksert for lese-visningen

const PERIOD_LABEL = { day: 'i dag', week: 'denne uken', month: 'denne måneden' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

// En sak vises for et tidsrom hvis den er merket med det. "day" tas også med i
// uken og måneden; "week" tas med i måneden — slik at bredere faner er romsligere.
function inPeriod(item, period) {
  const p = item.period || 'day';
  if (period === 'day') return p === 'day';
  if (period === 'week') return p === 'day' || p === 'week';
  return true; // month: alt
}

function tagClass(tag) {
  return VALID_TAGS.includes(tag) ? tag : 'debatt';
}

function itemHtml(item, idx) {
  const tag = tagClass(item.tag);
  return `
    <article class="item" data-i="${idx}" tabindex="0" role="button">
      <div class="item-head"><span class="chip ${tag}">${esc(item.tag || tag)}</span></div>
      <h3>${esc(item.title)}</h3>
      ${item.summary ? `<p>${esc(item.summary)}</p>` : ''}
      <div class="meta">
        ${item.source ? `<span>${esc(item.source)}</span>` : ''}
        ${item.date ? `<span class="date">${esc(item.date)}</span>` : ''}
        <span class="read-cue">Les →</span>
      </div>
    </article>`;
}

function sectionHtml(section, period) {
  const items = (section.items || []).filter((it) => inPeriod(it, period));
  const body = items.length
    ? items
        .map((it) => {
          flatItems.push(it);
          return itemHtml(it, flatItems.length - 1);
        })
        .join('')
    : `<p class="empty">Ingenting nytt ${PERIOD_LABEL[period]}. Kjør avis-rutinen for å fylle denne.</p>`;
  return `
    <section class="section">
      <h2><span class="icon">${esc(section.icon || '•')}</span> ${esc(section.title)}
        <span class="count">${items.length}</span></h2>
      ${body}
    </section>`;
}

function render() {
  const { data, period } = state;
  const paper = document.getElementById('paper');
  const edition = document.getElementById('edition');
  const colophon = document.getElementById('colophon');

  edition.textContent = data?.edition || 'Ingen utgave ennå';
  flatItems = [];

  let html = '';
  if (data && !data.available) {
    html += `
      <div class="frontpage-note">
        <strong>Avisen er ikke fylt ennå.</strong><br />
        Kjør natt-pipelinen (se <code>scripts/avis-pipeline/README.md</code>)
        for å hente dagens saker. Under vises temaene den følger.
      </div>`;
  }
  html += (data?.sections || []).map((s) => sectionHtml(s, period)).join('');
  paper.innerHTML = html;

  if (data?.generatedAt) {
    const t = new Date(data.generatedAt);
    colophon.textContent = `Sist oppdatert ${t.toLocaleString('no-NO')} · Kuratert av Jarvis · Kilder merket, påstander skilt fra bevis.`;
  } else {
    colophon.textContent = 'Kuratert av Jarvis · Kilder merket, påstander skilt fra bevis.';
  }
}

// ---- Lese-visning (klikk på en sak) ----
function openReader(idx) {
  const item = flatItems[idx];
  if (!item) return;
  const tag = tagClass(item.tag);
  const el = document.getElementById('reader');
  const link = item.url
    ? `<a class="reader-link" href="${esc(item.url)}" target="_blank" rel="noopener">Les hele saken hos ${esc(item.source || 'kilden')} →</a>`
    : '';
  el.querySelector('.reader-card').innerHTML = `
    <button class="reader-close" aria-label="Lukk">×</button>
    <span class="chip ${tag}">${esc(item.tag || tag)}</span>
    <h2>${esc(item.title)}</h2>
    <div class="reader-meta">
      ${item.source ? `<span>${esc(item.source)}</span>` : ''}
      ${item.date ? `<span class="date">${esc(item.date)}</span>` : ''}
    </div>
    ${item.summary ? `<p>${esc(item.summary)}</p>` : ''}
    ${link}`;
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  el.querySelector('.reader-close').focus();
}

function closeReader() {
  const el = document.getElementById('reader');
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
}

function bindPeriods() {
  document.getElementById('periods').addEventListener('click', (e) => {
    const btn = e.target.closest('.period');
    if (!btn) return;
    state.period = btn.dataset.period;
    document
      .querySelectorAll('.period')
      .forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
}

function bindReader() {
  // Åpne ved klikk (eller Enter/Space) på en sak.
  const paper = document.getElementById('paper');
  paper.addEventListener('click', (e) => {
    const card = e.target.closest('.item');
    if (card) openReader(Number(card.dataset.i));
  });
  paper.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.item');
    if (card) {
      e.preventDefault();
      openReader(Number(card.dataset.i));
    }
  });
  // Lukk ved klikk utenfor kortet, på ×, eller Escape.
  const reader = document.getElementById('reader');
  reader.addEventListener('click', (e) => {
    if (e.target === reader || e.target.closest('.reader-close')) closeReader();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeReader();
  });
}

async function load() {
  try {
    const res = await fetch('/api/avis');
    if (!res.ok) throw new Error(`Serveren svarte ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    state.data = { available: false, sections: [], edition: null };
    document.getElementById('paper').innerHTML =
      `<p class="loading">Kunne ikke laste avisen: ${esc(err.message)}</p>`;
    return;
  }

  // Land på den første fanen (I dag → Uken → Måneden) som faktisk har saker,
  // slik at siden ikke ser tom ut når dagens stoff er tynt.
  const periods = ['day', 'week', 'month'];
  const hasItems = (p) =>
    (state.data?.sections || []).some((s) =>
      (s.items || []).some((it) => inPeriod(it, p)),
    );
  state.period = periods.find(hasItems) || 'day';
  document
    .querySelectorAll('.period')
    .forEach((b) => b.classList.toggle('active', b.dataset.period === state.period));

  render();
}

bindPeriods();
bindReader();
load();
