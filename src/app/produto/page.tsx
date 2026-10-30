import { PaginaDoSite, SecaoComo, SecaoFluxo, SecaoNaPratica, SecaoOQueFaz } from '../(site)/pagina-do-site'
import { CapaSimples, SecaoCanais, SecaoDoisLados } from '../(site)/secoes-do-site'
import { SecaoOutrasPartes } from '../(site)/produto-pagina'
import { metadadosDoSite } from '../(site)/metadados'

export const metadata = metadadosDoSite(
  '/produto',
  'Produto: fluxos, IA, Inbox e canais | Dialogon',
  'Fluxos visuais, IA que responde pelo seu negócio, caixa de entrada da equipe, contatos e funil, no WhatsApp, Instagram, site e Telegram.',
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
      <SecaoOutrasPartes />
      <SecaoFluxo />
      <SecaoDoisLados />
      <SecaoNaPratica />
      <SecaoOQueFaz />
      <SecaoComo />
    </PaginaDoSite>
  )
}
