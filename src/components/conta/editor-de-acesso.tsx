'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  CAPACIDADES,
  ESCOPOS,
  MODELOS_EXTRA,
  POLITICAS,
  escopoDe,
  type Capacidade,
  type Escopo,
  type PapelDaConta,
  type Politica,
} from '@/core/permissoes'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { acaoSalvarAcesso } from '@/server/acoes-acesso'

/**
 * UI-18, o que esta pessoa pode fazer nesta conta.
 *
 * ---------------------------------------------------------------------------
 * A prévia é o ponto, não enfeite
 * ---------------------------------------------------------------------------
 *
 * Permissão é a configuração que mais se erra em silêncio: quem edita não é
 * quem sofre o efeito, e o efeito só aparece quando a outra pessoa tenta
 * trabalhar. Por isso a coluna da direita mostra, em português, **o que esta
 * pessoa vai conseguir fazer depois de salvar**, e não a lista de chaves que
 * acabou de marcar.
 *
 * ---------------------------------------------------------------------------
 * "Igual ao papel" não é um escopo
 * ---------------------------------------------------------------------------
 *
 * Cada capacidade tem uma linha a mais que os escopos: **Igual ao papel**. Ela
 * apaga a sobrescrita em vez de gravar o valor atual, e a diferença importa ,
 * gravar o valor congelaria a pessoa na política de hoje, e trocar o papel
 * dela depois não teria efeito nenhum. Ver `definirCapacidades`.
 */

const ROTULO_DA_CAPACIDADE: Record<Capacidade, { titulo: string; detalhe: string }> = {
  configurar_empresa: {
    titulo: 'Configurar a empresa',
    detalhe: 'equipe, acesso, canais e cadastro. É o poder de dar poder.',
  },
  configurar_operacao: {
    titulo: 'Configurar a operação',
    detalhe: 'bot, automações, funis, etapas e modelos de mensagem.',
  },
  atender: {
    titulo: 'Atender',
    detalhe: 'ler e responder conversas, editar dados do contato.',
  },
  criar_oportunidade: {
    titulo: 'Criar oportunidade',
    detalhe: 'pôr gente no funil e mover cartão.',
  },
  registrar_venda: {
    titulo: 'Registrar venda ou perda',
    detalhe: 'concluir uma negociação.',
  },
  corrigir_venda: {
    titulo: 'Corrigir ou cancelar venda',
    detalhe: 'mexer em número já fechado.',
  },
  ler_valores: {
    titulo: 'Ver valores',
    detalhe: 'quanto o cliente rendeu, total do funil, receita.',
  },
  exportar: {
    titulo: 'Exportar e transmitir',
    detalhe: 'baixar CSV, disparar para lista, importar em lote.',
  },
}

const ROTULO_DO_ESCOPO: Record<Escopo, string> = {
  nenhum: 'Não pode',
  proprios: 'Só o que é dela',
  equipe: 'Da equipe dela',
  todos: 'De toda a conta',
}

export type MembroParaAcesso = {
  id: string
  nome: string
  papel: string
  equipes: string[]
  sobrescritas: Partial<Politica>
}

