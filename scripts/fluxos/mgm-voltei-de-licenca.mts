/**
 * "Voltei de licença" na MGM Pilates, e o Atendimento que leva até ele.
 *
 *   npx tsx --conditions=react-server scripts/fluxos/mgm-voltei-de-licenca.mts [--gravar]
 *
 * **Dry-run é o padrão**: monta, valida e imprime. Só com `--gravar` cria o
 * fluxo, publica os dois pelo mesmo `publicar()` da tela e liga os gatilhos.
 *
 * Onde a licença entra na jornada do aluno, e por quê:
 *
 * 1. **O bot puxa o assunto, e não espera o aluno achar a opção.** Todo aluno
 *    entra pelo Atendimento, que reconhece pelo telefone e lê a ficha. Se a
 *    ficha tem licença aberta (Verandi, `licenca`), a primeira pergunta é
 *    "está voltando às aulas?". Quem está afastado e escreve quase sempre é
 *    por isso, e quem não é escolhe "outro assunto" e cai no menu de sempre.
 * 2. **Também está no menu do aluno** ("Voltei de licença"), para quem voltou
 *    sem a licença ter sido registrada na chamada.
 * 3. **E em gatilho por frase** ("voltei da licença"...), que vale mesmo no
 *    meio de outra conversa, como os outros escapes.
 * 4. **WhatsApp diferente do cadastro**: o bot não reconhece, e não pode
 *    adivinhar quem é pelo nome, porque nome não prova identidade e marcar ou
 *    desmarcar aula de outra pessoa é o erro que não se desfaz por mensagem.
 *    Então "Já sou aluno(a)" sem cadastro pede o nome completo e passa para a
 *    recepção com o número novo escrito no motivo. A recepção confere, atualiza
 *    o telefone na Verandi, e da próxima vez o aluno é reconhecido em tudo.
 *    Antes, esse caminho abria o menu do aluno e cada opção falhava em
 *    reconhecer e caía num handoff genérico.
 *
 * O fluxo de volta, em si:
 *   reconhecer → ficha → "quer marcar uma aula?"
 *     sim → modalidade → período → dia com vaga → horário → confirma → marca
 *           → fecha a licença (POST /licencas reagendou true) → confirmado
 *     não → POST /licencas reagendou false (licença fica aberta e sobe em
 *           Pendências) → passa para a equipe com o motivo escrito
 */
import path from 'node:path'

process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

const { db } = await import('@/server/db')
const { criarFluxo, publicar, acharFluxo } = await import('@/server/repos/fluxos')
const { criarGatilho } = await import('@/server/repos/gatilhos')
const { fluxoSchema } = await import('@/core/flow/schema')

const GRAVAR = process.argv.includes('--gravar')

const CLIENTE = '5de5a891-790f-4c14-b60b-ce0a573fe1c7'
const ATENDIMENTO = 'ae9f663f-933d-4953-bbb9-aefed2360b57'
const AGENDAMENTO = '7d05c074-b07f-4d06-855b-ba7430412138'
const CONEXAO = 'a9f8ce40-4a00-4f82-af1b-ee0811afa2db'
const BASE = 'https://verandi.4yu.com.br/api/v1'
const NOME = 'Fluxo - Voltei de Licença'
const FRASES = ['voltei da licenca', 'voltei de licenca', 'voltando da licenca', 'acabou minha licenca']

type No = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
type Aresta = { id: string; source: string; target: string; sourceHandle?: string }
type Grafo = { inicio: string; nodes: No[]; edges: Aresta[] }

async function publicado(fluxoId: string): Promise<Grafo> {
  const { data: f } = await db().from('flows').select('versao_publicada_id').eq('id', fluxoId).single()
  const { data: v } = await db().from('flow_versions').select('grafo').eq('id', f!.versao_publicada_id!).single()
  return structuredClone(v!.grafo) as Grafo
}

const p = (x: number, y: number) => ({ x: x * 320, y: y * 200 })
const http = (url: string, mapear: unknown[], extra: Record<string, unknown> = {}) => ({
  url, corpo: '', metodo: 'GET', aoFalhar: 'humano', conexaoId: CONEXAO, cabecalhos: [], mapear, ...extra,
})

