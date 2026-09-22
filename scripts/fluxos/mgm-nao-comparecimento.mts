// Não Comparecimento v5 da MGM. Roda com `npx tsx`, monta o grafo e valida.
import { writeFileSync } from 'node:fs'
import { fluxoSchema } from '../../src/core/flow/schema'
import { validar } from '../../src/core/flow/validar'
import { validarPublicacao } from '../../src/core/validar-publicacao'

const CONEXAO = 'a9f8ce40-4a00-4f82-af1b-ee0811afa2db'
const BASE = 'https://verandi.4yu.com.br/api/v1'
const AGENDAMENTO = '7d05c074-b07f-4d06-855b-ba7430412138'
const REAGENDAMENTO = '45a9db71-d702-4f4f-8510-d0687145fb0e'
const p = (x: number, y: number) => ({ x, y })

const grafo = {
  inicio: 'reconhecer',
  nodes: [
    {
      id: 'reconhecer',
      type: 'http',
      position: p(0, 0),
      data: {
        url: `${BASE}/pessoas?telefone={{telefone}}`,
        corpo: '',
        metodo: 'GET',
        aoFalhar: 'humano',
        conexaoId: CONEXAO,
        cabecalhos: [],
        mapear: [
          { caminho: 'total', variavel: 'encontrado' },
          { caminho: 'pessoas.0.pessoaId', variavel: 'pessoa_id' },
          { caminho: 'pessoas.0.nome', variavel: 'nome_na_agenda' },
        ],
      },
    },
    {
      id: 'ja-e-aluno',
      type: 'condicao',
      position: p(320, 0),
      data: { variavel: 'encontrado', operador: 'maior', valor: '0' },
    },
    {
      id: 'nao-e-aluno',
      type: 'handoff',
      position: p(320, 300),
      data: {
        motivo: 'não comparecimento: telefone não encontrado na agenda',
        mensagem:
          'Oi! 👋 Não te encontrei aqui na agenda pelo seu número. Vou chamar a recepção. 🙌',
      },
    },
    {
      id: 'ficha',
      type: 'http',
      position: p(640, 0),
      data: {
        url: `${BASE}/pessoas/{{pessoa_id}}`,
        corpo: '',
        metodo: 'GET',
        aoFalhar: 'humano',
        conexaoId: CONEXAO,
        cabecalhos: [],
        mapear: [
          { caminho: 'nome', variavel: 'nome_na_agenda' },
          { caminho: 'proximas[]', rotulo: '{data:dia_semana} {hora:hora}', variavel: 'proximas' },
          { caminho: 'proximas[].participacaoId', variavel: 'proximas_id' },
          { caminho: 'situacao', variavel: 'situacao_na_agenda' },
          { caminho: 'regraDeCancelamento.porExtenso', variavel: 'prazo_cancelamento' },
        ],
      },
    },
    {
      id: 'qual-aula',
      type: 'pergunta',
      position: p(960, 0),
      data: {
        texto:
          'Oi, *{{nome_na_agenda}}*! 👋 Vamos avisar da falta então.\nQual aula você não vai poder fazer?',
        opcoes: [],
        opcoesDe: 'proximas',
        salvarEm: 'aula',
        valoresDe: 'proximas_id',
        salvarValorEm: 'participacao_id',
        timeoutMinutos: 60,
      },
    },
    {
      id: 'nada-marcado',
      type: 'pergunta',
      position: p(960, 340),
      data: {
        texto:
          'Oi, *{{nome_na_agenda}}*! 👋 Não vi nenhuma aula marcada para você por aqui.\nQuer marcar uma aula, ou prefere falar com a recepção?',
        opcoes: [
          { id: 'marcar', rotulo: '🗓️ Marcar uma aula' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        timeoutMinutos: 60,
      },
    },
    {
      id: 'ir-agendar',
      type: 'ir-fluxo',
      position: p(1280, 420),
      data: { fluxoId: AGENDAMENTO, rotulo: 'Fluxo - Agendamento' },
    },
    {
      id: 'confere-prazo',
      type: 'http',
      position: p(1280, 0),
      data: {
        url: `${BASE}/participacoes/{{participacao_id}}`,
        corpo: '',
        metodo: 'GET',
        aoFalhar: 'humano',
        conexaoId: CONEXAO,
        cabecalhos: [],
        mapear: [
          { caminho: 'podeCancelar', variavel: 'pode_cancelar' },
          { caminho: 'podeReporSeCancelarAgora', variavel: 'pode_repor' },
          { caminho: 'avisoParaConfirmar', variavel: 'aviso_do_prazo' },
          { caminho: 'regraDeCancelamento.porExtenso', variavel: 'prazo_cancelamento' },
          { caminho: 'data', formato: 'dia_semana', variavel: 'aula_data' },
          { caminho: 'hora', formato: 'hora', variavel: 'aula_hora' },
          { caminho: 'servico', variavel: 'aula_servico' },
        ],
      },
    },
    {
      id: 'da-para-cancelar',
      type: 'condicao',
      position: p(1600, 0),
      data: { variavel: 'pode_cancelar', operador: 'igual', valor: 'true' },
    },
    {
      id: 'tarde-demais',
      type: 'mensagem',
      position: p(1600, 340),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Essa aula de *{{aula_data}} às {{aula_hora}}* já passou, ou já está registrada como falta, então não dá mais para avisar por aqui. 😕',
          },
          { tipo: 'atraso', segundos: 1 },
          {
            tipo: 'texto',
            texto: 'Vou chamar a recepção para ver isso com você.',
          },
        ],
      },
    },
    {
      id: 'dentro-do-prazo',
      type: 'condicao',
      position: p(1920, 0),
      data: { variavel: 'pode_repor', operador: 'igual', valor: 'true' },
    },
    {
      id: 'confirma-no-prazo',
      type: 'pergunta',
      position: p(2240, -180),
      data: {
        texto:
          'Certo. Você quer cancelar a aula de *{{aula_data}} às {{aula_hora}}*?\nComo você está avisando com antecedência, ela fica guardada para reposição. 🙌',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, pode cancelar' },
          { id: 'nao', rotulo: '↩️ Não, deixa assim' },
        ],
        timeoutMinutos: 120,
      },
    },
    {
      id: 'tem-aviso-do-estudio',
      type: 'condicao',
      position: p(2240, 220),
      data: { variavel: 'aviso_do_prazo', operador: 'preenchido', valor: '' },
    },
    {
      id: 'confirma-fora-do-prazo',
      type: 'pergunta',
      position: p(2560, 140),
      data: {
        texto: '{{aviso_do_prazo}}',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, cancelar' },
          { id: 'nao', rotulo: '↩️ Não, vou tentar' },
        ],
        timeoutMinutos: 120,
      },
    },
    {
      id: 'confirma-fora-do-prazo-nossa',
      type: 'pergunta',
      position: p(2560, 420),
      data: {
        texto:
          'A aula de *{{aula_data}} às {{aula_hora}}* precisa ser avisada com {{prazo_cancelamento}} de antecedência.\nSe cancelar agora, sua vaga é liberada, mas essa aula não fica guardada para reposição. Quer cancelar mesmo assim?',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, cancelar' },
          { id: 'nao', rotulo: '↩️ Não, vou tentar' },
        ],
        timeoutMinutos: 120,
      },
    },
    {
      id: 'desmarcar',
      type: 'http',
      position: p(2880, 0),
      data: {
        url: `${BASE}/participacoes/{{participacao_id}}`,
        corpo: '',
        metodo: 'DELETE',
        aoFalhar: 'humano',
        conexaoId: CONEXAO,
        cabecalhos: [],
        mapear: [{ caminho: 'status', variavel: 'status_da_falta' }],
      },
    },
    {
      id: 'teve-credito',
      type: 'condicao',
      position: p(3200, 0),
      data: { variavel: 'status_da_falta', operador: 'igual', valor: 'falta_avisada' },
    },
    {
      id: 'cancelado-com-credito',
      type: 'mensagem',
      position: p(3520, -180),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Pronto, avisado! ✅ Já liberei sua vaga de *{{aula_data}} às {{aula_hora}}*.',
          },
          { tipo: 'atraso', segundos: 1 },
          { tipo: 'texto', texto: 'Sua reposição fica guardada. 🙌' },
        ],
      },
    },
    {
      id: 'remarcar-agora',
      type: 'pergunta',
      position: p(3840, -180),
      data: {
        texto: 'Quer já escolher o dia da reposição?',
        opcoes: [
          { id: 'sim', rotulo: '📅 Sim, remarcar' },
          { id: 'depois', rotulo: '⏳ Depois eu vejo' },
        ],
        timeoutMinutos: 120,
      },
    },
    {
      id: 'ir-remarcar',
      type: 'ir-fluxo',
      position: p(4160, -300),
      data: { fluxoId: REAGENDAMENTO, rotulo: 'Fluxo - Reagendamento' },
    },
    {
      id: 'fica-para-depois',
      type: 'mensagem',
      position: p(4160, -60),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Combinado! Quando quiser remarcar, é só me chamar por aqui. 🙌',
          },
        ],
      },
    },
    {
      id: 'cancelado-sem-credito',
      type: 'mensagem',
      position: p(3520, 220),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Tudo bem, cancelado. ✅ Sua vaga de *{{aula_data}} às {{aula_hora}}* já foi liberada.',
          },
          { tipo: 'atraso', segundos: 1 },
          {
            tipo: 'texto',
            texto:
              'Como o aviso veio em cima da hora, essa aula não entra como reposição. Na próxima, avisando com {{prazo_cancelamento}} de antecedência, ela fica guardada. 🙌',
          },
        ],
      },
    },
    {
      id: 'manteve',
      type: 'mensagem',
      position: p(2880, 520),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Combinado, deixei sua aula de *{{aula_data}} às {{aula_hora}}* como estava. Até lá! 🙌',
          },
        ],
      },
    },
    {
      id: 'recepcao',
      type: 'handoff',
      position: p(1920, 620),
      data: {
        motivo: 'não comparecimento: {{aula}} · {{nome_na_agenda}}',
        mensagem: 'Vou chamar alguém da recepção para te ajudar com isso. Só um instante! 🙌',
      },
    },
  ],
  edges: [
    { id: 'n1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'n2', source: 'ja-e-aluno', target: 'ficha', sourceHandle: 'verdadeiro' },
    { id: 'n3', source: 'ja-e-aluno', target: 'nao-e-aluno', sourceHandle: 'falso' },
    { id: 'n4', source: 'ficha', target: 'qual-aula' },
    { id: 'n5', source: 'qual-aula', target: 'confere-prazo', sourceHandle: 'escolheu' },
    { id: 'n6', source: 'qual-aula', target: 'nada-marcado', sourceHandle: 'vazio' },
    { id: 'n7', source: 'qual-aula', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'n8', source: 'nada-marcado', target: 'ir-agendar', sourceHandle: 'marcar' },
    { id: 'n9', source: 'nada-marcado', target: 'recepcao', sourceHandle: 'falar' },
    { id: 'n10', source: 'nada-marcado', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'n11', source: 'confere-prazo', target: 'da-para-cancelar' },
    { id: 'n12', source: 'da-para-cancelar', target: 'dentro-do-prazo', sourceHandle: 'verdadeiro' },
    { id: 'n13', source: 'da-para-cancelar', target: 'tarde-demais', sourceHandle: 'falso' },
    { id: 'n14', source: 'tarde-demais', target: 'recepcao' },
    { id: 'n15', source: 'dentro-do-prazo', target: 'confirma-no-prazo', sourceHandle: 'verdadeiro' },
    {
      id: 'n16',
      source: 'dentro-do-prazo',
      target: 'tem-aviso-do-estudio',
      sourceHandle: 'falso',
    },
    {
      id: 'n17',
      source: 'tem-aviso-do-estudio',
      target: 'confirma-fora-do-prazo',
      sourceHandle: 'verdadeiro',
    },
    {
      id: 'n18',
      source: 'tem-aviso-do-estudio',
      target: 'confirma-fora-do-prazo-nossa',
      sourceHandle: 'falso',
    },
    { id: 'n19', source: 'confirma-no-prazo', target: 'desmarcar', sourceHandle: 'sim' },
    { id: 'n20', source: 'confirma-no-prazo', target: 'manteve', sourceHandle: 'nao' },
    { id: 'n21', source: 'confirma-no-prazo', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'n22', source: 'confirma-fora-do-prazo', target: 'desmarcar', sourceHandle: 'sim' },
    { id: 'n23', source: 'confirma-fora-do-prazo', target: 'manteve', sourceHandle: 'nao' },
    { id: 'n24', source: 'confirma-fora-do-prazo', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'n25', source: 'confirma-fora-do-prazo-nossa', target: 'desmarcar', sourceHandle: 'sim' },
    { id: 'n26', source: 'confirma-fora-do-prazo-nossa', target: 'manteve', sourceHandle: 'nao' },
    { id: 'n27', source: 'confirma-fora-do-prazo-nossa', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'n28', source: 'desmarcar', target: 'teve-credito' },
    { id: 'n29', source: 'teve-credito', target: 'cancelado-com-credito', sourceHandle: 'verdadeiro' },
    { id: 'n30', source: 'teve-credito', target: 'cancelado-sem-credito', sourceHandle: 'falso' },
    { id: 'n31', source: 'cancelado-com-credito', target: 'remarcar-agora' },
    { id: 'n32', source: 'remarcar-agora', target: 'ir-remarcar', sourceHandle: 'sim' },
    { id: 'n33', source: 'remarcar-agora', target: 'fica-para-depois', sourceHandle: 'depois' },
    { id: 'n34', source: 'remarcar-agora', target: 'fica-para-depois', sourceHandle: 'timeout' },
  ],
}

const lido = fluxoSchema.safeParse(grafo)
if (!lido.success) {
  console.error('SCHEMA:', JSON.stringify(lido.error.issues.slice(0, 10), null, 1))
  process.exit(1)
}

const v = validar(lido.data, {
  iaHabilitada: true,
  conexoes: [CONEXAO],
  temContextoDeNegocio: true,
  fluxos: [
    { id: AGENDAMENTO, nome: 'Fluxo - Agendamento', publicado: true, ativo: true },
    { id: REAGENDAMENTO, nome: 'Fluxo - Reagendamento', publicado: true, ativo: true },
  ],
})
const pub = validarPublicacao(lido.data, { temEntrada: true })
console.log('ERROS   ', JSON.stringify([...v.erros, ...pub.erros], null, 1))
console.log('AVISOS  ', JSON.stringify([...v.avisos, ...pub.avisos], null, 1))

writeFileSync(
  (process.env.SAIDA ?? '.') + '/naocomp-v5.json',
  JSON.stringify(grafo),
)
