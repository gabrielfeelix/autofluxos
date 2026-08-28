'use client'

import { presetDoBloco } from '@/core/presets'
import { RealceDeVariaveis } from './realce-de-variaveis'
import { CORES, ICONES, NOMES } from '@/core/flow/blocos'
import { partesDaMensagem } from '@/core/flow/mensagem'
import type { No, NoMensagem, TipoNo } from '@/core/flow/schema'

/**
 * O que o bloco tem dentro, sem precisar abri-lo.
 *
 * O card do desenho **corta**: `line-clamp-3` no texto e `truncate` em quase
 * tudo mais. Isso é certo — card que cresce vira parede —, mas o preço aparece
 * na automação grande: para conferir a segunda opção de uma pergunta, o que a
 * chamada guarda ou o que a IA foi instruída a fazer, é preciso clicar bloco a
 * bloco, e cada clique troca o painel da direita e faz perder o lugar.
 *
 * Veio de quem monta fluxo com cliente na frente, conferindo um desenho pronto
 * — que é leitura, não edição. Passar o olho tem que ser passar o mouse.
 *
 * **Só lê.** Nada aqui edita, nada aqui seleciona, e o painel não recebe clique
 * (`pointer-events-none`): ele não pode roubar o gesto de quem está desenhando.
 */

/** Uma linha da prévia: o rótulo à esquerda, o valor por extenso à direita. */
type Detalhe = { rotulo: string; valor: string; tom?: 'aviso' }

const OPERADOR: Record<string, string> = {
  igual: 'é igual a',
  diferente: 'é diferente de',
  contem: 'contém',
  vazio: 'está vazia',
  preenchido: 'está preenchida',
}

const MIDIA: Record<string, string> = {
  imagem: 'Foto',
  video: 'Vídeo',
  documento: 'Documento',
  audio: 'Áudio',
}

const AO_FALHAR: Record<string, string> = {
  humano: 'se falhar, chama uma pessoa',
  seguir: 'se falhar, a conversa segue',
  encerrar: 'se falhar, encerra a conversa',
}

function texto(valor: string | undefined, vazio = '—'): string {
  const limpo = (valor ?? '').trim()
  return limpo === '' ? vazio : limpo
}

/**
 * O conteúdo do bloco em linhas legíveis.
 *
 * Puro e exaustivo por tipo: o `switch` sem `default` é o que faz o compilador
 * apontar aqui quando um bloco novo nascer — o mesmo contrato que o resto do
 * editor já tem.
 */
