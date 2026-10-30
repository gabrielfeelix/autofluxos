import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * O atendente de IA dos ramos novos (docs/SEGMENTOS-NOVOS.md §4): clínica,
 * laboratório, farmácia, salão, pet shop, imobiliária e hospedagem.
 *
 * Um desenho só, porque a conversa é a mesma: a pessoa diz o que precisa, a IA
 * responde com o que sabe e com as consultas do ramo, e sempre há saída para
 * uma pessoa da equipe. Muda o texto e a lista de ferramentas.
 *
 * Nos ramos de saúde (`aviso`) a conversa abre com o aviso de uso do dado,
 * antes de qualquer pergunta: dado de saúde é sensível pela LGPD (art. 11), e
 * quem não concorda vai direto para a equipe. A resposta fica em
 * `aceite_dados_saude`.
 */

type Desenho = {
  abertura: string
  aviso?: string
  pergunta: string
  instrucao: readonly string[]
  ferramentas: readonly string[]
  equipe: string
}

/** As ferramentas da agenda conectada, na ordem em que a conversa usa. */
const AGENDA = ['servicos_da_agenda', 'horarios_livres', 'minhas_marcacoes', 'marcar_horario', 'desmarcar_horario'] as const
const CATALOGO = ['loja_buscar', 'loja_mostrar'] as const

const AGENDAR = [
  '- Quer marcar: veja os serviços com servicos_da_agenda, pergunte o que a pessoa quer e o melhor dia, mostre as opções de horarios_livres e só marque com marcar_horario depois de ela escolher.',
  '- Quer ver, remarcar ou desmarcar: use minhas_marcacoes. Para remarcar, desmarque e marque o novo horário.',
  '- Se uma consulta pedir um dado (precisa), peça à pessoa e consulte de novo.',
]

export function atendenteDoRamo(d: Desenho): Fluxo {
  const comAviso = d.aviso !== undefined
  return fluxoSchema.parse({
    inicio: 'abertura',
    nodes: [
      {
        id: 'abertura',
        type: 'mensagem',
        position: { x: 0, y: 0 },
        data: { partes: [{ tipo: 'atraso', segundos: 1 }, { tipo: 'texto', texto: d.abertura }] },
      },
      ...(comAviso
        ? [
            {
              id: 'aceite',
              type: 'pergunta',
              position: { x: 0, y: 150 },
              data: {
                texto: d.aviso,
                salvarEm: 'aceite_dados_saude',
                opcoes: [
                  { id: 'concordo', rotulo: 'Concordo' },
                  { id: 'equipe', rotulo: 'Falar com a equipe' },
                ],
              },
            },
          ]
        : []),
      {
        id: 'o-que-precisa',
        type: 'pergunta',
        position: { x: 0, y: comAviso ? 300 : 150 },
        data: { texto: d.pergunta, salvarEm: 'pedido' },
      },
      {
        id: 'conversa',
        type: 'ia',
        position: { x: 0, y: comAviso ? 450 : 300 },
        data: {
          instrucao: d.instrucao.join('\n'),
          ferramentas: [...d.ferramentas],
          salvarEm: 'resposta_da_ia',
          conversar: { maxTurnos: 15 },
        },
      },
      {
        id: 'menu',
        type: 'pergunta',
        position: { x: 0, y: comAviso ? 610 : 460 },
        data: {
          texto: 'Posso ajudar em mais alguma coisa?',
          salvarEm: 'escolha',
          opcoes: [
            { id: 'continuar', rotulo: 'Outra pergunta' },
            { id: 'pessoa', rotulo: d.equipe },
          ],
        },
      },
      {
        id: 'pode-mandar',
        type: 'pergunta',
        position: { x: -320, y: comAviso ? 770 : 620 },
        data: { texto: 'Claro, pode escrever.', salvarEm: 'pedido' },
      },
      {
        id: 'humano',
        type: 'handoff',
        position: { x: 320, y: comAviso ? 770 : 620 },
        data: {
          motivo: 'quer falar com a equipe · {{pedido}}',
          mensagens: ['Já chamei alguém da equipe. Só um instante.'],
        },
      },
    ],
    edges: [
      ...(comAviso
        ? [
            { id: 'a1', source: 'abertura', target: 'aceite' },
            { id: 'a2', source: 'aceite', sourceHandle: 'concordo', target: 'o-que-precisa' },
            { id: 'a3', source: 'aceite', sourceHandle: 'equipe', target: 'humano' },
          ]
        : [{ id: 'a1', source: 'abertura', target: 'o-que-precisa' }]),
      { id: 'e2', source: 'o-que-precisa', target: 'conversa' },
      { id: 'e3', source: 'conversa', target: 'menu' },
      { id: 'e4', source: 'menu', sourceHandle: 'continuar', target: 'pode-mandar' },
      { id: 'e5', source: 'menu', sourceHandle: 'pessoa', target: 'humano' },
      { id: 'e6', source: 'pode-mandar', target: 'conversa' },
    ],
  })
}

const AVISO_DE_SAUDE =
  'Para te atender, vamos usar o seu nome, telefone e o que você contar aqui sobre a sua saúde, só para este atendimento e conforme a LGPD. Você concorda?'

