import { Esqueleto, EsqueletoDeAjuste, EsqueletoDeCartoes } from '@/components/design/esqueleto'

/**
 * O índice de Configurações enquanto vem: título, frase e os grupos de
 * cartões. Cada subtela tem o seu `loading.tsx`; este só cobre o índice.
 */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Configurações"
      trilha={[]}
      descricao="O que se ajusta uma vez: quem é a organização e quem tem acesso, o que o bot sabe responder e com quem o sistema fala."
    >
      {[0, 1].map((grupo) => (
        <section key={grupo} className="mt-7 first:mt-2">
          <Esqueleto className="h-3.5 w-32" />
          <Esqueleto className="mt-2 mb-3 h-3 w-80 max-w-full" />
          <EsqueletoDeCartoes quantidade={grupo === 0 ? 4 : 3} altura="h-[120px]" />
        </section>
      ))}
    </EsqueletoDeAjuste>
  )
}
