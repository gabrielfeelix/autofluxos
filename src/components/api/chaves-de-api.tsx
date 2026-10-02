'use client'

import { useState, useTransition } from 'react'
import { Botao } from '@/components/design/botao'
import { useConfirmar } from '@/components/design/confirmar'
import { CampoParaCopiar } from '@/components/design/copiar'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { Pilula } from '@/components/design/pilula'
import {
  chaveMascarada,
  ESCOPOS_DA_API,
  quandoFoiUsada,
  type EscopoDaApi,
} from '@/core/api/chaves'
import { acaoCriarChaveDeApi, acaoRevogarChaveDeApi } from '@/server/acoes-api'
import type { ChaveDeApi } from '@/server/repos/chaves-de-api'

/**
 * A lista de chaves e o "Criar chave" (Configurações > API).
 *
 * A chave nova entra na lista assim que o servidor devolve, sem recarregar; a
 * revogada muda na hora e volta se o servidor recusar.
 */

const ROTULO_DO_ESCOPO = Object.fromEntries(ESCOPOS_DA_API.map((e) => [e.chave, e.rotulo])) as Record<EscopoDaApi, string>

const formatarData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export function ChavesDeApi({ clienteId, iniciais }: { clienteId: string; iniciais: ChaveDeApi[] }) {
  const [chaves, setChaves] = useState(iniciais)
  const [criando, setCriando] = useState(false)
  const [verRevogadas, setVerRevogadas] = useState(false)
  const { confirmar, dialogo } = useConfirmar()

  const ativas = chaves.filter((c) => !c.revogadaEm)
  const revogadas = chaves.filter((c) => c.revogadaEm)

  const revogar = (chave: ChaveDeApi) =>
    confirmar({
      titulo: `Revogar “${chave.nome}”?`,
      descricao:
        'A chave para de funcionar na próxima chamada, e o sistema que a usa passa a receber 401. Não dá para desfazer: para voltar, crie outra e troque lá.',
      rotulo: 'Revogar chave',
      tom: 'perigo',
      aoConfirmar: async () => {
        const antes = chaves
        setChaves((lista) => lista.map((c) => (c.id === chave.id ? { ...c, revogadaEm: new Date().toISOString() } : c)))
        const r = await acaoRevogarChaveDeApi(clienteId, chave.id)
        if (!r.ok) {
          setChaves(antes)
          return { ok: false, erro: r.erro }
        }
        setChaves((lista) => lista.map((c) => (c.id === chave.id ? r.chave : c)))
      },
    })

  return (
    <section aria-labelledby="titulo-chaves">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titulo-chaves" className="text-[15px] font-bold">
            Chaves ativas
          </h2>
          <p className="text-[12.5px] text-muted">Cada sistema com a sua chave: revogar uma não derruba as outras.</p>
        </div>
        <Botao variante="primario" onClick={() => setCriando(true)}>
          + Criar chave
        </Botao>
      </div>

      {ativas.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line bg-panel px-6 py-10 text-center">
          <p className="text-[14px] font-semibold">Nenhuma chave ativa</p>
          <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] leading-5 text-muted">
            Crie uma chave para o seu sistema, formulário ou parceiro cadastrar contatos e disparar
            automações nesta organização.
          </p>
          <Botao variante="secundario" className="mt-4" onClick={() => setCriando(true)}>
            Criar a primeira chave
          </Botao>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-line bg-panel">
          {ativas.map((chave) => (
            <LinhaDaChave key={chave.id} chave={chave} aoRevogar={() => revogar(chave)} />
          ))}
        </ul>
      )}

      {revogadas.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setVerRevogadas((v) => !v)}
            aria-expanded={verRevogadas}
            className="text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            {verRevogadas ? '▾' : '▸'} Revogadas ({revogadas.length})
          </button>
          {verRevogadas && (
            <ul className="mt-2 overflow-hidden rounded-[14px] border border-line bg-panel opacity-75">
              {revogadas.map((chave) => (
                <LinhaDaChave key={chave.id} chave={chave} />
              ))}
            </ul>
          )}
        </div>
      )}

      <CriarChave
        aberto={criando}
        aoFechar={() => setCriando(false)}
        clienteId={clienteId}
        aoCriar={(nova) => setChaves((lista) => [nova, ...lista])}
      />
      {dialogo}
    </section>
  )
}

