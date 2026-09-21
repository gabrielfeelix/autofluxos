import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { ICONE_DA_TELA } from '@/components/design/icones-de-ajustes'
import { acharPlano } from '@/core/planos'
import { saudeDoInstagram, saudeDoWhatsApp } from '@/core/saude-da-conexao'
import type { ReactNode } from 'react'
import { ApagarCliente } from '@/components/cliente/apagar'
import { acaoApagarCliente } from '@/server/acoes'
import { listarAcervo } from '@/server/repos/acervo'
import { acharCliente, contarOQueSomeCom } from '@/server/repos/clientes'
import { recursosDaConta } from '@/server/repos/recursos'
import { canalDoInstagram } from '@/server/repos/canais-instagram'
import { listarConexoes } from '@/server/repos/conexoes'
import { paginasDaConta } from '@/server/repos/paginas-de-lead'
import { listarCanais } from '@/server/repos/conversas'
import { listarRespostasRapidas } from '@/server/repos/respostas-rapidas'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { planoDaConta } from '@/server/repos/plano'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/** Quantas integrações o catálogo conhece, contando o Telegram, que é "em breve". */
const TOTAL_DE_INTEGRACOES = 5

/**
 * O índice da configuração.
 *
 * Cada linha mostra **o estado atual** antes de mandar para a tela. Isso é o
 * que separa um índice de um menu: conferir se o contexto está preenchido ou
 * quantas chaves existem deixa de exigir abrir as três telas e voltar.
 *
 * As linhas moram em **quatro grupos**, Canais, Atendimento, Integrações e
 * Conta , e todas as telas de configuração moram sob `/ajustes/`. As duas
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

  const [conexoes, canais, respostasRapidas, acervo, estrago, etiquetas, contaDoInstagram, paginasDeLead, plano, recursos] =
    await Promise.all([
      listarConexoes(cliente.id),
      listarCanais(cliente.id),
      listarRespostasRapidas(cliente.id),
      listarAcervo(cliente.id),
      contarOQueSomeCom(cliente.id),
      listarEtiquetas(cliente.id),
      canalDoInstagram(cliente.id),
      paginasDaConta(cliente.id),
      planoDaConta(cliente.id),
      recursosDaConta(cliente.id),
    ])
  const semContexto = cliente.contextoNegocio.trim() === ''

  /*
   * A saúde dos canais é calculada aqui e desenhada nos selos abaixo.
   *
   * O índice é a tela em que alguém pergunta "está tudo ligado?", e até agora
   * ele respondia só "quantos", um número derrubado pela Meta aparecia como
   * "1 número", em verde, exatamente igual a um número funcionando. Quem contava
   * a verdade era a tela de dentro, que ninguém abre sem motivo.
   */
  const saudeDoWhats = saudeDoWhatsApp(canais)
  const saudeDoIg = saudeDoInstagram(contaDoInstagram)

  /*
   * Quantas das cinco do catálogo estão de pé. O número mora aqui e a lista
   * mora na tela de Integrações, contar dos dois lados divergiria no dia em
   * que uma entrasse.
   */
  const conectadas = [
    saudeDoWhats !== 'nao-ligada',
    saudeDoIg !== 'nao-ligada',
    paginasDeLead.length > 0,
    conexoes.length > 0,
  ].filter(Boolean).length

  // A equipe fala Postgres direto e pode estourar sem `DATABASE_URL`. Um índice
  // de configurações não pode deixar de abrir por causa de um selo.
  let equipe: MembroDaConta[] = []
  try {
    equipe = await membrosDaConta(cliente.id)
  } catch (erro) {
    console.error('[ajustes] não deu para ler a equipe', erro instanceof Error ? erro.message : erro)
  }

  return (
    <AjustesShell cliente={cliente} ativa="inicio">
      <main className="w-full max-w-[1100px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] md:text-[28px]">
          Configurações
        </h1>
        <p className="mt-1.5 mb-7 max-w-[640px] text-[13px] leading-6 text-dim">
          Tudo que muda como esta conta atende: por onde as conversas entram, o que o bot sabe
          responder, com quem o sistema fala e quem tem acesso.
        </p>

        {/*
          Quatro grupos, não dez linhas soltas.

          Dez linhas planas é o tamanho em que a lista deixa de ser lida e passa
          a ser varrida: tudo tem o mesmo peso, e "ligar o WhatsApp" (sem o qual
          não existe produto) aparece igual a "respostas rápidas". O cabeçalho
          de grupo custa uma linha de texto e devolve a hierarquia.

          **Continua sendo uma página só.** Menu de duas colunas é o padrão de
          Intercom e HubSpot e só compensa acima de umas 25 telas, quando o
          índice vira rolagem, com onze, a segunda coluna seria moldura
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
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/whatsapp`}
            icone={ICONE_DA_TELA['whatsapp']}
            titulo="WhatsApp"
            descricao="Conecte seu número e escolha como receber e responder às mensagens."
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
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/instagram`}
            icone={ICONE_DA_TELA['instagram']}
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
          descricao="Como o atendimento funciona, o que o bot sabe, quando há gente, e o que já está pronto para usar."
        >
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/contexto`}
            icone={ICONE_DA_TELA['contexto']}
            titulo="Conhecimento da IA"
            descricao="Informações da empresa que a IA usa para responder com precisão."
            estado={
              semContexto ? (
                <Selo tom="alerta">vazio</Selo>
              ) : (
                <Selo tom="ok">{`${cliente.contextoNegocio.trim().split(/\s+/).length} palavras`}</Selo>
              )
            }
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/horario`}
            icone={ICONE_DA_TELA['horario']}
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
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/respostas-rapidas`}
            icone={ICONE_DA_TELA['respostas-rapidas']}
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
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/etiquetas`}
            icone={ICONE_DA_TELA['etiquetas']}
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
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/produtos`}
            icone={ICONE_DA_TELA['produtos']}
            titulo="Catálogo"
            descricao="Organize produtos e serviços para registrar interesses e vendas."
            estado={<Selo tom="neutro">produtos e serviços</Selo>}
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/acervo`}
            icone={ICONE_DA_TELA['acervo']}
            titulo="Arquivos e mídias"
            descricao="Organize fotos, vídeos, áudios e documentos para usar nas conversas e automações."
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
          descricao="Com quem o sistema fala além dos canais, o que entra de fora e o que sai para os sistemas deste cliente."
        >
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/integracoes`}
            icone={ICONE_DA_TELA['integracoes']}
            titulo="Todas as integrações"
            descricao="O catálogo: o que dá para ligar nesta conta, o que já está ligado, e o que ainda está por vir."
            estado={
              <Selo tom="neutro">
                {`${conectadas} de ${TOTAL_DE_INTEGRACOES}`}
              </Selo>
            }
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/anuncios`}
            icone={ICONE_DA_TELA['anuncios']}
            titulo="Captação por anúncios"
            descricao="Receber como lead quem preenche o formulário de um anúncio no Facebook ou no Instagram."
            estado={
              <Selo tom={paginasDeLead.length === 0 ? 'neutro' : 'ok'}>
                {paginasDeLead.length === 0
                  ? 'não ligado'
                  : `${paginasDeLead.length} ${paginasDeLead.length === 1 ? 'página' : 'páginas'}`}
              </Selo>
            }
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/chaves`}
            icone={ICONE_DA_TELA['chaves']}
            titulo="Chaves de API"
            descricao="Gerencie credenciais para conectar suas automações a outros sistemas."
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
          descricao="Informações e preferências da sua empresa, quem entra na conta e o que cada um pode fazer."
        >
          {/*
            Dados do negócio morava no Painel, acima de tudo, e saiu de lá pelo
            motivo que vale para qualquer cadastro: nome, CNPJ e logo não se
            olham todo dia, e ocupavam o espaço mais caro do produto. A tela
            continua acessível pelo Painel, quem acabou de criar a conta chega
            por lá , e passa a ter também o caminho que uma pessoa procura
            quando vai mexer nela de propósito.
          */}
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/negocio`}
            icone={ICONE_DA_TELA['negocio']}
            titulo="Dados da empresa"
            descricao="Edite nome, logo, dados de contato e informações administrativas da empresa."
            estado={
              <Selo tom={cliente.logoUrl ? 'ok' : 'neutro'}>
                {cliente.logoUrl ? 'com logo' : 'sem logo'}
              </Selo>
            }
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/equipe`}
            icone={ICONE_DA_TELA['equipe']}
            titulo="Equipe"
            descricao="Quem entra nesta conta e o que cada um pode fazer. Defina quem pode atender e o que cada pessoa pode acessar."
            estado={
              <Selo tom={equipe.length === 0 ? 'alerta' : 'ok'}>
                {equipe.length === 0
                  ? 'ninguém'
                  : `${equipe.length} ${equipe.length === 1 ? 'pessoa' : 'pessoas'}`}
              </Selo>
            }
          />
          {/*
            Recursos vem antes de Plano porque a pergunta é anterior: o que esta
            conta usa do produto decide o que ela consome, e não o contrário.
          */}
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/recursos`}
            icone={ICONE_DA_TELA['recursos']}
            titulo="Personalizar sistema"
            descricao="Para que esta conta usa o AutoFluxos, e se o CRM aparece no menu. Ninguém precisa de tudo."
            estado={<Selo tom={recursos.crmAtivo ? 'ok' : 'neutro'}>{recursos.crmAtivo ? 'com CRM' : 'sem CRM'}</Selo>}
          />
          {/*
            O selo mostra o plano e não o consumo, embora a tela mostre os dois.
            Consumo é número que muda todo dia, e um selo que muda todo dia no
            índice treina a pessoa a ignorar os selos que ela precisa ver.
          */}
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/plano`}
            icone={ICONE_DA_TELA['plano']}
            titulo="Plano e consumo"
            descricao="Em que plano esta conta está, quanto já foi usado neste mês, e como pedir para mudar de faixa."
            estado={<Selo tom="neutro">{acharPlano(plano).nome}</Selo>}
          />
        </Grupo>

        {/* Longe do resto e por último, porque a tela de ajustes é onde se
            entra para mexer numa coisa e sair, e este botão não é uma
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
    </AjustesShell>
  )
}

/**
 * Um grupo do índice, cabeçalho, uma linha de motivo, e o cartão.
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
    <section className="mb-9">
      <h2 className="text-[14px] font-bold tracking-[-0.01em]">{titulo}</h2>
      <p className="mt-0.5 mb-3.5 max-w-[640px] text-[12px] leading-5 text-muted">{descricao}</p>
      {/*
        Três por linha no monitor, uma no celular.

        Quatro caberiam em largura, e o cartão ficaria estreito demais para a
        frase de explicação, que é justamente a parte que faz o cartão valer
        mais do que a linha de lista que havia aqui antes.
      */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

function Cartao({
  href,
  titulo,
  descricao,
  estado,
  icone,
}: {
  href: string
  titulo: string
  descricao: string
  estado: ReactNode
  icone: ReactNode
}) {
  return (
    /*
      O cartão **inteiro** é o link, e não um botão "Configurar" no rodapé.

      A referência que inspirou esta tela põe o botão porque o cartão dela não é
      clicável; copiar o botão sem copiar o motivo seria trocar um alvo do
      tamanho do cartão por um do tamanho de uma palavra, e ainda gastar uma
      linha de altura em todos eles.
    */
    <Link
      href={href}
      className="app-card app-card-interactive flex min-h-[148px] flex-col p-4 no-underline"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-primary-weak text-primary">
          {icone}
        </span>
        {estado}
      </div>
      <p className="text-[13.5px] font-bold tracking-[-0.01em]">{titulo}</p>
      <p className="mt-1 text-[12px] leading-5 text-muted">{descricao}</p>
    </Link>
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
