'use client'

import { useState } from 'react'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
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
  const notas = eventos.filter((evento) => evento.tipo === 'nota')

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
            <FormularioSalvar
              action={async (estado, formData) => {
                const r = await anotar(estado, formData)
                if (r.ok) setAberta(false)
                return r
              }}
              rotulo="Salvar anotação"
              /*
                O "Cancelar" entra como `dica` para ficar na **mesma linha** do
                Salvar. Ele era um botão solto embaixo do formulário, e a frase
                que ocupava este lugar empurrava os dois para linhas diferentes:
                sobrava um "Cancelar" sozinho, cortado na linha de baixo.
              */
              dica={
                <button
                  type="button"
                  onClick={() => setAberta(false)}
                  className="text-[11.5px] text-muted transition hover:text-primary"
                >
                  Cancelar
                </button>
              }
            >
              <textarea
                name="texto"
                autoFocus
                rows={3}
                maxLength={limite}
                placeholder="Ligou, pediu para retornar terça de manhã."
                className="app-field resize-y px-3 py-2.5 text-[12.5px] leading-5"
              />
            </FormularioSalvar>
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
