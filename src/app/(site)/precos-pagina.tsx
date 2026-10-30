import { Fragment } from 'react'
import { ENTERPRISE, PLANOS, RECURSOS_DO_PLANO, anualDoPlano, type Plano } from '@/core/planos'
import s from './pagina-inicial.module.css'
import x from './site.module.css'
import { whatsappDa4yu } from './contato-do-site'
import c from './precos.module.css'

/*
 * As duas peças de `/precos` além dos cartões dos planos: o Enterprise em
 * destaque e a comparação lado a lado. Tudo sai de `src/core/planos.ts`, o
 * mesmo arquivo que a cobrança lê: um número mudado lá muda aqui.
 */

const reais = (v: number, centavos = false) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: centavos ? 2 : 0, maximumFractionDigits: centavos ? 2 : 0 })

const FALAR_COM_VENDAS = whatsappDa4yu('Olá! Quero conhecer o plano Enterprise do AutoFluxos.')

/* ───────────── Enterprise ───────────── */

/*
 * O que cada item quer dizer, numa linha. A chave é o texto de
 * `ENTERPRISE.itens`: mudou lá, a linha some aqui em vez de mentir.
 */
const DETALHE_DO_ENTERPRISE: Record<string, string> = {
  'Conversas, números e atendentes sob medida': 'O contrato acompanha o tamanho da operação, sem franquia fixa.',
  'Integração com o seu sistema': 'Ligamos o AutoFluxos ao ERP, ao CRM ou ao sistema próprio da empresa.',
  'Robôs montados pela 4YU': 'A 4YU desenha os fluxos da operação junto com a sua equipe.',
  'Gerente de conta': 'Uma pessoa da 4YU acompanha a conta e responde direto.',
}

/**
 * Não é um quarto plano: é o contrato de quem passou da tabela. Por isso fica
 * fora da fileira, na largura toda, no azul da capa com os fios, e sem preço:
 * o valor sai da conversa com vendas.
 */
export function CartaoEnterprise() {
  return (
    <aside className={c.enterprise} data-revela data-como="escala" aria-labelledby="plano-enterprise">
      <div className={c.enterpriseTexto}>
        <h3 id="plano-enterprise">{ENTERPRISE.nome}</h3>
        <p>{ENTERPRISE.resumo} O valor é combinado com vendas, pelo tamanho da operação.</p>
        <a className={`${s.botao} ${x.botaoBranco} ${s.botaoGrande}`} href={FALAR_COM_VENDAS} target="_blank" rel="noopener noreferrer">
          Falar com vendas
        </a>
      </div>
      <dl className={c.enterpriseItens}>
        {ENTERPRISE.itens.map((item) => (
          <div key={item}>
            <dt>{item}</dt>
            {DETALHE_DO_ENTERPRISE[item] && <dd>{DETALHE_DO_ENTERPRISE[item]}</dd>}
          </div>
        ))}
      </dl>
    </aside>
  )
}

/* ───────────── comparação ───────────── */

type Linha = { rotulo: string; valor: (plano: Plano) => string; enterprise: string }

const NUMEROS: Linha[] = [
  { rotulo: 'Mensalidade', valor: (p) => reais(p.preco), enterprise: 'Falar com vendas' },
  {
    rotulo: 'No anual, por mês',
    valor: (p) => {
      const anual = anualDoPlano(p)
      return anual ? reais(anual.porMes) : 'Sem anual'
    },
    enterprise: 'Sob medida',
  },
  { rotulo: 'Conversas por mês', valor: (p) => p.conversas.toLocaleString('pt-BR'), enterprise: 'Sob medida' },
  { rotulo: 'Conversa acima da franquia', valor: (p) => reais(p.precoExcedente, true), enterprise: 'Sob medida' },
  { rotulo: 'Atendentes inclusos', valor: (p) => String(p.atendentes), enterprise: 'Acima de 50' },
  { rotulo: 'Atendente a mais, por mês', valor: (p) => reais(p.precoAtendenteExtra), enterprise: 'Sob medida' },
  { rotulo: 'Números de WhatsApp', valor: (p) => (p.numeros === 1 ? '1' : `Até ${p.numeros}`), enterprise: 'Sob medida' },
  {
    rotulo: 'Respostas de IA por mês',
    valor: (p) => p.tetoIa.toLocaleString('pt-BR') + (p.recursos.includes('chave_propria') ? ', ou sem teto com chave própria' : ''),
    enterprise: 'Sob medida',
  },
  {
    rotulo: 'Envios de transmissão por mês',
    valor: (p) => (p.tetoTransmissoes === null ? 'Sem limite' : p.tetoTransmissoes.toLocaleString('pt-BR')),
    enterprise: 'Sem limite',
  },
]

