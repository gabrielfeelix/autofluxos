'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RESPOSTAS_INICIAIS, respostasOnboardingSchema, type EstadoOnboarding, type RespostasOnboarding } from '@/core/onboarding'
import { MODELOS_DE_QUADRO } from '@/core/quadros-modelos'
import { acaoPrepararConta } from '@/server/acoes-onboarding'

const PASSOS = ['Objetivo', 'Atendimento', 'Preparação', 'Revisão']
const CHATBOTS = [
  { valor: 'recado', titulo: 'Receber e encaminhar', descricao: 'Pergunta o assunto e o nome antes de passar a conversa para sua equipe.' },
  { valor: 'menu-atendimento', titulo: 'Dúvidas frequentes', descricao: 'Um menu com horário, endereço e preços, com opção de falar com uma pessoa.' },
  { valor: 'nenhum', titulo: 'Escolher depois', descricao: 'Continue com sua equipe e crie uma automação quando precisar.' },
]

export function Assistente({ clienteId, nome, inicial, temQuadro, temFluxo }: {
  clienteId: string; nome: string; inicial: EstadoOnboarding | null; temQuadro: boolean; temFluxo: boolean
}) {
  const router = useRouter()
  const [respostas, setRespostas] = useState<RespostasOnboarding>(inicial?.respostas ?? RESPOSTAS_INICIAIS)
  const [concluido, setConcluido] = useState(inicial?.status === 'concluido' ? inicial : null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  const etapa = respostas.etapa
  useEffect(() => { titulo.current?.focus() }, [etapa, concluido])
  const base = `/clientes/${clienteId}`
  function mudar<K extends keyof RespostasOnboarding>(campo: K, valor: RespostasOnboarding[K]) {
    setRespostas((antes) => {
      const novo = { ...antes, [campo]: valor }
      if (campo === 'objetivo') novo.funil = valor === 'atendimento' ? 'nenhum' : antes.funil === 'nenhum' ? 'comercial' : antes.funil
      if (campo === 'atendimento') novo.chatbot = valor === 'hibrido' ? (antes.chatbot === 'nenhum' ? 'recado' : antes.chatbot) : 'nenhum'
      return novo
    })
  }
  async function salvar(acao: 'salvar' | 'adiar' | 'concluir', proxima = etapa) {
    if (salvando) return
    setSalvando(true)
    setErro('')
    try {
      const dados = respostasOnboardingSchema.parse({ ...respostas, etapa: proxima })
      const resultado = await acaoPrepararConta(clienteId, dados, acao)
      if (!resultado.ok) { setErro(resultado.erro); return }
      setRespostas(resultado.estado.respostas)
      if (resultado.estado.status === 'concluido') setConcluido(resultado.estado)
      else if (acao === 'adiar') router.push(base)
    } catch {
      setErro('Não foi possível salvar agora. Suas escolhas continuam aqui; tente novamente.')
    } finally { setSalvando(false) }
  }
  const quadro = MODELOS_DE_QUADRO.find((modelo) => modelo.id === respostas.funil)
  const bot = CHATBOTS.find((modelo) => modelo.valor === respostas.chatbot)
  const vaiCriarQuadro = !!quadro && !temQuadro && respostas.objetivo !== 'atendimento'
  const vaiCriarFluxo = respostas.atendimento === 'hibrido' && respostas.chatbot !== 'nenhum' && !temFluxo
  const headingClass = 'text-2xl font-bold tracking-tight outline-none md:text-[30px]'

  return <main className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-10 md:py-10">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Seu espaço de trabalho</p><p className="text-sm text-muted">{nome}</p></div>
      <Link href={base} className="rounded-lg px-3 py-2 text-xs text-muted hover:bg-panel">Ir ao painel</Link>
    </header>
    {concluido ? <section className="rounded-2xl border border-line bg-panel p-6 md:p-9">
      <span className="mb-5 inline-flex size-12 items-center justify-center rounded-full bg-primary-weak text-xl text-primary" aria-hidden>✓</span>
      <h1 ref={titulo} tabIndex={-1} className={headingClass}>Seu espaço está preparado</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">Agora siga os próximos passos para começar a atender. Você pode ajustar tudo depois em Configurações.</p>
      <div className="mt-7 grid gap-3">
        <Proximo href={`${base}/ajustes/${concluido.respostas.canal}`} titulo={`Conectar ou conferir ${concluido.respostas.canal === 'whatsapp' ? 'WhatsApp' : 'Instagram'}`} descricao="Receba as mensagens no Inbox e envie uma mensagem de teste." />
        {concluido.fluxoId && <Proximo href={`${base}/fluxos/${concluido.fluxoId}`} titulo="Revisar sua automação" descricao={temFluxo ? 'Sua automação existente foi preservada. Confira o conteúdo no editor.' : 'O modelo está em rascunho e pausado. Ajuste os textos, teste, publique e ative quando estiver pronto.'} />}
        {concluido.quadroId && <Proximo href={`${base}/quadros?q=${concluido.quadroId}`} titulo="Abrir seu funil" descricao="Confira as etapas e adicione o primeiro contato quando quiser." />}
        <Proximo href={`${base}/ajustes/horario`} titulo="Definir horário e preparar respostas" descricao="Confira seu expediente. Em Configurações você também encontra Respostas rápidas e Conhecimento da IA." />
      </div>
      <Link href={`${base}/inbox`} className="app-primary-button mt-7 inline-flex px-5 py-3 text-sm">Ir para o Inbox →</Link>
    </section> : <>
      <div className="mb-7"><h1 ref={titulo} tabIndex={-1} className={headingClass}>Vamos preparar seu sistema</h1><p className="mt-2 text-sm leading-6 text-muted">Poucas escolhas para começar com o que faz sentido para sua empresa.</p></div>
      <ol aria-label="Etapas da preparação" className="mb-7 grid grid-cols-4 gap-2">
        {PASSOS.map((nomePasso, indice) => <li key={nomePasso} aria-current={etapa === indice ? 'step' : undefined} className={`border-t-2 pt-3 text-[11px] sm:text-xs ${indice <= etapa ? 'border-primary text-primary' : 'border-line text-dim'}`}><span className="mr-1 font-bold">{indice < etapa ? '✓' : indice + 1}</span>{nomePasso}</li>)}
      </ol>
      <form onSubmit={(event) => { event.preventDefault(); void salvar(etapa === 3 ? 'concluir' : 'salvar', Math.min(3, etapa + 1)) }} className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm" aria-busy={salvando}>
        <fieldset disabled={salvando} className="min-w-0 p-5 md:p-8">
          {etapa === 0 && <Escolhas titulo="O que você quer organizar primeiro?" ajuda="O atendimento fica disponível em qualquer escolha. Vendas também prepara o acompanhamento por etapas." nome="objetivo" valor={respostas.objetivo} mudar={(valor) => mudar('objetivo', valor as RespostasOnboarding['objetivo'])} opcoes={[
            { valor: 'atendimento', titulo: 'Atendimento', descricao: 'Reunir conversas, responder com agilidade e acompanhar os contatos.' },
            { valor: 'vendas', titulo: 'Vendas', descricao: 'Acompanhar oportunidades desde o primeiro contato até o fechamento.' },
            { valor: 'ambos', titulo: 'Atendimento e vendas', descricao: 'Organizar a conversa e acompanhar a negociação no funil.' },
          ]} />}
          {etapa === 1 && <div className="space-y-7">
            <Escolhas titulo="Como você quer atender?" ajuda="Usar funil não exige chatbot. Sua equipe pode fazer todo o atendimento." nome="atendimento" valor={respostas.atendimento} mudar={(valor) => mudar('atendimento', valor as RespostasOnboarding['atendimento'])} opcoes={[
              { valor: 'equipe', titulo: 'Minha equipe responde', descricao: 'As conversas chegam ao Inbox para atendimento humano.' },
              { valor: 'hibrido', titulo: 'Automação com minha equipe', descricao: 'Prepare um rascunho para dúvidas ou triagem, com passagem para uma pessoa.' },
              { valor: 'depois', titulo: 'Decidir depois', descricao: 'Comece pelo Inbox e conheça as possibilidades com calma.' },
            ]} />
            <Escolhas titulo="Por qual canal vamos começar?" ajuda="Você pode conectar outros depois. Esta escolha não muda conexões existentes." nome="canal" valor={respostas.canal} mudar={(valor) => mudar('canal', valor as RespostasOnboarding['canal'])} opcoes={[
              { valor: 'whatsapp', titulo: 'WhatsApp', descricao: 'Conversas pelo número da empresa.' },
              { valor: 'instagram', titulo: 'Instagram', descricao: 'Direct da sua conta profissional.' },
            ]} />
          </div>}
          {etapa === 2 && <div className="space-y-7">
            <div><h2 className="text-lg font-bold">Um ponto de partida para sua rotina</h2><p className="mt-2 text-sm leading-6 text-muted">Escolha os modelos que quer preparar. Você poderá editar os detalhes depois.</p></div>
            {respostas.objetivo !== 'atendimento' && (temQuadro ? <Aviso>Você já tem funil. Vamos preservar suas etapas e seus contatos, sem criar outro automaticamente.</Aviso> : <Escolhas titulo="Como suas oportunidades avançam?" nome="funil" valor={respostas.funil} mudar={(valor) => mudar('funil', valor as RespostasOnboarding['funil'])} opcoes={[
              ...MODELOS_DE_QUADRO.filter((modelo) => ['comercial', 'agendamento', 'pos-venda'].includes(modelo.id)).map((modelo) => ({ valor: modelo.id, titulo: modelo.nome, descricao: modelo.resumo })),
              { valor: 'nenhum', titulo: 'Montar depois', descricao: 'Não criar um funil agora.' },
            ]} />)}
            {respostas.atendimento === 'hibrido' && (temFluxo ? <Aviso>Você já tem automações. Seus fluxos e publicações serão preservados.</Aviso> : <Escolhas titulo="O que vale automatizar primeiro?" nome="chatbot" valor={respostas.chatbot} mudar={(valor) => mudar('chatbot', valor as RespostasOnboarding['chatbot'])} opcoes={CHATBOTS} />)}
            {respostas.objetivo === 'atendimento' && respostas.atendimento !== 'hibrido' && <Aviso>Seu começo será pelo Inbox, Contatos e Atividades. Depois de conectar o canal, confira o horário de atendimento e prepare suas respostas rápidas.</Aviso>}
          </div>}
          {etapa === 3 && <div className="space-y-5">
            <div><h2 className="text-xl font-bold">Veja o que vamos preparar</h2><p className="mt-2 text-sm text-muted">Confira suas escolhas. Volte a qualquer etapa para ajustar.</p></div>
            <div className="rounded-xl border border-line p-4"><p className="text-sm font-semibold">{respostas.objetivo === 'atendimento' ? 'Atendimento' : respostas.objetivo === 'vendas' ? 'Vendas' : 'Atendimento e vendas'}</p><p className="mt-1 text-xs text-muted">{respostas.atendimento === 'hibrido' ? 'Automação com equipe' : respostas.atendimento === 'equipe' ? 'Atendimento pela equipe' : 'Automação a decidir depois'} · {respostas.canal === 'whatsapp' ? 'WhatsApp' : 'Instagram'}</p></div>
            {vaiCriarQuadro && quadro && <div className="rounded-xl border border-line p-4"><p className="text-sm font-semibold">Funil: {quadro.nome}</p><div className="mt-3 flex flex-wrap gap-2">{quadro.etapas.map((item) => <span key={item.nome} className="rounded-md bg-surface px-2.5 py-1.5 text-xs text-muted">{item.nome}</span>)}</div><p className="mt-3 text-xs text-dim">Sem importar contatos nem alterar a entrada automática.</p></div>}
            {vaiCriarFluxo && <div className="rounded-xl border border-line p-4"><p className="text-sm font-semibold">Rascunho: {bot?.titulo}</p><p className="mt-2 text-xs leading-5 text-muted">{bot?.descricao} Ajuste os textos de exemplo no editor antes de publicar.</p><span className="mt-3 inline-block rounded-md bg-primary-weak px-2 py-1 text-[11px] font-semibold text-primary">Rascunho · pausado</span></div>}
            {!vaiCriarQuadro && <p className="text-sm text-muted">{temQuadro ? 'Seus funis existentes serão mantidos.' : 'Nenhum funil será criado agora.'}</p>}
            {!vaiCriarFluxo && <p className="text-sm text-muted">{temFluxo ? 'Suas automações existentes serão mantidas.' : 'Nenhum chatbot será criado agora.'}</p>}
            <Aviso>A preparação não envia mensagens. A conexão do canal e a ativação de automações são feitas por você nos próximos passos.</Aviso>
          </div>}
          {erro && <p role="alert" className="mt-5 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-600 dark:text-rose-300">{erro}</p>}
        </fieldset>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/40 p-5 md:px-8">
          <button type="button" disabled={salvando} onClick={() => void salvar('adiar')} className="text-xs text-muted underline underline-offset-4 disabled:opacity-50">Continuar depois</button>
          <div className="flex gap-2">{etapa > 0 && <button type="button" disabled={salvando} onClick={() => void salvar('salvar', etapa - 1)} className="app-secondary-button px-4 py-2.5 text-sm">Voltar</button>}<button type="submit" disabled={salvando} className="app-primary-button px-4 py-2.5 text-sm disabled:opacity-50">{salvando ? 'Salvando…' : etapa === 3 ? 'Preparar meu sistema' : 'Continuar →'}</button></div>
        </footer>
      </form>
      <p className="mt-4 text-center text-[11px] leading-5 text-dim">O progresso é salvo por empresa ao avançar ou continuar depois.</p>
    </>}
  </main>
}

function Escolhas({ titulo, ajuda, nome, valor, mudar, opcoes }: { titulo: string; ajuda?: string; nome: string; valor: string; mudar: (valor: string) => void; opcoes: { valor: string; titulo: string; descricao: string }[] }) {
  return <fieldset className="min-w-0"><legend className="text-base font-bold">{titulo}</legend>{ajuda && <p className="mt-2 text-sm leading-6 text-muted">{ajuda}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2">{opcoes.map((opcao) => <label key={opcao.valor} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-primary ${valor === opcao.valor ? 'border-primary bg-primary-weak' : 'border-line hover:border-primary/40 hover:bg-surface'}`}><input type="radio" name={nome} value={opcao.valor} checked={valor === opcao.valor} onChange={() => mudar(opcao.valor)} className="mt-0.5 size-4 shrink-0 accent-primary" /><span><span className="block text-sm font-semibold">{opcao.titulo}</span><span className="mt-1 block text-xs leading-5 text-muted">{opcao.descricao}</span></span></label>)}</div></fieldset>
}
function Aviso({ children }: { children: React.ReactNode }) { return <p className="rounded-xl bg-surface p-4 text-sm leading-6 text-muted">{children}</p> }
function Proximo({ href, titulo, descricao }: { href: string; titulo: string; descricao: string }) { return <Link href={href} className="flex items-center justify-between gap-4 rounded-xl border border-line p-4 transition hover:border-primary/40 hover:bg-primary-weak"><span><span className="block text-sm font-semibold">{titulo}</span><span className="mt-1 block text-xs leading-5 text-muted">{descricao}</span></span><span aria-hidden className="text-primary">→</span></Link> }
