/**
 * Capacidades, escopos e papéis (RB-40 a RB-42).
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo resolve
 * ---------------------------------------------------------------------------
 *
 * Até aqui o sistema tinha **uma** fronteira de autorização: `sessao.ts`
 * responde "esta pessoa alcança esta empresa?". Ela está aplicada em 126
 * lugares e funciona.
 *
 * O que não existia é a pergunta seguinte: **dentro da empresa, o que cada um
 * pode?** `acoes-crm.ts` tem dezoito ações e zero conferências de papel, então
 * qualquer `member` fecha negócio, registra valor e apaga funil igual ao dono.
 * É o buraco que a RB-40 descreve e que o A27 mede.
 *
 * ---------------------------------------------------------------------------
 * Três conceitos, e por que são três
 * ---------------------------------------------------------------------------
 *
 *  - **capacidade** — o verbo ("registrar venda"). Responde *o quê*;
 *  - **escopo** — sobre quem ("meus", "da equipe", "todos"). Responde *quais*;
 *  - **papel** — um conjunto nomeado das duas coisas, que é o que a tela edita.
 *
 * Juntá-los daria uma lista de vinte papéis fixos que nunca cabe na empresa
 * seguinte. Separá-los é o que deixa "operador que pode registrar venda, mas
 * só da própria carteira" existir sem inventar papel novo.
 *
 * **Papel é modelo, não profissão** (§11 da proposta). Administrador, gestor e
 * operador são pontos de partida editáveis; nada aqui pressupõe que o gestor é
 * uma pessoa específica ou que operador significa júnior.
 *
 * ---------------------------------------------------------------------------
 * Puro de propósito
 * ---------------------------------------------------------------------------
 *
 * Nada aqui vai ao banco. Quem lê membro, equipe e sobrescritas é
 * `server/permissoes.ts`; aqui só a decisão, para que ela possa ser testada
 * exaustivamente sem fixture e para que a mesma regra valha na ação, na
 * consulta e na tela.
 */

// ---------------------------------------------------------------------------
// As capacidades
// ---------------------------------------------------------------------------

/**
 * O que existe para ser permitido.
 *
 * A lista é fechada e o tipo sai dela: capacidade nova é uma linha aqui, e o
 * TypeScript passa a cobrar os lugares que precisam decidir sobre ela. Texto
 * livre viraria, em um mês, `'ler_valores'` num arquivo e `'lerValores'` em
 * outro, com a diferença aparecendo como permissão silenciosamente negada.
 *
 * A ordem segue a tabela do §11 da proposta, de propósito: a tela de acesso
 * (UI-18) lista nesta ordem, e conferir uma contra a outra tem que ser leitura
 * direta.
 */
export const CAPACIDADES = [
  /** Empresa, canais, equipe e papéis. O poder de dar poder. */
  'configurar_empresa',
  /** Bot, regras, campos e processos. Muda como a operação funciona. */
  'configurar_operacao',
  /** Ler e atender conversas, editar dados operacionais. */
  'atender',
  /** Criar oportunidade e atividade. */
  'criar_oportunidade',
  /** Registrar venda ou perda — concluir comercialmente. */
  'registrar_venda',
  /** Corrigir ou cancelar venda já registrada. Mexe em número fechado. */
  'corrigir_venda',
  /** Ver valor, total, receita — qualquer número de dinheiro. */
  'ler_valores',
  /** Exportar, criar segmento compartilhado, transmitir. */
  'exportar',
] as const

export type Capacidade = (typeof CAPACIDADES)[number]

export function ehCapacidade(valor: string): valor is Capacidade {
  return (CAPACIDADES as readonly string[]).includes(valor)
}

// ---------------------------------------------------------------------------
// Os escopos
// ---------------------------------------------------------------------------

/**
 * Sobre **quais registros** a capacidade vale.
 *
 * `nenhum` é um escopo de verdade, e não a ausência de um: ele é a diferença
 * entre "esta capacidade não se aplica aqui" e "esqueci de configurar". A
 * ausência seria `undefined`, que em JavaScript se confunde com erro de
 * digitação numa chave.
 */
export const ESCOPOS = ['nenhum', 'proprios', 'equipe', 'todos'] as const

export type Escopo = (typeof ESCOPOS)[number]

export function ehEscopo(valor: string): valor is Escopo {
  return (ESCOPOS as readonly string[]).includes(valor)
}

/**
 * Quem alcança mais.
 *
 * Existe porque comparar escopo com `>` exigiria que a ordem do array fosse
 * verdade em outro lugar, e arrays se reordenam. O número é explícito.
 */
const ALCANCE: Record<Escopo, number> = {
  nenhum: 0,
  proprios: 1,
  equipe: 2,
  todos: 3,
}

/** `a` alcança pelo menos o que `b` alcança? */
export function alcancaPeloMenos(a: Escopo, b: Escopo): boolean {
  return ALCANCE[a] >= ALCANCE[b]
}

