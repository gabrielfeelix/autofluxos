/*
 * AutoFluxos: o balão de conversa do site.
 *
 * O lojista cola uma linha no HTML:
 *   <script src="https://autofluxos.4yu.com.br/chat/v1.js" data-chave="..." async></script>
 *
 * Sem framework e sem dependência: é um arquivo que roda dentro da loja de
 * outra pessoa, e cada kilobyte é dela. Tudo mora num Shadow DOM, então o CSS
 * da loja não entra aqui e o nosso não vaza para lá. A única coisa que
 * atravessa de propósito é a fonte: o balão escreve com a tipografia do site.
 *
 * A conversa não mora aqui. O servidor grava tudo, e o balão só pergunta "o
 * que tem de novo?" em intervalos: curtos enquanto espera resposta, longos
 * quando está parado, e nenhum quando a aba está escondida.
 *
 * Quatro telas, no jeito dos widgets de atendimento que o visitante já
 * conhece: Início (saudação e "Nova conversa"), Mensagens (as conversas
 * anteriores), o formulário de antes da conversa, e a conversa. Início e
 * Mensagens têm abas no rodapé; o formulário e a conversa têm voltar.
 *
 * As conversas anteriores ficam neste navegador, sem login: o servidor tem um
 * fio só por visitante, e o balão guarda onde cada conversa começou (o `ref`
 * da primeira mensagem). Fatiar o fio por essas marcas é o que mostra a lista
 * de Recentes. Sem armazenamento, tudo vira uma conversa só, que é o que ela é
 * no Inbox de qualquer jeito.
 */
