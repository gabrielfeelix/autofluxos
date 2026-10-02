import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChavesDeApi } from '@/components/api/chaves-de-api'
import { WebhooksDeSaida } from '@/components/api/webhooks-de-saida'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { classesDoBotao } from '@/components/design/botao'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { IlustracaoChaves } from '@/components/design/ilustracoes'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { listarChavesDeApi, type ChaveDeApi } from '@/server/repos/chaves-de-api'
import { acharCliente } from '@/server/repos/clientes'
import { listarWebhooks, ultimasEntregas } from '@/server/repos/webhooks-de-saida'
import { exigirAcessoAoCliente, podeAdministrarConta } from '@/server/sessao'

export const dynamic = 'force-dynamic'

const BASE = 'https://autofluxos.4yu.com.br/api/v1'
const DOCS = '/ajuda/desenvolvedores'

/**
 * Configurações > API: as chaves que deixam outro sistema falar com esta
 * organização, e os webhooks que avisam o sistema dela (`docs/HANDOFF-02-OUT-API-PUBLICA.md`).
 *
 * Sem o recurso no plano, a tela explica o que a API faz e manda para os
 * planos, em vez de esconder o item: quem procura "tem API?" precisa achar a
 * resposta aqui.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, acesso] = await Promise.all([acharCliente(clienteId), exigirAcessoAoCliente(clienteId)])
  if (!cliente) notFound()

  const [recusa, chaves, webhooks, entregas] = await Promise.all([
    recusaDoPlano(cliente.id, 'api'),
    // A tabela pode ainda não existir num ambiente sem a 0120: lista vazia.
    listarChavesDeApi(cliente.id).catch((erro: unknown): ChaveDeApi[] => {
      console.error('[api] não deu para listar as chaves', erro instanceof Error ? erro.message : erro)
      return []
    }),
    listarWebhooks(cliente.id).catch(() => []),
    ultimasEntregas(cliente.id).catch(() => []),
  ])
  const administra = podeAdministrarConta(acesso)

  return (
    <AjustesShell cliente={cliente} ativa="api">
      <Miolo largura="larga">
        <CabecalhoDaTela
          trilha={[{ rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` }, { rotulo: 'API' }]}
          titulo="API"
          contagem={recusa ? undefined : <Pilula tom="destaque">REST · v1</Pilula>}
          descricao="Conecte o seu sistema, formulário ou parceiro: cadastrar contatos, enviar modelos, mover o funil e receber avisos do que acontece aqui."
          acoes={
            <Link href={DOCS} className={classesDoBotao({ variante: 'secundario', tamanho: 'lg' })}>
              Documentação
            </Link>
          }
        />

        {recusa ? (
          <SemPlano clienteId={cliente.id} recusa={recusa} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {administra ? (
                <>
                  <ChavesDeApi clienteId={cliente.id} iniciais={chaves} />
                  <WebhooksDeSaida clienteId={cliente.id} iniciais={webhooks} entregasIniciais={entregas} />
                </>
              ) : (
                <p className="rounded-[14px] border border-line bg-panel px-5 py-4 text-[13px] text-muted">
                  Só quem administra a organização cria chaves de API e configura webhooks. Peça a um administrador.
                </p>
              )}
            </div>
            <ComoChamar clienteId={cliente.id} />
          </div>
        )}
      </Miolo>
    </AjustesShell>
  )
}

function ComoChamar({ clienteId }: { clienteId: string }) {
  return (
    <aside className="space-y-4">
      <div className="rounded-[14px] border border-line bg-panel p-5">
        <h2 className="text-[13.5px] font-bold">Primeira chamada</h2>
        <p className="mt-1 text-[12px] leading-5 text-muted">Cadastra um contato. Troque a chave pela sua.</p>
        <pre className="mt-3 overflow-x-auto rounded-[10px] bg-surface px-3 py-2.5 font-mono text-[11px] leading-5 text-soft">
{`curl -X POST ${BASE}/contatos \\
  -H "Authorization: Bearer af_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"telefone":"5511987654321",
       "nome":"Maria Souza"}'`}
        </pre>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-[10px] bg-surface px-3 py-2">
            <dt className="text-dim">Limite</dt>
            <dd className="font-semibold">120 / min por chave</dd>
          </div>
          <div className="rounded-[10px] bg-surface px-3 py-2">
            <dt className="text-dim">Corpo</dt>
            <dd className="font-semibold">até 64 KB</dd>
          </div>
        </dl>
        <Link href={DOCS} className="mt-4 inline-block text-[12.5px] font-semibold text-primary hover:underline">
          Ver todos os endpoints →
        </Link>
      </div>

      <div className="rounded-[14px] border border-line bg-panel p-5">
        <h2 className="text-[13.5px] font-bold">Receber avisos de outro sistema</h2>
        <p className="mt-1 text-[12px] leading-5 text-muted">
          Se o seu sistema só precisa avisar que algo aconteceu (uma vaga abriu, um pedido saiu), o webhook de
          entrada assinado continua sendo o caminho mais simples.
        </p>
        <Link
          href={`/clientes/${clienteId}/fluxos?aba=eventos`}
          className="mt-3 inline-block text-[12.5px] font-semibold text-primary hover:underline"
        >
          Abrir Automações › Eventos →
        </Link>
      </div>
    </aside>
  )
}

function SemPlano({ clienteId, recusa }: { clienteId: string; recusa: string }) {
  const itens = [
    { titulo: 'Contatos', texto: 'Seu formulário, landing page ou sistema cadastra e atualiza contatos com campos e etiquetas.' },
    { titulo: 'Automações', texto: 'Quando algo acontece no seu sistema, uma automação começa no WhatsApp do contato.' },
    { titulo: 'Webhooks', texto: 'O seu CRM ou planilha recebe na hora cada contato novo e cada oportunidade ganha ou perdida.' },
  ]
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-panel">
      <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_260px] md:p-10">
        <div>
          <Pilula tom="aviso">Não incluído no plano atual</Pilula>
          <h2 className="mt-3 text-[20px] font-bold tracking-[-0.01em]">Ligue os seus sistemas ao AutoFluxos</h2>
          <p className="mt-1.5 max-w-[56ch] text-[13px] leading-6 text-muted">{recusa}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {itens.map((item) => (
              <li key={item.titulo} className="rounded-[12px] border border-line bg-surface px-4 py-3.5">
                <strong className="block text-[13px]">{item.titulo}</strong>
                <span className="mt-1 block text-[12px] leading-5 text-muted">{item.texto}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/clientes/${clienteId}/ajustes/plano`} className={classesDoBotao({ variante: 'primario' })}>
              Ver planos
            </Link>
            <Link href={DOCS} className={classesDoBotao({ variante: 'secundario' })}>
              Ler a documentação
            </Link>
          </div>
        </div>
        <div className="hidden items-center justify-center md:flex">
          <IlustracaoChaves />
        </div>
      </div>
    </section>
  )
}
