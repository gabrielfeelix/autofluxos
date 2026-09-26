import { describe, expect, it } from 'vitest'
import { executar } from '@/core/engine/executar'
import { sessaoNova, type Acao, type Entrada, type Sessao } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import { validar } from '@/core/flow/validar'
import { validarPublicacao } from '@/core/validar-publicacao'
import { atendenteIaRestaurante } from './atendente-ia-restaurante'
import { cardapioBotoes } from './cardapio-botoes'
import { horarioELocal } from './horario-e-local'
import { vocesTem } from './voces-tem'

/**
 * Os modelos por ramo (PLANO-NICHOS 4.5), provados pelo motor.
 *
 * `modelos.test.ts` já prova que todos publicam. O que estes casos guardam é o
 * que o ramo pediu e não se vê olhando o desenho: o pedido chega à equipe com o
 * resumo, a IA de cada bloco só alcança as ferramentas da tarefa dela, e a
 * conversa livre tem saída.
 */

/** Uma conversa andando pelo motor, passo a passo. */
function conversa(fluxo: Fluxo) {
  let sessao: Sessao = sessaoNova()
  const passo = (entrada: Entrada): Acao[] => {
    const r = executar(fluxo, sessao, entrada)
    sessao = r.sessao
    return r.acoes
  }
  return { passo, sessao: () => sessao }
}

const textos = (acoes: Acao[]) =>
  acoes.flatMap((a) => (a.tipo === 'enviar_texto' || a.tipo === 'enviar_opcoes' ? [a.texto] : []))

const MODELOS_DO_RAMO = { cardapioBotoes, atendenteIaRestaurante, vocesTem, horarioElocal: horarioELocal }

describe('os modelos por ramo', () => {
  it.each(Object.entries(MODELOS_DO_RAMO))('%s publica com a IA ligada, sem aviso', (_, fluxo) => {
    const r = validar(fluxo, { iaHabilitada: true, temContextoDeNegocio: true })
    expect(r.erros).toEqual([])
    expect(r.avisos).toEqual([])
  })

  it.each(Object.entries(MODELOS_DO_RAMO))('%s não sai com texto de exemplo', (_, fluxo) => {
    // Horário, taxa e endereço de mentira precisam ser trocados antes de ir ao
    // ar; `validarPublicacao` é quem cobra, e o modelo tem de dar a ela o que
    // cobrar. O de IA não tem texto fixo de negócio: o que sabe vem do contexto.
    const temTextoFixo = fluxo !== atendenteIaRestaurante
    expect(validarPublicacao(fluxo).ok).toBe(!temTextoFixo)
  })

  it.each(Object.entries(MODELOS_DO_RAMO))('%s não usa travessão', (_, fluxo) => {
    expect(JSON.stringify(fluxo)).not.toContain('\u2014')
  })
})

