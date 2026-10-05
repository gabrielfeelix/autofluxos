'use client'

import { useRouter } from 'next/navigation'
import type { StatusDoTemplate } from '@/core/templates'
import { acaoApagarTemplate } from '@/server/acoes-transmissoes'
import type { Template } from '@/server/repos/templates'
import { useConfirmar } from '@/components/design/confirmar'
import { IlustracaoModelos } from '@/components/design/ilustracoes'
import { FUNDO_DA_FIXA, FUNDO_DA_LINHA, COLUNA_FIXA, Tabela, Th } from '@/components/design/tabela'
import { categoriaLegivel, idiomaLegivel, tituloDoModelo } from '@/core/titulo-da-biblioteca'
import { dataEHora } from '@/lib/quando'

/**
 * A lista de modelos aprovados, e o formulário de criar um.
 *
 * ---------------------------------------------------------------------------
 * O que esta tela existe para dizer
 * ---------------------------------------------------------------------------
 *
 * Que um modelo **não está pronto quando você termina de escrevê-lo**. Ele vai
 * para uma fila de revisão da Meta que demora, pode voltar recusado em inglês,
 * e pode ser pausado depois de aprovado. Nenhuma outra tela do produto tem esse
 * comportamento, e esconder isso faria a pessoa achar que o sistema travou.
 */

const ROTULO_DO_STATUS: Record<StatusDoTemplate, { texto: string; cor: string }> = {
  rascunho: { texto: 'Rascunho', cor: 'bg-line text-dim' },
  pendente: { texto: 'Em análise na Meta', cor: 'bg-amber-500/15 text-amber-600' },
  aprovado: { texto: 'Aprovado', cor: 'bg-emerald-500/15 text-emerald-600' },
  recusado: { texto: 'Recusado', cor: 'bg-red-500/15 text-red-600' },
  pausado: { texto: 'Pausado pela Meta', cor: 'bg-red-500/15 text-red-600' },
  desativado: { texto: 'Desativado', cor: 'bg-red-500/15 text-red-600' },
}

/** O que cada status significa para quem quer mandar mensagem hoje. */
const EXPLICACAO: Record<StatusDoTemplate, string | null> = {
  rascunho: 'Ainda não foi enviado para a Meta.',
  pendente: 'A Meta está revisando. Costuma levar de alguns minutos a 24 horas.',
  aprovado: null,
  recusado: null,
  // Pausado engana por parecer temporário, e é. Mas enquanto durar, não
  // entrega, e dizer "quase aprovado" faria a pessoa agendar uma campanha que
  // vai falhar inteira.
  pausado:
    'A Meta pausou por baixa qualidade. Ela despausa sozinha em algumas horas, mas enquanto isso o envio falha.',
  desativado: 'A Meta desativou de vez. Não volta, crie outro modelo.',
}

export function ListaDeTemplates({
  clienteId,
  templates,
}: {
  clienteId: string
  templates: Template[]
}) {
  if (templates.length === 0) {
    return (
      <section className="app-card overflow-hidden">
        {/* Título e "Novo modelo" moram no topo da tela (`CabecalhoDaTela`). */}
        <div className="px-5 py-14 text-center">
          <IlustracaoModelos />
          <p className="mt-6 text-[13.5px] font-semibold text-soft">Nenhum modelo ainda</p>
        </div>
      </section>
    )
  }

  /*
    Tabela, e não lista de nomes técnicos. A linha abria com
    `account_creation_confirmation_3_202610051827` em fonte de código: é o
    nome que a Meta exige (minúsculas e sublinhado), e quem lê precisa do
    título. O nome da Meta continua ali, pequeno, embaixo do título, porque é
    ele que aparece no Gerenciador do WhatsApp e no suporte da Meta.
  */
  return (
    <Tabela largura={920}>
      <thead>
        <tr className="border-b border-line">
          <Th fixa>Modelo</Th>
          <Th>Mensagem</Th>
          <Th>Categoria</Th>
          <Th>Idioma</Th>
          <Th>Status</Th>
          <Th>Criado em</Th>
          <Th className="w-24">
            <span className="sr-only">Ações</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {templates.map((template) => (
          <Linha key={template.id} clienteId={clienteId} template={template} />
        ))}
      </tbody>
    </Tabela>
  )
}

function Linha({ clienteId, template }: { clienteId: string; template: Template }) {
  const router = useRouter()
  /*
    O pendente e o erro são do modal de confirmação: ele desabilita os
    próprios botões enquanto a ação roda e mostra a recusa sem fechar.
  */
  const { confirmar, dialogo, rodando: apagando } = useConfirmar()
  const status = ROTULO_DO_STATUS[template.status]
  const explicacao = EXPLICACAO[template.status]
  const titulo = tituloDoModelo(template.nome)

  function apagar() {
    // Trinta dias é o prazo real da Meta para liberar o nome, e ele é longo o
    // bastante para a pessoa merecer saber antes e não depois.
    confirmar({
      titulo: `Apagar "${titulo}"?`,
      descricao:
        'A Meta segura o nome por 30 dias antes de liberá-lo: você não vai conseguir criar outro com o mesmo nome nesse período.',
      rotulo: 'Apagar modelo',
      aoConfirmar: async () => {
        const r = await acaoApagarTemplate(clienteId, template.id)
        if (r.ok) router.refresh()
        return r
      },
    })
  }

  return (
    <tr className={`group border-b border-line align-top last:border-0 ${FUNDO_DA_LINHA}`}>
      <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} !max-w-[240px] px-4 py-3`}>
        {dialogo}
        <span className="block truncate text-[13px] font-semibold text-ink">{titulo}</span>
        <span className="mt-0.5 block truncate font-mono text-[10.5px] text-dim">{template.nome}</span>
      </td>
      <td className="min-w-[260px] max-w-[340px] px-4 py-3">
        {template.componentes.corpo ? (
          // Numa linha só no resumo: com as quebras do texto, "Oi, {{1}}," enchia
          // as duas linhas e o resto virava reticências.
          <span className="line-clamp-2 text-[12.5px] leading-5 text-soft">
            {template.componentes.corpo.replace(/\s+/g, ' ').trim()}
          </span>
        ) : (
          <span className="text-[12px] text-dim">Texto do modelo pronto da Meta</span>
        )}
        {/*
          O motivo da recusa aparece INTEIRO: quando a Meta recusa por formato,
          ela manda a explicação e o que consertar, a melhor informação que ela
          dá em qualquer lugar da plataforma.
        */}
        {template.motivoRecusa && (
          <span className="mt-2 block rounded-[10px] bg-red-500/10 px-3 py-2 text-[12px] leading-5 text-red-700 dark:text-red-300">
            <strong>Por que foi recusado:</strong> {template.motivoRecusa}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-[12.5px] whitespace-nowrap text-soft">{categoriaLegivel(template.categoria)}</td>
      <td className="px-4 py-3 text-[12.5px] whitespace-nowrap text-soft">{idiomaLegivel(template.idioma)}</td>
      <td className="max-w-[190px] px-4 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${status.cor}`}>
          {status.texto}
        </span>
        {explicacao && <span className="mt-1 block text-[11px] leading-4 text-dim">{explicacao}</span>}
      </td>
      <td className="px-4 py-3 text-[12px] whitespace-nowrap text-dim tabular-nums">{dataEHora(template.criadoEm)}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={apagar}
          disabled={apagando}
          className="text-[12px] font-semibold text-dim hover:text-red-600 disabled:opacity-50"
        >
          {apagando ? 'Apagando…' : 'Apagar'}
        </button>
      </td>
    </tr>
  )
}
