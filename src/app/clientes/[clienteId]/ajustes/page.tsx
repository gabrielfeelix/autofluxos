import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { ICONE_DA_TELA } from '@/components/design/icones-de-ajustes'
import { planoVigente } from '@/server/repos/planos'
import { resumoDoCatalogo } from '@/core/conexoes'
import { catalogoDeIntegracoes } from '@/server/catalogo-de-integracoes'
import type { ReactNode } from 'react'
import { ApagarCliente } from '@/components/cliente/apagar'
import { acaoApagarCliente } from '@/server/acoes'
import { listarAcervo } from '@/server/repos/acervo'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { acharCliente, contarOQueSomeCom } from '@/server/repos/clientes'
import { recursosDaConta } from '@/server/repos/recursos'
import { listarConexoes } from '@/server/repos/conexoes'
import { paginasDaConta } from '@/server/repos/paginas-de-lead'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarLeads } from '@/server/repos/leads'
import { automacaoNoAr, trilhaDeConfiguracao } from '@/core/trilha-de-configuracao'
import { TrilhaDeConfiguracao } from '@/components/cliente/trilha-de-configuracao'
import { planoDaConta } from '@/server/repos/plano'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * O índice da configuração.
 *
 * Cada linha mostra **o estado atual** antes de mandar para a tela. Isso é o
 * que separa um índice de um menu: conferir se o contexto está preenchido ou
 * quantas chaves existem deixa de exigir abrir as três telas e voltar.
 *
 * As linhas moram em **três grupos** (Organização, Atendimento e IA,
 * Conexões e APIs). O que é uso diário saiu para a barra lateral (plano de
 * navegação de 24/set); rota que mudou de endereço continua respondendo pelo
 * redirecionamento escrito em `next.config.ts`.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [conexoes, canais, acervo, etiquetas, estrago, paginasDeLead, plano, recursos, fluxos, contatos, catalogo] =
    await Promise.all([
      listarConexoes(cliente.id),
      listarCanais(cliente.id),
      listarAcervo(cliente.id),
      listarEtiquetas(cliente.id),
      contarOQueSomeCom(cliente.id),
      paginasDaConta(cliente.id),
      planoDaConta(cliente.id),
      recursosDaConta(cliente.id),
      listarFluxos(cliente.id),
      contarLeads(cliente.id),
      catalogoDeIntegracoes(cliente.id),
    ])
  const semContexto = cliente.contextoNegocio.trim() === ''

  const trilha = trilhaDeConfiguracao({
    empresa: cliente,
    canais: canais.length,
    temHorario: cliente.horarioAtendimento !== null,
    temConhecimento: !semContexto,
    ...automacaoNoAr(fluxos, canais),
    temContato: contatos > 0,
  })
  const faltaNaTrilha = trilha.some((passo) => passo.estado !== 'feito')

  /*
   * Quantas do catálogo estão configuradas, contadas da mesma lista que a
   * tela de Integrações desenha (C02). O Telegram, que não dá para ligar, fica
   * fora do total.
   */
  const { conectadas, total: totalDeIntegracoes } = resumoDoCatalogo(catalogo)

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
          O que se ajusta uma vez: quem é a organização e quem tem acesso, o que o bot sabe
          responder e com quem o sistema fala.
        </p>

        {faltaNaTrilha && <TrilhaDeConfiguracao clienteId={cliente.id} passos={trilha} />}

        {/*
          Três grupos, só com o que se ajusta uma vez (plano de navegação de
          24/set). Canais, Respostas rápidas e Catálogo saíram: são trabalho do
          dia e moram agora em Conversas e Loja, na barra. Etiquetas voltou em
          26/set, a pedido do Gabriel: criar e apagar etiqueta é configuração,
          como nos outros sistemas; no dia a dia a equipe só coloca e tira
          etiqueta do contato, na ficha dele.
          Organização vem primeiro porque é o que uma conta nova preenche antes
          de tudo; Conexões e APIs por último porque é episódico.
        */}
        <Grupo
          titulo="Organização"
          descricao="Quem é a empresa, quem entra na conta, para que ela usa o sistema e em que plano está."
        >
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/negocio`}
            icone={ICONE_DA_TELA['negocio']}
            titulo="Dados da organização"
            descricao="Edite nome, logo, dados de contato e informações administrativas da organização."
            estado={
              <Selo tom={cliente.logoUrl ? 'ok' : 'neutro'}>
                {cliente.logoUrl ? 'com logo' : 'sem logo'}
              </Selo>
            }
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/equipe`}
            icone={ICONE_DA_TELA['equipe']}
            titulo="Pessoas"
            descricao="Quem entra nesta conta, o que cada pessoa pode fazer, equipes e distribuição do atendimento."
            estado={
              <Selo tom={equipe.length === 0 ? 'alerta' : 'ok'}>
                {equipe.length === 0
                  ? 'ninguém'
                  : `${equipe.length} ${equipe.length === 1 ? 'pessoa' : 'pessoas'}`}
              </Selo>
            }
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/recursos`}
            icone={ICONE_DA_TELA['recursos']}
            titulo="Objetivo e recursos"
            descricao="Para que esta organização usa o AutoFluxos, e se o CRM aparece no menu. Ninguém precisa de tudo."
            estado={<Selo tom={recursos.crmAtivo ? 'ok' : 'neutro'}>{recursos.crmAtivo ? 'com CRM' : 'sem CRM'}</Selo>}
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/plano`}
            icone={ICONE_DA_TELA['plano']}
            titulo="Plano e consumo"
            descricao="Em que plano esta organização está, quanto já foi usado neste mês, e como pedir para mudar de faixa."
            estado={<Selo tom="neutro">{(await planoVigente(plano)).nome}</Selo>}
          />
        </Grupo>

        <Grupo
          titulo="Atendimento e IA"
          descricao="O que o bot sabe, quando ele devolve a conversa para a equipe, e os arquivos que conversas e automações usam."
        >
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/contexto`}
            icone={ICONE_DA_TELA['contexto']}
            titulo="Conhecimento da IA"
            descricao="Informações da organização que a IA usa para responder com precisão."
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
            titulo="Horário e retomada"
            descricao="Quando há gente para atender, e o que fazer com a conversa que ficou parada com uma pessoa."
            estado={
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                {cliente.horarioAtendimento ? (
                  <Selo tom="ok">horário definido</Selo>
                ) : (
                  <Selo tom="alerta">atende sempre</Selo>
                )}
                {cliente.retomada.ativo ? (
                  <Selo tom="ok">volta em {rotuloDoPrazo(cliente.retomada.minutos)}</Selo>
                ) : (
                  <Selo tom="alerta">não volta sozinho</Selo>
                )}
              </span>
            }
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
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/etiquetas`}
            icone={ICONE_DA_TELA['etiquetas']}
            titulo="Etiquetas"
            descricao="Crie, renomeie, junte e apague as etiquetas que a equipe coloca nos contatos."
            estado={
              <Selo tom={etiquetas.length === 0 ? 'neutro' : 'ok'}>
                {etiquetas.length === 0
                  ? 'nenhuma'
                  : `${etiquetas.length} ${etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}`}
              </Selo>
            }
          />
        </Grupo>

        <Grupo
          titulo="Conexões e APIs"
          descricao="Com quem o sistema fala além dos canais: anúncios que trazem contato e sistemas deste cliente."
        >
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/integracoes`}
            icone={ICONE_DA_TELA['integracoes']}
            titulo="Todas as conexões"
            descricao="O que dá para ligar nesta conta, o que já está ligado e o que ainda está por vir."
            estado={
              <Selo tom="neutro">
                {`${conectadas} de ${totalDeIntegracoes}`}
              </Selo>
            }
          />
          <Cartao
            href={`/clientes/${cliente.id}/ajustes/anuncios`}
            icone={ICONE_DA_TELA['anuncios']}
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

/**
 * "2h", e não "120 minutos", no selo do cartão.
 *
 * O cartão tem uma linha para dizer o estado, e "120 minutos" ocupa ela toda
 * para contar o que "2h" conta em dois caracteres.
 */
function rotuloDoPrazo(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = minutos / 60
  return Number.isInteger(horas) ? `${horas}h` : `${minutos} min`
}
