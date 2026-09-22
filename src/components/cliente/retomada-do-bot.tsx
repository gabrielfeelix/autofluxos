'use client'

import { useState } from 'react'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import { Dropdown } from '@/components/design/dropdown'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import {
  MENSAGEM_DE_RETOMADA_PADRAO,
  MINUTOS_DE_RETOMADA_PADRAO,
  type ConfigDaConta,
} from '@/core/retomada'

/**
 * O que acontece com a conversa que ficou parada com uma pessoa.
 *
 * **A tela conta o defeito antes de oferecer o conserto.** Quem chega aqui não
 * sabe que existe um jeito de o bot emudecer para sempre num contato: isso não
 * dá erro, não aparece em lista nenhuma e o sintoma chega semanas depois, pela
 * boca de um cliente que escreveu e ninguém respondeu. Um interruptor sem essa
 * explicação seria uma preferência sem motivo, e preferência sem motivo
 * ninguém liga.
 */

/**
 * Lista fechada, e pelo mesmo motivo escrito no prazo da pergunta: "quem digita
 * 7 numa caixa não sabe se são minutos ou horas".
 *
 * Começa em 30 minutos porque abaixo disso a retomada atropela atendimento de
 * verdade: gente almoça, atende no balcão, volta. O teto de 24h é a janela do
 * WhatsApp, e passado dele não há como avisar ninguém.
 */
const PRAZOS = [
  { valor: '30', rotulo: '30 minutos' },
  { valor: '60', rotulo: '1 hora' },
  { valor: '120', rotulo: '2 horas', detalhe: 'o padrão' },
  { valor: '240', rotulo: '4 horas' },
  { valor: '480', rotulo: '8 horas' },
  { valor: '720', rotulo: '12 horas' },
  { valor: '1440', rotulo: '24 horas', detalhe: 'o teto da janela do WhatsApp' },
]

export function RetomadaDoBotForm({
  inicial,
  salvar,
}: {
  inicial: ConfigDaConta
  salvar: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
}) {
  const [ligada, setLigada] = useState(inicial.ativo)
  const [minutos, setMinutos] = useState(String(inicial.minutos || MINUTOS_DE_RETOMADA_PADRAO))
  const [mensagem, setMensagem] = useState(inicial.mensagem ?? MENSAGEM_DE_RETOMADA_PADRAO)

  return (
    <FormularioSalvar action={salvar} rotulo="Salvar">
      {/* O interruptor do `LinhaLigaDesliga` é estado do React, não um
          `<input>`. O campo escondido é o que chega ao servidor. */}
      <input type="hidden" name="ativo" value={ligada ? 'on' : ''} />

      <section className="app-card mb-4 px-5 py-4">
        <p className="text-[13px] leading-6 text-muted">
          Quando o bot passa a conversa para uma pessoa, ele{' '}
          <strong className="text-soft">para de responder naquele contato</strong> e só volta se
          alguém clicar em “Religar o bot nesta conversa”, no Inbox.
        </p>
        <p className="mt-2 text-[13px] leading-6 text-muted">
          Se ninguém clicar, o bot fica mudo ali para sempre. A pessoa continua escrevendo, as
          mensagens continuam chegando no Inbox, e nada responde. Não aparece erro em lugar
          nenhum.
        </p>
      </section>

      <div className="app-card px-5 py-1.5">
        <LinhaLigaDesliga
          titulo="Devolver a conversa ao bot sozinho"
          descricao="Passado o prazo sem ninguém da equipe falar, o bot avisa e reassume."
          marcada={ligada}
          aoMudar={setLigada}
          ajuda={
            <AjudaDoCampo
              titulo="Devolver a conversa ao bot sozinho"
              secao="duvidas"
              texto="Sem isto, uma conversa que foi para uma pessoa e ninguém fechou fica sem resposta automática para sempre."
              detalhes={
                <>
                  <p>
                    O prazo conta a partir da <strong>última mensagem da equipe</strong>. Quem
                    está respondendo agora nunca é interrompido: cada mensagem enviada reinicia a
                    contagem, inclusive as mandadas do celular.
                  </p>
                  <p>
                    Mensagem do cliente <strong>não</strong> reinicia o prazo. Ela é o sintoma:
                    alguém escrevendo e ninguém respondendo é exatamente o que este prazo existe
                    para resolver.
                  </p>
                  <p>
                    Contato com o bot pausado (“Pausar o bot nesta conversa”) fica de fora. Isso é
                    escolha explícita de alguém, e nenhum prazo desfaz escolha explícita.
                  </p>
                  <p>
                    Um bloco de “falar com humano” pode ter prazo próprio, ou nunca voltar, e o
                    que ele escolher vence o daqui naquele caminho. Enquanto esta chave estiver
                    desligada, nenhum bloco volta sozinho.
                  </p>
                </>
              }
            />
          }
        />
      </div>

      {ligada && (
        <>
          <div className="app-card mt-4 px-5 py-4">
            <span className="mb-1.5 block text-[12.5px] font-bold text-soft">
              Devolver ao bot depois de
            </span>
            <span className="mb-2 block text-[11.5px] leading-4 text-dim">
              sem nenhuma mensagem da equipe nesta conversa
            </span>
            <Dropdown
              rotuloAcessivel="Prazo para devolver a conversa ao bot"
              opcoes={PRAZOS}
              valor={minutos}
              aoMudar={setMinutos}
            />
            <input type="hidden" name="minutos" value={minutos} />
          </div>

          <label className="app-card mt-4 block px-5 py-4">
            <span className="mb-1.5 block text-[12.5px] font-bold text-soft">
              O que o bot diz ao voltar
            </span>
            <span className="mb-2 block text-[11.5px] leading-4 text-dim">
              Precisa dizer as duas coisas: que o bot voltou, e que a pessoa não foi esquecida.
            </span>
            <textarea
              name="mensagem"
              rows={3}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="app-field resize-y px-3.5 py-3 text-[13px] leading-6"
            />
            {mensagem.trim() !== MENSAGEM_DE_RETOMADA_PADRAO && (
              <button
                type="button"
                onClick={() => setMensagem(MENSAGEM_DE_RETOMADA_PADRAO)}
                className="mt-2 text-[11.5px] text-muted underline underline-offset-2 transition hover:text-primary"
              >
                voltar ao texto sugerido
              </button>
            )}
          </label>

          {/*
            **O aviso que só apareceria em produção.**

            A janela do WhatsApp fecha 24h depois da última mensagem *dela*, e
            este prazo conta da última mensagem *da equipe*, que costuma vir
            depois. Perto do teto, o prazo vence com a janela já fechada: a
            conversa volta ao bot do mesmo jeito (é o que interessa), mas a
            frase acima não chega, e ninguém entende por quê.
          */}
          {Number(minutos) >= 720 && (
            <p className="mt-3 rounded-[8px] border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2.5 text-[11.5px] leading-5 text-aviso">
              Prazo longo: o WhatsApp só deixa mandar texto livre até 24h depois da{' '}
              <strong>última mensagem do cliente</strong>. Vencendo depois disso, a conversa volta
              ao bot mesmo assim, mas a frase acima não é entregue.
            </p>
          )}
        </>
      )}
    </FormularioSalvar>
  )
}
