const btn = document.getElementById('toggle');
const status = document.getElementById('status');

function render(active) {
  btn.textContent = active ? 'Desativar' : 'Ativar';
  btn.classList.toggle('active', !!active);
  status.textContent = active ? 'Ativado neste site' : 'Desativado';
}

browser.storage.local.get('active').then(({ active }) => render(!!active));

btn.addEventListener('click', async () => {
  const { active } = await browser.storage.local.get('active');
  const newVal = !active;
  await browser.storage.local.set({ active: newVal });
  render(newVal);
});
