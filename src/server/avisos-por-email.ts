import 'server-only'
import { ESCOPOS_DA_API } from '@/core/api/chaves'
import { CONTATO } from '@/core/email/layout'
import { ROTULO_DA_FUNCAO, type IdDaFuncao } from '@/core/funcoes'
import { enviarModelo, linkDoPainel, type Destinatario } from './email'
import { acharCliente } from './repos/clientes'
import { membrosDaConta } from './repos/usuarios'

/**
 * Os e-mails que saem de um acontecimento do produto, um por função.
 *
 * Quem chama passa o que já tem na mão e chama dentro de `after()`: a resposta
 * de quem clicou não espera a Brevo. **Nada daqui lança.** Um aviso que falha
 * vira linha no log e a ação de quem clicou segue intacta; o mesmo contrato de
 * `avisar-handoff.ts`.
 *
 * Os textos e o desenho estão em `core/email/modelos.ts`. Aqui só se decide
 * **para quem** vai e se formata o que o modelo recebe pronto.
 */

const DIA_E_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

/** "19 de outubro, às 14:32", no horário de São Paulo. */
export function quando(agora = new Date()): string {
  const partes = Object.fromEntries(DIA_E_HORA.formatToParts(agora).map((parte) => [parte.type, parte.value]))
  return `${partes.day} de ${partes.month}, às ${partes.hour}:${partes.minute}`
}

async function semFalhar(rotulo: string, envio: () => Promise<unknown>): Promise<void> {
  try {
    await envio()
  } catch (erro) {
    console.error(`[email] o aviso "${rotulo}" não saiu`, erro)
  }
}

/** Dono e administradores: quem responde pela organização. */
export async function gestoresDaConta(clienteId: string): Promise<Destinatario[]> {
  const membros = await membrosDaConta(clienteId)
  return membros.filter((membro) => membro.papel === 'owner' || membro.papel === 'admin').map(({ email, nome }) => ({ email, nome }))
}

async function nomeDaOrganizacao(clienteId: string): Promise<string> {
  return (await acharCliente(clienteId))?.nome ?? 'sua organização'
}

const linkDoPlano = (clienteId: string) => linkDoPainel(`/clientes/${clienteId}/ajustes/plano`)

// ---------------------------------------------------------------------------
// Conta e segurança
// ---------------------------------------------------------------------------

export function avisarBoasVindas(pessoa: Destinatario, organizacao: { id: string; nome: string }) {
  return semFalhar('boas-vindas', () =>
    enviarModelo(pessoa, 'boasVindas', { nome: pessoa.nome ?? '', organizacao: organizacao.nome, link: linkDoPainel(`/clientes/${organizacao.id}`) }),
  )
}

export function avisarSenhaAlterada(pessoa: Destinatario) {
  return semFalhar('senha alterada', () =>
    enviarModelo(pessoa, 'senhaAlterada', { nome: pessoa.nome ?? '', quando: quando(), link: linkDoPainel('/esqueci-senha') }),
  )
}

