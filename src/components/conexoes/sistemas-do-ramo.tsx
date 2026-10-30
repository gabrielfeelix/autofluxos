'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { Grupo, SolicitarIntegracao } from '@/components/loja/conectar-loja'
import { arquivoDaMarca, type FichaDoSistema, type SistemaDoRamo } from '@/core/sistemas-dos-ramos'

type Resposta = { ok: true; resumo?: string } | { ok: false; motivo: string }

export type EstadoDaAgendaNaTela = { ativo: boolean; conferidoEm: string | null }

/**
 * Configurações > Integrações > Sistemas do seu ramo (docs/SEGMENTOS-NOVOS.md).
 *
 * Em cima, os sistemas que conectam hoje: o formulário abre no próprio cartão,
 * e conectar confere a chave antes de gravar. Embaixo, os que ainda não têm
 * conector, com "Solicitar integração". O ramo da conta decide a ordem: os
 * dele primeiro (`sistemasParaAConta`).
 */
export function SistemasDoRamo({
  clienteId,
  nomeDoRamo,
  sistemas,
  agendas,
  solicitadas,
  conectar,
  testar,
  desligar,
  solicitar,
}: {
  clienteId: string
  nomeDoRamo: string | null
  sistemas: FichaDoSistema[]
  agendas: Partial<Record<SistemaDoRamo, EstadoDaAgendaNaTela>>
  solicitadas: SistemaDoRamo[]
  conectar: (plataforma: SistemaDoRamo, valores: Record<string, string>) => Promise<Resposta>
  testar: (plataforma: SistemaDoRamo) => Promise<Resposta>
  desligar: (plataforma: SistemaDoRamo) => Promise<Resposta>
  solicitar: (plataforma: SistemaDoRamo) => Promise<{ ok: true } | { ok: false; motivo: string }>
}) {
  const conectam = sistemas.filter((s) => s.campos.length > 0)
  const emBreve = sistemas.filter((s) => s.campos.length === 0)

  return (
    <Miolo largura="cheia">
      <CabecalhoDaTela
        trilha={[{ rotulo: 'Integrações', href: `/clientes/${clienteId}/ajustes/integracoes` }, { rotulo: 'Sistemas do seu ramo' }]}
        titulo="Sistemas do seu ramo"
        descricao={
          nomeDoRamo
            ? `Os sistemas de agenda e gestão mais usados em ${nomeDoRamo.toLowerCase()}. Conectado, a IA consulta horários, marca e desmarca direto no sistema que a equipe já usa.`
            : 'Os sistemas de agenda e gestão que o AutoFluxos conecta. Conectado, a IA consulta horários, marca e desmarca direto no sistema que a equipe já usa.'
        }
      />

      <div className="flex flex-col gap-6">
        <Grupo titulo="Conecta agora" nota="Uma agenda responde à IA por vez.">
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {conectam.map((ficha) => (
              <CartaoQueConecta
                key={ficha.id}
                ficha={ficha}
                estado={agendas[ficha.id] ?? null}
                conectar={conectar}
                testar={testar}
                desligar={desligar}
              />
            ))}
          </div>
        </Grupo>

        {emBreve.length > 0 && (
          <Grupo titulo="Em breve" nota="Solicite a integração do seu sistema e ela ganha prioridade.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {emBreve.map((ficha) => (
                <Cartao key={ficha.id} ficha={ficha}>
                  <SolicitarIntegracao plataforma={ficha.id} jaPedida={solicitadas.includes(ficha.id)} solicitar={solicitar} />
                </Cartao>
              ))}
            </div>
          </Grupo>
        )}

        <p className="text-[12px] leading-5 text-dim">
          O seu sistema não está na lista? Fale com o suporte. Sem sistema de agenda, a Verandi faz esse papel e já conecta.
        </p>
      </div>
    </Miolo>
  )
}

