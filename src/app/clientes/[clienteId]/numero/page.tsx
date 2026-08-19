import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { Dropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import {
  acaoConectarNumero,
  acaoDefinirFluxosDoNumero,
  acaoDesconectarNumero,
} from '@/server/acoes'
import {
  EXPLICACAO_DO_PAPEL,
  PAPEIS_DO_NUMERO,
  ROTULO_DO_PAPEL,
} from '@/core/papeis-do-numero'
import { acharCliente } from '@/server/repos/clientes'
import { fluxoDoPapel, listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'

export const dynamic = 'force-dynamic'

/**
 * O número do WhatsApp e o endereço que a Meta chama.
 *
 * As duas coisas ficam na mesma tela porque falham juntas: número cadastrado
 * aqui sem o webhook cadastrado lá é um bot que existe e nunca recebe nada.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [fluxos, canais, cabecalhos] = await Promise.all([
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    headers(),
  ])

  const host =
    cabecalhos.get('x-forwarded-host') ??
    cabecalhos.get('host') ??
    'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  const webhook = `${protocolo}://${host}/api/webhook/whatsapp`
  const conectarComCliente = acaoConectarNumero.bind(null, cliente.id, {})

  return (
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="w-full max-w-[1100px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Número do WhatsApp
        </h1>

        <section className="app-card mb-[18px] overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0 max-w-[70ch]">
            <h2 className="text-[14.5px] font-bold">Números do WhatsApp</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-dim">
              Cada número executa um fluxo. A identificação está no painel da
              Meta, em{' '}
              <strong className="text-muted">
                WhatsApp → Configuração da API
              </strong>
              .
            </p>
            </div>
            <ModalFormulario
              botao="+ Conectar número"
              titulo="Conectar um número"
              descricao="A identificação é a do painel da Meta, em WhatsApp → Configuração da API. Os outros três papéis do número se configuram depois, na linha dele."
              rotuloEnviar="Conectar"
              variante={canais.length === 0 ? 'primario' : 'secundario'}
              action={conectarComCliente}
            >
              <label>
                <RotuloCampo>Identificação do número (Meta)</RotuloCampo>
                <input
                  name="phoneNumberId"
                  required
                  autoFocus
                  placeholder="ex.: 123456789012345"
                  className="app-field px-[13px] py-[11px] text-[13.5px]"
                />
              </label>
              <label>
                <RotuloCampo>Fluxo principal</RotuloCampo>
                <Dropdown
                  nome="flowId"
                  rotuloAcessivel="Fluxo principal do número"
                  opcoes={[
                    { valor: '', rotulo: 'sem fluxo principal' },
                    ...fluxos.map((fluxo) => ({ valor: fluxo.id, rotulo: fluxo.nome })),
                  ]}
                />
              </label>
            </ModalFormulario>
          </header>

          {canais.length === 0 ? (
            <p className="border-b border-white/[0.045] px-5 py-8 text-center text-xs leading-5 text-dim">
              Nenhum número conectado ainda — sem isto o WhatsApp não chega até
              aqui.
            </p>
          ) : (
            <ul>
              {canais.map((canal) => {
                const fluxo = fluxos.find((item) => item.id === canal.flowId)
                const aviso = !fluxo
                  ? 'Sem fluxo principal — o bot não responde.'
                  : !fluxo.versaoPublicadaId
                    ? 'O fluxo principal ainda não foi publicado.'
                    : null
                const salvarFluxos = acaoDefinirFluxosDoNumero.bind(
                  null,
                  cliente.id,
                  canal.id,
                  {},
                )

                return (
                  <li
                    key={canal.id}
                    className="border-b border-white/[0.045] px-5 py-3.5"
                  >
                    <div className="flex items-center gap-2 text-[12.5px] font-semibold">
                      <span
                        className={`size-2 rounded-full ${aviso ? 'bg-amber-300' : 'bg-emerald-400'}`}
                        aria-hidden
                      />
                      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-soft">
                        {canal.phoneNumberId}
                      </code>
                      <BotaoPerigo
                        rotulo="Desconectar"
                        titulo="Tira este número deste cliente. As conversas já registradas impedem — elas são o histórico dos leads."
                        pergunta={`Desconectar o número ${canal.phoneNumberId}? O bot para de responder nele.`}
                        acao={acaoDesconectarNumero.bind(
                          null,
                          cliente.id,
                          canal.id,
                        )}
                      />
                    </div>
                    {aviso && (
                      <p className="mt-2 ml-4 rounded-lg border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-2 text-[11.5px] text-amber-200">
                        {aviso}
                      </p>
                    )}

                    <div className="mt-3 ml-4">
                      <ModalFormulario
                        botao="Configurar os 4 papéis"
                        titulo={`Fluxos do número ${canal.phoneNumberId}`}
                        descricao="Cada papel decide quando o número fala. Vazio = papel desligado."
                        rotuloEnviar="Salvar fluxos"
                        variante="secundario"
                        action={salvarFluxos}
                      >
                        <div className="space-y-4">
                          {PAPEIS_DO_NUMERO.map((papel) => {
                            const escolhido = fluxoDoPapel(canal, papel) ?? ''
                            const naoPublicado = fluxos.some(
                              (item) => item.id === escolhido && !item.versaoPublicadaId,
                            )

                            return (
                              <div key={papel}>
                                <p className="text-[11.5px] font-semibold text-soft">
                                  {ROTULO_DO_PAPEL[papel]}
                                </p>
                                <p className="mt-0.5 mb-1.5 text-[11px] leading-4 text-dim">
                                  {EXPLICACAO_DO_PAPEL[papel]}
                                </p>
                                <Dropdown
                                  nome={papel}
                                  valorInicial={escolhido}
                                  rotuloAcessivel={`Fluxo de ${ROTULO_DO_PAPEL[papel]}`}
                                  opcoes={[
                                    { valor: '', rotulo: 'sem fluxo' },
                                    ...fluxos.map((item) => ({
                                      valor: item.id,
                                      rotulo: item.nome,
                                      ...(item.versaoPublicadaId
                                        ? {}
                                        : { detalhe: 'rascunho' }),
                                    })),
                                  ]}
                                />
                                {naoPublicado && (
                                  <p className="mt-1 text-[11px] text-amber-200">
                                    Este fluxo ainda não foi publicado — enquanto
                                    estiver assim, este papel não fala.
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </ModalFormulario>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

        </section>

        <section className="app-card p-5">
          <h2 className="text-[13px] font-bold">
            Endereço para o painel da Meta
          </h2>
          <p className="mt-1 text-[11.5px] text-dim">
            Cadastre este webhook na configuração do WhatsApp Business.
          </p>
          <code className="mt-2.5 block truncate rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 font-mono text-[11.5px] text-[#8de2fa]">
            {webhook}
          </code>
        </section>
      </main>
    </ClienteShell>
  )
}
