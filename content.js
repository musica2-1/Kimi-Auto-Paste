/* ============================================================
   Kimi Auto Paste & Retry — content.js (v1.1)
   Seletores atualizados conforme o HTML do kimi.com (confirme no kimi.ai).
   Evite usar atributos data-v-xxxx: mudam a cada build do site.
   ============================================================ */

const CONFIG = {
  // Editor Lexical (contenteditable) do prompt
  PROMPT_SELECTOR: '.chat-input-editor[contenteditable="true"]',

  // Botão de enviar (<div>). Quando desabilitado ganha a classe "disabled"
  SEND_BUTTON_SELECTOR: '.send-button-container',

  // Modal de confirmação (o aviso de fila usa data-testid="confirm-dialog")
  QUEUE_POPUP_SELECTOR: '[data-testid="confirm-dialog"]',

  // Botão "Entendi" (cancelar). NUNCA o "confirm" (Fazer upgrade).
  POPUP_CLOSE_BUTTON_SELECTOR: '[data-testid="confirm-dialog-cancel"]',

  // O modal só é tratado como "fila" se o texto bater com isto.
  // Evita fechar outros diálogos de confirmação do site.
  QUEUE_POPUP_TEXT: /muitas pessoas|acesso priorit/i,

  // Intervalo entre ciclos (ms)
  // (padrões; a pausa real vem do popup e substitui estes 4 valores)
  CHECK_INTERVAL_MS: 5000,
  // Pausa depois de cada ação (ms): fechar popup, colar, clicar em enviar
  POST_CLOSE_DELAY_MS: 5000,
  POST_PASTE_DELAY_MS: 5000,
  POST_SEND_DELAY_MS: 5000,
  // Se o texto continuar no campo, sem popup, depois disso reenvia (ms)
  RESEND_AFTER_MS: 8000,
  // Valor padrão do máximo de envios (configurável no popup; 0 = sem limite)
  DEFAULT_MAX_ATTEMPTS: 100,
};

let running = false;
let busy = false;           // trava: impede dois ticks simultâneos
let timerId = null;
let hasAttemptedSend = false;
let lastSendAt = 0;
let attempts = 0;
let delayMs = 5000; // pausa entre ações, vem do popup
let maxAttempts = CONFIG.DEFAULT_MAX_ATTEMPTS; // vem do popup (0 = sem limite)

function log(...args) {
  console.log('[Kimi Auto Paste]', ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPromptElement() {
  return document.querySelector(CONFIG.PROMPT_SELECTOR);
}

function isPromptEmpty(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    return el.value.trim() === '';
  }
  return (el.innerText || el.textContent || '').trim() === '';
}

// Insere texto num editor Lexical/contenteditable.
// 1) paste sintético (o Lexical trata como colagem real);
// 2) fallback com execCommand. Confere se o texto realmente entrou.
async function insertText(el, text) {
  el.focus();
  const sel = window.getSelection();
  sel.selectAllChildren(el);

  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  } catch (e) {
    log('Paste sintético falhou:', e);
  }
  await sleep(150);
  if (!isPromptEmpty(el)) return true;

  log('Paste sintético não surtiu efeito — tentando execCommand.');
  el.focus();
  sel.selectAllChildren(el);
  document.execCommand('insertText', false, text);
  await sleep(150);
  return !isPromptEmpty(el);
}

async function pasteClipboardInto(el) {
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch (e) {
    log('Não consegui ler a área de transferência (o Firefox pode exigir permissão/gesto):', e);
    return false;
  }
  if (!text) {
    log('Área de transferência vazia, nada para colar.');
    return false;
  }

  let ok;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.focus();
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    ok = true;
  } else {
    ok = await insertText(el, text);
  }

  log(ok ? 'Texto colado no campo de prompt.' : 'O texto NÃO entrou no campo (confira PROMPT_SELECTOR).');
  return ok;
}

// Sequência completa de eventos de mouse (Vue/React ignoram click() simples)
function fullClick(el) {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, opts));
  });
}

function pressEnter(el) {
  el.focus();
  const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
  el.dispatchEvent(new KeyboardEvent('keydown', opts));
  el.dispatchEvent(new KeyboardEvent('keypress', opts));
  el.dispatchEvent(new KeyboardEvent('keyup', opts));
}

function isElementDisabled(el) {
  if ('disabled' in el) return !!el.disabled;
  return el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
}

// Espera o botão habilitar (o Vue leva um instante após o paste)
async function waitForSendButton(timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const btn = document.querySelector(CONFIG.SEND_BUTTON_SELECTOR);
    if (btn && !isElementDisabled(btn)) return btn;
    await sleep(100);
  }
  return null;
}