/*
 * Só o que nenhum plano da tabela tem. "Robôs montados pela 4YU" fica de fora
 * de propósito: em qualquer plano a equipe monta o primeiro fluxo junto, se o
 * cliente pedir (o fechamento da página diz isso), e marcar "não incluso" nos
 * outros mentiria.
 */
const SO_NO_ENTERPRISE = ['Integração com o seu sistema', 'Gerente de conta']

function Visto({ tem }: { tem: boolean }) {
  return tem ? (
    <span className={c.tem}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      <span className={c.leitor}>Incluso</span>
    </span>
  ) : (
    <span className={c.naoTem}>
      <span aria-hidden>–</span>
      <span className={c.leitor}>Não incluso</span>
    </span>
  )
}

export function SecaoComparacao() {
  return (
    <section className={`${s.secao} ${s.secaoTonal}`} id="comparar">
      <div className={s.faixa}>
        <div className={s.cabecaSecao}>
          <span className={s.olho} data-revela>
            Comparar
          </span>
          <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
            Os planos lado a lado
          </h2>
          <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
            Os mesmos números que a fatura usa. Passou da franquia, nada trava: a conversa a mais entra na fatura seguinte.
          </p>
        </div>

        {/*
          No celular a tabela mostra um plano por vez, escolhido aqui. São rádios
          e não estado do React: o `:has()` do CSS esconde as outras colunas e a
          página continua toda no servidor. No computador o seletor some.
        */}
        <div className={c.comparar}>
          <div className={c.seletor} role="radiogroup" aria-label="Plano para comparar">
            {[...PLANOS.map((p) => p.nome), ENTERPRISE.nome].map((nome, i) => (
              <label key={nome}>
                <input type="radio" name="plano-comparado" data-coluna={i + 2} defaultChecked={i === 1} />
                {nome}
              </label>
            ))}
          </div>

        <div className={c.rolagem} data-revela>
          <table className={c.tabela}>
            <thead>
              <tr>
                <th scope="col">
                  <span className={c.leitor}>O que compara</span>
                </th>
                {PLANOS.map((plano) => (
                  <th key={plano.id} scope="col">
                    {plano.nome}
                    <small>{reais(plano.preco)}/mês</small>
                  </th>
                ))}
                <th scope="col" className={c.colunaEnterprise}>
                  {ENTERPRISE.nome}
                  <small>sob consulta</small>
                </th>
              </tr>
            </thead>
            <tbody>
              <Grupo titulo="Tamanho da operação" />
              {NUMEROS.map((linha) => (
                <tr key={linha.rotulo}>
                  <th scope="row">{linha.rotulo}</th>
                  {PLANOS.map((plano) => (
                    <td key={plano.id}>{linha.valor(plano)}</td>
                  ))}
                  <td className={c.colunaEnterprise}>{linha.enterprise}</td>
                </tr>
              ))}
              <Grupo titulo="O que vem no plano" />
              {RECURSOS_DO_PLANO.map((recurso) => (
                <tr key={recurso.chave}>
                  <th scope="row">{recurso.rotulo}</th>
                  {PLANOS.map((plano) => (
                    <td key={plano.id}>
                      <Visto tem={plano.recursos.includes(recurso.chave)} />
                    </td>
                  ))}
                  <td className={c.colunaEnterprise}>
                    <Visto tem />
                  </td>
                </tr>
              ))}
              <Grupo titulo="Só no Enterprise" />
              {SO_NO_ENTERPRISE.map((item) => (
                <tr key={item}>
                  <th scope="row">{item}</th>
                  {PLANOS.map((plano) => (
                    <td key={plano.id}>
                      <Visto tem={false} />
                    </td>
                  ))}
                  <td className={c.colunaEnterprise}>
                    <Visto tem />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </section>
  )
}

function Grupo({ titulo }: { titulo: string }) {
  return (
    <Fragment>
      <tr className={c.grupo}>
        <th scope="colgroup" colSpan={PLANOS.length + 2}>
          {titulo}
        </th>
      </tr>
    </Fragment>
  )
}
