'use client'

import Link from 'next/link'
import { Avatar } from '@/components/design/avatar'
import { classesDoBotao } from '@/components/design/botao'
import { Dropdown } from '@/components/design/dropdown'
import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { ROTULO_DA_SITUACAO, SITUACOES_DA_SUGESTAO, type SituacaoDaSugestao } from '@/core/sugestoes'
import { acaoTriarSugestao } from '@/server/acoes-sugestao'

const COR_DA_SITUACAO: Record<SituacaoDaSugestao, string> = {
  nova: 'bg-primary',
  planejada: 'bg-amber-500',
  feita: 'bg-emerald-500',
  descartada: 'bg-dim',
}

function Ponto({ situacao }: { situacao: SituacaoDaSugestao }) {
  return <span aria-hidden className={`size-2 rounded-full ${COR_DA_SITUACAO[situacao]}`} />
}

const OPCOES = SITUACOES_DA_SUGESTAO.map((valor) => ({ valor, rotulo: ROTULO_DA_SITUACAO[valor], icone: <Ponto situacao={valor} /> }))

/**
 * O "Responder" abre o e-mail já com a sugestão citada: quem escreveu lembra do
 * que pediu, e a 4YU não precisa copiar e colar o texto.
 */
function emailDeResposta(email: string, quem: string, texto: string): string {
  const primeiroNome = quem.includes('@') ? '' : (quem.trim().split(/\s+/)[0] ?? '')
  const citacao = texto
    .split('\n')
    .map((linha) => `> ${linha}`)
    .join('\n')
  const corpo = `Olá${primeiroNome ? `, ${primeiroNome}` : ''}!\n\nRecebemos a sua sugestão no Dialogon:\n\n${citacao}\n\n`
  return `mailto:${email}?subject=${encodeURIComponent('Sobre a sua sugestão no Dialogon')}&body=${encodeURIComponent(corpo)}`
}

export type DadosDoCartao = {
  id: string
  organizacaoId: string | null
  organizacaoNome: string
  quem: string
  email: string
  imagem: string | null
  tela: string
  nomeDaTela: string
  texto: string
  situacao: SituacaoDaSugestao
  quando: string
  /** Já formatado no servidor, para o relógio não divergir na hidratação. */
  quandoEscrito: string
  triagem: string
}

/**
 * Uma sugestão: quem pediu, de onde, o texto inteiro e a triagem da 4YU.
 * A situação troca na hora e o servidor confirma atrás (`useAcaoOtimista`);
 * se recusar, volta e diz o porquê ali mesmo.
 */
export function CartaoDeSugestao({ sugestao }: { sugestao: DadosDoCartao }) {
  const { valor: situacao, erro, pendente, agir } = useAcaoOtimista<SituacaoDaSugestao>(sugestao.situacao)
  const encerrada = situacao === 'feita' || situacao === 'descartada'

  return (
    <li className="app-card flex gap-3.5 px-4 py-4 md:gap-4 md:px-5">
      <Avatar nome={sugestao.quem} imagem={sugestao.imagem} tamanho={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="truncate text-[13.5px] font-bold text-ink" title={sugestao.email}>
            {sugestao.quem}
          </p>
          {sugestao.organizacaoId ? (
            <Link
              href={`/admin/organizacoes/${sugestao.organizacaoId}`}
              className="truncate text-[12.5px] font-semibold text-muted hover:text-primary hover:underline"
            >
              {sugestao.organizacaoNome}
            </Link>
          ) : (
            <span className="truncate text-[12.5px] font-semibold text-muted">{sugestao.organizacaoNome}</span>
          )}
          <time dateTime={sugestao.quando} className="text-[11.5px] text-dim tabular-nums md:ml-auto">
            {sugestao.quandoEscrito}
          </time>
        </div>

        <p className={`mt-2 text-[14px] leading-[1.6] whitespace-pre-wrap ${encerrada ? 'text-muted' : 'text-soft'}`}>{sugestao.texto}</p>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span
            title={sugestao.tela}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold text-muted"
          >
            <IconeTela />
            {sugestao.nomeDaTela}
          </span>
          {sugestao.triagem && situacao === sugestao.situacao && <span className="text-[11.5px] text-dim">{sugestao.triagem}</span>}
          <div className="ml-auto flex items-center gap-2">
            <a href={emailDeResposta(sugestao.email, sugestao.quem, sugestao.texto)} className={classesDoBotao({ variante: 'fantasma', tamanho: 'sm' })}>
              Responder
            </a>
            <Dropdown
              opcoes={OPCOES}
              valor={situacao}
              aoMudar={(nova) => {
                if (nova === situacao) return
                agir(nova as SituacaoDaSugestao, () => acaoTriarSugestao(sugestao.id, nova))
              }}
              rotuloAcessivel="Situação da sugestão"
              desabilitado={pendente}
              className="w-[148px]"
            />
          </div>
        </div>
        {erro && <p className="mt-2 text-right text-[11.5px] font-semibold text-perigo">{erro}</p>}
      </div>
    </li>
  )
}

function IconeTela() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 21h8" />
    </svg>
  )
}
