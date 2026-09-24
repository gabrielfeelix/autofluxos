import type { NextConfig } from 'next'

/**
 * Cabeçalhos de segurança do painel.
 *
 * O que eles cobrem, e por que valem a pena numa base pequena:
 *
 * - **`frame-ancestors 'none'`** (com o `X-Frame-Options` para navegador
 *   antigo) fecha clickjacking. A tela de login e o botão de apagar credencial
 *   são exatamente o tipo de alvo que essa técnica procura: uma página de fora
 *   embute a nossa num iframe transparente e a pessoa clica sem ver onde.
 * - **`nosniff`** impede o navegador de adivinhar o tipo de um arquivo. Sem
 *   ele, conteúdo que chega como texto pode acabar executado como script.
 * - **`Referrer-Policy`** evita mandar a URL inteira para fora, e as nossas
 *   carregam id de cliente e de contato no caminho.
 * - **`Permissions-Policy`** desliga câmera e localização, que este painel nunca
 *   usa. É gratuito e fecha a porta antes de alguém abri-la.
 *
 * **O microfone é `(self)` e não `()`, e a diferença custou uma sessão.** Até
 * 15/set/2026 ele estava em `microphone=()`, lista **vazia**, que proíbe
 * *todas* as origens, **inclusive a nossa**. Quando a caixa de resposta ganhou
 * o botão de gravar áudio, `getUserMedia` passou a ser recusado pelo navegador
 * **sem pedir permissão nenhuma**: não aparece prompt, não aparece cadeado, não
 * há o que a pessoa possa liberar. O comentário que estava aqui dizia "que este
 * painel nunca usa", e era verdade quando foi escrito, deixou de ser no dia em
 * que o microfone entrou, e nada acusou.
 *
 * `(self)` libera só a nossa própria origem: o navegador volta a perguntar, e
 * nenhum iframe de terceiro ganha nada (o `frame-ancestors 'none'` acima já
 * impede que exista iframe nosso, e `self` não se propaga para iframes de
 * outra origem embutidos por nós).
 *
 * **Regra para a próxima vez:** recurso de navegador novo (câmera, geolocation,
 * clipboard, notificações) começa desligado aqui, e quem for usá-lo precisa
 * ligar na mesma mudança. Endurecimento que ninguém revisita vira recurso que
 * falha calado.
 *
 * Não há CSP completa de propósito: o Next injeta script inline e uma política
 * escrita no chute quebraria a hidratação da página inteira. `frame-ancestors`
 * é a parte que dá para afirmar sem risco; a CSP inteira é tarefa própria, com
 * nonce, quando alguém puder testá-la de verdade.
 */
export const cabecalhos = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
]

/**
 * As telas de configuração que mudaram de endereço.
 *
 * Seis delas moravam na raiz da conta (`/numero`, `/conexoes`, `/instagram`,
 * `/anuncios`, `/acervo`, `/contexto`) por histórico, e não por regra: as
 * outras quatro já estavam sob `/ajustes/`. Agora todas estão, e o endereço
 * diz em que seção a pessoa está, o que importa porque **o dono manda print
 * com a URL na barra**, e porque ele tem link salvo.
 *
 * `permanent: true` (308) e não 307: o endereço antigo não volta, e o 308
 * preserva o método, essas telas recebem `POST` de Server Action, e um 307/308
 * trocado por 302 transformaria o POST em GET no meio do caminho.
 *
 * O motivo de cada nome novo está em `docs/PLANO-CONFIGURACOES.md` §2.
 */
const TELAS_QUE_MUDARAM: { de: string; para: string }[] = [
  { de: 'numero', para: 'conversas/canais/whatsapp' },
  { de: 'instagram', para: 'conversas/canais/instagram' },
  { de: 'conexoes', para: 'ajustes/chaves' },
  { de: 'anuncios', para: 'ajustes/anuncios' },
  { de: 'acervo', para: 'ajustes/acervo' },
  { de: 'contexto', para: 'ajustes/contexto' },
]

