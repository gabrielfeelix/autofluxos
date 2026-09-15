'use client'

import { useState } from 'react'
import { LIMITE_DO_NOME } from '@/core/quadros'
import { MODELOS_DE_QUADRO, type ModeloDeQuadro } from '@/core/quadros-modelos'
import { Modal } from '@/components/design/modal'

/**
 * Criar quadro: primeiro **como**, depois o nome.
 *
 * É a mesma ordem do modal de automações, e pelo mesmo motivo: perguntar o nome
 * antes obriga quem só queria ver os prontos a preencher formulário para chegar
 * na lista.
 *
 * Antes daqui, todo quadro nascia `Novo · Em conversa · Fechado`. Neutro serve a
 * qualquer negócio porque não descreve nenhum — e quem vende com SDR, quem
 * agenda avaliação e quem quer recompra montava tudo na mão, sem saber quantas
 * etapas usar nem onde marcar o ganho.
 *
 * A miniatura mostra **as etapas de verdade**, com a de ganho em verde e a de
 * perda em rosa. É o que responde "esse funil é o meu?" antes de qualquer
 * palavra — e o que impede o template de ser um nome bonito que ninguém entende.
 */
/**
 * O `acaoCriarQuadro` já ligado ao cliente.
 *
 * Devolve o estado do formulário porque a ação é a mesma que o modal antigo
 * usava — e o retorno é ignorado aqui de propósito: `revalidatePath` já repinta
 * a página com o quadro novo, e o erro que importa (nome repetido) chega pela
 * própria recarga.
 */
type Acao = (formData: FormData) => Promise<{ ok?: boolean; erro?: string }>

export function NovoQuadro({ acao, primeiro }: { acao: Acao; primeiro: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [passo, setPasso] = useState<'como' | 'modelos' | 'nome'>('como')
  const [modelo, setModelo] = useState<ModeloDeQuadro | null>(null)

  function fechar() {
    setAberto(false)
    setPasso('como')
    setModelo(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          primeiro
            ? 'app-primary-button px-4 py-2.5 text-[13px]'
            : 'app-secondary-button px-3.5 py-2 text-[12.5px]'
        }
      >
        + Novo quadro
      </button>

      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={passo === 'nome' ? 'Dê um nome ao quadro' : 'Novo quadro'}
        descricao={
          passo === 'como'
            ? 'Um quadro é o seu funil desenhado: as etapas por onde a pessoa passa, do primeiro contato ao desfecho.'
            : passo === 'modelos'
              ? 'Cada modelo já vem com as etapas, o prazo de cada uma e onde fica o ganho e a perda. Dá para mudar tudo depois.'
              : undefined
        }
      >
        {passo === 'como' && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Caminho
              titulo="Usar um modelo"
              detalhe="Comercial, captação, agenda, pós-venda. Começa pronto."
              aoClicar={() => setPasso('modelos')}
              miniatura={<MiniaturaDasEtapas etapas={MODELOS_DE_QUADRO[1]!.etapas} />}
            />
            <Caminho
              titulo="Começar do zero"
              detalhe="Uma etapa só, e você desenha o resto."
              aoClicar={() => {
                setModelo(null)
                setPasso('nome')
              }}
              miniatura={<MiniaturaDasEtapas etapas={[{ nome: 'Novo' }]} />}
            />
          </div>
        )}

        {passo === 'modelos' && (
          <div className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-0.5">
            {MODELOS_DE_QUADRO.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setModelo(m)
                  setPasso('nome')
                }}
                className="group rounded-xl border border-line bg-panel p-3 text-left transition hover:border-primary/45 hover:bg-primary/[0.04]"
              >
                <span className="flex items-baseline gap-2">
                  <strong className="text-[13px] font-bold text-soft">{m.nome}</strong>
                  <span className="text-[10.5px] text-dim">{m.etapas.length} etapas</span>
                </span>
                <span className="mt-1 block text-[11.5px] leading-[1.5] text-dim">{m.resumo}</span>
                <span className="mt-2.5 block">
                  <MiniaturaDasEtapas etapas={m.etapas} comNome />
                </span>
              </button>
            ))}
          </div>
        )}

        {passo === 'nome' && (
          <form
            /*
             * O retorno da ação é descartado aqui, e é isso que o `void`
             * documenta: `acaoCriarQuadro` devolve o estado que o modal antigo
             * lia com `useActionState`. Quem repinta a tela é o
             * `revalidatePath` de dentro dela.
             */
            action={(dados) => {
              void acao(dados)
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="modelo" value={modelo?.id ?? 'branco'} />

            {modelo && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-soft">{modelo.nome}</span>
                  <span className="mt-0.5 block text-[11px] leading-[1.45] text-dim">
                    {modelo.etapas.map((e) => e.nome).join(' · ')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setPasso('modelos')}
                  className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
                >
                  trocar
                </button>
              </div>
            )}

            <label>
              <span className="mb-1.5 block text-[11.5px] font-semibold text-soft">
                Nome do quadro
              </span>
              <input
                name="nome"
                required
                autoFocus
                maxLength={LIMITE_DO_NOME}
                defaultValue={modelo?.nome ?? ''}
                placeholder="ex.: Comercial"
                className="app-field w-full px-[13px] py-[11px] text-[13.5px]"
              />
            </label>

            <p className="text-[11.5px] leading-[1.5] text-dim">
              A mesma pessoa pode estar em vários quadros, cada um na sua etapa. Renomear, mover e
              apagar etapa continuam ali, no menu da coluna.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={fechar}
                className="app-secondary-button px-3.5 py-2 text-[12.5px]"
              >
                Cancelar
              </button>
              <button type="submit" className="app-primary-button px-4 py-2 text-[12.5px]">
                Criar quadro
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}

function Caminho({
  titulo,
  detalhe,
  miniatura,
  aoClicar,
}: {
  titulo: string
  detalhe: string
  miniatura: React.ReactNode
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="flex h-full flex-col items-start rounded-xl border border-line bg-panel p-3 text-left transition hover:border-primary/45 hover:bg-primary/[0.04]"
    >
      <span className="w-full">{miniatura}</span>
      <span className="mt-2.5 text-[13px] font-bold text-soft">{titulo}</span>
      <span className="mt-1 text-[11.5px] leading-[1.5] text-dim">{detalhe}</span>
    </button>
  )
}

/**
 * O funil em miniatura: uma coluna por etapa, na ordem.
 *
 * As alturas decrescem de propósito — é a forma de funil, e ela diz num relance
 * que aquilo é um caminho com desfecho, não uma lista de pastas. Verde e rosa
 * marcam onde fica o ganho e a perda, que é a única coisa do modelo que tem
 * consequência no sistema.
 */
function MiniaturaDasEtapas({
  etapas,
  comNome = false,
}: {
  etapas: readonly { nome: string; tipo?: string }[]
  comNome?: boolean
}) {
  return (
    <span className="flex items-end gap-1">
      {etapas.map((etapa, indice) => {
        const altura = Math.max(14, 34 - indice * 4)
        return (
          <span key={etapa.nome} className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              style={{ height: altura }}
              className={`block rounded-[3px] ${
                etapa.tipo === 'ganho'
                  ? 'bg-emerald-300'
                  : etapa.tipo === 'perdido'
                    ? 'bg-rose-200'
                    : 'bg-surface-strong'
              }`}
            />
            {comNome && (
              <span className="block truncate text-[9.5px] leading-3 text-dim">{etapa.nome}</span>
            )}
          </span>
        )
      })}
    </span>
  )
}
