/* Ekteskaps-appen - all logikk. Ingen server, ingen sky.
   Data lagres i nettleserens localStorage, altsaa kun paa denne maskinen. */

'use strict';

// ---------- Enkel lokal lagring ----------
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('ekteskap.' + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem('ekteskap.' + key, JSON.stringify(val)); },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Innhold ----------
const WONDERS = [
  'Se på den du er glad i som om det var første gang. Hva legger du merke til?',
  'Hva trodde du om kjærlighet da du var 17? Har det endret seg?',
  'Sofie tok verden for gitt — helt til noen spurte «hvem er du?». Spør hverandre i kveld.',
  'Vi har ikke uendelig med tid sammen. Hva vil du bruke kvelden på?',
  'Hva er én liten ting partneren din gjorde denne uka som du ikke sa takk for?',
  'Kaninen i hatten: hva er det vidunderlige i det helt vanlige hos dere to?',
  'Når følte dere dere sist virkelig som et lag?',
];

const CHAPTERS = [
  { t: 'Å bli sett', b: 'De sterkeste parene svarer på hverandres små invitasjoner til kontakt — et blikk, en kommentar, en hånd på skulderen. Det er ikke de store gestene som holder et ekteskap sammen, men de tusen små «jeg er her».' },
  { t: 'Å krangle godt', b: 'Konflikt er ikke faren — forakt er. Gottman kaller kritikk, forakt, forsvar og «muren» for de fire rytterne. Bytt «du gjør alltid …» med «jeg føler … fordi jeg trenger …». Uenighet uten forakt gjør par sterkere.' },
  { t: 'Vennskapet', b: 'Sikt mot fem gode øyeblikk for hvert vonde (5:1). Fortsett å like hverandre, ikke bare elske. Kjenn den andres indre verden — drømmer, gruer, favoritter — og oppdater kartet, for mennesker forandrer seg.' },
  { t: 'Begjær og nærhet', b: 'Trygghet og lidenskap kan dra i hver sin retning (Esther Perel). Nærhet skaper ro; begjær trenger litt avstand og nysgjerrighet. La partneren få være et eget menneske dere fortsatt kan bli forelsket i.' },
  { t: 'Barna og «vi-et»', b: 'Å være foreldre uten å miste paret. Verne om noen minutter som bare er deres, selv i den travleste uka. Barna trygges mest av å se at mor og far fortsatt er glad i hverandre.' },
  { t: 'Reparasjon', b: 'Alle par sårer hverandre. Det som skiller de varige, er evnen til å finne tilbake: en unnskyldning, en spøk, en hånd. Reparasjonen trenger ikke være perfekt — den må bare komme.' },
  { t: 'Undring', b: 'Jostein Gaarders store spørsmål: hvordan holde undringen levende i stedet for å ta verden for gitt? Slutt aldri å bli nysgjerrig på den du bor med. Du kjenner dem aldri helt ferdig.' },
];

const TALK_CARDS = [
  'Hva var det beste øyeblikket vårt den siste måneden?',
  'Er det noe du har båret på som du ikke har sagt?',
  'Hva trenger du mer av fra meg akkurat nå?',
  'Hva gruer eller gleder du deg til den neste tiden?',
  'Når følte du deg sist virkelig sett av meg?',
  'Hva ønsker du at vi gjorde mer av sammen?',
  'Er det noe med hverdagen vår du skulle ønske var annerledes?',
  'Hva er du takknemlig for ved oss to i kveld?',
  'Hvordan har du det — egentlig?',
  'Hva drømmer du om for oss om fem år?',
];

// ---------- Navigasjon ----------
const treeScreen = $('[data-screen="tree"]');
const house = $('.house');

function showHouse(view = 'home') {
  treeScreen.classList.remove('is-active');
  house.classList.add('is-active');
  goView(view);
}
function showTree() {
  house.classList.remove('is-active');
  treeScreen.classList.add('is-active');
}
function goView(view) {
  $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === view));
  $$('.nav__btn').forEach(b => b.classList.toggle('is-active', b.dataset.go === view));
  if (view === 'home') refreshHome();
}

$$('[data-go]').forEach(el => el.addEventListener('click', () => {
  const dest = el.dataset.go;
  if (dest === 'tree') showTree();
  else if (dest === 'home') showHouse('home');
  else goView(dest);
}));
$('#enterHouse').addEventListener('click', () => showHouse('home'));

// ---------- Bekymringstreet ----------
function renderTags() {
  const layer = $('#hangingLayer');
  const worries = store.get('worries', []);
  layer.innerHTML = '';
  // Faste, pene «hengepunkter» i kronen.
  const spots = [[28,30],[58,22],[74,40],[42,18],[20,52],[80,58],[50,44],[35,52],[66,58]];
  worries.slice(-9).forEach((w, i) => {
    const [x, y] = spots[i % spots.length];
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = w.text;
    tag.style.left = x + '%';
    tag.style.top = y + '%';
    tag.style.animationDelay = (i * 0.06) + 's, ' + (i * 0.3) + 's';
    layer.appendChild(tag);
  });
  const n = worries.length;
  $('#treeCount').textContent = n
    ? `Du har hengt fra deg ${n} ${n === 1 ? 'ting' : 'ting'}. De er trygt lagt bort for kvelden.`
    : '';
}

