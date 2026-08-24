import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { fluxoNovo } from '@/core/flow/novo'
import { agendamento } from './agendamento'
import { triagem } from './triagem'

/**
 * Os modelos que a tela oferece ao criar um fluxo (B5).
 *
 * **São dado, não banco.** Um modelo é um grafo de partida; guardá-lo em tabela
 * criaria uma segunda fonte de fluxos para manter, versionar e migrar junto do
 * schema — e o que se ganha é editar sem deploy, que ninguém pediu.
 *
 * O que o modelo entrega é o começo, e nada além dele: assim que o fluxo é
 * criado, ele é um rascunho normal. Não existe "atualizar o modelo depois" —
 * pelo mesmo motivo do preset de integração, e da versão publicada: o que ficou
 * gravado é o desenho, não uma referência viva.
 *
 * Todos nascem **válidos**: se um modelo produzisse um fluxo que o `publicar()`
 * recusa, a primeira coisa que a pessoa veria ao clicar em Publicar seria uma
 * lista de erros sobre um desenho que ela não fez.
 */

export type Modelo = {
  id: string
  nome: string
  resumo: string
  grafo: Fluxo
}

/**
 * Recado + agendamento humano.
 *
 * O caso mais comum de quem começa: o bot não tenta resolver, ele qualifica em
 * uma pergunta e entrega. Vale mais do que parece — é o desenho que transforma
 * "alguém responde quando puder" em "alguém responde sabendo do que se trata".
 */
const recado: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Oi! 👋 Sou o assistente virtual. Faço *uma pergunta rápida* e já chamo alguém do time.',
          },
        ],
      },
    },
    {
      id: 'assunto',
      type: 'pergunta',
      position: { x: 0, y: 170 },
      data: {
        texto: 'Sobre o que você quer falar?',
        salvarEm: 'assunto',
        opcoes: [
          { id: 'orcamento', rotulo: 'Orçamento' },
          { id: 'agendar', rotulo: 'Agendar horário' },
          { id: 'outro', rotulo: 'Outro assunto' },
        ],
        // Meia hora: tempo de quem saiu para responder e voltou, e curto o
        // bastante para a pessoa ainda lembrar do que se tratava.
        timeoutMinutos: 30,
      },
    },
    {
      id: 'nome',
      type: 'pergunta',
      position: { x: 0, y: 340 },
      data: { texto: 'Como posso te chamar?', salvarEm: 'nome' },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 0, y: 510 },
      data: {
        mensagem: 'Perfeito, {{nome}}! Já estou chamando alguém do time. 🙌',
        motivo: '{{assunto}} · {{nome}}',
      },
    },
    {
      id: 'sumiu',
      type: 'mensagem',
      position: { x: 320, y: 340 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Sem problema! Quando quiser, é só mandar uma mensagem aqui. 👋',
          },
        ],
      },
    },
  ],
  edges: [
    { id: 'r1', source: 'abertura', target: 'assunto' },
    { id: 'r2', source: 'assunto', sourceHandle: 'orcamento', target: 'nome' },
    { id: 'r3', source: 'assunto', sourceHandle: 'agendar', target: 'nome' },
    { id: 'r4', source: 'assunto', sourceHandle: 'outro', target: 'nome' },
    { id: 'r5', source: 'assunto', sourceHandle: 'timeout', target: 'sumiu' },
    { id: 'r6', source: 'nome', target: 'humano' },
  ],
})

/**
 * Fora do expediente.
 *
 * Um fluxo curto para ser o **padrão para mídia** ou a resposta de quem escreve
 * de madrugada: diz o que é verdade e não promete ninguém. O aviso de horário
 * o motor acrescenta sozinho quando o expediente está configurado (A4).
 */
const recadoCurto: Fluxo = fluxoSchema.parse({
  inicio: 'aviso',
  nodes: [
    {
      id: 'aviso',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Recebi sua mensagem! 🙌 Nosso time responde por aqui assim que possível — pode deixar tudo escrito que já fica registrado.',
          },
        ],
      },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 0, y: 170 },
      data: { mensagem: 'Já deixei registrado aqui com o time.', motivo: 'recado deixado' },
    },
  ],
  edges: [{ id: 'c1', source: 'aviso', target: 'humano' }],
})

export const MODELOS: Modelo[] = [
  {
    id: 'vazio',
    nome: 'Em branco',
    resumo: 'O esqueleto mínimo: uma saudação, uma pergunta e a saída para uma pessoa.',
    grafo: fluxoNovo(),
  },
  {
    id: 'recado',
    nome: 'Qualificar e passar para alguém',
    resumo:
      'Pergunta o assunto e o nome, e entrega para o time já sabendo do que se trata. Tem prazo de resposta.',
    grafo: recado,
  },
  {
    id: 'recado-curto',
    nome: 'Recebi seu recado',
    resumo:
      'Duas linhas, sem perguntar nada. Serve como padrão para mídia recebida ou para fora do expediente.',
    grafo: recadoCurto,
  },
  {
    id: 'agendamento',
    nome: 'Agendar e remarcar na agenda',
    resumo:
      'Reconhece quem já é cliente pelo telefone, oferece os horários livres de verdade e marca. Precisa da credencial da Verandi.',
    grafo: agendamento,
  },
  {
    id: 'triagem',
    nome: 'Triagem completa (exemplo)',
    resumo:
      'O exemplo do produto: separa quem tem pressa de quem está pesquisando, com faixa de preço.',
    grafo: triagem,
  },
]

export function acharModelo(id: string): Modelo | undefined {
  return MODELOS.find((modelo) => modelo.id === id)
}