export function detalhesDoBloco(no: No): Detalhe[] {
  switch (no.type) {
    case 'mensagem': {
      const partes = partesDaMensagem(no as NoMensagem)
      return partes.map((parte) => {
        switch (parte.tipo) {
          case 'texto':
            return { rotulo: 'Manda', valor: texto(parte.texto, '(sem texto)') }
          case 'midia':
            return {
              rotulo: MIDIA[parte.midia] ?? 'Arquivo',
              valor: [texto(parte.url), parte.legenda?.trim(), parte.nomeArquivo?.trim()]
                .filter(Boolean)
                .join('\n'),
            }
          case 'atraso':
            return { rotulo: 'Espera', valor: `digitando por ${parte.segundos}s` }
          case 'salvar':
            return {
              rotulo: 'Guarda',
              valor: `${texto(parte.campo, '(sem nome)')} = ${texto(parte.valor)}`,
            }
          default:
            return { rotulo: 'Desliga', valor: 'o bot para de responder este contato' }
        }
      })
    }

    case 'midia':
      return [
        { rotulo: MIDIA[no.data.midia] ?? 'Arquivo', valor: texto(no.data.url, '(sem endereço)') },
        ...(no.data.legenda ? [{ rotulo: 'Legenda', valor: no.data.legenda }] : []),
        ...(no.data.nomeArquivo ? [{ rotulo: 'Nome', valor: no.data.nomeArquivo }] : []),
      ]

    case 'pergunta': {
      const linhas: Detalhe[] = [{ rotulo: 'Pergunta', valor: texto(no.data.texto, '(sem texto)') }]
      const dinamica = (no.data.opcoesDe ?? '') !== ''

      if (dinamica) {
        linhas.push({ rotulo: 'Opções', valor: `a lista de {{${no.data.opcoesDe}}}` })
        if (no.data.valoresDe) {
          linhas.push({ rotulo: 'Valor de cada', valor: `{{${no.data.valoresDe}}}` })
        }
      } else if (no.data.opcoes.length > 0) {
        linhas.push({
          rotulo: `Opções (${no.data.opcoes.length})`,
          valor: no.data.opcoes
            .map((o, i) => `${i + 1}. ${o.rotulo}${o.valor ? `  →  ${o.valor}` : ''}`)
            .join('\n'),
        })
      } else {
        linhas.push({ rotulo: 'Resposta', valor: 'livre, digitada pela pessoa' })
      }

      if (no.data.formato) linhas.push({ rotulo: 'Precisa ser', valor: no.data.formato })
      if (no.data.salvarEm) linhas.push({ rotulo: 'Guarda em', valor: `{{${no.data.salvarEm}}}` })
      if (no.data.salvarValorEm) {
        linhas.push({ rotulo: 'Guarda o valor em', valor: `{{${no.data.salvarValorEm}}}` })
      }
      if (no.data.salvarPadraoEm) {
        linhas.push({ rotulo: 'Guarda padronizado em', valor: `{{${no.data.salvarPadraoEm}}}` })
      }
      if (no.data.mensagemDeErro) {
        linhas.push({ rotulo: 'Se não entender', valor: no.data.mensagemDeErro })
      }
      if (no.data.aceitaMidia) {
        linhas.push({
          rotulo: 'Aceita arquivo',
          valor: no.data.salvarMidiaEm
            ? `sim — guarda em {{${no.data.salvarMidiaEm}}}`
            : 'sim, e sai pela saída “mandou arquivo”',
        })
      }
      if (no.data.timeoutMinutos) {
        linhas.push({ rotulo: 'Desiste em', valor: `${no.data.timeoutMinutos} min sem resposta` })
      }
      return linhas
    }

    case 'condicao':
      return [
        {
          rotulo: 'Se',
          valor: `{{${no.data.variavel}}} ${OPERADOR[no.data.operador] ?? no.data.operador}${
            no.data.operador === 'vazio' || no.data.operador === 'preenchido'
              ? ''
              : ` "${no.data.valor}"`
          }`,
        },
      ]

    case 'salvar-campo':
      return [
        { rotulo: 'Guarda', valor: `{{${no.data.campo}}}` },
        { rotulo: 'Com o valor', valor: texto(no.data.valor) },
      ]

    case 'ia':
      return [
        { rotulo: 'Instrução', valor: texto(no.data.instrucao, '(sem instrução)') },
        ...(no.data.salvarEm
          ? [{ rotulo: 'Guarda em', valor: `{{${no.data.salvarEm}}}` }]
          : []),
      ]

    case 'handoff': {
      const mensagens = no.data.mensagens ?? [no.data.mensagem]
      return [
        { rotulo: 'Motivo', valor: texto(no.data.motivo) },
        { rotulo: 'Avisa', valor: mensagens.filter((m) => m.trim() !== '').join('\n') },
      ]
    }

    case 'http': {
      const preset = presetDoBloco(no.data)
      const faltaCredencial =
        preset !== undefined &&
        preset.credencial !== 'nenhuma' &&
        (no.data.conexaoId ?? '') === ''

      return [
        ...(preset ? [{ rotulo: 'Integração', valor: preset.nome }] : []),
        ...(faltaCredencial
          ? [{ rotulo: 'Credencial', valor: 'falta escolher — o bloco não roda assim', tom: 'aviso' as const }]
          : []),
        { rotulo: 'Chama', valor: `${no.data.metodo} ${texto(no.data.url, '(sem endereço)')}` },
        ...(no.data.cabecalhos.length > 0
          ? [{ rotulo: 'Cabeçalhos', valor: no.data.cabecalhos.map((c) => c.chave).join(', ') }]
          : []),
        ...(no.data.corpo.trim() !== '' ? [{ rotulo: 'Manda', valor: no.data.corpo }] : []),
        ...(no.data.mapear.length > 0
          ? [
              {
                rotulo: `Guarda (${no.data.mapear.length})`,
                valor: no.data.mapear
                  .map(
                    (m) =>
                      `{{${m.variavel || '?'}}}  ←  ${m.caminho || '?'}${
                        m.quantos ? '  (quantos itens)' : m.formato ? `  (como ${m.formato})` : ''
                      }`,
                  )
                  .join('\n'),
              },
            ]
          : [{ rotulo: 'Guarda', valor: 'nada — a resposta é descartada', tom: 'aviso' as const }]),
        { rotulo: 'Se der erro', valor: AO_FALHAR[no.data.aoFalhar] ?? no.data.aoFalhar },
      ]
    }

    case 'etapa':
      return [
        { rotulo: 'Quadro', valor: texto(no.data.quadroId, '(não escolhido)') },
        { rotulo: 'Etapa', valor: texto(no.data.colunaId, '(não escolhida)') },
      ]

    case 'ir-fluxo':
      return [
        {
          rotulo: 'Continua em',
          valor: texto(no.data.fluxoId, '(automação não escolhida)'),
        },
      ]

    case 'voltar':
      return [
        { rotulo: 'Volta para', valor: texto(no.data.destino, 'o início desta automação') },
        ...(no.data.rotulo ? [{ rotulo: 'Botão', valor: no.data.rotulo }] : []),
      ]
  }
}

