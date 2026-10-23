let text = '';
const q = document.getElementById('q'), a = document.getElementById('a'), copy = document.getElementById('copy'), ins = document.getElementById('ins');
hablo.onAnswer(({ question, text: t }) => { text = t; q.textContent = '“' + question + '”'; a.textContent = t; });
copy.onclick = () => { hablo.copy(text); copy.textContent = 'Copiado ✓'; setTimeout(() => (copy.textContent = 'Copiar'), 1200); };
ins.onclick = () => hablo.insert(text);
