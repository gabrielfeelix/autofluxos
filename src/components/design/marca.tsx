import Image from 'next/image'

/**
 * A marca do produto, símbolo e nome.
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
 * Aberta, aparece a logo horizontal oficial (símbolo e nome juntos, colorida no
 * tema claro e branca no escuro). Recolhida, a barra esconde o último `span`
 * (a logo horizontal) e mostra o `.marca-simbolo`, que fica escondido por
 * padrão: quem faz as duas coisas é o embrulho em `barra-lateral.tsx`, e por
 * isso a logo horizontal precisa continuar sendo o último filho daqui.
 */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  // A logo horizontal tem proporção 549×120: a altura manda, a largura acompanha.
  const altura = compacta ? 24 : 30
  const largura = Math.round((altura * 549) / 120)

  return (
    <div className="flex items-center">
      <Image
        src="/logos/logo-dialogon-marca.png"
        alt="Dialogon"
        width={altura}
        height={altura}
        priority
        className="marca-simbolo hidden shrink-0"
      />
      <span className="flex">
        <Image src="/logos/dialogon-horizontal.png" alt="Dialogon" width={largura} height={altura} priority className="dark:hidden" />
        <Image src="/logos/dialogon-horizontal-branca.png" alt="" width={largura} height={altura} priority className="hidden dark:block" />
      </span>
    </div>
  )
}
