/**
 * Monta a conta "4YU Tech Demonstração" (docs/DEMO.md).
 *
 *   npx tsx --conditions=react-server scripts/demo/montar-conta.mts            (dry-run: só mostra)
 *   npx tsx --conditions=react-server scripts/demo/montar-conta.mts --gravar   (escreve na produção)
 *
 * Idempotente: o que já existe (conta, arquivo, produto, loja) é pulado, então
 * rodar de novo só completa o que faltou.
 *
 * Os arquivos (fotos e cardápios) vêm de DEMO_ARQUIVOS, a pasta onde foram
 * gerados; eles não moram no repositório.
 *
 * O token da loja Magento é lido do cofre da PCYES e gravado no cofre da conta
 * demo, só em memória: nunca é impresso nem escrito em arquivo.
 */
import fs from 'node:fs'
import path from 'node:path'

process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

const { db } = await import('@/server/db')
const { criarCliente } = await import('@/server/repos/clientes')
const { definirPlano } = await import('@/server/repos/plano')
const { registrar } = await import('@/server/repos/auditoria')
const { BUCKET_DO_ACERVO } = await import('@/server/repos/acervo')
const { listarProdutos, gravarImportacao } = await import('@/server/repos/produtos')
const { listarMateriais, salvarMaterial } = await import('@/server/repos/materiais')
const { lojaDaConta, salvarLoja, ligarLoja, ligarEstoqueExato } = await import('@/server/repos/lojas')
const { lerCredencial, criarConexao } = await import('@/server/repos/conexoes')
const { atualizarRetomada } = await import('@/server/repos/clientes')

const GRAVAR = process.argv.includes('--gravar')
const ARQUIVOS = process.env.DEMO_ARQUIVOS ?? ''
const NOME_DA_CONTA = '4YU Tech Demonstração'
const PCYES = '64dbc3a9-1f77-4892-9770-e3e4be9e14cd'
const GABRIEL = '931ce0d1-bda3-42cb-b328-418c8b1fe7cc'
const PLANO = 'escala'
const LIMITE_DE_IA_POR_CONTATO = 40

const CONTEXTO = [
  'Conta de demonstração da 4YU (AutoFluxos): mostra, pelo WhatsApp, como o atendimento automático funciona em vários tipos de negócio.',
  'Os negócios daqui (Pizzaria Exemplo, Hamburgueria Exemplo, Restaurante Exemplo, Moda Exemplo, Salão Exemplo, Estúdio Exemplo) são fictícios: pedidos, agendamentos e compras feitos nesta conversa não são reais e ninguém vai entregar nada.',
  'A loja online de tecnologia é a PCYES de verdade, com os produtos e preços do site dela.',
  'Quem quiser isto no próprio negócio fala com a equipe da 4YU por aqui mesmo.',
].join('\n')

type Item = { slug: string; nome: string; categoria: string; preco: number; descricao: string }
type Catalogo = Record<string, { negocio: string; especie?: 'servico'; itens: Item[] }>
const catalogo: Catalogo = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'catalogo.json'), 'utf8'))

const passo = (msg: string) => console.log(`${GRAVAR ? '[grava]' : '[dry-run]'} ${msg}`)

/* ------------------------------------------------------------------ conta */
async function acharConta(): Promise<string | null> {
  const { data, error } = await db().from('clients').select('id').eq('nome', NOME_DA_CONTA)
  if (error) throw new Error(error.message)
  if ((data?.length ?? 0) > 1) throw new Error('há mais de uma conta com o nome da demo; resolva à mão')
  return data?.[0]?.id ?? null
}

let contaId = await acharConta()
if (contaId) {
  console.log(`conta já existe: ${contaId}`)
} else {
  passo(`criar conta "${NOME_DA_CONTA}", plano ${PLANO} a R$ 0, dono Gabriel`)
  if (GRAVAR) {
    contaId = (await criarCliente(NOME_DA_CONTA)).id
    const r = await definirPlano(contaId, PLANO, 0)
    if (!r.ok) throw new Error(r.erro)
    await registrar({
      acao: 'criou_conta',
      autorId: GABRIEL,
      contaId,
      contaNome: NOME_DA_CONTA,
      alvoTipo: 'client',
      alvoId: contaId,
      alvoNome: NOME_DA_CONTA,
      detalhes: { plano: PLANO, proprietario: GABRIEL, origem: 'scripts/demo/montar-conta.mts' },
    })
    console.log(`conta criada: ${contaId}`)
  }
}

