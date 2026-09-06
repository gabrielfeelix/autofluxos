/*
 * O service worker que recebe o aviso de handoff.
 *
 * Ele existe porque push do navegador **só** chega aqui: quando o painel está
 * fechado — que é o caso inteiro desta rodada — não há página nenhuma para
 * receber o evento. O worker roda sem aba aberta, e é isso que faz o aviso
 * alcançar o telefone no bolso.
 *
 * Mora em `public/` e não em `src/`: ele precisa ser servido da raiz do site
 * (`/sw-push.js`) para poder controlar o site inteiro. Um worker servido de
 * `/_next/...` só controlaria aquele caminho.
 *
 * Ele não tem estado, não guarda nada e não lê conversa: o corpo do aviso vem
 * cifrado do servidor e é usado uma vez, para desenhar a notificação.
 */

self.addEventListener('push', (evento) => {
  /*
   * Push sem dado legível ainda vira notificação.
   *
   * O navegador exige que **todo** push recebido mostre algo: um `push` que
   * não notifica faz o Chrome revogar a permissão do site depois de algumas
   * vezes. Um aviso genérico é ruim; ficar sem permissão nenhuma é pior.
   */
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = {}
  }

  const titulo = dados.titulo || 'Alguém está esperando atendimento'
  const corpo = dados.corpo || 'o bot passou uma conversa para uma pessoa'

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      /*
       * Sem `icon`/`badge` de propósito: não existe ícone do produto em
       * `public/` hoje, e apontar para um arquivo que não existe é pior do que
       * não apontar — o navegador desenha o quadrado vazio em vez do ícone
       * genérico dele. Quando o ícone nascer, ele entra aqui.
       */
      /*
       * Uma notificação por contato, substituindo a anterior.
       *
       * Sem `tag`, três mensagens do mesmo lead viram três tiras empilhadas na
       * tela de bloqueio — que é o tipo de coisa que faz alguém desligar o
       * aviso. Com ela, a mais recente substitui a anterior daquele contato.
       */
      tag: dados.contatoId ? `handoff-${dados.contatoId}` : 'handoff',
      data: { url: dados.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/'

  /*
   * Reaproveitar a aba que já existe, em vez de abrir a décima.
   *
   * Quem atende deixa o painel aberto o dia todo. Abrir uma aba nova a cada
   * aviso deixaria vinte abas do mesmo produto até o fim do expediente.
   */
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if ('focus' in aba) {
          aba.navigate(destino)
          return aba.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
