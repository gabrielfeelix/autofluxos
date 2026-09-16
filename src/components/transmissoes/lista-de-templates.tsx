'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Categoria, StatusDoTemplate } from '@/core/templates'
import { acaoApagarTemplate, acaoCriarTemplate } from '@/server/acoes-transmissoes'
import type { Template } from '@/server/repos/templates'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'

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
  // Pausado engana por parecer temporário — e é. Mas enquanto durar, não
  // entrega, e dizer "quase aprovado" faria a pessoa agendar uma campanha que
  // vai falhar inteira.
  pausado:
    'A Meta pausou por baixa qualidade. Ela despausa sozinha em algumas horas, mas enquanto isso o envio falha.',
  desativado: 'A Meta desativou de vez. Não volta — crie outro modelo.',
}

export function ListaDeTemplates({
  clienteId,
  templates,
}: {
  clienteId: string
  templates: Template[]
}) {
  return (
    <section className="app-card overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[14.5px] font-bold">Modelos aprovados</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-dim">
            A Meta revisa cada modelo antes de liberar o uso.
          </p>
        </div>
        <FormularioDeTemplate clienteId={clienteId} />
      </header>

      {templates.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-dim">
          Nenhum modelo ainda.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {templates.map((template) => (
            <Linha key={template.id} clienteId={clienteId} template={template} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Linha({ clienteId, template }: { clienteId: string; template: Template }) {
  const router = useRouter()
  const [apagando, comecarApagar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const status = ROTULO_DO_STATUS[template.status]
  const explicacao = EXPLICACAO[template.status]

  function apagar() {
    // Trinta dias é o prazo real da Meta para liberar o nome, e ele é longo o
    // bastante para a pessoa merecer saber antes e não depois.
    const certeza = window.confirm(
      `Apagar "${template.nome}"?\n\nA Meta segura o nome por 30 dias antes de liberá-lo — você não vai conseguir criar outro com o mesmo nome nesse período.`,
    )
    if (!certeza) return

    comecarApagar(async () => {
      const r = await acaoApagarTemplate(clienteId, template.id)
      if (!r.ok) setErro(r.erro ?? 'Não deu para apagar.')
      else router.refresh()
    })
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold">{template.nome}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cor}`}>
              {status.texto}
            </span>
            <span className="text-[11px] text-dim">
              {template.idioma} · {template.categoria}
            </span>
          </div>

          <p className="mt-1.5 max-w-[78ch] whitespace-pre-wrap text-[12.5px] leading-5 text-dim">
            {template.componentes.corpo}
          </p>

          {explicacao && <p className="mt-1.5 text-[12px] leading-5 text-dim">{explicacao}</p>}

          {/*
            O motivo da recusa aparece INTEIRO, e essa é a decisão mais
            importante desta tela.

            Quando a Meta recusa por formato, ela manda a explicação E a
            recomendação do que consertar — a melhor informação que ela dá em
            qualquer lugar da plataforma. Resumir aqui, ou trocar por um
            "recusado" genérico, jogaria fora exatamente o que faz a pessoa
            conseguir consertar sem abrir a documentação em inglês.
          */}
          {template.motivoRecusa && (
            <p className="mt-2 rounded-[10px] bg-red-500/10 px-3 py-2 text-[12px] leading-5 text-red-700 dark:text-red-300">
              <strong>Por que foi recusado:</strong> {template.motivoRecusa}
            </p>
          )}

          {erro && <p className="mt-2 text-[12px] text-red-600">{erro}</p>}
        </div>

        <button
          type="button"
          onClick={apagar}
          disabled={apagando}
          className="shrink-0 text-[12px] font-semibold text-dim hover:text-red-600 disabled:opacity-50"
        >
          {apagando ? 'Apagando…' : 'Apagar'}
        </button>
      </div>
    </li>
  )
}

/**
 * O formulário de criar modelo.
 *
 * **Os exemplos são obrigatórios, e é aqui que isso fica claro.** A Meta recusa
 * por `INVALID_FORMAT` quando falta valor de exemplo numa variável — e essa
 * recusa chega horas depois. Pedir na tela custa trinta segundos; descobrir
 * pela recusa custa um dia.
 *
 * O campo de exemplos aparece conforme a pessoa escreve: são tantos quantas
 * forem as variáveis do texto. Uma lista fixa de cinco campos vazios pediria
 * que ela descobrisse sozinha quantos preencher.
 */
function FormularioDeTemplate({ clienteId }: { clienteId: string }) {
  const router = useRouter()
  const [corpo, setCorpo] = useState('')

  // As variáveis do corpo, em tempo real: é o que diz quantos exemplos pedir.
  const quantasVariaveis = new Set([...corpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size

  async function criar(dados: FormData) {
    const r = await acaoCriarTemplate(clienteId, {
      nome: String(dados.get('nome') ?? ''),
      categoria: String(dados.get('categoria') ?? 'UTILITY') as Categoria,
      componentes: { corpo: String(dados.get('corpo') ?? '') },
      exemplos: Array.from({ length: quantasVariaveis }, (_, i) =>
        String(dados.get(`exemplo-${i}`) ?? ''),
      ),
    })

    if (!r.ok) return { ok: false, erro: r.erro }

    router.refresh()
    return { ok: true }
  }

  return (
    <ModalFormulario
      botao="Novo modelo"
      titulo="Novo modelo"
      descricao="A Meta revisa antes de liberar. Costuma levar de alguns minutos a 24 horas."
      action={criar}
      rotuloEnviar="Enviar para a Meta"
    >
      <div>
        <RotuloCampo>Nome</RotuloCampo>
        <input name="nome" className="app-field w-full" placeholder="Lembrete de consulta" />
        <p className="mt-1 text-[11.5px] leading-5 text-muted">
          Pode escrever normal — a gente ajusta o formato.
        </p>
      </div>

      <div>
        <RotuloCampo>Categoria</RotuloCampo>
        <select name="categoria" defaultValue="UTILITY" className="app-field w-full">
          <option value="UTILITY">Utilidade — confirmação, lembrete, atualização</option>
          <option value="MARKETING">Marketing — promoção, novidade, convite</option>
          <option value="AUTHENTICATION">Autenticação — código de verificação</option>
        </select>
        {/*
          A categoria muda o PREÇO da mensagem, e a Meta reclassifica sozinha o
          que julga promocional. Dizer isso antes evita a conversa de "por que a
          conta veio mais cara".
        */}
        <p className="mt-1 text-[11.5px] leading-5 text-muted">
          Ela muda quanto a Meta cobra por mensagem.
        </p>
      </div>

      <div>
        <RotuloCampo>Mensagem</RotuloCampo>
        <textarea
          name="corpo"
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          className="app-field min-h-[110px] w-full"
          placeholder="Oi {{1}}, sua consulta é dia {{2}}. Confirma?"
        />
        <p className="mt-1 text-[11.5px] leading-5 text-muted">
          Use {'{{1}}'}, {'{{2}}'}… para o que muda por pessoa.
        </p>
      </div>

      {quantasVariaveis > 0 && (
        <div>
          <RotuloCampo>Exemplos das variáveis</RotuloCampo>
          {/*
            Obrigatório, e a tela diz por quê: sem exemplo a Meta recusa por
            formato, e a recusa demora horas para chegar.
          */}
          <p className="mb-2 text-[11.5px] leading-5 text-muted">
            A Meta exige um exemplo de cada variável para revisar.
          </p>
          {Array.from({ length: quantasVariaveis }, (_, i) => (
            <input
              key={i}
              name={`exemplo-${i}`}
              className="app-field mb-2 w-full"
              placeholder={`Exemplo para {{${i + 1}}}`}
            />
          ))}
        </div>
      )}
    </ModalFormulario>
  )
}
