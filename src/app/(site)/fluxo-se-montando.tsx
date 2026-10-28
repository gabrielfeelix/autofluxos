'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { GLIFO_INSTAGRAM, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import { ICONES, NOMES } from '@/core/flow/blocos'
import f from './fluxo-se-montando.module.css'

/*
 * O fluxo se montando (seção 2 do `docs/PLANO-LP-V2.md`). Nenhum dos 24
 * concorrentes lidos em 28/out mostra o editor de fluxo, e ele é o nome do
 * produto. Ao rolar, os fios saem dos canais, ligam os blocos e chegam às
 * integrações; depois uma mensagem percorre o caminho escolhido.
 *
 * **Os fios são medidos, não desenhados à mão.** Cada ponta é um elemento com
 * `data-no`, e as curvas saem da posição real dele. Assim o mesmo desenho serve
 * na horizontal (computador) e na vertical (celular), e mexer num texto não
 * desalinha nada.
 *
 * O avanço é a variável `--s` (0 a 5, uma unidade por coluna) escrita direto no
 * estilo a cada quadro, sem passar pelo React: o CSS acende colunas e desenha
 * fios a partir dela.
 */

type Ponta = string
type Fio = { de: Ponta; para: Ponta; coluna: number; caminho?: boolean; deNoCelular?: Ponta }

const FIOS: Fio[] = [
  { de: 'whatsapp', para: 'boasVindas', coluna: 0, caminho: true },
  { de: 'instagram', para: 'boasVindas', coluna: 0 },
  { de: 'site', para: 'boasVindas', coluna: 0 },
  { de: 'telegram', para: 'boasVindas', coluna: 0 },
  { de: 'boasVindas', para: 'pergunta', coluna: 1, caminho: true },
  { de: 'saidaHorario', para: 'horario', coluna: 2 },
  { de: 'saidaPedido', para: 'ia', coluna: 2, caminho: true, deNoCelular: 'pergunta' },
  { de: 'saidaVisita', para: 'agendar', coluna: 2 },
  { de: 'ia', para: 'magento', coluna: 3, caminho: true },
  { de: 'ia', para: 'asaas', coluna: 3 },
  { de: 'agendar', para: 'agenda', coluna: 3 },
]

const COLUNAS = 5
type Desenho = { largura: number; altura: number; fios: { d: string; coluna: number; caminho: boolean; ordem: number }[] }

