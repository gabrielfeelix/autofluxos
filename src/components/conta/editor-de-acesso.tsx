'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  CAPACIDADES,
  ESCOPOS,
  MODELOS_EXTRA,
  POLITICAS,
  ROTULO_DO_MODELO,
  ROTULO_DO_PAPEL,
  escopoDe,
  resumoDoAcesso,
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
 *
 * ---------------------------------------------------------------------------
 * Perfil primeiro, matriz depois (E1, E13)
 * ---------------------------------------------------------------------------
 *
 * Quem abre o editor quer dizer "esta pessoa atende" ou "esta pessoa gere", e
 * não traduzir oito linhas de capacidade. Os perfis ficam em cima; a matriz
 * vai para "Ajustes avançados", recolhida, e abre sozinha quando o acesso já
 * é personalizado (senão a pessoa não veria o que está diferente).
 */

export const ROTULO_DA_CAPACIDADE: Record<Capacidade, { titulo: string; detalhe: string }> = {
  configurar_empresa: {
    titulo: 'Configurar a organização',
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

export const ROTULO_DO_ESCOPO: Record<Escopo, string> = {
  nenhum: 'Não pode',
  proprios: 'Só o que é dela',
  equipe: 'Da equipe dela',
  todos: 'De toda a organização',
}

export type MembroParaAcesso = {
  id: string
  nome: string
  papel: string
  equipes: string[]
  sobrescritas: Partial<Politica>
  /** A política da função da pessoa (A7). Ausente = a do papel. */
  base?: Politica
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
  const [confirmandoSemAlcance, setConfirmandoSemAlcance] = useState(false)
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
        escopo: escopoDe({ papel, sobrescritas, equipes, usuarioId: membro?.id, politicaBase: membro?.base }, capacidade),
      })),
    [papel, sobrescritas, equipes, membro?.id, membro?.base],
  )

  const podeDeVerdade = efetivo.filter((linha) => linha.escopo !== 'nenhum')

  const nomesDasEquipes = useMemo(
    () => Object.fromEntries(equipesDaConta.map((equipe) => [equipe.id, equipe.nome])),
    [equipesDaConta],
  )
  const resumo = resumoDoAcesso({ papel, sobrescritas, equipes, usuarioId: membro?.id, politicaBase: membro?.base }, nomesDasEquipes)

  /** Escopo de equipe sem equipe nenhuma alcança zero registros (E14). */
  const escopoDeEquipeSemEquipe = resumo.semAlcance

  const [avancadoAberto, setAvancadoAberto] = useState(resumo.perfil === 'Acesso personalizado')

  if (!membro) return null

  const trocar = (capacidade: Capacidade, valor: string) => {
    setErro(null)
    setConfirmandoSemAlcance(false)
    setSobrescritas((atual) => {
      const copia = { ...atual }
      // "Igual ao papel" apaga a sobrescrita, ver o cabeçalho.
      if (valor === 'papel') delete copia[capacidade]
      else copia[capacidade] = valor as Escopo
      return copia
    })
  }

  const aplicarModelo = (modelo: keyof typeof MODELOS_EXTRA | null) => {
    setErro(null)
    setConfirmandoSemAlcance(false)
    setSobrescritas(modelo ? { ...MODELOS_EXTRA[modelo] } : {})
  }

  const salvar = () => {
    setErro(null)
    // Salvar sem alcance é permitido (a pessoa pode entrar na equipe depois),
    // mas nunca por acidente: o primeiro clique mostra o efeito e pede outro.
    if (escopoDeEquipeSemEquipe && !confirmandoSemAlcance) {
      setConfirmandoSemAlcance(true)
      return
    }
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
      descricao={`Papel na conta: ${ROTULO_DO_PAPEL[papel]}. Escolha um perfil; quem não tem acesso a uma tela não a vê no menu, e o servidor recusa a chamada direta.`}
      largura={760}
    >
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <section>
            <RotuloCampo>Perfil de acesso</RotuloCampo>
            <div className="flex flex-wrap gap-2">
              <BotaoDeModelo
                rotulo={papel === 'member' ? 'Membro (acesso amplo)' : ROTULO_DO_PAPEL[papel]}
                ativo={resumo.perfil === ROTULO_DO_PAPEL[papel]}
                aoClicar={() => aplicarModelo(null)}
              />
              <BotaoDeModelo
                rotulo={ROTULO_DO_MODELO.gestor}
                ativo={resumo.perfil === ROTULO_DO_MODELO.gestor}
                aoClicar={() => aplicarModelo('gestor')}
              />
              <BotaoDeModelo
                rotulo={ROTULO_DO_MODELO.operador}
                ativo={resumo.perfil === ROTULO_DO_MODELO.operador}
                aoClicar={() => aplicarModelo('operador')}
              />
              {resumo.perfil === 'Acesso personalizado' && (
                <BotaoDeModelo rotulo="Acesso personalizado" ativo aoClicar={() => setAvancadoAberto(true)} />
              )}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-5 text-dim">
              Perfil é ponto de partida, não cargo. Nada é salvo até você clicar em
              Salvar acesso.
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
                      onClick={() => {
                        setConfirmandoSemAlcance(false)
                        setEquipes((atual) =>
                          dentro ? atual.filter((id) => id !== equipe.id) : [...atual, equipe.id],
                        )
                      }}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                        dentro
                          ? 'border-transparent bg-primary-weak text-primary-strong'
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

          <details
            open={avancadoAberto}
            onToggle={(e) => setAvancadoAberto(e.currentTarget.open)}
            className="group rounded-xl border border-line"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px] font-semibold text-muted">
              Ajustes avançados
              <span className="text-[11px] font-normal text-dim">
                {avancadoAberto ? 'recolher' : 'capacidade por capacidade'}
              </span>
            </summary>
          <section className="flex flex-col gap-2.5 border-t border-line px-3.5 py-3">
            {CAPACIDADES.map((capacidade) => {
              const daSobrescrita = sobrescritas[capacidade]
              const doPapel = (membro?.base ?? POLITICAS[papel])[capacidade]
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
                      Igual à função ({ROTULO_DO_ESCOPO[doPapel].toLowerCase()})
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
          </details>
        </div>

        {/*
          A prévia. Ela responde a pergunta que a lista de chaves não responde:
          "depois de salvar, o que essa pessoa consegue fazer?"
        */}
        <aside className="rounded-xl border border-line bg-surface p-4 text-[12px] leading-5 md:sticky md:top-0 md:self-start">
          <strong className="block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
            Depois de salvar
          </strong>
          <span className="mt-1.5 block text-[13px] font-semibold text-claro">{resumo.perfil}</span>
          <p className="mt-0.5 text-dim">{resumo.frases.join(' · ')}</p>

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
            <p className="mt-3 rounded-lg border border-aviso/30 bg-aviso/10 p-2.5 text-aviso">
              Alguma capacidade está no escopo da equipe, e esta pessoa não está em
              equipe nenhuma. Na prática isso é não poder:{' '}
              {equipesDaConta.length > 0
                ? 'escolha uma equipe acima.'
                : 'crie uma equipe no bloco Equipes, nesta página.'}
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

      {confirmandoSemAlcance && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-aviso/30 bg-aviso/10 p-2.5 text-[12px] text-aviso"
        >
          Assim {membro.nome} não alcança nenhum contato: o escopo é da equipe e ela
          não está em equipe nenhuma. Escolha uma equipe, ou clique de novo para
          salvar mesmo assim.
        </p>
      )}

      {erro && (
        <p className="mt-4 rounded-lg border border-perigo/30 bg-perigo/10 p-2.5 text-[12px] text-perigo">
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
          className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-primary-ink transition hover:bg-primary-strong disabled:opacity-50"
        >
          {rodando ? 'Salvando…' : confirmandoSemAlcance ? 'Salvar mesmo assim' : 'Salvar acesso'}
        </button>
      </div>
    </Modal>
  )
}

function BotaoDeModelo({
  rotulo,
  ativo = false,
  aoClicar,
}: {
  rotulo: string
  ativo?: boolean
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
        ativo
          ? 'border-transparent bg-primary-weak text-primary-strong'
          : 'border-line text-dim hover:text-muted'
      }`}
    >
      {rotulo}
    </button>
  )
}
