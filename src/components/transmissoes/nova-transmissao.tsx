'use client'

import { emReais, TARIFA_DE_SERVICO_BR, tarifaDoModelo } from '@/core/franquia-da-meta'
import { modeloComoTexto } from '@/core/templates'
import { Alternador } from '@/components/design/alternador'
import { Interruptor } from '@/components/design/interruptor'
import { tituloDoModelo } from '@/core/titulo-da-biblioteca'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { cabemHoje, podeTransmitir, saiNoDiaDeHoje } from '@/core/disparo'
import { camposDoCorpoDaMeta, previa } from '@/core/modelos-prontos'
import {
  acaoCriarTransmissaoParaPublico,
  acaoJanelaDoPublico,
  acaoPublicosPossiveis,
} from '@/server/acoes-transmissoes'
import type { PublicoDaTransmissao, PublicoPossivel } from '@/server/acoes-transmissoes'
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
        className="botao-primario botao-md shrink-0"
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

function chaveDoPublico(p: PublicoDaTransmissao): string {
  return `${p.tipo}:${p.id}`
}

function publicoDaChave(chave: string): PublicoDaTransmissao | null {
  const [tipo, id] = chave.split(':')
  return (tipo === 'etiqueta' || tipo === 'segmento') && id ? { tipo, id } : null
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
  /** `etiqueta:<id>` ou `segmento:<id>`: o valor do seletor de público. */
  const [publicoId, setPublicoId] = useState('')
  const [quando, setQuando] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)

  const [publicos, setPublicos] = useState<PublicoPossivel[] | null>(null)
  const [comumNaJanela, setComumNaJanela] = useState(true)
  const [ritmo, setRitmo] = useState<'tudo' | 'aos-poucos'>('tudo')
  const [porHora, setPorHora] = useState('100')
  const [janela, setJanela] = useState<{ publicoId: string; naJanela: number } | null>(null)

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
        setPublicoId((atual) => atual || (lista[0] ? chaveDoPublico(lista[0]) : ''))
      })
      .catch(() => {
        if (vivo) setPublicos([])
      })
    return () => {
      vivo = false
    }
  }, [clienteId])

  /*
   * Quantos do público estão na janela de 24h, para a economia aparecer em
   * número antes do clique. Lido de novo a cada troca de público.
   */
  useEffect(() => {
    const escolhido = publicoDaChave(publicoId)
    if (!escolhido) return
    let vivo = true
    void acaoJanelaDoPublico(clienteId, escolhido)
      .then((r) => {
        if (vivo && r) setJanela({ publicoId, naJanela: r.naJanela })
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [clienteId, publicoId])

  const template = aprovados.find((t) => t.id === templateId)
  const corpo = template?.componentes.corpo ?? ''
  const campos = camposDoCorpoDaMeta(corpo)
  const publico = publicos?.find((p) => chaveDoPublico(p) === publicoId)
  const tamanho = publico?.contatos ?? 0
  // O modelo vira mensagem comum sem perder nada? Foto e resposta rápida não.
  const viraTexto = template ? modeloComoTexto(template.componentes, []) !== null : false
  const naJanelaAgora = janela?.publicoId === publicoId ? Math.min(janela.naJanela, tamanho) : null
  const comoTexto = comumNaJanela && viraTexto ? (naJanelaAgora ?? 0) : 0
  const porHoraNumero = Number.parseInt(porHora, 10)

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
    const escolhido = publicoDaChave(publicoId)
    if (!escolhido) return setErro('Escolha para quem vai.')
    if (faltaAlgum) return setErro('Preencha os campos da mensagem.')
    if (ritmo === 'aos-poucos' && !(porHoraNumero >= 1)) return setErro('Diga quantas mensagens por hora, no mínimo 1.')

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

      const r = await acaoCriarTransmissaoParaPublico(clienteId, {
        nome: nome.trim(),
        templateId,
        publico: escolhido,
        parametros,
        // Vazio quer dizer "manda agora", e o motor entende nulo assim.
        quando: quando ? new Date(quando).toISOString() : null,
        limiteDiario: LIMITE_PADRAO,
        textoLivreNaJanela: comumNaJanela,
        porHora: ritmo === 'aos-poucos' ? porHoraNumero : null,
      })

      if (!r.ok) {
        setErro(r.erro ?? 'Não foi possível criar a transmissão.')
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
              rotulo: tituloDoModelo(t.nome),
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
              Nenhuma etiqueta nem segmento tem contato ainda. Marque contatos com uma etiqueta
              no Inbox, ou salve um segmento em Contatos, para poder transmitir para eles.
            </p>
          ) : (
            <Dropdown
              opcoes={publicos.map((p) => ({
                valor: chaveDoPublico(p),
                rotulo: p.nome,
                detalhe: `${p.tipo === 'segmento' ? 'Segmento' : 'Etiqueta'} · ${p.contatos} ${p.contatos === 1 ? 'contato' : 'contatos'}`,
              }))}
              valor={publicoId}
              aoMudar={setPublicoId}
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

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Ritmo</span>
          <Alternador
            rotulo="Ritmo da transmissão"
            opcoes={[
              { chave: 'tudo', rotulo: 'Tudo de uma vez' },
              { chave: 'aos-poucos', rotulo: 'Aos poucos' },
            ]}
            ativa={ritmo}
            aoEscolher={setRitmo}
            className="self-start"
          />
          {ritmo === 'aos-poucos' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={porHora}
                onChange={(e) => setPorHora(e.target.value)}
                aria-label="Mensagens por hora"
                // `app-field` ocupa a largura toda; o número cabe em 96px.
                style={{ width: 96 }}
                className="app-field px-[13px] py-[9px] text-[13.5px] tabular-nums"
              />
              <span className="whitespace-nowrap text-[12.5px] text-soft">mensagens por hora</span>
            </div>
          )}
          <Dica>
            {ritmo === 'aos-poucos'
              ? 'Só no horário de atendimento da conta (das 8h às 20h, se ele não estiver configurado). As respostas chegam num ritmo que a equipe acompanha.'
              : 'Sai o mais rápido que o limite seguro do número permite.'}
          </Dica>
        </div>

        <div className="flex items-start gap-3 rounded-[10px] border border-line px-3.5 py-3">
          <Interruptor
            marcada={comumNaJanela && viraTexto}
            aoMudar={setComumNaJanela}
            desabilitada={!viraTexto}
            rotuloAcessivel="Mensagem comum para quem conversou nas últimas 24 horas"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[12.5px] font-semibold">Mensagem comum para quem conversou nas últimas 24h</span>
            <Dica>
              {!viraTexto
                ? 'Este modelo tem foto, botão de resposta ou mais de um botão, então vai sempre como modelo.'
                : naJanelaAgora === null
                  ? `Custa ${emReais(TARIFA_DE_SERVICO_BR)} por mensagem, e as 1.000 primeiras do mês são grátis.`
                  : naJanelaAgora === 0
                    ? 'Ninguém deste público conversou nas últimas 24h. Todos recebem o modelo.'
                    : `${naJanelaAgora} de ${tamanho} estão nessa janela agora. Para eles a mensagem custa ${emReais(TARIFA_DE_SERVICO_BR)}, e as 1.000 primeiras do mês são grátis.`}
            </Dica>
          </div>
        </div>

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
              ? `Cabem ${cabem} hoje. Esta lista tem ${tamanho}. A Meta cobra cerca de ${emReais((tamanho - comoTexto) * tarifaDoModelo(template.categoria) + comoTexto * TARIFA_DE_SERVICO_BR)}${comoTexto > 0 ? `, com ${comoTexto} como mensagem comum` : ` (${emReais(tarifaDoModelo(template.categoria))} por envio)`}.`
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
            className="botao-primario botao-md"
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
