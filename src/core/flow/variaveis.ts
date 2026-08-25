import type { Fluxo, No } from './schema'

/*
 * **Isto morava dentro de `components/editor/editor.tsx`, que é `'use client'`.**
 *
 * Enquanto só o editor usava, passava. Quando a página do editor — que é
 * componente de servidor — passou a chamá-la para juntar as variáveis das
 * outras automações da conta, o Next transformou o import num *client
 * reference* e a chamada estourou no servidor: React #441, "erro no render de
 * Server Components", com a mensagem escondida em produção. O build passa, o
 * typecheck passa, e a tela quebra.
 *
 * A regra que fica: **função pura não mora em módulo `'use client'`.** Se os
 * dois lados precisam dela, ela é de `core/` — que é justamente a fronteira que
 * este projeto já mantém para o motor.
 */

/**
 * As variáveis do fluxo — **e quem guarda cada uma**.
 *
 * A origem não é enfeite: o painel precisa saber se um nome já é guardado por
 * *outro* bloco para dizer "isso reaproveita a variável de lá" em vez de
 * deixar nascer um `agendar_aula2` calado. Sem o dono, o próprio bloco
 * apareceria como se estivesse repetindo a si mesmo.
 */
export function variaveisDoFluxo(fluxo: Fluxo): {
  nomes: string[]
  origens: Record<string, string[]>
  valores: Record<string, string[]>
} {
  const origens: Record<string, string[]> = {}
  const valores: Record<string, string[]> = {}
  const anotar = (nome: string, noId: string) => {
    ;(origens[nome] ??= []).push(noId)
  }

  for (const no of fluxo.nodes as No[]) {
    if (no.type === 'pergunta' && no.data.salvarEm) {
      anotar(no.data.salvarEm, no.id)
      // Pergunta com opções desenhadas guarda **o rótulo do botão clicado**.
      // São os únicos valores que aquela variável pode ter, e é por isso que a
      // condição sobre ela não precisa ser digitada de cabeça: um "Agendar
      // Aula" escrito diferente do botão manda todo mundo pelo ramo errado, e
      // nada estoura — a conversa segue, segue pelo lado errado.
      for (const opcao of no.data.opcoes) {
        const lista = (valores[no.data.salvarEm] ??= [])
        if (opcao.rotulo !== '' && !lista.includes(opcao.rotulo)) lista.push(opcao.rotulo)
      }
    }
    // O valor da opção escolhida também é variável — e é justamente a que o
    // bloco seguinte usa para chamar a API. Sem isto, `{{sessao_id}}` não
    // apareceria na lista e quem desenha acharia que precisa digitar de cabeça.
    if (no.type === 'pergunta' && no.data.salvarValorEm) anotar(no.data.salvarValorEm, no.id)
    if (no.type === 'salvar-campo' && no.data.campo) anotar(no.data.campo, no.id)
    if (no.type === 'ia' && no.data.salvarEm) anotar(no.data.salvarEm, no.id)
    // O que a API guarda também é variável do fluxo. Sem isto, o painel não
    // mostra `{{cidade}}` como disponível e quem desenha acha que não existe.
    if (no.type === 'http')
      for (const m of no.data.mapear) if (m.variavel) anotar(m.variavel, no.id)
  }

  return { nomes: Object.keys(origens).sort(), origens, valores }
}
