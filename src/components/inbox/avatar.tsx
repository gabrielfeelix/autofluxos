/**
 * As iniciais de quem está do outro lado, com o ponto vermelho de quem espera.
 *
 * **Mora em arquivo próprio porque é usado dos dois lados da fronteira**: a
 * linha da fila (`components/inbox/fila.tsx`, cliente) e o cabeçalho da
 * conversa (`inbox/page.tsx`, servidor). Sem `'use client'` de propósito ,
 * não tem estado nem efeito, então serve aos dois sem obrigar ninguém a virar
 * componente de cliente.
 *
 * ---------------------------------------------------------------------------
 * Por que a cor vem do nome, e não uma foto
 * ---------------------------------------------------------------------------
 *
 * **A Cloud API não expõe foto de perfil de contato.** O webhook entrega
 * `contacts[].profile` com só o nome; o único `profile_picture_url` que existe
 * é o do próprio negócio, o nosso lado, não o dela. Quem mostra foto de
 * contato no mercado está rodando provedor não oficial por cima do WhatsApp
 * Web, que é o caminho que arrisca banir o número do cliente.
 *
 * Então a cor derivada do nome não é um consolo: é o que uma fila de trinta
 * conversas cinza-iguais precisa para virar uma lista em que se acha alguém de
 * relance. É o mesmo truque de Slack e Google, e é só tela.
 */
import { DEFINICAO_DO_CANAL, type CanalId } from '@/core/canais'
import { LogoDoCanal } from '@/components/design/selo-do-canal'

/**
 * As cores possíveis, escritas por extenso.
 *
 * Classe inteira, e não `bg-[hsl(${x})]`: o Tailwind lê o código fonte para
 * decidir o que gerar, e classe montada em tempo de execução simplesmente não
 * sai no CSS. O sintoma seria um avatar transparente, sem erro nenhum.
 *
 * **Os tons são de tema claro**, fundo `50`, texto `700`. Eles eram `400/[0.14]`
 * com texto `200`, medida de fundo preto: sobre branco o texto claro sobre o
 * fundo claro dava menos de 2:1, e as iniciais sumiam. No escuro o par continua
 * legível porque a superfície do card escuro é cinza-azulada, não preta.
 */
const CORES = [
  'border-sky-200 bg-sky-50 text-sky-700',
  'border-violet-200 bg-violet-50 text-violet-700',
  'border-emerald-200 bg-emerald-50 text-emerald-700',
  'border-amber-200 bg-amber-50 text-amber-700',
  'border-rose-200 bg-rose-50 text-rose-700',
  'border-teal-200 bg-teal-50 text-teal-700',
  'border-indigo-200 bg-indigo-50 text-indigo-700',
  'border-orange-200 bg-orange-50 text-orange-700',
] as const

/** Cinza para quem não tem nome: inventar cor para a silhueta seria dar identidade ao vazio. */
const SEM_NOME = 'border-strong bg-surface text-soft'

/**
 * A mesma pessoa cai sempre na mesma cor.
 *
 * Soma dos códigos das letras, e nada mais esperto: a exigência é ser estável
 * entre a fila e o cabeçalho, e entre hoje e amanhã, não ser bem distribuída.
 * Duas pessoas dividindo cor não atrapalha ninguém; a mesma pessoa trocando de
 * cor a cada tela, sim.
 */
function corDoNome(nome: string): string {
  let soma = 0
  for (let i = 0; i < nome.length; i += 1) soma += nome.charCodeAt(i)
  return CORES[soma % CORES.length] ?? SEM_NOME
}

/**
 * O fundo do selo de cada canal. O Instagram é o gradiente da marca porque é
 * assim que ele é reconhecido de relance; em cor chapada, o rosa passaria por
 * um alerta.
 */
const FUNDO_DO_SELO: Partial<Record<CanalId, string>> = {
  instagram: 'linear-gradient(45deg, #F58529 0%, #DD2A7B 55%, #8134AF 100%)',
}

export function Avatar({
  nome,
  alerta = false,
  tamanho = 36,
  canal,
}: {
  nome: string | null
  alerta?: boolean
  /** Em pixels. 44 na fila; 40 no cabeçalho e no topo da ficha. */
  tamanho?: number
  /**
   * Por onde a pessoa fala. Desenha o selo da marca no canto de baixo, e é a
   * única pista do canal na linha da fila: o João do WhatsApp e o do Instagram
   * são duas conversas, e o nome sozinho não separa um do outro.
   */
  canal?: CanalId
}) {
  const limpo = nome?.trim() ?? ''
  const iniciais = limpo
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()

  return (
    <span
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.3) }}
      className={`relative flex shrink-0 items-center justify-center rounded-full border font-bold ${limpo ? corDoNome(limpo) : SEM_NOME}`}
    >
      {limpo ? (
        iniciais
      ) : (
        /* Sem nome (visitante do site, quase sempre): uma silhueta, e não
           "?". O ponto de interrogação lia como erro, como se faltasse dado
           que devia estar ali; a silhueta diz só "alguém", que é o que é. */
        <svg aria-hidden viewBox="0 0 24 24" width={Math.round(tamanho * 0.55)} height={Math.round(tamanho * 0.55)} className="fill-current opacity-70">
          <circle cx="12" cy="8.2" r="4.2" />
          <path d="M3.8 21c.6-4.4 4-7.3 8.2-7.3s7.6 2.9 8.2 7.3c.1.6-.4 1-1 1H4.8c-.6 0-1.1-.4-1-1Z" />
        </svg>
      )}
      {/* A borda do ponto é da cor do painel: é ela que separa o vermelho do
          avatar sem desenhar um anel. */}
      {alerta && (
        <span
          className={`absolute -right-0.5 size-2.5 rounded-full border-2 border-panel bg-rose-500 ${canal ? '-top-0.5' : '-bottom-0.5'}`}
        />
      )}
      {/* Com o selo no canto de baixo, o ponto de alerta sobe: os dois são
          informação, e um não pode tampar o outro. */}
      {canal && (
        <span
          title={DEFINICAO_DO_CANAL[canal].nome}
          style={{ background: FUNDO_DO_SELO[canal] ?? DEFINICAO_DO_CANAL[canal].cor }}
          className="absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full border-2 border-panel text-white"
        >
          <LogoDoCanal canal={canal} tamanho={10} />
        </span>
      )}
    </span>
  )
}
