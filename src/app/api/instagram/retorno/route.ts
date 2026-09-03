import { redirect } from 'next/navigation'
import { alertar } from '@/server/alertar'
import { trocarCodigoPorConta } from '@/server/instagram/conexao'
import { lerEstado } from '@/server/instagram/estado'
import { salvarContaDoInstagram } from '@/server/repos/canais-instagram'
import { conferirAcessoAoCliente } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Onde a Meta devolve o dono do perfil depois de ele autorizar.
 *
 * **Duas conferências, e nenhuma substitui a outra.** O `state` prova *qual
 * cliente* começou a conexão — é ele que impede um link forjado ligar uma conta
 * de Instagram ao cliente errado. A sessão prova *quem está pedindo*, e é
 * conferida de novo aqui: esta rota é pública por obrigação, porque quem a
 * chama é o navegador vindo do instagram.com.
 *
 * **A resposta é sempre um redirect para a tela**, com o resultado na URL. O
 * navegador de quem autorizou está aqui, e ele espera voltar para o painel —
 * um JSON na cara de quem clicou em "Conectar" seria a tela do produto virando
 * um endpoint.
 */
export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams

  const clienteId = lerEstado(parametros.get('state'))
  if (!clienteId) {
    // Sem bilhete válido não há para onde voltar com contexto: nem sabemos de
    // que cliente era. A lista é o único destino honesto.
    redirect('/painel?erro=instagram_estado')
  }

  const destino = `/clientes/${clienteId}/instagram`

  // Quem autorizou pode não ser quem tem acesso a este cliente. O bilhete diz
  // qual cliente; só a sessão diz se esta pessoa pode mexer nele.
  if (!(await conferirAcessoAoCliente(clienteId))) {
    redirect('/painel?erro=instagram_acesso')
  }

  /*
   * A pessoa clicou em "Cancelar" na tela da Meta.
   *
   * Vem como `error=access_denied`, e não é falha: é resposta. Tratar junto com
   * erro de verdade faria a tela pedir para investigar uma decisão que alguém
   * tomou de propósito.
   */
  if (parametros.get('error')) {
    redirect(`${destino}?resultado=cancelado`)
  }

  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?resultado=sem_codigo`)

  try {
    const conta = await trocarCodigoPorConta({
      codigo,
      origem: new URL(req.url).origin,
    })

    await salvarContaDoInstagram({
      clienteId,
      igUserId: conta.igUserId,
      username: conta.username,
      token: conta.token,
      expiraEm: conta.expiraEm,
    })
  } catch (erro) {
    /*
     * `redirect()` funciona lançando uma exceção, então ele **não pode** ficar
     * dentro deste `try` — seria capturado aqui e virado em "falhou". É a
     * pegadinha clássica do App Router, e ela transforma um sucesso em erro.
     */
    await alertar('a conexão do Instagram falhou', erro, { cliente: clienteId })
    redirect(`${destino}?resultado=falhou`)
  }

  redirect(`${destino}?resultado=conectado`)
}
