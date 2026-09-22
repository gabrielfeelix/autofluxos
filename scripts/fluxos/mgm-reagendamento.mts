// Reagendamento v7 da MGM. Roda com `npx tsx`, escreve o grafo e valida.
import { writeFileSync } from 'node:fs'
import { fluxoSchema } from '../../src/core/flow/schema'
import { validar } from '../../src/core/flow/validar'
import { validarPublicacao } from '../../src/core/validar-publicacao'

const CONEXAO = 'a9f8ce40-4a00-4f82-af1b-ee0811afa2db'
const BASE = 'https://verandi.4yu.com.br/api/v1'
const AGENDAMENTO = '7d05c074-b07f-4d06-855b-ba7430412138'
const p = (x: number, y: number) => ({ x, y })

const diasDe = (de: string, ate: string) => ({
  url: `${BASE}/disponibilidade?de={{${de}}}&ate={{${ate}}}&servico={{servico_id}}`,
  corpo: '',
  metodo: 'GET' as const,
  aoFalhar: 'humano' as const,
  conexaoId: CONEXAO,
  cabecalhos: [],
  mapear: [
    { unicos: true, caminho: 'livres[].data', formato: 'dia_semana', variavel: 'dias_livres' },
    { unicos: true, caminho: 'livres[].data', variavel: 'dias_livres_iso' },
  ],
})

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
      position: p(320, 260),
      data: {
        motivo: 'reagendar: telefone não encontrado na agenda',
        mensagem:
          'Oi! 👋 Não te encontrei aqui na agenda pelo seu número. Vou chamar a recepção para te ajudar. 🙌',
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
          {
            caminho: 'reposicoesAbertas[]',
            rotulo: '{data:dia_semana} {hora:hora}',
            variavel: 'reposicoes_curtas',
          },
          {
            caminho: 'reposicoesAbertas[]',
            rotulo: '{data:dia_semana} às {hora:hora} · {servico}',
            variavel: 'reposicoes_abertas',
          },
          { caminho: 'reposicoesAbertas[].participacaoId', variavel: 'reposicoes_id' },
          {
            caminho: 'reposicoesAbertas[].participacaoId',
            quantos: true,
            variavel: 'quantas_reposicoes',
          },
          { caminho: 'situacao', variavel: 'situacao_na_agenda' },
        ],
      },
    },
    {
      id: 'ola',
      type: 'mensagem',
      position: p(960, 0),
      data: { partes: [{ tipo: 'texto', texto: 'Olá, *{{nome_na_agenda}}*! 👋' }] },
    },
    {
      id: 'tem-reposicao',
      type: 'condicao',
      position: p(1280, 0),
      data: { variavel: 'quantas_reposicoes', operador: 'igual', valor: '0' },
    },
    {
      id: 'sem-reposicao',
      type: 'pergunta',
      position: p(1280, 320),
      data: {
        texto:
          'Não vi nenhuma aula sua em aberto para repor por aqui. 🤔\nQuer marcar uma aula, ou prefere falar com a recepção?',
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
      position: p(1600, 420),
      data: { fluxoId: AGENDAMENTO, rotulo: 'Fluxo - Agendamento' },
    },
    {
      id: 'listar-reposicoes',
      type: 'mensagem',
      position: p(1600, 0),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Você tem *{{quantas_reposicoes}}* aula(s) para repor:\n{{reposicoes_abertas}}',
          },
        ],
      },
    },
    {
      id: 'qual-reposicao',
      type: 'pergunta',
      position: p(1920, 0),
      data: {
        texto: 'Qual delas vamos remarcar?',
        opcoes: [],
        opcoesDe: 'reposicoes_curtas',
        salvarEm: 'aula_a_repor',
        valoresDe: 'reposicoes_id',
        salvarValorEm: 'reposicao_id',
        timeoutMinutos: 60,
      },
    },
    {
      id: 'detalhe-da-reposicao',
      type: 'http',
      position: p(2240, 0),
      data: {
        url: `${BASE}/participacoes/{{reposicao_id}}`,
        corpo: '',
        metodo: 'GET',
        aoFalhar: 'humano',
        conexaoId: CONEXAO,
        cabecalhos: [],
        mapear: [
          { caminho: 'servicoId', variavel: 'servico_id' },
          { caminho: 'servico', variavel: 'modalidade' },
        ],
      },
    },
    {
      id: 'quando',
      type: 'pergunta',
      position: p(2560, 0),
      data: {
        texto: 'Para quando você quer remarcar?',
        opcoes: [
          { id: 'esta-semana', rotulo: '📅 Esta semana' },
          { id: 'prox-semana', rotulo: '📆 Semana que vem' },
          { id: 'mais-frente', rotulo: '🗓️ Mais pra frente' },
        ],
        salvarEm: 'faixa_de_dias',
        timeoutMinutos: 60,
      },
    },
    {
      id: 'dias-desta-semana',
      type: 'http',
      position: p(2880, -220),
      data: diasDe('semana_de', 'semana_ate'),
    },
    {
      id: 'dias-da-prox-semana',
      type: 'http',
      position: p(2880, 0),
      data: diasDe('prox_semana_de', 'prox_semana_ate'),
    },
    {
      id: 'dias-mais-frente',
      type: 'http',
      position: p(2880, 220),
      data: diasDe('prox_semana_ate', 'daqui_30_dias'),
    },
    {
      id: 'escolher-dia',
      type: 'pergunta',
      position: p(3200, 0),
      data: {
        texto: 'Estes são os dias com *{{modalidade}}*. Qual fica melhor?',
        opcoes: [],
        opcoesDe: 'dias_livres',
        salvarEm: 'dia_escrito',
        valoresDe: 'dias_livres_iso',
        salvarValorEm: 'dia',
        timeoutMinutos: 60,
      },
    },
    {
      id: 'semana-cheia',
      type: 'pergunta',
      position: p(3200, 400),
      data: {
        texto:
          'Não encontrei *{{modalidade}}* com vaga nesse período. 😕\nComo prefere seguir?',
        opcoes: [
          { id: 'outra-faixa', rotulo: '📅 Ver outro período' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        salvarEm: 'sem_vaga_no_periodo',
        timeoutMinutos: 60,
      },
    },
    {
      id: 'buscar-horarios',
      type: 'http',
      position: p(3520, 0),
      data: {
        url: `${BASE}/disponibilidade?de={{dia}}&ate={{dia}}&servico={{servico_id}}`,
        corpo: '',
        metodo: 'GET',
        aoFalhar: 'humano',
        conexaoId: CONEXAO,
        cabecalhos: [],
        mapear: [
          {
            caminho: 'livres[]',
            rotulo: '{hora:hora} · {profissional|a confirmar}',
            variavel: 'horarios',
          },
          { caminho: 'livres[].sessaoId', variavel: 'horarios_id' },
          { caminho: 'livres[].profissional', formato: 'nomes', variavel: 'horarios_prof' },
        ],
      },
    },
    {
      id: 'qual-horario',
      type: 'pergunta',
      position: p(3840, -120),
      data: {
        texto:
          'Estes são os horários de *{{modalidade}}* em {{dia_escrito}}, com {{horarios_prof}}.\nQual fica melhor?',
        opcoes: [],
        opcoesDe: 'horarios',
        salvarEm: 'horario',
        valoresDe: 'horarios_id',
        salvarValorEm: 'sessao_id',
        timeoutMinutos: 60,
      },
    },
    {
      id: 'sem-vaga',
      type: 'pergunta',
      position: p(3840, 220),
      data: {
        texto:
          'Em {{dia_escrito}} não temos *{{modalidade}}* com vaga. 😕\nQuer ver outro dia?',
        opcoes: [
          { id: 'outro-dia', rotulo: '📅 Ver outros dias' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        timeoutMinutos: 60,
      },
    },
    {
      id: 'confere',
      type: 'pergunta',
      position: p(4160, -120),
      data: {
        texto:
          'Confirmando: *{{modalidade}}*, {{dia_escrito}} às *{{horario}}*.\nPosso marcar sua reposição?',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, pode marcar' },
          { id: 'nao', rotulo: '↩️ Escolher outro' },
        ],
        timeoutMinutos: 60,
      },
    },
    {
      id: 'marcar',
      type: 'http',
      position: p(4480, 0),
      data: {
        url: `${BASE}/participacoes`,
        corpo:
          '{\n  "pessoaId": "{{pessoa_id}}",\n  "sessaoId": "{{sessao_id}}",\n  "origem": "reposicao",\n  "reposicaoDeId": "{{reposicao_id}}"\n}',
        metodo: 'POST',
        aoFalhar: 'humano',
        conexaoId: CONEXAO,
        cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
        aceitarStatus: [409],
        mapear: [{ caminho: 'participacaoId', variavel: 'participacao_id' }],
      },
    },
    {
      id: 'deu-certo',
      type: 'condicao',
      position: p(4800, 0),
      data: { variavel: 'participacao_id', operador: 'preenchido', valor: '' },
    },
    {
      id: 'confirmado',
      type: 'mensagem',
      position: p(5120, -120),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Prontinho, *{{nome_na_agenda}}*! ✅\nSua reposição ficou para *{{dia_escrito}} às {{horario}}*.',
          },
          { tipo: 'atraso', segundos: 1 },
          { tipo: 'texto', texto: 'Se precisar mudar de novo, é só me chamar por aqui. Até lá! 🙌' },
        ],
      },
    },
    {
      id: 'nao-marcou',
      type: 'mensagem',
      position: p(5120, 220),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Esse horário acabou de ser preenchido. 😕\nVamos escolher outro, sua reposição continua guardada.',
          },
        ],
      },
    },
    {
      id: 'recepcao',
      type: 'handoff',
      position: p(4480, 520),
      data: {
        motivo: 'reagendar {{quantas_reposicoes}} reposição(ões): {{nome_na_agenda}}',
        mensagem: 'Vou chamar alguém da recepção para acertar isso com você. Só um instante! 🙌',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'e2', source: 'ja-e-aluno', target: 'ficha', sourceHandle: 'verdadeiro' },
    { id: 'e3', source: 'ja-e-aluno', target: 'nao-e-aluno', sourceHandle: 'falso' },
    { id: 'e4', source: 'ficha', target: 'ola' },
    { id: 'e5', source: 'ola', target: 'tem-reposicao' },
    { id: 'e6', source: 'tem-reposicao', target: 'sem-reposicao', sourceHandle: 'verdadeiro' },
    { id: 'e7', source: 'tem-reposicao', target: 'listar-reposicoes', sourceHandle: 'falso' },
    { id: 'e8', source: 'sem-reposicao', target: 'ir-agendar', sourceHandle: 'marcar' },
    { id: 'e9', source: 'sem-reposicao', target: 'recepcao', sourceHandle: 'falar' },
    { id: 'e10', source: 'sem-reposicao', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'e11', source: 'listar-reposicoes', target: 'qual-reposicao' },
    { id: 'e12', source: 'qual-reposicao', target: 'detalhe-da-reposicao', sourceHandle: 'escolheu' },
    { id: 'e13', source: 'qual-reposicao', target: 'recepcao', sourceHandle: 'vazio' },
    { id: 'e14', source: 'qual-reposicao', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'e15', source: 'detalhe-da-reposicao', target: 'quando' },
    { id: 'e16', source: 'quando', target: 'dias-desta-semana', sourceHandle: 'esta-semana' },
    { id: 'e17', source: 'quando', target: 'dias-da-prox-semana', sourceHandle: 'prox-semana' },
    { id: 'e18', source: 'quando', target: 'dias-mais-frente', sourceHandle: 'mais-frente' },
    { id: 'e19', source: 'quando', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'e20', source: 'dias-desta-semana', target: 'escolher-dia' },
    { id: 'e21', source: 'dias-da-prox-semana', target: 'escolher-dia' },
    { id: 'e22', source: 'dias-mais-frente', target: 'escolher-dia' },
    { id: 'e23', source: 'escolher-dia', target: 'buscar-horarios', sourceHandle: 'escolheu' },
    { id: 'e24', source: 'escolher-dia', target: 'semana-cheia', sourceHandle: 'vazio' },
    { id: 'e25', source: 'escolher-dia', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'e26', source: 'semana-cheia', target: 'quando', sourceHandle: 'outra-faixa' },
    { id: 'e27', source: 'semana-cheia', target: 'recepcao', sourceHandle: 'falar' },
    { id: 'e28', source: 'semana-cheia', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'e29', source: 'buscar-horarios', target: 'qual-horario' },
    { id: 'e30', source: 'qual-horario', target: 'confere', sourceHandle: 'escolheu' },
    { id: 'e31', source: 'qual-horario', target: 'sem-vaga', sourceHandle: 'vazio' },
    { id: 'e32', source: 'qual-horario', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'e33', source: 'sem-vaga', target: 'quando', sourceHandle: 'outro-dia' },
    { id: 'e34', source: 'sem-vaga', target: 'recepcao', sourceHandle: 'falar' },
    { id: 'e35', source: 'sem-vaga', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'e36', source: 'confere', target: 'marcar', sourceHandle: 'sim' },
    { id: 'e37', source: 'confere', target: 'quando', sourceHandle: 'nao' },
    { id: 'e38', source: 'confere', target: 'recepcao', sourceHandle: 'timeout' },
    { id: 'e39', source: 'marcar', target: 'deu-certo' },
    { id: 'e40', source: 'deu-certo', target: 'confirmado', sourceHandle: 'verdadeiro' },
    { id: 'e41', source: 'deu-certo', target: 'nao-marcou', sourceHandle: 'falso' },
    { id: 'e42', source: 'nao-marcou', target: 'quando' },
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
  fluxos: [{ id: AGENDAMENTO, nome: 'Fluxo - Agendamento', publicado: true, ativo: true }],
})
const pub = validarPublicacao(lido.data, { temEntrada: true })
console.log('ERROS   ', JSON.stringify([...v.erros, ...pub.erros], null, 1))
console.log('AVISOS  ', JSON.stringify([...v.avisos, ...pub.avisos], null, 1))

writeFileSync(
  (process.env.SAIDA ?? '.') + '/reagendamento-v7.json',
  JSON.stringify(grafo),
)
