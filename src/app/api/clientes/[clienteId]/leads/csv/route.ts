import { z } from 'zod'
import { montarCsv, nomeDoArquivo } from '@/server/csv'
import { acharCliente } from '@/server/repos/clientes'
import {
  ETIQUETAS_DE_LEAD,
  paginarLeads,
  type EtiquetaDeLead,
  type Lead,
} from '@/server/repos/leads'
import { exigirCapacidade, recusou } from '@/server/permissoes'
import { contatosDoNivel } from '@/server/consultas/nivel'
import { faixasDaConta } from '@/server/repos/relacionamento'
import { FAIXAS_PADRAO, NIVEIS, type Nivel } from '@/core/relacionamento'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

/**
 * Quantos leads são lidos por ida ao banco enquanto o arquivo é montado.
 *
 * Maior que a página da tela porque aqui ninguém está esperando uma lista
 * aparecer, e menor do que "tudo" porque uma exportação não pode ser o motivo
 * de a função estourar memória.
 */
const LOTE = 500

/** Teto do arquivo. Acima disso o produto precisa de exportação em fila. */
const TETO_DE_LINHAS = 20_000

/**
 * Baixa os leads do cliente como planilha.
 *
 * **O filtro da tela vem junto de propósito.** Quem filtrou por "foi para
 * pessoa" e clicou em exportar espera o arquivo daquilo que está vendo; entregar
 * a base inteira seria uma surpresa cara, ainda mais numa exportação que sai da
 * ferramenta e vira anexo de e-mail.
 *
 * O `proxy` já recusou quem não tem sessão nenhuma, e o cliente do endereço é o
 * único usado nas consultas. Falta a pergunta que o login trouxe: **esta pessoa
 * é desta conta?** Planilha de contato é o dado mais sensível que sai daqui, e
 * ela sai como anexo de e-mail.
 */
export async function GET(
  req: Request,
  contexto: RouteContext<'/api/clientes/[clienteId]/leads/csv'>,
) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  /*
   * **Exportar é capacidade própria** (RB-40, A19).
   *
   * Alcançar a empresa não basta: o CSV leva a base inteira para fora, e a
   * RB-40 diz que operador não exporta por padrão. Até a T2.1 esta rota
   * conferia só a empresa, então qualquer membro baixava tudo — e chamar a
   * URL direto funcionava mesmo com o botão escondido, que é o caso literal
   * do A19.
   *
   * A recusa é 404 e não 403, como em `conferirAcessoAoCliente`: confirmar que
   * o endpoint existe para quem não o alcança já é informação.
   */
  const acesso = await exigirCapacidade(params.data.clienteId, 'exportar', 'todos')
  if (recusou(acesso)) {
    return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })
  }

  const cliente = await acharCliente(params.data.clienteId)
  if (!cliente) return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })

  const parametros = new URL(req.url).searchParams
  const busca = parametros.get('busca') ?? ''
  const etiqueta =
    ETIQUETAS_DE_LEAD.find((valor) => valor === parametros.get('etiqueta')) ?? null
  // A etiqueta manual entra pelo mesmo motivo da derivada: quem filtrou e
  // clicou em exportar espera o arquivo do que está vendo.
  const marca = parametros.get('marca') || null

  /*
   * **O filtro de faixa vem junto, e antes da T6.1 ele não vinha.**
   *
   * Esta rota nem conhecia o parâmetro `nivel`: quem filtrava por Ouro na tela
   * e clicava em exportar recebia a base inteira, sem aviso. Duas superfícies,
   * duas definições — é o defeito que a RB-37 nomeia, e ele saía daqui como
   * anexo de e-mail.
   *
   * Agora a faixa é resolvida pela mesma `contatosDoNivel` que a tela usa.
   */
  const nivel = (NIVEIS as readonly string[]).includes(parametros.get('nivel') ?? '')
    ? (parametros.get('nivel') as Nivel)
    : null

  const faixas = (await faixasDaConta(cliente.id)) ?? FAIXAS_PADRAO
  const daFaixa = nivel ? await contatosDoNivel(cliente.id, nivel, faixas) : null

  const leads = await lerTudo(cliente.id, busca, etiqueta, marca, daFaixa)
  const colunas = colunasDosCampos(leads)

  const arquivo = montarCsv(
    [
      'Nome',
      'Telefone',
      'Situação',
      'Etiquetas',
      'Última mensagem',
      'Primeiro contato',
      ...colunas,
    ],
    leads.map((lead) => [
      lead.nome ?? '',
      lead.waId,
      lead.aguardando ? `aguardando pessoa — ${lead.aguardando.motivo}` : 'com o bot',
      lead.etiquetasManuais.map((etiqueta) => etiqueta.nome).join('; '),
      lead.ultimaEm ?? '',
      lead.criadoEm,
      ...colunas.map((coluna) => lead.campos[coluna] ?? ''),
    ]),
  )

  return new Response(arquivo, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nomeDoArquivo('leads', cliente.nome, hoje())}"`,
      // Planilha de lead é dado pessoal: nada de ficar em cache de proxy.
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}

async function lerTudo(
  clienteId: string,
  busca: string,
  etiqueta: EtiquetaDeLead | null,
  etiquetaId: string | null,
  contatos: string[] | null,
): Promise<Lead[]> {
  const tudo: Lead[] = []

  for (let pagina = 1; tudo.length < TETO_DE_LINHAS; pagina++) {
    const lote = await paginarLeads(clienteId, {
      busca,
      etiqueta,
      etiquetaId,
      contatos,
      pagina,
      porPagina: LOTE,
    })
    tudo.push(...lote.leads)
    if (pagina >= lote.paginas || lote.leads.length === 0) break
  }

  return tudo.slice(0, TETO_DE_LINHAS)
}

/**
 * As colunas dinâmicas, na ordem em que aparecem.
 *
 * Cada fluxo coleta campos diferentes, então a planilha não tem cabeçalho fixo:
 * ele é a união do que os leads exportados carregam.
 */
function colunasDosCampos(leads: Lead[]): string[] {
  const vistas: string[] = []
  for (const lead of leads) {
    for (const chave of Object.keys(lead.campos)) {
      if (!vistas.includes(chave)) vistas.push(chave)
    }
  }
  return vistas
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}
