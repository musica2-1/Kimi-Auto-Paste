const btn = document.getElementById('toggle');
const status = document.getElementById('status');
const maxInput = document.getElementById('max');
const DEFAULT_MAX = 100;
const delayInput = document.getElementById('delay');
const DEFAULT_DELAY_SEC = 5;
document.getElementById('version').textContent = 'v' + browser.runtime.getManifest().version;

function render(active) {
  btn.textContent = active ? 'Desativar' : 'Ativar';
  btn.classList.toggle('active', !!active);
  status.textContent = active ? 'Ativado (abas do kimi.ai)' : 'Desativado';
}

browser.storage.local.get('active').then(({ active }) => render(!!active));

// Se a extensão se desligar sozinha (limite de tentativas), atualiza o popup
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.active) render(!!changes.active.newValue);
});

btn.addEventListener('click', async () => {
  const { active } = await browser.storage.local.get('active');
  const newVal = !active;
  await browser.storage.local.set({ active: newVal });
  render(newVal);
});

browser.storage.local.get('maxAttempts').then(({ maxAttempts }) => {
  maxInput.value = maxAttempts !== undefined ? maxAttempts : DEFAULT_MAX;
});

maxInput.addEventListener('input', () => {
  const n = parseInt(maxInput.value, 10);
  if (Number.isFinite(n) && n >= 0) browser.storage.local.set({ maxAttempts: n });
});

browser.storage.local.get('delaySec').then(({ delaySec }) => {
  delayInput.value = delaySec !== undefined ? delaySec : DEFAULT_DELAY_SEC;
});

delayInput.addEventListener('input', () => {
  const n = parseFloat(delayInput.value);
  if (Number.isFinite(n) && n >= 1) browser.storage.local.set({ delaySec: n });
});