// ---------------------------------------------------------------------------
// A política
// ---------------------------------------------------------------------------

/** O que uma pessoa pode, capacidade por capacidade. */
export type Politica = Record<Capacidade, Escopo>

function politica(parcial: Partial<Politica>): Politica {
  // Tudo que não foi dito é `nenhum`. **O padrão é negar**, e é a única
  // escolha segura: capacidade nova adicionada à lista acima nasce fechada
  // para todos os papéis, e quem quiser abri-la precisa dizer. O contrário
  // daria permissão a quem já existe por efeito de um deploy.
  const base = Object.fromEntries(CAPACIDADES.map((c) => [c, 'nenhum'])) as Politica
  return { ...base, ...parcial }
}

// ---------------------------------------------------------------------------
// Os papéis-modelo
// ---------------------------------------------------------------------------

/**
 * Os papéis de conta que já existem no banco hoje (`af_membros.role`).
 *
 * `owner`, `admin` e `member` são do plugin de organização do Better Auth, e
 * não foram inventados aqui. Renomeá-los quebraria a biblioteca; o que este
 * arquivo faz é dar a cada um uma política, em vez de deixá-los sem nenhuma.
 */
export const PAPEIS_DA_CONTA = ['owner', 'admin', 'member'] as const

export type PapelDaConta = (typeof PAPEIS_DA_CONTA)[number]

export function ehPapelDaConta(valor: string): valor is PapelDaConta {
  return (PAPEIS_DA_CONTA as readonly string[]).includes(valor)
}

/**
 * A política de cada papel, traduzindo a tabela do §11.
 *
 * ---------------------------------------------------------------------------
 * `member` é o papel de compatibilidade, e é por isso que ele pode tanto
 * ---------------------------------------------------------------------------
 *
 * A RB-40 diz que operador não registra venda por padrão e não exporta. Se
 * `member` nascesse assim, **todo membro de toda conta existente perderia
 * acesso no deploy** — e a própria proposta proíbe isso em letra:
 *
 *   > "Na migração, preservar acesso atual por um papel de compatibilidade
 *   > identificado (...). Não retirar acesso de operadores em massa sem prévia."
 *
 * Então `member` preserva o que ele faz hoje, com duas exceções que não são
 * "acesso atual" e sim buracos: **configurar a empresa** e **corrigir venda**.
 * A primeira já era negada (`podeAdministrarConta`), e a segunda mexe em número
 * fechado — dar isso a todo mundo por inércia seria escolher o lado errado da
 * dúvida.
 *
 * O operador restrito da RB-40 existe como `operador` abaixo, e a conta migra
 * para ele com prévia, na tela da T2.2. Ele não é o padrão hoje **porque
 * ninguém foi avisado ainda** — não porque a regra mudou de ideia.
 */
export const POLITICAS: Record<PapelDaConta, Politica> = {
  owner: politica({
    configurar_empresa: 'todos',
    configurar_operacao: 'todos',
    atender: 'todos',
    criar_oportunidade: 'todos',
    registrar_venda: 'todos',
    corrigir_venda: 'todos',
    ler_valores: 'todos',
    exportar: 'todos',
  }),

  // Igual ao dono em capacidade. A diferença entre os dois é de propriedade,
  // não de poder, e ela mora em `usuarios.ts`: a conta não pode ficar sem
  // `owner`, e `admin` não se promove sozinho.
  admin: politica({
    configurar_empresa: 'todos',
    configurar_operacao: 'todos',
    atender: 'todos',
    criar_oportunidade: 'todos',
    registrar_venda: 'todos',
    corrigir_venda: 'todos',
    ler_valores: 'todos',
    exportar: 'todos',
  }),

  member: politica({
    configurar_operacao: 'todos',
    atender: 'todos',
    criar_oportunidade: 'todos',
    registrar_venda: 'todos',
    ler_valores: 'todos',
    exportar: 'todos',
    // `configurar_empresa` e `corrigir_venda` ficam de fora — ver acima.
  }),
}

/**
 * Os modelos que a tela de acesso oferece (UI-18), além dos três acima.
 *
 * `gestor` e `operador` são a RB-40 como ela quer ser: o gestor trabalha no
 * escopo da equipe, o operador só no que é dele e sem tocar dinheiro nem
 * exportação. Eles ainda não são atribuíveis — a tela é da T2.2 — mas nascem
 * aqui porque a política é regra pura e a regra não espera a tela.
 */
export const MODELOS_EXTRA = {
  gestor: politica({
    configurar_operacao: 'todos',
    atender: 'equipe',
    criar_oportunidade: 'equipe',
    registrar_venda: 'equipe',
    ler_valores: 'equipe',
  }),

  operador: politica({
    atender: 'proprios',
    criar_oportunidade: 'proprios',
  }),
} as const satisfies Record<string, Politica>

// ---------------------------------------------------------------------------
// A decisão
// ---------------------------------------------------------------------------