function Cartao({ ficha, selo, children }: { ficha: FichaDoSistema; selo?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="app-card flex flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white p-1.5">
          {/* Arquivo estático nosso, de tamanho fixo: `next/image` não acrescenta nada. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/marcas-de-sistemas/${arquivoDaMarca(ficha.id)}`} alt="" className="size-full object-contain" />
        </span>
        {selo}
      </div>
      <h3 className="text-[14.5px] font-bold tracking-[-0.01em]">{ficha.nome}</h3>
      <p className="mt-1 mb-4 text-[12.5px] leading-5 text-muted">{ficha.resumo}</p>
      <span className="flex-1" />
      {children}
    </article>
  )
}

function CartaoQueConecta({
  ficha,
  estado,
  conectar,
  testar,
  desligar,
}: {
  ficha: FichaDoSistema
  estado: EstadoDaAgendaNaTela | null
  conectar: (plataforma: SistemaDoRamo, valores: Record<string, string>) => Promise<Resposta>
  testar: (plataforma: SistemaDoRamo) => Promise<Resposta>
  desligar: (plataforma: SistemaDoRamo) => Promise<Resposta>
}) {
  const [ligada, setLigada] = useState(Boolean(estado?.ativo))
  const [aberto, setAberto] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [rodando, comecar] = useTransition()

  function enviar(e: FormEvent) {
    e.preventDefault()
    setAviso(null)
    comecar(async () => {
      const r = await conectar(ficha.id, valores)
      if (!r.ok) {
        setAviso({ tom: 'erro', texto: primeiraMaiuscula(r.motivo) })
        return
      }
      setLigada(true)
      setAberto(false)
      setValores({})
      setAviso({ tom: 'ok', texto: `Conectado. ${r.resumo ? primeiraMaiuscula(r.resumo) + '.' : ''}` })
    })
  }

  function conferir() {
    setAviso(null)
    comecar(async () => {
      const r = await testar(ficha.id)
      setAviso(r.ok ? { tom: 'ok', texto: `A chave vale. ${r.resumo ? primeiraMaiuscula(r.resumo) + '.' : ''}` } : { tom: 'erro', texto: primeiraMaiuscula(r.motivo) })
    })
  }

  function desconectar() {
    // Otimista: a tela desliga na hora e volta se o servidor recusar.
    setLigada(false)
    setAviso(null)
    comecar(async () => {
      const r = await desligar(ficha.id)
      if (!r.ok) {
        setLigada(true)
        setAviso({ tom: 'erro', texto: primeiraMaiuscula(r.motivo) })
      }
    })
  }

  const obrigatoriosPreenchidos = ficha.campos.every((c) => !c.obrigatorio || (valores[c.id] ?? '').trim() !== '')

  return (
    <Cartao ficha={ficha} selo={<Pilula tom={ligada ? 'ok' : 'destaque'}>{ligada ? 'Conectado' : 'Disponível'}</Pilula>}>
      {aberto ? (
        <form onSubmit={enviar} className="flex flex-col gap-3.5">
          {ficha.campos.map((campo) => (
            <div key={campo.id}>
              <label htmlFor={`${ficha.id}-${campo.id}`} className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
                {campo.rotulo}
                {!campo.obrigatorio && <span className="ml-1 font-normal tracking-normal normal-case text-dim">(opcional)</span>}
              </label>
              <input
                id={`${ficha.id}-${campo.id}`}
                type={campo.segredo ? 'password' : 'text'}
                inputMode={campo.numero ? 'numeric' : undefined}
                value={valores[campo.id] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                autoComplete="off"
                spellCheck={false}
                className="app-field px-[12px] py-[9px] text-[13px]"
              />
              <p className="mt-1 text-[11.5px] leading-[1.45] text-dim">{campo.ajuda}</p>
            </div>
          ))}
          {aviso?.tom === 'erro' && (
            <p role="alert" className="text-[12.5px] leading-5 text-perigo">
              {aviso.texto}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="submit" disabled={rodando || !obrigatoriosPreenchidos} className="botao-md botao-primario disabled:opacity-60">
              {rodando ? 'Conferindo a chave…' : 'Conferir e conectar'}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="botao-md botao-secundario">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2.5">
          {aviso && (
            <p role={aviso.tom === 'erro' ? 'alert' : 'status'} className={`text-[12.5px] leading-5 ${aviso.tom === 'erro' ? 'text-perigo' : 'text-ok'}`}>
              {aviso.texto}
            </p>
          )}
          {ligada ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={conferir} disabled={rodando} className="botao-md botao-secundario disabled:opacity-60">
                {rodando ? 'Conferindo…' : 'Testar a conexão'}
              </button>
              <button type="button" onClick={() => setAberto(true)} className="botao-md botao-secundario">
                Trocar a chave
              </button>
              <button type="button" onClick={desconectar} disabled={rodando} className="botao-md botao-secundario text-perigo">
                Desligar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAberto(true)} className="botao-md botao-primario self-start">
              Conectar
              <span aria-hidden>›</span>
            </button>
          )}
        </div>
      )}
    </Cartao>
  )
}

const primeiraMaiuscula = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : t)
