function setStatus(msg) {
  const el = document.getElementById('statusLine');
  if (el) el.textContent = msg;
}

function wake() {
  window.dispatchEvent(new CustomEvent('jarvis:wake'));
}

let listening = false;

function startListening() {
  if (listening) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus('Talegjenkjenning er ikke tilgjengelig — bruk Cmd+Shift+J eller "Run brief".');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  listening = true;
  setStatus('Lytter… si "Hey Jarvis, wake up daddy\'s home"');

  const timeout = setTimeout(() => {
    if (listening) recognition.stop();
  }, 7000);

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map((r) => r[0].transcript)
      .join(' ')
      .toLowerCase();
    if (transcript.includes('wake up')) {
      wake();
    } else {
      setStatus(`Hørte: "${transcript}" — kjente ikke igjen kommandoen. Prøv Cmd+Shift+J.`);
    }
  };
  recognition.onerror = () => setStatus('Talegjenkjenning feilet — bruk Cmd+Shift+J som fallback.');
  recognition.onend = () => {
    listening = false;
    clearTimeout(timeout);
  };

  try {
    recognition.start();
  } catch {
    listening = false;
    setStatus('Kunne ikke starte talegjenkjenning — bruk Cmd+Shift+J.');
  }
}

// Cmd/Ctrl+J activates the mic and listens for the wake phrase.
// Cmd/Ctrl+Shift+J is the clean hotkey fallback: runs the brief directly.
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (!(e.metaKey || e.ctrlKey) || key !== 'j') return;
  e.preventDefault();
  if (e.shiftKey) {
    wake();
  } else {
    startListening();
  }
});