if (contaId) {
  const { data: membro } = await db()
    .from('af_membros')
    .select('id')
    .eq('organizationId', contaId)
    .eq('userId', GABRIEL)
    .maybeSingle()
  if (!membro) {
    passo('Gabriel como Proprietário da conta')
    if (GRAVAR) {
      const { error } = await db().from('af_membros').insert({
        id: crypto.randomUUID(),
        organizationId: contaId,
        userId: GABRIEL,
        role: 'owner',
        createdAt: new Date().toISOString(),
        funcao_id: 'proprietario',
      })
      if (error) throw new Error(`membro: ${error.message}`)
    }
  }

  passo(`ia_limite_contato_dia = ${LIMITE_DE_IA_POR_CONTATO} e contexto do negócio da demo`)
  if (GRAVAR) {
    const { error } = await db()
      .from('clients')
      .update({ ia_limite_contato_dia: LIMITE_DE_IA_POR_CONTATO, contexto_negocio: CONTEXTO })
      .eq('id', contaId)
    if (error) throw new Error(error.message)
  }

  /*
   * Passada para uma pessoa (ofensa, dúvida que a IA não responde), a conversa
   * fica muda até alguém atender, inclusive para o gatilho "demo". Numa demo
   * que ninguém vigia, o bot volta sozinho em 5 minutos, o lead inclusive: o
   * gatilho não passa por cima de atendimento humano.
   */
  passo('retomada do bot: 5 minutos')
  if (GRAVAR) {
    await atualizarRetomada(contaId, {
      ativo: true,
      minutos: 5,
      mensagem: 'Voltei! 🙂 Para recomeçar a demonstração, escreva *inicio*.',
    })
  }
}

/* ----------------------------------------------------------------- acervo */
const urls: Record<string, string> = {}

async function subir(nome: string, local: string, tipo: string): Promise<string> {
  const caminho = `${contaId ?? '<conta>'}/${nome}`
  const publica = db().storage.from(BUCKET_DO_ACERVO).getPublicUrl(caminho).data.publicUrl
  if (!contaId) return publica
  const { data: ja } = await db().storage.from(BUCKET_DO_ACERVO).list(contaId, { search: nome })
  if (ja?.some((a) => a.name === nome)) return publica
  passo(`subir ${nome}`)
  if (GRAVAR) {
    const { error } = await db()
      .storage.from(BUCKET_DO_ACERVO)
      .upload(caminho, fs.readFileSync(local), { contentType: tipo, upsert: false })
    if (error) throw new Error(`upload ${nome}: ${error.message}`)
  }
  return publica
}

if (!ARQUIVOS) throw new Error('defina DEMO_ARQUIVOS com a pasta das fotos e cardápios')
for (const bloco of Object.values(catalogo)) {
  for (const it of bloco.itens) {
    urls[it.slug] = await subir(`demo-${it.slug}.jpg`, path.join(ARQUIVOS, 'fotos', `${it.slug}.jpg`), 'image/jpeg')
  }
}
const RAMOS_COM_CARDAPIO = ['pizzaria', 'hamburgueria', 'restaurante', 'comercio', 'servicos', 'aulas']
for (const ramo of RAMOS_COM_CARDAPIO) {
  urls[`cardapio-${ramo}.png`] = await subir(`demo-cardapio-${ramo}.png`, path.join(ARQUIVOS, 'cardapios', `${ramo}.png`), 'image/png')
  urls[`cardapio-${ramo}.pdf`] = await subir(`demo-cardapio-${ramo}.pdf`, path.join(ARQUIVOS, 'cardapios', `${ramo}.pdf`), 'application/pdf')
}
fs.writeFileSync(path.join(ARQUIVOS, 'urls.json'), JSON.stringify({ contaId, urls }, null, 1))

