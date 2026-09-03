import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import type { ReactNode } from 'react'
import { ApagarCliente } from '@/components/cliente/apagar'
import { acaoApagarCliente } from '@/server/acoes'
import { listarAcervo } from '@/server/repos/acervo'
import { acharCliente, contarOQueSomeCom } from '@/server/repos/clientes'
import { canalDoInstagram } from '@/server/repos/canais-instagram'
import { listarConexoes } from '@/server/repos/conexoes'
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
 * quantas credenciais existem deixa de exigir abrir as três telas e voltar.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [conexoes, canais, respostasRapidas, acervo, estrago, etiquetas, contaDoInstagram] =
    await Promise.all([
      listarConexoes(cliente.id),
      listarCanais(cliente.id),
      listarRespostasRapidas(cliente.id),
      listarAcervo(cliente.id),
      contarOQueSomeCom(cliente.id),
      listarEtiquetas(cliente.id),
      canalDoInstagram(cliente.id),
    ])
  const semContexto = cliente.contextoNegocio.trim() === ''

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

        <ul className="app-card divide-y divide-white/[0.045] overflow-hidden">
          <Linha
            href={`/clientes/${cliente.id}/contexto`}
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
            href={`/clientes/${cliente.id}/conexoes`}
            titulo="Credenciais"
            descricao="As chaves que os blocos de Serviços externos usam para falar com os sistemas deste cliente."
            estado={
              <Selo tom={conexoes.length === 0 ? 'neutro' : 'ok'}>
                {conexoes.length === 0
                  ? 'nenhuma'
                  : `${conexoes.length} ${conexoes.length === 1 ? 'chave' : 'chaves'}`}
              </Selo>
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/acervo`}
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
            href={`/clientes/${cliente.id}/numero`}
            titulo="Número do WhatsApp"
            descricao="Qual número atende, que fluxo ele executa em cada papel, e o endereço para o painel da Meta."
            estado={
              <Selo tom={canais.length === 0 ? 'alerta' : 'ok'}>
                {canais.length === 0
                  ? 'nenhum'
                  : `${canais.length} ${canais.length === 1 ? 'número' : 'números'}`}
              </Selo>
            }
          />
          <Linha
            href={`/clientes/${cliente.id}/instagram`}
            titulo="Instagram"
            descricao="Ligar o direct de uma conta profissional para as mensagens chegarem no mesmo Inbox."
            estado={
              <Selo tom={contaDoInstagram ? 'ok' : 'neutro'}>
                {contaDoInstagram
                  ? (contaDoInstagram.igUsername ?? 'ligada')
                  : 'nenhuma'}
              </Selo>
            }
          />
        </ul>

        {/* Longe do resto e por último, porque a tela de ajustes é onde se
            entra para mexer numa coisa e sair — e este botão não é uma
            configuração, é o fim do cliente. */}
        <section className="mt-10 rounded-[14px] border border-rose-400/[0.18] bg-rose-400/[0.03] px-6 py-5">
          <h2 className="text-[13.5px] font-bold text-rose-200">Apagar o cliente</h2>
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
        className="flex items-center gap-4 px-6 py-[18px] transition hover:bg-white/[0.03]"
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
  tom: 'ok' | 'alerta' | 'neutro'
}) {
  const cor = {
    ok: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300',
    alerta: 'border-amber-300/30 bg-amber-300/[0.1] text-amber-200',
    neutro: 'border-white/10 bg-white/[0.04] text-muted',
  }[tom]

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${cor}`}
    >
      {children}
    </span>
  )
}
