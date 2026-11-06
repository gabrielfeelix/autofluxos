import Link from 'next/link'
import { metadadosDoSite } from '../(site)/metadados'
import { FATOS_CURTOS, PROMPT_PARA_AGENTE, RECURSOS_PARA_AGENTES, RESUMO } from '../(site)/para-agentes'
import { TrocaDePublico } from '../(site)/troca-de-publico'
import { CopiarPrompt } from './copiar-prompt'
import s from './para-agentes.module.css'

/**
 * O Dialogon para assistentes de IA: o que é, o prompt para colar e os
 * endereços em texto puro. Sem cabeçalho nem rodapé do site, de propósito:
 * quem chega aqui é um agente lendo HTML ou uma pessoa que vai copiar um
 * endereço, e os dois querem o texto, não a vitrine.
 *
 * Os endereços e os fatos vêm de `(site)/para-agentes.ts`, a mesma fonte do
 * `llms.txt`.
 */
export const metadata = metadadosDoSite(
  '/para-agentes',
  'Dialogon para agentes de IA | llms.txt, preços e API em texto puro',
  'O Dialogon em texto puro para assistentes de IA: llms.txt, llms-full.txt, preços, integrações, dúvidas e API em Markdown.',
)

export default function PaginaParaAgentes() {
  return (
    <div className={s.pagina}>
      <div className={s.coluna}>
        <TrocaDePublico atual="agentes" tom="escuro" />

        <p className={s.arroba}>
          <span className={s.sinal}>&gt;</span> @agente
        </p>

        <h1 className={s.titulo}>Dialogon para agentes. Cole isto no seu assistente de IA:</h1>

        <div className={s.prompt}>
          <code>{PROMPT_PARA_AGENTE}</code>
          <CopiarPrompt texto={PROMPT_PARA_AGENTE} />
        </div>

        <section className={s.secao}>
          <h2 className={s.comentario}># o que é</h2>
          <p className={s.texto}>{RESUMO}</p>
          <ul className={s.fatos}>
            {FATOS_CURTOS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section className={s.secao}>
          <h2 className={s.comentario}># recursos em texto puro</h2>
          <dl className={s.tabela}>
            {RECURSOS_PARA_AGENTES.map((r) => (
              <div key={r.caminho} className={s.linha}>
                <dt>{r.rotulo}</dt>
                <dd>
                  <a href={r.caminho}>{r.caminho}</a>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={s.secao}>
          <h2 className={s.comentario}># quer testar?</h2>
          <p className={s.texto}>
            A conta fica pronta na hora em <Link href="/criar-conta">/criar-conta</Link>, com teste grátis e sem cartão. Para falar
            com a equipe: <a href="mailto:contato@dialogon.com.br">contato@dialogon.com.br</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
