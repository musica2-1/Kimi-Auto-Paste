# Kimi Auto Paste & Retry (extensão para Firefox)

Extensão que, quando ativada em `kimi.com`:
1. Verifica se o campo de prompt está vazio.
2. Se estiver, cola o conteúdo da área de transferência (Ctrl+V).
3. Clica no botão de enviar.
4. Se aparecer o popup de "você está na fila", fecha o popup.
5. Verifica se o texto colado ainda está no campo; se não estiver, cola de novo e repete.

## ⚠️ Antes de usar

Isso automatiza reenvios repetidos contra o sistema de fila do site. Isso
provavelmente entra em conflito com os termos de uso do Kimi (a fila existe
para controlar a carga do servidor de forma justa entre os usuários). Use por
sua conta e risco, com um intervalo razoável entre tentativas (já vem
configurado para 2 segundos, não recomendo diminuir).

## Passo 1 — Ajustar os seletores (obrigatório)

Os seletores de CSS variam conforme o HTML real do site, que muda com
atualizações do Kimi. Abra `content.js` e ajuste o bloco `CONFIG` no topo:

1. Abra `kimi.com`, clique com o botão direito no **campo de texto do
   prompt** → **Inspecionar**. No painel que abrir, veja a tag (`textarea`
   ou `div`) e as classes/atributos dela. Coloque isso em `PROMPT_SELECTOR`.
   Exemplo: se o elemento for `<textarea class="chat-input-xyz">`, use
   `PROMPT_SELECTOR: 'textarea.chat-input-xyz'`.

2. Faça o mesmo com o **botão de enviar** (geralmente um ícone de seta) →
   `SEND_BUTTON_SELECTOR`.

3. Force o popup de fila a aparecer (mande várias mensagens seguidas até
   ele surgir), clique direito **no próprio popup** (na área ao redor, não
   no texto) → Inspecionar, e pegue a classe/atributo do container →
   `QUEUE_POPUP_SELECTOR`.

4. Dentro desse popup, clique direito no **botão de fechar (X)** →
   Inspecionar → `POPUP_CLOSE_BUTTON_SELECTOR`.

Dica: no painel do Inspecionar, clique com o botão direito no elemento
destacado em HTML e escolha "Copiar" → "Copiar seletor" para o Firefox
gerar um seletor CSS pronto — só colar direto na constante.

## Passo 2 — Carregar a extensão no Firefox

1. Abra `about:debugging#/runtime/this-firefox`.
2. Clique em **"Carregar extensão temporária"**.
3. Selecione o arquivo `manifest.json` desta pasta.
4. A extensão vai aparecer na barra de ferramentas (ícone de peça de
   quebra-cabeça, se não tiver ícone fixo mostre as extensões ocultas).

> Extensão "temporária" some quando o Firefox fecha. Para instalar de forma
> permanente sem passar pela loja da Mozilla, você precisa do Firefox
> Developer Edition ou Nightly com a opção
> `xpinstall.signatures.required` desativada em `about:config`, ou então
> submeter a extensão como "unlisted" em addons.mozilla.org para assinatura.

## Passo 3 — Usar

1. Vá para `kimi.com` e copie o texto que quer enviar (Ctrl+C).
2. Clique no ícone da extensão e depois em **"Ativar"**.
3. Deixe a aba aberta. O script vai colar e tentar enviar sozinho, e repetir
   automaticamente sempre que aparecer o aviso de fila.
4. Clique em **"Desativar"** no popup da extensão quando terminar.

## Estrutura dos arquivos

- `manifest.json` — configuração da extensão (Manifest V3).
- `content.js` — lógica principal (colar, enviar, detectar/fechar popup).
- `popup.html` / `popup.js` — botão de ativar/desativar.
