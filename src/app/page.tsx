import { PaginaDoSite, SecaoFluxo, SecaoOQueFaz } from './(site)/pagina-do-site'
import {
  CapaDaHome,
  SecaoDoisLados,
  SecaoDuvidasCurtas,
  SecaoIntegracoesResumo,
  SecaoNichos,
  SecaoNumeros,
  SecaoPrecoResumo,
} from './(site)/secoes-do-site'
import { metadadosDoSite } from './(site)/metadados'

/**
 * A porta de entrada pública do AutoFluxos.
 *
 * **Esta rota era o painel e virou o site.** O painel foi para `/painel`. A
 * Meta exige, para a verificação do Tech Provider, "um site completo que
 * mostre o serviço e os detalhes da empresa".
 *
 * Uma ideia por seção, e o detalhe na página própria
 * (`docs/PLANO-SITE-INSTITUCIONAL.md`): prova, como resolve, o medo do celular,
 * para quem é, o que faz, com o que liga, quanto custa e as dúvidas de sempre.
 */
export const metadata = metadadosDoSite(
  '/',
  'AutoFluxos: o WhatsApp da sua empresa respondendo na hora',
  'Chatbot, IA e Inbox da equipe no WhatsApp da sua empresa. O que se repete se resolve na conversa; o que precisa de gente chega à equipe com o histórico.',
)

export default function PaginaInicial() {
  return (
    <PaginaDoSite capa={<CapaDaHome />}>
      <SecaoNumeros />
      <SecaoFluxo />
      <SecaoDoisLados />
      <SecaoNichos />
      <SecaoOQueFaz />
      <SecaoIntegracoesResumo />
      <SecaoPrecoResumo />
      <SecaoDuvidasCurtas />
    </PaginaDoSite>
  )
}
