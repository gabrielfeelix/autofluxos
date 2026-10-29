import { PaginaDoSite } from '../(site)/pagina-do-site'
import { CapaSimples } from '../(site)/secoes-do-site'
import { VitrineDeIntegracoes } from '../(site)/vitrine-de-integracoes'
import { metadadosDoSite } from '../(site)/metadados'
import s from '../(site)/pagina-inicial.module.css'

export const metadata = metadadosDoSite(
  '/integracoes',
  'Integrações | AutoFluxos',
  'Magento, Nuvemshop, Mercado Pago, Asaas, Cardápio Web, Goomer e mais: o AutoFluxos consulta o seu sistema e responde com o dado de verdade.',
)

export default function PaginaDeIntegracoes() {
  return (
    <PaginaDoSite
      capa={
        <CapaSimples
          olho="Integrações"
          titulo="Liga no que você já usa"
          texto="Loja, pagamento, cardápio e anúncio conversam com o fluxo. O cliente pergunta, o AutoFluxos consulta o sistema e responde com o dado de verdade."
        />
      }
    >
      <section className={`${s.secao} ${s.secaoAbaixoDaCapa}`}>
        <div className={s.faixa}>
          <VitrineDeIntegracoes />
        </div>
      </section>
    </PaginaDoSite>
  )
}