async function clickSendButton(promptEl) {
  const btn = await waitForSendButton();
  if (btn) {
    fullClick(btn);
    log('Botão de enviar clicado.');
    return true;
  }
  log('Botão de enviar não habilitou — fallback: tecla Enter.');
  if (promptEl && !isPromptEmpty(promptEl)) {
    pressEnter(promptEl);
    return true;
  }
  return false;
}

// Só considera "popup de fila" se visível E com o texto esperado
function findQueuePopup() {
  const candidates = document.querySelectorAll(CONFIG.QUEUE_POPUP_SELECTOR);
  for (const el of candidates) {
    const visible = el.offsetParent !== null || el.getClientRects().length > 0;
    if (!visible) continue;
    if (CONFIG.QUEUE_POPUP_TEXT.test(el.textContent || '')) return el;
    log('Há um diálogo visível, mas não é o aviso de fila — ignorando.');
  }
  return null;
}

function closeQueuePopup(popup) {
  const closeBtn = popup.querySelector(CONFIG.POPUP_CLOSE_BUTTON_SELECTOR);
  if (!closeBtn) {
    log('Botão de fechar não encontrado. HTML do popup:', popup.outerHTML.slice(0, 300));
    return false;
  }
  // Trava de segurança: nunca clicar em botão de upgrade/assinatura
  if (/upgrade|assin/i.test(closeBtn.textContent || '')) {
    log('O botão de fechar parece ser de upgrade — não vou clicar.');
    return false;
  }
  fullClick(closeBtn);
  log('Popup de fila fechado.');
  return true;
}

function stopAndPersist() {
  stop();
  browser.storage.local.set({ active: false });
}

async function attemptSend(promptEl) {
  if (maxAttempts > 0 && attempts >= maxAttempts) {
    log(`Limite de ${maxAttempts} tentativas atingido — desativando.`);
    stopAndPersist();
    return false;
  }
  if (!promptEl) {
    log('Campo de prompt não encontrado (confira PROMPT_SELECTOR).');
    return false;
  }

  if (isPromptEmpty(promptEl)) {
    const pasted = await pasteClipboardInto(promptEl);
    if (!pasted) return false;
    await sleep(delayMs);
  } else {
    log('Campo já tem texto — só reenviando.');
  }

  const sent = await clickSendButton(promptEl);
  if (sent) {
    attempts++;
    hasAttemptedSend = true;
    lastSendAt = Date.now();
    log(`Tentativa ${attempts}/${maxAttempts || '∞'}.`);
    await sleep(delayMs);
  }
  return sent;
}

async function step() {
  const popup = findQueuePopup();
  if (popup) {
    log('Popup de fila detectado — fechando e reenviando.');
    if (!closeQueuePopup(popup)) return;
    await sleep(delayMs);
    await attemptSend(getPromptElement());
    return;
  }

  const promptEl = getPromptElement();
  if (!promptEl) {
    log('Campo de prompt não encontrado (confira PROMPT_SELECTOR).');
    return;
  }

  if (!hasAttemptedSend) {
    log('Primeira tentativa de envio.');
    await attemptSend(promptEl);
    return;
  }

  // Já enviou antes. Campo vazio = mensagem foi enviada, tudo certo.
  // Campo ainda com texto por tempo demais, sem popup = envio falhou.
  if (!isPromptEmpty(promptEl) && Date.now() - lastSendAt > CONFIG.RESEND_AFTER_MS) {
    log('Texto continua no campo sem popup — reenviando.');
    await attemptSend(promptEl);
  }
}

async function tick() {
  if (!running || busy) return;
  busy = true;
  try {
    await step();
  } catch (e) {
    log('Erro no ciclo:', e);
  } finally {
    busy = false;
  }
}

function start() {
  if (running) return;
  running = true;
  hasAttemptedSend = false;
  attempts = 0;
  lastSendAt = 0;
  timerId = setInterval(tick, delayMs);
  log('Ativado.');
}

function stop() {
  running = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  log('Desativado.');
}

function normalizeMax(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : CONFIG.DEFAULT_MAX_ATTEMPTS;
}

function normalizeDelay(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 1 ? n * 1000 : 5000;
}

browser.storage.local.get(['active', 'maxAttempts', 'delaySec']).then(({ active, maxAttempts: m, delaySec }) => {
  if (m !== undefined) maxAttempts = normalizeMax(m);
  if (delaySec !== undefined) delayMs = normalizeDelay(delaySec);
  if (active) start();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.maxAttempts) {
    maxAttempts = normalizeMax(changes.maxAttempts.newValue);
    log('Máximo de tentativas agora:', maxAttempts || 'sem limite');
  }
  if (changes.delaySec) {
    delayMs = normalizeDelay(changes.delaySec.newValue);
    log('Pausa entre ações agora:', delayMs / 1000, 's');
    if (running) {
      clearInterval(timerId);
      timerId = setInterval(tick, delayMs);
    }
  }
  if (changes.active) {
    if (changes.active.newValue) start();
    else stop();
  }
});
