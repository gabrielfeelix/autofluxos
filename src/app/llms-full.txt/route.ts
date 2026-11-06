import { llmsFullTxt } from '../(site)/para-agentes'
import { respostaEmTexto } from '../(site)/resposta-em-texto'

/** O site inteiro do Dialogon em texto puro, para assistentes de IA. Gerado das mesmas fontes do site: ver `(site)/para-agentes.ts`. */
export const dynamic = 'force-static'

export function GET() {
  return respostaEmTexto(llmsFullTxt(), 'text/plain')
}
