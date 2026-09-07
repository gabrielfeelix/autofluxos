import 'server-only'
import webpush from 'web-push'
import { quemAvisar, textoDoAviso } from '@/core/aviso-de-handoff'
import { SEMPRE_ABERTO } from '@/core/horario'
import { alertar } from './alertar'
import { horarioDoCliente } from './repos/clientes'
import { apagarAssinatura, assinaturasDe } from './repos/assinaturas-de-push'
import { membrosDaConta } from './repos/usuarios'

/**
 * O aviso que alcança quem **não** está com o painel aberto.
 *
 * `NotificacoesDaFila` avisa quem está olhando a tela; este módulo é a outra
 * metade — o telefone no bolso, o painel fechado, que é onde o §3.10.1 diz
 * estar o elo mais fraco do produto.
 *
 * **Melhor-esforço, sempre.** Falhar ao avisar não pode desfazer o handoff:
 * quem está esperando tem que aparecer na tela mesmo quando push nenhum saiu.
 * Toda falha daqui vira alerta e a conversa segue — a mesma regra do
 * `mover_etapa` e da etiqueta.
 *
 * **O e-mail ficou de fora, e não por esquecimento.** O plano da rodada dizia
 * "o Better Auth já tem SMTP configurado; reusar". Não tem: `auth.ts:89` diz,
 * com estas palavras, que ligar verificação por e-mail *exige* SMTP, que é
 * global ao projeto compartilhado com a Verandi, e por isso está desligada. Não
 * há credencial de SMTP no `.secrets` nem na Vercel, e contratá-la é decisão
 * que atinge os dois produtos. Push não depende de terceiro nenhum — a chave é
 * nossa, gerada aqui — então ele entrou inteiro e o e-mail ficou registrado
 * como pendência com dono. Ver docs/HANDOFF-06-SET-NOITE.md.
 */

const PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const PRIVADA = process.env.VAPID_PRIVATE_KEY ?? ''
const ASSUNTO = process.env.VAPID_SUBJECT ?? 'mailto:contato@4yu.com.br'

/** Sem chave configurada, o produto segue como sempre foi: sem push. */
export function pushConfigurado(): boolean {
  return PUBLICA !== '' && PRIVADA !== ''
}

let preparado = false
function prepararWebPush() {
  if (preparado) return
  webpush.setVapidDetails(ASSUNTO, PUBLICA, PRIVADA)
  preparado = true
}

/**
 * Um endereço que o fabricante diz não existir mais.
 *
 * `404`/`410` é o navegador desinstalado, o site removido das permissões, a
 * assinatura expirada. A linha tem que sair: mantê-la faz toda notificação
 * futura gastar uma chamada para receber o mesmo erro, e mascara a contagem de
 * quantas pessoas o produto realmente alcança.
 */
function assinaturaMorta(erro: unknown): boolean {
  const status = (erro as { statusCode?: number } | null)?.statusCode
  return status === 404 || status === 410
}

export async function avisarHandoff({
  clienteId,
  contatoId,
  nomeDoContato,
  motivo,
  avisarUsuarioId,
}: {
  clienteId: string
  contatoId: string
  nomeDoContato: string | null
  motivo: string
  /**
   * Quando o bloco de handoff endereçou o aviso a alguém.
   *
   * Ausente = a equipe toda, que é o padrão e o certo para a maioria dos
   * casos: quem estiver disponível pega.
   */
  avisarUsuarioId?: string
}): Promise<void> {
  if (!pushConfigurado()) return

  try {
    const [membros, horario] = await Promise.all([
      membrosDaConta(clienteId),
      horarioDoCliente(clienteId),
    ])

    const decisao = quemAvisar(
      membros.map((m) => ({
        usuarioId: m.id,
        email: m.email,
        nome: m.nome,
        papel: m.papel,
        presenca: m.presenca,
      })),
      // `null` é "atende sempre", e não "nunca atende" — a mesma leitura que o
      // resto do produto faz da coluna vazia.
      horario ?? SEMPRE_ABERTO,
    )
    if (!decisao.avisar) return

    /*
     * O bloco escolheu alguém: avisa só essa pessoa — **se ela ainda atende**.
     *
     * "Ainda atende" é o resultado de `quemAvisar`, ou seja, ela continua na
     * conta, com papel de atendimento e não marcada como ausente. Fora disso,
     * o aviso volta a ser da equipe inteira: um aviso endereçado a quem saiu
     * da empresa, ou a quem está de férias, é um aviso que ninguém recebe — e
     * o handoff continuaria esperando calado, que é exatamente o buraco que
     * este módulo existe para fechar.
     *
     * Fora do horário e presença continuam valendo antes disto: escolher uma
     * pessoa no desenho do fluxo não autoriza tocar o telefone dela às 3h.
     */
    const escolhidos = avisarUsuarioId
      ? decisao.destinatarios.filter((d) => d.usuarioId === avisarUsuarioId)
      : []
    const destinatarios = escolhidos.length > 0 ? escolhidos : decisao.destinatarios

    const assinaturas = await assinaturasDe(
      clienteId,
      destinatarios.map((d) => d.usuarioId),
    )
    if (assinaturas.length === 0) return

    prepararWebPush()
    const { titulo, corpo } = textoDoAviso(nomeDoContato, motivo)
    const carga = JSON.stringify({
      titulo,
      corpo,
      // Para onde o clique leva. É o que transforma o aviso em atendimento em
      // vez de em "abra o painel e procure".
      url: `/clientes/${clienteId}/inbox?conversa=${contatoId}`,
      contatoId,
    })

    /*
     * Um aparelho que falha não pode calar os outros.
     *
     * `allSettled`, e não `all`: com `all`, um endpoint morto — que é o caso
     * mais comum de todos — abortaria o envio para quem ainda está lá.
     */
    const envios = await Promise.allSettled(
      assinaturas.map((assinatura) =>
        webpush.sendNotification(
          {
            endpoint: assinatura.endpoint,
            keys: { p256dh: assinatura.p256dh, auth: assinatura.auth },
          },
          carga,
        ),
      ),
    )

    for (const [indice, envio] of envios.entries()) {
      if (envio.status === 'fulfilled') continue
      const assinatura = assinaturas[indice]
      if (!assinatura) continue

      if (assinaturaMorta(envio.reason)) {
        await apagarAssinatura(assinatura.endpoint).catch(() => {})
        continue
      }
      await alertar('não deu para mandar o push de handoff', envio.reason, {
        contato: contatoId,
      })
    }
  } catch (erro) {
    // A regra que vale mais que tudo aqui: o handoff já está registrado.
    await alertar('não deu para avisar do handoff', erro, { contato: contatoId })
  }
}
