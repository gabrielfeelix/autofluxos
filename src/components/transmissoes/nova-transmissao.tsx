'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { cabemHoje, podeTransmitir, saiNoDiaDeHoje } from '@/core/disparo'
import { camposDoCorpoDaMeta, previa } from '@/core/modelos-prontos'
import {
  acaoCriarTransmissaoPorEtiqueta,
  acaoPublicosPossiveis,
} from '@/server/acoes-transmissoes'
import type { Etiqueta } from '@/server/repos/etiquetas'
import type { Template } from '@/server/repos/templates'

/**
 * Criar uma transmissão: modelo, público, quando.
 *
 * ---------------------------------------------------------------------------
 * O aviso do teto vem ANTES do clique
 * ---------------------------------------------------------------------------
 *
 * `podeTransmitir` é puro, então esta tela o chama a cada escolha e mostra o
 * recado enquanto a pessoa ainda está decidindo. Descobrir que a lista passa
 * do limite do dia **depois** de mandar não é aviso: é notícia. O consumo de
 * hoje (`enviadasHoje`) é o real, contado pela página.
 *
 * O servidor confere de novo em `acaoCriarTransmissao`, e isso não é
 * duplicação, o limite pode ter sido consumido por outra campanha entre a
 * abertura desta tela e o clique.
 *
 * ---------------------------------------------------------------------------
 * `{{1}}` não aparece aqui, como não aparece em lugar nenhum
 * ---------------------------------------------------------------------------
 *
 * O corpo gravado é o da Meta, com números. `camposDoCorpoDaMeta` devolve o
 * campo em português de cada buraco, e é o rótulo dele que a pessoa lê. Quando
 * não dá para saber, a pergunta é genérica ("O que entra aqui"), nunca o
 * número da variável.
 *
 * O campo do **nome** não é perguntado: ele sai do contato, um por pessoa. É a
 * diferença entre uma transmissão e 400.
 */

/** O teto de conversas por dia de quem está começando. A Meta não o expõe por API. */
const LIMITE_PADRAO = 250

