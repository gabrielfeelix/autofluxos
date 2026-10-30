import { PaginaDoSite, SecaoFluxo, SecaoOQueFaz } from './(site)/pagina-do-site'
import { SecaoVendaNoChat } from './(site)/venda-no-chat'
import {
  CapaDaHome,
  SecaoDoisLados,
  SecaoDuvidasCurtas,
  SecaoImprovisos,
  SecaoIntegracoesResumo,
  SecaoJornada,
  SecaoNichos,
  SecaoNumeros,
  SecaoPrecoResumo,
} from './(site)/secoes-do-site'
import { DadosDaOrganizacao, DadosDoAplicativo } from './(site)/dados-estruturados'
import { metadadosDoSite } from './(site)/metadados'

/**
 * A porta de entrada pública do Dialogon.
 *
 * **Esta rota era o painel e virou o site.** O painel foi para `/painel`. A
 * Meta exige, para a verificação do Tech Provider, "um site completo que
 * mostre o serviço e os detalhes da empresa".
 *
 * Uma ideia por seção, e o detalhe na página própria
 * (`docs/PLANO-SITE-INSTITUCIONAL.md`): prova, como resolve, o medo do celular,
 * para quem é, o que faz, com o que liga, quanto custa e as dúvidas de sempre.
 */
const TITULO = 'Dialogon, atendimento e vendas no WhatsApp com IA'
const DESCRICAO =
  'Atendimento, vendas e pós-venda no WhatsApp, Instagram e chat do site, com chatbot, IA, funil e pagamento na conversa. Teste por 14 dias.'

export const metadata = metadadosDoSite('/', TITULO, DESCRICAO)

export default function PaginaInicial() {
  return (
    <PaginaDoSite capa={<CapaDaHome />}>
      <DadosDaOrganizacao />
      <DadosDoAplicativo descricao={DESCRICAO} />
      <SecaoNumeros />
      <SecaoJornada />
      <SecaoFluxo />
      <SecaoDoisLados />
      <SecaoVendaNoChat />
      <SecaoNichos />
      <SecaoImprovisos />
      <SecaoOQueFaz />
      <SecaoIntegracoesResumo />
      <SecaoPrecoResumo />
      <SecaoDuvidasCurtas />
    </PaginaDoSite>
  )
}