export function FluxoSeMontando({ cabeca }: { cabeca: ReactNode }) {
  const secao = useRef<HTMLElement>(null)
  const palco = useRef<HTMLDivElement>(null)
  const [desenho, setDesenho] = useState<Desenho>({ largura: 0, altura: 0, fios: [] })

  // Mede as pontas e refaz as curvas quando o palco muda de tamanho.
  useEffect(() => {
    const el = palco.current
    if (!el) return
    const medir = () => {
      const base = el.getBoundingClientRect()
      const vertical = base.width < 700
      const caixa = (id: string) => {
        const r = el.querySelector<HTMLElement>(`[data-no="${id}"]`)?.getBoundingClientRect()
        return r && r.width > 0 ? r : null
      }
      let ordem = 0
      const fios: Desenho['fios'] = []
      for (const fio of FIOS) {
        const a = caixa(vertical && fio.deNoCelular ? fio.deNoCelular : fio.de)
        const b = caixa(fio.para)
        if (!a || !b) continue
        let d: string
        if (vertical) {
          const x1 = a.left + a.width / 2 - base.left
          const y1 = a.bottom - base.top
          const x2 = b.left + b.width / 2 - base.left
          const y2 = b.top - base.top
          const m = (y2 - y1) / 2
          d = `M${x1} ${y1}C${x1} ${y1 + m} ${x2} ${y2 - m} ${x2} ${y2}`
        } else {
          const x1 = a.right - base.left
          const y1 = a.top + a.height / 2 - base.top
          const x2 = b.left - base.left
          const y2 = b.top + b.height / 2 - base.top
          const m = (x2 - x1) / 2
          d = `M${x1} ${y1}C${x1 + m} ${y1} ${x2 - m} ${y2} ${x2} ${y2}`
        }
        fios.push({ d, coluna: fio.coluna, caminho: !!fio.caminho, ordem: fio.caminho ? ordem++ : -1 })
      }
      setDesenho({ largura: base.width, altura: base.height, fios })
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  // A rolagem vira `--s`. Sem movimento, fica tudo pronto e a seção não trava.
  useEffect(() => {
    const el = secao.current
    const p = palco.current
    if (!el || !p || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.dataset.movimento = 'rola'

    let quadro = 0
    const atualizar = () => {
      quadro = 0
      const travada = getComputedStyle(el).getPropertyValue('--travada').trim() === '1'
      let progresso: number
      if (travada) {
        const r = el.getBoundingClientRect()
        progresso = -r.top / Math.max(r.height - window.innerHeight, 1)
      } else {
        // Sem trava (celular): o desenho acompanha o palco atravessando a tela.
        const r = p.getBoundingClientRect()
        progresso = (window.innerHeight * 0.9 - r.top) / (r.height * 0.95)
      }
      // Termina antes do fim da trava, para o fluxo pronto ficar um tempo na tela.
      const s = Math.min(Math.max(progresso * 1.25, 0), 1) * COLUNAS
      p.style.setProperty('--s', s.toFixed(3))
      if (s >= COLUNAS) p.dataset.pronto = ''
    }
    const pedir = () => {
      if (!quadro) quadro = requestAnimationFrame(atualizar)
    }
    atualizar()
    window.addEventListener('scroll', pedir, { passive: true })
    window.addEventListener('resize', pedir)
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('scroll', pedir)
      window.removeEventListener('resize', pedir)
    }
  }, [])

  return (
    <section ref={secao} className={f.secao} id="fluxo">
      <div className={f.trava}>
        {cabeca}

        <div ref={palco} className={f.palco} style={{ '--s': COLUNAS } as CSSProperties}>
          <svg
            className={f.fios}
            width={desenho.largura}
            height={desenho.altura}
            viewBox={`0 0 ${desenho.largura || 1} ${desenho.altura || 1}`}
            aria-hidden
          >
            {desenho.fios.map((fio, i) => (
              <g key={i} style={{ '--c': fio.coluna } as CSSProperties} data-caminho={fio.caminho ? '' : undefined}>
                <path className={f.fio} d={fio.d} pathLength={1} />
                {fio.caminho && (
                  <path className={f.pulso} d={fio.d} pathLength={1} style={{ '--ordem': fio.ordem } as CSSProperties} />
                )}
              </g>
            ))}
          </svg>

          <span className={f.rotulo} style={{ gridColumn: '1' }}>
            Onde o cliente escreve
          </span>
          <span className={f.rotulo} style={{ gridColumn: '2 / 5' }}>
            O fluxo que você desenha
          </span>
          <span className={f.rotulo} style={{ gridColumn: '5' }}>
            De onde vem o dado
          </span>

          <Coluna n={0} classe={f.canais}>
            <Canal id="whatsapp" nome="WhatsApp" cor="#25d366" glifo={GLIFO_WHATSAPP} />
            <Canal id="instagram" nome="Instagram" cor="#e4405f" glifo={GLIFO_INSTAGRAM} />
            <Canal id="site" nome="Site" cor="#6366f1" icone={<IconeSite />} />
            <Canal id="telegram" nome="Telegram" cor="#26a5e4" glifo={GLIFO_TELEGRAM} />
          </Coluna>

          <Coluna n={1}>
            <Bloco id="boasVindas" tipo="mensagem">
              <p>
                Olá, <code>{'{nome}'}</code>! Obrigado pelo contato.
              </p>
            </Bloco>
          </Coluna>

          <Coluna n={2}>
            <Bloco id="pergunta" tipo="pergunta">
              <p>Como podemos ajudar?</p>
              <span className={f.saida} data-no="saidaHorario">
                Horário e endereço
              </span>
              <span className={f.saida} data-no="saidaPedido" data-escolhida="">
                Fazer um pedido
              </span>
              <span className={f.saida} data-no="saidaVisita">
                Marcar uma visita
              </span>
            </Bloco>
          </Coluna>

          <Coluna n={3} classe={f.ramos}>
            <Bloco id="horario" tipo="mensagem" soNoComputador>
              <p>Abrimos de segunda a sábado, das 8h às 18h.</p>
            </Bloco>
            <Bloco id="ia" tipo="ia">
              <p>Responde pelo catálogo e pelas regras da loja.</p>
            </Bloco>
            <Bloco id="agendar" tipo="agendar" soNoComputador>
              <p>Oferece os horários livres da semana.</p>
            </Bloco>
          </Coluna>

          <Coluna n={4} classe={f.integracoes}>
            <Integracao id="magento" nome="Magento" detalhe="Estoque e pedido" icone={<LogoMagento />} />
            <Integracao id="asaas" nome="Asaas" detalhe="Cobrança por Pix" imagem="/logos/marcas/asaas.png" />
            <Integracao id="agenda" nome="Agenda" detalhe="Horários livres" icone={<IconeAgenda />} soNoComputador />
          </Coluna>
        </div>
      </div>
    </section>
  )
}

function Coluna({ n, classe = '', children }: { n: number; classe?: string; children: ReactNode }) {
  return (
    <div className={`${f.coluna} ${classe}`} style={{ '--c': n } as CSSProperties}>
      {children}
    </div>
  )
}

function Canal({ id, nome, cor, glifo, icone }: { id: string; nome: string; cor: string; glifo?: string; icone?: ReactNode }) {
  return (
    <span className={f.canal} data-no={id}>
      <span className={f.marca} style={{ color: cor }}>
        {glifo ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d={glifo} />
          </svg>
        ) : (
          icone
        )}
      </span>
      <span className={f.canalNome}>{nome}</span>
    </span>
  )
}

function Bloco({
  id,
  tipo,
  soNoComputador,
  children,
}: {
  id: string
  tipo: 'mensagem' | 'pergunta' | 'ia' | 'agendar'
  soNoComputador?: boolean
  children: ReactNode
}) {
  return (
    <div className={f.bloco} data-no={id} data-tipo={tipo} data-so-computador={soNoComputador ? '' : undefined}>
      <p className={f.blocoTopo}>
        <span aria-hidden>{ICONES[tipo]}</span>
        {NOMES[tipo]}
      </p>
      <div className={f.blocoCorpo}>{children}</div>
    </div>
  )
}

function Integracao({
  id,
  nome,
  detalhe,
  imagem,
  icone,
  soNoComputador,
}: {
  id: string
  nome: string
  detalhe: string
  imagem?: string
  icone?: ReactNode
  soNoComputador?: boolean
}) {
  return (
    <span className={f.integracao} data-no={id} data-so-computador={soNoComputador ? '' : undefined}>
      <span className={f.marca}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imagem ? <img src={imagem} alt="" width={20} height={20} /> : icone}
      </span>
      <span>
        <strong>{nome}</strong>
        <small>{detalhe}</small>
      </span>
    </span>
  )
}

function IconeSite() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="19" height="14" rx="2.5" />
      <path d="M2.5 7.5h19" />
      <path d="M8 21h8" />
    </svg>
  )
}

function IconeAgenda() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  )
}

/** O símbolo oficial, o mesmo de `public/marcas-de-loja/magento.svg`: aquela pasta pede login no `proxy.ts`. */
function LogoMagento() {
  return (
    <svg width="18" height="18" viewBox="-3.3 0 49.42 49.45" aria-hidden>
      <polygon fill="#f26322" points="21.43 0 0 12.37 0 37.09 6.12 40.62 6.08 15.91 21.39 7.06 36.7 15.91 36.7 40.61 42.82 37.09 42.82 12.35 21.43 0" /><polygon fill="#f26322" points="24.47 40.62 21.41 42.39 18.34 40.63 18.34 15.91 12.22 19.44 12.23 44.15 21.41 49.45 30.59 44.15 30.59 19.44 24.47 15.91 24.47 40.62" />
    </svg>
  )
}