/**
 * As telas que saíram de Configurações no plano de navegação de 24/set
 * (`docs/PLANO-NAVEGACAO-E-CRM-2026-09-24.md`, seção 4): eram trabalho do dia
 * escondido debaixo de ajuste. Mesmo motivo do 308 acima: link salvo e print
 * com URL continuam chegando no lugar certo, e o `:resto*` leva junto o que vem
 * depois do nome (a busca, `?resultado=`, passa sozinha).
 */
const SAIRAM_DE_CONFIGURACOES: { de: string; para: string }[] = [
  { de: 'ajustes/whatsapp', para: 'conversas/canais/whatsapp' },
  { de: 'ajustes/instagram', para: 'conversas/canais/instagram' },
  { de: 'ajustes/respostas-rapidas', para: 'conversas/respostas-rapidas' },
  { de: 'ajustes/etiquetas', para: 'leads/etiquetas' },
  { de: 'ajustes/produtos', para: 'loja/catalogo' },
  { de: 'ajustes/integracoes/magento', para: 'loja/magento' },
]

const config: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: cabecalhos }]
  },

  async redirects() {
    return [
      ...TELAS_QUE_MUDARAM.map(({ de, para }) => ({
        source: `/clientes/:clienteId/${de}`,
        destination: `/clientes/:clienteId/${para}`,
        permanent: true,
      })),
      ...SAIRAM_DE_CONFIGURACOES.map(({ de, para }) => ({
        source: `/clientes/:clienteId/${de}/:resto*`,
        destination: `/clientes/:clienteId/${para}/:resto*`,
        permanent: true,
      })),
    ]
  },

  /**
   * O teto do corpo de uma Server Action.
   *
   * **O padrão do Next é 1 MB, e ele não avisa: devolve 413 antes de qualquer
   * código nosso rodar.** O que a pessoa vê é a página de erro genérica, sem
   * motivo nenhum, foi assim que a importação de planilha e o envio de arquivo
   * falhavam calados em tudo acima de um mega.
   *
   * 4 MB porque é o que a plataforma permite: a Vercel corta o corpo de uma
   * função em ~4,5 MB, e pedir mais aqui só trocaria o erro do framework pelo
   * erro dela. Uma planilha de 4 MB é da ordem de dezenas de milhares de
   * contatos, cobre a importação real com folga.
   *
   * **Arquivo de mídia não depende disto e não deve voltar a depender.** Ele
   * sobe direto do navegador para o Storage por URL assinada
   * (`repos/acervo.ts`), onde o teto é o do bucket: 16 MB, o da própria Cloud
   * API. A logo continua passando por aqui porque o limite dela é 512 KB, bem
   * abaixo de qualquer um destes números.
   */
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },

    /**
     * Quanto tempo o Next guarda a página já visitada no cache do cliente.
     *
     * O padrão do Next 15 em diante é `dynamic: 0`: página dinâmica (todas as
     * nossas são, porque leem sessão e banco) sai do cache do roteador no
     * instante em que a pessoa navega para outra. Resultado: voltar para a aba
     * anterior refaz o RSC inteiro e o `loading.tsx` aparece de novo, mesmo que
     * a tela tenha sido aberta dez segundos antes. Não é bug de skeleton, é
     * cache desligado por padrão.
     *
     * 60 segundos cobre o vai e volta entre abas (Inbox, Leads, Fluxos,
     * Ajustes), que é onde o esqueleto repetido incomoda. Depois disso a tela
     * volta a buscar dado novo sozinha.
     *
     * Dado velho depois de salvar não é risco aqui: Server Action que muda algo
     * chama `revalidatePath` ou `router.refresh` (42 arquivos fazem isso), e
     * qualquer um dos dois limpa este cache na hora.
     *
     * `static: 300` mantém o padrão do Next para página estática e para link com
     * `prefetch` explícito.
     */
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
}

export default config
