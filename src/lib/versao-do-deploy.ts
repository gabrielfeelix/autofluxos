/**
 * Qual deploy está respondendo: o mesmo valor no `next.config.ts` (build) e em
 * `/api/versao` (execução).
 *
 * `NEXT_DEPLOYMENT_ID` primeiro porque, quando a Vercel liga a proteção de
 * versão, é ela que o Next usa, e um `deploymentId` diferente no config faz o
 * build recusar (erro E971 do Next). Sem ela, o id do deploy da Vercel; sem
 * Vercel (local, teste), `null`, e o aviso de versão nova fica desligado.
 */
export function versaoDoDeploy(): string | null {
  return (
    process.env.NEXT_DEPLOYMENT_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    null
  )
}