/**
 * O painel flutuante.
 *
 * Posicionado a partir do canto do card e **preso à janela**: perto da borda de
 * baixo ele sobe, perto da direita ele vai para a esquerda do bloco. Prévia que
 * abre metade fora da tela obriga a arrastar o canvas para ler — e aí clicar no
 * bloco teria sido mais rápido, que é justamente o que ela veio evitar.
 */
export function PreviaDoBloco({
  no,
  x,
  y,
}: {
  no: No
  /** Canto superior direito do card, em coordenadas de tela. */
  x: number
  y: number
}) {
  const detalhes = detalhesDoBloco(no)
  const LARGURA = 300
  const ALTURA_MAX = 340

  const cabeNaDireita = typeof window === 'undefined' || x + LARGURA + 24 < window.innerWidth
  const esquerda = cabeNaDireita ? x + 14 : Math.max(8, x - LARGURA - 28)
  const topo =
    typeof window === 'undefined'
      ? y
      : Math.min(Math.max(8, y), Math.max(8, window.innerHeight - ALTURA_MAX - 8))

  return (
    <div
      className={`pointer-events-none fixed z-50 overflow-hidden rounded-xl border bg-[#0b1018]/95 shadow-[0_18px_40px_rgba(0,0,0,.55)] backdrop-blur-sm ${CORES[no.type as TipoNo]}`}
      style={{ left: esquerda, top: topo, width: LARGURA, maxHeight: ALTURA_MAX }}
    >
      <p className="flex items-center gap-1.5 border-b border-white/10 px-3 py-1.5 text-[10.5px] tracking-wide text-dim uppercase">
        <span aria-hidden>{ICONES[no.type as TipoNo]}</span>
        {NOMES[no.type as TipoNo]}
      </p>

      <div
        className="flex flex-col gap-2 overflow-y-auto px-3 py-2.5"
        style={{ maxHeight: ALTURA_MAX - 30 }}
      >
        {detalhes.map((detalhe, i) => (
          <div key={i}>
            <p className="text-[9.5px] tracking-wide text-dim uppercase">{detalhe.rotulo}</p>
            {/* O mesmo realce do campo e do card: a prévia é leitura, e é onde
                se confere o texto inteiro sem corte — se a chave simples não
                estivesse vermelha aqui, o único lugar que mostra a frase toda
                seria o único que esconde o erro. Aqui sobra espaço. */}
            <p
              className={`mt-0.5 text-[12px] leading-[1.45] whitespace-pre-wrap ${
                detalhe.tom === 'aviso' ? 'text-amber-200/85' : 'text-soft'
              }`}
            >
              <RealceDeVariaveis texto={detalhe.valor} />
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