$('#worryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#worryInput');
  const text = input.value.trim();
  if (!text) return;
  const worries = store.get('worries', []);
  worries.push({ text, at: Date.now() });
  store.set('worries', worries);
  input.value = '';
  renderTags();
});

// ---------- Hjem ----------
function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}
function refreshHome() {
  const h = new Date().getHours();
  $('#greeting').textContent = h < 5 ? 'God natt' : h < 10 ? 'God morgen' : h < 18 ? 'God dag' : 'God kveld';
  $('#wonderQuote').textContent = WONDERS[dayOfYear() % WONDERS.length];
  $('#tileDays').textContent = daysTogether() ?? '–';
  const day = store.get('reminderDay', null);
  const names = ['søndag','mandag','tirsdag','onsdag','torsdag','fredag','lørdag'];
  $('#tileTalk').textContent = day === null ? 'ikke satt' : names[day];
}

// ---------- Teller ----------
function daysTogether() {
  const d = store.get('date', null);
  if (!d) return null;
  const diff = Date.now() - new Date(d + 'T00:00:00').getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}
function refreshCounter() {
  const days = daysTogether();
  const label = store.get('label', 'sammen');
  $('#counterDays').textContent = days ?? '–';
  if (days === null) {
    $('#counterSub').textContent = 'Sett datoen deres for å begynne å telle.';
    $('#milestone').textContent = '';
  } else {
    const years = (days / 365.25).toFixed(1);
    $('#counterSub').textContent = `Dere har vært ${label} i ${days} dager — omtrent ${years} år.`;
    const next = [100, 365, 1000, 3650, 5000, 7300, 10000].find(m => m > days);
    $('#milestone').textContent = next ? `Neste milepæl: dag ${next} (om ${next - days} dager) 🕯️` : '';
  }
  const d = store.get('date', null);
  if (d) $('#dateInput').value = d;
  $('#labelInput').value = store.get('label', '');
}
$('#dateForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = $('#dateInput').value;
  if (d) store.set('date', d);
  const lbl = $('#labelInput').value.trim();
  store.set('label', lbl || 'sammen');
  refreshCounter();
});

// ---------- Rubrikker ----------
function renderChapters() {
  const wrap = $('#chapters');
  wrap.innerHTML = '';
  CHAPTERS.forEach((c, i) => {
    const el = document.createElement('article');
    el.className = 'chapter';
    el.innerHTML = `
      <button class="chapter__head" aria-expanded="false">
        <span><span class="chapter__num">${String(i + 1).padStart(2, '0')}</span> &nbsp; ${c.t}</span>
        <span aria-hidden="true">＋</span>
      </button>
      <div class="chapter__body"><p>${c.b}</p></div>`;
    const head = $('.chapter__head', el);
    head.addEventListener('click', () => {
      const open = el.classList.toggle('is-open');
      head.setAttribute('aria-expanded', String(open));
      $('span[aria-hidden]', head).textContent = open ? '－' : '＋';
    });
    wrap.appendChild(el);
  });
}

// ---------- Ukens samtale ----------
$('#drawCard').addEventListener('click', () => {
  const q = TALK_CARDS[Math.floor(Math.random() * TALK_CARDS.length)];
  $('#talkQ').textContent = q;
});
$('#doneTalk').addEventListener('click', () => {
  store.set('lastTalk', Date.now());
  $('#talkQ').textContent = 'Godt gjort. Å sette seg ned sammen er halve jobben. 🍵';
  updateReminderStatus();
});
$('#reminderDay').addEventListener('change', (e) => {
  store.set('reminderDay', Number(e.target.value));
  updateReminderStatus();
  refreshHome();
});
function updateReminderStatus() {
  const day = store.get('reminderDay', null);
  const status = $('#reminderStatus');
  if (day === null) { status.textContent = ''; return; }
  const last = store.get('lastTalk', null);
  const daysSince = last ? Math.floor((Date.now() - last) / 86400000) : null;
  if (daysSince === null) status.textContent = 'Fint! Første samtale venter.';
  else if (daysSince >= 7) status.textContent = `Det er ${daysSince} dager siden sist — kanskje på tide? 🍵`;
  else status.textContent = `Sist samtale: for ${daysSince} dag${daysSince === 1 ? '' : 'er'} siden.`;
}

// ---------- Hjelp-dialog ----------
$('#helpBtn').addEventListener('click', () => $('#helpDialog').showModal());

// ---------- Init ----------
function init() {
  renderTags();
  renderChapters();
  refreshCounter();
  const day = store.get('reminderDay', null);
  if (day !== null) $('#reminderDay').value = String(day);
  updateReminderStatus();
  refreshHome();
}
init();
