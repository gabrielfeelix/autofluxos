'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CampoParaCopiar } from '@/components/design/copiar'
import type { ConexaoPorCampos } from '@/core/pagamentos/conexao-por-campos'
import { acaoChavePublicaDaIugu, acaoConectarPorCampos } from '@/server/acoes-pagamentos'

/**
 * Ligar um gateway pela credencial colada, no molde do Asaas, para todos os
 * que pedem um ou mais campos (Woovi, PagHiper, Efí, Iugu, Pagar.me).
 *
 * O formulário só abre depois do clique, como no Asaas: campo de segredo
 * aberto sem ninguém pedir parece cobrança de senha. O arquivo (certificado
 * da Efí) é lido aqui e sobe em base64; nada fica no navegador depois de
 * salvar.
 */
export function ConectarPorCampos({
  clienteId,
  gateway,
  nome,
  tela,
  trocar = false,
}: {
  clienteId: string
  gateway: string
  nome: string
  tela: ConexaoPorCampos
  trocar?: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [arquivos, setArquivos] = useState<Record<string, string>>({})
  const [chavePublica, setChavePublica] = useState('')
  const [erro, setErro] = useState('')
  const [pendente, comecar] = useTransition()

  const completo = tela.campos.every((c) => (valores[c.nome] ?? '').trim() !== '')

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={trocar ? 'botao-secundario botao-sm' : 'botao-primario botao-sm'}>
        {trocar ? 'Trocar a credencial' : `Conectar ${nome}`}
      </button>
    )
  }

  const fechar = () => {
    setAberto(false)
    setErro('')
    setValores({})
    setArquivos({})
  }

  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        comecar(async () => {
          setErro('')
          const r = await acaoConectarPorCampos(clienteId, gateway, valores)
          if (!r.ok) {
            setErro(r.erro ?? 'Não foi possível conectar.')
            return
          }
          fechar()
          router.refresh()
        })
      }}
    >
      {tela.campos.map((campo) =>
        campo.tipo === 'arquivo' ? (
          <label key={campo.nome} className="flex flex-col gap-1 text-[11.5px] font-semibold text-soft">
            {campo.rotulo}
            <span className="app-field flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-normal">
              <span className="min-w-0 truncate text-muted">{arquivos[campo.nome] ?? 'Nenhum arquivo escolhido'}</span>
              <span className="shrink-0 font-semibold text-primary">Escolher</span>
              <input
                type="file"
                accept={campo.aceita}
                className="sr-only"
                onChange={async (e) => {
                  const arquivo = e.target.files?.[0]
                  if (!arquivo) return
                  const bytes = new Uint8Array(await arquivo.arrayBuffer())
                  let binario = ''
                  bytes.forEach((b) => (binario += String.fromCharCode(b)))
                  setValores((v) => ({ ...v, [campo.nome]: btoa(binario) }))
                  setArquivos((a) => ({ ...a, [campo.nome]: arquivo.name }))
                }}
              />
            </span>
          </label>
        ) : (
          <label key={campo.nome} className="flex flex-col gap-1 text-[11.5px] font-semibold text-soft">
            {campo.rotulo}
            <input
              name={campo.nome}
              type={campo.tipo === 'segredo' ? 'password' : 'text'}
              autoComplete="off"
              required
              value={valores[campo.nome] ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, [campo.nome]: e.target.value }))}
              placeholder={campo.exemplo}
              className="app-field w-full px-3 py-2 text-[12.5px] font-normal"
            />
          </label>
        ),
      )}

      {tela.pedeChavePublica &&
        (chavePublica ? (
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-soft">Chave pública para colar na {nome}</span>
            <CampoParaCopiar valor={chavePublica} rotuloAcessivel={`Chave pública para a ${nome}`} />
          </div>
        ) : (
          <button
            type="button"
            className="botao-secundario botao-sm self-start"
            onClick={() =>
              comecar(async () => {
                const r = await acaoChavePublicaDaIugu(clienteId)
                if (r.ok && r.chave) setChavePublica(r.chave)
                else setErro(r.erro ?? 'Não foi possível gerar a chave.')
              })
            }
          >
            Gerar chave pública
          </button>
        ))}

      <p className="text-[11px] leading-4 text-dim">{tela.ondeAchar} Depois de salva, a credencial não volta para a tela.</p>
      {erro && (
        <p role="alert" className="text-[11.5px] text-perigo">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pendente || !completo} className="botao-primario botao-sm">
          {pendente ? 'Conferindo...' : 'Conectar'}
        </button>
        <button type="button" onClick={fechar} className="botao-secundario botao-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
