import Link from 'next/link'
import { idadeDoEvento, type EstadoDaConexao } from '@/core/conexoes'

const TEXTO_DA_AUTORIZACAO = {
  valida: 'válida',
  vence_em_breve: 'vence em breve',
  vencida: 'vencida',
} as const

/**
 * As quatro camadas de uma conexão, uma por linha (tarefa 6.4): cadastro,
 * autorização, último evento e falha. Cada uma responde sozinha; a falha só
 * aparece quando existe, e a próxima ação vem junto dela.
 *
 * `rotuloDoEvento` diz o que o evento é naquela conexão ("Última mensagem
 * recebida na conta", "Último contato vindo de anúncio").
 */
export function CamadasDaConexao({
  clienteId,
  estado,
  rotuloDoEvento,
}: {
  clienteId: string
  estado: EstadoDaConexao
  rotuloDoEvento: string
}) {
  if (!estado.configurado) return null

  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px] sm:gap-x-6">
        <dt className="text-dim">Cadastro</dt>
        <dd className="font-semibold">feito</dd>
        {estado.autorizacao !== 'nao_se_aplica' && (
          <>
            <dt className="text-dim">Autorização</dt>
            <dd
              className={`font-semibold ${
                estado.autorizacao === 'vencida'
                  ? 'text-perigo'
                  : estado.autorizacao === 'vence_em_breve'
                    ? 'text-aviso'
                    : ''
              }`}
            >
              {TEXTO_DA_AUTORIZACAO[estado.autorizacao]}
            </dd>
          </>
        )}
        <dt className="text-dim">{rotuloDoEvento}</dt>
        <dd className="font-semibold">{idadeDoEvento(estado.ultimoEvento)}</dd>
      </dl>
      {estado.falha && (
        <p className="mt-2.5 rounded-[10px] bg-red-500/10 px-3 py-2 text-[12px] leading-5 text-red-700 dark:text-red-300">
          {estado.falha}
          {estado.proximaAcao && (
            <>
              {' '}
              <Link
                href={`/clientes/${clienteId}${estado.proximaAcao.href}`}
                className="font-bold underline"
              >
                {estado.proximaAcao.texto} ›
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}
