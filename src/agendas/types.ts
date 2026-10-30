/**
 * O contrato de todo sistema de agenda de fora (docs/SEGMENTOS-NOVOS.md §2).
 *
 * Cada sistema mora em `src/agendas/<sistema>.ts` e só traduz: o que ele chama
 * de especialidade, serviço ou aula vira `ServicoDaAgenda`, a vaga vira
 * `HorarioLivre`, e a consulta marcada vira `Marcacao`. Quem decide quem pode o
 * quê é `server/agenda-externa.ts`, que também é quem sabe o telefone de quem
 * conversa.
 *
 * Os ids que saem daqui são **opacos** para o modelo: `horarioId` carrega tudo
 * que o sistema precisa para gravar (profissional, serviço, data, hora, local),
 * para que nada seja montado à mão a partir de texto.
 */

export type ResultadoDaAgenda<T> =
  | { ok: true; valor: T }
  | {
      ok: false
      motivo: string
      /**
       * O sistema só acha a pessoa por documento (a Clínica nas Nuvens não
       * busca por telefone). Não é erro: é o que a IA precisa perguntar.
       */
      pedir?: 'cpf' | 'nascimento'
    }

export type ServicoDaAgenda = {
  servicoId: string
  nome: string
  duracaoMin?: number
  /** Já em reais, escrito como se fala: "R$ 120,00". */
  preco?: string
}

export type ProfissionalDaAgenda = { profissionalId: string; nome: string }

export type HorarioLivre = {
  horarioId: string
  /** AAAA-MM-DD. */
  data: string
  /** HH:MM. */
  hora: string
  servico?: string
  profissional?: string
}

export type Marcacao = {
  marcacaoId: string
  data: string
  hora: string
  servico?: string
  profissional?: string
  situacao?: string
}

/** Quem conversa. O telefone vem do contato, nunca do modelo. */
export type PessoaDaAgenda = {
  /** Só dígitos, com o 55 na frente, como o WhatsApp entrega. */
  telefone: string
  nome: string
  cpf?: string
  /** AAAA-MM-DD. */
  nascimento?: string
}

export type FiltroDeHorarios = {
  de: string
  ate: string
  servicoId?: string
  profissionalId?: string
}

export type ConectorDeAgenda = {
  /** A conferência da chave: a rota mais barata que prova que ela vale. */
  conferir(): Promise<ResultadoDaAgenda<{ resumo: string }>>
  servicos(): Promise<ResultadoDaAgenda<{ servicos: ServicoDaAgenda[]; profissionais: ProfissionalDaAgenda[] }>>
  /**
   * `aviso` é o que a IA precisa saber para seguir, e não é falha: "escolha a
   * especialidade antes" quando o sistema não lista vaga sem ela.
   */
  horarios(filtro: FiltroDeHorarios): Promise<ResultadoDaAgenda<{ horarios: HorarioLivre[]; aviso?: string }>>
  minhas(pessoa: PessoaDaAgenda): Promise<ResultadoDaAgenda<Marcacao[]>>
  marcar(horarioId: string, pessoa: PessoaDaAgenda): Promise<ResultadoDaAgenda<Marcacao>>
  /** Só depois de `minhas` confirmar que a marcação é desta pessoa. */
  desmarcar(marcacaoId: string, pessoa: PessoaDaAgenda): Promise<ResultadoDaAgenda<true>>
}
