import { z } from 'zod'
import { taxaDeAutomacao } from '@/core/desfecho-da-conversa'
import { pode } from '@/core/permissoes'
import { filtroDoRecorte, lerRecorte, recortesPossiveis } from '@/core/recorte-da-analise'
import { completarDias, hojeEmSaoPaulo, lerPeriodo } from '@/core/relatorios'
import { celulaCsv, nomeDoArquivo } from '@/server/csv'
import { exigirCapacidade, filtroDoAcesso, recusou } from '@/server/permissoes'
import { acharCliente } from '@/server/repos/clientes'
import { atendimentosPorPessoa, responsaveisDoEscopo, serieDoPeriodo, totaisDoPeriodo } from '@/server/repos/relatorios'
import { membrosDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

/**
 * O relatório de atendimento como planilha, do período que está na tela.
 *
 * **Mesmos números, mesmas funções.** O período sai de `lerPeriodo` com os
 * parâmetros da tela, e as somas de `totaisDoPeriodo` e companhia: uma
 * planilha que discorda da tela por um dia de fuso é pior que nenhuma.
 *
 * Três partes num arquivo só, separadas por linha em branco: um dia por linha,
 * o resumo do período e, para quem vê a conta inteira, o atendimento por
 * pessoa. Planilha de várias abas exigiria XLSX, e CSV abre em qualquer lugar.
 *
 * Exportar é capacidade própria (RB-40), como na planilha de contatos; o
 * escopo do que se lê é o mesmo da tela, então quem só vê os próprios
 * atendimentos baixa só os próprios números.
 */
export async function GET(req: Request, contexto: RouteContext<'/api/clientes/[clienteId]/relatorios/csv'>) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  const acesso = await exigirCapacidade(params.data.clienteId, 'exportar', 'proprios')
  if (recusou(acesso)) return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })

  const cliente = await acharCliente(params.data.clienteId)
  if (!cliente) return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })

  const hoje = hojeEmSaoPaulo()
  const busca = new URL(req.url).searchParams
  const periodo = lerPeriodo(Object.fromEntries(busca), hoje)
  // O mesmo recorte da tela (Eu / Equipe / Conta): a planilha é o que está nela.
  const doAcesso = filtroDoAcesso(acesso, 'atender')
  const recorte = lerRecorte(busca.get('ver'), recortesPossiveis(doAcesso, acesso.regras.usuarioId, acesso.regras.equipes))
  const responsaveis = await responsaveisDoEscopo(
    cliente.id,
    filtroDoRecorte(doAcesso, recorte, acesso.regras.usuarioId, acesso.regras.equipes),
  )
  const podeVerValor = pode(acesso.regras, 'ler_valores', 'proprios')

  // O pool fala uma conexão por vez: em sequência, como na tela.
  const totais = await totaisDoPeriodo(cliente.id, periodo, responsaveis)
  const serie = completarDias(await serieDoPeriodo(cliente.id, periodo, responsaveis), periodo.de, periodo.ate, (dia) => ({
    dia,
    contatosNovos: 0,
    conversas: 0,
    foramParaPessoa: 0,
  }))
  const pessoas = responsaveis === null ? await atendimentosPorPessoa(cliente.id, periodo, responsaveis) : []
  const nomes = new Map(pessoas.length > 0 ? (await membrosDaConta(cliente.id)).map((m) => [m.id, m.nome]) : [])

  const automacao = taxaDeAutomacao(totais.desfechos)
  const minutos = (segundos: number | null) => (segundos === null ? '' : String(Math.round(segundos / 60)))

  const partes: (string | number | null)[][][] = [
    [
      ['Dia', 'Contatos novos', 'Conversas', 'Foram para a equipe'],
      ...serie.map((d) => [dataBr(d.dia), d.contatosNovos, d.conversas, d.foramParaPessoa]),
    ],
    [
      ['Resumo do período', 'Valor'],
      ['De', dataBr(periodo.de)],
      ['Até', dataBr(periodo.ate)],
      ['Contatos novos', totais.contatosNovos],
      ['Conversas', totais.conversas],
      ['Resolvidas pela automação (%)', automacao],
      ['Foram para a equipe', totais.tempos.entraramNaFila],
      ['Minutos até a primeira resposta (mediana)', minutos(totais.tempos.medianaAteResponder)],
      ['Minutos até fechar (mediana)', minutos(totais.tempos.medianaAteFechar)],
      ['Vendas ganhas', totais.fechamentos.ganhos],
      ['Vendas perdidas', totais.fechamentos.perdidos],
      ...(podeVerValor ? [['Valor ganho (R$)', totais.fechamentos.valor === null ? '' : totais.fechamentos.valor.toFixed(2).replace('.', ',')]] : []),
      ['Respostas da pesquisa de satisfação', totais.satisfacao.respostas],
      ['NPS', totais.satisfacao.nps],
    ],
    ...(pessoas.length > 0
      ? [
          [
            ['Pessoa', 'Atendimentos', 'Fechados'],
            ...pessoas.map((p) => [nomes.get(p.usuarioId) ?? 'Sem nome', p.atendimentos, p.fechados]),
          ],
        ]
      : []),
  ]

  const arquivo =
    '﻿' +
    partes
      .map((linhas) => linhas.map((linha) => linha.map((v) => celulaCsv(v === null ? '' : String(v))).join(',')).join('\r\n'))
      .join('\r\n\r\n') +
    '\r\n'

  return new Response(arquivo, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nomeDoArquivo('relatorio', cliente.nome, hoje)}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}

/** `2026-10-21` vira `21/10/2026`, o formato que a planilha brasileira lê como data. */
function dataBr(dia: string): string {
  const [ano, mes, d] = dia.split('-')
  return `${d}/${mes}/${ano}`
}
