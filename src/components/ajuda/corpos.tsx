import type { ComponentType } from 'react'
import {
  SecaoBlocos,
  SecaoComoFunciona,
  SecaoDatas,
  SecaoEntrada,
  SecaoListas,
  SecaoPerguntas,
  SecaoQuandoDaErrado,
  SecaoVariaveis,
} from './conteudo-fluxos'
import {
  SecaoOutrosSistemas,
  SecaoReceitas,
  SecaoVerandiDados,
  SecaoVerandiLigar,
} from './conteudo-verandi'
import { SecaoDepoisDoFluxo, SecaoDuvidas } from './conteudo-duvidas'

/** O corpo de cada artigo do catálogo (`artigos.ts`), pelo id. */
export const CORPOS: Record<string, ComponentType> = {
  'como-funciona': SecaoComoFunciona,
  blocos: SecaoBlocos,
  entrada: SecaoEntrada,
  variaveis: SecaoVariaveis,
  perguntas: SecaoPerguntas,
  datas: SecaoDatas,
  listas: SecaoListas,
  erros: SecaoQuandoDaErrado,
  verandi: SecaoVerandiLigar,
  'verandi-dados': SecaoVerandiDados,
  receitas: SecaoReceitas,
  'outros-sistemas': SecaoOutrosSistemas,
  depois: SecaoDepoisDoFluxo,
  duvidas: SecaoDuvidas,
}
