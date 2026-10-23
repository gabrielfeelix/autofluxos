/**
 * O que a tela pede para ligar um gateway por credencial colada (Woovi,
 * PagHiper, Efí, Iugu, Pagar.me). Fica em `core` porque a tela, no navegador,
 * monta o formulário com isto; quem confere e guarda é o servidor
 * (`server/gateways-por-campos.ts`).
 */

export type CampoDeConexao = {
  nome: string
  rotulo: string
  /** Começa com "Exemplo:". */
  exemplo?: string
  tipo: 'texto' | 'segredo' | 'arquivo'
  /** Só para `arquivo`: o que o seletor aceita. */
  aceita?: string
}

export type ConexaoPorCampos = {
  campos: CampoDeConexao[]
  /** Onde, no gateway, o dono acha o que colar. Uma frase. */
  ondeAchar: string
  /**
   * O aviso de pago que o dono cadastra à mão no painel do gateway (Pagar.me),
   * quando não há API para isso. A tela mostra o endereço depois de conectar.
   */
  avisoManual?: string
  /** A Iugu pede uma chave pública RSA ao criar o token: a tela gera e mostra. */
  pedeChavePublica?: boolean
}
