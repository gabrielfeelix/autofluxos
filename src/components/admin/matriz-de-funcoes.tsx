'use client'

import { useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { ROTULO_DA_CAPACIDADE, ROTULO_DO_ESCOPO } from '@/components/conta/editor-de-acesso'
import { CAPACIDADES, ESCOPOS, type Capacidade, type Escopo, type Politica } from '@/core/permissoes'
import { acaoAdminSalvarFuncao } from '@/server/acoes-admin'
import { CLASSE_DO_CABECALHO, COLUNA_FIXA, FUNDO_DA_FIXA, FUNDO_DA_LINHA } from './partes'

export type FuncaoNaMatriz = { id: string; nome: string; nivel: number; descricao: string; capacidades: Politica }

const TOM: Record<Escopo, string> = {
  todos: 'bg-primary-weak text-primary border-primary/25',
  equipe: 'bg-emerald-400/[0.1] text-ok border-emerald-400/30',
  proprios: 'bg-amber-400/[0.1] text-aviso border-amber-400/30',
  nenhum: 'bg-surface text-dim border-line',
}

/**
 * O que cada função pode fazer, capacidade por capacidade.
 *
 * A mesma matriz serve à administração (editável, uma célula por vez, salva
 * na hora de forma otimista) e à organização (só leitura). O Proprietário não
 * se edita: é quem pode tudo, e tirar algo dele deixaria a organização sem
 * ninguém que possa devolver.
 */
export function MatrizDeFuncoes({ funcoes: iniciais, editavel = false }: { funcoes: FuncaoNaMatriz[]; editavel?: boolean }) {
  const [funcoes, setFuncoes] = useState(iniciais)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, comecar] = useTransition()

  const trocar = (funcao: FuncaoNaMatriz, capacidade: Capacidade, escopo: Escopo) => {
    const antes = funcoes
    const capacidades = { ...funcao.capacidades, [capacidade]: escopo }
    setFuncoes((lista) => lista.map((item) => (item.id === funcao.id ? { ...item, capacidades } : item)))
    comecar(async () => {
      try {
        const r = await acaoAdminSalvarFuncao(funcao.id, capacidades)
        if (!r.ok) {
          setFuncoes(antes)
          setAviso(r.erro ?? 'não deu para salvar a função')
        }
      } catch {
        setFuncoes(antes)
        setAviso('sem conexão com o servidor')
      }
    })
  }

  return (
    <div className="app-card flex min-h-0 flex-col overflow-hidden">
      <RolagemDaTabela>
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line align-bottom">
              <th scope="col" className={`${CLASSE_DO_CABECALHO} ${COLUNA_FIXA} z-[3] bg-panel`}>Capacidade</th>
              {funcoes.map((funcao) => (
                <th key={funcao.id} scope="col" className="min-w-[150px] px-4 py-3">
                  <span className="block text-[13px] font-bold text-ink">{funcao.nome}</span>
                  <span className="block text-[10.5px] font-semibold tracking-[0.06em] text-dim uppercase">nível {funcao.nivel}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPACIDADES.map((capacidade) => (
              <tr key={capacidade} className={`group border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}>
                <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                  <span className="block text-[13px] font-semibold">{ROTULO_DA_CAPACIDADE[capacidade].titulo}</span>
                  <span className="block max-w-[300px] text-[11.5px] leading-[1.45] text-dim">{ROTULO_DA_CAPACIDADE[capacidade].detalhe}</span>
                </td>
                {funcoes.map((funcao) => {
                  const escopo = funcao.capacidades[capacidade]
                  const trava = !editavel || funcao.id === 'proprietario'
                  return (
                    <td key={funcao.id} className="px-4 py-3">
                      {trava ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${TOM[escopo]}`}>{ROTULO_DO_ESCOPO[escopo]}</span>
                      ) : (
                        <select
                          aria-label={`${ROTULO_DA_CAPACIDADE[capacidade].titulo}, ${funcao.nome}`}
                          value={escopo}
                          onChange={(evento) => trocar(funcao, capacidade, evento.target.value as Escopo)}
                          className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${TOM[escopo]}`}
                        >
                          {ESCOPOS.map((opcao) => (
                            <option key={opcao} value={opcao}>
                              {ROTULO_DO_ESCOPO[opcao]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </RolagemDaTabela>
      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </div>
  )
}
