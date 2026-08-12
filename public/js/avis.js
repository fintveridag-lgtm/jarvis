// Dagsavisen — henter /api/avis og viser saker filtrert på tidsrom.
// Ren vanilla JS, ingen build. Serveres ferskt ved reload.

const VALID_TAGS = ['fakta', 'forskning', 'debatt', 'spekulasjon'];
let state = { data: null, period: 'day' };

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

function itemHtml(item) {
  const tag = tagClass(item.tag);
  const src = item.url
    ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.source || 'kilde')}</a>`
    : esc(item.source || '');
  return `
    <div class="item">
      <div class="item-head"><span class="chip ${tag}">${esc(item.tag || tag)}</span></div>
      <h3>${esc(item.title)}</h3>
      ${item.summary ? `<p>${esc(item.summary)}</p>` : ''}
      <div class="meta">
        ${src ? `<span>${src}</span>` : ''}
        ${item.date ? `<span class="date">${esc(item.date)}</span>` : ''}
      </div>
    </div>`;
}

function sectionHtml(section, period) {
  const items = (section.items || []).filter((it) => inPeriod(it, period));
  const body = items.length
    ? items.map(itemHtml).join('')
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

  let html = '';
  if (data && !data.available) {
    html += `
      <div class="frontpage-note">
        <strong>Avisen er ikke fylt ennå.</strong><br />
        Kjør <code>avis-rutinen</code> (se <code>scripts/avis-routine-prompt.md</code>)
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
  render();
}

bindPeriods();
load();
