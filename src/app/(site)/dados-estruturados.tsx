import { PLANOS } from '@/core/planos'
import { SITE_URL } from './metadados'

/**
 * Renderiza um bloco JSON-LD. O `replace` troca `<` pelo equivalente unicode
 * para que um texto com `</script>` não feche a tag (padrão da doc do Next).
 */
export function DadosEstruturados({ dados }: { dados: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, '\\u003c') }} />
}

/** Organization e WebSite da home. */
export function DadosDaOrganizacao() {
  return (
    <>
      <DadosEstruturados
        dados={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Dialogon',
          url: SITE_URL,
          logo: `${SITE_URL}/logos/logo-dialogon-marca.png`,
          email: 'contato@dialogon.com.br',
          // O @dialogon tem outro dono; o perfil oficial é este até a marca ser registrada.
          sameAs: ['https://www.instagram.com/usedialogon/'],
          parentOrganization: { '@type': 'Organization', name: '4YU' },
        }}
      />
      <DadosEstruturados dados={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Dialogon', url: SITE_URL }} />
    </>
  )
}

/** O preço vem de `PLANOS`, a mesma fonte de /precos: o menor plano é o "a partir de". */
export function DadosDoAplicativo({ descricao }: { descricao: string }) {
  const menorPreco = Math.min(...PLANOS.map((p) => p.preco))
  return (
    <DadosEstruturados
      dados={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Dialogon',
        description: descricao,
        url: SITE_URL,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: menorPreco, priceCurrency: 'BRL' },
      }}
    />
  )
}

/** Trilha de navegação; cada item leva o caminho da própria página, o último inclusive. */
export function DadosDaTrilha({ itens }: { itens: { nome: string; caminho: string }[] }) {
  return (
    <DadosEstruturados
      dados={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: itens.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.nome, item: `${SITE_URL}${item.caminho}` })),
      }}
    />
  )
}
