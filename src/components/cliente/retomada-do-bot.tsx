'use client'

import { useState } from 'react'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import { Dropdown } from '@/components/design/dropdown'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import {
  MENSAGEM_DE_RETOMADA_PADRAO,
  MINUTOS_DE_RETOMADA_PADRAO,
  MINUTOS_DE_RETOMADA_TETO,
  type ConfigDaConta,
} from '@/core/retomada'

/**
 * O que acontece com a conversa que ficou parada com uma pessoa.
 *
 * O defeito que ela conserta está contado no cabeçalho da página, e não aqui:
 * repetir a explicação dentro de um cartão logo abaixo dela foi o primeiro
 * desenho, e ler a mesma coisa duas vezes faz duvidar de que sejam a mesma
 * coisa.
 */

/**
 * Lista fechada com saída, que é diferente de lista fechada.
 *
 * Fechada porque "digite o prazo" sozinho não diz se o número é minuto ou hora,
 * e porque cinco opções resolvem quase todo caso real. Com saída porque
 * "quase todo" não é todo: quem atende em quinze minutos e quer quinze não pode
 * ser obrigado a escolher trinta, e o produto não tem como saber o expediente
 * de quem vai usá-lo.
 */
const PRAZOS = [
  { valor: '30', rotulo: '30 minutos' },
  { valor: '60', rotulo: '1 hora' },
  { valor: '120', rotulo: '2 horas', detalhe: 'o padrão' },
  { valor: '240', rotulo: '4 horas' },
  { valor: '480', rotulo: '8 horas' },
  { valor: '720', rotulo: '12 horas' },
  { valor: '1440', rotulo: '24 horas', detalhe: 'o teto da janela do WhatsApp' },
  { valor: 'livre', rotulo: 'Personalizar…', detalhe: 'escolher o tempo exato' },
]

const DA_LISTA = new Set(PRAZOS.map((p) => p.valor))

/**
 * Minutos viram "2 + horas" quando dividem certo, e continuam minutos quando
 * não dividem.
 *
 * Quem gravou 90 quer ver "90 minutos", e não "1,5 horas": a segunda forma
 * convida a arredondar um número que a pessoa escolheu de propósito.
 */
function separar(minutos: number): { quanto: number; unidade: 'minutos' | 'horas' } {
  return minutos >= 60 && minutos % 60 === 0
    ? { quanto: minutos / 60, unidade: 'horas' }
    : { quanto: minutos, unidade: 'minutos' }
}

export function RetomadaDoBotForm({
  inicial,
  salvar,
}: {
  inicial: ConfigDaConta
  salvar: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
}) {
  const guardado = inicial.minutos || MINUTOS_DE_RETOMADA_PADRAO
  const naLista = DA_LISTA.has(String(guardado))
  const partes = separar(guardado)

  const [ligada, setLigada] = useState(inicial.ativo)
  // `'livre'` quando o valor gravado não está na lista: quem salvou 45 minutos
  // precisa reabrir a tela vendo 45, e não o item mais próximo.
  const [escolha, setEscolha] = useState(naLista ? String(guardado) : 'livre')
  const [quanto, setQuanto] = useState(String(partes.quanto))
  const [unidade, setUnidade] = useState<'minutos' | 'horas'>(partes.unidade)
  const [mensagem, setMensagem] = useState(inicial.mensagem ?? MENSAGEM_DE_RETOMADA_PADRAO)

  const livre = escolha === 'livre'
  const minutos = livre ? Number(quanto || 0) * (unidade === 'horas' ? 60 : 1) : Number(escolha)
  const foraDoLimite = livre && (!Number.isInteger(minutos) || minutos < 1 || minutos > MINUTOS_DE_RETOMADA_TETO)

  return (
    <FormularioSalvar action={salvar} rotulo="Salvar retomada">
      {/* O interruptor e o prazo são estado do React. O que chega ao servidor
          são estes dois campos, já em minutos, para o servidor não precisar
          saber que existe uma escolha de unidade na tela. */}
      <input type="hidden" name="ativo" value={ligada ? 'on' : ''} />
      <input type="hidden" name="minutos" value={String(minutos)} />

      <LinhaLigaDesliga
        titulo="Devolver a conversa ao bot sozinho"
        descricao="Passado o prazo sem ninguém da equipe falar, o bot avisa e reassume."
        marcada={ligada}
        aoMudar={setLigada}
        ajuda={
          <AjudaDoCampo
            titulo="Devolver a conversa ao bot sozinho"
            secao="duvidas"
            texto="Sem isto, a conversa que foi para uma pessoa e ninguém fechou fica sem resposta automática para sempre."
            detalhes={
              <>
                <p>
                  O prazo conta a partir da <strong>última mensagem da equipe</strong>. Quem está
                  respondendo agora nunca é interrompido: cada mensagem enviada reinicia a
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
                  Um bloco de “falar com humano” pode ter prazo próprio, ou nunca voltar, e o que
                  ele escolher vence o daqui naquele caminho. Enquanto esta chave estiver
                  desligada, nenhuma conversa volta sozinha.
                </p>
              </>
            }
          />
        }
      />

      {ligada && (
        <div className="app-card mt-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-soft">
              Devolver ao bot depois de
            </span>
            <span className="mb-2 block text-[11.5px] leading-4 text-dim">
              sem nenhuma mensagem da equipe nesta conversa
            </span>
            <Dropdown
              rotuloAcessivel="Prazo para devolver a conversa ao bot"
              opcoes={PRAZOS}
              valor={escolha}
              aoMudar={setEscolha}
            />
          </label>

          {livre && (
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={unidade === 'horas' ? 24 : MINUTOS_DE_RETOMADA_TETO}
                value={quanto}
                onChange={(e) => setQuanto(e.target.value)}
                aria-label="Quanto tempo"
                className="app-field w-[88px] px-3 py-2 text-[13px]"
              />
              <div className="w-[150px]">
                <Dropdown
                  rotuloAcessivel="Minutos ou horas"
                  opcoes={[
                    { valor: 'minutos', rotulo: 'minutos' },
                    { valor: 'horas', rotulo: 'horas' },
                  ]}
                  valor={unidade}
                  aoMudar={(v) => setUnidade(v as 'minutos' | 'horas')}
                />
              </div>
              {/*
                O erro aparece ao lado do campo que o causou, e antes de
                salvar. O servidor recusa o mesmo valor, mas descobrir o limite
                depois de clicar em Salvar é descobrir tarde.
              */}
              {foraDoLimite && (
                <span className="text-[11.5px] leading-4 text-aviso">
                  entre 1 minuto e 24 horas
                </span>
              )}
            </div>
          )}

          <label className="mt-5 block">
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
          {minutos >= 720 && (
            <p className="mt-4 rounded-[8px] border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2.5 text-[11.5px] leading-5 text-aviso">
              Prazo longo: o WhatsApp só deixa mandar texto livre até 24h depois da{' '}
              <strong>última mensagem do cliente</strong>. Vencendo depois disso, a conversa volta
              ao bot mesmo assim, mas a frase acima não é entregue.
            </p>
          )}
        </div>
      )}
    </FormularioSalvar>
  )
}
