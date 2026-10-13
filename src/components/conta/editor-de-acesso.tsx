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
import { Dropdown } from '@/components/design/dropdown'
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
    detalhe: 'incluir contatos no funil e mover cartões.',
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
  proprios: 'Apenas o que é dela',
  equipe: 'Da equipe dela',
  todos: 'De toda a organização',
}

/**
 * O alcance em uma ou duas palavras, para o seletor fechado e o selo do resumo.
 * "De toda a organização" não cabia nos dois e cortava (13/out/2026); a frase
 * inteira vai como detalhe na lista aberta.
 */
const ESCOPO_CURTO: Record<Escopo, string> = {
  nenhum: 'Não pode',
  proprios: 'Apenas as dela',
  equipe: 'Da equipe',
  todos: 'Todos',
}

const DETALHE_DO_ESCOPO: Partial<Record<Escopo, string>> = {
  proprios: 'só o que está atribuído a ela',
  equipe: 'o que é de quem está na equipe dela',
  todos: 'tudo da organização',
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
  aoSalvar,
}: {
  clienteId: string
  membro: MembroParaAcesso | null
  equipesDaConta: { id: string; nome: string }[]
  aoFechar: () => void
  /** O acesso como ficou, para a tela mudar já, sem esperar a página voltar. */
  aoSalvar?: (atualizado: MembroParaAcesso) => void
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
  const naoPode = efetivo.filter((linha) => linha.escopo === 'nenhum')

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
        setErro(r.erro ?? 'não foi possível salvar o acesso')
        return
      }
      aoSalvar?.({ ...membro, equipes, sobrescritas })
      aoFechar()
    })
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Acesso de ${membro.nome}`}
      descricao={`Papel na conta: ${ROTULO_DO_PAPEL[papel]}. Escolha um perfil; quem não tem acesso a uma tela não a vê no menu, e o servidor recusa a chamada direta.`}
      largura={600}
    >
      <div className="flex flex-col gap-4">
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
                /*
                  Grade, e não flex: no flex o seletor engolia a linha e
                  espremia o texto em uma palavra por linha (13/out/2026). Na
                  grade a largura é a da coluna. `div`, e não `label`: o
                  Dropdown é um botão, e o clique no texto o abriria.
                */
                <div key={capacidade} className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_13.5rem] sm:items-start sm:gap-3">
                  <span className="min-w-0">
                    <strong className="block text-[13px] font-semibold">
                      {ROTULO_DA_CAPACIDADE[capacidade].titulo}
                    </strong>
                    <span className="block text-[11.5px] leading-5 text-dim">
                      {ROTULO_DA_CAPACIDADE[capacidade].detalhe}
                    </span>
                  </span>
                  <Dropdown
                    valor={daSobrescrita ?? 'papel'}
                    aoMudar={(valor) => trocar(capacidade, valor)}
                    rotuloAcessivel={ROTULO_DA_CAPACIDADE[capacidade].titulo}
                    className="w-full"
                    opcoes={[
                      { valor: 'papel', rotulo: `Padrão (${ESCOPO_CURTO[doPapel].toLowerCase()})`, detalhe: 'o que a função dela já dá' },
                      ...ESCOPOS.map((escopo) => ({ valor: escopo, rotulo: ESCOPO_CURTO[escopo], detalhe: DETALHE_DO_ESCOPO[escopo] })),
                    ]}
                  />
                </div>
              )
            })}
          </section>
          </details>
        </div>

        {/*
          A prévia. Ela responde a pergunta que a lista de chaves não responde:
          "depois de salvar, o que essa pessoa consegue fazer?"
        */}
        {/*
          Recolhido por padrão (13/out/2026): aberto ao lado, o resumo competia
          com o que se está editando e parecia parte do formulário. Quem quer
          conferir abre; o aviso de equipe sem alcance fica sempre à vista.
        */}
        <details className="group rounded-xl border border-line text-[12px] leading-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px] font-semibold text-muted">
            <span className="flex items-center gap-2">
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0 text-dim" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.25v3.5M8 5.1v.05" />
              </svg>
              Como fica o acesso de {membro.nome.split(' ')[0]}
            </span>
            <span className="text-[11px] font-normal text-dim group-open:hidden">
              pode {podeDeVerdade.length} de {efetivo.length}
            </span>
            <span className="hidden text-[11px] font-normal text-dim group-open:inline">recolher</span>
          </summary>
          <div className="border-t border-line px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-px text-[11.5px] font-semibold text-primary">
              {resumo.perfil}
            </span>
            <span className="text-dim">assim fica depois de salvar</span>
          </div>

          {podeDeVerdade.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-panel p-3 text-muted">
              Esta pessoa não vai conseguir fazer nada nesta conta. Ela continua
              entrando, e vê só o que não depende de permissão.
            </p>
          ) : (
            <>
              <span className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <IconeDoResumo pode />
                Pode
              </span>
              {/* Cada coisa que ela faz, com o alcance ao lado: "de quem" é a
                  metade da resposta, e numa frase corrida ela se perdia. */}
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
                {podeDeVerdade.map(({ capacidade, escopo }) => (
                  <li key={capacidade} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 text-[12.5px] text-ink">{ROTULO_DA_CAPACIDADE[capacidade].titulo}</span>
                    <span className="shrink-0 rounded-full bg-ok/10 px-2 py-px text-[11px] font-medium whitespace-nowrap text-ok">
                      {ESCOPO_CURTO[escopo]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {naoPode.length > 0 && (
            <>
              <span className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <IconeDoResumo pode={false} />
                Não pode
              </span>
              <p className="mt-1 text-dim">
                {naoPode.map(({ capacidade }) => ROTULO_DA_CAPACIDADE[capacidade].titulo).join(', ')}.
              </p>
            </>
          )}


          {/*
            A fila sem responsável não é de todos por acidente (RB-40): quem
            está no escopo `proprios` não alcança conversa que ninguém assumiu.
            Dizer isso aqui evita a descoberta pelo caminho caro.
          */}
          {efetivo.some((l) => l.capacidade === 'atender' && l.escopo === 'proprios') && (
            <p className="mt-4 rounded-lg border border-primary/15 bg-primary/5 p-2.5 text-muted">
              Com <strong className="text-ink">Apenas as dela</strong> em Atender,
              ela não vê a fila de quem ninguém assumiu, só as conversas atribuídas
              a ela.
            </p>
          )}
          </div>
        </details>
          {escopoDeEquipeSemEquipe && (
            <p className="rounded-lg border border-aviso/30 bg-aviso/10 p-2.5 text-aviso">
              Alguma capacidade está no escopo da equipe, e esta pessoa não está em
              equipe nenhuma. Na prática isso é não poder:{' '}
              {equipesDaConta.length > 0
                ? 'escolha uma equipe acima.'
                : 'crie uma equipe no bloco Equipes, nesta página.'}
            </p>
          )}

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
          className="botao-primario botao-md"
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

/** O visto verde do que ela pode, e o traço apagado do que não pode. */
function IconeDoResumo({ pode }: { pode: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-4 place-items-center rounded-full ${pode ? 'bg-ok/15 text-ok' : 'bg-line text-dim'}`}
    >
      <svg viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {pode ? <path d="M3.5 8.5l3 3 6-7" /> : <path d="M4.5 8h7" />}
      </svg>
    </span>
  )
}