describe('cardápio com botões', () => {
  it('o pedido pergunta itens, endereço e pagamento, e fecha com o resumo', () => {
    const c = conversa(cardapioBotoes)
    c.passo({ tipo: 'inicio' })
    c.passo({ tipo: 'opcao', opcaoId: 'pedido' })
    c.passo({ tipo: 'texto', texto: '1 pizza grande meia calabresa meia mussarela' })
    c.passo({ tipo: 'texto', texto: 'Rua das Flores, 10, Centro' })
    const resumo = textos(c.passo({ tipo: 'opcao', opcaoId: 'pix' })).join('\n')

    expect(resumo).toContain('meia calabresa meia mussarela')
    expect(resumo).toContain('Rua das Flores, 10, Centro')
    expect(resumo).toContain('Pix')
  })

  it('confirmar anota o pedido no contato e passa para a equipe como novo pedido', () => {
    const c = conversa(cardapioBotoes)
    c.passo({ tipo: 'inicio' })
    c.passo({ tipo: 'opcao', opcaoId: 'pedido' })
    c.passo({ tipo: 'texto', texto: '2 esfihas de carne' })
    c.passo({ tipo: 'texto', texto: 'retirar' })
    c.passo({ tipo: 'opcao', opcaoId: 'dinheiro' })
    const acoes = c.passo({ tipo: 'opcao', opcaoId: 'confirmar' })

    const nota = acoes.find((a) => a.tipo === 'escrever_nota')
    expect(nota?.tipo === 'escrever_nota' && nota.texto).toContain('2 esfihas de carne')
    const saida = acoes.find((a) => a.tipo === 'transferir_humano')
    expect(saida?.tipo === 'transferir_humano' && saida.motivo).toContain('Novo pedido')
    expect(c.sessao().status).toBe('humano')
  })

  it('corrigir volta aos itens, e não recomeça a conversa', () => {
    const c = conversa(cardapioBotoes)
    c.passo({ tipo: 'inicio' })
    c.passo({ tipo: 'opcao', opcaoId: 'pedido' })
    c.passo({ tipo: 'texto', texto: 'uma coxinha' })
    c.passo({ tipo: 'texto', texto: 'retirar' })
    c.passo({ tipo: 'opcao', opcaoId: 'pix' })
    c.passo({ tipo: 'opcao', opcaoId: 'corrigir' })
    expect(c.sessao().noAtual).toBe('itens')
  })

  it('o cardápio sai pela IA só com a ferramenta do arquivo', () => {
    const c = conversa(cardapioBotoes)
    c.passo({ tipo: 'inicio' })
    const ia = c.passo({ tipo: 'opcao', opcaoId: 'cardapio' }).find((a) => a.tipo === 'chamar_ia')
    expect(ia?.tipo === 'chamar_ia' && ia.ferramentas).toEqual(['enviar_cardapio'])
  })

  it('a categoria escolhida vai para a busca, e a IA responde uma vez e devolve o botão', () => {
    const c = conversa(cardapioBotoes)
    c.passo({ tipo: 'inicio' })
    c.passo({ tipo: 'opcao', opcaoId: 'cardapio' })
    c.passo({ tipo: 'ia_respondeu', texto: 'Olha o nosso cardápio!' })
    const ia = c.passo({ tipo: 'opcao', opcaoId: 'pizzas' }).find((a) => a.tipo === 'chamar_ia')
    if (ia?.tipo !== 'chamar_ia') throw new Error('a categoria tinha que chamar a busca')
    expect(ia.instrucao).toContain('"Pizzas"')
    expect(ia.ferramentas).toEqual(['loja_buscar', 'loja_mostrar'])

    c.passo({ tipo: 'ia_respondeu', texto: 'Essas são as nossas pizzas.' })
    expect(c.sessao().noAtual).toBe('depois-da-categoria')
  })

  it('o horário manda trocar o texto, e não finge um horário', () => {
    const horario = cardapioBotoes.nodes.find((n) => n.id === 'resposta-horario')
    expect(JSON.stringify(horario)).toContain('Troque este texto')
  })
})

