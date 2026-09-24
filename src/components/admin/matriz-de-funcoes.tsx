'use client'

import { useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { Dropdown } from '@/components/design/dropdown'
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

/** A mesma pílula, aplicada ao gatilho do nosso Dropdown (o CSS dele vence sem o `!`). */
const PILULA = '[&_.app-dropdown-trigger]:min-h-0! [&_.app-dropdown-trigger]:gap-1.5! [&_.app-dropdown-trigger]:rounded-full! [&_.app-dropdown-trigger]:px-2.5! [&_.app-dropdown-trigger]:py-1! [&_.app-dropdown-trigger]:text-[11.5px]! [&_.app-dropdown-trigger]:font-semibold!'
const TOM_DO_GATILHO: Record<Escopo, string> = {
  todos: '[&_.app-dropdown-trigger]:bg-primary-weak! [&_.app-dropdown-trigger]:text-primary! [&_.app-dropdown-trigger]:border-primary/25!',
  equipe: '[&_.app-dropdown-trigger]:bg-emerald-400/[0.1]! [&_.app-dropdown-trigger]:text-ok! [&_.app-dropdown-trigger]:border-emerald-400/30!',
  proprios: '[&_.app-dropdown-trigger]:bg-amber-400/[0.1]! [&_.app-dropdown-trigger]:text-aviso! [&_.app-dropdown-trigger]:border-amber-400/30!',
  nenhum: '[&_.app-dropdown-trigger]:bg-surface! [&_.app-dropdown-trigger]:text-dim! [&_.app-dropdown-trigger]:border-line!',
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
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap ${TOM[escopo]}`}>{ROTULO_DO_ESCOPO[escopo]}</span>
                      ) : (
                        <Dropdown
                          rotuloAcessivel={`${ROTULO_DA_CAPACIDADE[capacidade].titulo}, ${funcao.nome}`}
                          valor={escopo}
                          aoMudar={(valor) => valor !== escopo && trocar(funcao, capacidade, valor as Escopo)}
                          opcoes={ESCOPOS.map((opcao) => ({ valor: opcao, rotulo: ROTULO_DO_ESCOPO[opcao] }))}
                          className={`w-[208px] ${PILULA} ${TOM_DO_GATILHO[escopo]}`}
                        />
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
