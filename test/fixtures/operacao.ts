/**
 * Os cenários de empresa que a implementação precisa atravessar.
 *
 * A T0.2 do plano pede sete: empresa sem CRM; atendimento; SDR → vendas →
 * pós-venda; recompra; múltiplos times; legado ambíguo; histórico importado.
 * Eles existem aqui como **dados**, não como setup de banco, para servirem aos
 * dois lados: o teste puro de `core/` monta o caso em memória, e o teste de
 * integração usa os mesmos nomes e formas ao criar as linhas.
 *
 * Por que os nomes importam: o cenário do legado ambíguo é o que separa
 * "Resolvido" de venda, e o da recompra é o que prova que um contato tem duas
 * oportunidades. Se cada teste inventar o próprio exemplo, essas duas regras
 * passam a ser descritas de sete formas diferentes e nenhuma vira contrato.
 *
 * Nada aqui toca banco nem rede. Ver `test/ambiente-local.ts` para a regra de
 * quem pode falar com Postgres.
 */

/** Finalidade do processo. Comercial fecha em venda; operacional, não. */
export type Finalidade = 'comercial' | 'operacional'

export type EtapaFixture = {
  nome: string
  /**
   * O papel da etapa. `ganho` em processo **operacional** é exatamente o que a
   * proposta proíbe confundir com venda (RB-03): ele fica aqui de propósito,
   * porque é o estado do legado que a F1 precisa saber ler.
   */
  tipo?: 'normal' | 'ganho' | 'perdido'
}

export type ProcessoFixture = {
  id: string
  nome: string
  finalidade: Finalidade
  etapas: readonly EtapaFixture[]
}

export type EmpresaFixture = {
  id: string
  nome: string
  /** O que ela faz, em uma linha, para a falha do teste dizer de quem é. */
  resumo: string
  /** CRM ativo? A operação inteira precisa funcionar com `false`. */
  crmAtivo: boolean
  processos: readonly ProcessoFixture[]
}

// ---------------------------------------------------------------------------
// 1. Quem não usa CRM
// ---------------------------------------------------------------------------

/**
 * A empresa que só atende. Nenhum processo, nenhum cartão.
 *
 * É a fixture mais importante do arquivo: o aceite A01 diz que ela recebe
 * mensagem e assume atendimento **sem criar quadro nem cartão**. Qualquer
 * caminho que precise de um processo para funcionar quebra aqui primeiro.
 */
export const SEM_CRM: EmpresaFixture = {
  id: 'fx-sem-crm',
  nome: 'Barbearia do Centro',
  resumo: 'atende no WhatsApp e não acompanha processo nenhum',
  crmAtivo: false,
  processos: [],
}

// ---------------------------------------------------------------------------
// 2. Atendimento: sucesso operacional que não é venda
// ---------------------------------------------------------------------------

/**
 * O caso do A11. "Resolvido" é `tipo: 'ganho'` no modelo atual, e é assim que
 * atendimento vira receita fictícia hoje. A fixture guarda o estado **errado**
 * de propósito: é o que a migração da F1 vai encontrar no banco dos clientes.
 */
export const ATENDIMENTO: EmpresaFixture = {
  id: 'fx-atendimento',
  nome: 'Clínica Bem Estar',
  resumo: 'resolve dúvida e agenda; nada disso é compra',
  crmAtivo: true,
  processos: [
    {
      id: 'fx-proc-atendimento',
      nome: 'Atendimento',
      finalidade: 'operacional',
      etapas: [{ nome: 'Novo' }, { nome: 'Em conversa' }, { nome: 'Resolvido', tipo: 'ganho' }],
    },
  ],
}

// ---------------------------------------------------------------------------
// 3. SDR → vendas → pós-venda
// ---------------------------------------------------------------------------

/**
 * A cadeia inteira, que é onde a continuidade entre processos (RB-25) aparece:
 * concluir a qualificação abre a oportunidade comercial, e concluir a venda
 * abre o pós-venda. "Qualificado" também é `ganho` hoje, pelo mesmo defeito.
 */
export const CADEIA_COMERCIAL: EmpresaFixture = {
  id: 'fx-cadeia',
  nome: 'Consultoria Plano XYZ',
  resumo: 'qualifica, vende e acompanha depois',
  crmAtivo: true,
  processos: [
    {
      id: 'fx-proc-sdr',
      nome: 'Captação (SDR)',
      finalidade: 'operacional',
      etapas: [
        { nome: 'Novo' },
        { nome: 'Qualificando' },
        { nome: 'Qualificado', tipo: 'ganho' },
        { nome: 'Descartado', tipo: 'perdido' },
      ],
    },
    {
      id: 'fx-proc-vendas',
      nome: 'Comercial',
      finalidade: 'comercial',
      etapas: [
        { nome: 'Novo' },
        { nome: 'Proposta enviada' },
        { nome: 'Ganho', tipo: 'ganho' },
        { nome: 'Perdido', tipo: 'perdido' },
      ],
    },
    {
      id: 'fx-proc-pos',
      nome: 'Pós-venda',
      finalidade: 'operacional',
      etapas: [{ nome: 'Entregue' }, { nome: 'Acompanhamento' }, { nome: 'Recomprou', tipo: 'ganho' }],
    },
  ],
}

