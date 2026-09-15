import type { TipoDeEtapa } from './quadros'

/**
 * Os modelos de funil (0058).
 *
 * ---------------------------------------------------------------------------
 * Por que modelo, e não três etapas iguais para todo mundo
 * ---------------------------------------------------------------------------
 *
 * `Novo · Em conversa · Fechado` serve a qualquer negócio porque não descreve
 * nenhum — é neutro de propósito, e continua sendo o certo para quem só quer
 * organizar o atendimento. O problema é que ele era a **única** saída: quem
 * vende com SDR, quem agenda avaliação e quem quer recompra montava tudo na
 * mão, etapa por etapa, sem saber quantas usar nem onde marcar o ganho.
 *
 * A régua que a prática comercial repete: **entre quatro e oito etapas**. Menos
 * que quatro não mostra onde o negócio trava; mais que oito costuma ser dois
 * funis — e é a mesma conta que `LIMITE_DE_ETAPAS` já fazia por motivo de tela.
 *
 * Cada modelo traz o **prazo de cada etapa** junto, e não é enfeite: é o que
 * acende o aviso de parado no cartão. Prazo é a parte que ninguém configura
 * depois, e sem ele o quadro mostra onde as pessoas estão e esconde quem foi
 * esquecido.
 */

export type EtapaDoModelo = {
  nome: string
  tipo?: TipoDeEtapa
  /** Dias parado até o cartão acender. Ver `quadro_colunas.limite_de_dias`. */
  dias?: number
}

export type ModeloDeQuadro = {
  id: string
  nome: string
  resumo: string
  etiquetas: readonly string[]
  etapas: readonly EtapaDoModelo[]
}

export const MODELOS_DE_QUADRO: readonly ModeloDeQuadro[] = [
  {
    id: 'atendimento',
    nome: 'Atendimento',
    resumo: 'Quem chegou, quem está sendo atendido, quem já foi resolvido. Sem venda no meio.',
    etiquetas: ['simples', 'suporte'],
    etapas: [
      { nome: 'Novo', dias: 1 },
      { nome: 'Em conversa', dias: 3 },
      { nome: 'Resolvido', tipo: 'ganho' },
    ],
  },
  {
    id: 'comercial',
    nome: 'Comercial',
    resumo:
      'O funil de venda inteiro, do primeiro contato ao fechamento, com etapa de ganho e de perda.',
    etiquetas: ['vendas', 'proposta'],
    etapas: [
      { nome: 'Novo', dias: 1 },
      { nome: 'Contato feito', dias: 2 },
      { nome: 'Proposta enviada', dias: 3 },
      { nome: 'Negociação', dias: 5 },
      { nome: 'Ganho', tipo: 'ganho' },
      { nome: 'Perdido', tipo: 'perdido' },
    ],
  },
  {
    id: 'captacao',
    nome: 'Captação (SDR)',
    resumo:
      'Só até descobrir se a pessoa serve. Quem passa vai para o funil de vendas; quem não, sai com motivo.',
    etiquetas: ['sdr', 'qualificação'],
    etapas: [
      { nome: 'Novo', dias: 1 },
      { nome: 'Tentando contato', dias: 2 },
      { nome: 'Qualificando', dias: 3 },
      { nome: 'Qualificado', tipo: 'ganho' },
      { nome: 'Descartado', tipo: 'perdido' },
    ],
  },
  {
    id: 'agendamento',
    nome: 'Agenda e avaliação',
    resumo:
      'Para quem vende hora marcada: clínica, estúdio, barbearia. O desfecho é a pessoa aparecer.',
    etiquetas: ['serviço', 'agenda'],
    etapas: [
      { nome: 'Novo', dias: 1 },
      { nome: 'Avaliação', dias: 2 },
      { nome: 'Agendado', dias: 7 },
      { nome: 'Compareceu', tipo: 'ganho' },
      { nome: 'Não apareceu', tipo: 'perdido' },
    ],
  },
  {
    id: 'pos-venda',
    nome: 'Pós-venda e recompra',
    resumo:
      'O que vem depois da venda: acompanhar, oferecer de novo, e saber quem voltou a comprar.',
    etiquetas: ['retenção', 'recompra'],
    etapas: [
      { nome: 'Entregue', dias: 7 },
      { nome: 'Acompanhamento', dias: 30 },
      { nome: 'Oferta enviada', dias: 15 },
      { nome: 'Recomprou', tipo: 'ganho' },
      { nome: 'Sem retorno', tipo: 'perdido' },
    ],
  },
] as const

/** O modelo em branco: uma etapa só, para quem quer desenhar do zero. */
export const QUADRO_EM_BRANCO: readonly EtapaDoModelo[] = [{ nome: 'Novo' }]

/**
 * As etapas com que o quadro vai nascer.
 *
 * Modelo desconhecido cai no branco em vez de estourar: o valor vem de
 * formulário, e link velho ou aba antiga não podem virar erro de criação.
 */
export function etapasDoModelo(modeloId: string | null | undefined): readonly EtapaDoModelo[] {
  if (!modeloId || modeloId === 'branco') return QUADRO_EM_BRANCO
  return MODELOS_DE_QUADRO.find((modelo) => modelo.id === modeloId)?.etapas ?? QUADRO_EM_BRANCO
}
