/* ============================================================
   Kimi Auto Paste & Retry — content.js
   ============================================================
   AJUSTE OS SELETORES ABAIXO antes de usar. Para achar os
   seletores corretos:
     1. Abra kimi.com e clique com o botão direito no campo de
        texto do prompt -> "Inspecionar" (Investigar Elemento).
     2. Copie a tag/classe/id do elemento e coloque em
        PROMPT_SELECTOR.
     3. Faça o mesmo com o botão de enviar (ícone de seta/avião)
        -> SEND_BUTTON_SELECTOR.
     4. Force a fila aparecer, clique direito nela e no botão de
        fechar (X) -> QUEUE_POPUP_SELECTOR e
        POPUP_CLOSE_BUTTON_SELECTOR.
   ============================================================ */

const CONFIG = {
  // Campo de texto do prompt (textarea OU div contenteditable)
  PROMPT_SELECTOR: 'textarea, div[contenteditable="true"]',

  // Botão de enviar a mensagem (no Kimi é uma <div>, não um <button>)
  SEND_BUTTON_SELECTOR: '.send-button-container',

  // Container do popup/modal de "você está na fila" / aviso de limite
  QUEUE_POPUP_SELECTOR: '.modal-container',

  // Botão que fecha o aviso sem forçar upgrade ("Entendi")
  POPUP_CLOSE_BUTTON_SELECTOR: '.km-button-secondary',

  // Intervalo entre ciclos, usado só quando ainda não há nada a enviar
  // ou como intervalo de segurança entre tentativas (ms).
  CHECK_INTERVAL_MS: 2000,

  // Pausa depois de fechar o popup, antes de checar o campo (ms)
  POST_CLOSE_DELAY_MS: 500,

  // Pausa entre colar o texto e clicar em enviar (ms)
  POST_PASTE_DELAY_MS: 300,
};

let running = false;
let timerId = null;
let hasAttemptedSend = false; // true depois da 1ª tentativa de envio deste ciclo

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
  return (el.innerText || '').trim() === '';
}

async function pasteClipboardInto(el) {
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch (e) {
    log('Não consegui ler a área de transferência:', e);
    return false;
  }
  if (!text) {
    log('Área de transferência vazia, nada para colar.');
    return false;
  }

  el.focus();

  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    // Usa o setter nativo para disparar corretamente eventos em apps React/Vue
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    nativeSetter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  }

  log('Texto colado no campo de prompt.');
  return true;
}

// Dispara a sequência completa de eventos de mouse num elemento.
// Muitos sites em React/Vue não reagem a um simples el.click(),
// só a essa sequência (pointerdown -> mousedown -> mouseup -> click).
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

// Simula o usuário pressionando Enter dentro do campo de prompt.
// Serve de fallback para chats que enviam com Enter em vez de
// depender de clique no botão.
function pressEnter(el) {
  el.focus();
  const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
  el.dispatchEvent(new KeyboardEvent('keydown', opts));
  el.dispatchEvent(new KeyboardEvent('keypress', opts));
  el.dispatchEvent(new KeyboardEvent('keyup', opts));
}

// O botão de enviar do Kimi é uma <div>, não um <button>, então não
// existe propriedade .disabled nativa — o estado é feito via classe CSS.
function isElementDisabled(el) {
  if ('disabled' in el) return !!el.disabled;
  return el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
}

function clickSendButton(promptEl) {
  const btn = document.querySelector(CONFIG.SEND_BUTTON_SELECTOR);
  log('Botão de enviar encontrado?', !!btn, btn ? `disabled=${isElementDisabled(btn)} class="${btn.className}"` : '');

  if (btn && !isElementDisabled(btn)) {
    fullClick(btn);
    log('Botão de enviar clicado (sequência completa de eventos).');
    return true;
  }

  log('Botão indisponível — tentando fallback de tecla Enter.');
  if (promptEl) {
    pressEnter(promptEl);
    return true;
  }
  return false;
}

function findQueuePopup() {
  const el = document.querySelector(CONFIG.QUEUE_POPUP_SELECTOR);
  if (!el) return null;
  const visible = el.offsetParent !== null || el.getClientRects().length > 0;
  if (el && !visible) {
    log('QUEUE_POPUP_SELECTOR encontrou um elemento, mas ele está invisível (confira o seletor).');
  }
  return visible ? el : null;
}

function closeQueuePopup(popup) {
  const closeBtn = popup.querySelector(CONFIG.POPUP_CLOSE_BUTTON_SELECTOR);
  log('Botão de fechar do popup encontrado?', !!closeBtn);
  if (closeBtn) {
    fullClick(closeBtn);
    log('Popup de fila fechado.');
  } else {
    log('Não encontrei o botão de fechar do popup (ajuste POPUP_CLOSE_BUTTON_SELECTOR). HTML do popup:', popup.outerHTML.slice(0, 300));
  }
}

// Cola (se precisar) e clica em enviar.
async function attemptSend(promptEl) {
  if (isPromptEmpty(promptEl)) {
    const pasted = await pasteClipboardInto(promptEl);
    if (!pasted) return false;
    await sleep(CONFIG.POST_PASTE_DELAY_MS);
  } else {
    log('Campo já tem texto (sobrou da tentativa anterior) — não vou colar de novo, só reenviar.');
  }
  clickSendButton(promptEl);
  return true;
}

async function tick() {
  if (!running) return;
  log('--- tick ---');

  const popup = findQueuePopup();
  if (popup) {
    log('Popup de fila detectado — a tentativa anterior falhou, vou reenviar.');
    closeQueuePopup(popup);
    await sleep(CONFIG.POST_CLOSE_DELAY_MS);

    const promptEl = getPromptElement();
    if (!promptEl) {
      log('Campo de prompt não encontrado (ajuste PROMPT_SELECTOR).');
      return;
    }
    await attemptSend(promptEl);
    hasAttemptedSend = true;
    return;
  }

  if (hasAttemptedSend) {
    // Já mandamos antes e não apareceu popup de novo -> provavelmente deu certo.
    // Não fica colando/enviando à toa pra não duplicar mensagem.
    return;
  }

  const promptEl = getPromptElement();
  if (!promptEl) {
    log('Campo de prompt não encontrado (ajuste PROMPT_SELECTOR).');
    return;
  }

  log('Primeira tentativa de envio deste ciclo.');
  const attempted = await attemptSend(promptEl);
  if (attempted) hasAttemptedSend = true;
}

function start() {
  if (running) return;
  running = true;
  hasAttemptedSend = false; // permite enviar um novo prompt a cada ativação
  timerId = setInterval(tick, CONFIG.CHECK_INTERVAL_MS);
  log('Ativado.');
}

function stop() {
  running = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  log('Desativado.');
}

// Estado inicial vindo do storage
browser.storage.local.get('active').then(({ active }) => {
  if (active) start();
});

// Reage a mudanças feitas pelo popup da extensão
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.active) {
    if (changes.active.newValue) start();
    else stop();
  }
});
