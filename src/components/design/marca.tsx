import Image from 'next/image'

/**
 * A marca do produto — símbolo e nome.
 *
 * **O símbolo é a logo de verdade**, e não mais o quadrado azul com um losango
 * branco que existia como praça-guardada até a logo chegar.
 *
 * O arquivo é PNG com fundo transparente, recortado da arte original (que vinha
 * com 1536×1024 e margem vazia em volta) e reduzido a 256px: o original tinha
 * 1,2 MB e apareceria em **toda** tela do painel, na barra lateral. `next/image`
 * ainda serve a versão do tamanho pedido, então o que chega ao navegador é uma
 * fração disso.
 *
 * `priority` porque a barra lateral é a primeira coisa desenhada em qualquer
 * tela: carregada preguiçosamente, a logo pisca em cada navegação.
 *
 * Recolhida, a barra esconde o nome e deixa só o símbolo — quem faz isso é o
 * `span:last-child` em `barra-lateral.tsx`, e por isso o nome precisa continuar
 * sendo o último filho daqui.
 */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  const lado = compacta ? 24 : 28

  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/logos/logo-autofluxos-marca.png"
        alt="AutoFluxos"
        width={lado}
        height={lado}
        priority
        className="shrink-0"
      />
      <span className={`${compacta ? 'text-sm' : 'text-[15.5px]'} font-bold tracking-[-0.01em]`}>
        AutoFluxos
      </span>
    </div>
  )
}