/**
 * O que o servidor sabe sobre quem está pedindo.
 *
 * `sobrescritas` é o que permite "operador que também registra venda" sem
 * inventar papel: a tela de acesso grava a diferença, e ela vale por cima do
 * modelo. Ausente = usa o do papel.
 */
export type Acesso = {
  papel: PapelDaConta | null
  /**
   * Administrador da 4YU agindo sem ser membro.
   *
   * Passa por tudo, e isso é herdado de `sessao.ts`, não decidido aqui — a
   * saída dele é "só impersonando", que deixa rastro na auditoria. Repetir a
   * decisão neste arquivo criaria dois lugares para mudá-la.
   */
  ehAdminDaPlataforma?: boolean
  sobrescritas?: Partial<Politica>
  /** As equipes de que esta pessoa faz parte. Vazio = nenhuma. */
  equipes?: readonly string[]
  usuarioId?: string
}

/** O escopo efetivo desta pessoa para esta capacidade. */
export function escopoDe(acesso: Acesso, capacidade: Capacidade): Escopo {
  if (acesso.ehAdminDaPlataforma) return 'todos'
  if (acesso.papel === null) return 'nenhum'

  const daSobrescrita = acesso.sobrescritas?.[capacidade]
  if (daSobrescrita !== undefined) return daSobrescrita

  return POLITICAS[acesso.papel][capacidade]
}

/**
 * **Pode?**
 *
 * A pergunta que toda ação faz antes de ler ou escrever. `minimo` é o escopo
 * exigido: `'proprios'` quer dizer "pelo menos sobre o que é dele", que é o
 * bastante para criar a própria oportunidade e insuficiente para mexer na dos
 * outros.
 */
export function pode(
  acesso: Acesso,
  capacidade: Capacidade,
  minimo: Escopo = 'proprios',
): boolean {
  if (minimo === 'nenhum') return true
  return alcancaPeloMenos(escopoDe(acesso, capacidade), minimo)
}

/**
 * Este registro entra no escopo desta pessoa?
 *
 * É a segunda metade da autorização, e a que falta com mais frequência: `pode`
 * responde "tem a capacidade", isto responde "sobre **este** registro". Uma
 * ação que só faz a primeira pergunta deixa o operador com escopo `proprios`
 * fechar a venda de outra equipe — que é o A19.
 *
 * `dono` e `equipeDoRegistro` nulos são tratados como "de ninguém": a fila sem
 * responsável **não é de todos por acidente** (RB-40). Quem a alcança é quem
 * tem escopo `todos`, ou quem tem a capacidade própria de fila, quando a T2.2
 * a modelar. Enquanto isso, o lado seguro é recusar.
 */
export function alcanca(
  acesso: Acesso,
  capacidade: Capacidade,
  registro: { dono?: string | null; equipe?: string | null },
): boolean {
  const escopo = escopoDe(acesso, capacidade)

  switch (escopo) {
    case 'nenhum':
      return false
    case 'todos':
      return true
    case 'equipe': {
      if (!registro.equipe) return false
      return (acesso.equipes ?? []).includes(registro.equipe)
    }
    case 'proprios': {
      if (!registro.dono || !acesso.usuarioId) return false
      return registro.dono === acesso.usuarioId
    }
  }
}

/**
 * O filtro que a consulta aplica **antes** de paginar.
 *
 * Existe para que "quais registros" não vire `filter()` em memória depois de
 * ler tudo — que além de lento entrega os dados ao processo que não deveria
 * tê-los, e conta errado qualquer total. Devolve a intenção; quem a traduz em
 * SQL é o repositório.
 *
 * `impossivel` não é o mesmo que uma lista vazia de equipes: ele diz "esta
 * consulta não pode devolver nada", e quem o recebe deve pular a ida ao banco
 * em vez de montar um `in ()` que o Postgres recusa.
 */
export type FiltroDeEscopo =
  | { tipo: 'impossivel' }
  | { tipo: 'tudo' }
  | { tipo: 'equipes'; equipes: readonly string[] }
  | { tipo: 'proprios'; usuarioId: string }

export function filtroDe(acesso: Acesso, capacidade: Capacidade): FiltroDeEscopo {
  const escopo = escopoDe(acesso, capacidade)

  switch (escopo) {
    case 'nenhum':
      return { tipo: 'impossivel' }
    case 'todos':
      return { tipo: 'tudo' }
    case 'equipe': {
      const equipes = acesso.equipes ?? []
      // Escopo de equipe sem equipe nenhuma alcança zero registros. Devolver
      // `equipes: []` faria o chamador montar um `in ()` inválido.
      return equipes.length === 0 ? { tipo: 'impossivel' } : { tipo: 'equipes', equipes }
    }
    case 'proprios': {
      if (!acesso.usuarioId) return { tipo: 'impossivel' }
      return { tipo: 'proprios', usuarioId: acesso.usuarioId }
    }
  }
}
