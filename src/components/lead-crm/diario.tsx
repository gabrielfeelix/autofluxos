'use client'

import { useState } from 'react'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import type { Evento } from '@/core/crm'

type Acao = (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>

/**
 * O diário do contato: o que foi acontecendo, em ordem, com quem escreveu.
 *
 * ---------------------------------------------------------------------------
 * Por que ele fica aberto, e a Anotação fechada
 * ---------------------------------------------------------------------------
 *
 * A Anotação é lida antes de falar com a pessoa e escrita de vez em quando, então
 * economiza espaço ficando fechada. Aqui é o contrário: a caixa existe para ser
 * usada **enquanto** a conversa acontece, e um clique a mais entre lembrar de
 * algo e escrever é exatamente o atrito que faz ninguém anotar nada. Caixa
 * fechada vira diário vazio.
 *
 * ---------------------------------------------------------------------------
 * Só as notas, e não a linha do tempo inteira
 * ---------------------------------------------------------------------------
 *
 * O histórico completo já é uma aba, e repetir aqui "entrou no funil", "mudou de
 * etapa" e "assumiu" enterraria o que foi escrito à mão no meio do que o sistema
 * registrou sozinho. As notas continuam aparecendo lá também, na ordem dos
 * outros fatos, que é onde a pergunta é "o que aconteceu com esta pessoa".
 */
export function Diario({
  eventos,
  limite,
  anotar,
}: {
  eventos: Evento[]
  limite: number
  anotar: Acao
}) {
  const [aberta, setAberta] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  /** As anotadas agora, antes de a ficha voltar do servidor. */
  const [novas, setNovas] = useState<Evento[]>([])
  const ids = new Set(eventos.map((evento) => evento.id))
  const notas = [
    ...novas.filter((nova) => !ids.has(nova.id)),
    ...eventos.filter((evento) => evento.tipo === 'nota'),
  ]

  /*
   * Otimista desde 25/set. Era um `FormularioSalvar` com "Salvando…" até o
   * servidor responder, e o servidor ainda redesenhava a ficha para a nota
   * aparecer. Agora a nota entra na lista e o campo fecha no clique; se o
   * servidor recusar, ela sai, e o campo reabre com o texto e o motivo.
   */
  function salvar() {
    const limpo = texto.trim()
    if (limpo === '') {
      setErro('escreva alguma coisa antes de salvar')
      return
    }
    const provisoria: Evento = {
      id: `nova-${Date.now()}`,
      tipo: 'nota',
      dados: { texto: limpo },
      autor: null,
      criadoEm: new Date().toISOString(),
    }
    setErro(null)
    setNovas((atuais) => [provisoria, ...atuais])
    setTexto('')
    setAberta(false)
    const dados = new FormData()
    dados.set('texto', limpo)
    const desfazer = (motivo: string) => {
      setNovas((atuais) => atuais.filter((nota) => nota.id !== provisoria.id))
      setTexto(limpo)
      setErro(motivo)
      setAberta(true)
    }
    depoisDaTela(() => anotar({}, dados)).then(
      (r) => {
        if (r.erro || r.ok === false) desfazer(r.erro ?? 'não deu para salvar')
      },
      () => desfazer('sem conexão com o servidor'),
    )
  }

  return (
    <section className="app-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5">
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold">
          {/*
            Era "Diário", que no CRM sugere um registro do sistema, e este bloco
            é o contrário disso: é o que **a equipe** escreve à mão sobre a
            pessoa. O nome agora diz de quem é o texto, e a regra de que ele não
            vira mensagem saiu do corpo e virou o "?" ao lado.
          */}
          Anotações da equipe
          <AjudaDoCampo
            titulo="Diário"
            secao="duvidas"
            texto="O que a equipe escreve sobre esta pessoa, com data e autor."
            detalhes={
              <>
                <p>
                  Cada anotação fica com a data e o nome de quem escreveu, e o que já foi escrito
                  não é apagado por uma anotação nova, é um registro, não um campo.
                </p>
                <p>
                  <strong>Fica só aqui.</strong> Não vai para o WhatsApp nem para nenhuma
                  automação: quem escreve está falando com o time, não com a pessoa.
                </p>
              </>
            }
          />
          {notas.length > 0 && (
            <span className="ml-1.5 text-[11px] font-semibold text-dim tabular-nums">
              {notas.length}
            </span>
          )}
        </h2>
        {!aberta && (
          <button
            type="button"
            onClick={() => setAberta(true)}
            className="rounded-lg border border-line px-2 py-0.5 text-[10.5px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
          >
            Anotar
          </button>
        )}
      </header>

      <div className="px-[18px] py-4">
        {aberta && (
          <div className="mb-4">
            <form
              onSubmit={(evento) => {
                evento.preventDefault()
                salvar()
              }}
            >
              <textarea
                name="texto"
                autoFocus
                rows={3}
                maxLength={limite}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Exemplo: ligou, pediu para retornar terça de manhã."
                className="app-field resize-y px-3 py-2.5 text-[12.5px] leading-5"
              />
              {/*
                O "Cancelar" fica na **mesma linha** do Salvar. Ele era um botão
                solto embaixo do formulário, e sobrava sozinho, cortado na linha
                de baixo.
              */}
              <div className="mt-3.5 flex items-center gap-3">
                <button type="submit" className="app-primary-button px-[18px] py-2.5 text-[13px]">
                  Salvar anotação
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErro(null)
                    setAberta(false)
                  }}
                  className="text-[11.5px] text-muted transition hover:text-primary"
                >
                  Cancelar
                </button>
                {erro && (
                  <span role="alert" className="text-[12px] font-semibold text-perigo">
                    {erro}
                  </span>
                )}
              </div>
            </form>
          </div>
        )}

        {notas.length === 0 ? (
          <p className="text-[12px] leading-5 text-dim">
            Nada anotado ainda. O que for escrito aqui fica com a data e o nome de quem escreveu.
          </p>
        ) : (
          <ol className="flex flex-col gap-3.5">
            {notas.map((nota) => (
              <li key={nota.id} className="min-w-0">
                <p className="text-[12.5px] leading-5 whitespace-pre-wrap text-soft">
                  {String(nota.dados.texto ?? '')}
                </p>
                <p className="mt-1 text-[11px] text-dim">
                  {new Date(nota.criadoEm).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {nota.autor ? ` · ${nota.autor}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
