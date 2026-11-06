import { apiEmMarkdown } from '../(site)/para-agentes'
import { respostaEmTexto } from '../(site)/resposta-em-texto'

/** A API do Dialogon em Markdown. Gerado das mesmas fontes do site: ver `(site)/para-agentes.ts`. */
export const dynamic = 'force-static'

export function GET() {
  return respostaEmTexto(apiEmMarkdown(), 'text/markdown')
}
