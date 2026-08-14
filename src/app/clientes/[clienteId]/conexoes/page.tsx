import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Dropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import {
  acaoApagarConexao,
  acaoCriarConexao,
  acaoTrocarValorDaConexao,
} from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarConexoes, type Conexao } from '@/server/repos/conexoes'

export const dynamic = 'force-dynamic'

/**
 * As credenciais de um cliente.
 *
 * A regra que molda esta tela inteira: **o valor entra e não sai**. Não existe
 * "ver o token atual", nem no HTML, nem numa chamada escondida — o tipo que o
 * servidor devolve (`Conexao`) não tem campo de valor. Trocar é gravar de novo.
 *
 * Isso é chato de propósito. A alternativa — mostrar o token para conferência —
 * põe credencial de terceiro no HTML de uma página, no histórico do navegador e
 * em qualquer captura de tela.
 */

const COMO_ENTRA: Record<Conexao['tipo'], (campo: string | null) => string> = {
  bearer: () => 'Authorization: Bearer •••',
  cabecalho: (campo) => `${campo}: •••`,
  query: (campo) => `?${campo}=•••`,
}

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const conexoes = await listarConexoes(clienteId)

  return (
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="max-w-[900px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Link
        href={`/clientes/${clienteId}/ajustes`}
        className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-accent"
        >
        ← Ajustes
        </Link>

        <div className="mb-[30px] flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-0.02em]">Credenciais</h1>
            <p className="mt-1.5 max-w-[560px] text-[13px] leading-6 text-dim">
              As chaves que os blocos de API usam para falar com os sistemas deste cliente. O valor
              é guardado num cofre e <strong className="text-soft">nunca volta para esta tela</strong> —
              para trocar, grave de novo.
            </p>
          </div>

          <ModalFormulario
            botao="+ Nova credencial"
            titulo="Nova credencial"
            descricao="Ela fica guardada num cofre. Depois de gravada, o valor não volta para a tela."
            rotuloEnviar="Guardar"
            action={acaoCriarConexao.bind(null, clienteId)}
          >
            <label className="block">
              <RotuloCampo>Nome</RotuloCampo>
              <input name="nome" required placeholder="CRM" className="app-field px-3 py-2.5 text-[13px]" />
            </label>

            <label className="block">
              <RotuloCampo>Como ela entra na chamada</RotuloCampo>
              <Dropdown
                nome="tipo"
                valorInicial="bearer"
                rotuloAcessivel="Como a credencial entra na chamada"
                opcoes={[
                  { valor: 'bearer', rotulo: 'Authorization: Bearer', detalhe: 'O mais comum em CRM' },
                  { valor: 'cabecalho', rotulo: 'Um cabeçalho próprio', detalhe: 'Ex.: x-api-key' },
                  { valor: 'query', rotulo: 'Um parâmetro na URL', detalhe: 'Ex.: ?key=' },
                ]}
              />
            </label>

            <label className="block">
              <RotuloCampo>Nome do cabeçalho ou parâmetro</RotuloCampo>
              <input name="campo" placeholder="x-api-key" className="app-field px-3 py-2.5 text-[13px]" />
              <span className="mt-1 block text-[10.5px] text-dim">
                Deixe vazio quando for Bearer. Nos outros dois, é obrigatório.
              </span>
            </label>

            <label className="block">
              <RotuloCampo>Valor</RotuloCampo>
              <input
                name="valor"
                type="password"
                required
                autoComplete="off"
                className="app-field px-3 py-2.5 font-mono text-[13px]"
              />
              <span className="mt-1 block text-[10.5px] text-dim">
                Cole a chave. Ela não aparece aqui de novo depois de guardada.
              </span>
            </label>
          </ModalFormulario>
        </div>

        {conexoes.length === 0 ? (
          <div className="app-card px-6 py-10 text-center">
            <p className="text-[13.5px] text-soft">Nenhuma credencial ainda.</p>
            <p className="mx-auto mt-2 max-w-[440px] text-[12.5px] leading-6 text-dim">
              Enquanto não houver, os blocos de API só alcançam endereços que não pedem chave — como
              webhook, ou uma planilha publicada pelo Apps Script.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {conexoes.map((conexao) => (
              <li key={conexao.id} className="app-card flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold">{conexao.nome}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-dim">
                    {COMO_ENTRA[conexao.tipo](conexao.campo)}
                  </p>
                </div>

                <ModalFormulario
                  botao="Trocar valor"
                  variante="secundario"
                  titulo={`Trocar o valor de "${conexao.nome}"`}
                  descricao="Os fluxos apontam para esta credencial pelo id, então a troca vale na próxima conversa. Nada precisa ser republicado."
                  rotuloEnviar="Guardar"
                  action={acaoTrocarValorDaConexao.bind(null, clienteId, conexao.id)}
                >
                  <label className="block">
                    <RotuloCampo>Novo valor</RotuloCampo>
                    <input
                      name="valor"
                      type="password"
                      required
                      autoComplete="off"
                      className="app-field px-3 py-2.5 font-mono text-[13px]"
                    />
                  </label>
                </ModalFormulario>

                <form action={acaoApagarConexao.bind(null, clienteId, conexao.id)}>
                  <button
                    className="rounded-lg border border-rose-400/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-400/10"
                    title="Apagar. Fluxo que usa esta credencial para de funcionar."
                  >
                    Apagar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </ClienteShell>
  )
}
