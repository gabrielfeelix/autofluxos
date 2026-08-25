import type { Metadata } from 'next'
import Link from 'next/link'
import { Marca } from '@/components/design/marca'
import { Bloco, Campo, Conversa, Zap } from '@/components/ajuda/pecas'
import {
  SecaoBlocos,
  SecaoComoFunciona,
  SecaoDatas,
  SecaoEntrada,
  SecaoListas,
  SecaoPerguntas,
  SecaoQuandoDaErrado,
  SecaoVariaveis,
} from '@/components/ajuda/conteudo-fluxos'
import {
  SecaoOutrosSistemas,
  SecaoReceitas,
  SecaoVerandiDados,
  SecaoVerandiLigar,
} from '@/components/ajuda/conteudo-verandi'
import { SecaoDepoisDoFluxo, SecaoDuvidas } from '@/components/ajuda/conteudo-duvidas'

/**
 * A Ajuda — uma página só, para varrer com o olho.
 *
 * **Não é um site de documentação com uma página por assunto.** Quem abre isto
 * está travado no meio de um desenho, com a aba do editor aberta ao lado: o que
 * resolve é `Ctrl+F` numa página inteira, não navegar por três níveis de menu
 * atrás do parágrafo certo. O índice à esquerda são âncoras, e o endereço de
 * cada seção é estável — dá para mandar `/ajuda#datas` para alguém.
 *
 * **Servidor, e sem JavaScript nenhum.** Sanfona é `<details>`, navegação é
 * `<a href="#…">`. Uma página de socorro que depende de um bundle carregar é
 * uma página que falta exatamente no dia em que algo está errado.
 *
 * Fica atrás do login, como o resto do painel. Não é documentação pública: ela
 * fala de contas, credenciais e do sistema do cliente pelo nome.
 */
export const metadata: Metadata = {
  title: 'Ajuda — AutoFluxos',
  description:
    'Como desenhar automações de WhatsApp, fazer o bot entender datas e ligar a agenda da Verandi.',
}

/** O índice. A ordem é a da página, e os títulos são os das seções. */
const INDICE = [
  { grupo: 'Fundamentos', itens: [
    { id: 'como-funciona', rotulo: 'O caminho de uma mensagem' },
    { id: 'blocos', rotulo: 'Os dez blocos' },
    { id: 'entrada', rotulo: 'Qual automação atende' },
    { id: 'variaveis', rotulo: 'Variáveis' },
  ] },
  { grupo: 'Conversar direito', itens: [
    { id: 'perguntas', rotulo: 'Rótulo, valor e padrão' },
    { id: 'datas', rotulo: 'Datas e horários' },
    { id: 'listas', rotulo: 'Da API para o menu' },
    { id: 'erros', rotulo: 'Quando dá errado' },
  ] },
  { grupo: 'Integrações', itens: [
    { id: 'verandi', rotulo: 'Ligar na Verandi' },
    { id: 'verandi-dados', rotulo: 'O que o bot lê da agenda' },
    { id: 'receitas', rotulo: 'Cinco receitas' },
    { id: 'outros-sistemas', rotulo: 'Planilha, CRM, webhook' },
  ] },
  { grupo: 'O resto', itens: [
    { id: 'depois', rotulo: 'Depois da conversa' },
    { id: 'duvidas', rotulo: 'Dúvidas frequentes' },
  ] },
]

export default function Pagina() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-[54px] w-full max-w-[1180px] items-center gap-3 px-4 md:px-8">
          <Link href="/" className="shrink-0" aria-label="Voltar ao painel">
            <Marca compacta />
          </Link>
          <span aria-hidden className="text-dim">
            /
          </span>
          <span className="text-[13px] font-semibold text-soft">Ajuda</span>
          <Link
            href="/"
            className="ml-auto rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-dim transition hover:bg-white/[0.04] hover:text-accent"
          >
            Voltar ao painel
          </Link>
        </div>
      </header>

      <Capa />

      <div className="mx-auto flex w-full max-w-[1180px] gap-10 px-4 pb-24 md:px-8">
        <Indice />

        <main className="min-w-0 flex-1 space-y-12 pt-4">
          <SecaoComoFunciona />
          <SecaoBlocos />
          <SecaoEntrada />
          <SecaoVariaveis />
          <SecaoPerguntas />
          <SecaoDatas />
          <SecaoListas />
          <SecaoQuandoDaErrado />
          <SecaoVerandiLigar />
          <SecaoVerandiDados />
          <SecaoReceitas />
          <SecaoOutrosSistemas />
          <SecaoDepoisDoFluxo />
          <SecaoDuvidas />

          <footer className="border-t border-white/[0.06] pt-8 text-[12.5px] leading-[1.7] text-dim">
            <p>
              Faltou alguma coisa aqui? Fale com a 4YU — esta página cresce com a pergunta que você
              não achou.
            </p>
            <p className="mt-2 font-mono text-[10.5px] text-[#454f60]">
              AutoFluxos · 4YU · uso interno
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}

