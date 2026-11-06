import { llmsTxt } from '../(site)/para-agentes'
import { respostaEmTexto } from '../(site)/resposta-em-texto'

/** Índice do Dialogon para assistentes de IA (llmstxt.org). Gerado das mesmas fontes do site: ver `(site)/para-agentes.ts`. */
export const dynamic = 'force-static'

export function GET() {
  return respostaEmTexto(llmsTxt(), 'text/plain')
}
