'use client'

import { useState } from 'react'
import {
  GRUPOS_DE_PRESET,
  NOME_DO_GRUPO,
  PRESETS,
  presetDoBloco,
  type Preset,
} from '@/core/presets'

/**
 * O menu de integrações que os concorrentes têm — feito por cima do bloco que
 * já existe.
 *
 * O nosso bloco de Serviços externos fala com qualquer API, e é por isso que
 * ele é ao mesmo tempo mais poderoso e menos usável: obriga a montar o POST na
 * mão, com endereço, cabeçalho e JSON certos, e os três erram em silêncio.
 *
 * O preset preenche os quatro campos e **sai do caminho**. A partir dali é um
 * bloco `http` comum, editável — e o que vai para o fluxo é o bloco resolvido.
 * Um preset que continuasse sendo referência mudaria por baixo o que uma
 * conversa em andamento chama no dia em que a RD trocasse de endereço.
 *
 * A confirmação existe porque aplicar **sobrescreve** o que estiver escrito, e
 * quem já montou a chamada na mão perderia o trabalho num clique.
 */
export function PresetsDeIntegracao({
  aoAplicar,
  bloco,
}: {
  aoAplicar: (dados: Record<string, unknown>) => void
  /**
   * O que o bloco já tem, só para a gaveta fechada saber o que dizer.
   *
   * Não é usado para aplicar nada — o preset continua sendo resolvido e
   * esquecido. É informação de tela, e por isso opcional.
   */
  bloco?: {
    metodo: string
    url: string
    mapear: { variavel: string }[]
    temCredencial: boolean
  }
}) {
  const [aberto, setAberto] = useState(false)

  /*
   * O que a gaveta fechada mostra.
   *
   * Quem monta fluxo relatou que **com a tela minimizada não dá para saber se
   * a integração está funcional** — a gaveta fechada dizia a mesma coisa num
   * bloco vazio e num bloco já ligado à agenda, e as duas pedem gestos opostos:
   * num, escolher um preset; no outro, não mexer.
   *
   * São três estados, e o terceiro é o que evita a promessa falsa: um bloco que
   * casa com um preset **que exige credencial** e ainda não tem nenhuma
   * escolhida está preenchido e não roda. Dizer "pronto" ali seria repetir o
   * defeito que a conferência da chave veio consertar em Conexões.
   */
  const emUso = bloco ? presetDoBloco(bloco) : undefined
  const faltaCredencial =
    emUso !== undefined && emUso.credencial !== 'nenhuma' && bloco?.temCredencial === false

  /*
   * Aplicar no clique, com a confirmação **só quando há o que perder**.
   *
   * A confirmação existe porque aplicar sobrescreve endereço, corpo,
   * cabeçalhos e mapeamento, e quem montou a chamada à mão perderia o
   * trabalho. Mas num bloco recém-criado não há trabalho nenhum para perder, e
   * ali ela só ensina a clicar em "ok" sem ler — que é o que faz a confirmação
   * seguinte, a que importa, também passar batida.
   *
   * Reaplicar o preset que já está em uso não pergunta nada: é o gesto de quem
   * mexeu demais e quer o preenchimento de volta.
   */
  const aplicar = (preset: Preset) => {
    const temTrabalho =
      (bloco?.url ?? '').trim() !== '' && presetDoBloco(bloco ?? { metodo: '', url: '' })?.id !== preset.id

    if (temTrabalho) {
      const ok = confirm(
        `Aplicar “${preset.nome}”? Isso substitui o endereço, o corpo, os cabeçalhos e o que este bloco guarda.`,
      )
      if (!ok) return
    }

    aoAplicar({ ...preset.dados })
  }

  return (
    <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.02] p-3">
      <button
        type="button"
        onClick={() => setAberto((estava) => !estava)}
        aria-expanded={aberto}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          {/*
            O título é sempre o mesmo, e quem muda é a linha de baixo.

            Ele trocava de texto conforme o estado ("em uso" / "começar de"), e
            um cabeçalho que se reescreve sozinho faz a pessoa reler a seção
            inteira para achar o que mudou — quando o que mudou é uma linha só,
            logo abaixo.
          */}
          <span className="block text-[10.5px] font-semibold tracking-[0.05em] text-dim/80 uppercase">
            Integração pronta
          </span>

          {!aberto && emUso && (
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5">
              <span className="text-[12px] text-soft">{emUso.nome}</span>
              {faltaCredencial && (
                <span className="text-[11px] text-amber-200/70">falta a credencial</span>
              )}
            </span>
          )}

          {!aberto && !emUso && (
            <span className="mt-1 block text-[11.5px] leading-4 text-dim">
              montado à mão
            </span>
          )}
        </span>
        <span className="mt-0.5 shrink-0 text-[11px] text-dim">{aberto ? '−' : '+'}</span>
      </button>

      {aberto && (
        <div className="mt-2.5 space-y-2.5">
          {/*
            Agrupado porque a agenda trouxe nove de uma vez.

            Uma lista corrida de quatorze itens é uma lista que ninguém lê até o
            fim, e o de baixo some. A gaveta também conta uma história: os nove
            da Verandi estão na ordem da conversa — reconhecer, oferecer, marcar,
            desmarcar, fila — e não são nove integrações soltas.
          */}
          {GRUPOS_DE_PRESET.map((grupo) => {
            const doGrupo = PRESETS.filter((item) => item.grupo === grupo)
            if (doGrupo.length === 0) return null

            return (
              <div key={grupo}>
                <p className="mb-1 px-2.5 text-[9.5px] font-semibold tracking-[0.07em] text-dim/70 uppercase">
                  {NOME_DO_GRUPO[grupo]}
                </p>
                {/*
                  `radiogroup` por gaveta, e não um para a lista inteira.

                  Um `role="radio"` solto não é anunciado como escolha por
                  leitor de tela nenhum — ele precisa do grupo em volta. Por
                  gaveta porque é assim que a lista se lê: "Agenda (Verandi),
                  1 de 9".
                */}
                <div role="radiogroup" aria-label={NOME_DO_GRUPO[grupo]} className="space-y-px">
          {doGrupo.map((item) => {
            /*
             * **O ponto diz o que está em uso, e não o que foi clicado.**
             *
             * Era o defeito relatado por quem monta fluxo: *"não sei se não
             * está funcionando ou funciona, porque se eu vou para o próximo
             * quadro ele não mostra que essa opção foi realmente
             * selecionada"*. Clicar num preset o pintava de selecionado
             * **antes** de aplicar — e o bloco continuava apontando para outro
             * endereço, com a tela afirmando o contrário.
             *
             * Agora é consequência do bloco: some ao trocar de bloco porque o
             * bloco é outro, e é isso que ele deve fazer.
             */
            const estaEmUso = emUso?.id === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => aplicar(item)}
                /*
                 * `radio`, e não `pressed`.
                 *
                 * Um bloco de Serviços externos é **uma** chamada — um método,
                 * um endereço, um corpo. Escolher o segundo preset troca o
                 * primeiro, e é exatamente o que um rádio significa. O leitor
                 * de tela passa a anunciar "1 de 14, marcado" em vez de catorze
                 * botões independentes que dariam a entender que se pode
                 * empilhar integração.
                 */
                role="radio"
                aria-checked={estaEmUso}
                className={`group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                  estaEmUso ? 'bg-white/[0.045]' : 'hover:bg-white/[0.025]'
                }`}
              >
                {/*
                  A marca do rádio.

                  Pedido de quem monta fluxo: *"queria tipo um radio button que
                  vai marcando selecionado"* — o estado morava só no fundo do
                  item, e fundo é a coisa mais fácil de não notar numa lista de
                  catorze. Aqui ele tem lugar fixo, na mesma coluna em todas as
                  linhas, e some do caminho quando não está marcado.
                */}
                <span
                  aria-hidden
                  className={`mt-[3px] flex size-[13px] shrink-0 items-center justify-center rounded-full border transition ${
                    estaEmUso
                      ? 'border-accent/70'
                      : 'border-white/[0.18] group-hover:border-white/30'
                  }`}
                >
                  {estaEmUso && <span className="size-[6px] rounded-full bg-accent" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[12px] leading-[1.35] transition ${
                      estaEmUso ? 'font-semibold text-soft' : 'font-medium text-[#b7c0cf]'
                    }`}
                  >
                    {item.nome}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-dim">{item.resumo}</span>

                  {/*
                    O que ele exige aparece **no item marcado**, e não numa
                    caixa separada que só existia depois de clicar.

                    Quem acabou de aplicar precisa saber o que falta agora; quem
                    está lendo a lista não precisa de catorze avisos de
                    credencial na tela ao mesmo tempo.
                  */}
                  {estaEmUso && (
                    <>
                      <span className="mt-1.5 block text-[10.5px] leading-4 text-dim">
                        {item.exige}
                      </span>
                      {item.credencial !== 'nenhuma' && (
                        <span
                          className={`mt-1 block text-[10.5px] leading-4 ${
                            bloco?.temCredencial ? 'text-emerald-300/70' : 'text-amber-200/75'
                          }`}
                        >
                          {bloco?.temCredencial
                            ? 'credencial escolhida'
                            : 'falta escolher a credencial abaixo'}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </button>
            )
          })}
                </div>
              </div>
            )
          })}

          <p className="px-0.5 text-[10.5px] leading-4 text-dim">
            Escolher preenche o endereço, o corpo, os cabeçalhos e o que guardar
            deste bloco. Depois é um bloco comum, e você edita o que quiser.
          </p>
        </div>
      )}
    </div>
  )
}