// ---------------------------------------------------------------------------
// 4. Recompra: o mesmo contato duas vezes no mesmo processo
// ---------------------------------------------------------------------------

/**
 * O aceite A12, e o que o índice único de hoje impede.
 *
 * `quadro_cartoes_unico_idx` (0032) garante **um cartão por pessoa em cada
 * quadro**. Quer dizer: a segunda compra do mesmo cliente no mesmo funil não
 * tem onde existir. A F1 troca essa unicidade permanente por identidade de
 * ocorrência; esta fixture é o caso que prova a troca.
 */
export const RECOMPRA = {
  empresa: CADEIA_COMERCIAL,
  processo: 'fx-proc-vendas',
  contato: { nome: 'Cliente que volta', telefone: '5511900000001' },
  /** Duas intenções distintas, na mesma pessoa e no mesmo processo. */
  oportunidades: [
    { titulo: 'Plano XYZ — primeira compra', valor: 1200 },
    { titulo: 'Plano XYZ — renovação', valor: 1500 },
  ],
} as const

// ---------------------------------------------------------------------------
// 5. Múltiplos times
// ---------------------------------------------------------------------------

/**
 * Duas equipes na mesma empresa, para o escopo da F2 (RB-40/RB-41).
 *
 * O caso que interessa: a operadora do time A atende a conversa e **não** pode
 * ler a oportunidade do time B do mesmo contato — nem pela ficha, nem por
 * contagem, nem por CSV (A19/A27).
 */
export const MULTIPLOS_TIMES = {
  empresa: CADEIA_COMERCIAL,
  times: [
    { id: 'fx-time-a', nome: 'Vendas A', membros: ['fx-ana'] },
    { id: 'fx-time-b', nome: 'Vendas B', membros: ['fx-bruno'] },
  ],
  pessoas: [
    { id: 'fx-ana', nome: 'Ana', papel: 'operador' },
    { id: 'fx-bruno', nome: 'Bruno', papel: 'operador' },
    { id: 'fx-gestora', nome: 'Gestora', papel: 'gestor' },
  ],
} as const

// ---------------------------------------------------------------------------
// 6. Legado ambíguo
// ---------------------------------------------------------------------------

/**
 * Cartões ganhos antigos, sem prova de venda (RB-32).
 *
 * Os três casos que a revisão do legado precisa separar, e que **não** podem
 * virar compra por suposição: o nome do quadro não é prova, a etiqueta não é
 * prova, e valor positivo isolado também não.
 */
export const LEGADO_AMBIGUO = {
  empresa: ATENDIMENTO,
  cartoes: [
    {
      caso: 'resolvido-sem-venda',
      quadro: 'Atendimento',
      etapa: 'Resolvido',
      valor: null,
      /** Atendimento concluído. Nunca houve compra. */
      ehVenda: false,
    },
    {
      caso: 'etiqueta-cliente',
      quadro: 'Atendimento',
      etapa: 'Resolvido',
      etiqueta: 'cliente',
      valor: null,
      /** Etiqueta é marcação manual, não fonte oficial (RB-20). */
      ehVenda: false,
    },
    {
      caso: 'valor-sem-contexto',
      quadro: 'Comercial',
      etapa: 'Ganho',
      valor: 800,
      /** Provável venda, mas **pendente de classificação** até o gestor revisar. */
      ehVenda: null,
    },
  ],
} as const

// ---------------------------------------------------------------------------
// 7. Histórico importado
// ---------------------------------------------------------------------------

/**
 * O aceite A28: sincronizar histórico **não** dispara bot, atividade nem
 * métrica como se fosse entrada nova, e não inventa janela de conversa (RB-09).
 *
 * `semJanela: true` é o ponto: ter o telefone não é ter permissão de enviar.
 */
export const HISTORICO_IMPORTADO = {
  empresa: SEM_CRM,
  contatos: [
    { nome: 'Importado 1', telefone: '5511900000101', mensagens: 12, semJanela: true },
    { nome: 'Importado 2', telefone: '5511900000102', mensagens: 3, semJanela: true },
  ],
  origem: 'migração',
} as const

/** Todas as empresas, para o teste que varre os sete cenários. */
export const EMPRESAS: readonly EmpresaFixture[] = [SEM_CRM, ATENDIMENTO, CADEIA_COMERCIAL]
