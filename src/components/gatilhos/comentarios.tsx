'use client'

import { useState } from 'react'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { Dropdown } from '@/components/design/dropdown'
import { GrupoDeRadio } from '@/components/design/grupo-de-radio'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { LIMITES_DO_COMENTARIO } from '@/core/comentarios'
import { GLIFO_FACEBOOK } from '@/components/design/glifos-oficiais'
import { LogoDoCanal } from '@/components/design/selo-do-canal'
import { acaoAlternarRespostaAComentario, acaoPostsDoInstagram } from '@/server/acoes-comentarios'
import type { PostDoInstagram } from '@/server/instagram/comentarios'

/** Uma conta que recebe comentário: perfil do Instagram ou página do Facebook. */
type ContaDeComentario = { id: string; rotulo: string; rede: 'instagram' | 'messenger' }

/**
 * Os campos do modal "Nova resposta a comentário".
 *
 * O post é escolhido pela foto: a lista vem da Meta só quando a pessoa pede um
 * post específico, porque quem quer "todos os posts" não precisa esperar por
 * ela, e o modal abre na hora.
 */
/** A regra que já existe, quando o formulário é o de editar. */
export type RespostaParaEditar = {
  canalId: string
  palavras: string[]
  postId: string | null
  postLegenda: string | null
  postImagem: string | null
  postLink: string | null
  mensagem: string
  respostaPublica: string | null
  fluxoId: string | null
}

