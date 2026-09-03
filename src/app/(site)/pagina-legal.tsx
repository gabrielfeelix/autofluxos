import Link from 'next/link'
import type { ReactNode } from 'react'
import { IndiceAtivo } from './indice-ativo'
import s from './privacidade.module.css'

/**
 * A moldura das páginas legais públicas — privacidade, termos e exclusão de
 * dados.
 *
 * **Ela nasceu de uma cópia que estava prestes a virar três.** A política de
 * privacidade tinha cabeçalho, capa, índice, seções numeradas, fecho e rodapé
 * escritos à mão dentro dela; a Meta exige mais duas páginas com exatamente a
 * mesma cara, e triplicar isso significaria três lugares para consertar o
 * rodapé, três listas de ícones e três chances de as páginas se descolarem
 * visualmente sem ninguém perceber.
 *
 * O que muda de uma página para outra é só conteúdo: título, resumo, selos da
 * capa e as seções. O resto é igual por decisão, não por acaso — são
 * documentos do mesmo emissor e precisam parecer o mesmo documento.
 *
 * Elas abrem **sem sessão** (ver `PORTAS_ABERTAS` em `proxy.ts`): quem revisa
 * o app na Meta não tem conta aqui, e página que redireciona para o login é,
 * para efeito de análise, página que não existe. Nenhuma delas lê banco.
 */

/** Os ícones que a capa aceita nos selos. Nome, não componente, para o conteúdo
 * de cada página não precisar conhecer o SVG. */
export type IconeDeSelo = 'escudo' | 'proibido' | 'relogio' | 'lixeira' | 'documento'

export type SeloDaCapa = { icone: IconeDeSelo; texto: string }

/** Título, âncora e corpo de cada seção. O índice e a numeração leem daqui. */
export type SecaoLegal = { id: string; titulo: string; conteudo: ReactNode }

export function PaginaLegal({
  titulo,
  resumo,
  selos,
  atualizadaEm,
  secoes,
  fecho,
  rotuloDoIndice = `Índice de ${titulo.toLowerCase()}`,
}: {
  titulo: string
  resumo: ReactNode
  selos: readonly SeloDaCapa[]
  atualizadaEm: string
  secoes: readonly SecaoLegal[]
  fecho: { texto: ReactNode; rotulo: string; href: string }
  rotuloDoIndice?: string
}) {
  return (
    <div className={s.pagina}>
      <IndiceAtivo seletorSecao={s.secao} classeAtivo={s.indiceAtivo} />

      <header className={s.cabecalho}>
        <div className={`${s.faixa} ${s.cabecalhoInterno}`}>
          <Link className={s.marca} href="/">
            <span className={s.marcaSigla} aria-hidden>
              <IconeFluxo />
            </span>
            AutoFluxos
          </Link>
          <Link className={s.voltar} href="/">
            <IconeVoltar />
            Voltar ao site
          </Link>
        </div>
      </header>

      <section className={s.capa}>
        <div className={s.capaGrade} aria-hidden />
        <div className={s.capaBrilho} aria-hidden />

        <div className={s.faixa}>
          <span className={s.olho}>4YU · AutoFluxos</span>
          <h1 className={s.titulo}>{titulo}</h1>
          <p className={s.resumo}>{resumo}</p>

          <div className={s.selos}>
            {selos.map((selo) => (
              <span className={s.selo} key={selo.texto}>
                <span className={s.seloIcone} aria-hidden>
                  <IconeDoSelo nome={selo.icone} />
                </span>
                {selo.texto}
              </span>
            ))}
          </div>

          <p className={s.data}>Atualizada em {atualizadaEm}</p>
        </div>
      </section>

      <main className={`${s.faixa} ${s.corpo}`}>
        <nav className={s.indice} aria-label={rotuloDoIndice}>
          <span className={s.indiceTitulo}>Nesta página</span>
          {secoes.map((secao, i) => (
            <a
              key={secao.id}
              className={s.indiceLink}
              href={`#${secao.id}`}
              data-n={String(i + 1).padStart(2, '0')}
            >
              {secao.titulo}
            </a>
          ))}
        </nav>

        <div className={s.texto}>
          {secoes.map((secao, i) => (
            <section className={s.secao} id={secao.id} key={secao.id}>
              <div className={s.secaoTopo}>
                <span className={s.secaoNumero} aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className={s.secaoTitulo}>{secao.titulo}</h2>
              </div>
              <div className={s.secaoCorpo}>{secao.conteudo}</div>
            </section>
          ))}

          <div className={s.fecho}>
            <p className={s.fechoTexto}>{fecho.texto}</p>
            <a className={s.fechoBotao} href={fecho.href}>
              {fecho.rotulo}
            </a>
          </div>
        </div>
      </main>

      <footer className={s.rodape}>
        <div className={s.faixa}>
          AutoFluxos é um produto da <a href="https://4yu.com.br" rel="noopener">4YU</a> · Gabriel
          Felix Barbosa · CNPJ 68.770.493/0001-82 · Maringá, PR
          <br />
          WhatsApp é marca da Meta Platforms. Usamos a API oficial do WhatsApp Business e não
          somos afiliados à Meta.
        </div>
      </footer>
    </div>
  )
}

/**
 * A lista com marcador desenhado do documento.
 *
 * Existe aqui, e não como `<ul>` cru na página, porque o marcador é o
 * `::before` do CSS module — sem a classe certa a lista sai com o bullet
 * padrão do navegador no meio de um documento que não tem nenhum.
 */
export function Lista({ children }: { children: ReactNode }) {
  return <ul className={s.lista}>{children}</ul>
}

export function Item({ children }: { children: ReactNode }) {
  return <li className={s.item}>{children}</li>
}

/* ─────────────────────────── ícones ─────────────────────────── */

function IconeDoSelo({ nome }: { nome: IconeDeSelo }) {
  switch (nome) {
    case 'escudo':
      return <IconeEscudo />
    case 'proibido':
      return <IconeProibido />
    case 'relogio':
      return <IconeRelogio />
    case 'lixeira':
      return <IconeLixeira />
    case 'documento':
      return <IconeDocumento />
  }
}

function IconeFluxo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M8.5 7 15.5 11M8.5 17 15.5 13" strokeLinecap="round" />
    </svg>
  )
}

function IconeVoltar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 12H6M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeEscudo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 3l7 3v6c0 4.2-2.8 7.6-7 9-4.2-1.4-7-4.8-7-9V6z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeProibido() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="m6 6 12 12" strokeLinecap="round" />
    </svg>
  )
}

function IconeRelogio() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.4l3.4 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeLixeira() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 7h16M9 7V5h6v2M6.5 7l.8 12h9.4l.8-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeDocumento() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  )
}