/* --------------------------------------------------------------- catálogo */
if (contaId) {
  const existentes = new Set((await listarProdutos(contaId)).filter((p) => !p.arquivadoEm).map((p) => p.nome))
  const criar = Object.entries(catalogo).flatMap(([ramo, bloco]) =>
    bloco.itens
      .filter((it) => !existentes.has(it.nome))
      .map((it, i) => ({
        linha: i + 2,
        nome: it.nome,
        especie: bloco.especie ?? 'produto',
        preco: it.preco,
        sku: `demo-${it.slug}`,
        descricao: it.descricao,
        // Sem link: os negócios de exemplo não têm loja on-line, e produto com
        // foto e sem link sai como foto com legenda, sem o botão "Ver na loja".
        link: null,
        foto: urls[it.slug],
        categoria: it.categoria,
      })),
  )
  passo(`criar ${criar.length} itens no catálogo (${existentes.size} já existiam)`)
  if (GRAVAR && criar.length > 0) {
    const r = await gravarImportacao(contaId, { criar, atualizar: [], erros: [] } as never)
    console.log(`  criados ${r.criados}, erros ${JSON.stringify(r.erros)}`)
  }

  const { data: comLink } = await db().from('produtos').select('id').eq('client_id', contaId).like('sku', 'demo-%').not('link', 'is', null)
  if ((comLink?.length ?? 0) > 0) {
    passo(`tirar o link de ${comLink!.length} itens de exemplo`)
    if (GRAVAR) {
      const { error } = await db().from('produtos').update({ link: null }).eq('client_id', contaId).like('sku', 'demo-%')
      if (error) throw new Error(error.message)
    }
  }

  /* -------------------------------------------------------------- materiais */
  const materiais = await listarMateriais(contaId)
  if (!materiais.some((m) => m.tipo === 'cardapio-imagem')) {
    passo('cardápio em imagem da conta = o da Pizzaria Exemplo')
    if (GRAVAR) await salvarMaterial(contaId, 'cardapio-imagem', urls['cardapio-pizzaria.png'], null)
  }
  if (!materiais.some((m) => m.tipo === 'cardapio-pdf')) {
    passo('cardápio em PDF da conta = o da Pizzaria Exemplo')
    if (GRAVAR) await salvarMaterial(contaId, 'cardapio-pdf', urls['cardapio-pizzaria.pdf'], 'Cardápio Pizzaria Exemplo.pdf')
  }

  /* ------------------------------------------------ loja Magento da PCYES */
  const lojaPcyes = await lojaDaConta(PCYES)
  if (!lojaPcyes?.conexaoId) throw new Error('a PCYES não tem loja Magento com token')
  const lojaDemo = await lojaDaConta(contaId)
  if (!lojaDemo) {
    passo(`ligar a loja Magento ${lojaPcyes.endereco} na conta demo`)
    if (GRAVAR) {
      await salvarLoja(contaId, { endereco: lojaPcyes.endereco, codigoDaLoja: lojaPcyes.codigoDaLoja, sufixo: lojaPcyes.sufixo })
      const r = await ligarLoja(contaId, true)
      if (!r.ok) throw new Error(r.motivo)
    }
  }
  if (!lojaDemo?.conexaoId) {
    passo('copiar o token da loja (cofre para cofre, sem imprimir) e ligar o estoque exato')
    if (GRAVAR) {
      const credencial = await lerCredencial(lojaPcyes.conexaoId, PCYES)
      if (!credencial) throw new Error('não deu para ler o token da loja da PCYES')
      const conexao = await criarConexao({ clienteId: contaId, nome: 'Magento (somente leitura)', tipo: 'bearer', valor: credencial.valor })
      if (lojaPcyes.estoqueExato !== 'desligado') {
        await ligarEstoqueExato(contaId, { conexaoId: conexao.id, via: lojaPcyes.estoqueExato, estoqueId: lojaPcyes.estoqueId })
      }
    }
  }
}

console.log(GRAVAR ? 'pronto.' : 'dry-run: nada foi escrito. Rode com --gravar.')