;(function () {
  'use strict'

  var script =
    document.currentScript ||
    document.querySelector('script[data-chave][src*="/chat/v1.js"]')
  if (!script) return
  var chave = script.getAttribute('data-chave')
  if (!chave || window.__autofluxosChat) return
  window.__autofluxosChat = true

  var api = new URL(script.src).origin + '/api/site/' + encodeURIComponent(chave)
  var guardado = 'autofluxos-chat:' + chave

  /* ------------------------------------------------------------------ */
  /* Memória do navegador. Pode falhar (aba anônima, bloqueio de cookies),
   * e aí o balão funciona do mesmo jeito, só esquece ao recarregar. */
  var memoria = {}
  function ler(k) {
    try {
      var v = window.localStorage.getItem(guardado + ':' + k)
      return v === null ? memoria[k] || null : v
    } catch (e) {
      return memoria[k] || null
    }
  }
  function gravar(k, v) {
    memoria[k] = v
    try {
      window.localStorage.setItem(guardado + ':' + k, v)
    } catch (e) {
      // Navegador sem armazenamento (aba anônima, cota cheia): segue sem guardar.
    }
  }

  function aleatorio(bytes) {
    var a = new Uint8Array(bytes)
    crypto.getRandomValues(a)
    var s = ''
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i])
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  /* O segredo do visitante: é ele, e só ele, que abre esta conversa. */
  var segredo = ler('visitante')
  if (!segredo || !/^[A-Za-z0-9_-]{32,128}$/.test(segredo)) {
    segredo = aleatorio(32)
    gravar('visitante', segredo)
  }

  /* Onde cada conversa começou: o `ref` da primeira mensagem dela. */
  function marcas() {
    try {
      var lista = JSON.parse(ler('conversas') || '[]')
      return Array.isArray(lista) ? lista.filter(function (r) { return typeof r === 'string' }) : []
    } catch (e) {
      return []
    }
  }
  function marcar(ref) {
    var lista = marcas()
    lista.push(ref)
    gravar('conversas', JSON.stringify(lista.slice(-50)))
  }

  function pedir(caminho, opcoes) {
    opcoes = opcoes || {}
    return fetch(api + caminho, {
      method: opcoes.metodo || 'GET',
      headers: Object.assign(
        { 'x-visitante': segredo },
        opcoes.corpo ? { 'content-type': 'application/json' } : {}
      ),
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      credentials: 'omit',
    }).then(function (r) {
      return r.json().then(
        function (j) {
          return { ok: r.ok, status: r.status, dados: j }
        },
        function () {
          return { ok: r.ok, status: r.status, dados: {} }
        }
      )
    })
  }

  /* ------------------------------------------------------------------ */
  var CSS =
    ':host{all:initial;font-family:inherit;--c:#6366F1;--tinta:#16181D;--apagado:#6B7280;--linha:#E7E8EC;--fundo:#FFFFFF;--bolha:#F2F3F5}' +
    '.raiz{--ficha:#F7F7F9;--campo:#fff;--c-texto:color-mix(in srgb,var(--c) 85%,#000);--c-escuro:color-mix(in srgb,var(--c) 62%,#000)}' +
    /* Fundo escuro: a loja de tema escuro não quer um retângulo branco aceso no
     * canto. A cor da marca continua a mesma; o texto dela clareia para ler. */
    '.raiz.escuro{--tinta:#F3F4F6;--apagado:#9CA0A8;--linha:#2B2E36;--fundo:#15161A;--bolha:#24262D;--ficha:#1B1D22;--campo:#101114;--c-texto:color-mix(in srgb,var(--c) 55%,#fff)}' +
    '.raiz.escuro .painel,.raiz.escuro .convite{box-shadow:0 24px 60px -18px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.08)}' +
    '*{box-sizing:border-box;font-family:inherit;margin:0}[hidden]{display:none!important}' +
    'button{font:inherit;color:inherit}' +
    '.raiz{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:12px;color:var(--tinta);font-size:15px;line-height:1.45;-webkit-font-smoothing:antialiased}' +
    '.botao{width:64px;height:64px;border-radius:50%;border:0;background:var(--c);color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 10px 28px -8px color-mix(in srgb,var(--c) 70%,#000),0 2px 6px rgba(22,24,29,.18);transition:transform .18s ease;position:relative}' +
    '.botao:hover{transform:scale(1.05)}' +
    '.botao .mascote{width:100%;height:100%;object-fit:cover;border-radius:50%;pointer-events:none}' +
    '.botao svg.robo{width:54px;height:54px;overflow:visible}' +
    '.robo.vivo .braco{transform-origin:47px 41px;animation:acena 3.6s ease-in-out infinite}' +
    '.robo.vivo .olhos{transform-origin:32px 31px;animation:pisca 4.2s infinite}' +
    '.robo.vivo .antena{animation:respira 1.8s ease-in-out infinite}' +
    '@keyframes acena{0%,52%,100%{transform:rotate(0)}8%{transform:rotate(-24deg)}16%{transform:rotate(10deg)}24%{transform:rotate(-24deg)}32%{transform:rotate(10deg)}42%{transform:rotate(0)}}' +
    '@keyframes pisca{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}' +
    '@keyframes respira{0%,100%{opacity:1}50%{opacity:.35}}' +
    '.botao:focus-visible,button:focus-visible,a:focus-visible,textarea:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid color-mix(in srgb,var(--c) 45%,#fff);outline-offset:2px}' +
    '.botao>svg:not(.robo){width:27px;height:27px}' +
    '.naolidas{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#E11D48;color:#fff;font-size:11.5px;font-weight:700;display:grid;place-items:center;border:2px solid #fff}' +
    '.convite{max-width:260px;background:var(--fundo);border-radius:16px 16px 4px 16px;padding:12px 34px 12px 14px;box-shadow:0 12px 32px -10px rgba(22,24,29,.35),0 0 0 1px var(--linha);font-size:14px;position:relative;cursor:pointer;animation:entra .45s cubic-bezier(.2,.8,.2,1)}' +
    '.convite .fechar{position:absolute;top:6px;right:6px;width:22px;height:22px;border:0;background:transparent;color:var(--apagado);cursor:pointer;border-radius:6px;font-size:16px;line-height:1}' +
    '@keyframes entra{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}' +
    '.painel{width:380px;height:min(640px,calc(100vh - 110px));background:var(--fundo);border-radius:20px;box-shadow:0 24px 60px -18px rgba(22,24,29,.45),0 0 0 1px rgba(22,24,29,.06);display:flex;flex-direction:column;overflow:hidden;transform-origin:bottom right;animation:abre .22s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes abre{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}' +
    '.tela{flex:1;min-height:0;display:flex;flex-direction:column}' +
    '.rolar{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}' +

    /* Avatar: o personagem da loja ou o robô, sempre sobre a cor da marca. */
    '.avatar{width:38px;height:38px;flex:none;border-radius:50%;background:var(--c);display:grid;place-items:center;overflow:hidden}' +
    '.avatar img,.avatar video{width:100%;height:100%;object-fit:cover}' +
    '.avatar svg{width:32px;height:32px;overflow:visible}' +
    '.sobre-cor .avatar{background:rgba(255,255,255,.18);box-shadow:0 0 0 2px rgba(255,255,255,.28)}' +

    /* Início */
    '.capa{background:linear-gradient(155deg,var(--c) 0%,var(--c-escuro) 100%);color:#fff;padding:18px 18px 74px;position:relative}' +
    '.capa .linha{display:flex;align-items:center;gap:10px}' +
    '.capa .nome{flex:1;min-width:0;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.capa h1{font-size:27px;font-weight:750;line-height:1.15;letter-spacing:-.022em;margin-top:30px;overflow-wrap:anywhere}' +
    '.capa .sub{font-size:15px;opacity:.86;margin-top:8px}' +
    '.fechar-topo{width:34px;height:34px;flex:none;border:0;border-radius:10px;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;display:grid;place-items:center}' +
    '.fechar-topo:hover{background:rgba(255,255,255,.24)}' +
    '.cartoes{padding:0 14px 16px;margin-top:-56px;position:relative;display:flex;flex-direction:column;gap:12px}' +
    '.cartao{background:var(--fundo);border-radius:16px;box-shadow:0 8px 28px -12px rgba(22,24,29,.28),0 0 0 1px var(--linha);overflow:hidden}' +
    '.acao{display:flex;align-items:center;gap:14px;width:100%;padding:16px;border:0;background:none;text-align:left;cursor:pointer;transition:background .15s}' +
    '.acao:hover{background:color-mix(in srgb,var(--c) 5%,var(--fundo))}' +
    '.acao .txt{flex:1;min-width:0}' +
    '.acao b{display:block;font-size:15px;font-weight:700}' +
    '.acao small{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--apagado);margin-top:2px}' +
    '.acao small svg{flex:none}' +
    '.seta{width:36px;height:36px;flex:none;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center}' +
    '.cartao h4{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--apagado);padding:14px 16px 2px}' +

    /* Listas de conversas */
    '.item{display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border:0;background:none;text-align:left;cursor:pointer;transition:background .15s}' +
    '.item:hover{background:var(--bolha)}' +
    '.item .txt{flex:1;min-width:0}' +
    '.item b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.item small{display:block;font-size:12.5px;color:var(--apagado);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.item.novo b{font-weight:750}' +
    '.ponto{width:9px;height:9px;flex:none;border-radius:50%;background:#E11D48}' +
    '.titulo-aba{background:var(--c);color:#fff;display:flex;align-items:center;gap:10px;padding:14px 14px 14px 18px}' +
    '.titulo-aba h2{flex:1;font-size:16px;font-weight:700}' +
    '.novo-chat{display:flex;width:calc(100% - 32px);align-items:center;justify-content:center;gap:8px;margin:16px;padding:12px;border:0;border-radius:12px;background:var(--c);color:#fff;font-weight:700;font-size:14.5px;cursor:pointer;box-shadow:0 6px 18px -8px var(--c)}' +
    '.novo-chat:hover{background:var(--c-escuro)}' +
    '.secao{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--apagado);padding:6px 16px 6px}' +
    '.vazio{padding:36px 28px;text-align:center;color:var(--apagado);font-size:14px}' +
    '.vazio svg{color:color-mix(in srgb,var(--c) 55%,var(--linha));margin-bottom:10px}' +

    /* Abas */
    '.abas{display:flex;border-top:1px solid var(--linha);background:var(--fundo)}' +
    '.abas button{flex:1;padding:9px 0 7px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;font-weight:650;color:var(--apagado);background:none;border:0;cursor:pointer;position:relative}' +
    '.abas button.ativa{color:var(--c-texto)}' +
    '.abas .ponto{position:absolute;top:7px;left:calc(50% + 8px)}' +

    /* Conversa */
    '.topo{background:var(--c);color:#fff;padding:12px 12px 12px 8px;display:flex;align-items:center;gap:10px}' +
    '.topo .t{flex:1;min-width:0}' +
    '.topo h2{font-size:15.5px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.topo p{font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.voltar{width:34px;height:34px;flex:none;border:0;border-radius:10px;background:transparent;color:#fff;cursor:pointer;display:grid;place-items:center}' +
    '.voltar:hover{background:rgba(255,255,255,.16)}' +
    '.lista{padding:18px 14px 8px;display:flex;flex-direction:column;gap:6px}' +
    '.msg{max-width:84%;padding:9px 13px;border-radius:18px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}' +
    '.msg a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.empresa{align-self:flex-start;background:var(--bolha);border-bottom-left-radius:6px}' +
    '.visitante{align-self:flex-end;background:var(--c);color:#fff;border-bottom-right-radius:6px}' +
    '.visitante.pendente{opacity:.6}' +
    '.autor{align-self:flex-start;font-size:11.5px;color:var(--apagado);margin:8px 0 0 6px}' +
    '.opcoes{align-self:stretch;display:flex;flex-direction:column;gap:6px;margin:4px 0 6px;padding-left:2px}' +
    '.opcoes button{text-align:left;font-size:14.5px;padding:10px 14px;border-radius:12px;border:1.5px solid color-mix(in srgb,var(--c) 40%,var(--linha));background:var(--fundo);color:var(--c-texto);font-weight:600;cursor:pointer;transition:background .15s}' +
    '.opcoes button:hover:not(:disabled){background:color-mix(in srgb,var(--c) 10%,var(--fundo))}' +
    '.opcoes button:disabled{cursor:default;opacity:.45}' +
    '.opcoes button.escolhida{opacity:1;background:color-mix(in srgb,var(--c) 16%,var(--fundo))}' +
    '.card{align-self:flex-start;width:84%;border:1px solid var(--linha);border-radius:16px;overflow:hidden;background:var(--fundo)}' +
    '.card img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#fff;border-bottom:1px solid var(--linha)}' +
    '.card .c{padding:10px 13px 12px}' +
    '.card h3{font-size:14.5px;font-weight:650;line-height:1.3}' +
    '.card p{font-size:13px;color:var(--apagado);margin-top:3px}' +
    '.card a.ver{display:block;margin-top:10px;text-align:center;padding:9px;border-radius:10px;background:var(--c);color:#fff;font-weight:650;font-size:14px;text-decoration:none}' +
    '.midia{align-self:flex-start;max-width:84%;border-radius:14px;overflow:hidden}' +
    '.midia img{display:block;max-width:100%}' +
    '.digitando{align-self:flex-start;background:var(--bolha);border-radius:18px;border-bottom-left-radius:6px;padding:13px 15px;display:flex;gap:4px}' +
    '.digitando i{width:7px;height:7px;border-radius:50%;background:#A3A7B0;animation:pula 1.2s infinite}' +
    '.digitando i:nth-child(2){animation-delay:.15s}.digitando i:nth-child(3){animation-delay:.3s}' +
    '@keyframes pula{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-4px);opacity:1}}' +
    '.aviso{align-self:center;font-size:12.5px;color:var(--apagado);text-align:center;margin:6px 0}' +
    '.escrever{border-top:1px solid var(--linha);padding:10px 10px 10px 14px;display:flex;align-items:flex-end;gap:8px}' +
    '.escrever textarea{flex:1;resize:none;border:0;outline:0;font-size:15px;line-height:1.4;max-height:120px;padding:8px 0;color:var(--tinta);background:transparent}' +
    '.escrever textarea::placeholder{color:#9CA0A8}' +
    '.escrever button{width:40px;height:40px;flex:none;border:0;border-radius:12px;background:var(--c);color:#fff;cursor:pointer;display:grid;place-items:center;transition:opacity .15s}' +
    '.escrever button:disabled{opacity:.35;cursor:default}' +

    /* Formulário */
    '.form{padding:22px 20px 20px}' +
    '.form h3{font-size:19px;font-weight:750;letter-spacing:-.015em}' +
    '.form .sub{color:var(--apagado);font-size:13.5px;margin:4px 0 20px}' +
    '.campo{margin-bottom:14px}' +
    '.campo label{display:block;font-size:13px;font-weight:650;margin-bottom:6px}' +
    '.campo label span{font-weight:400;color:var(--apagado)}' +
    '.campo input,.campo select{display:block;width:100%;font-size:15px;padding:11px 12px;border:1px solid var(--linha);border-radius:11px;background:var(--campo);color:var(--tinta);outline:0;transition:border-color .15s,box-shadow .15s}' +
    '.campo input::placeholder{color:#9CA0A8}' +
    '.campo input:focus,.campo select:focus{border-color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 18%,transparent)}' +
    '.campo .tel{display:flex;gap:8px}.campo .tel select{width:104px;flex:none;padding-right:6px}' +
    '.campo .erro{color:#E11D48;font-size:12.5px;margin-top:5px}' +
    '.campo.invalido input{border-color:#E11D48}' +
    '.principal{width:100%;border:0;border-radius:12px;background:var(--c);color:#fff;font-weight:700;font-size:15px;padding:13px;cursor:pointer;margin-top:6px}' +
    '.principal:hover{background:var(--c-escuro)}' +
    '.principal:disabled{opacity:.6;cursor:default}' +
    '.pular{display:block;margin:12px auto 0;border:0;background:none;color:var(--apagado);font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}' +

    /* Ligação */
    '.ligacao{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(160deg,var(--c) 0%,var(--c-escuro) 100%);color:#fff;padding:24px;text-align:center;position:relative}' +
    '.ligacao .cantos{position:absolute;top:12px;left:10px;right:12px;display:flex;justify-content:space-between}' +
    '.ligacao .grande{width:104px;height:104px;border-radius:50%;background:rgba(255,255,255,.16);display:grid;place-items:center;position:relative}' +
    '.ligacao .grande svg{width:80px;height:80px;overflow:visible}.ligacao .grande img,.ligacao .grande video{width:100%;height:100%;object-fit:cover;border-radius:50%}' +
    '.ligacao .onda{position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(255,255,255,.4);animation:onda 1.8s ease-out infinite}' +
    '.ligacao .onda+.onda{animation-delay:.9s}' +
    '@keyframes onda{from{transform:scale(.92);opacity:1}to{transform:scale(1.4);opacity:0}}' +
    '.ligacao h2{font-size:21px;font-weight:750;letter-spacing:-.015em;margin-top:22px}' +
    '.ligacao .estado{font-size:15px;opacity:.88;margin-top:4px;font-variant-numeric:tabular-nums}' +
    '.ligacao .botoes{display:flex;gap:28px;margin-top:44px}' +
    '.ligacao .botoes span{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12.5px;font-weight:600;opacity:.95}' +
    '.redondo{width:62px;height:62px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.18);color:#fff;transition:transform .15s,background .15s}' +
    '.redondo:hover{transform:scale(1.06)}' +
    '.redondo.ativo{background:#fff;color:var(--c-texto)}' +
    '.redondo.vermelho{background:#E11D48;box-shadow:0 0 0 2px rgba(255,255,255,.9),0 10px 24px -8px rgba(0,0,0,.45)}.redondo.vermelho svg{transform:rotate(135deg)}' +
    '.marca{text-align:center;font-size:11px;color:#A3A7B0;padding:6px 0 8px;background:var(--fundo)}' +
    '.marca a{color:inherit;text-decoration:none}' +
    '@media (max-width:480px){.raiz{right:14px;bottom:14px}.raiz.aberto{inset:0}.raiz.aberto .botao{display:none}.painel{position:fixed;inset:0;width:auto;height:100%;border-radius:0}.convite{max-width:230px}}' +
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}'

  /* O robô: no botão ele acena em loop, pisca e a antena respira; no avatar
   * fica parado. Cores fixas de propósito: branco e visor escuro leem em cima
   * de qualquer cor de marca. */
  function robo(vivo) {
    return (
      '<svg class="robo' + (vivo ? ' vivo' : '') + '" viewBox="7 3 52 52" aria-hidden="true">' +
      '<g class="braco"><path d="M47 41 Q54 39 56 30" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="56.5" cy="27" r="4.6" fill="#fff"/></g>' +
      '<line x1="32" y1="19" x2="32" y2="12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      '<circle class="antena" cx="32" cy="10" r="3.4" fill="#FFD43B"/>' +
      '<rect x="11.5" y="28" width="5" height="10" rx="2.5" fill="#fff" opacity=".85"/>' +
      '<rect x="15" y="19" width="34" height="28" rx="10" fill="#fff"/>' +
      '<rect x="19.5" y="24.5" width="25" height="15" rx="7.5" fill="#16181D"/>' +
      '<g class="olhos"><rect x="24.5" y="28.5" width="4.6" height="5.6" rx="2.3" fill="#6EE7F9"/><rect x="34.9" y="28.5" width="4.6" height="5.6" rx="2.3" fill="#6EE7F9"/></g>' +
      '<path d="M28.5 36.2 Q32 38.4 35.5 36.2" stroke="#6EE7F9" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
      '<rect x="25" y="47" width="14" height="5" rx="2.5" fill="#fff" opacity=".85"/>' +
      '</svg>'
    )
  }
  function icone(d, tamanho, cheio) {
    return (
      '<svg viewBox="0 0 24 24" width="' + (tamanho || 20) + '" height="' + (tamanho || 20) + '" ' +
      (cheio ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') +
      ' aria-hidden="true">' + d + '</svg>'
    )
  }
  var FECHAR = '<path d="M6 6l12 12M18 6 6 18"/>'
  var ENVIAR = '<path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z"/>'
  var VOLTAR = '<path d="M15 18l-6-6 6-6"/>'
  var CASA = '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'
  var BALAO = '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/>'
  var RELOGIO = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  var MAIS = '<path d="M12 5v14M5 12h14"/>'
  var TELEFONE =
    '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>'
  var MICROFONE = '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'
  var MUDO = MICROFONE + '<path d="M4 4l16 16"/>'

  /* ------------------------------------------------------------------ */
  var host = document.createElement('div')
  host.setAttribute('data-autofluxos', 'chat')
  var sombra = host.attachShadow({ mode: 'open' })
  var estilo = document.createElement('style')
  estilo.textContent = CSS
  sombra.appendChild(estilo)

  var raiz = el('div', 'raiz')
  sombra.appendChild(raiz)

  var config = null
  var mensagens = []
  var pendentes = [] // bolhas do visitante ainda não gravadas: { ref, texto, conversa }
  var faltam = [] // campos do formulário que o servidor ainda não tem
  var aberto = false
  var tela = 'inicio' // inicio | mensagens | ficha | conversa
  var atual = null // a conversa aberta: o ref que a abriu, 'antiga', ou null para uma nova
  var ficha = null // o que o formulário coletou, até ir junto da primeira mensagem
  var errosDaFicha = {}
  var rascunho = ''
  var esperandoDesde = 0
  var vistas = Number(ler('vistas') || 0)
  var relogio = null
  var ultimaAssinatura = ''
  var painel, botao, naolidas, lista, campo, enviar

  function el(tag, classe, texto) {
    var e = document.createElement(tag)
    if (classe) e.className = classe
    if (texto !== undefined) e.textContent = texto
    return e
  }
  function botaoCom(classe, html, rotulo, acao) {
    var b = el('button', classe)
    b.type = 'button'
    if (html) b.innerHTML = html
    if (rotulo) b.setAttribute('aria-label', rotulo)
    if (acao) b.addEventListener('click', acao)
    return b
  }

  /* Links no texto viram clicáveis, sem innerHTML: o texto nunca é HTML. */
  function textoComLinks(alvo, texto) {
    var partes = String(texto).split(/(https?:\/\/[^\s]+)/g)
    for (var i = 0; i < partes.length; i++) {
      if (i % 2 === 1) {
        var a = el('a', null, partes[i])
        a.href = partes[i]
        a.target = '_blank'
        a.rel = 'noopener'
        alvo.appendChild(a)
      } else if (partes[i]) {
        alvo.appendChild(document.createTextNode(partes[i]))
      }
    }
  }

  /* O personagem da loja, quando ela mandou um, e o robô quando não. Vídeo vai
   * mudo, em loop e sem controles: é enfeite, e navegador de celular só toca
   * sozinho o que está mudo. */
  function personagem(alvo, vivo) {
    var m = config.mascote
    if (m && m.tipo === 'video') {
      var v = document.createElement('video')
      v.className = 'mascote'
      v.src = m.url
      v.muted = true
      v.autoplay = true
      v.loop = true
      v.playsInline = true
      v.setAttribute('aria-hidden', 'true')
      alvo.appendChild(v)
    } else if (m) {
      var img = el('img', 'mascote')
      img.src = m.url
      img.alt = ''
      alvo.appendChild(img)
    } else {
      alvo.insertAdjacentHTML('beforeend', robo(vivo))
    }
  }
  function avatar() {
    var a = el('span', 'avatar')
    personagem(a, false)
    return a
  }

  function pintarBotao() {
    botao.textContent = ''
    if (aberto) botao.innerHTML = icone(FECHAR, 27)
    else personagem(botao, true)
    botao.appendChild(naolidas)
  }

  function montarBotao() {
    botao = el('button', 'botao')
    botao.type = 'button'
    botao.setAttribute('aria-label', 'Abrir conversa')
    naolidas = el('span', 'naolidas')
    naolidas.hidden = true
    pintarBotao()
    // O mesmo botão abre e fecha: aberto, ele vira o X, e o X tem que fechar.
    botao.addEventListener('click', function () {
      if (aberto) fecharPainel()
      else abrir()
    })
    raiz.appendChild(botao)
  }

  function mostrarConvite() {
    if (aberto || ler('convite') || mensagens.length) return
    var convite = el('div', 'convite', config.saudacao)
    convite.setAttribute('role', 'status')
    var fechar = el('button', 'fechar', '×')
    fechar.type = 'button'
    fechar.setAttribute('aria-label', 'Dispensar')
    fechar.addEventListener('click', function (ev) {
      ev.stopPropagation()
      convite.remove()
      gravar('convite', '1')
    })
    convite.appendChild(fechar)
    convite.addEventListener('click', function () {
      convite.remove()
      abrir()
    })
    raiz.insertBefore(convite, botao)
  }

  function abrir() {
    if (aberto) return
    aberto = true
    var convite = raiz.querySelector('.convite')
    if (convite) convite.remove()
    gravar('convite', '1')
    painel = el('div', 'painel')
    painel.setAttribute('role', 'dialog')
    painel.setAttribute('aria-label', config.titulo)
    painel.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') fecharPainel()
    })
    raiz.classList.add('aberto')
    raiz.insertBefore(painel, botao)
    botao.setAttribute('aria-label', 'Fechar conversa')
    pintarBotao()
    if (ligacao) tela = 'ligacao'
    if (tela === 'conversa') marcarVistas()
    desenhar()
    buscar()
  }

  function fecharPainel() {
    if (!aberto) return
    aberto = false
    if (campo) rascunho = campo.value
    painel.remove()
    painel = lista = campo = enviar = null
    raiz.classList.remove('aberto')
    botao.setAttribute('aria-label', 'Abrir conversa')
    pintarBotao()
    botao.focus()
    agendar()
  }

  function marcarVistas() {
    vistas = contarEmpresa()
    gravar('vistas', String(vistas))
    naolidas.hidden = true
  }
  function contarEmpresa() {
    return mensagens.filter(function (m) {
      return m.de === 'empresa'
    }).length
  }
  function naoLidas() {
    return Math.max(0, contarEmpresa() - vistas)
  }

  /* ------------------------------------------------------------------ */
  /* As conversas: o fio do servidor, fatiado pelas marcas deste navegador. */
  function conversas() {
    var inicio = {}
    marcas().forEach(function (r) {
      inicio[r] = true
    })
    var todas = []
    var corrente = null
    for (var i = 0; i < mensagens.length; i++) {
      var m = mensagens[i]
      if (m.de === 'visitante' && m.ref && inicio[m.ref]) {
        corrente = { id: m.ref, mensagens: [] }
        todas.push(corrente)
      } else if (!corrente) {
        corrente = { id: 'antiga', mensagens: [] }
        todas.push(corrente)
      }
      corrente.mensagens.push(m)
    }
    return todas.reverse() // a mais recente primeiro
  }
  function conversaPorId(id) {
    var todas = conversas()
    for (var i = 0; i < todas.length; i++) if (todas[i].id === id) return todas[i]
    return null
  }
  function resumo(c) {
    var ultima = c.mensagens[c.mensagens.length - 1]
    var texto = ultima.texto || (ultima.produtos ? 'Produto enviado' : ultima.midia ? 'Arquivo enviado' : '')
    return { texto: (ultima.de === 'visitante' ? 'Você: ' : '') + texto, em: ultima.em }
  }
  function quando(iso) {
    var min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (!(min >= 0)) return ''
    if (min < 1) return 'agora'
    if (min < 60) return 'há ' + min + ' min'
    if (min < 1440) return 'há ' + Math.round(min / 60) + ' h'
    var d = new Date(iso)
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2)
  }

  /* O formulário aparece numa conversa nova quando falta algum obrigatório,
   * ou quando o visitante nunca o viu. Quem já respondeu ou pulou não é
   * perguntado de novo pelo que é opcional. */
  function precisaFicha() {
    if (!config.formulario || !config.formulario.length || ficha) return false
    var obrigatorioFaltando = config.formulario.some(function (c) {
      return c.obrigatorio && faltam.indexOf(c.tipo) >= 0
    })
    return obrigatorioFaltando || (faltam.length > 0 && !ler('ficha'))
  }

  function irPara(nova, conversa) {
    if (campo) rascunho = campo.value
    tela = nova
    if (conversa !== undefined) atual = conversa
    if (tela === 'conversa') marcarVistas()
    desenhar()
  }
  function novaConversa() {
    errosDaFicha = {}
    if (precisaFicha()) irPara('ficha', null)
    else irPara('conversa', null)
  }

  /* ------------------------------------------------------------------ */
  function desenhar() {
    if (!painel) return
    var rolagem = lista ? lista.parentNode.scrollHeight - lista.parentNode.scrollTop - lista.parentNode.clientHeight : 0
    var mesmaTela = painel.getAttribute('data-tela') === tela + ':' + atual
    var foco = sombra.activeElement
    painel.textContent = ''
    lista = campo = enviar = null
    painel.setAttribute('data-tela', tela + ':' + atual)

    if (tela === 'inicio') telaInicio()
    else if (tela === 'mensagens') telaMensagens()
    else if (tela === 'ficha') telaFicha()
    else if (tela === 'ligacao') telaLigacao()
    else telaConversa(mesmaTela ? rolagem : 0)

    var marca = el('div', 'marca')
    var link = el('a', null, 'Atendimento por AutoFluxos')
    link.href = 'https://4yu.com.br/'
    link.target = '_blank'
    link.rel = 'noopener'
    marca.appendChild(link)
    painel.appendChild(marca)

    if (tela === 'conversa' && campo && (!mesmaTela || (foco && foco.tagName === 'TEXTAREA'))) campo.focus()
  }

  function abas() {
    var barra = el('nav', 'abas')
    ;[
      ['inicio', 'Início', CASA],
      ['mensagens', 'Mensagens', BALAO],
    ].forEach(function (a) {
      var b = botaoCom(tela === a[0] ? 'ativa' : '', icone(a[2], 22), null, function () {
        irPara(a[0])
      })
      b.appendChild(document.createTextNode(a[1]))
      if (tela === a[0]) b.setAttribute('aria-current', 'page')
      if (a[0] === 'mensagens' && naoLidas() > 0) b.appendChild(el('span', 'ponto'))
      barra.appendChild(b)
    })
    return barra
  }

  function itemDaConversa(c, destaque) {
    var r = resumo(c)
    var b = botaoCom('item' + (destaque ? ' novo' : ''), null, null, function () {
      irPara('conversa', c.id)
    })
    b.appendChild(avatar())
    var txt = el('span', 'txt')
    txt.appendChild(el('b', null, r.texto || config.titulo))
    txt.appendChild(el('small', null, config.titulo + ' · ' + quando(r.em)))
    b.appendChild(txt)
    if (destaque) b.appendChild(el('span', 'ponto'))
    return b
  }

  function telaInicio() {
    var t = el('div', 'tela')
    var rolar = el('div', 'rolar')
    var capa = el('div', 'capa sobre-cor')
    var linha = el('div', 'linha')
    linha.appendChild(avatar())
    linha.appendChild(el('span', 'nome', config.titulo))
    linha.appendChild(botaoCom('fechar-topo', icone(FECHAR, 18), 'Fechar', fecharPainel))
    capa.appendChild(linha)
    capa.appendChild(el('h1', null, config.saudacao))
    capa.appendChild(el('p', 'sub', 'Precisa de ajuda? Inicie uma conversa.'))
    rolar.appendChild(capa)

    var cartoes = el('div', 'cartoes')
    var todas = conversas()
    var principal = el('div', 'cartao')
    var acao = botaoCom('acao', null, null, novaConversa)
    var txt = el('span', 'txt')
    txt.appendChild(el('b', null, 'Nova conversa'))
    var prazo = el('small')
    prazo.innerHTML = icone(RELOGIO, 14)
    prazo.appendChild(document.createTextNode(config.prazo))
    txt.appendChild(prazo)
    acao.appendChild(txt)
    var seta = el('span', 'seta')
    seta.innerHTML = icone(ENVIAR, 17, true)
    acao.appendChild(seta)
    principal.appendChild(acao)
    cartoes.appendChild(principal)

    if (todas.length) {
      var recentes = el('div', 'cartao')
      recentes.appendChild(el('h4', null, 'Continuar de onde parou'))
      recentes.appendChild(itemDaConversa(todas[0], naoLidas() > 0))
      cartoes.appendChild(recentes)
    }
    rolar.appendChild(cartoes)
    t.appendChild(rolar)
    t.appendChild(abas())
    painel.appendChild(t)
  }

  function telaMensagens() {
    var t = el('div', 'tela')
    var topo = el('div', 'titulo-aba')
    topo.appendChild(el('h2', null, 'Mensagens'))
    topo.appendChild(botaoCom('fechar-topo', icone(FECHAR, 18), 'Fechar', fecharPainel))
    t.appendChild(topo)

    var rolar = el('div', 'rolar')
    var novo = botaoCom('novo-chat', icone(MAIS, 18), null, novaConversa)
    novo.appendChild(document.createTextNode('Iniciar um novo chat'))
    rolar.appendChild(novo)

    var todas = conversas()
    if (todas.length) {
      rolar.appendChild(el('div', 'secao', 'Recentes'))
      todas.forEach(function (c, i) {
        rolar.appendChild(itemDaConversa(c, i === 0 && naoLidas() > 0))
      })
    } else {
      var vazio = el('div', 'vazio')
      vazio.innerHTML = icone(BALAO, 40)
      vazio.appendChild(el('p', null, 'Nenhuma conversa ainda. Quando você escrever, ela fica guardada aqui neste navegador.'))
      rolar.appendChild(vazio)
    }
    t.appendChild(rolar)
    t.appendChild(abas())
    painel.appendChild(t)
  }

  function topoDaConversa(volta) {
    var topo = el('div', 'topo sobre-cor')
    topo.appendChild(botaoCom('voltar', icone(VOLTAR, 22), 'Voltar', volta))
    topo.appendChild(avatar())
    var t = el('div', 't')
    t.appendChild(el('h2', null, config.titulo))
    t.appendChild(el('p', null, config.prazo))
    topo.appendChild(t)
    // Ligar só numa conversa que já existe: o servidor recusa contato sem
    // mensagem, e o botão não promete o que não vai cumprir.
    if (config.ligacao && tela === 'conversa' && atual && conversaPorId(atual) && window.RTCPeerConnection) {
      topo.appendChild(botaoCom('fechar-topo', icone(TELEFONE, 18, true), 'Ligar por voz', ligar))
    }
    topo.appendChild(botaoCom('fechar-topo', icone(FECHAR, 18), 'Fechar', fecharPainel))
    return topo
  }

  /* ------------------------------------------------------------------ */
  /* O formulário de antes da conversa. */
  var DDIS = [
    ['55', 'BR'], ['351', 'PT'], ['1', 'US'], ['54', 'AR'], ['595', 'PY'], ['598', 'UY'], ['56', 'CL'],
    ['57', 'CO'], ['52', 'MX'], ['51', 'PE'], ['34', 'ES'], ['39', 'IT'], ['49', 'DE'], ['33', 'FR'],
    ['44', 'GB'], ['81', 'JP'],
  ]
  var ROTULOS = { nome: 'Nome', email: 'E-mail', telefone: 'WhatsApp', cpf: 'CPF', cnpj: 'CNPJ' }
  var EXEMPLOS = {
    nome: 'Exemplo: Ana Souza',
    email: 'Exemplo: ana@empresa.com.br',
    telefone: 'Exemplo: (11) 98765-4321',
    cpf: 'Exemplo: 123.456.789-09',
    cnpj: 'Exemplo: 12.345.678/0001-90',
    proprio: 'Escreva aqui',
  }

  function so(v) {
    return String(v).replace(/\D/g, '')
  }
  function mascara(tipo, v, ddi) {
    var d = so(v)
    if (tipo === 'cpf') {
      d = d.slice(0, 11)
      return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
    }
    if (tipo === 'cnpj') {
      d = d.slice(0, 14)
      return d
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    }
    if (tipo === 'telefone' && ddi === '55') {
      d = d.slice(0, 11)
      if (d.length < 3) return d.length ? '(' + d : ''
      var corte = d.length > 10 ? 7 : 6
      return '(' + d.slice(0, 2) + ') ' + d.slice(2, corte) + (d.length > corte ? '-' + d.slice(corte) : '')
    }
    return v
  }

  /* As mesmas réguas de `src/core/chat-do-site.ts` e `src/core/documentos.ts`.
   * O servidor confere de novo; aqui é só para o erro aparecer antes. */
  function cpfOk(v) {
    var d = so(v)
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
    for (var ate = 9; ate <= 10; ate++) {
      var soma = 0
      for (var i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i)
      var resto = (soma * 10) % 11
      if ((resto === 10 ? 0 : resto) !== Number(d[ate])) return false
    }
    return true
  }
  function cnpjOk(v) {
    var d = so(v)
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
    for (var ate = 12; ate <= 13; ate++) {
      var soma = 0
      for (var i = 0; i < ate; i++) soma += Number(d[i]) * (((ate - 1 - i) % 8) + 2)
      var resto = soma % 11
      if ((resto < 2 ? 0 : 11 - resto) !== Number(d[ate])) return false
    }
    return true
  }
  function conferir(tipo, valor, ddi) {
    if (tipo === 'nome') return valor.replace(/\s+/g, ' ').length >= 2 ? '' : 'Escreva seu nome.'
    if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) ? '' : 'Confira o e-mail.'
    if (tipo === 'telefone') {
      var n = so(valor)
      if (ddi === '55') return n.length === 10 || n.length === 11 ? '' : 'Confira o número, com DDD.'
      return (ddi + n).length >= 8 && (ddi + n).length <= 15 ? '' : 'Confira o número.'
    }
    if (tipo === 'cpf') return cpfOk(valor) ? '' : 'CPF inválido. Confira os números.'
    if (tipo === 'cnpj') return cnpjOk(valor) ? '' : 'CNPJ inválido. Confira os números.'
    return valor.length <= 200 ? '' : 'Resposta longa demais.'
  }

  function telaFicha() {
    var t = el('div', 'tela')
    t.appendChild(topoDaConversa(function () {
      irPara(conversas().length ? 'mensagens' : 'inicio')
    }))
    var rolar = el('div', 'rolar')
    var f = el('form', 'form')
    f.noValidate = true
    f.appendChild(el('h3', null, 'Antes de começar'))
    f.appendChild(el('p', 'sub', 'Preencha para a equipe saber com quem está falando.'))

    var entradas = {}
    var anterior = ficha || {}
    var obrigatorios = 0
    config.formulario.forEach(function (c) {
      if (faltam.indexOf(c.tipo) < 0) return
      if (c.obrigatorio) obrigatorios++
      var caixa = el('div', 'campo' + (errosDaFicha[c.tipo] ? ' invalido' : ''))
      var id = 'af-' + c.tipo
      var rotulo = el('label', null, c.tipo === 'proprio' ? c.rotulo : ROTULOS[c.tipo])
      rotulo.htmlFor = id
      if (!c.obrigatorio) rotulo.appendChild(el('span', null, ' (opcional)'))
      caixa.appendChild(rotulo)

      var input = el('input')
      input.id = id
      input.placeholder = EXEMPLOS[c.tipo]
      input.value = anterior[c.tipo] ? String(anterior[c.tipo]).replace(/^\+\d+\s/, '') : ''
      if (c.tipo === 'nome') input.autocomplete = 'name'
      if (c.tipo === 'email') {
        input.type = 'email'
        input.autocomplete = 'email'
      }
      if (c.tipo === 'cpf' || c.tipo === 'cnpj' || c.tipo === 'telefone') input.inputMode = 'numeric'
      if (c.tipo === 'proprio') input.maxLength = 200

      var ddi = null
      if (c.tipo === 'telefone') {
        input.type = 'tel'
        input.autocomplete = 'tel-national'
        ddi = el('select')
        ddi.setAttribute('aria-label', 'Código do país')
        DDIS.forEach(function (p) {
          var o = el('option', null, p[1] + ' +' + p[0])
          o.value = p[0]
          ddi.appendChild(o)
        })
        var ddiAnterior = anterior.telefone && /^\+(\d+)\s/.exec(anterior.telefone)
        if (ddiAnterior) ddi.value = ddiAnterior[1]
        ddi.addEventListener('change', function () {
          input.value = mascara('telefone', input.value, ddi.value)
        })
        var tel = el('div', 'tel')
        tel.appendChild(ddi)
        tel.appendChild(input)
        caixa.appendChild(tel)
      } else {
        caixa.appendChild(input)
      }
      if (c.tipo === 'cpf' || c.tipo === 'cnpj' || c.tipo === 'telefone') {
        input.addEventListener('input', function () {
          input.value = mascara(c.tipo, input.value, ddi ? ddi.value : null)
        })
      }
      if (errosDaFicha[c.tipo]) {
        var erro = el('p', 'erro', errosDaFicha[c.tipo])
        erro.id = id + '-erro'
        input.setAttribute('aria-invalid', 'true')
        input.setAttribute('aria-describedby', erro.id)
        caixa.appendChild(erro)
      }
      entradas[c.tipo] = { campo: c, input: input, ddi: ddi }
      f.appendChild(caixa)
    })

    var ir = el('button', 'principal', 'Iniciar conversa')
    ir.type = 'submit'
    f.appendChild(ir)
    if (!obrigatorios) {
      f.appendChild(botaoCom('pular', null, null, function () {
        gravar('ficha', '1')
        irPara('conversa', null)
      }))
      f.lastChild.textContent = 'Pular e ir para a conversa'
    }

    f.addEventListener('submit', function (ev) {
      ev.preventDefault()
      var valores = {}
      var erros = {}
      Object.keys(entradas).forEach(function (tipo) {
        var e = entradas[tipo]
        var v = e.input.value.trim()
        if (!v) {
          if (e.campo.obrigatorio) erros[tipo] = 'Preencha este campo.'
          return
        }
        var problema = conferir(tipo, v, e.ddi && e.ddi.value)
        if (problema) erros[tipo] = problema
        else valores[tipo] = e.ddi ? '+' + e.ddi.value + ' ' + v : v
      })
      errosDaFicha = erros
      if (Object.keys(erros).length) {
        ficha = null
        desenhar()
        var primeiro = painel.querySelector('[aria-invalid]')
        if (primeiro) primeiro.focus()
        return
      }
      ficha = valores
      gravar('ficha', '1')
      irPara('conversa', null)
    })

    rolar.appendChild(f)
    t.appendChild(rolar)
    painel.appendChild(t)
    var primeiro = f.querySelector('[aria-invalid]') || f.querySelector('input')
    if (primeiro) setTimeout(function () { primeiro.focus() }, 0)
  }

  /* ------------------------------------------------------------------ */
  function telaConversa(distanciaDoFim) {
    var t = el('div', 'tela')
    t.appendChild(topoDaConversa(function () {
      irPara(conversas().length ? 'mensagens' : 'inicio')
    }))
    var rolar = el('div', 'rolar')
    lista = el('div', 'lista')
    lista.setAttribute('aria-live', 'polite')
    rolar.appendChild(lista)
    t.appendChild(rolar)

    var conversa = atual ? conversaPorId(atual) : null
    var msgs = conversa ? conversa.mensagens : []

    var saudacao = el('div', 'msg empresa')
    textoComLinks(saudacao, config.saudacao)
    lista.appendChild(saudacao)

    var ultimoAutor = null
    var ultimaEmpresa = -1
    for (var j = msgs.length - 1; j >= 0; j--) {
      if (msgs[j].de === 'empresa') {
        ultimaEmpresa = j
        break
      }
    }
    var minhas = pendentes.filter(function (p) {
      return p.conversa === atual
    })

    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i]
      if (m.de === 'empresa' && m.autor && m.autor !== ultimoAutor) {
        lista.appendChild(el('div', 'autor', m.autor))
      }
      ultimoAutor = m.de === 'empresa' ? m.autor || null : null

      if (m.produtos && m.produtos.length) {
        for (var p = 0; p < m.produtos.length; p++) lista.appendChild(cardDoProduto(m.produtos[p]))
      } else if (m.midia) {
        lista.appendChild(bolhaDeMidia(m))
      } else if (m.texto) {
        var b = el('div', 'msg ' + m.de)
        textoComLinks(b, m.texto)
        lista.appendChild(b)
      }

      if (m.opcoes && m.opcoes.length) {
        lista.appendChild(opcoesDe(msgs, i, i !== ultimaEmpresa || respondeuDepois(msgs, i, minhas)))
      }
    }

    for (var k = 0; k < minhas.length; k++) {
      lista.appendChild(el('div', 'msg visitante pendente', minhas[k].texto))
    }

    if (esperandoResposta() && (minhas.length || (msgs.length && msgs[msgs.length - 1].de === 'visitante'))) {
      var dig = el('div', 'digitando')
      dig.setAttribute('aria-label', 'Digitando')
      dig.innerHTML = '<i></i><i></i><i></i>'
      lista.appendChild(dig)
    }

    var escrever = el('form', 'escrever')
    campo = el('textarea')
    campo.rows = 1
    campo.placeholder = 'Escreva sua mensagem'
    campo.setAttribute('aria-label', 'Mensagem')
    campo.maxLength = 2000
    campo.value = rascunho
    enviar = el('button')
    enviar.type = 'submit'
    enviar.disabled = campo.value.trim() === ''
    enviar.setAttribute('aria-label', 'Enviar')
    enviar.innerHTML = icone(ENVIAR, 19, true)
    campo.addEventListener('input', function () {
      rascunho = campo.value
      enviar.disabled = campo.value.trim() === ''
      campo.style.height = 'auto'
      campo.style.height = Math.min(campo.scrollHeight, 120) + 'px'
    })
    campo.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
        ev.preventDefault()
        mandarTexto()
      }
    })
    escrever.addEventListener('submit', function (ev) {
      ev.preventDefault()
      mandarTexto()
    })
    escrever.appendChild(campo)
    escrever.appendChild(enviar)
    t.appendChild(escrever)
    painel.appendChild(t)

    rolar.scrollTop = distanciaDoFim < 80 || esperandoDesde ? rolar.scrollHeight : rolar.scrollHeight - rolar.clientHeight - distanciaDoFim
  }

  function respondeuDepois(msgs, i, minhas) {
    for (var j = i + 1; j < msgs.length; j++) if (msgs[j].de === 'visitante') return true
    return minhas.length > 0
  }

  function opcoesDe(msgs, i, respondida) {
    var m = msgs[i]
    var caixa = el('div', 'opcoes')
    var escolhida = null
    if (respondida) {
      for (var j = i + 1; j < msgs.length; j++) {
        if (msgs[j].de === 'visitante') {
          escolhida = msgs[j].texto
          break
        }
      }
    }
    m.opcoes.forEach(function (o) {
      var b = el('button', o.rotulo === escolhida ? 'escolhida' : null, o.rotulo)
      b.type = 'button'
      b.disabled = respondida
      b.addEventListener('click', function () {
        mandar({ opcao: { id: o.id, rotulo: o.rotulo } }, o.rotulo)
      })
      caixa.appendChild(b)
    })
    return caixa
  }

  function cardDoProduto(p) {
    var card = el('div', 'card')
    if (p.foto) {
      var img = el('img')
      img.src = p.foto
      img.alt = p.nome
      img.loading = 'lazy'
      card.appendChild(img)
    }
    var c = el('div', 'c')
    c.appendChild(el('h3', null, p.nome))
    if (p.detalhe) c.appendChild(el('p', null, p.detalhe))
    if (p.link) {
      var a = el('a', 'ver', 'Ver produto')
      a.href = p.link
      a.target = '_top'
      c.appendChild(a)
    }
    card.appendChild(c)
    return card
  }

  function bolhaDeMidia(m) {
    if (m.midia.tipo === 'imagem') {
      var caixa = el('div', 'midia')
      var img = el('img')
      img.src = m.midia.url
      img.alt = m.texto || 'Imagem'
      img.loading = 'lazy'
      caixa.appendChild(img)
      if (m.texto) {
        var legenda = el('div', 'msg empresa')
        textoComLinks(legenda, m.texto)
        var grupo = document.createDocumentFragment()
        grupo.appendChild(caixa)
        grupo.appendChild(legenda)
        return grupo
      }
      return caixa
    }
    var b = el('div', 'msg empresa')
    var a = el('a', null, m.midia.nomeArquivo || m.texto || 'Abrir arquivo')
    a.href = m.midia.url
    a.target = '_blank'
    a.rel = 'noopener'
    b.appendChild(a)
    return b
  }

  /* ------------------------------------------------------------------ */
  /* Ligação de voz: navegador com navegador, por WebRTC. O servidor só
   * guarda a oferta daqui e a resposta do atendente (`server/chamadas.ts`).
   * Cada lado junta todos os candidatos antes de mandar, então são duas
   * escritas, e daqui só se pergunta "atenderam?" uma vez por segundo. */
  var ligacao = null // { id, pc, micro, estado, desde, mudo, texto }
  var alto = null
  var rotuloDaLigacao = null

  function juntarCandidatos(pc) {
    return new Promise(function (pronto) {
      if (pc.iceGatheringState === 'complete') return pronto()
      var fim = function () {
        pc.removeEventListener('icegatheringstatechange', ver)
        pronto()
      }
      var ver = function () {
        if (pc.iceGatheringState === 'complete') fim()
      }
      pc.addEventListener('icegatheringstatechange', ver)
      setTimeout(fim, 3000)
    })
  }

  function textoDaLigacao() {
    if (!ligacao) return ''
    if (ligacao.estado === 'preparando') return 'Preparando o microfone'
    if (ligacao.estado === 'chamando') return 'Chamando'
    if (ligacao.estado === 'falando') {
      var s = Math.floor((Date.now() - ligacao.desde) / 1000)
      return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2)
    }
    return ligacao.texto
  }

  function ligar() {
    if (ligacao) return irPara('ligacao')
    var voltaPara = atual
    ligacao = { estado: 'preparando', mudo: false, volta: voltaPara }
    irPara('ligacao')
    var esta = ligacao
    pedir('/chamada')
      .then(function (r) {
        if (!r.ok) throw new Error('indisponível')
        return navigator.mediaDevices
          .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
          .then(
            function (micro) {
              return { ice: r.dados.iceServers, micro: micro }
            },
            function () {
              throw new Error('microfone')
            }
          )
      })
      .then(function (pronto) {
        if (ligacao !== esta) return pronto.micro.getTracks().forEach(function (t) { t.stop() })
        esta.micro = pronto.micro
        var pc = new RTCPeerConnection({ iceServers: pronto.ice })
        esta.pc = pc
        pronto.micro.getTracks().forEach(function (t) {
          pc.addTrack(t, pronto.micro)
        })
        pc.ontrack = function (e) {
          if (!alto) {
            alto = document.createElement('audio')
            alto.autoplay = true
            sombra.appendChild(alto)
          }
          alto.srcObject = e.streams[0] || new MediaStream([e.track])
          alto.play().catch(function () {})
        }
        pc.onconnectionstatechange = function () {
          if (pc.connectionState === 'failed' && ligacao === esta) desligar('A conexão caiu')
        }
        return pc
          .createOffer()
          .then(function (oferta) {
            return pc.setLocalDescription(oferta)
          })
          .then(function () {
            return juntarCandidatos(pc)
          })
          .then(function () {
            return pedir('/chamada', { metodo: 'POST', corpo: { oferta: pc.localDescription.sdp } })
          })
          .then(function (r) {
            if (ligacao !== esta) return
            if (!r.ok) return fimDaLigacao((r.dados && r.dados.erro) || 'Não deu para ligar agora.')
            esta.id = r.dados.id
            esta.estado = 'chamando'
            desenhar()
            vigiar(esta)
          })
      })
      .catch(function (e) {
        if (ligacao === esta) {
          fimDaLigacao(
            e && e.message === 'microfone'
              ? 'Libere o microfone do navegador para ligar.'
              : 'Não deu para ligar agora.'
          )
        }
      })
  }

  function vigiar(esta) {
    if (ligacao !== esta || !esta.id) return
    pedir('/chamada/' + esta.id).then(
      function (r) {
        if (ligacao !== esta) return
        var d = r.dados || {}
        if (r.ok && d.status === 'em_andamento' && d.resposta && esta.estado === 'chamando') {
          esta.pc.setRemoteDescription({ type: 'answer', sdp: d.resposta }).then(function () {
            esta.estado = 'falando'
            esta.desde = Date.now()
            desenhar()
          })
        } else if (r.ok && (d.status === 'perdida' || d.status === 'recusada')) {
          return fimDaLigacao('Ninguém pôde atender agora. Deixe sua mensagem na conversa.')
        } else if (r.ok && d.status === 'encerrada') {
          return fimDaLigacao('Ligação encerrada')
        }
        setTimeout(function () {
          vigiar(esta)
        }, esta.estado === 'falando' ? 2000 : 1000)
      },
      function () {
        setTimeout(function () {
          vigiar(esta)
        }, 2000)
      }
    )
  }

  function largarLigacao() {
    if (!ligacao) return
    if (ligacao.pc) ligacao.pc.close()
    if (ligacao.micro) ligacao.micro.getTracks().forEach(function (t) { t.stop() })
  }

  function fimDaLigacao(texto) {
    largarLigacao()
    var esta = ligacao
    esta.estado = 'fim'
    esta.texto = texto
    desenhar()
    setTimeout(function () {
      if (ligacao !== esta) return
      ligacao = null
      if (tela === 'ligacao') irPara('conversa', esta.volta)
    }, 3500)
  }

  function desligar(texto) {
    if (!ligacao) return
    var id = ligacao.id
    var duracao = ligacao.estado === 'falando' ? ' · ' + textoDaLigacao() : ''
    fimDaLigacao((texto || 'Ligação encerrada') + duracao)
    if (id) pedir('/chamada/' + id, { metodo: 'POST', corpo: { acao: 'encerrar' } }).catch(function () {})
  }

  function alternarMudo() {
    if (!ligacao || !ligacao.micro) return
    ligacao.mudo = !ligacao.mudo
    ligacao.micro.getAudioTracks().forEach(function (t) {
      t.enabled = !ligacao.mudo
    })
    desenhar()
  }

  /* Sair da página no meio da ligação desliga do lado do atendente também. */
  window.addEventListener('pagehide', function () {
    if (ligacao && ligacao.id && ligacao.estado !== 'fim') {
      fetch(api + '/chamada/' + ligacao.id, {
        method: 'POST',
        keepalive: true,
        headers: { 'x-visitante': segredo, 'content-type': 'application/json' },
        body: '{"acao":"encerrar"}',
        credentials: 'omit',
      }).catch(function () {})
    }
  })

  setInterval(function () {
    if (rotuloDaLigacao && ligacao && ligacao.estado === 'falando') rotuloDaLigacao.textContent = textoDaLigacao()
  }, 1000)

  function telaLigacao() {
    if (!ligacao) {
      tela = 'conversa'
      return telaConversa(0)
    }
    var t = el('div', 'ligacao')
    var cantos = el('div', 'cantos')
    cantos.appendChild(botaoCom('voltar', icone(VOLTAR, 22), 'Voltar para a conversa', function () {
      irPara('conversa', ligacao.volta)
    }))
    cantos.appendChild(botaoCom('fechar-topo', icone(FECHAR, 18), 'Fechar', fecharPainel))
    t.appendChild(cantos)

    var grande = el('div', 'grande')
    if (ligacao.estado === 'chamando' || ligacao.estado === 'preparando') {
      grande.appendChild(el('span', 'onda'))
      grande.appendChild(el('span', 'onda'))
    }
    personagem(grande, ligacao.estado === 'falando')
    t.appendChild(grande)
    t.appendChild(el('h2', null, config.titulo))
    rotuloDaLigacao = el('p', 'estado', textoDaLigacao())
    rotuloDaLigacao.setAttribute('aria-live', 'polite')
    t.appendChild(rotuloDaLigacao)

    if (ligacao.estado !== 'fim') {
      var botoes = el('div', 'botoes')
      if (ligacao.estado === 'falando') {
        var mudo = el('span')
        var bm = botaoCom('redondo' + (ligacao.mudo ? ' ativo' : ''), icone(ligacao.mudo ? MUDO : MICROFONE, 26), ligacao.mudo ? 'Ligar o microfone' : 'Desligar o microfone', alternarMudo)
        bm.setAttribute('aria-pressed', ligacao.mudo ? 'true' : 'false')
        mudo.appendChild(bm)
        mudo.appendChild(document.createTextNode(ligacao.mudo ? 'No mudo' : 'Mudo'))
        botoes.appendChild(mudo)
      }
      var fim = el('span')
      fim.appendChild(botaoCom('redondo vermelho', icone(TELEFONE, 26, true), 'Desligar', function () {
        desligar()
      }))
      fim.appendChild(document.createTextNode('Desligar'))
      botoes.appendChild(fim)
      t.appendChild(botoes)
    }
    painel.appendChild(t)
  }

  /* ------------------------------------------------------------------ */
  function esperandoResposta() {
    return esperandoDesde > 0 && Date.now() - esperandoDesde < 90000
  }

  function mandarTexto() {
    var texto = campo.value.trim()
    if (!texto) return
    campo.value = ''
    rascunho = ''
    mandar({ texto: texto }, texto)
  }

  function mandar(corpo, textoDaBolha) {
    var ref = aleatorio(12)
    // A primeira mensagem de uma conversa nova é a marca dela.
    if (atual === null) {
      marcar(ref)
      atual = ref
      if (ficha) corpo.ficha = ficha
    }
    var conversa = atual
    var fichaMandada = corpo.ficha || null
    pendentes.push({ ref: ref, texto: textoDaBolha, conversa: conversa })
    esperandoDesde = Date.now()
    desenhar()
    corpo.ref = ref
    corpo.pagina = location.href.slice(0, 500)
    pedir('/mensagens', { metodo: 'POST', corpo: corpo }).then(
      function (r) {
        if (r.ok) {
          if (fichaMandada) {
            ficha = null
            faltam = []
          }
          agendar(900)
          return
        }
        if (fichaMandada && r.dados && r.dados.erros) {
          // O servidor recusou o formulário: volta para ele com o erro de cada
          // campo, e a mensagem volta para a caixa de texto.
          desmarcar(ref)
          pendentes = pendentes.filter(function (p) { return p.ref !== ref })
          esperandoDesde = 0
          rascunho = textoDaBolha
          errosDaFicha = r.dados.erros
          irPara('ficha', null)
          return
        }
        falhou(ref, (r.dados && r.dados.erro) || 'Não deu para enviar.')
      },
      function () {
        falhou(ref, 'Sem conexão. Tente de novo.')
      }
    )
  }

  function desmarcar(ref) {
    gravar('conversas', JSON.stringify(marcas().filter(function (r) { return r !== ref })))
    if (atual === ref) atual = null
  }

  function falhou(ref, motivo) {
    var era = pendentes.filter(function (p) { return p.ref === ref })[0]
    pendentes = pendentes.filter(function (p) {
      return p.ref !== ref
    })
    // A conversa nova que não chegou a existir no servidor não vira marca.
    if (era && era.conversa === ref) desmarcar(ref)
    esperandoDesde = 0
    desenhar()
    if (lista) {
      lista.appendChild(el('div', 'aviso', motivo))
      lista.parentNode.scrollTop = lista.parentNode.scrollHeight
    }
  }

  function aplicar(dados) {
    var empresaAntes = contarEmpresa()
    mensagens = dados.mensagens || []
    if (Array.isArray(dados.faltam) && !ficha) faltam = dados.faltam
    var gravadas = {}
    mensagens.forEach(function (m) {
      if (m.ref) gravadas[m.ref] = true
    })
    pendentes = pendentes.filter(function (p) {
      return !gravadas[p.ref]
    })

    /* Chegou resposta nova: para de mostrar "digitando". */
    if (contarEmpresa() > empresaAntes && pendentes.length === 0) esperandoDesde = 0

    if (aberto && tela === 'conversa') marcarVistas()
    else if (naoLidas() > 0) {
      naolidas.textContent = String(naoLidas())
      naolidas.hidden = aberto
    }
    /* Só redesenha quando algo mudou: redesenhar a cada consulta apagaria o
     * que o visitante está digitando no formulário. */
    var assinatura = JSON.stringify([mensagens, pendentes.length, esperandoDesde > 0])
    if (aberto && assinatura !== ultimaAssinatura && tela !== 'ficha' && tela !== 'ligacao') desenhar()
    ultimaAssinatura = assinatura
  }

  function buscar() {
    clearTimeout(relogio)
    return pedir('/mensagens').then(
      function (r) {
        if (r.ok) aplicar(r.dados)
        agendar()
      },
      function () {
        agendar(15000)
      }
    )
  }

  /* Curto enquanto espera resposta, longo parado, nada com a aba escondida. */
  function agendar(ms) {
    clearTimeout(relogio)
    if (document.hidden) return
    if (!ms) {
      if (esperandoResposta()) ms = 1500
      else if (aberto) ms = 8000
      else if (mensagens.length) ms = 30000
      else return
    }
    relogio = setTimeout(buscar, ms)
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) buscar()
  })

  /* ------------------------------------------------------------------ */
  function iniciar() {
    fetch(api, { credentials: 'omit' })
      .then(function (r) {
        return r.ok ? r.json() : null
      })
      .then(function (c) {
        if (!c) return
        config = c
        if (!Array.isArray(config.formulario)) config.formulario = []
        if (!config.prazo) config.prazo = 'Costumamos responder em poucos minutos'
        if (c.tema === 'escuro') raiz.classList.add('escuro')
        estilo.textContent = CSS.replace('--c:#6366F1', '--c:' + c.cor)
        document.body.appendChild(host)
        montarBotao()
        buscar().then(function () {
          setTimeout(mostrarConvite, 4000)
        })
      })
      .catch(function () {})
  }

  if (document.body) iniciar()
  else document.addEventListener('DOMContentLoaded', iniciar)
})()