export function EditorDeAcesso({
  clienteId,
  membro,
  equipesDaConta,
  aoFechar,
}: {
  clienteId: string
  membro: MembroParaAcesso | null
  equipesDaConta: { id: string; nome: string }[]
  aoFechar: () => void
}) {
  const papel: PapelDaConta =
    membro?.papel === 'owner' || membro?.papel === 'admin' ? membro.papel : 'member'

  const [sobrescritas, setSobrescritas] = useState<Partial<Politica>>(membro?.sobrescritas ?? {})
  const [equipes, setEquipes] = useState<string[]>(membro?.equipes ?? [])
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  /**
   * O acesso resultante, calculado pela **mesma função do servidor**.
   *
   * Reimplementar a regra aqui para desenhar a prévia daria duas verdades, e a
   * da tela seria a errada no dia em que a do servidor mudasse. `escopoDe` é
   * puro justamente para caber nos dois lados.
   */
  const efetivo = useMemo(
    () =>
      CAPACIDADES.map((capacidade) => ({
        capacidade,
        escopo: escopoDe({ papel, sobrescritas, equipes, usuarioId: membro?.id }, capacidade),
      })),
    [papel, sobrescritas, equipes, membro?.id],
  )

  const podeDeVerdade = efetivo.filter((linha) => linha.escopo !== 'nenhum')

  /** Escopo de equipe sem equipe nenhuma alcança zero registros. Avisar é barato. */
  const escopoDeEquipeSemEquipe =
    equipes.length === 0 && efetivo.some((linha) => linha.escopo === 'equipe')

  if (!membro) return null

  const trocar = (capacidade: Capacidade, valor: string) => {
    setErro(null)
    setSobrescritas((atual) => {
      const copia = { ...atual }
      // "Igual ao papel" apaga a sobrescrita, ver o cabeçalho.
      if (valor === 'papel') delete copia[capacidade]
      else copia[capacidade] = valor as Escopo
      return copia
    })
  }

  const aplicarModelo = (modelo: keyof typeof MODELOS_EXTRA) => {
    setErro(null)
    setSobrescritas({ ...MODELOS_EXTRA[modelo] })
  }

  const salvar = () => {
    setErro(null)
    comecar(async () => {
      const r = await acaoSalvarAcesso(clienteId, membro.id, {
        papel,
        equipes,
        capacidades: sobrescritas as Record<string, string>,
      })
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para salvar o acesso')
        return
      }
      aoFechar()
    })
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Acesso de ${membro.nome}`}
      descricao="O papel dá o padrão; aqui você muda só o que precisa ser diferente. Quem não tem uma capacidade não vê a tela dela, e a chamada direta também é recusada."
      largura={760}
    >
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <section>
            <RotuloCampo>Começar de um modelo</RotuloCampo>
            <div className="flex flex-wrap gap-2">
              <BotaoDeModelo rotulo="Gestor" aoClicar={() => aplicarModelo('gestor')} />
              <BotaoDeModelo rotulo="Operador" aoClicar={() => aplicarModelo('operador')} />
              <BotaoDeModelo rotulo="Limpar exceções" aoClicar={() => setSobrescritas({})} />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-5 text-dim">
              Modelo é ponto de partida, não cargo: depois de aplicar, mexa no que
              quiser. Nada é salvo até você clicar em Salvar acesso.
            </p>
          </section>

          {equipesDaConta.length > 0 && (
            <section>
              <RotuloCampo>Equipes</RotuloCampo>
              <div className="flex flex-wrap gap-2">
                {equipesDaConta.map((equipe) => {
                  const dentro = equipes.includes(equipe.id)
                  return (
                    <button
                      key={equipe.id}
                      type="button"
                      onClick={() =>
                        setEquipes((atual) =>
                          dentro ? atual.filter((id) => id !== equipe.id) : [...atual, equipe.id],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                        dentro
                          ? 'border-transparent bg-emerald-400/15 text-emerald-300'
                          : 'border-line text-dim hover:text-muted'
                      }`}
                    >
                      {equipe.nome}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2.5">
            <RotuloCampo>O que ela pode</RotuloCampo>
            {CAPACIDADES.map((capacidade) => {
              const daSobrescrita = sobrescritas[capacidade]
              const doPapel = POLITICAS[papel][capacidade]
              return (
                <label key={capacidade} className="flex items-start gap-3">
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[13px] font-semibold">
                      {ROTULO_DA_CAPACIDADE[capacidade].titulo}
                    </strong>
                    <span className="block text-[11.5px] leading-5 text-dim">
                      {ROTULO_DA_CAPACIDADE[capacidade].detalhe}
                    </span>
                  </span>
                  <select
                    value={daSobrescrita ?? 'papel'}
                    onChange={(e) => trocar(capacidade, e.target.value)}
                    className="app-field shrink-0 px-2 py-1.5 text-[12px]"
                  >
                    <option value="papel">
                      Igual ao papel ({ROTULO_DO_ESCOPO[doPapel].toLowerCase()})
                    </option>
                    {ESCOPOS.map((escopo) => (
                      <option key={escopo} value={escopo}>
                        {ROTULO_DO_ESCOPO[escopo]}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </section>
        </div>

        {/*
          A prévia. Ela responde a pergunta que a lista de chaves não responde:
          "depois de salvar, o que essa pessoa consegue fazer?"
        */}
        <aside className="rounded-xl border border-line bg-black/20 p-4 text-[12px] leading-5 md:sticky md:top-0 md:self-start">
          <strong className="block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
            Depois de salvar
          </strong>

          {podeDeVerdade.length === 0 ? (
            <p className="mt-2 text-dim">
              Esta pessoa não vai conseguir fazer nada nesta conta. Ela continua
              entrando, e vê só o que não depende de permissão.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {podeDeVerdade.map(({ capacidade, escopo }) => (
                <li key={capacidade} className="text-muted">
                  {ROTULO_DA_CAPACIDADE[capacidade].titulo}
                  <span className="text-dim">, {ROTULO_DO_ESCOPO[escopo].toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}

          {escopoDeEquipeSemEquipe && (
            <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-amber-200">
              Alguma capacidade está no escopo da equipe, e esta pessoa não está em
              equipe nenhuma. Na prática isso é não poder: escolha uma equipe acima.
            </p>
          )}

          {/*
            A fila sem responsável não é de todos por acidente (RB-40): quem
            está no escopo `proprios` não alcança conversa que ninguém assumiu.
            Dizer isso aqui evita a descoberta pelo caminho caro.
          */}
          {efetivo.some((l) => l.capacidade === 'atender' && l.escopo === 'proprios') && (
            <p className="mt-3 text-dim">
              Com <strong className="text-muted">só o que é dela</strong> em Atender,
              ela não vê a fila de quem ninguém assumiu, só as conversas atribuídas
              a ela.
            </p>
          )}
        </aside>
      </div>

      {erro && (
        <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-2.5 text-[12px] text-rose-200">
          {erro}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={aoFechar}
          className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-semibold text-dim transition hover:text-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={rodando}
          className="rounded-lg bg-emerald-400/90 px-3.5 py-2 text-[12.5px] font-bold text-black transition hover:bg-emerald-300 disabled:opacity-50"
        >
          {rodando ? 'Salvando…' : 'Salvar acesso'}
        </button>
      </div>
    </Modal>
  )
}

function BotaoDeModelo({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-dim transition hover:text-muted"
    >
      {rotulo}
    </button>
  )
}
