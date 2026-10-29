import { PaginaDoSite, SecaoComo, SecaoFluxo, SecaoNaPratica, SecaoOQueFaz } from '../(site)/pagina-do-site'
import { CapaSimples, SecaoCanais, SecaoDoisLados, SecaoPartesDoProduto } from '../(site)/secoes-do-site'
import { metadadosDoSite } from '../(site)/metadados'

export const metadata = metadadosDoSite(
  '/produto',
  'O produto: fluxos, IA, Inbox e canais | AutoFluxos',
  'Fluxos visuais, IA que responde pelo seu negócio, Inbox da equipe, contatos e funil, no WhatsApp, Instagram, chat do site e Telegram.',
)

export default function PaginaDoProduto() {
  return (
    <PaginaDoSite
      capa={
        <CapaSimples
          olho="O produto"
          titulo="Tudo o que acontece numa conversa, num lugar só"
          texto="Fluxos que você desenha, IA que lê o seu negócio, a fila da equipe e a ficha de cada cliente. No número que você já usa."
        />
      }
    >
      <SecaoCanais />
      <SecaoPartesDoProduto />
      <SecaoFluxo />
      <SecaoDoisLados />
      <SecaoNaPratica />
      <SecaoOQueFaz />
      <SecaoComo />
    </PaginaDoSite>
  )
}
