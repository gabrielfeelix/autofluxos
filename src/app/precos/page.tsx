import { PaginaDoSite, SecaoDuvidas, SecaoPrecos } from '../(site)/pagina-do-site'
import { CapaSimples, SecaoCalculadora } from '../(site)/secoes-do-site'
import { SecaoComparacao } from '../(site)/precos-pagina'
import { DadosDoAplicativo } from '../(site)/dados-estruturados'
import { metadadosDoSite } from '../(site)/metadados'

const DESCRICAO = 'Planos do Dialogon, teste grátis e a calculadora do que a Meta cobra pelas mensagens do WhatsApp, repassado sem acréscimo.'

export const metadata = metadadosDoSite('/precos', 'Preços e custo das mensagens da Meta | Dialogon', DESCRICAO)

export default function PaginaDePrecos() {
  return (
    <PaginaDoSite
      capa={
        <CapaSimples
          olho="Preços"
          titulo="Um preço que cabe antes de dar resultado"
          texto="Plano mensal sem fidelidade, teste antes de pagar, e o custo da Meta calculado aqui mesmo, sem surpresa na fatura."
        />
      }
    >
      <DadosDoAplicativo descricao={DESCRICAO} />
      <SecaoPrecos />
      <SecaoComparacao />
      <SecaoCalculadora />
      <SecaoDuvidas />
    </PaginaDoSite>
  )
}
