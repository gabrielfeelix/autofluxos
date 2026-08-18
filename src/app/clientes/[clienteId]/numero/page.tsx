import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { Dropdown } from '@/components/design/dropdown'
import { FormularioSalvar } from '@/components/design/formulario-salvar'
import { acaoConectarNumero, acaoDesconectarNumero } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
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
  const conectarComCliente = acaoConectarNumero.bind(null, cliente.id)

  return (
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="max-w-[720px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Número do WhatsApp
        </h1>

        <section className="app-card mb-[18px] overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Números do WhatsApp</h2>
            <p className="mt-0.5 text-[12px] text-dim">
              Cada número executa um fluxo. A identificação está no painel da
              Meta, em{' '}
              <strong className="text-muted">
                WhatsApp → Configuração da API
              </strong>
              .
            </p>
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
                  ? 'Sem fluxo ligado — o bot não responde.'
                  : !fluxo.versaoPublicadaId
                    ? 'O fluxo ligado ainda não foi publicado.'
                    : null

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
                    <p className="mt-1.5 ml-4 text-[11.5px] text-muted">
                      Executa:{' '}
                      <strong className="font-semibold text-soft">
                        {fluxo?.nome ?? 'nenhum fluxo'}
                      </strong>
                    </p>
                    {aviso && (
                      <p className="mt-2 ml-4 rounded-lg border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-2 text-[11.5px] text-amber-200">
                        {aviso}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="p-5">
            <FormularioSalvar action={conectarComCliente} rotulo="Conectar">
              <div className="space-y-2.5">
                <input
                  name="phoneNumberId"
                  required
                  placeholder="Identificação do número (Meta)"
                  className="app-field px-3 py-2.5 text-[12.5px]"
                />
                <Dropdown
                  nome="flowId"
                  rotuloAcessivel="Fluxo que o número executa"
                  opcoes={[
                    { valor: '', rotulo: 'sem fluxo' },
                    ...fluxos.map((fluxo) => ({
                      valor: fluxo.id,
                      rotulo: fluxo.nome,
                    })),
                  ]}
                />
              </div>
            </FormularioSalvar>
          </div>
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
