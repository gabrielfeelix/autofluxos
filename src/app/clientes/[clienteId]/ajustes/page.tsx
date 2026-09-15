import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { saudeDoInstagram, saudeDoWhatsApp } from '@/core/saude-da-conexao'
import type { ReactNode } from 'react'
import { ApagarCliente } from '@/components/cliente/apagar'
import { acaoApagarCliente } from '@/server/acoes'
import { listarAcervo } from '@/server/repos/acervo'
import { acharCliente, contarOQueSomeCom } from '@/server/repos/clientes'
import { canalDoInstagram } from '@/server/repos/canais-instagram'
import { listarConexoes } from '@/server/repos/conexoes'
import { paginasDaConta } from '@/server/repos/paginas-de-lead'
import { listarCanais } from '@/server/repos/conversas'
import { listarRespostasRapidas } from '@/server/repos/respostas-rapidas'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * O índice da configuração.
 *
 * Cada linha mostra **o estado atual** antes de mandar para a tela. Isso é o
 * que separa um índice de um menu: conferir se o contexto está preenchido ou
 * quantas chaves existem deixa de exigir abrir as três telas e voltar.
 *
 * As linhas moram em **quatro grupos** — Canais, Atendimento, Integrações e
 * Conta —, e todas as telas de configuração moram sob `/ajustes/`. As duas
 * coisas são da mesma decisão, e o porquê de cada uma está em
 * `docs/PLANO-CONFIGURACOES.md`. Rota que mudou de endereço continua
 * respondendo pelo redirecionamento escrito em `next.config.ts`.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [conexoes, canais, respostasRapidas, acervo, estrago, etiquetas, contaDoInstagram, paginasDeLead] =
    await Promise.all([
      listarConexoes(cliente.id),
      listarCanais(cliente.id),
      listarRespostasRapidas(cliente.id),
      listarAcervo(cliente.id),
      contarOQueSomeCom(cliente.id),
      listarEtiquetas(cliente.id),
      canalDoInstagram(cliente.id),
      paginasDaConta(cliente.id),
    ])
  const semContexto = cliente.contextoNegocio.trim() === ''

  /*
   * A saúde dos canais é calculada aqui e desenhada nos selos abaixo.
   *
   * O índice é a tela em que alguém pergunta "está tudo ligado?", e até agora
   * ele respondia só "quantos" — um número derrubado pela Meta aparecia como
   * "1 número", em verde, exatamente igual a um número funcionando. Quem contava
   * a verdade era a tela de dentro, que ninguém abre sem motivo.
   */
  const saudeDoWhats = saudeDoWhatsApp(canais)
  const saudeDoIg = saudeDoInstagram(contaDoInstagram)

  // A equipe fala Postgres direto e pode estourar sem `DATABASE_URL`. Um índice
  // de configurações não pode deixar de abrir por causa de um selo.
  let equipe: MembroDaConta[] = []
  try {
    equipe = await membrosDaConta(cliente.id)
  } catch (erro) {
    console.error('[ajustes] não deu para ler a equipe', erro instanceof Error ? erro.message : erro)
  }

  return (
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="w-full max-w-[1100px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Configurações
        </h1>

        {/*
          Quatro grupos, não dez linhas soltas.

          Dez linhas planas é o tamanho em que a lista deixa de ser lida e passa
          a ser varrida: tudo tem o mesmo peso, e "ligar o WhatsApp" (sem o qual
          não existe produto) aparece igual a "respostas rápidas". O cabeçalho
          de grupo custa uma linha de texto e devolve a hierarquia.

          **Continua sendo uma página só.** Menu de duas colunas é o padrão de
          Intercom e HubSpot e só compensa acima de umas 25 telas, quando o
          índice vira rolagem — com onze, a segunda coluna seria moldura
          ocupando espaço sem responder nada.

          A ordem dos grupos é a ordem em que uma conta nova precisa deles:
          sem canal não há produto; atendimento se ajusta toda semana;
          integração é episódica; conta é administração.

          O raciocínio inteiro, com a pesquisa de mercado que o sustenta, está
          em `docs/PLANO-CONFIGURACOES.md`.
        */}
        <Grupo
          titulo="Canais"
          descricao="Por onde a conversa entra e sai. Canal caído é cliente sem atendimento."
        >
          <Linha
            href={`/clientes/${cliente.id}/ajustes/whatsapp`}
            titulo="WhatsApp"
            descricao="Qual número atende, que fluxo ele executa em cada papel, e o endereço para o painel da Meta."
            estado={
              saudeDoWhats === 'reconectar' ? (
                <Selo tom="perigo">reconectar</Selo>
              ) : (
                <Selo tom={canais.length === 0 ? 'alerta' : 'ok'}>
                  {canais.length === 0
                    ? 'nenhum'
                    : `${canais.length} ${canais.length === 1 ? 'número' : 'números'}`}
                </Selo>
              )
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/ajustes/instagram`}
            titulo="Instagram"
            descricao="Ligar o direct de uma conta profissional para as mensagens chegarem no mesmo Inbox."
            estado={
              saudeDoIg === 'reconectar' ? (
                <Selo tom="perigo">reconectar</Selo>
              ) : saudeDoIg === 'vencendo' ? (
                <Selo tom="alerta">vence em breve</Selo>
              ) : (
                <Selo tom={contaDoInstagram ? 'ok' : 'neutro'}>
                  {contaDoInstagram
                    ? (contaDoInstagram.igUsername ?? 'ligada')
                    : 'nenhuma'}
                </Selo>
              )
            }
          />
        </Grupo>

        <Grupo
          titulo="Atendimento"
          descricao="Como o atendimento funciona — o que o bot sabe, quando há gente, e o que já está pronto para usar."
        >
          <Linha
            href={`/clientes/${cliente.id}/ajustes/contexto`}
            titulo="Contexto do negócio"
            descricao="A única coisa que o bloco de IA pode dizer. Sem isto, ele responde “não sei” a tudo."
            estado={
              semContexto ? (
                <Selo tom="alerta">vazio</Selo>
              ) : (
                <Selo tom="ok">{`${cliente.contextoNegocio.trim().split(/\s+/).length} palavras`}</Selo>
              )
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/ajustes/horario`}
            titulo="Horário de atendimento"
            descricao="Quando há gente para atender. Fora disso, o bot avisa em vez de prometer um atendente."
            estado={
              cliente.horarioAtendimento ? (
                <Selo tom="ok">configurado</Selo>
              ) : (
                <Selo tom="alerta">atende sempre</Selo>
              )
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/ajustes/respostas-rapidas`}
            titulo="Respostas rápidas"
            descricao="Frases prontas para inserir na conversa sem reescrever todo dia."
            estado={
              <Selo tom={respostasRapidas.length === 0 ? 'neutro' : 'ok'}>
                {respostasRapidas.length === 0
                  ? 'nenhuma'
                  : `${respostasRapidas.length} ${respostasRapidas.length === 1 ? 'resposta' : 'respostas'}`}
              </Selo>
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/ajustes/etiquetas`}
            titulo="Etiquetas"
            descricao="As que uma pessoa cria e aplica. Viram filtro na lista de contatos."
            estado={
              <Selo tom={etiquetas.length === 0 ? 'neutro' : 'ok'}>
                {etiquetas.length === 0
                  ? 'nenhuma'
                  : `${etiquetas.length} ${etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}`}
              </Selo>
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/ajustes/acervo`}
            titulo="Acervo"
            descricao="Foto, vídeo, áudio e PDF que o bloco de Mídia pode enviar na conversa."
            estado={
              <Selo tom={acervo.length === 0 ? 'neutro' : 'ok'}>
                {acervo.length === 0
                  ? 'vazio'
                  : `${acervo.length} ${acervo.length === 1 ? 'arquivo' : 'arquivos'}`}
              </Selo>
            }
          />
        </Grupo>

        {/*
          Anúncios e Chaves de API são integração e não canal porque nenhum dos
          dois produz conversa no Inbox: um traz lead, o outro é o fluxo falando
          com o sistema do próprio cliente. É o mesmo corte que o Intercom faz
          entre Channels e Integrations.

          Anúncios vem primeiro de propósito: é o caminho que o cliente procura
          por nome ("como ligo meus anúncios?"), enquanto Chaves de API é onde
          ele só chega sabendo o que é uma chave.
        */}
        <Grupo
          titulo="Integrações"
          descricao="Com quem o sistema fala além dos canais — o que entra de fora e o que sai para os sistemas deste cliente."
        >
          <Linha
            href={`/clientes/${cliente.id}/ajustes/anuncios`}
            titulo="Anúncios"
            descricao="Receber como lead quem preenche o formulário de um anúncio no Facebook ou no Instagram."
            estado={
              <Selo tom={paginasDeLead.length === 0 ? 'neutro' : 'ok'}>
                {paginasDeLead.length === 0
                  ? 'não ligado'
                  : `${paginasDeLead.length} ${paginasDeLead.length === 1 ? 'página' : 'páginas'}`}
              </Selo>
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/ajustes/chaves`}
            titulo="Chaves de API"
            descricao="As chaves que os blocos de Serviços externos usam para falar com os sistemas deste cliente."
            estado={
              <Selo tom={conexoes.length === 0 ? 'neutro' : 'ok'}>
                {conexoes.length === 0
                  ? 'nenhuma'
                  : `${conexoes.length} ${conexoes.length === 1 ? 'chave' : 'chaves'}`}
              </Selo>
            }
          />
        </Grupo>

        <Grupo
          titulo="Conta"
          descricao="Quem é este cliente para a 4YU, quem entra na conta e o que cada um pode fazer."
        >
          {/*
            Dados do negócio morava no Painel, acima de tudo, e saiu de lá pelo
            motivo que vale para qualquer cadastro: nome, CNPJ e logo não se
            olham todo dia, e ocupavam o espaço mais caro do produto. A tela
            continua acessível pelo Painel — quem acabou de criar a conta chega
            por lá —, e passa a ter também o caminho que uma pessoa procura
            quando vai mexer nela de propósito.
          */}
          <Linha
            href={`/clientes/${cliente.id}/ajustes/negocio`}
            titulo="Dados do negócio"
            descricao="O cadastro e o logo desta conta. Nada daqui vai para o WhatsApp — é o que a 4YU usa para saber com quem fala."
            estado={
              <Selo tom={cliente.logoUrl ? 'ok' : 'neutro'}>
                {cliente.logoUrl ? 'com logo' : 'sem logo'}
              </Selo>
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/ajustes/equipe`}
            titulo="Equipe"
            descricao="Quem entra nesta conta e o que cada um pode fazer. É de onde sai o rail de atribuição do Inbox."
            estado={
              <Selo tom={equipe.length === 0 ? 'alerta' : 'ok'}>
                {equipe.length === 0
                  ? 'ninguém'
                  : `${equipe.length} ${equipe.length === 1 ? 'pessoa' : 'pessoas'}`}
              </Selo>
            }
          />
        </Grupo>

        {/* Longe do resto e por último, porque a tela de ajustes é onde se
            entra para mexer numa coisa e sair — e este botão não é uma
            configuração, é o fim do cliente. */}
        <section className="mt-10 rounded-[14px] border border-rose-400/[0.18] bg-rose-400/[0.03] px-6 py-5">
          <h2 className="text-[13.5px] font-bold text-perigo">Apagar o cliente</h2>
          <p className="mt-1 mb-4 max-w-[520px] text-[12px] leading-5 text-muted">
            Some com {cliente.nome} e com tudo que é dele: leads, conversas inteiras, automações,
            versões publicadas e as credenciais guardadas no cofre. Não existe cópia em outro lugar
            e não dá para desfazer.
          </p>
          <ApagarCliente
            nome={cliente.nome}
            estrago={estrago}
            acao={acaoApagarCliente.bind(null, cliente.id)}
          />
        </section>
      </main>
    </ClienteShell>
  )
}

/**
 * Um grupo do índice — cabeçalho, uma linha de motivo, e o cartão.
 *
 * O cabeçalho fica **fora** do cartão de propósito: dentro, ele viraria mais
 * uma linha da lista e competiria com os itens em vez de organizá-los.
 */
function Grupo({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao: string
  children: ReactNode
}) {
  return (
    <section className="mb-7">
      <h2 className="text-[13.5px] font-bold tracking-[-0.01em]">{titulo}</h2>
      <p className="mt-0.5 mb-2.5 max-w-[620px] text-[12px] leading-5 text-muted">{descricao}</p>
      <ul className="app-card divide-y divide-line overflow-hidden">{children}</ul>
    </section>
  )
}

function Linha({
  href,
  titulo,
  descricao,
  estado,
}: {
  href: string
  titulo: string
  descricao: string
  estado: ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-4 px-6 py-[18px] transition hover:bg-surface"
      >
        <span className="min-w-0 flex-1">
          <strong className="block text-[13.5px] font-bold">{titulo}</strong>
          <span className="mt-0.5 block text-[12px] leading-5 text-dim">
            {descricao}
          </span>
        </span>
        {estado}
        <span aria-hidden className="text-[15px] text-muted">
          ›
        </span>
      </Link>
    </li>
  )
}

function Selo({
  children,
  tom,
}: {
  children: ReactNode
  tom: 'ok' | 'alerta' | 'perigo' | 'neutro'
}) {
  const cor = {
    ok: 'border-emerald-400/25 bg-emerald-400/[0.08] text-ok',
    alerta: 'border-amber-300/30 bg-amber-300/[0.1] text-aviso',
    // `perigo` é para canal caído, e só. Amarelo já significa "falta
    // configurar"; um canal fora do ar não é uma configuração faltando, é
    // atendimento parado agora.
    perigo: 'border-rose-400/30 bg-rose-400/[0.09] text-perigo',
    neutro: 'border-line bg-surface text-muted',
  }[tom]

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${cor}`}
    >
      {children}
    </span>
  )
}