describe('atendente de restaurante com IA', () => {
  const conversaLivre = atendenteIaRestaurante.nodes.find((n) => n.id === 'conversa')

  it('conversa com as três ferramentas do restaurante', () => {
    if (conversaLivre?.type !== 'ia') throw new Error('sumiu o bloco de IA')
    expect(conversaLivre.data.conversar?.maxTurnos).toBe(15)
    expect(conversaLivre.data.ferramentas).toEqual(['loja_buscar', 'loja_mostrar', 'enviar_cardapio'])
    expect(conversaLivre.data.instrucao).toContain('meia calabresa meia mussarela')
    expect(conversaLivre.data.instrucao).toContain('endereço')
  })

  it('busca no catálogo próprio e pode concluir com o resumo em pedido', () => {
    if (conversaLivre?.type !== 'ia') throw new Error('sumiu o bloco de IA')
    expect(conversaLivre.data.fonteDoCatalogo).toBe('catalogo')
    expect(conversaLivre.data.conversar?.concluir).toEqual({ salvarEm: 'pedido' })
    const botoes = cardapioBotoes.nodes.find((n) => n.id === 'mostrar-categoria')
    expect(botoes?.type === 'ia' && botoes.data.fonteDoCatalogo).toBe('catalogo')
  })

  it('segura a conversa, e "menu" leva ao menu simples', () => {
    const c = conversa(atendenteIaRestaurante)
    c.passo({ tipo: 'inicio' })
    c.passo({ tipo: 'texto', texto: 'tem pizza sem lactose?' })
    c.passo({ tipo: 'ia_respondeu', texto: 'Tem sim, a de abobrinha.' })

    // A segunda mensagem volta para a mesma IA, que pode concluir.
    const ia = c.passo({ tipo: 'texto', texto: 'manda foto' }).find((a) => a.tipo === 'chamar_ia')
    expect(ia?.tipo === 'chamar_ia' && ia.concluir).toBe(true)
    expect(ia?.tipo === 'chamar_ia' && ia.fonteDoCatalogo).toBe('catalogo')
    c.passo({ tipo: 'ia_respondeu', texto: 'Olha ela aí!' })

    c.passo({ tipo: 'texto', texto: 'menu' })
    expect(c.sessao().noAtual).toBe('menu')
  })

  it('a IA fecha o pedido: a frase final sai, o resumo vai para a nota e a equipe recebe "Novo pedido"', () => {
    const c = conversa(atendenteIaRestaurante)
    c.passo({ tipo: 'inicio' })
    c.passo({ tipo: 'texto', texto: 'quero uma calabresa grande, Rua B, 10, cartão' })
    const acoes = c.passo({
      tipo: 'ia_respondeu',
      texto: 'Pedido enviado para a cozinha! 🙌',
      concluido: '1 calabresa grande. Entrega: Rua B, 10. Pagamento: cartão.',
    })

    const falas = textos(acoes)
    expect(falas[0]).toBe('Pedido enviado para a cozinha! 🙌')
    const nota = acoes.find((a) => a.tipo === 'escrever_nota')
    expect(nota?.tipo === 'escrever_nota' && nota.texto).toContain('1 calabresa grande. Entrega: Rua B, 10')
    const saida = acoes.find((a) => a.tipo === 'transferir_humano')
    expect(saida?.tipo === 'transferir_humano' && saida.motivo).toBe('Novo pedido')
    // Não é o "não sei": ninguém lê que a IA falhou num pedido que deu certo.
    expect(JSON.stringify(acoes)).not.toMatch(/não soube/i)
    expect(c.sessao().vars.pedido).toContain('1 calabresa grande')
    expect(c.sessao().status).toBe('humano')
  })

  it('"Falar com atendente" leva a última resposta da IA na nota', () => {
    const c = conversa(atendenteIaRestaurante)
    c.passo({ tipo: 'inicio' })
    c.passo({ tipo: 'texto', texto: 'quanto é a calabresa?' })
    c.passo({ tipo: 'ia_respondeu', texto: 'A calabresa grande sai R$ 52.' })
    c.passo({ tipo: 'texto', texto: 'menu' })
    const acoes = c.passo({ tipo: 'opcao', opcaoId: 'pessoa' })
    const nota = acoes.find((a) => a.tipo === 'escrever_nota')
    expect(nota?.tipo === 'escrever_nota' && nota.texto).toContain('R$ 52')
    expect(acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
  })

  it('"Continuar conversa" volta para a IA', () => {
    const c = conversa(atendenteIaRestaurante)
    c.passo({ tipo: 'inicio' })
    c.passo({ tipo: 'texto', texto: 'oi' })
    c.passo({ tipo: 'ia_respondeu', texto: 'Oi! O que vai ser?' })
    c.passo({ tipo: 'texto', texto: 'menu' })
    c.passo({ tipo: 'opcao', opcaoId: 'continuar' })
    expect(c.passo({ tipo: 'texto', texto: 'e de bebida?' }).map((a) => a.tipo)).toContain('chamar_ia')
    expect(c.sessao().noAtual).toBe('conversa')
  })
})

describe('comércio', () => {
  it('"vocês têm?" busca no catálogo, conversa e não manda cardápio', () => {
    const ia = vocesTem.nodes.find((n) => n.type === 'ia')
    if (ia?.type !== 'ia') throw new Error('sumiu o bloco de IA')
    expect(ia.data.conversar).toBeDefined()
    expect(ia.data.ferramentas).toEqual(['loja_buscar', 'loja_mostrar'])
    expect(ia.data.instrucao).toMatch(/horário/i)
  })

  it('horário e local não usa IA', () => {
    expect(horarioELocal.nodes.some((n) => n.type === 'ia')).toBe(false)
  })
})
