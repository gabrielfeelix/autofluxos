import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { CampoParaCopiar } from '@/components/design/copiar'
import { ConectarWhatsapp } from '@/components/cliente/conectar-whatsapp'
import { Trilha } from '@/components/design/trilha'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { Dropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { LogoDoCanal } from '@/components/design/selo-do-canal'
import {
  acaoConectarNumero,
  acaoDefinirFluxosDoNumero,
  acaoDesconectarNumero,
} from '@/server/acoes'
import {
  EXPLICACAO_DO_PAPEL,
  PAPEIS_DO_NUMERO,
  ROTULO_DO_PAPEL,
  respostasDoNumero,
} from '@/core/papeis-do-numero'
import {
  identidadeNaTela,
  progressoGeral,
  situacaoDoNumero,
} from '@/core/coexistencia-na-tela'
import { acharCliente } from '@/server/repos/clientes'
import { coexistenciaDoCliente } from '@/server/repos/coexistencia'
import { fluxoDoPapel, listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { whatsappConfigurado } from '@/server/whatsapp/conexao'
import { CamadasDaConexao } from '@/components/conexoes/camadas'
import { estadoDaConexao, idadeDoEvento } from '@/core/conexoes'
import { ultimaMensagemRecebida } from '@/server/repos/ultimos-eventos'

export const dynamic = 'force-dynamic'

/**
 * O número do WhatsApp e o endereço que a Meta chama.
 *
 * As duas coisas ficam na mesma tela porque falham juntas: número cadastrado
 * aqui sem o webhook cadastrado lá é um bot que existe e nunca recebe nada.
 *
 * **A conexão por Embedded Signup mora aqui, e não em tela nova**: a rota de
 * retorno já manda o cliente para cá (`/clientes/[clienteId]/numero`), e uma
 * página separada quebraria o próprio retorno.
 */

/**
 * O que o `?resultado=` da rota de retorno diz para quem voltou.
 *
 * São seis, e **`cancelado` não é erro**: é alguém que desistiu de propósito na
 * tela da Meta. Pedir para essa pessoa investigar uma decisão que ela mesma
 * tomou é o jeito de fazer a tela parecer quebrada quando nada quebrou.
 */
const RESULTADOS: Record<string, { tom: 'bom' | 'neutro' | 'ruim'; texto: string }> = {
  conectado: {
    tom: 'bom',
    texto:
      'Número conectado. Se você escolheu trazer as conversas antigas, elas aparecem aos poucos, pode levar de alguns minutos a algumas horas.',
  },
  cancelado: {
    tom: 'neutro',
    texto: 'A conexão foi cancelada na tela da Meta. Nada mudou por aqui.',
  },
  falhou: {
    tom: 'ruim',
    texto: 'A Meta recusou a conexão. O detalhe está em Alertas, na administração.',
  },
  sem_codigo: {
    tom: 'ruim',
    texto: 'A Meta devolveu sem o código de autorização. Tente conectar de novo.',
  },
  sem_numero: {
    tom: 'ruim',
    texto:
      'A Meta devolveu sem dizer qual número foi conectado. Tente de novo; se repetir, o detalhe está em Alertas.',
  },
  whatsapp_estado: {
    tom: 'ruim',
    texto:
      'O link de conexão venceu ou não era deste cliente. Comece de novo por esta tela, o link vale por 10 minutos.',
  },
  whatsapp_acesso: {
    tom: 'ruim',
    texto: 'Você não tem acesso a este cliente para conectar um número nele.',
  },
  sem_app: {
    tom: 'ruim',
    texto:
      'Este ambiente não tem o app do WhatsApp configurado (META_APP_ID e META_WHATSAPP_CONFIG_ID).',
  },
}
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ resultado?: string; erro?: string }>
}) {
  const { clienteId } = await params
  const { resultado, erro } = await searchParams
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [fluxos, todosOsCanais, coexistencia, cabecalhos, ultimaMensagem] = await Promise.all([
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    coexistenciaDoCliente(cliente.id),
    headers(),
    ultimaMensagemRecebida(cliente.id),
  ])
  // A conta do Instagram mora na mesma tabela; aqui aparecia como "sem número".
  const canais = todosOsCanais.filter((c) => c.provider !== 'instagram')
  // As quatro camadas (6.4): cadastro, último evento e falha conhecida.
  const estado = estadoDaConexao({
    tipo: 'whatsapp',
    numeros: canais.map((c) => ({ displayPhoneNumber: c.displayPhoneNumber, desembarcadoEm: c.desembarcadoEm })),
    ultimoEvento: ultimaMensagem,
  })

  // `erro` cobre os dois que a rota manda para `/painel?erro=`; quem chegar
  // aqui com um deles na URL vê o mesmo texto.
  const aviso = RESULTADOS[resultado ?? erro ?? '']
  /*
   * Vão para o navegador, e podem: `app_id` e `config_id` são **públicos** por
   * construção, aparecem na URL de qualquer Embedded Signup. O que nunca sai
   * do servidor é o `META_APP_SECRET`, que é quem troca o `code` por token.
   */
  /*
   * **`.trim()` não é zelo: um `\n` aqui derrubou a conexão de um cliente
   * real.**
   *
   * A variável foi gravada na Vercel com `echo`, que acrescenta quebra de
   * linha. Ela viajou até o `FB.login` e apareceu na URL como
   * `config_id=1616632909867069%0A`, a Meta não achou configuração com esse
   * id e respondeu "Falha ao iniciar sessão", sem dizer o motivo.
   *
   * Custou uma tarde porque o valor *parece* certo em toda tela que o mostra:
   * o painel da Vercel esconde o caractere, e o erro da Meta é genérico.
   */
  const appId = (process.env.META_APP_ID ?? '').trim()
  const configId = (process.env.META_WHATSAPP_CONFIG_ID ?? '').trim()
  const podeConectar = whatsappConfigurado()
  /*
   * O botão não aparece para quem já conectou.
   *
   * Não é só arrumação de tela: clicar de novo manda o cliente refazer o
   * Embedded Signup de um número que já está ligado, e a Meta trata isso como
   * reconexão, que desvincula os aparelhos dele outra vez, sem necessidade.
   */
  const temCoexistente = canais.some((canal) => coexistencia[canal.id]?.isOnBizApp === true)

  const host =
    cabecalhos.get('x-forwarded-host') ??
    cabecalhos.get('host') ??
    'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  const webhook = `${protocolo}://${host}/api/webhook/whatsapp`
  const conectarComCliente = acaoConectarNumero.bind(null, cliente.id, {})

  return (
    <AjustesShell cliente={cliente} ativa="whatsapp">
      <main className="w-full max-w-[1100px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'WhatsApp' },
          ]}
        />
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          WhatsApp
        </h1>

        <div className="mb-5">
          <CamadasDaConexao
            clienteId={cliente.id}
            estado={estado}
            rotuloDoEvento="Última mensagem recebida na conta"
          />
        </div>

        {aviso && (
          <p
            className={`mb-5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-6 ${
              aviso.tom === 'bom'
                ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-ok'
                : aviso.tom === 'neutro'
                  ? 'border-line bg-surface text-muted'
                  : 'border-amber-400/25 bg-amber-400/[0.07] text-aviso'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {/*
         * **Antes de tudo o mais.** Se a Meta está segurando as mensagens, essa
         * é a única coisa nesta tela que importa: mexer em fluxo ou papel não
         * adianta enquanto a conta estiver travada.
         */}

        {/*
         * Conectar o número que o cliente já usa.
         *
         * **O texto é o produto aqui.** Quem vai clicar é o dono de um negócio
         * que atende pelo celular todo dia, e o medo dele é perder isso. Um
         * botão sozinho, sem responder "vou perder meu WhatsApp?", faz a pessoa
         * não clicar, ou clicar sem saber no que está entrando, que é pior.
         */}
        {!temCoexistente && (
        <section className="app-card mb-[18px] px-5 py-5">
          <h2 className="flex items-center gap-2.5 text-[14.5px] font-bold">
            <span
              style={{ color: '#25D366' }}
              className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[#25D366]/10"
            >
              <LogoDoCanal canal="whatsapp" tamanho={15} />
            </span>
            Conectar o WhatsApp que você já usa
          </h2>
          <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-6 text-dim">
            <strong className="text-muted">Você não perde o seu WhatsApp.</strong> Continua
            respondendo pelo celular como sempre, o painel só passa a enxergar as mesmas
            conversas.
          </p>

          {/*
           * **O passo a passo desceu para um `details`, e o motivo é o clique.**
           *
           * A versão anterior abria com quatro passos numerados, o aviso de QR
           * code e os requisitos, tudo antes do botão. Quem chega aqui já
           * decidiu conectar; fazê-lo ler a tela inteira para achar o botão
           * atrasa a única ação que a tela tem.
           *
           * O conteúdo não sai, porque ele resolve chamado de suporte de
           * verdade (quem espera QR code trava e liga achando que quebrou).
           * Fica a um clique, para quem quiser saber antes.
           */}
          <details className="group mt-3.5">
            <summary className="cursor-pointer list-none text-[12px] font-semibold text-muted transition hover:text-primary">
              Como funciona, passo a passo
              <span className="ml-1 text-dim transition group-open:hidden">▸</span>
              <span className="ml-1 hidden text-dim group-open:inline">▾</span>
            </summary>

            <div className="mt-2.5 rounded-[10px] border border-line bg-panel px-4 py-3.5">
              <ol className="space-y-1.5 text-[12px] leading-5 text-dim">
                <li>1. A Meta abre uma tela e pede o seu número.</li>
                <li>
                  2. Ela mostra um <strong className="text-muted">código de verificação</strong> e
                  manda uma mensagem da <strong className="text-muted">Conta Oficial do Facebook
                  Business</strong> no seu WhatsApp Business.
                </li>
                <li>
                  3. Você toca em <strong className="text-muted">Connect</strong>, depois em{' '}
                  <strong className="text-muted">Confirm</strong>, e cola o código.
                </li>
                <li>
                  4. Você escolhe se quer trazer as conversas antigas:{' '}
                  <strong className="text-muted">é escolha sua</strong>, não obrigação.
                </li>
              </ol>
              <p className="mt-2.5 text-[11.5px] text-aviso/90">
                Não é QR code, a confirmação é por código, dentro do seu WhatsApp Business.
              </p>
              <p className="mt-2 text-[11.5px] leading-5 text-dim">
                Precisa do <strong className="text-muted">WhatsApp Business 2.24.17 ou mais
                novo</strong>, com o número já em uso no aplicativo.
              </p>
            </div>
          </details>

          {/*
           * **O SDK, e não mais o link hospedado.**
           *
           * O hospedado é um link e não precisaria de componente nenhum, mas a
           * doc da Meta diz que ele *"can only be used to onboard business
           * customers to Cloud API, and the flow cannot be customized"*, e sem
           * customização não há coexistência: o cliente perderia o WhatsApp do
           * celular. Ele também não redireciona de volta, o que fez duas
           * conexões reais terminarem sem o nosso banco saber.
           */}
          <div className="mt-4">
            <ConectarWhatsapp clienteId={cliente.id} appId={appId} configId={configId} />
          </div>

          {!podeConectar && (
            <>
              <p className="mt-3 text-[12px] text-aviso">
                Falta <code className="font-mono">META_APP_ID</code> e{' '}
                <code className="font-mono">META_WHATSAPP_CONFIG_ID</code> no ambiente deste
                servidor.
              </p>
              {/*
               * Sem as variáveis o botão acima não funciona, e o cadastro
               * manual está escondido enquanto não há número, o que deixaria
               * esta tela sem saída nenhuma. O modal é o mesmo da seção de
               * baixo; aqui ele aparece como escape, e só neste caso.
               */}
              <div className="mt-3">
                <ModalFormulario
                  botao="Cadastrar número manualmente"
                  titulo="Conectar um número"
                  descricao="Para quem já tem número na Cloud API: a identificação está no painel da Meta, em WhatsApp → Configuração da API."
                  rotuloEnviar="Conectar"
                  variante="secundario"
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
                </ModalFormulario>
              </div>
            </>
          )}
        </section>
        )}

        {/*
         * **Tudo daqui para baixo só existe depois que há um número.**
         *
         * Antes, a tela abria com dois botões que pareciam a mesma coisa:
         * "Conectar meu WhatsApp" e "+ Conectar número", e nada dizia qual
         * usar. São caminhos diferentes: o de cima é o Embedded Signup (o
         * número que a pessoa já usa no celular, em coexistência); este é o
         * cadastro manual, que pede `phone_number_id` copiado do painel da
         * Meta e serve a quem já tem número na Cloud API.
         *
         * Oferecer os dois ao mesmo tempo para quem não tem número nenhum faz
         * a escolha errada parecer disponível: quem clicasse no manual cairia
         * num formulário pedindo um id que ele não tem, e não há como voltar
         * disso sem entender a diferença entre as duas APIs.
         *
         * Com um número conectado a pergunta muda e passa a fazer sentido:
         * "conectar **outro** número" é operação de quem já entendeu o que é
         * um. O webhook segue a mesma regra: é endereço para configurar um
         * número que ainda não existe.
         */}
        {canais.length > 0 && (
        <section className="app-card mb-[18px] overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 max-w-[70ch]">
            <h2 className="text-[14.5px] font-bold">Números do WhatsApp</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-dim">
              Cada número mostra a conexão, o que o bot responde e o endereço da Meta. A identificação está no painel da
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
              descricao="A identificação é a do painel da Meta, em WhatsApp → Configuração da API. Os outros fluxos deste número (boas-vindas, mídia recebida, pós-atendimento) se escolhem depois, na linha dele."
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
            <p className="border-b border-line px-5 py-8 text-center text-xs leading-5 text-dim">
              Nenhum número conectado ainda, sem isto o WhatsApp não chega até
              aqui.
            </p>
          ) : (
            <ul>
              {canais.map((canal) => {
                const salvarFluxos = acaoDefinirFluxosDoNumero.bind(
                  null,
                  cliente.id,
                  canal.id,
                  {},
                )
                const estado = coexistencia[canal.id]
                // O desembarque gravado no canal vale mesmo sem o estado de
                // coexistência: é o mesmo dado que o topo da tela usa (6.4), e as
                // duas partes precisam dizer a mesma coisa.
                const situacao = canal.desembarcadoEm ? 'desembarcado' : situacaoDoNumero(estado)
                const progresso = progressoGeral(estado)
                const identidade = identidadeNaTela(estado, canal.phoneNumberId, canal.displayPhoneNumber)
                const respostas = respostasDoNumero(
                  {
                    principal: fluxoDoPapel(canal, 'principal'),
                    boasVindas: fluxoDoPapel(canal, 'boasVindas'),
                    midia: fluxoDoPapel(canal, 'midia'),
                    posAtendimento: fluxoDoPapel(canal, 'posAtendimento'),
                  },
                  fluxos,
                )
                const principalCalado = respostas.calados.some((c) => c.papel === 'principal')
                const caiu = situacao === 'desembarcado' || situacao === 'travado'

                return (
                  <li
                    key={canal.id}
                    className="border-b border-line px-5 py-4"
                  >
                    <div className="flex items-center gap-2.5 text-[12.5px] font-semibold">
                      {/*
                       * **A logo volta depois de conectar, e o telefone vira o
                       * título.**
                       *
                       * Antes daqui havia só uma bolinha de status e o
                       * `phone_number_id` em fonte mono: `110549275215531`. Quem
                       * acabou de plugar o próprio celular olhava a lista,
                       * não achava o seu número, via "Conectar número" ao lado
                       * e concluía que não tinha conectado.
                       *
                       * O id não some, só desce: ele ainda é a identidade do
                       * canal e o que se procura no painel da Meta.
                       */}
                      <span
                        style={{ color: '#25D366' }}
                        className="relative inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[#25D366]/10"
                      >
                        <LogoDoCanal canal="whatsapp" tamanho={14} />
                        <span
                          className={`absolute -right-0.5 -bottom-0.5 size-[9px] rounded-full border-2 border-[#12161c] ${principalCalado || caiu ? 'bg-amber-300' : 'bg-emerald-400'}`}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-soft">
                          {identidade.titulo}
                        </span>
                        {identidade.abaixo && (
                          <span className="block truncate text-[11px] font-normal text-dim">
                            {identidade.abaixo}
                          </span>
                        )}
                      </span>
                      <BotaoPerigo
                        rotulo="Desconectar"
                        titulo="Tira este número deste cliente. As conversas já registradas impedem, elas são o histórico dos leads."
                        pergunta={`Desconectar o número ${identidade.titulo}? O bot para de responder nele.`}
                        acao={acaoDesconectarNumero.bind(
                          null,
                          cliente.id,
                          canal.id,
                        )}
                      />
                    </div>

                    {/*
                     * Três perguntas diferentes, três blocos (tarefa 6.6): o
                     * número está ligado? o bot responde o quê? a Meta sabe para
                     * onde mandar? Antes era uma lista só, e o aviso de fluxo
                     * em rascunho aparecia misturado com o de sincronização.
                     */}
                    <div className="mt-3.5 grid gap-3 lg:grid-cols-3">
                      <BlocoDoNumero titulo="Estado da conexão">
                        {situacao === 'comum' && (
                          <>
                            <p className="text-[12px] font-semibold text-ok">Conectado</p>
                            <p className="mt-1 text-[11px] leading-5 text-dim">
                              Número ligado pela API da Meta.
                            </p>
                          </>
                        )}

                        {situacao === 'sincronizando' && (
                          <>
                            <p className="text-[12px] font-semibold text-info">
                              Trazendo as conversas antigas
                              {progresso !== null ? `, ${progresso}%` : ''}
                            </p>
                            {/*
                             * "Conectado" sem a conversa antiga aparecer faz o
                             * cliente achar que quebrou. Progresso visível é a
                             * diferença entre esperar e desconfiar.
                             */}
                            {progresso !== null && (
                              <div
                                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-strong"
                                role="progressbar"
                                aria-valuenow={progresso}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label="Progresso da importação das conversas"
                              >
                                <div
                                  className="h-full rounded-full bg-sky-400 transition-all"
                                  style={{ width: `${progresso}%` }}
                                />
                              </div>
                            )}
                            <p className="mt-2 text-[11px] leading-5 text-dim">
                              Leva de alguns minutos a algumas horas. Pode fechar esta tela, as
                              conversas vão aparecendo sozinhas no Inbox.
                            </p>
                          </>
                        )}

                        {situacao === 'travado' && (
                          <>
                            <p className="text-[12px] font-semibold text-aviso">
                              Importação parada{progresso !== null ? ` em ${progresso}%` : ''}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-dim">
                              A Meta parou de informar como vai a importação das conversas
                              antigas. O que já chegou continua no Inbox. Se faltar conversa
                              antiga daqui a algumas horas, reconecte. Este aviso sai sozinho em
                              um dia.
                            </p>
                          </>
                        )}

                        {situacao === 'desembarcado' && (
                          <>
                            <p className="text-[12px] font-semibold text-perigo">A conexão caiu</p>
                            <p className="mt-1 text-[11px] leading-5 text-dim">
                              Costuma acontecer quando o celular é trocado ou o WhatsApp Business
                              é reinstalado. Normalmente volta sozinha em alguns minutos; enquanto
                              isso, o envio por aqui fica parado.
                            </p>
                          </>
                        )}

                        {situacao === 'pronto' && (
                          <>
                            <p className="text-[12px] font-semibold text-ok">
                              Conectado ao WhatsApp Business do celular
                            </p>
                            {/*
                             * As duas coisas que ninguém adivinha, e que só
                             * aparecem depois de conectado porque é quando elas
                             * passam a valer.
                             */}
                            <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-dim">
                              <li>
                                · Abra o WhatsApp Business no celular{' '}
                                <strong className="text-muted">ao menos uma vez a cada 14
                                dias</strong>, sem isso a Meta derruba a conexão.
                              </li>
                              <li>
                                · O <strong className="text-muted">nome do negócio ficou
                                travado</strong> na Meta. Para mudar, reconecte o número.
                              </li>
                            </ul>
                          </>
                        )}

                        {/*
                         * Reconectar só aparece quando caiu ou travou: refazer o
                         * cadastro num número que está bem desvincula os
                         * aparelhos do cliente sem necessidade.
                         */}
                        {caiu && podeConectar && (
                          <div className="mt-3">
                            <ConectarWhatsapp
                              clienteId={cliente.id}
                              appId={appId}
                              configId={configId}
                              rotulo="Reconectar"
                            />
                          </div>
                        )}
                      </BlocoDoNumero>

                      <BlocoDoNumero titulo="O que o bot responde">
                        <p
                          className={`text-[12px] font-semibold ${
                            respostas.respondendo === respostas.total
                              ? 'text-ok'
                              : principalCalado
                                ? 'text-aviso'
                                : ''
                          }`}
                        >
                          Responde em {respostas.respondendo} de {respostas.total} situações
                        </p>
                        {respostas.calados.length > 0 && (
                          <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-dim">
                            {respostas.calados.map((calado) => (
                              <li key={calado.papel}>
                                · <strong className="text-muted">{ROTULO_DO_PAPEL[calado.papel]}</strong>
                                {calado.motivo === 'rascunho' && calado.fluxoId ? (
                                  <>
                                    : fluxo em rascunho.{' '}
                                    <Link
                                      href={`/clientes/${cliente.id}/fluxos/${calado.fluxoId}`}
                                      className="font-semibold text-primary hover:underline"
                                    >
                                      Publicar ›
                                    </Link>
                                  </>
                                ) : (
                                  ': sem fluxo.'
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {principalCalado && (
                          <p className="mt-1.5 text-[11px] leading-5 text-aviso">
                            Sem o principal publicado, o bot não responde a maioria das mensagens.
                          </p>
                        )}
                        <div className="mt-3">
                          <ModalFormulario
                            /*
                              "Papel" é palavra nossa, do `core/papeis-do-numero.ts`.
                              Quem chega aqui quer escolher o que o bot responde.
                            */
                            botao="Escolher os fluxos"
                            titulo={`Fluxos de ${identidade.titulo}`}
                            descricao="Cada situação abaixo pode rodar um fluxo diferente. Em branco, o bot não responde naquela situação, a conversa vai para uma pessoa."
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
                                      <p className="mt-1 text-[11px] text-aviso">
                                        Este fluxo ainda não foi publicado. Enquanto
                                        estiver assim, esta situação fica sem resposta.
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </ModalFormulario>
                        </div>
                      </BlocoDoNumero>

                      <BlocoDoNumero titulo="Webhook">
                        <p className="text-[11px] leading-5 text-dim">
                          O endereço que a Meta chama. Cadastre na configuração do WhatsApp
                          Business, no painel dela.
                        </p>
                        <div className="mt-2">
                          <CampoParaCopiar valor={webhook} rotuloAcessivel="Copiar o endereço do webhook" />
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-dim">
                          Última mensagem recebida na conta:{' '}
                          <strong className="text-muted">{idadeDoEvento(ultimaMensagem)}</strong>
                        </p>
                      </BlocoDoNumero>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

        </section>
        )}

      </main>
    </AjustesShell>
  )
}

/** Um dos três blocos do cartão do número (tarefa 6.6). */
function BlocoDoNumero({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-line bg-panel px-3.5 py-3">
      <h3 className="mb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-dim uppercase">
        {titulo}
      </h3>
      {children}
    </div>
  )
}