export function CamposDaRespostaAComentario({
  clienteId,
  contas,
  fluxos,
  inicial,
}: {
  clienteId: string
  contas: ContaDeComentario[]
  /** Os fluxos da conta, para "quando a pessoa responder". */
  fluxos: { id: string; nome: string; publicado: boolean }[]
  /** Editando: a regra salva preenche os campos. */
  inicial?: RespostaParaEditar
}) {
  const [canalId, setCanalId] = useState(inicial?.canalId ?? contas[0]?.id ?? '')
  const [alcance, setAlcance] = useState<'todos' | 'um'>(inicial?.postId ? 'um' : 'todos')
  const [quando, setQuando] = useState<'palavras' | 'qualquer'>(
    inicial && inicial.palavras.length === 0 ? 'qualquer' : 'palavras',
  )
  const [posts, setPosts] = useState<PostDoInstagram[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erroDosPosts, setErroDosPosts] = useState<string | null>(null)
  // Editando: o post salvo já vem escolhido, para salvar sem abrir a lista.
  const [escolhido, setEscolhido] = useState<PostDoInstagram | null>(
    inicial?.postId
      ? { id: inicial.postId, legenda: inicial.postLegenda, imagem: inicial.postImagem, link: inicial.postLink, tipo: '', publicadoEm: null }
      : null,
  )
  const [mensagem, setMensagem] = useState(inicial?.mensagem ?? '')
  const [palavras, setPalavras] = useState(inicial?.palavras.join(', ') ?? '')
  const [emPublico, setEmPublico] = useState(Boolean(inicial?.respostaPublica))
  const [respostaPublica, setRespostaPublica] = useState(inicial?.respostaPublica ?? '')

  /** Os atalhos de palavra: tocar acrescenta, sem repetir a que já está. */
  function acrescentarPalavra(palavra: string) {
    const atuais = palavras.split(',').map((p) => p.trim()).filter(Boolean)
    if (atuais.some((p) => p.toLowerCase() === palavra)) return
    setPalavras([...atuais, palavra].join(', '))
  }

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
          <RotuloCampo>Conta</RotuloCampo>
          <Dropdown
            rotuloAcessivel="Conta que recebe o comentário"
            valor={canalId}
            aoMudar={(valor) => {
              setCanalId(valor)
              setPosts(null)
              setEscolhido(null)
              if (alcance === 'um') void buscarPosts(valor)
            }}
            opcoes={contas.map((c) => ({
              valor: c.id,
              rotulo: c.rotulo,
              detalhe: c.rede === 'messenger' ? 'Página do Facebook' : 'Instagram',
              icone:
                c.rede === 'messenger' ? (
                  <svg aria-hidden viewBox="0 0 24 24" width={16} height={16} fill="#0866FF">
                    <path d={GLIFO_FACEBOOK} />
                  </svg>
                ) : (
                  <span className="text-marca-instagram">
                    <LogoDoCanal canal="instagram" tamanho={16} />
                  </span>
                ),
            }))}
          />
        </div>
      )}

      <section>
        <TituloDaSecao>Quando alguém comentar</TituloDaSecao>
        <GrupoDeRadio
          rotulo="Em qual post"
          valor={alcance}
          aoEscolher={escolherAlcance}
          opcoes={[
            { valor: 'todos', titulo: 'Em qualquer post ou reel', descricao: 'Vale para os posts de hoje e os que vierem.' },
            { valor: 'um', titulo: 'Num post específico', descricao: 'Você escolhe pela foto, logo abaixo.' },
          ]}
        />

        {alcance === 'um' && posts === null && !carregando && !erroDosPosts && escolhido && (
          <div className="mt-3 flex items-center gap-3">
            {escolhido.imagem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={escolhido.imagem} alt="" className="size-14 shrink-0 rounded-lg border border-line object-cover" />
            )}
            <button type="button" onClick={() => void buscarPosts(canalId)} className="text-[12px] font-semibold text-primary hover:underline">
              Trocar o post
            </button>
          </div>
        )}

        {alcance === 'um' && !(posts === null && !carregando && !erroDosPosts && escolhido) && (
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
      </section>

      <section>
        <TituloDaSecao>E o comentário tem</TituloDaSecao>
        <GrupoDeRadio
          rotulo="Quando responder"
          valor={quando}
          aoEscolher={setQuando}
          opcoes={[
            { valor: 'palavras', titulo: 'Uma destas palavras', descricao: 'Só responde quem escrever a palavra combinada.' },
            { valor: 'qualquer', titulo: 'Qualquer comentário', descricao: 'Responde todo mundo que comentar.' },
          ]}
        />
        {quando === 'palavras' && (
          <>
            <input
              name="palavras"
              required
              maxLength={400}
              value={palavras}
              onChange={(e) => setPalavras(e.target.value)}
              placeholder="Exemplo: eu quero, link, preço"
              className="app-field mt-3 px-[13px] py-[11px] text-[13.5px]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px] text-dim">Mais usadas:</span>
              {['eu quero', 'link', 'preço', 'quero'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => acrescentarPalavra(p)}
                  className="rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-muted transition hover:border-primary/50 hover:text-primary"
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-5 text-dim">
              Separe por vírgula. Vale a palavra inteira, sem diferença de acento ou maiúscula.
            </p>
          </>
        )}
      </section>

      <label className="block">
        <TituloDaSecao>Ela recebe no direct</TituloDaSecao>
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

      <section>
        <input type="hidden" name="respostaPublica" value={emPublico ? respostaPublica : ''} />
        <LinhaLigaDesliga
          titulo="Responder também em público"
          descricao="Uma frase curta embaixo do comentário, avisando que a mensagem foi pro direct."
          marcada={emPublico}
          aoMudar={setEmPublico}
        />
        {emPublico && (
          <input
            maxLength={LIMITES_DO_COMENTARIO.respostaPublica}
            value={respostaPublica}
            onChange={(e) => setRespostaPublica(e.target.value)}
            aria-label="Resposta no comentário"
            placeholder="Exemplo: Enviamos os detalhes no seu direct."
            className="app-field mt-2 px-[13px] py-[11px] text-[13.5px]"
          />
        )}
      </section>

      <section>
        <TituloDaSecao>Quando ela responder o direct</TituloDaSecao>
        <Dropdown
          nome="fluxoId"
          rotuloAcessivel="Fluxo que a resposta da pessoa abre"
          valorInicial={inicial?.fluxoId ?? ''}
          opcoes={[
            { valor: '', rotulo: 'Seguir o fluxo padrão do canal' },
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
      </section>
    </>
  )
}

/** O título de cada passo do formulário: "Quando alguém comentar", "Ela recebe no direct". */
function TituloDaSecao({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[13px] font-semibold text-ink">{children}</span>
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
