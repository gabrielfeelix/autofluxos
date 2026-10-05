'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Modal } from '@/components/design/modal'
import { AcaoDaFicha } from '@/components/lead-crm/acoes-da-ficha'
import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'
import { ehCampoTecnico } from '@/core/contatos/valor-do-campo'
import { acaoCorrigirNome } from '@/server/acoes'
import { acaoPreencherCampos } from '@/server/acoes-campos'

/**
 * "Editar" da ficha: o nome e os dados da pessoa, tudo de uma vez, com um
 * Salvar no fim. Antes cada coisa tinha o seu lápis (ou não tinha nenhum: os
 * dados coletados eram só leitura).
 *
 * **O que fica de fora, de propósito:**
 * - o telefone, que é a identidade da pessoa no WhatsApp: trocá-lo não muda
 *   o número, desliga a ficha da conversa;
 * - os campos técnicos (ids de anúncio, de clique) e os de origem, que medem
 *   de onde a pessoa veio: editar à mão apagaria a medição;
 * - estágio, responsável e etiquetas, que já mudam no clique na própria ficha.
 *
 * **Apagar é esvaziar.** O banco mescla os campos (`gravar_campos`, `||`) e
 * não tira chave. Valor vazio some da ficha (`DadosColetados` não mostra).
 */
const DE_ORIGEM = new Set(['origem', 'origem_url', 'origem_titulo', 'origem_anuncio'])

type Linha = { chave: string; rotulo: string; valor: string; nova: boolean }

/** "Cor favorita" vira `cor_favorita`: a chave que um fluxo também escreveria. */
function chaveDe(rotulo: string): string {
  return rotulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function EditarContato({
  clienteId,
  contatoId,
  nome,
  campos,
}: {
  clienteId: string
  contatoId: string
  nome: string | null
  campos: Record<string, string>
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [salvando, comecar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [nomeNovo, setNomeNovo] = useState(nome ?? '')
  const [linhas, setLinhas] = useState<Linha[]>([])

  const abrir = () => {
    setErro(null)
    setNomeNovo(nome ?? '')
    setLinhas(
      Object.entries(campos)
        .filter(([chave, valor]) => valor.trim() !== '' && !DE_ORIGEM.has(chave) && !ehCampoTecnico(chave, valor))
        .map(([chave, valor]) => ({ chave, rotulo: rotuloDoCampo(chave) || chave, valor, nova: false })),
    )
    setAberto(true)
  }

  const mudar = (indice: number, mudanca: Partial<Linha>) =>
    setLinhas((atuais) => atuais.map((linha, i) => (i === indice ? { ...linha, ...mudanca } : linha)))

  const salvar = () => {
    setErro(null)
    const valores: Record<string, string> = {}
    for (const linha of linhas) {
      const chave = linha.nova ? chaveDe(linha.rotulo) : linha.chave
      if (linha.nova && (chave === '' || linha.valor.trim() === '')) continue
      if (linha.nova && (chave in campos || chave in valores)) {
        setErro(`Já existe um dado chamado "${linha.rotulo.trim()}". Edite o que já está na lista.`)
        return
      }
      if (!linha.nova && linha.valor === campos[linha.chave]) continue
      valores[chave] = linha.valor.trim()
    }
    const trocouNome = nomeNovo.trim() !== (nome ?? '').trim()

    comecar(async () => {
      try {
        if (trocouNome) {
          const dados = new FormData()
          dados.set('nome', nomeNovo.trim())
          const r = await acaoCorrigirNome(clienteId, contatoId, {}, dados)
          if (r.erro) return setErro(r.erro)
        }
        if (Object.keys(valores).length > 0) {
          const r = await acaoPreencherCampos(clienteId, contatoId, valores)
          if (!r.ok) return setErro(r.erro ?? 'não deu para salvar os dados')
          if (r.recusados && r.recusados.length > 0) {
            router.refresh()
            return setErro(
              `Salvo, menos: ${r.recusados.map((x) => `${rotuloDoCampo(x.chave) || x.chave} (${x.motivo})`).join('; ')}.`,
            )
          }
        }
        setAberto(false)
        router.refresh()
      } catch {
        setErro('sem conexão com o servidor: nada foi salvo')
      }
    })
  }

  return (
    <>
      <AcaoDaFicha
        rotulo="Editar"
        titulo="Editar o nome e os dados da pessoa"
        aoClicar={abrir}
        icone={
          <>
            <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10v3Z" />
            <path d="m13.5 7.5 3 3" />
          </>
        }
      />
      <Modal
        aberto={aberto}
        aoFechar={() => !salvando && setAberto(false)}
        titulo="Editar contato"
        descricao="O telefone fica de fora: é o número do WhatsApp, e trocá-lo desligaria a ficha da conversa."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            salvar()
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-soft">Nome</span>
            <input
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              maxLength={120}
              placeholder="Exemplo: Maria Souza"
              className="app-field px-3 py-2 text-[13px]"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[12px] font-bold text-soft">Dados da pessoa</legend>
            {linhas.length === 0 && (
              <p className="text-[12px] text-dim">Nenhum dado ainda. O fluxo preenche ao conversar, ou adicione abaixo.</p>
            )}
            {linhas.map((linha, i) => (
              <div key={linha.nova ? `nova-${i}` : linha.chave} className="flex items-center gap-2">
                {linha.nova ? (
                  <input
                    value={linha.rotulo}
                    onChange={(e) => mudar(i, { rotulo: e.target.value })}
                    aria-label="Nome do dado"
                    placeholder="Exemplo: Cidade"
                    maxLength={40}
                    className="app-field w-[38%] shrink-0 px-3 py-2 text-[12.5px]"
                  />
                ) : (
                  <span className="w-[38%] shrink-0 truncate text-[12.5px] font-semibold text-muted" title={linha.rotulo}>
                    {linha.rotulo}
                  </span>
                )}
                <input
                  value={linha.valor}
                  onChange={(e) => mudar(i, { valor: e.target.value })}
                  aria-label={linha.nova ? 'Valor do dado' : linha.rotulo}
                  placeholder={linha.nova ? 'Exemplo: Londrina' : 'Vazio, sai da ficha'}
                  maxLength={500}
                  className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
                />
                <button
                  type="button"
                  onClick={() =>
                    linha.nova ? setLinhas((atuais) => atuais.filter((_, j) => j !== i)) : mudar(i, { valor: '' })
                  }
                  title={linha.nova ? 'Tirar esta linha' : 'Apagar este dado'}
                  aria-label={linha.nova ? 'Tirar esta linha' : `Apagar ${linha.rotulo}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-dim transition hover:bg-surface hover:text-perigo"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 7h14M10 7V5.2h4V7" />
                    <path d="m7 7 .8 12h8.4L17 7" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLinhas((atuais) => [...atuais, { chave: '', rotulo: '', valor: '', nova: true }])}
              className="mt-1 w-full rounded-[8px] border border-dashed border-strong px-2.5 py-2 text-[12px] text-dim transition hover:border-primary/40 hover:text-primary"
            >
              + Adicionar dado
            </button>
          </fieldset>

          {erro && (
            <p role="alert" className="text-[12px] font-semibold text-perigo">
              {erro}
            </p>
          )}

          <span className="flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} disabled={salvando} className="botao-secundario botao-md">
              Cancelar
            </button>
            <button type="submit" disabled={salvando || nomeNovo.trim() === ''} className="botao-primario botao-md">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </span>
        </form>
      </Modal>
    </>
  )
}