export const atendenteSaude = atendenteDoRamo({
  abertura: 'Olá, {{nome}}! Aqui é o atendimento da clínica.',
  aviso: AVISO_DE_SAUDE,
  pergunta: 'Como posso ajudar? Você pode marcar, remarcar ou tirar dúvidas sobre consultas e convênios.',
  instrucao: [
    'Você atende uma clínica pelo WhatsApp, com frases curtas e cordiais.',
    ...AGENDAR,
    '- Convênio, valor, preparo, horário e endereço: responda com o que você sabe da clínica.',
    '- Nunca dê orientação médica. Urgência: diga para ligar 192 ou ir ao pronto-socorro.',
  ],
  ferramentas: AGENDA,
  equipe: 'Falar com a recepção',
})

export const atendenteLaboratorio = atendenteDoRamo({
  abertura: 'Olá, {{nome}}! Aqui é o atendimento do laboratório.',
  aviso: AVISO_DE_SAUDE,
  pergunta: 'Como posso ajudar? Você pode perguntar sobre preparo, coleta, valores ou resultado.',
  instrucao: [
    'Você atende um laboratório pelo WhatsApp, com frases curtas e cordiais.',
    '- Preparo, jejum, horário de coleta, convênio e valores: responda com o que você sabe do laboratório.',
    '- Resultado: explique como e onde a pessoa pega o resultado. Nunca leia, comente ou interprete um resultado.',
    ...AGENDAR,
  ],
  ferramentas: AGENDA,
  equipe: 'Falar com a equipe',
})

export const atendenteFarmacia = atendenteDoRamo({
  abertura: 'Olá, {{nome}}! Aqui é o atendimento da farmácia.',
  aviso: AVISO_DE_SAUDE,
  pergunta: 'O que você procura? Pode escrever o nome do produto.',
  instrucao: [
    'Você atende uma farmácia pelo WhatsApp, com frases curtas e cordiais.',
    '- Perguntaram se tem um produto ou quanto custa: procure com loja_buscar e responda com o que achou. Se a pessoa quiser ver, mande a foto com loja_mostrar.',
    '- Remédio com receita: diga que o farmacêutico confere a receita e passe para a equipe.',
    '- Entrega, horário, plantão e formas de pagamento: responda com o que você sabe da farmácia.',
    '- Nunca indique remédio para sintoma: oriente procurar o farmacêutico ou um médico.',
  ],
  ferramentas: CATALOGO,
  equipe: 'Falar com a farmácia',
})

export const atendenteBeleza = atendenteDoRamo({
  abertura: 'Olá, {{nome}}! Que bom falar com você.',
  pergunta: 'Como posso ajudar? Você pode marcar um horário ou tirar dúvidas sobre serviços e valores.',
  instrucao: [
    'Você atende um salão de beleza pelo WhatsApp, com frases curtas e simpáticas.',
    ...AGENDAR,
    '- Serviços, valores, profissionais, horário e endereço: responda com o que você sabe do salão.',
  ],
  ferramentas: AGENDA,
  equipe: 'Falar com o salão',
})

export const atendentePet = atendenteDoRamo({
  abertura: 'Olá, {{nome}}! Aqui é o atendimento do pet shop.',
  pergunta: 'Como posso ajudar? Você pode marcar banho, tosa ou consulta, ou perguntar por um produto.',
  instrucao: [
    'Você atende um pet shop e veterinária pelo WhatsApp, com frases curtas e simpáticas.',
    ...AGENDAR,
    '- Produto e preço: procure com loja_buscar e mostre com loja_mostrar.',
    '- Sintoma ou mal-estar do animal: oriente procurar o veterinário e passe para a equipe.',
  ],
  ferramentas: [...AGENDA, ...CATALOGO],
  equipe: 'Falar com a equipe',
})

export const atendenteImobiliaria = atendenteDoRamo({
  abertura: 'Olá, {{nome}}! Aqui é o atendimento da imobiliária.',
  pergunta: 'O que você procura? Diga se é compra ou aluguel, a região e o número de quartos.',
  instrucao: [
    'Você atende uma imobiliária pelo WhatsApp, com frases curtas e cordiais.',
    '- Procure imóveis com loja_buscar pelo tipo e pela região que a pessoa disse, e mostre os que combinam com loja_mostrar.',
    '- Quer visitar: pergunte o melhor dia e período e diga que um corretor confirma a visita.',
    '- Financiamento, garantias e documentos: responda com o que você sabe, sem prometer aprovação nem valor de parcela.',
  ],
  ferramentas: CATALOGO,
  equipe: 'Falar com o corretor',
})

export const atendenteHospedagem = atendenteDoRamo({
  abertura: 'Olá, {{nome}}! Que bom ter você por aqui.',
  pergunta: 'Para quais datas e quantas pessoas você procura hospedagem?',
  instrucao: [
    'Você atende uma pousada pelo WhatsApp, com frases curtas e acolhedoras.',
    '- Mostre as acomodações e tarifas com loja_buscar e loja_mostrar.',
    '- Nunca confirme vaga: anote as datas e o número de hóspedes e diga que a equipe confere a disponibilidade e manda a reserva.',
    '- Check-in, check-out, animais, estrutura e como chegar: responda com o que você sabe da pousada.',
  ],
  ferramentas: CATALOGO,
  equipe: 'Falar com a recepção',
})
