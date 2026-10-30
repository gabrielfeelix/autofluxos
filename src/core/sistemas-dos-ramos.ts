import type { PacoteDoNicho } from './nichos'

/**
 * Os sistemas de gestão de cada ramo novo (docs/SEGMENTOS-NOVOS.md): agenda de
 * clínica, salão e academia, e os de imobiliária, hospedagem, laboratório e
 * farmácia que ainda não têm conector.
 *
 * Sem I/O. **A lista é fechada e espelha dois checks da 0158**: o de
 * `agendas_conectadas.plataforma` (só os com `conector`) e o de
 * `pedidos_de_loja.plataforma`, onde mora o "Solicitar integração" de quem
 * ainda não tem.
 */

export const SISTEMAS_DOS_RAMOS = [
  'feegow',
  'clinica_nas_nuvens',
  'trinks',
  'agendapro',
  'evo',
  'ninsaude',
  'clinicorp',
  'iclinic',
  'amigo',
  'simples_dental',
  'tecnofit',
  'next_fit',
  'cloudgym',
  'booksy',
  'avec',
  'simplesvet',
  'shift',
  'pixeon',
  'trier',
  'linx_farma',
  'vista',
  'jetimob',
  'kenlo',
  'stays',
  'cloudbeds',
  'omnibees',
] as const

export type SistemaDoRamo = (typeof SISTEMAS_DOS_RAMOS)[number]

/** Os que já têm conector de agenda (`src/agendas/`). */
export const AGENDAS_COM_CONECTOR = ['feegow', 'clinica_nas_nuvens', 'trinks', 'agendapro', 'evo'] as const

export type AgendaComConector = (typeof AGENDAS_COM_CONECTOR)[number]

export type TipoDeSistema = 'agenda' | 'exames' | 'drogaria' | 'imoveis' | 'reservas'

/** Um campo que a pessoa preenche ao conectar. `segredo` vai para o cofre. */
export type CampoDaConexao = {
  id: string
  rotulo: string
  segredo: boolean
  obrigatorio: boolean
  /** Onde achar, dito para quem está com o painel do sistema aberto. */
  ajuda: string
  numero?: boolean
}

export type FichaDoSistema = {
  id: SistemaDoRamo
  nome: string
  tipo: TipoDeSistema
  /** Uma linha, dita para o dono: o que a conexão faz, ou por que ainda não faz. */
  resumo: string
  /** Os campos da tela de conectar. Vazio = ainda sem conector ("Solicitar integração"). */
  campos: readonly CampoDaConexao[]
}