/* ---------------- o fluxo de volta ---------------- */

const agendamento = await publicado(AGENDAMENTO)
const doAgendamento = (id: string, x: number, y: number): No => {
  const n = agendamento.nodes.find((n) => n.id === id)
  if (!n) throw new Error(`o Agendamento da MGM não tem mais o bloco ${id}`)
  const copia = structuredClone(n)
  copia.position = p(x, y)
  // a aula de volta é aula de aluno, não experimental: sem o filtro de experimental
  if (typeof copia.data.url === 'string') {
    copia.data.url = (copia.data.url as string).replace('&experimental=1', '')
  }
  return copia
}

const licencaCorpo = (reagendou: boolean) =>
  `{\n  "pessoaId": "{{pessoa_id}}",\n  "reagendou": ${reagendou}\n}`

const voltei: Grafo = {
  inicio: 'reconhecer',
  nodes: [
    {
      id: 'reconhecer', type: 'http', position: p(0, 0),
      data: http(`${BASE}/pessoas?telefone={{telefone}}`, [
        { caminho: 'total', variavel: 'encontrado' },
        { caminho: 'pessoas.0.pessoaId', variavel: 'pessoa_id' },
        { caminho: 'pessoas.0.nome', variavel: 'nome_na_agenda' },
        { caminho: 'pessoas.0.nome', formato: 'nomes', variavel: 'primeiro_nome' },
      ]),
    },
    {
      id: 'ja-e-aluno', type: 'condicao', position: p(1, 0),
      data: { variavel: 'encontrado', operador: 'maior', valor: '0' },
    },
    {
      id: 'nao-e-aluno', type: 'handoff', position: p(1, 1.5),
      data: {
        motivo: 'voltou de licença, número não cadastrado: {{telefone}}. Conferir e atualizar o WhatsApp na Verandi',
        mensagem:
          'Não encontrei este número no cadastro. 🤔 Pode ser que você use outro WhatsApp com a gente. Já chamei a recepção para confirmar e atualizar seu cadastro. 🙌',
      },
    },
    {
      id: 'ficha', type: 'http', position: p(2, 0),
      data: http(`${BASE}/pessoas/{{pessoa_id}}`, [
        { caminho: 'nome', variavel: 'nome_na_agenda' },
        { caminho: 'licenca.inicio', variavel: 'licenca_inicio' },
        { caminho: 'licenca.voltaPrevista', formato: 'data', variavel: 'licenca_volta' },
      ]),
    },
    {
      id: 'quer-marcar', type: 'pergunta', position: p(3, 0),
      data: {
        texto:
          'Que bom ter você de volta, *{{primeiro_nome}}*! 💚\nSeu horário fixo continua guardado. Quer já marcar uma aula?',
        opcoes: [
          { id: 'marcar', rotulo: '📅 Quero marcar' },
          { id: 'depois', rotulo: '⏳ Agora não' },
        ],
        salvarEm: 'quer_marcar_na_volta',
        timeoutMinutos: 60,
      },
    },

    doAgendamento('catalogo', 4, 0),
    doAgendamento('qual-modalidade', 5, 0),
    doAgendamento('quando', 6, 0),
    doAgendamento('dias-desta-semana', 7, -1),
    doAgendamento('dias-da-prox-semana', 7, 0),
    doAgendamento('dias-mais-frente', 7, 1),
    doAgendamento('escolher-dia', 8, 0),
    doAgendamento('semana-cheia', 8, 1.5),
    doAgendamento('buscar-horarios', 9, 0),
    doAgendamento('qual-horario', 10, 0),
    doAgendamento('sem-vaga', 10, 1.5),
    doAgendamento('confere', 11, 0),
    doAgendamento('marcar', 12, 0),
    doAgendamento('deu-certo', 13, 0),
    {
      ...doAgendamento('nao-marcou', 13, 1.5),
      data: {
        partes: [{ tipo: 'texto', texto: 'Esse horário acabou de ser preenchido. 😕 Vamos escolher outro.' }],
      },
    },

    // a aula está gravada: agora a licença fecha. Se este aviso falhar, a aula
    // continua marcada e a recepção encerra a licença em Pendências
    {
      id: 'fechar-licenca', type: 'http', position: p(14, 0),
      data: http(`${BASE}/licencas`, [], {
        metodo: 'POST', corpo: licencaCorpo(true), aoFalhar: 'seguir',
        cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      }),
    },
    {
      id: 'confirmado', type: 'mensagem', position: p(15, 0),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Prontinho, *{{primeiro_nome}}*! ✅ Sua *{{modalidade}}* está marcada para *{{dia_escrito}} às {{horario}}*.',
          },
          { tipo: 'atraso', segundos: 1 },
          { tipo: 'texto', texto: 'Bom retorno! Qualquer coisa, é só me chamar por aqui. 🙌' },
        ],
      },
    },

    // "agora não": a licença fica aberta e marcada, e a equipe liga
    {
      id: 'avisar-volta', type: 'http', position: p(4, 2),
      data: http(`${BASE}/licencas`, [], {
        metodo: 'POST', corpo: licencaCorpo(false), aoFalhar: 'seguir',
        cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      }),
    },
    {
      id: 'equipe-liga', type: 'handoff', position: p(5, 2),
      data: {
        motivo: 'voltou de licença e não quis marcar aula agora · {{nome_na_agenda}}',
        mensagem:
          'Tudo bem! Já avisei a equipe que você voltou, e alguém te chama para combinar o melhor horário. 🙌',
      },
    },
    {
      id: 'recepcao', type: 'handoff', position: p(12, 2),
      data: {
        motivo: 'voltou de licença e precisa de ajuda para marcar · {{nome_na_agenda}}',
        mensagem: 'Vou chamar alguém da recepção para acertar isso com você. Só um instante! 🙌',
      },
    },
  ],
  edges: [
    { id: 'v1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'v2', source: 'ja-e-aluno', sourceHandle: 'verdadeiro', target: 'ficha' },
    { id: 'v3', source: 'ja-e-aluno', sourceHandle: 'falso', target: 'nao-e-aluno' },
    { id: 'v4', source: 'ficha', target: 'quer-marcar' },
    { id: 'v5', source: 'quer-marcar', sourceHandle: 'marcar', target: 'catalogo' },
    { id: 'v6', source: 'quer-marcar', sourceHandle: 'depois', target: 'avisar-volta' },
    { id: 'v7', source: 'quer-marcar', sourceHandle: 'timeout', target: 'avisar-volta' },
    { id: 'v8', source: 'avisar-volta', target: 'equipe-liga' },
    { id: 'v9', source: 'catalogo', target: 'qual-modalidade' },
    { id: 'v10', source: 'qual-modalidade', sourceHandle: 'escolheu', target: 'quando' },
    { id: 'v11', source: 'qual-modalidade', sourceHandle: 'vazio', target: 'recepcao' },
    { id: 'v12', source: 'qual-modalidade', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'v13', source: 'quando', sourceHandle: 'esta-semana', target: 'dias-desta-semana' },
    { id: 'v14', source: 'quando', sourceHandle: 'prox-semana', target: 'dias-da-prox-semana' },
    { id: 'v15', source: 'quando', sourceHandle: 'mais-frente', target: 'dias-mais-frente' },
    { id: 'v16', source: 'quando', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'v17', source: 'dias-desta-semana', target: 'escolher-dia' },
    { id: 'v18', source: 'dias-da-prox-semana', target: 'escolher-dia' },
    { id: 'v19', source: 'dias-mais-frente', target: 'escolher-dia' },
    { id: 'v20', source: 'escolher-dia', sourceHandle: 'escolheu', target: 'buscar-horarios' },
    { id: 'v21', source: 'escolher-dia', sourceHandle: 'vazio', target: 'semana-cheia' },
    { id: 'v22', source: 'escolher-dia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'v23', source: 'semana-cheia', sourceHandle: 'outra-faixa', target: 'quando' },
    { id: 'v24', source: 'semana-cheia', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'v25', source: 'semana-cheia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'v26', source: 'buscar-horarios', target: 'qual-horario' },
    { id: 'v27', source: 'qual-horario', sourceHandle: 'escolheu', target: 'confere' },
    { id: 'v28', source: 'qual-horario', sourceHandle: 'vazio', target: 'sem-vaga' },
    { id: 'v29', source: 'qual-horario', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'v30', source: 'sem-vaga', sourceHandle: 'outro-dia', target: 'quando' },
    { id: 'v31', source: 'sem-vaga', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'v32', source: 'sem-vaga', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'v33', source: 'confere', sourceHandle: 'sim', target: 'marcar' },
    { id: 'v34', source: 'confere', sourceHandle: 'nao', target: 'quando' },
    { id: 'v35', source: 'confere', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'v36', source: 'marcar', target: 'deu-certo' },
    { id: 'v37', source: 'deu-certo', sourceHandle: 'verdadeiro', target: 'fechar-licenca' },
    { id: 'v38', source: 'deu-certo', sourceHandle: 'falso', target: 'nao-marcou' },
    { id: 'v39', source: 'nao-marcou', target: 'quando' },
    { id: 'v40', source: 'fechar-licenca', target: 'confirmado' },
  ],
}

/* ---------------- o Atendimento ---------------- */

function ajustarAtendimento(g: Grafo, volteiId: string): Grafo {
  const no = (id: string) => {
    const n = g.nodes.find((x) => x.id === id)
    if (!n) throw new Error(`o Atendimento da MGM não tem mais o bloco ${id}`)
    return n
  }
  const tirarAresta = (source: string, handle?: string) => {
    g.edges = g.edges.filter((e) => !(e.source === source && (e.sourceHandle ?? undefined) === handle))
  }
  const base = no('ficha-do-aluno').position

  // 1. a ficha passa a ler a licença
  const ficha = no('ficha-do-aluno')
  const mapear = ficha.data.mapear as Array<{ variavel: string }>
  if (!mapear.some((m) => m.variavel === 'licenca_inicio')) {
    mapear.push({ caminho: 'licenca.inicio', variavel: 'licenca_inicio' } as never)
  }

  // 2. licença aberta: o bot puxa o assunto antes do menu
  if (!g.nodes.some((n) => n.id === 'em-licenca')) {
    g.nodes.push(
      {
        id: 'em-licenca', type: 'condicao', position: { x: base.x + 260, y: base.y - 420 },
        data: { variavel: 'licenca_inicio', operador: 'preenchido', valor: '' },
      },
      {
        id: 'ola-licenca', type: 'pergunta', position: { x: base.x + 560, y: base.y - 520 },
        data: {
          texto: 'Oi, *{{primeiro_nome}}*! 👋 Vi aqui que você está de licença.\nEstá voltando às aulas?',
          opcoes: [
            { id: 'voltei', rotulo: '🔙 Sim, voltei' },
            { id: 'outro', rotulo: '💭 Outro assunto' },
          ],
          salvarEm: 'voltando_da_licenca',
          timeoutMinutos: 60,
        },
      },
      {
        id: 'ir-voltei', type: 'ir-fluxo', position: { x: base.x + 880, y: base.y - 620 },
        data: { fluxoId: volteiId, rotulo: NOME },
      },
    )
    tirarAresta('ficha-do-aluno')
    g.edges.push(
      { id: 'lic1', source: 'ficha-do-aluno', target: 'em-licenca' },
      { id: 'lic2', source: 'em-licenca', sourceHandle: 'verdadeiro', target: 'ola-licenca' },
      { id: 'lic3', source: 'em-licenca', sourceHandle: 'falso', target: 'tem-reposicao' },
      { id: 'lic4', source: 'ola-licenca', sourceHandle: 'voltei', target: 'ir-voltei' },
      { id: 'lic5', source: 'ola-licenca', sourceHandle: 'outro', target: 'menu-aluno' },
      { id: 'lic6', source: 'ola-licenca', sourceHandle: 'timeout', target: 'menu-aluno' },
    )
  }

  // 3. no menu do aluno, para a licença que não foi registrada
  const menuAluno = no('menu-aluno')
  const opcoes = menuAluno.data.opcoes as Array<{ id: string; rotulo: string }>
  if (!opcoes.some((o) => o.id === 'voltei-licenca')) {
    opcoes.splice(1, 0, { id: 'voltei-licenca', rotulo: '🔙 Voltei de licença' })
    g.edges.push({ id: 'lic7', source: 'menu-aluno', sourceHandle: 'voltei-licenca', target: 'ir-voltei' })
  }

  // 4. "Já sou aluno(a)" de um número que a agenda não conhece
  if (!g.nodes.some((n) => n.id === 'aluno-sem-cadastro')) {
    const menu = no('menu').position
    g.nodes.push(
      {
        id: 'aluno-sem-cadastro', type: 'pergunta', position: { x: menu.x + 320, y: menu.y + 260 },
        data: {
          texto:
            'Não encontrei este número no cadastro. 🤔 Pode ser que você use outro WhatsApp com a gente.\nMe diz seu *nome completo*, que a recepção confirma e atualiza seu cadastro.',
          opcoes: [],
          salvarEm: 'nome_informado',
          timeoutMinutos: 60,
        },
      },
      {
        id: 'aluno-outro-numero', type: 'handoff', position: { x: menu.x + 640, y: menu.y + 260 },
        data: {
          motivo:
            'aluno escrevendo de número não cadastrado: {{nome_informado}} · {{telefone}}. Conferir e atualizar o WhatsApp na Verandi',
          mensagem:
            'Obrigado! Já passei para a recepção. Assim que o número for atualizado, você resolve tudo por aqui, sem precisar chamar ninguém. 🙌',
        },
      },
    )
    tirarAresta('menu', 'aluno')
    g.edges.push(
      { id: 'lic8', source: 'menu', sourceHandle: 'aluno', target: 'aluno-sem-cadastro' },
      { id: 'lic9', source: 'aluno-sem-cadastro', target: 'aluno-outro-numero' },
      { id: 'lic10', source: 'aluno-sem-cadastro', sourceHandle: 'timeout', target: 'recepcao' },
    )
  }
  return g
}

/* ---------------- conferir e gravar ---------------- */

const lidoVoltei = fluxoSchema.safeParse(voltei)
if (!lidoVoltei.success) {
  console.error('SCHEMA voltei:', JSON.stringify(lidoVoltei.error.issues.slice(0, 8), null, 1))
  process.exit(1)
}
const atendimentoAtual = await publicado(ATENDIMENTO)
const previa = fluxoSchema.safeParse(ajustarAtendimento(structuredClone(atendimentoAtual), '00000000-0000-4000-8000-000000000000'))
if (!previa.success) {
  console.error('SCHEMA atendimento:', JSON.stringify(previa.error.issues.slice(0, 8), null, 1))
  process.exit(1)
}
console.log(`voltei: ${voltei.nodes.length} blocos · atendimento: ${atendimentoAtual.nodes.length} → ${previa.data.nodes.length} blocos`)

if (!GRAVAR) {
  console.log('dry-run: nada gravado. Rode com --gravar.')
  process.exit(0)
}

const { data: existente } = await db().from('flows').select('id')
  .eq('client_id', CLIENTE).eq('nome', NOME).maybeSingle()
const volteiId = existente?.id ?? (await criarFluxo(CLIENTE, NOME, lidoVoltei.data, false, 'whatsapp')).id

const r1 = await publicar(volteiId, CLIENTE, lidoVoltei.data)
if (!r1.ok) { console.error('voltei não publicou:', JSON.stringify(r1.erros, null, 1)); process.exit(1) }
console.log('voltei publicado:', volteiId)

const novoAtendimento = fluxoSchema.parse(ajustarAtendimento(structuredClone(atendimentoAtual), volteiId))
const r2 = await publicar(ATENDIMENTO, CLIENTE, novoAtendimento)
if (!r2.ok) { console.error('atendimento não publicou:', JSON.stringify(r2.erros, null, 1)); process.exit(1) }
console.log('atendimento publicado')

const { data: ja } = await db().from('gatilhos').select('frase').eq('flow_id', volteiId)
for (const frase of FRASES) {
  if ((ja ?? []).some((g) => g.frase === frase)) continue
  const r = await criarGatilho(CLIENTE, { frase, operador: 'contem', fluxoId: volteiId })
  console.log('gatilho', frase, r.ok ? 'ok' : r.motivo)
}

const fluxo = await acharFluxo(volteiId)
console.log('pronto:', fluxo?.nome, 'ativo:', fluxo?.ativo)
