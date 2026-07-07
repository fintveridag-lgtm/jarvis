const overlay = document.getElementById('overlayPanel');
const dimmer = document.getElementById('dimmer');
const TRANSITION_MS = 420;

// opSeq is a generation token. A collapse's cleanup (innerHTML = '') is
// deferred by TRANSITION_MS; if a new expand/collapse happens before that
// timer fires, the stale cleanup must be skipped or it wipes out the newly
// shown box's content (the "black popup" bug). Every op captures the seq
// at call time and only carries out its deferred work if it's still current.
let opSeq = 0;

function getBoxParts(boxKey) {
  const box = document.querySelector(`.box[data-box="${boxKey}"]`);
  if (!box) return null;
  return {
    box,
    header: box.querySelector('header').cloneNode(true),
    content: box.querySelector('.box-content').cloneNode(true),
  };
}

export function showBox(boxKey) {
  const parts = getBoxParts(boxKey);
  if (!parts) return;
  const seq = ++opSeq;

  overlay.innerHTML = '';
  overlay.appendChild(parts.header);
  overlay.appendChild(parts.content);
  overlay.dataset.activeBox = boxKey;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  dimmer.classList.add('active');

  document.querySelectorAll('.box').forEach((b) => b.classList.toggle('is-source', b === parts.box));

  requestAnimationFrame(() => {
    if (seq !== opSeq) return;
    overlay.classList.add('active');
  });
}

export function hideBox() {
  const seq = ++opSeq;
  overlay.classList.remove('active');
  dimmer.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.box').forEach((b) => b.classList.remove('is-source'));

  setTimeout(() => {
    if (seq !== opSeq) return; // superseded by a newer show/hide, don't clobber it
    overlay.innerHTML = '';
    overlay.classList.add('hidden');
    delete overlay.dataset.activeBox;
  }, TRANSITION_MS);
}

export function currentBox() {
  return overlay.dataset.activeBox || null;
}

dimmer.addEventListener('click', () => hideBox());