export function avisarDuasEtapas(pessoa: Destinatario, ligou: boolean) {
  return semFalhar('duas etapas', () =>
    ligou
      ? enviarModelo(pessoa, 'duasEtapasLigada', { nome: pessoa.nome ?? '', quando: quando() })
      : enviarModelo(pessoa, 'duasEtapasDesligada', { nome: pessoa.nome ?? '', quando: quando(), link: linkDoPainel('/painel') }),
  )
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

export function avisarAcessoLiberado(dados: { pessoa: Destinatario; clienteId: string; quem: string; funcao: IdDaFuncao; contaNova: boolean }) {
  return semFalhar('acesso liberado', async () =>
    enviarModelo(dados.pessoa, 'acessoLiberado', {
      nome: dados.pessoa.nome ?? '',
      organizacao: await nomeDaOrganizacao(dados.clienteId),
      quem: dados.quem,
      funcao: ROTULO_DA_FUNCAO[dados.funcao],
      email: dados.pessoa.email,
      contaNova: dados.contaNova,
      link: linkDoPainel('/entrar'),
    }),
  )
}

export function avisarAcessoEncerrado(pessoa: Destinatario, clienteId: string) {
  return semFalhar('acesso encerrado', async () =>
    enviarModelo(pessoa, 'acessoEncerrado', { nome: pessoa.nome ?? '', organizacao: await nomeDaOrganizacao(clienteId) }),
  )
}

export function avisarChaveDeApiCriada(clienteId: string, dados: { quem: string; chave: string; escopos: string[] }) {
  return semFalhar('chave de API', async () => {
    const permissoes = dados.escopos.map((escopo) => ESCOPOS_DA_API.find((item) => item.chave === escopo)?.rotulo ?? escopo).join(', ')
    return enviarModelo(await gestoresDaConta(clienteId), 'chaveDeApiCriada', {
      organizacao: await nomeDaOrganizacao(clienteId),
      quem: dados.quem,
      chave: dados.chave,
      permissoes,
      quando: quando(),
      link: linkDoPainel(`/clientes/${clienteId}/ajustes/api`),
    })
  })
}

// ---------------------------------------------------------------------------
// Plano
// ---------------------------------------------------------------------------

const CICLO = { mensal: 'Mensal', anual: 'Anual' } as const

/** O pedido vai para quem pediu e para a caixa da 4YU, que atende. */
export function avisarPedidoDePlano(clienteId: string, dados: { pessoa: Destinatario; de: string; para: string; ciclo: 'mensal' | 'anual' }) {
  return semFalhar('pedido de plano', async () => {
    const organizacao = await nomeDaOrganizacao(clienteId)
    await enviarModelo(dados.pessoa, 'pedidoDePlanoRecebido', {
      nome: dados.pessoa.nome ?? '',
      organizacao,
      plano: dados.para,
      ciclo: CICLO[dados.ciclo],
      link: linkDoPlano(clienteId),
    })
    await enviarModelo({ email: CONTATO, nome: '4YU' }, 'pedidoDePlanoParaEquipe', {
      organizacao,
      quem: dados.pessoa.nome || dados.pessoa.email,
      email: dados.pessoa.email,
      de: dados.de,
      para: dados.para,
      ciclo: CICLO[dados.ciclo],
      link: linkDoPainel('/admin/pedidos'),
    })
  })
}

export function avisarPedidoRecusado(clienteId: string, plano: string) {
  return semFalhar('pedido recusado', async () =>
    enviarModelo(await gestoresDaConta(clienteId), 'pedidoDePlanoRecusado', {
      organizacao: await nomeDaOrganizacao(clienteId),
      plano,
      link: linkDoPlano(clienteId),
    }),
  )
}

export function avisarPlanoAtivado(clienteId: string, dados: { plano: string; preco: string; desde: string }) {
  return semFalhar('plano ativado', async () =>
    enviarModelo(await gestoresDaConta(clienteId), 'planoAtivado', {
      organizacao: await nomeDaOrganizacao(clienteId),
      ...dados,
      link: linkDoPlano(clienteId),
    }),
  )
}

export function avisarTrocaAgendada(clienteId: string, dados: { de: string; para: string; data: string; oQueSai: string }) {
  return semFalhar('troca agendada', async () =>
    enviarModelo(await gestoresDaConta(clienteId), 'trocaDePlanoAgendada', {
      organizacao: await nomeDaOrganizacao(clienteId),
      ...dados,
      faltam: null,
      link: linkDoPlano(clienteId),
    }),
  )
}

// ---------------------------------------------------------------------------
// WhatsApp e transmissões
// ---------------------------------------------------------------------------

export function avisarWhatsappConectado(clienteId: string) {
  return semFalhar('WhatsApp conectado', async () =>
    enviarModelo(await gestoresDaConta(clienteId), 'whatsappConectado', {
      organizacao: await nomeDaOrganizacao(clienteId),
      link: linkDoPainel(`/clientes/${clienteId}/inbox`),
    }),
  )
}

export function avisarTransmissaoConcluida(transmissao: {
  id: string
  clienteId: string
  nome: string
  criadaPor: string | null
  progresso: { total: number; entregue: number; lida: number; falhou: number }
}) {
  return semFalhar('transmissão concluída', async () => {
    if (!transmissao.criadaPor) return
    const autor = (await membrosDaConta(transmissao.clienteId)).find((membro) => membro.id === transmissao.criadaPor)
    if (!autor) return
    const { total, entregue, lida, falhou } = transmissao.progresso
    await enviarModelo({ email: autor.email, nome: autor.nome }, 'transmissaoConcluida', {
      nome: autor.nome,
      transmissao: transmissao.nome,
      total,
      // Lida passou por entregue: o estado guarda só o último.
      entregues: entregue + lida,
      lidas: lida,
      falhas: falhou,
      link: linkDoPainel(`/clientes/${transmissao.clienteId}/transmissoes/${transmissao.id}`),
    })
  })
}