function LinhaDaChave({ chave, aoRevogar }: { chave: ChaveDeApi; aoRevogar?: () => void }) {
  const revogada = Boolean(chave.revogadaEm)
  return (
    <li className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 md:flex-row md:items-center">
      <span
        aria-hidden
        className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${revogada ? 'bg-surface text-dim' : 'bg-primary-weak text-primary'}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="12" r="4" />
          <path d="M12 12h9M17.5 12v3M20.5 12v2" />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className={`text-[14px] font-semibold ${revogada ? 'text-dim line-through' : ''}`}>{chave.nome}</strong>
          {revogada && <Pilula tom="perigo">revogada</Pilula>}
        </div>
        <code className="mt-0.5 block truncate font-mono text-[11.5px] text-muted">{chaveMascarada(chave.publico, chave.final)}</code>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chave.escopos.map((escopo) => (
            <Pilula key={escopo} tom={revogada ? 'neutro' : 'destaque'}>
              {ROTULO_DO_ESCOPO[escopo]}
            </Pilula>
          ))}
        </div>
      </div>

      <div className="shrink-0 text-[12px] leading-5 text-muted md:w-[210px] md:text-right">
        <p className={chave.ultimaEm ? 'font-semibold text-soft' : ''}>
          {quandoFoiUsada(chave.ultimaEm)}
          {chave.chamadas > 0 && <span className="font-normal text-muted"> · {chave.chamadas.toLocaleString('pt-BR')} chamadas</span>}
        </p>
        <p>
          {revogada && chave.revogadaEm
            ? `revogada em ${formatarData(chave.revogadaEm)}`
            : `criada em ${formatarData(chave.criadaEm)}${chave.criadaPorNome ? ` por ${chave.criadaPorNome}` : ''}`}
        </p>
      </div>

      {aoRevogar && (
        <Botao variante="secundario" tamanho="sm" onClick={aoRevogar} className="self-start md:self-center">
          Revogar
        </Botao>
      )}
    </li>
  )
}

function CriarChave({
  aberto,
  aoFechar,
  clienteId,
  aoCriar,
}: {
  aberto: boolean
  aoFechar: () => void
  clienteId: string
  aoCriar: (chave: ChaveDeApi) => void
}) {
  const [nome, setNome] = useState('')
  const [escopos, setEscopos] = useState<EscopoDaApi[]>(['contatos:ler', 'contatos:escrever'])
  const [erro, setErro] = useState<string | null>(null)
  const [inteira, setInteira] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const fechar = () => {
    // A chave inteira some da memória da tela ao fechar: ela não volta.
    setInteira(null)
    setNome('')
    setErro(null)
    setEscopos(['contatos:ler', 'contatos:escrever'])
    aoFechar()
  }

  const alternar = (escopo: EscopoDaApi) =>
    setEscopos((lista) => (lista.includes(escopo) ? lista.filter((e) => e !== escopo) : [...lista, escopo]))

  const criar = () =>
    comecar(async () => {
      setErro(null)
      const r = await acaoCriarChaveDeApi(clienteId, { nome, escopos })
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      aoCriar(r.chave)
      setInteira(r.inteira)
    })

  const grupos = [...new Set(ESCOPOS_DA_API.map((e) => e.grupo))]

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      largura={520}
      titulo={inteira ? 'Chave criada' : 'Criar chave de API'}
      descricao={
        inteira
          ? undefined
          : 'Uma chave por sistema. Ela só faz o que estiver marcado abaixo.'
      }
    >
      {inteira ? (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-amber-400/30 bg-amber-400/[0.08] px-3.5 py-3 text-[12.5px] leading-5 text-aviso">
            <strong>Guarde agora, ela não aparece de novo.</strong> Depois de fechar, a tela mostra só o
            começo e os 4 últimos caracteres. Se perder, revogue e crie outra.
          </div>
          <CampoParaCopiar valor={inteira} rotuloAcessivel="Copiar a chave" />
          <p className="text-[12px] leading-5 text-muted">
            Envie no cabeçalho <code className="font-mono text-soft">Authorization: Bearer {'<chave>'}</code>.
            Nunca coloque a chave em código que roda no navegador.
          </p>
          <div className="flex justify-end">
            <Botao variante="primario" onClick={fechar}>
              Já guardei
            </Botao>
          </div>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(evento) => {
            evento.preventDefault()
            criar()
          }}
        >
          <label className="block">
            <RotuloCampo>Nome</RotuloCampo>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              required
              autoFocus
              placeholder="Exemplo: Integração da loja"
              className="app-field px-3 py-2.5 text-[13px]"
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-[12px] font-semibold text-soft">Permissões</legend>
            <div className="space-y-4">
              {grupos.map((grupo) => (
                <div key={grupo}>
                  <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-dim">{grupo}</p>
                  <div className="space-y-1.5">
                    {ESCOPOS_DA_API.filter((e) => e.grupo === grupo).map((escopo) => {
                      const marcado = escopos.includes(escopo.chave)
                      return (
                        <label
                          key={escopo.chave}
                          className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5 transition ${
                            marcado ? 'border-primary/40 bg-primary-weak' : 'border-line hover:bg-surface'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternar(escopo.chave)}
                            className="mt-0.5 caixa-de-marcar"
                          />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold">{escopo.rotulo}</span>
                            <span className="block text-[11.5px] leading-4 text-muted">{escopo.explicacao}</span>
                            {'aviso' in escopo && (
                              <span className="mt-1 block text-[11.5px] font-medium leading-4 text-aviso">{escopo.aviso}</span>
                            )}
                            <code className="mt-0.5 block font-mono text-[10.5px] text-dim">{escopo.chave}</code>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          {erro && (
            <p role="alert" className="text-[12px] text-perigo">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="primario" disabled={rodando || nome.trim() === '' || escopos.length === 0}>
              {rodando ? 'Criando…' : 'Criar chave'}
            </Botao>
          </div>
        </form>
      )}
    </Modal>
  )
}
