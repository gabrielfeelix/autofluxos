import { redirect } from 'next/navigation'
import { lerSegredo } from '@/agendas/comum'
import { montarConector } from '@/server/agenda-externa'
import { alertar } from '@/server/alertar'
import { trocarCodigoDoGoogle } from '@/server/google-agenda/conexao'
import { ligarGoogleAgenda } from '@/server/google-agenda/ligar'
import { concluirConexao } from '@/server/instagram/estado'
import { agendasDaConta } from '@/server/repos/agendas'
import { lerCredencial } from '@/server/repos/conexoes'
import { conferirAcessoAoCliente, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * A volta da autorização do Google Agenda.
 *
 * O `state` diz de que conta é e só vale com o cookie do início. A pessoa pode
 * desmarcar a permissão da agenda na tela do Google (consentimento granular):
 * sem `calendar.events` nos escopos devolvidos, nada é ligado.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const parametros = url.searchParams
  const clienteId = await concluirConexao(parametros.get('state'))
  if (!clienteId) redirect('/painel?erro=google_agenda_estado')

  const destino = `/clientes/${clienteId}/ajustes/integracoes/sistemas`
  if ((await sessaoAtual()) === null || !(await conferirAcessoAoCliente(clienteId))) redirect(`${destino}?google=acesso`)
  if (parametros.get('error')) redirect(`${destino}?google=cancelado`)
  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?google=cancelado`)

  let resultado = 'conectado'
  try {
    const { refreshToken, email, escopos } = await trocarCodigoDoGoogle({ codigo, origem: url.origin })
    if (!escopos.includes('calendar.events')) {
      resultado = 'sem_permissao'
    } else {
      await ligarGoogleAgenda({ clienteId, refreshToken, email })
      // Confere de verdade: um evento lido prova token, escopo e agenda.
      const agenda = (await agendasDaConta(clienteId)).find((a) => a.plataforma === 'google_agenda')
      const credencial = agenda?.conexaoId ? await lerCredencial(agenda.conexaoId, clienteId) : null
      const conferido = agenda && credencial
        ? await montarConector('google_agenda', lerSegredo(credencial.valor), agenda.ajustes).conferir()
        : { ok: false as const, motivo: 'a agenda não foi gravada' }
      if (!conferido.ok) throw new Error(conferido.motivo)
    }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('não foi possível ligar o Google Agenda', detalhe, { clienteId })
    resultado = 'falhou'
  }
  redirect(`${destino}?google=${resultado}`)
}
