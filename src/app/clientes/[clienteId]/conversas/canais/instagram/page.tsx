import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Trilha } from '@/components/design/trilha'
import { LogoDoCanal, MarcaDoCanal } from '@/components/design/selo-do-canal'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import { acaoConectarInstagram, acaoDesligarInstagram } from '@/server/acoes-instagram'
import { ESCOPOS, fotoDaConta, instagramConfigurado } from '@/server/instagram/conexao'
import { lerTokenDoCanal } from '@/server/repos/conversas'
import { acharCliente } from '@/server/repos/clientes'
import { canalDoInstagram, diasAteVencer } from '@/server/repos/canais-instagram'
import { ultimaMensagemRecebida } from '@/server/repos/ultimos-eventos'
import { CamadasDaConexao } from '@/components/conexoes/camadas'
import { estadoDaConexao } from '@/core/conexoes'
import { IlustracaoCanal } from '@/components/design/ilustracoes'
import { listarRespostasAComentarios } from '@/server/repos/respostas-a-comentarios'

export const dynamic = 'force-dynamic'

/**
 * Ligar o direct do Instagram a esta conta.
 *
 * **A tela existe antes de o produto poder ser vendido**, e isso é escolha, não
 * descuido. As duas permissões de mensagem estão em Standard Access até o app
 * review passar, e em Standard o Business Login só embarca contas da nossa
 * própria conta da Meta. Tudo daqui funciona hoje com a nossa conta de teste;
 * o que muda depois da aprovação é *de quem* pode ser a conta, e nada no
 * código.
 *
 * Esconder a tela até lá pareceria mais honesto e seria pior: é assim que se
 * descobre, no dia da aprovação, que a integração inteira ainda precisa ser
 * escrita.
 */

