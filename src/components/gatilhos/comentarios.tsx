'use client'

import { useState } from 'react'
import { Alternador } from '@/components/design/alternador'
import { Dropdown } from '@/components/design/dropdown'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { LIMITES_DO_COMENTARIO } from '@/core/comentarios'
import { acaoAlternarRespostaAComentario, acaoPostsDoInstagram } from '@/server/acoes-comentarios'
import type { PostDoInstagram } from '@/server/instagram/comentarios'

type ContaDoInstagram = { id: string; usuario: string | null }

/**
 * Os campos do modal "Nova resposta a comentário".
 *
 * O post é escolhido pela foto: a lista vem da Meta só quando a pessoa pede um
 * post específico, porque quem quer "todos os posts" não precisa esperar por
 * ela, e o modal abre na hora.
 */
export function CamposDaRespostaAComentario({
  clienteId,
  contas,
  fluxos,
}: {
  clienteId: string
  contas: ContaDoInstagram[]
  /** Os fluxos da conta, para "quando a pessoa responder". */
  fluxos: { id: string; nome: string; publicado: boolean }[]
}) {
  const [canalId, setCanalId] = useState(contas[0]?.id ?? '')
  const [alcance, setAlcance] = useState<'todos' | 'um'>('todos')
  const [quando, setQuando] = useState<'palavras' | 'qualquer'>('palavras')
  const [posts, setPosts] = useState<PostDoInstagram[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erroDosPosts, setErroDosPosts] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<PostDoInstagram | null>(null)
  const [mensagem, setMensagem] = useState('')

  async function buscarPosts(conta: string) {
    setCarregando(true)
    setErroDosPosts(null)
    const r = await acaoPostsDoInstagram(clienteId, conta).catch(() => null)
    setCarregando(false)
    if (!r || !r.ok) {
      setErroDosPosts(r && !r.ok ? r.erro : 'Não foi possível buscar os posts agora.')
      return
    }
    setPosts(r.posts)
  }

  function escolherAlcance(valor: 'todos' | 'um') {
    setAlcance(valor)
    if (valor === 'todos') setEscolhido(null)
    if (valor === 'um' && posts === null && !carregando) void buscarPosts(canalId)
  }

  return (
    <>
      <input type="hidden" name="canalId" value={canalId} />
      <input type="hidden" name="quando" value={quando} />
      <input type="hidden" name="post" value={escolhido ? JSON.stringify(escolhido) : ''} />

      {contas.length > 1 && (
        <div>
          <RotuloCampo>Conta do Instagram</RotuloCampo>
          <Dropdown
            rotuloAcessivel="Conta do Instagram"
            valor={canalId}
            aoMudar={(valor) => {
              setCanalId(valor)
              setPosts(null)
              setEscolhido(null)
              if (alcance === 'um') void buscarPosts(valor)
            }}
            opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.usuario ? `@${c.usuario}` : 'Conta sem @' }))}
          />
        </div>
      )}

      <div>
        <RotuloCampo>Em qual post</RotuloCampo>
        <Alternador
          rotulo="Em qual post"
          ativa={alcance}
          aoEscolher={escolherAlcance}
          opcoes={[
            { chave: 'todos', rotulo: 'Todos os posts' },
            { chave: 'um', rotulo: 'Um post específico' },
          ]}
        />

        {alcance === 'um' && (
          <div className="mt-3">
            {carregando && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Carregando os posts">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className="aspect-square animate-pulse rounded-lg bg-surface-strong" />
                ))}
              </div>
            )}

            {erroDosPosts && (
              <p role="alert" className="text-[12px] leading-5 text-perigo">
                {erroDosPosts}{' '}
                <button type="button" onClick={() => void buscarPosts(canalId)} className="font-semibold underline">
                  Tentar de novo
                </button>
              </p>
            )}

            {posts !== null && !carregando && posts.length === 0 && (
              <p className="text-[12px] text-dim">Esta conta ainda não tem posts publicados.</p>
            )}

            {posts !== null && !carregando && posts.length > 0 && (
              <div className="grid max-h-[248px] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5" role="radiogroup" aria-label="Escolha o post">
                {posts.map((post) => {
                  const aceso = escolhido?.id === post.id
                  return (
                    <button
                      key={post.id}
                      type="button"
                      role="radio"
                      aria-checked={aceso}
                      title={post.legenda ?? 'Post sem legenda'}
                      onClick={() => setEscolhido(post)}
                      className={`relative aspect-square overflow-hidden rounded-lg border bg-surface-strong transition ${
                        aceso ? 'border-primary ring-2 ring-primary/40' : 'border-line hover:border-soft/40'
                      }`}
                    >
                      {post.imagem ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.imagem} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-[10px] text-dim">sem imagem</span>
                      )}
                      {aceso && (
                        <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {escolhido?.legenda && (
              <p className="mt-2 line-clamp-2 text-[11.5px] leading-5 text-dim">{escolhido.legenda}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <RotuloCampo>Quando responder</RotuloCampo>
        <Alternador
          rotulo="Quando responder"
          ativa={quando}
          aoEscolher={setQuando}
          opcoes={[
            { chave: 'palavras', rotulo: 'Com palavras' },
            { chave: 'qualquer', rotulo: 'Qualquer comentário' },
          ]}
        />
        {quando === 'palavras' && (
          <>
            <input
              name="palavras"
              required
              maxLength={400}
              placeholder="Exemplo: eu quero, link, preço"
              className="app-field mt-3 px-[13px] py-[11px] text-[13.5px]"
            />
            <p className="mt-1.5 text-[11.5px] leading-5 text-dim">
              Separe por vírgula. Vale a palavra inteira, sem diferença de acento ou maiúscula.
            </p>
          </>
        )}
      </div>

      <label className="block">
        <RotuloCampo>Mensagem no direct</RotuloCampo>
        <textarea
          name="mensagem"
          required
          rows={4}
          maxLength={LIMITES_DO_COMENTARIO.mensagem}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Exemplo: Oi! Aqui está o link com o cupom de 10%: https://loja.com.br/promocao"
          className="app-field resize-y px-[13px] py-[11px] text-[13.5px] leading-6"
        />
        <span className="mt-1.5 flex justify-between gap-3 text-[11.5px] leading-5 text-dim">
          <span>Vai uma mensagem por comentário. Se a pessoa responder, a conversa continua no Inbox.</span>
          <span className="shrink-0 tabular-nums">
            {mensagem.length}/{LIMITES_DO_COMENTARIO.mensagem}
          </span>
        </span>
      </label>

      <div>
        <RotuloCampo>Quando a pessoa responder o direct</RotuloCampo>
        <Dropdown
          nome="fluxoId"
          rotuloAcessivel="Fluxo que a resposta da pessoa abre"
          valorInicial=""
          opcoes={[
            { valor: '', rotulo: 'Seguir o fluxo padrão do Instagram' },
            ...fluxos.map((f) => ({
              valor: f.id,
              rotulo: `Abrir o fluxo ${f.nome}`,
              ...(f.publicado ? {} : { detalhe: 'rascunho' }),
            })),
          ]}
        />
        <span className="mt-1.5 block text-[11.5px] leading-5 text-dim">
          Um fluxo próprio dá a cada post a sua jornada: oferta, coleta de dados, venda.
        </span>
      </div>

      <label className="block">
        <RotuloCampo>Resposta no comentário (opcional)</RotuloCampo>
        <input
          name="respostaPublica"
          maxLength={LIMITES_DO_COMENTARIO.respostaPublica}
          placeholder="Exemplo: Enviamos os detalhes no seu direct."
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
        <span className="mt-1.5 block text-[11.5px] leading-5 text-dim">
          Aparece em público, embaixo do comentário. Em branco, só o direct sai.
        </span>
      </label>
    </>
  )
}

/** Liga e desliga uma resposta a comentário, otimista, como as palavras-chave. */
export function InterruptorDeRespostaAComentario({
  clienteId,
  respostaId,
  ativo: doServidor,
}: {
  clienteId: string
  respostaId: string
  ativo: boolean
}) {
  const [ativo, setAtivo] = useState(doServidor)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={ativo ? 'Desligar resposta' : 'Ligar resposta'}
        title={ativo ? 'Desligar: novos comentários param de receber o direct.' : 'Ligar: volta a responder os próximos comentários.'}
        onClick={() => {
          setErro(null)
          const antes = ativo
          setAtivo(!antes)
          depoisDaTela(() => acaoAlternarRespostaAComentario(clienteId, respostaId, !antes)).then(
            (r) => {
              if (!r.ok) {
                setAtivo(antes)
                setErro(r.erro ?? 'não foi possível mudar agora')
              }
            },
            () => {
              setAtivo(antes)
              setErro('não foi possível mudar agora')
            },
          )
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition ${
          ativo ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-line bg-surface-strong'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ativo ? 'left-[15px] bg-emerald-300' : 'left-[2px] bg-dim'
          }`}
        />
      </button>
      {erro && (
        <span role="alert" className="max-w-[220px] text-right text-[10.5px] leading-4 text-perigo">
          {erro}
        </span>
      )}
    </span>
  )
}
