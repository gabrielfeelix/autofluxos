import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Dropdown } from '@/components/design/dropdown'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import {
  acaoApagarConexao,
  acaoCriarConexao,
  acaoLigarAgenda,
  acaoTrocarValorDaConexao,
} from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarConexoes, type Conexao } from '@/server/repos/conexoes'
import { NOME_DA_CONEXAO_DE_ADS } from '@/server/token-de-anuncios'
import { listarFluxos } from '@/server/repos/fluxos'
import { CartaoDaAgenda } from '@/components/conexoes/agenda'
import {
  NOME_DA_AGENDA,
  NOME_DA_CREDENCIAL_DA_AGENDA,
  PREFIXO_DA_CHAVE,
} from '@/core/agenda'
import { testeDaChave } from '@/core/conexoes'
import { CartaoDeConexao, GRADE_DE_CONEXOES } from '@/components/conexoes/cartao'
import { LogoAgenda, LogoChave } from '@/components/design/logos-de-marca'
import { Pilula } from '@/components/design/pilula'

export const dynamic = 'force-dynamic'

/**
 * As credenciais de um cliente.
 *
 * A regra que molda esta tela inteira: **o valor entra e não sai**. Não existe
 * "ver o token atual", nem no HTML, nem numa chamada escondida, o tipo que o
 * servidor devolve (`Conexao`) não tem campo de valor. Trocar é gravar de novo.
 *
 * Isso é chato de propósito. A alternativa, mostrar o token para conferência,
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

  const [todas, fluxos] = await Promise.all([
    listarConexoes(clienteId),
    listarFluxos(clienteId),
  ])
  // A chave de anúncios mora na tela de Anúncios, que a cria, troca e usa.
  // Solta aqui ela parecia uma chave qualquer, "nenhum bloco usa".
  const conexoes = todas.filter((c) => c.nome.trim().toLowerCase() !== NOME_DA_CONEXAO_DE_ADS)

  /**
   * Quantos blocos apontam para cada credencial.
   *
   * **É a diferença entre "cadastrada" e "ligada"**, e a tela não sabia dizer:
   * dá para ter a chave certa guardada e nenhuma automação chamando nada. Sai do
   * rascunho de cada fluxo, que já está na mão, nenhuma consulta a mais.
   */
  const usoPorConexao = new Map<string, { blocos: number; fluxos: number; nomes: string[] }>()
  for (const fluxo of fluxos) {
    const daqui = new Set<string>()
    for (const no of fluxo.rascunho.nodes) {
      if (no.type !== 'http' || !no.data.conexaoId) continue
      const uso = usoPorConexao.get(no.data.conexaoId) ?? { blocos: 0, fluxos: 0, nomes: [] }
      uso.blocos += 1
      usoPorConexao.set(no.data.conexaoId, uso)
      daqui.add(no.data.conexaoId)
    }
    // Contado uma vez por automação: três blocos no mesmo fluxo são um fluxo.
    for (const id of daqui) {
      const uso = usoPorConexao.get(id)!
      uso.fluxos += 1
      uso.nomes.push(fluxo.nome)
    }
  }

  const daAgenda = conexoes.find((c) => c.nome === NOME_DA_CREDENCIAL_DA_AGENDA) ?? null

  return (
    <AjustesShell cliente={cliente} ativa="chaves">
      <Miolo largura="larga">

        <CabecalhoDaTela
          trilha={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Credenciais de sistemas' },
          ]}
          titulo={<>Credenciais de sistemas</>}
          descricao={<>As chaves que os blocos de API usam para falar com os sistemas deste cliente. O valor
              é guardado num cofre e <strong className="text-soft">nunca volta para esta tela</strong>:
              para trocar, grave de novo.</>}
          acoes={
          <ModalFormulario
            botao="+ Nova chave"
            titulo="Nova chave"
            descricao="Ela fica guardada num cofre. Depois de gravada, o valor não volta para a tela."
            rotuloEnviar="Guardar"
            action={acaoCriarConexao.bind(null, clienteId)}
          >
            <label className="block">
              <RotuloCampo>Nome</RotuloCampo>
              <input name="nome" required placeholder="Exemplo: CRM" className="app-field px-3 py-2.5 text-[13px]" />
            </label>

            <div className="block">
              <RotuloCampo>Como ela entra na chamada</RotuloCampo>
              <Dropdown
                nome="tipo"
                valorInicial="bearer"
                rotuloAcessivel="Como a chave entra na chamada"
                opcoes={[
                  { valor: 'bearer', rotulo: 'Authorization: Bearer', detalhe: 'O mais comum em CRM' },
                  { valor: 'cabecalho', rotulo: 'Um cabeçalho próprio', detalhe: 'Ex.: x-api-key' },
                  { valor: 'query', rotulo: 'Um parâmetro na URL', detalhe: 'Ex.: ?key=' },
                ]}
              />
            </div>

            <label className="block">
              <RotuloCampo>Nome do cabeçalho ou parâmetro</RotuloCampo>
              <input name="campo" placeholder="Exemplo: x-api-key" className="app-field px-3 py-2.5 text-[13px]" />
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
          }
        />

        {/*
          A agenda ganha cartão próprio, e as outras credenciais não.

          Não é favoritismo: ela é a única cujo endereço nós conhecemos, e por
          isso a única que dá para **conferir de verdade**, apertar um botão e
          ouvir a resposta. Uma credencial de CRM genérica não tem para onde a
          gente ligar sem inventar um endereço.
        */}
        <div className={GRADE_DE_CONEXOES}>
        {daAgenda ? (
          <CartaoDaAgenda
            clienteId={clienteId}
            conexaoId={daAgenda.id}
            blocosQueUsam={usoPorConexao.get(daAgenda.id)?.blocos ?? 0}
            fluxosQueUsam={usoPorConexao.get(daAgenda.id)?.fluxos ?? 0}
          />
        ) : (
          <CartaoDeConexao
            logo={<LogoAgenda />}
            selo={<Pilula>não ligada</Pilula>}
            titulo={NOME_DA_AGENDA}
            categoria="Agenda"
            rodape={
            <ModalFormulario
              botao={`Ligar a ${NOME_DA_AGENDA}`}
              variante="secundario"
              titulo={`Ligar a agenda ${NOME_DA_AGENDA}`}
              descricao={`A chave fica num cofre e não volta para esta tela. Antes de guardar, a chave é validada com a agenda; chave recusada não é salva.`}
              rotuloEnviar="Conferir e ligar"
              action={acaoLigarAgenda.bind(null, clienteId)}
            >
              <label className="block">
                <RotuloCampo>Chave da API</RotuloCampo>
                <input
                  name="chave"
                  type="password"
                  required
                  autoComplete="off"
                  placeholder={`${PREFIXO_DA_CHAVE}…`}
                  className="app-field px-3 py-2.5 font-mono text-[13px]"
                />
                <span className="mt-1 block text-[10.5px] leading-4 text-dim">
                  Na {NOME_DA_AGENDA}: Configurações → Integrações. Ela começa com{' '}
                  <code className="font-mono">{PREFIXO_DA_CHAVE}</code>.
                </span>
              </label>
            </ModalFormulario>
            }
          >
            Sem ela, o bot não sabe horário livre, professor nem quem já é cliente.
          </CartaoDeConexao>
        )}

        {conexoes.length === 0 ? (
          <CartaoDeConexao
            tracejado
            logo={<LogoChave />}
            titulo="Nenhuma chave ainda"
            categoria="Chave de API"
          >
            Enquanto não houver, os blocos de API só alcançam endereços que não pedem chave, como
            webhook, ou uma planilha publicada pelo Apps Script.
          </CartaoDeConexao>
        ) : (
          <>
            {conexoes.map((conexao) => {
              const uso = usoPorConexao.get(conexao.id)
              const teste = testeDaChave(conexao, conexao.id === daAgenda?.id)
              // Excluir diz o efeito com nome: "para de funcionar" sem dizer
              // onde obriga a pessoa a abrir automação por automação.
              const efeito = uso
                ? `Os blocos de API que usam esta chave param de funcionar, em: ${uso.nomes.join(', ')}.`
                : 'Nenhum bloco usa esta chave hoje, nada para de funcionar.'
              return (
              <CartaoDeConexao
                key={conexao.id}
                logo={<LogoChave />}
                selo={uso ? <Pilula tom="ok">em uso</Pilula> : <Pilula tom="aviso">sem uso</Pilula>}
                titulo={conexao.nome}
                categoria="Chave de API"
                rodape={
                  <>
                  <ModalFormulario
                    botao="Trocar segredo"
                    variante="secundario"
                    titulo={`Trocar o segredo de "${conexao.nome}"`}
                    descricao="Os blocos apontam para esta chave, não para o segredo: a troca vale na próxima conversa e nada precisa ser republicado. O segredo antigo deixa de valer aqui."
                    rotuloEnviar="Guardar"
                    action={acaoTrocarValorDaConexao.bind(null, clienteId, conexao.id)}
                  >
                    <label className="block">
                      <RotuloCampo>Novo segredo</RotuloCampo>
                      <input
                        name="valor"
                        type="password"
                        required
                        autoComplete="off"
                        className="app-field px-3 py-2.5 font-mono text-[13px]"
                      />
                    </label>
                  </ModalFormulario>

                  <BotaoPerigo
                    rotulo="Excluir"
                    pergunta={`Excluir a chave "${conexao.nome}"? ${efeito} O segredo sai do cofre e não dá para desfazer.`}
                    acao={acaoApagarConexao.bind(null, clienteId, conexao.id)}
                  />
                  </>
                }
              >
                <p className="font-mono text-[11px] text-dim">{COMO_ENTRA[conexao.tipo](conexao.campo)}</p>
                  <p className="mt-1.5 text-[11px] text-dim">
                    {uso ? (
                      <>
                        usada em <strong className="text-soft">{uso.blocos}</strong>{' '}
                        {uso.blocos === 1 ? 'bloco' : 'blocos'} de{' '}
                        <strong className="text-soft">{uso.fluxos}</strong>{' '}
                        {uso.fluxos === 1 ? 'automação' : 'automações'}
                      </>
                    ) : (
                      <span className="text-aviso">nenhum bloco usa</span>
                    )}
                    {' · '}
                    <span
                      className={
                        teste.tom === 'bom' ? 'text-ok' : teste.tom === 'ruim' ? 'text-perigo' : ''
                      }
                      title={
                        teste.tom === 'neutro' && conexao.id !== daAgenda?.id
                          ? 'Só a agenda tem endereço conhecido. Para testar esta, rode o bloco que a usa pelo Testar da automação.'
                          : undefined
                      }
                    >
                      {teste.texto}
                    </span>
                  </p>
              </CartaoDeConexao>
              )
            })}
          </>
        )}
        </div>
      </Miolo>
    </AjustesShell>
  )
}
