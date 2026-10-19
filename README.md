# Kimi Auto Paste(Firefox)

Quando ativada em `kimi.ai`:
1. Se o campo de prompt estiver vazio, cola o conteúdo da área de transferência.
2. Clica em enviar.
3. Se aparecer o aviso "Muitas pessoas estão conversando…", clica em **Entendi** e reenvia.
4. Se o texto continuar no campo por mais de 8 s sem popup, considera que o envio falhou e reenvia.
5. Campo vazio após o envio = sucesso; ela não cola de novo.
6. Cada ação (colar, enviar, fechar popup) tem uma pausa configurável no popup (padrão 5 s).
7. Desativa sozinha ao atingir o máximo de tentativas, definido no popup da extensão (padrão 100; 0 = sem limite).

> Aviso: automatizar reenvios contra a fila pode violar os termos de uso do Kimi. Use por sua conta e risco.

## Seletores (bloco `CONFIG` em content.js)

| Item | Seletor |
|---|---|
| Campo de prompt | `.chat-input-editor[contenteditable="true"]` |
| Botão enviar | `.send-button-container` (desabilitado = classe `disabled`) |
| Popup de fila | `[data-testid="confirm-dialog"]` + texto "Muitas pessoas…" |
| Botão "Entendi" | `[data-testid="confirm-dialog-cancel"]` |

Se o site mudar de novo, prefira `data-testid`, `role` e classes semânticas. Ignore `data-v-xxxx`.

## Instalação
1. `about:debugging#/runtime/this-firefox` → **Carregar extensão temporária** → escolha `manifest.json`.
2. Copie o texto (Ctrl+C), abra o kimi.ai, clique no ícone da extensão → **Ativar**.
3. Requer Firefox 125+ (leitura da área de transferência em content script).
