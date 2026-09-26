import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * "Vocês têm?": a pergunta que mais chega numa loja de bairro (PLANO-NICHOS
 * 4.5, comércio de rua).
 *
 * Quem pergunta quer saber se vale a viagem: se tem, quanto custa, até que
 * horas abre e onde fica. A IA contínua responde tudo na mesma conversa: o
 * produto e o preço vêm da busca no catálogo, e horário, endereço e forma de
 * pagamento vêm do contexto do negócio, que é onde o dono já escreveu isso.
 *
 * Separar um produto ou fechar uma compra é com a loja: a IA diz isso e mostra
 * o caminho, "menu" e "Falar com a loja". Ela não promete reserva, porque quem
 * sabe se a última unidade ainda está na prateleira é quem está no balcão.
 */
export const vocesTem: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          { tipo: 'atraso', segundos: 1 },
          {
            tipo: 'texto',
            texto: 'Oi, {{nome}}! 👋 Quer saber se a gente tem alguma coisa? Pode perguntar, que eu olho na hora.',
          },
        ],
      },
    },
    {
      id: 'o-que-procura',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: { texto: 'O que você está procurando?', salvarEm: 'procura' },
    },
    {
      id: 'conversa',
      type: 'ia',
      position: { x: 0, y: 300 },
      data: {
        instrucao: [
          'Você atende uma loja de bairro pelo WhatsApp, com frases curtas e simpáticas.',
          '- Perguntaram se tem um produto ou quanto custa: procure com loja_buscar e responda com o que achou. Se a pessoa quiser ver, mande a foto com loja_mostrar.',
          '- Não achou: diga com franqueza e ofereça algo parecido que a loja tenha, se houver.',
          '- Horário, endereço, como chegar, formas de pagamento e se faz entrega: responda com o que você sabe da loja.',
          '- Para separar um produto ou fechar uma compra, diga que quem confirma é a equipe da loja e que é só escrever *menu* e tocar em *Falar com a loja*.',
        ].join('\n'),
        ferramentas: ['loja_buscar', 'loja_mostrar'],
        salvarEm: 'resposta_da_ia',
        conversar: { maxTurnos: 15 },
      },
    },
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 0, y: 460 },
      data: {
        texto: 'Posso ajudar em mais alguma coisa?',
        salvarEm: 'escolha',
        opcoes: [
          { id: 'continuar', rotulo: 'Outra pergunta' },
          { id: 'local', rotulo: 'Horário e endereço' },
          { id: 'pessoa', rotulo: 'Falar com a loja' },
        ],
      },
    },
    {
      id: 'pode-mandar',
      type: 'pergunta',
      position: { x: -320, y: 620 },
      data: { texto: 'Claro! Pode mandar. 😊', salvarEm: 'procura' },
    },
    {
      id: 'resposta-local',
      type: 'mensagem',
      position: { x: 0, y: 620 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              '*Horário*\nSegunda a sábado, das 8h às 18h.\n\n*Onde estamos*\nRua Exemplo, 123, bairro, cidade.\n\n_Troque este texto pelo seu horário e seu endereço._',
          },
        ],
      },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 320, y: 620 },
      data: {
        motivo: 'quer falar com a loja · {{procura}}',
        mensagens: ['Já chamei alguém da loja. Só um instante! 🙌'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'o-que-procura' },
    { id: 'e2', source: 'o-que-procura', target: 'conversa' },
    // A saída da conversa livre: "menu" escrito, ou o teto de respostas.
    { id: 'e3', source: 'conversa', target: 'menu' },
    { id: 'e4', source: 'menu', sourceHandle: 'continuar', target: 'pode-mandar' },
    { id: 'e5', source: 'menu', sourceHandle: 'local', target: 'resposta-local' },
    { id: 'e6', source: 'menu', sourceHandle: 'pessoa', target: 'humano' },
    { id: 'e7', source: 'pode-mandar', target: 'conversa' },
    { id: 'e8', source: 'resposta-local', target: 'menu' },
  ],
})