const RESULTADOS: Record<string, { tom: 'bom' | 'ruim'; texto: string }> = {
  conectado: { tom: 'bom', texto: 'Conta ligada. Os direct já chegam no Inbox.' },
  sem_webhook: {
    tom: 'ruim',
    texto:
      'Conta ligada, mas a Meta recusou a inscrição no webhook, os direct não vão chegar. Desligue e conecte de novo; se repetir, o detalhe está em Alertas.',
  },
  cancelado: {
    tom: 'ruim',
    texto: 'A autorização foi cancelada na tela do Instagram. Nada mudou por aqui.',
  },
  falhou: {
    tom: 'ruim',
    texto: 'A Meta recusou a conexão. O detalhe está em Alertas, na administração.',
  },
  sem_codigo: {
    tom: 'ruim',
    texto: 'O Instagram devolveu sem o código de autorização. Tente conectar de novo.',
  },
  sem_app: {
    tom: 'ruim',
    texto: 'Este ambiente não tem o app do Instagram configurado (INSTAGRAM_APP_ID).',
  },
}

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ resultado?: string }>
}) {
  const { clienteId } = await params
  const { resultado } = await searchParams

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [canal, ultimaMensagem, todasAsRegras] = await Promise.all([
    canalDoInstagram(clienteId),
    ultimaMensagemRecebida(clienteId),
    listarRespostasAComentarios(clienteId),
  ])
  const regras = canal ? todasAsRegras.filter((regra) => regra.canalId === canal.id) : []
  const novaRegra = `/clientes/${clienteId}/fluxos?aba=gatilhos&tipo=comentarios&nova=1`
  const estado = estadoDaConexao({
    tipo: 'instagram',
    conta: canal ? { igUsername: canal.igUsername, tokenExpiraEm: canal.tokenExpiraEm } : null,
    ultimoEvento: ultimaMensagem,
  })
  // A foto da conta é enfeite: sem token ou com a Meta fora, o cartão mostra o logo.
  const foto = canal?.tokenRef ? await lerTokenDoCanal(canal).then(fotoDaConta).catch(() => null) : null
  const configurado = instagramConfigurado()
  const dias = diasAteVencer(canal?.tokenExpiraEm ?? null)
  const aviso = resultado ? RESULTADOS[resultado] : undefined

  return (
    <ClienteShell cliente={cliente} ativa="canais">
      <main className="w-full max-w-[820px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
        <Trilha
          caminho={[
            { rotulo: 'Canais', href: `/clientes/${cliente.id}/conversas/canais` },
            { rotulo: 'Instagram', icone: <LogoDoCanal canal="instagram" tamanho={11} /> },
          ]}
        />
        <CabecalhoDaTela
          titulo={
            <span className="inline-flex items-center gap-2.5">
              <MarcaDoCanal canal="instagram" tamanho={30} />
              Instagram
            </span>
          } descricao={DEFINICAO_DO_CANAL.instagram.resumo} />

        {aviso && (
          <p
            className={`mb-5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] ${
              aviso.tom === 'bom'
                ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-ok'
                : 'border-amber-400/25 bg-amber-400/[0.07] text-aviso'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        <div className="mb-5">
          <CamadasDaConexao
            clienteId={cliente.id}
            estado={estado}
            rotuloDoEvento="Última mensagem recebida na conta"
          />
        </div>

        {canal ? (
          <section className="app-card px-5 py-5">
            <div className="flex flex-wrap items-center gap-3">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" className="size-11 shrink-0 rounded-full border border-line object-cover" />
              ) : (
                <MarcaDoCanal canal="instagram" tamanho={44} />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-soft">
                  <span aria-label="Conectada" className="size-[8px] shrink-0 rounded-full bg-emerald-400" />
                  {canal.igUsername ? `@${canal.igUsername}` : 'Conta ligada'}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-dim">conta {canal.igUserId}</p>
              </div>

              <form action={acaoDesligarInstagram}>
                <input type="hidden" name="clienteId" value={clienteId} />
                <button
                  type="submit"
                  className="rounded-[9px] border border-line px-3 py-2 text-[12.5px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
                >
                  Desligar
                </button>
              </form>
            </div>

            {/*
             * O prazo do token não é detalhe técnico escondido num log: ele
             * vence em 60 dias e, vencido, só o dono do perfil resolve, na
             * frente da tela, autorizando de novo. Quem opera precisa ver isso
             * chegando, e não descobrir pelo cliente reclamando que o
             * Instagram parou.
             */}
            {dias !== null && (
              <p
                className={`mt-4 border-t border-line pt-3.5 text-[12px] ${
                  dias <= 7 ? 'text-aviso' : 'text-dim'
                }`}
              >
                {dias <= 0
                  ? 'O acesso venceu. Conecte de novo para voltar a receber os direct.'
                  : `O acesso vale por mais ${dias} ${dias === 1 ? 'dia' : 'dias'}. A renovação é automática enquanto ele estiver vivo.`}
              </p>
            )}
          </section>
        ) : null}

        {/*
          Comentários nos posts: a resposta automática mora em Automações →
          Gatilhos → Comentários, mas quem procura por ela vem ao Instagram.
          Aqui ficam as regras desta conta e o botão de criar (04/nov/2026).
        */}
        {canal && (
          <section className="app-card mt-5 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-soft">Comentários nos posts</p>
                <p className="mt-1 max-w-md text-[12.5px] leading-6 text-dim">
                  Quem comentar uma palavra, como &quot;eu quero&quot;, recebe a sua mensagem no direct.
                </p>
              </div>
              <a href={novaRegra} className="botao-primario botao-md shrink-0">
                Nova resposta a comentário
              </a>
            </div>

            {regras.length > 0 && (
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {regras.map((regra) => (
                  <li key={regra.id} className="flex items-center gap-3 py-3">
                    {regra.postImagem ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={regra.postImagem} alt="" className="size-11 shrink-0 rounded-[8px] border border-line object-cover" />
                    ) : (
                      <span className="grid size-11 shrink-0 place-items-center rounded-[8px] border border-line bg-canvas text-[10px] font-semibold text-muted">
                        Todos
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-soft">
                        {regra.palavras.length > 0 ? (
                          regra.palavras.map((palavra) => (
                            <span key={palavra} className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-semibold">
                              {palavra}
                            </span>
                          ))
                        ) : (
                          <span className="font-semibold">Qualquer comentário</span>
                        )}
                        <span className="text-[11.5px] text-dim">
                          {regra.postId ? (regra.postLegenda ? `em "${regra.postLegenda.slice(0, 40)}"` : 'em um post') : 'em todos os posts'}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-dim">{regra.mensagem}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[11.5px] font-semibold ${regra.ativo ? 'text-ok' : 'text-muted'}`}>
                        {regra.ativo ? 'Ligada' : 'Desligada'}
                      </p>
                      <p className="text-[11px] text-dim">
                        {regra.execucoes} {regra.execucoes === 1 ? 'resposta' : 'respostas'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {regras.length > 0 && (
              <a
                href={`/clientes/${clienteId}/fluxos?aba=gatilhos&tipo=comentarios`}
                className="mt-1 inline-block text-[12px] font-semibold text-primary hover:underline"
              >
                Editar respostas
              </a>
            )}
          </section>
        )}

        {!canal && (
          <section className="app-card flex items-center gap-10 px-5 py-6">
            <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-soft">Nenhuma conta ligada</p>
            <p className="mt-1.5 max-w-lg text-[12.5px] leading-6 text-dim">
              Conectar abre a tela do Instagram, onde o dono do perfil autoriza. A conta precisa
              ser <strong className="text-muted">profissional</strong> (comercial ou de criador) ,
              perfil pessoal não recebe mensagem por API.
            </p>

            <ul className="mt-4 space-y-1.5">
              {ESCOPOS.map((escopo) => (
                <li key={escopo} className="flex gap-2 text-[12px] text-dim">
                  <span aria-hidden className="text-primary">
                    ·
                  </span>
                  <code className="font-mono">{escopo}</code>
                </li>
              ))}
            </ul>

            <form action={acaoConectarInstagram} className="mt-5">
              <input type="hidden" name="clienteId" value={clienteId} />
              <button
                type="submit"
                disabled={!configurado}
                className="botao-primario botao-md"
              >
                Conectar conta do Instagram
              </button>
            </form>

            {!configurado && (
              <p className="mt-3 text-[12px] text-aviso">
                Falta <code className="font-mono">INSTAGRAM_APP_ID</code> e{' '}
                <code className="font-mono">INSTAGRAM_APP_SECRET</code> no ambiente deste servidor.
              </p>
            )}
            </div>
            <div className="hidden shrink-0 pr-6 md:block">
              <IlustracaoCanal />
            </div>
          </section>
        )}

        {/*
         * A fila da Meta, escrita na tela e não só no doc.
         *
         * A pergunta "já dá para vender?" tem resposta diferente para o nosso
         * perfil e para o do cliente, e é a segunda que importa comercialmente.
         * Deixar isso implícito é o caminho para alguém prometer numa reunião
         * o que a permissão ainda não permite.
         */}
        <section className="mt-5 rounded-[12px] border border-line bg-panel px-5 py-4">
          <p className="text-[12.5px] font-semibold text-muted">Enquanto o app review não sai</p>
          <p className="mt-1.5 text-[12px] leading-6 text-dim">
            As permissões de mensagem estão em <strong>Standard Access</strong>. Nesse estágio o
            Instagram só embarca contas ligadas à própria conta da Meta da 4YU, dá para atender no
            nosso perfil, não no do cliente. Quando o <strong>Advanced Access</strong> for aprovado,
            esta mesma tela passa a aceitar a conta de qualquer cliente, sem mudar nada aqui.
          </p>
        </section>
      </main>
    </ClienteShell>
  )
}