export function NovaTransmissao({
  clienteId,
  templates,
  enviadasHoje,
}: {
  clienteId: string
  templates: Template[]
  /** Quanto do limite de hoje já foi gasto (`enviadasHojePelaConta`). */
  enviadasHoje: number
}) {
  const [aberto, setAberto] = useState(false)
  const aprovados = templates.filter((t) => t.status === 'aprovado')

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        /*
         * Fica **desabilitado** e não escondido quando não há modelo aprovado.
         * Botão que some deixa a tela sem saída e sem explicação, foi o erro
         * do "+ Campanha" na tela de Automações.
         */
        disabled={aprovados.length === 0}
        title={
          aprovados.length === 0
            ? 'Só dá para transmitir com um modelo aprovado pela Meta.'
            : undefined
        }
        className="app-primary-button shrink-0 px-[18px] py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Nova transmissão
      </button>

      {aberto && (
        <Formulario
          clienteId={clienteId}
          aprovados={aprovados}
          enviadasHoje={enviadasHoje}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  )
}

function Formulario({
  clienteId,
  aprovados,
  enviadasHoje,
  aoFechar,
}: {
  clienteId: string
  aprovados: Template[]
  enviadasHoje: number
  aoFechar: () => void
}) {
  const router = useRouter()
  const [salvando, comecar] = useTransition()

  const [nome, setNome] = useState('')
  const [templateId, setTemplateId] = useState(aprovados[0]?.id ?? '')
  const [etiquetaId, setEtiquetaId] = useState('')
  const [quando, setQuando] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)

  const [publicos, setPublicos] = useState<Etiqueta[] | null>(null)

  /*
   * Os públicos são buscados ao ABRIR, como a biblioteca da Meta em
   * `NovoModelo`: a maioria das visitas à lista de transmissões não vai criar
   * nenhuma, e contar contato de toda etiqueta em cada visita seria pagar por
   * uma tela que ninguém abriu.
   */
  useEffect(() => {
    let vivo = true
    void acaoPublicosPossiveis(clienteId)
      .then((lista) => {
        if (!vivo) return
        setPublicos(lista)
        setEtiquetaId((atual) => atual || (lista[0]?.id ?? ''))
      })
      .catch(() => {
        if (vivo) setPublicos([])
      })
    return () => {
      vivo = false
    }
  }, [clienteId])

  const template = aprovados.find((t) => t.id === templateId)
  const corpo = template?.componentes.corpo ?? ''
  const campos = camposDoCorpoDaMeta(corpo)
  const publico = publicos?.find((e) => e.id === etiquetaId)
  const tamanho = publico?.contatos ?? 0

  /*
   * O veredito, recalculado a cada escolha. É o que põe "cabem 70 hoje" na
   * tela enquanto a pessoa decide, e não depois. Marcada para outro dia, o
   * que saiu hoje não pesa.
   */
  const jaEnviadas = saiNoDiaDeHoje(quando ? new Date(quando).toISOString() : null)
    ? enviadasHoje
    : 0
  const cabem = cabemHoje(LIMITE_PADRAO, jaEnviadas)
  const veredito = podeTransmitir({
    statusDoTemplate: template?.status ?? 'pendente',
    publico: tamanho,
    limiteDiario: LIMITE_PADRAO,
    jaEnviadasHoje: jaEnviadas,
  })

  /** Os buracos que a pessoa precisa preencher, o do nome sai do contato. */
  const aPerguntar = campos
    .map((campo, i) => ({ campo, numero: i + 1 }))
    .filter((item) => !item.campo?.automatico)

  const faltaAlgum = aPerguntar.some((item) => !(valores[String(item.numero)] ?? '').trim())

  function enviar() {
    setErro(null)

    if (!nome.trim()) return setErro('Dê um nome para esta transmissão.')
    if (!templateId) return setErro('Escolha o modelo.')
    if (!etiquetaId) return setErro('Escolha para quem vai.')
    if (faltaAlgum) return setErro('Preencha os campos da mensagem.')

    comecar(async () => {
      /*
       * `{nome}` no lugar do campo automático: é o marcador que
       * `valoresPara()` troca pelo nome de cada contato na hora do envio. Sem
       * ele, os 400 receberiam o mesmo nome.
       */
      const parametros: Record<string, string> = {}
      campos.forEach((campo, i) => {
        const numero = String(i + 1)
        parametros[numero] = campo?.automatico ? '{nome}' : (valores[numero] ?? '')
      })

      const r = await acaoCriarTransmissaoPorEtiqueta(clienteId, {
        nome: nome.trim(),
        templateId,
        etiquetaId,
        parametros,
        // Vazio quer dizer "manda agora", e o motor entende nulo assim.
        quando: quando ? new Date(quando).toISOString() : null,
        limiteDiario: LIMITE_PADRAO,
      })

      if (!r.ok) {
        setErro(r.erro ?? 'Não deu para criar a transmissão.')
        return
      }

      aoFechar()
      router.refresh()
    })
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Nova transmissão"
      descricao="Um modelo aprovado, um público e um horário."
      largura={520}
    >
      <div className="flex flex-col gap-4">
        <Campo rotulo="Nome desta transmissão">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Lembrete de outubro"
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
          <Dica>Só para você achar depois. O cliente não vê este nome.</Dica>
        </Campo>

        <Campo rotulo="Mensagem">
          <Dropdown
            opcoes={aprovados.map((t) => ({
              valor: t.id,
              rotulo: t.nome.replace(/_/g, ' '),
              detalhe: previa(t.componentes.corpo).slice(0, 60),
            }))}
            valor={templateId}
            aoMudar={(v) => {
              setTemplateId(v)
              // Os valores são por modelo: guardá-los ao trocar mandaria a data
              // de um lembrete no lugar do código de outro.
              setValores({})
            }}
            rotuloAcessivel="Modelo da mensagem"
          />
        </Campo>

        {corpo && (
          /*
            A prévia com valores de gente, não com `{{1}}`. É o que faz a pessoa
            perceber que faltou vírgula, e é a única representação da mensagem
            que ela vai ver antes de 400 pessoas a receberem.
          */
          <p className="rounded-[10px] bg-line/40 px-3 py-2.5 text-[12.5px] leading-5 text-dim">
            {previa(comValores(corpo, campos, valores))}
          </p>
        )}

        {aPerguntar.map((item) => (
          <Campo
            key={item.numero}
            rotulo={item.campo?.rotulo ?? 'O que entra aqui'}
          >
            <input
              value={valores[String(item.numero)] ?? ''}
              onChange={(e) =>
                setValores((atual) => ({ ...atual, [String(item.numero)]: e.target.value }))
              }
              placeholder={item.campo?.exemplo ?? ''}
              className="app-field px-[13px] py-[11px] text-[13.5px]"
            />
            <Dica>Vale igual para todo mundo desta transmissão.</Dica>
          </Campo>
        ))}

        <Campo rotulo="Para quem">
          {publicos === null ? (
            <p className="text-[12.5px] text-dim">Carregando os públicos…</p>
          ) : publicos.length === 0 ? (
            <p className="rounded-[10px] bg-amber-500/[0.08] px-3 py-2.5 text-[12.5px] leading-5 text-dim">
              Nenhuma etiqueta tem contato ainda. Marque contatos com uma etiqueta no Inbox para
              poder transmitir para eles.
            </p>
          ) : (
            <Dropdown
              opcoes={publicos.map((e) => ({
                valor: e.id,
                rotulo: e.nome,
                detalhe: `${e.contatos} ${e.contatos === 1 ? 'contato' : 'contatos'}`,
              }))}
              valor={etiquetaId}
              aoMudar={setEtiquetaId}
              rotuloAcessivel="Público da transmissão"
            />
          )}
        </Campo>

        <Campo rotulo="Quando">
          <input
            type="datetime-local"
            value={quando}
            onChange={(e) => setQuando(e.target.value)}
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
          <Dica>
            Deixe vazio para começar agora. A saída leva alguns minutos: o ritmo é limitado de
            propósito, para a campanha não comer a cota de quem está conversando.
          </Dica>
        </Campo>

        {/*
          O limite do dia, sempre antes do clique: quanto cabe, ou em quanto a
          lista passa. O modelo não aprovado tem o recado dele.
        */}
        {tamanho > 0 && template?.status === 'aprovado' && (
          <p
            className={`rounded-[10px] px-3 py-2.5 text-[12.5px] leading-5 ${
              tamanho <= cabem
                ? 'bg-line/40 text-dim'
                : 'bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            {tamanho <= cabem
              ? `Cabem ${cabem} hoje. Esta lista tem ${tamanho}.`
              : cabem === 0
                ? `O limite de ${LIMITE_PADRAO} de hoje já foi usado. Escolha um horário a partir de amanhã.`
                : `Passa do limite de hoje em ${tamanho - cabem}. Hoje já saíram ${jaEnviadas} de ${LIMITE_PADRAO}.`}
          </p>
        )}
        {veredito.recado && tamanho > 0 && template?.status !== 'aprovado' && (
          <p className="rounded-[10px] bg-red-500/10 px-3 py-2.5 text-[12.5px] leading-5 text-red-700 dark:text-red-300">
            {veredito.recado}
          </p>
        )}

        {erro && (
          <p className="rounded-[10px] bg-red-500/10 px-3 py-2.5 text-[12.5px] leading-5 text-red-700 dark:text-red-300">
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={aoFechar}
            className="text-[12.5px] font-semibold text-dim hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={salvando || !veredito.pode || publicos === null}
            className="app-primary-button px-[18px] py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando
              ? 'Criando…'
              : tamanho > 0
                ? `Transmitir para ${tamanho}`
                : 'Transmitir'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * O corpo com o que a pessoa digitou, para a prévia.
 *
 * O que ela ainda não preencheu vira o marcador em português (`{data}`), que
 * `previa()` então troca pelo exemplo. O número da Meta não sobrevive a este
 * caminho, que é o ponto.
 */
function comValores(
  corpo: string,
  campos: (ReturnType<typeof camposDoCorpoDaMeta>[number])[],
  valores: Record<string, string>,
): string {
  let saida = corpo
  campos.forEach((campo, i) => {
    const numero = String(i + 1)
    const digitado = (valores[numero] ?? '').trim()
    const troca = digitado || (campo ? `{${campo.id}}` : (campo ?? '') || '…')
    saida = saida.replaceAll(`{{${numero}}}`, troca)
  })
  return saida
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold">{rotulo}</span>
      {children}
    </label>
  )
}

function Dica({ children }: { children: React.ReactNode }) {
  return <span className="text-[11.5px] leading-4 text-dim">{children}</span>
}
