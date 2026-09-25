import 'server-only'
import { estadoDaConexao, type EstadoDaConexao } from '@/core/conexoes'
import { canalDoInstagram } from './repos/canais-instagram'
import { chatDoSite } from './repos/canais-site'
import { listarConexoes } from './repos/conexoes'
import { listarCanais } from './repos/conversas'
import { lojaDaConta } from './repos/lojas'
import { paginasDaConta } from './repos/paginas-de-lead'
import { ultimaChegadaDeAnuncio, ultimaMensagemRecebida } from './repos/ultimos-eventos'
import { NOME_DA_CONEXAO_DE_ADS } from './token-de-anuncios'

export type ChaveDaIntegracao = 'whatsapp' | 'instagram' | 'anuncios' | 'chaves' | 'magento' | 'telegram' | 'site'

export type ItemDoCatalogo = {
  chave: ChaveDaIntegracao
  nome: string
  categoria: string
  descricao: string
  /** Relativo à conta. `null` = não há tela: a integração ainda não existe. */
  href: string | null
  /** `false` = ainda não dá para ligar; fica fora do "N de M". */
  disponivel: boolean
  emBreve?: string
  estado: EstadoDaConexao
  /** O que é o "último evento" desta integração, quando ela tem um. */
  rotuloDoEvento?: string
}

/**
 * O catálogo de integrações da conta, com o estado de cada uma em camadas.
 *
 * **Uma lista só** para a tela de Integrações e para o "N de M" do índice de
 * Configurações (C02): antes o índice contava quatro coisas à mão contra um
 * total fixo de cinco, e a tela desenhava seis cartões.
 */
export async function catalogoDeIntegracoes(clienteId: string): Promise<ItemDoCatalogo[]> {
  const [canais, contaDoInstagram, paginas, conexoes, loja, ultimaMensagem, ultimoAnuncio, site] =
    await Promise.all([
      listarCanais(clienteId),
      canalDoInstagram(clienteId),
      paginasDaConta(clienteId),
      listarConexoes(clienteId),
      lojaDaConta(clienteId),
      ultimaMensagemRecebida(clienteId),
      ultimaChegadaDeAnuncio(clienteId),
      chatDoSite(clienteId),
    ])

  const numeros = canais.filter((c) => c.provider === 'cloud-api')
  const temTokenDeAnuncios = conexoes.some(
    (c) => c.nome.trim().toLowerCase() === NOME_DA_CONEXAO_DE_ADS && c.tipo === 'bearer',
  )

  return [
    {
      chave: 'whatsapp',
      nome: 'WhatsApp',
      categoria: 'Canal',
      descricao: 'O número da empresa atendendo pela Cloud API da Meta. É por onde a conversa entra e sai.',
      href: '/conversas/canais/whatsapp',
      disponivel: true,
      estado: estadoDaConexao({
        tipo: 'whatsapp',
        numeros: numeros.map((c) => ({
          displayPhoneNumber: c.displayPhoneNumber,
          desembarcadoEm: c.desembarcadoEm ?? null,
        })),
        ultimoEvento: ultimaMensagem,
      }),
      rotuloDoEvento: 'Última mensagem recebida na conta',
    },
    {
      chave: 'instagram',
      nome: 'Instagram',
      categoria: 'Canal',
      descricao: 'O direct de uma conta profissional chegando no mesmo Inbox do WhatsApp.',
      href: '/conversas/canais/instagram',
      disponivel: true,
      estado: estadoDaConexao({
        tipo: 'instagram',
        conta: contaDoInstagram
          ? { igUsername: contaDoInstagram.igUsername ?? null, tokenExpiraEm: contaDoInstagram.tokenExpiraEm ?? null }
          : null,
        ultimoEvento: ultimaMensagem,
      }),
      rotuloDoEvento: 'Última mensagem recebida na conta',
    },
    {
      chave: 'site',
      nome: 'Chat no site',
      categoria: 'Canal',
      descricao: 'Um balão de conversa no site da loja, com os mesmos fluxos e a mesma IA, sem custo por mensagem.',
      href: '/conversas/canais/site',
      disponivel: true,
      // Ligado e com endereço cadastrado é o que faz o balão abrir. Um sem o
      // outro é cadastro pela metade, e a tela do canal diz o que falta.
      estado: estadoDaConexao({
        tipo: 'cadastro',
        configurado: site?.status === 'ativo' && site.config.dominios.length > 0,
        href: '/conversas/canais/site',
      }),
    },
    {
      chave: 'anuncios',
      nome: 'Anúncios da Meta',
      categoria: 'Anúncios',
      descricao:
        'Quem preenche o formulário de um anúncio no Facebook ou no Instagram entra aqui como lead.',
      href: '/ajustes/anuncios',
      disponivel: true,
      estado: estadoDaConexao({
        tipo: 'anuncios',
        paginas: paginas.length,
        temToken: temTokenDeAnuncios,
        // A inscrição da página no webhook não é gravada hoje: desconhecida.
        webhookInscrito: null,
        ultimoEvento: ultimoAnuncio,
      }),
      rotuloDoEvento: 'Último contato vindo de anúncio',
    },
    {
      chave: 'chaves',
      nome: 'Chaves de API',
      categoria: 'API',
      descricao: 'As chaves que os blocos de Serviços externos usam para falar com os sistemas deste cliente.',
      href: '/ajustes/chaves',
      disponivel: true,
      estado: estadoDaConexao({ tipo: 'cadastro', configurado: conexoes.length > 0, href: '/ajustes/chaves' }),
    },
    {
      chave: 'magento',
      nome: 'Loja Magento',
      categoria: 'Loja',
      descricao: 'O bot consulta o catálogo da loja na hora: diz se tem, quanto custa e manda o link do produto.',
      href: '/loja/magento',
      disponivel: true,
      estado: estadoDaConexao({
        tipo: 'cadastro',
        configurado: Boolean(loja?.ativa),
        href: '/loja/magento',
      }),
    },
    {
      chave: 'telegram',
      nome: 'Telegram',
      categoria: 'Canal',
      descricao: 'Atendimento no Telegram, com teclado inline e sem janela de 24 horas.',
      href: null,
      disponivel: false,
      emBreve: 'Telegram ainda não está disponível.',
      estado: estadoDaConexao({ tipo: 'cadastro', configurado: false, href: '/ajustes/integracoes' }),
    },
  ]
}