/**
 * A capa: a conversa e o desenho que a produziu, lado a lado.
 *
 * **É a tese do produto inteiro numa tela**, e por isso ela é o cabeçalho em vez
 * de um número grande com um rótulo pequeno. Quem abre a Ajuda travado precisa
 * primeiro reconhecer o próprio problema no desenho — e o problema quase sempre
 * é este: uma conversa que marca horário sozinha.
 */
function Capa() {
  return (
    <div className="relative overflow-hidden border-b border-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,.04)_1px,transparent_1.3px)] bg-[length:26px_26px]"
      />
      <div className="relative mx-auto grid w-full max-w-[1180px] gap-9 px-4 pt-12 pb-14 md:grid-cols-[1fr_auto] md:items-center md:px-8 md:pt-16">
        <div className="max-w-[560px]">
          <p className="font-mono text-[10.5px] font-bold tracking-[0.18em] text-accent uppercase">
            Ajuda
          </p>
          <h1 className="mt-3 text-[34px] leading-[1.06] font-bold tracking-[-0.03em] text-balance md:text-[46px]">
            Uma conversa que marca horário sozinha.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.65] text-soft">
            É isto que você está montando. Nesta página: como o bot decide o que responder, como
            fazê-lo entender uma data, e como ligar a automação na agenda da Verandi — com as
            armadilhas que só se descobre errando.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {[
              { id: 'datas', rotulo: 'Fazer o bot entender datas' },
              { id: 'verandi', rotulo: 'Ligar na Verandi' },
              { id: 'duvidas', rotulo: 'Dúvidas frequentes' },
            ].map((atalho) => (
              <a
                key={atalho.id}
                href={`#${atalho.id}`}
                className="rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-semibold text-soft transition hover:border-accent/45 hover:bg-accent/[0.09] hover:text-accent"
              >
                {atalho.rotulo}
              </a>
            ))}
          </div>
        </div>

        {/* No celular a capa vira só o texto: o par conversa-desenho precisa das
            duas colunas para dizer o que diz, e empilhado ele vira dois
            enfeites soltos com 400px de altura antes do primeiro parágrafo. */}
        <div className="hidden items-start gap-5 md:flex">
          <Conversa titulo="Ana · 44 99888-7766">
            <Zap>Oi, *Ana*! 👋 Vamos marcar sua aula?</Zap>
            <Zap de="pessoa">21/08/2026</Zap>
            <Zap botoes={['07:00', '10:00', '15:00']}>Qual horário fica melhor?</Zap>
            <Zap de="pessoa">07:00</Zap>
            <Zap>Prontinho! ✅ Marcada para *21/08 às 07:00*.</Zap>
          </Conversa>

          <div className="hidden w-[248px] space-y-2.5 pt-6 lg:block">
            <Bloco tipo="http" titulo="reconhecer quem fala">
              <Campo rotulo="cria">pessoa_id · nome_na_agenda</Campo>
            </Bloco>
            <Bloco tipo="pergunta" titulo="qual dia" saidas={['segue', 'timeout']}>
              <Campo rotulo="formato">Data → 2026-08-21</Campo>
            </Bloco>
            <Bloco tipo="http" titulo="marcar na agenda" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * O índice fica **grudado na tela** no desktop e some no celular.
 *
 * Some porque um índice de quatorze itens antes do primeiro parágrafo é uma tela
 * inteira de links num aparelho de 390px — quem chegou pelo `?` do cabeçalho
 * quer ler, não escolher. Os três atalhos da capa cobrem o que se procura com
 * pressa, e o resto se acha rolando.
 */
function Indice() {
  return (
    <nav
      aria-label="Índice da ajuda"
      className="sticky top-[54px] hidden h-[calc(100vh-54px)] w-[220px] shrink-0 overflow-y-auto py-8 lg:block"
    >
      {INDICE.map((secao) => (
        <div key={secao.grupo} className="mb-5">
          <p className="mb-1.5 px-2 font-mono text-[9.5px] font-bold tracking-[0.14em] text-dim uppercase">
            {secao.grupo}
          </p>
          <ul>
            {secao.itens.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block rounded-lg px-2 py-1.5 text-[12.5px] leading-[1.4] text-muted transition hover:bg-white/[0.04] hover:text-accent"
                >
                  {item.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
