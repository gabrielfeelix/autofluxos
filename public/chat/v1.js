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
    } catch (e) {}
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
    '*{box-sizing:border-box;font-family:inherit;margin:0}' +
    '.raiz{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:12px;color:var(--tinta);font-size:15px;line-height:1.45;-webkit-font-smoothing:antialiased}' +
    '.botao{width:58px;height:58px;border-radius:50%;border:0;background:var(--c);color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 10px 28px -8px color-mix(in srgb,var(--c) 70%,#000),0 2px 6px rgba(22,24,29,.18);transition:transform .18s ease;position:relative}' +
    '.botao:hover{transform:scale(1.05)}' +
    '.botao:focus-visible,button:focus-visible,a:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid color-mix(in srgb,var(--c) 45%,#fff);outline-offset:2px}' +
    '.botao svg{width:27px;height:27px}' +
    '.naolidas{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#E11D48;color:#fff;font-size:11.5px;font-weight:700;display:grid;place-items:center;border:2px solid #fff}' +
    '.convite{max-width:260px;background:var(--fundo);border-radius:16px 16px 4px 16px;padding:12px 34px 12px 14px;box-shadow:0 12px 32px -10px rgba(22,24,29,.35),0 0 0 1px var(--linha);font-size:14px;position:relative;cursor:pointer;animation:entra .45s cubic-bezier(.2,.8,.2,1)}' +
    '.convite .fechar{position:absolute;top:6px;right:6px;width:22px;height:22px;border:0;background:transparent;color:var(--apagado);cursor:pointer;border-radius:6px;font-size:16px;line-height:1}' +
    '@keyframes entra{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}' +
    '.painel{width:380px;height:min(620px,calc(100vh - 110px));background:var(--fundo);border-radius:20px;box-shadow:0 24px 60px -18px rgba(22,24,29,.45),0 0 0 1px rgba(22,24,29,.06);display:flex;flex-direction:column;overflow:hidden;transform-origin:bottom right;animation:abre .22s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes abre{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}' +
    '.topo{background:var(--c);color:#fff;padding:16px 14px 16px 18px;display:flex;align-items:center;gap:12px}' +
    '.topo .t{flex:1;min-width:0}' +
    '.topo h2{font-size:16px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.topo p{font-size:12.5px;opacity:.85;margin-top:1px}' +
    '.topo button{width:34px;height:34px;border:0;border-radius:10px;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;display:grid;place-items:center}' +
    '.topo button:hover{background:rgba(255,255,255,.24)}' +
    '.lista{flex:1;overflow-y:auto;padding:18px 14px 8px;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain}' +
    '.msg{max-width:84%;padding:9px 13px;border-radius:18px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}' +
    '.msg a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.empresa{align-self:flex-start;background:var(--bolha);border-bottom-left-radius:6px}' +
    '.visitante{align-self:flex-end;background:var(--c);color:#fff;border-bottom-right-radius:6px}' +
    '.visitante.pendente{opacity:.6}' +
    '.autor{align-self:flex-start;font-size:11.5px;color:var(--apagado);margin:8px 0 0 6px}' +
    '.opcoes{align-self:stretch;display:flex;flex-direction:column;gap:6px;margin:4px 0 6px;padding-left:2px}' +
    '.opcoes button{text-align:left;font-size:14.5px;padding:10px 14px;border-radius:12px;border:1.5px solid color-mix(in srgb,var(--c) 40%,var(--linha));background:var(--fundo);color:color-mix(in srgb,var(--c) 85%,#000);font-weight:600;cursor:pointer;transition:background .15s}' +
    '.opcoes button:hover:not(:disabled){background:color-mix(in srgb,var(--c) 8%,#fff)}' +
    '.opcoes button:disabled{cursor:default;opacity:.45}' +
    '.opcoes button.escolhida{opacity:1;background:color-mix(in srgb,var(--c) 12%,#fff)}' +
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
    '.ficha{align-self:stretch;margin:10px 0 6px;border:1px solid var(--linha);border-radius:16px;padding:14px;background:#FAFAFB}' +
    '.ficha p{font-size:13.5px;margin-bottom:10px}' +
    '.ficha input{display:block;width:100%;font-size:15px;padding:10px 12px;border:1px solid var(--linha);border-radius:10px;background:#fff;color:var(--tinta);margin-bottom:8px}' +
    '.ficha .acoes{display:flex;align-items:center;gap:12px;margin-top:2px}' +
    '.ficha .salvar{border:0;border-radius:10px;background:var(--c);color:#fff;font-weight:650;font-size:14px;padding:9px 16px;cursor:pointer}' +
    '.ficha .depois{border:0;background:none;color:var(--apagado);font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}' +
    '.ficha .erro{color:#BE123C;font-size:12.5px;margin:0 0 8px}' +
    '.aviso{align-self:center;font-size:12.5px;color:var(--apagado);text-align:center;margin:6px 0}' +
    '.escrever{border-top:1px solid var(--linha);padding:10px 10px 10px 14px;display:flex;align-items:flex-end;gap:8px}' +
    '.escrever textarea{flex:1;resize:none;border:0;outline:0;font-size:15px;line-height:1.4;max-height:120px;padding:8px 0;color:var(--tinta);background:transparent}' +
    '.escrever textarea::placeholder{color:#9CA0A8}' +
    '.escrever button{width:40px;height:40px;flex:none;border:0;border-radius:12px;background:var(--c);color:#fff;cursor:pointer;display:grid;place-items:center;transition:opacity .15s}' +
    '.escrever button:disabled{opacity:.35;cursor:default}' +
    '.marca{text-align:center;font-size:11px;color:#A3A7B0;padding:0 0 8px}' +
    '.marca a{color:inherit;text-decoration:none}' +
    '@media (max-width:480px){.raiz{right:14px;bottom:14px}.raiz.aberto{inset:0}.raiz.aberto .botao{display:none}.painel{position:fixed;inset:0;width:auto;height:100%;border-radius:0}.convite{max-width:230px}}' +
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}'

  var ICONE_CHAT =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.9 3 3 6.5 3 10.9c0 2.4 1.2 4.6 3.1 6.1-.1 1.3-.6 2.6-1.5 3.6-.2.3 0 .7.4.7 1.9-.1 3.6-.8 4.9-1.9.7.2 1.4.2 2.1.2 5.1 0 9-3.5 9-7.9S17.1 3 12 3Z"/></svg>'
  var ICONE_FECHAR =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  var ICONE_ENVIAR =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z"/></svg>'

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
  var pendentes = [] // bolhas do visitante ainda não gravadas
  var identificado = true
  var fichaDispensada = ler('ficha') === 'depois'
  var aberto = false
  var esperandoDesde = 0
  var vistas = Number(ler('vistas') || 0)
  var relogio = null
  var ultimaAssinatura = ''
  var painel, lista, campo, enviar, botao, naolidas

  function el(tag, classe, texto) {
    var e = document.createElement(tag)
    if (classe) e.className = classe
    if (texto !== undefined) e.textContent = texto
    return e
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

  function montarBotao() {
    botao = el('button', 'botao')
    botao.type = 'button'
    botao.setAttribute('aria-label', 'Abrir conversa')
    botao.innerHTML = ICONE_CHAT
    naolidas = el('span', 'naolidas')
    naolidas.hidden = true
    botao.appendChild(naolidas)
    botao.addEventListener('click', abrir)
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

  function montarPainel() {
    painel = el('div', 'painel')
    painel.setAttribute('role', 'dialog')
    painel.setAttribute('aria-label', config.titulo)

    var topo = el('div', 'topo')
    var t = el('div', 't')
    t.appendChild(el('h2', null, config.titulo))
    t.appendChild(el('p', null, 'Respondemos por aqui mesmo'))
    var fechar = el('button')
    fechar.type = 'button'
    fechar.setAttribute('aria-label', 'Fechar conversa')
    fechar.innerHTML = ICONE_FECHAR
    fechar.addEventListener('click', fecharPainel)
    topo.appendChild(t)
    topo.appendChild(fechar)

    lista = el('div', 'lista')
    lista.setAttribute('aria-live', 'polite')

    var escrever = el('form', 'escrever')
    campo = el('textarea')
    campo.rows = 1
    campo.placeholder = 'Escreva sua mensagem'
    campo.setAttribute('aria-label', 'Mensagem')
    campo.maxLength = 2000
    enviar = el('button')
    enviar.type = 'submit'
    enviar.disabled = true
    enviar.setAttribute('aria-label', 'Enviar')
    enviar.innerHTML = ICONE_ENVIAR
    campo.addEventListener('input', function () {
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

    var marca = el('div', 'marca')
    var link = el('a', null, 'Atendimento por AutoFluxos')
    link.href = 'https://4yu.com.br/'
    link.target = '_blank'
    link.rel = 'noopener'
    marca.appendChild(link)

    painel.appendChild(topo)
    painel.appendChild(lista)
    painel.appendChild(escrever)
    painel.appendChild(marca)
    painel.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') fecharPainel()
    })
  }

  function abrir() {
    if (aberto) return
    aberto = true
    var convite = raiz.querySelector('.convite')
    if (convite) convite.remove()
    gravar('convite', '1')
    if (!painel) montarPainel()
    raiz.classList.add('aberto')
    raiz.insertBefore(painel, botao)
    botao.setAttribute('aria-label', 'Fechar conversa')
    botao.innerHTML = ICONE_FECHAR
    botao.appendChild(naolidas)
    marcarVistas()
    desenhar()
    campo.focus()
    buscar()
  }

  function fecharPainel() {
    if (!aberto) return
    aberto = false
    painel.remove()
    raiz.classList.remove('aberto')
    botao.setAttribute('aria-label', 'Abrir conversa')
    botao.innerHTML = ICONE_CHAT
    botao.appendChild(naolidas)
    botao.focus()
    agendar()
  }

  function marcarVistas() {
    vistas = mensagens.filter(function (m) {
      return m.de === 'empresa'
    }).length
    gravar('vistas', String(vistas))
    naolidas.hidden = true
  }

  /* ------------------------------------------------------------------ */
  function desenhar() {
    if (!lista) return
    var perto = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80
    lista.textContent = ''

    var saudacao = el('div', 'msg empresa')
    textoComLinks(saudacao, config.saudacao)
    lista.appendChild(saudacao)

    var ultimoAutor = null
    var ultimaEmpresa = -1
    for (var j = mensagens.length - 1; j >= 0; j--) {
      if (mensagens[j].de === 'empresa') {
        ultimaEmpresa = j
        break
      }
    }

    for (var i = 0; i < mensagens.length; i++) {
      var m = mensagens[i]
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
        lista.appendChild(opcoesDe(m, i !== ultimaEmpresa || respondeuDepois(i)))
      }

      if (m.de === 'visitante' && precisaFicha(i)) lista.appendChild(ficha())
    }

    for (var k = 0; k < pendentes.length; k++) {
      var pend = el('div', 'msg visitante pendente')
      pend.textContent = pendentes[k].texto
      lista.appendChild(pend)
    }

    if (esperandoResposta()) {
      var dig = el('div', 'digitando')
      dig.setAttribute('aria-label', 'Digitando')
      dig.innerHTML = '<i></i><i></i><i></i>'
      lista.appendChild(dig)
    }

    if (perto || esperandoDesde) lista.scrollTop = lista.scrollHeight
  }

  function respondeuDepois(i) {
    for (var j = i + 1; j < mensagens.length; j++) if (mensagens[j].de === 'visitante') return true
    return pendentes.length > 0
  }

  /* A ficha aparece logo depois da primeira mensagem do visitante. */
  function precisaFicha(i) {
    if (identificado || fichaDispensada || !config.pedirContato) return false
    for (var j = 0; j < i; j++) if (mensagens[j].de === 'visitante') return false
    return true
  }

  function opcoesDe(m, respondida) {
    var caixa = el('div', 'opcoes')
    var escolhida = null
    if (respondida) {
      for (var j = mensagens.indexOf(m) + 1; j < mensagens.length; j++) {
        if (mensagens[j].de === 'visitante') {
          escolhida = mensagens[j].texto
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

  function ficha() {
    var f = el('form', 'ficha')
    f.appendChild(el('p', null, 'Para não perder a conversa, como falamos com você?'))
    var erro = el('p', 'erro')
    erro.hidden = true
    var nome = el('input')
    nome.placeholder = 'Seu nome'
    nome.autocomplete = 'name'
    nome.setAttribute('aria-label', 'Seu nome')
    var contato = el('input')
    contato.placeholder = 'WhatsApp com DDD ou e-mail'
    contato.autocomplete = 'tel'
    contato.setAttribute('aria-label', 'WhatsApp com DDD ou e-mail')
    var acoes = el('div', 'acoes')
    var salvar = el('button', 'salvar', 'Salvar')
    salvar.type = 'submit'
    var depois = el('button', 'depois', 'Agora não')
    depois.type = 'button'
    depois.addEventListener('click', function () {
      fichaDispensada = true
      gravar('ficha', 'depois')
      desenhar()
    })
    f.addEventListener('submit', function (ev) {
      ev.preventDefault()
      salvar.disabled = true
      pedir('/contato', { metodo: 'POST', corpo: { nome: nome.value, contato: contato.value } }).then(
        function (r) {
          salvar.disabled = false
          if (r.ok) {
            identificado = true
            desenhar()
          } else {
            erro.textContent = (r.dados && r.dados.erro) || 'Não deu para salvar. Confira os dados.'
            erro.hidden = false
          }
        },
        function () {
          salvar.disabled = false
          erro.textContent = 'Sem conexão. Tente de novo.'
          erro.hidden = false
        }
      )
    })
    acoes.appendChild(salvar)
    acoes.appendChild(depois)
    f.appendChild(erro)
    f.appendChild(nome)
    f.appendChild(contato)
    f.appendChild(acoes)
    return f
  }

  /* ------------------------------------------------------------------ */
  function esperandoResposta() {
    return esperandoDesde > 0 && Date.now() - esperandoDesde < 90000
  }

  function mandarTexto() {
    var texto = campo.value.trim()
    if (!texto) return
    campo.value = ''
    campo.style.height = 'auto'
    enviar.disabled = true
    mandar({ texto: texto }, texto)
  }

  function mandar(corpo, textoDaBolha) {
    var ref = aleatorio(12)
    pendentes.push({ ref: ref, texto: textoDaBolha })
    esperandoDesde = Date.now()
    desenhar()
    corpo.ref = ref
    corpo.pagina = location.href.slice(0, 500)
    pedir('/mensagens', { metodo: 'POST', corpo: corpo }).then(
      function (r) {
        if (!r.ok) falhou(ref, (r.dados && r.dados.erro) || 'Não deu para enviar.')
        else agendar(900)
      },
      function () {
        falhou(ref, 'Sem conexão. Tente de novo.')
      }
    )
  }

  function falhou(ref, motivo) {
    pendentes = pendentes.filter(function (p) {
      return p.ref !== ref
    })
    esperandoDesde = 0
    desenhar()
    if (lista) {
      lista.appendChild(el('div', 'aviso', motivo))
      lista.scrollTop = lista.scrollHeight
    }
  }

  function aplicar(dados) {
    var ultimaEmpresaAntes = contarEmpresa()
    mensagens = dados.mensagens || []
    identificado = dados.identificado !== false
    var gravadas = {}
    mensagens.forEach(function (m) {
      if (m.ref) gravadas[m.ref] = true
    })
    pendentes = pendentes.filter(function (p) {
      return !gravadas[p.ref]
    })

    /* Chegou resposta nova: para de mostrar "digitando". */
    if (contarEmpresa() > ultimaEmpresaAntes && pendentes.length === 0) esperandoDesde = 0

    var novas = contarEmpresa() - vistas
    if (aberto) marcarVistas()
    else if (novas > 0) {
      naolidas.textContent = String(novas)
      naolidas.hidden = false
    }
    /* Só redesenha quando algo mudou: redesenhar a cada consulta apagaria o
     * que o visitante está digitando na ficha. */
    var assinatura = JSON.stringify([mensagens, pendentes.length, esperandoDesde > 0, identificado])
    if (aberto && assinatura !== ultimaAssinatura) desenhar()
    ultimaAssinatura = assinatura
  }

  function contarEmpresa() {
    return mensagens.filter(function (m) {
      return m.de === 'empresa'
    }).length
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
        host.style.setProperty('--c', c.cor)
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
