import { NextResponse } from 'next/server'
import { versaoDoDeploy } from '@/lib/versao-do-deploy'

export const dynamic = 'force-dynamic'

/**
 * Qual versão do AutoFluxos está no ar agora.
 *
 * Quem pergunta é a aba aberta (`AvisoDeVersaoNova`): ela guarda a primeira
 * resposta e, quando uma resposta seguinte for diferente, avisa que saiu
 * versão nova. Não há dado de ninguém aqui, só o id do deploy, e a rota fica
 * atrás da sessão como qualquer `/api/` (o proxy responde 401 sem cookie).
 *
 * `no-store` porque a pergunta é justamente "mudou?": uma resposta guardada
 * em cache diria que não mudou para sempre.
 */
export function GET() {
  return NextResponse.json({ versao: versaoDoDeploy() }, { headers: { 'Cache-Control': 'no-store' } })
}
