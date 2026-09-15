/**
 * As iniciais de quem está do outro lado, com o ponto vermelho de quem espera.
 *
 * **Mora em arquivo próprio porque é usado dos dois lados da fronteira**: a
 * linha da fila (`components/inbox/fila.tsx`, cliente) e o cabeçalho da
 * conversa (`inbox/page.tsx`, servidor). Sem `'use client'` de propósito —
 * não tem estado nem efeito, então serve aos dois sem obrigar ninguém a virar
 * componente de cliente.
 *
 * ---------------------------------------------------------------------------
 * Por que a cor vem do nome, e não uma foto
 * ---------------------------------------------------------------------------
 *
 * **A Cloud API não expõe foto de perfil de contato.** O webhook entrega
 * `contacts[].profile` com só o nome; o único `profile_picture_url` que existe
 * é o do próprio negócio — o nosso lado, não o dela. Quem mostra foto de
 * contato no mercado está rodando provedor não oficial por cima do WhatsApp
 * Web, que é o caminho que arrisca banir o número do cliente.
 *
 * Então a cor derivada do nome não é um consolo: é o que uma fila de trinta
 * conversas cinza-iguais precisa para virar uma lista em que se acha alguém de
 * relance. É o mesmo truque de Slack e Google, e é só tela.
 */

/**
 * As cores possíveis, escritas por extenso.
 *
 * Classe inteira, e não `bg-[hsl(${x})]`: o Tailwind lê o código fonte para
 * decidir o que gerar, e classe montada em tempo de execução simplesmente não
 * sai no CSS. O sintoma seria um avatar transparente, sem erro nenhum.
 */
const CORES = [
  'border-sky-400/25 bg-sky-400/[0.14] text-sky-200',
  'border-violet-400/25 bg-violet-400/[0.14] text-violet-200',
  'border-emerald-400/25 bg-emerald-400/[0.14] text-emerald-200',
  'border-amber-400/25 bg-amber-400/[0.14] text-amber-200',
  'border-rose-400/25 bg-rose-400/[0.14] text-rose-200',
  'border-teal-400/25 bg-teal-400/[0.14] text-teal-200',
  'border-indigo-400/25 bg-indigo-400/[0.14] text-indigo-200',
  'border-orange-400/25 bg-orange-400/[0.14] text-orange-200',
] as const

/** Cinza para quem não tem nome: inventar cor para "?" seria dar identidade ao vazio. */
const SEM_NOME = 'border-white/[0.11] bg-white/[0.05] text-[#b9c2d0]'

/**
 * A mesma pessoa cai sempre na mesma cor.
 *
 * Soma dos códigos das letras, e nada mais esperto: a exigência é ser estável
 * entre a fila e o cabeçalho, e entre hoje e amanhã — não ser bem distribuída.
 * Duas pessoas dividindo cor não atrapalha ninguém; a mesma pessoa trocando de
 * cor a cada tela, sim.
 */
function corDoNome(nome: string): string {
  let soma = 0
  for (let i = 0; i < nome.length; i += 1) soma += nome.charCodeAt(i)
  return CORES[soma % CORES.length] ?? SEM_NOME
}

export function Avatar({ nome, alerta }: { nome: string | null; alerta: boolean }) {
  const limpo = nome?.trim() ?? ''
  const iniciais = (limpo || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()

  return (
    <span
      className={`relative flex size-9 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${limpo ? corDoNome(limpo) : SEM_NOME}`}
    >
      {iniciais}
      {alerta && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[#0c1118] bg-rose-400" />}
    </span>
  )
}