export const FICHAS_DOS_SISTEMAS: Record<SistemaDoRamo, FichaDoSistema> = {
  feegow: {
    id: 'feegow',
    nome: 'Feegow',
    tipo: 'agenda',
    resumo: 'A IA mostra horários livres por especialidade, marca, confirma e desmarca consultas.',
    campos: [
      { id: 'token', rotulo: 'Token de acesso', segredo: true, obrigatorio: true, ajuda: 'O usuário master libera o token da API no Feegow Clinic e copia o valor.' },
      { id: 'localId', rotulo: 'Local padrão', segredo: false, obrigatorio: false, numero: true, ajuda: 'Id do local onde as consultas são marcadas. Deixe vazio para usar o padrão.' },
      { id: 'unidadeId', rotulo: 'Unidade', segredo: false, obrigatorio: false, numero: true, ajuda: 'Id da unidade, para clínicas com mais de uma. Deixe vazio na matriz.' },
      { id: 'motivoDeCancelamento', rotulo: 'Motivo de cancelamento', segredo: false, obrigatorio: false, numero: true, ajuda: 'Id do motivo "desmarcado pelo paciente". Padrão: 1.' },
    ],
  },
  clinica_nas_nuvens: {
    id: 'clinica_nas_nuvens',
    nome: 'Clínica nas Nuvens',
    tipo: 'agenda',
    resumo: 'A IA mostra horários, marca e desmarca. O paciente é reconhecido pelo CPF e pelo celular do cadastro.',
    campos: [
      { id: 'clientId', rotulo: 'Client ID', segredo: true, obrigatorio: true, ajuda: 'Fornecido pelo suporte da Clínica nas Nuvens junto com o Client Secret.' },
      { id: 'clientSecret', rotulo: 'Client Secret', segredo: true, obrigatorio: true, ajuda: 'Fornecido junto com o Client ID.' },
      { id: 'cid', rotulo: 'Token da clínica', segredo: true, obrigatorio: true, ajuda: 'Configurações > Minha Empresa > Integrações > API Clínica nas Nuvens.' },
      { id: 'idLocalAgenda', rotulo: 'Agenda', segredo: false, obrigatorio: true, numero: true, ajuda: 'Id da agenda onde as consultas são marcadas.' },
      { id: 'idTipoConsulta', rotulo: 'Tipo de consulta padrão', segredo: false, obrigatorio: true, numero: true, ajuda: 'Id do tipo de consulta usado quando o horário não traz um.' },
      { id: 'idTipoConvenioParticular', rotulo: 'Convênio particular', segredo: false, obrigatorio: false, numero: true, ajuda: 'Id do convênio "Particular", para paciente sem convênio.' },
    ],
  },
  trinks: {
    id: 'trinks',
    nome: 'Trinks',
    tipo: 'agenda',
    resumo: 'A IA mostra vagas por serviço e profissional, marca e desmarca. Limite da Trinks: 5.000 consultas por mês.',
    campos: [
      { id: 'chave', rotulo: 'Token de API', segredo: true, obrigatorio: true, ajuda: 'trinks.com > Minha Área > Meu Cadastro > Token de API Pessoal > Gerar token.' },
      { id: 'estabelecimentoId', rotulo: 'Id do estabelecimento', segredo: false, obrigatorio: true, ajuda: 'O número do estabelecimento na Trinks.' },
    ],
  },
  agendapro: {
    id: 'agendapro',
    nome: 'AgendaPro',
    tipo: 'agenda',
    resumo: 'A IA mostra vagas, marca e desmarca. A confirmação para a cliente sai pela própria conversa.',
    campos: [
      { id: 'chave', rotulo: 'Chave de API', segredo: true, obrigatorio: true, ajuda: 'Configurações > Integrações > Chave de API. Começa com "apk_live_".' },
      { id: 'locationId', rotulo: 'Id do local', segredo: false, obrigatorio: false, numero: true, ajuda: 'Só para quem tem mais de um local.' },
    ],
  },
  evo: {
    id: 'evo',
    nome: 'EVO',
    tipo: 'agenda',
    resumo: 'A IA mostra a grade com vaga e reserva aula para quem já é aluno. Desmarcar fica com a recepção.',
    campos: [
      { id: 'dns', rotulo: 'DNS da academia', segredo: false, obrigatorio: true, ajuda: 'O nome da academia na EVO, o mesmo do endereço do sistema.' },
      { id: 'chave', rotulo: 'Secret Key', segredo: true, obrigatorio: true, ajuda: 'A chave da API de integração, gerada no painel da EVO.' },
      { id: 'idBranch', rotulo: 'Filial', segredo: false, obrigatorio: false, numero: true, ajuda: 'Id da filial, para redes. Deixe vazio na unidade principal.' },
    ],
  },
  ninsaude: solicitar('ninsaude', 'Ninsaúde', 'agenda', 'A API exige parceria com a Ninsaúde.'),
  clinicorp: solicitar('clinicorp', 'Clinicorp', 'agenda', 'Sem documentação pública; a integração depende da Clinicorp.'),
  iclinic: solicitar('iclinic', 'iClinic', 'agenda', 'Sem API pública conhecida.'),
  amigo: solicitar('amigo', 'Amigo', 'agenda', 'Sem API pública conhecida.'),
  simples_dental: solicitar('simples_dental', 'Simples Dental', 'agenda', 'Sem API pública conhecida.'),
  tecnofit: solicitar('tecnofit', 'Tecnofit', 'agenda', 'Sem API pública conhecida.'),
  next_fit: solicitar('next_fit', 'Next Fit', 'agenda', 'Sem API pública conhecida.'),
  cloudgym: solicitar('cloudgym', 'Cloudgym', 'agenda', 'A API não mostra vaga por horário nem cancela.'),
  booksy: solicitar('booksy', 'Booksy', 'agenda', 'API só para parceiros da Booksy.'),
  avec: solicitar('avec', 'Avec', 'agenda', 'Sem API pública conhecida.'),
  simplesvet: solicitar('simplesvet', 'SimplesVet', 'agenda', 'Sem API pública conhecida.'),
  shift: solicitar('shift', 'Shift', 'exames', 'Integração por contrato com a Shift.'),
  pixeon: solicitar('pixeon', 'Pixeon', 'exames', 'Integração por contrato com a Pixeon.'),
  trier: solicitar('trier', 'Trier', 'drogaria', 'A API de produto e pedido da Trier não é pública.'),
  linx_farma: solicitar('linx_farma', 'Linx Farma', 'drogaria', 'Acesso pelo portal de parceiros da Linx.'),
  vista: solicitar('vista', 'Vista', 'imoveis', 'API pública de imóveis; a chave é pedida à Vista por chamado.'),
  jetimob: solicitar('jetimob', 'Jetimob', 'imoveis', 'API de imóveis e leads por chave.'),
  kenlo: solicitar('kenlo', 'Kenlo', 'imoveis', 'API só para parceiros homologados.'),
  stays: solicitar('stays', 'Stays', 'reservas', 'API de reserva aberta, contratada à parte na Stays.'),
  cloudbeds: solicitar('cloudbeds', 'Cloudbeds', 'reservas', 'API com credenciamento de parceiro.'),
  omnibees: solicitar('omnibees', 'Omnibees', 'reservas', 'API só para parceiros.'),
}

function solicitar(id: SistemaDoRamo, nome: string, tipo: TipoDeSistema, resumo: string): FichaDoSistema {
  return { id, nome, tipo, resumo, campos: [] }
}

export function ehSistemaDoRamo(valor: unknown): valor is SistemaDoRamo {
  return typeof valor === 'string' && (SISTEMAS_DOS_RAMOS as readonly string[]).includes(valor)
}

export function temConector(id: SistemaDoRamo): id is AgendaComConector {
  return (AGENDAS_COM_CONECTOR as readonly string[]).includes(id)
}

/**
 * Os sistemas que a tela mostra para a conta: primeiro os do ramo dela
 * (`pacote.sistemas`), depois os outros com conector. Sem ramo, todos.
 */
export function sistemasParaAConta(pacote: PacoteDoNicho | null): FichaDoSistema[] {
  const todos = SISTEMAS_DOS_RAMOS.map((id) => FICHAS_DOS_SISTEMAS[id])
  if (!pacote) return todos
  const doRamo = pacote.sistemas.map((id) => FICHAS_DOS_SISTEMAS[id])
  const outros = todos.filter((f) => !pacote.sistemas.includes(f.id) && f.campos.length > 0)
  return [...doRamo, ...outros]
}

/** O logo oficial, baixado do site de cada sistema (`public/marcas-de-sistemas/`). */
export function arquivoDaMarca(id: SistemaDoRamo): string {
  return id === 'jetimob' || id === 'cloudbeds' ? `${id}.svg` : `${id}.png`
}
