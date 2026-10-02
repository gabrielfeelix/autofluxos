import type { ReactNode } from 'react'
import { Cod, Nota, Passo, Passos, Sub } from '@/components/ajuda/pecas'
import { BlocoDeCodigo, type Trecho } from './codigo'
import { Endpoint, ListaDeCampos, Resposta, Respostas } from './referencia'
import type { PaginaDev } from './paginas-dev'

/**
 * A API pública na documentação (`docs/HANDOFF-02-OUT-API-PUBLICA.md`).
 *
 * **Só o que existe no código.** Cada status, `codigo` e limite daqui sai de
 * `src/server/api/autenticar.ts` e das rotas em `src/app/api/v1/`. Se o código
 * mudar, esta página muda junto.
 */

const BASE = 'https://autofluxos.4yu.com.br/api/v1'
const TELEFONE = '5511987654321'

const P = ({ children }: { children: ReactNode }) => <p>{children}</p>
const Link = ({ href, children }: { href: string; children: ReactNode }) => (
  <a className="font-medium text-primary hover:underline" href={href}>
    {children}
  </a>
)

/* ------------------------------------------------------------------ código */

type MetodoDoExemplo = 'GET' | 'POST' | 'PATCH' | 'DELETE'

function trechos(
  metodo: MetodoDoExemplo,
  caminho: string,
  corpo?: Record<string, unknown>,
  cabecalhos: Record<string, string> = {},
): Trecho[] {
  const url = `${BASE}${caminho}`
  const extras = Object.entries(cabecalhos)
  const json = corpo ? JSON.stringify(corpo) : null
  const jsonBonito = corpo ? JSON.stringify(corpo, null, 2) : null
  const pyCorpo = corpo ? JSON.stringify(corpo, null, 4).replace(/true/g, 'True').replace(/false/g, 'False') : null

  return [
    {
      rotulo: 'cURL',
      linguagem: 'shell',
      codigo: [
        `curl --request ${metodo} \\`,
        `  --url ${url} \\`,
        `  --header "Authorization: Bearer $AUTOFLUXOS_CHAVE"${json || extras.length ? ' \\' : ''}`,
        ...extras.map(([nome, valor], i) => `  --header "${nome}: ${valor}"${json || i < extras.length - 1 ? ' \\' : ''}`),
        ...(json ? [`  --header "Content-Type: application/json" \\`, `  --data '${json}'`] : []),
      ].join('\n'),
    },
    {
      rotulo: 'Node.js',
      linguagem: 'js',
      codigo: `const resposta = await fetch('${url}', {
  method: '${metodo}',
  headers: {
    Authorization: \`Bearer \${process.env.AUTOFLUXOS_CHAVE}\`,${extras.map(([nome, valor]) => `\n    '${nome}': '${valor}',`).join('')}${json ? `\n    'Content-Type': 'application/json',` : ''}
  },${jsonBonito ? `\n  body: JSON.stringify(${jsonBonito.replace(/\n/g, '\n  ')}),` : ''}
})
console.log(resposta.status, await resposta.json())`,
    },
    {
      rotulo: 'Python',
      linguagem: 'python',
      codigo: `import os, requests

resposta = requests.${metodo.toLowerCase()}(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['AUTOFLUXOS_CHAVE']}"${extras.map(([nome, valor]) => `, "${nome}": "${valor}"`).join('')}},${pyCorpo ? `\n    json=${pyCorpo.replace(/\n/g, '\n    ')},` : ''}
)
print(resposta.status_code, resposta.json())`,
    },
  ]
}

const json = (status: string, valor: unknown): Trecho => ({ rotulo: status, linguagem: 'json', codigo: JSON.stringify(valor, null, 2) })

const CONTATO_EXEMPLO = {
  id: '6f1c2a9e-0b7d-4c55-9a51-2f0f6f3f1d7a',
  nome: 'Maria Souza',
  telefone: TELEFONE,
  campos: { origem: 'API', plano: 'mensal' },
  etiquetas: ['Aluno novo'],
  estagio: 'novo',
  criado_em: '2026-10-02T13:20:41.512Z',
}

const FLUXO_EXEMPLO = { id: 'b7e1d0c4-5f2a-4f9e-8a63-0c1d2e3f4a5b', nome: 'Boas-vindas', canal: 'whatsapp' }

const CORPO_CONTATO = { telefone: TELEFONE, nome: 'Maria Souza', campos: { plano: 'mensal' }, etiquetas: ['Aluno novo'] }

/* ------------------------------------------------------------------ páginas */

function Autenticacao() {
  return (
    <>
      <P>
        Toda chamada à API leva uma chave da organização no cabeçalho <Cod>Authorization</Cod>. A
        chave diz de qual organização é o pedido: não há id de organização no caminho nem no corpo.
      </P>
      <Passos>
        <Passo n={1} titulo="Crie a chave no painel">
          <p>
            Em <strong className="text-ink">Configurações › API</strong>, clique em{' '}
            <strong className="text-ink">Criar chave</strong>, dê um nome e marque só as permissões que
            a integração usa. Quem cria e revoga é o proprietário ou um administrador.
          </p>
        </Passo>
        <Passo n={2} titulo="Guarde a chave">
          <p>
            Ela aparece <strong className="text-ink">uma única vez</strong>, no formato{' '}
            <Cod>af_live_…</Cod>. Guarde num cofre do seu servidor. Nunca coloque em código que roda
            no navegador ou no aplicativo do cliente.
          </p>
        </Passo>
        <Passo n={3} titulo="Envie no cabeçalho">
          <p>
            <Cod>Authorization: Bearer af_live_…</Cod> em todas as chamadas, por HTTPS.
          </p>
        </Passo>
      </Passos>
      <Sub>Permissões</Sub>
      <ListaDeCampos
        campos={[
          { nome: 'contatos:ler', tipo: 'escopo', descricao: <>Consultar um contato: <Link href="/ajuda/desenvolvedores/api-ler-contato">GET /contatos/{'{telefone}'}</Link>.</> },
          { nome: 'contatos:escrever', tipo: 'escopo', descricao: <>Criar e atualizar contatos: <Link href="/ajuda/desenvolvedores/api-gravar-contato">POST /contatos</Link>.</> },
          {
            nome: 'fluxos:disparar',
            tipo: 'escopo',
            descricao: (
              <>
                Listar e disparar automações: <Link href="/ajuda/desenvolvedores/api-listar-fluxos">GET /fluxos</Link> e{' '}
                <Link href="/ajuda/desenvolvedores/api-disparar-fluxo">POST /fluxos/{'{id}'}/disparar</Link>.
              </>
            ),
          },
          {
            nome: 'mensagens:enviar',
            tipo: 'escopo',
            descricao: (
              <>
                Listar e enviar modelos aprovados: <Link href="/ajuda/desenvolvedores/api-listar-templates">GET /templates</Link> e{' '}
                <Link href="/ajuda/desenvolvedores/api-enviar-template">POST /mensagens/template</Link>. Vem desmarcada na
                criação da chave: cada envio é cobrado pela Meta.
              </>
            ),
          },
        ]}
      />
      <Sub>Revogar</Sub>
      <P>
        Revogar no painel vale na chamada seguinte, que passa a receber 401. Para trocar uma chave sem
        parar a integração: crie a nova, passe o seu sistema para ela e só então revogue a antiga.
      </P>
      <Nota tom="dica" titulo="O plano precisa incluir a API">
        <p>Organização sem o recurso recebe 403 <Cod>plano_sem_api</Cod> em toda chamada, mesmo com a chave certa.</p>
      </Nota>
      <Sub>Endereço base</Sub>
      <Endpoint metodo="GET" caminho={BASE} />
    </>
  )
}

function ErrosELimites() {
  const codigos: [number, string, string][] = [
    [400, 'json_invalido', 'O corpo não é JSON válido.'],
    [400, 'idempotencia_obrigatoria', 'Envio de modelo sem o cabeçalho Idempotency-Key.'],
    [401, 'nao_autenticado', 'Chave ausente, com formato errado, inexistente ou revogada.'],
    [403, 'escopo_insuficiente', 'A chave não tem a permissão que o endpoint pede.'],
    [403, 'plano_sem_api', 'O plano da organização não inclui a API.'],
    [404, 'contato_nao_encontrado', 'Nenhum contato com este telefone na organização.'],
    [404, 'fluxo_nao_encontrado', 'O id não é de uma automação publicada e ligada desta organização.'],
    [409, 'janela_fechada', 'Mais de 24 horas desde a última mensagem do contato.'],
    [409, 'sem_conversa', 'O contato nunca conversou com um número da organização.'],
    [409, 'automacao_pausada', 'A automação está desligada para este contato.'],
    [409, 'atendimento_humano', 'Alguém da equipe está atendendo o contato agora.'],
    [409, 'ocupado', 'Chegou uma mensagem do contato no mesmo instante. Repita em alguns segundos.'],
    [404, 'template_nao_encontrado', 'Nenhum modelo com este nome (e idioma) na organização.'],
    [409, 'template_nao_aprovado', 'O modelo existe, mas não está aprovado na Meta agora (pendente, pausado, recusado).'],
    [409, 'sem_numero', 'A organização não tem número de WhatsApp conectado.'],
    [409, 'requisicao_em_andamento', 'Outra chamada com a mesma Idempotency-Key ainda está em andamento.'],
    [413, 'corpo_grande', 'Corpo acima de 64 KB.'],
    [422, 'corpo_invalido', 'Campo obrigatório faltando ou com tipo errado. A mensagem diz qual.'],
    [422, 'telefone_invalido', 'Telefone sem DDD ou incompleto.'],
    [422, 'idioma_obrigatorio', 'O modelo existe em mais de um idioma e o campo idioma não veio.'],
    [422, 'valores_incompletos', 'A quantidade de valores não bate com as variáveis do modelo.'],
    [422, 'template_com_midia', 'Modelo com imagem, vídeo ou documento no cabeçalho, que a API ainda não envia.'],
    [422, 'idempotencia_conflito', 'A mesma Idempotency-Key foi usada com outro corpo nas últimas 24 horas.'],
    [429, 'limite_excedido', 'Mais de 120 chamadas por minuto com a mesma chave.'],
    [429, 'teto_diario', 'A organização chegou ao teto diário de modelos pela API.'],
    [500, 'erro_interno', 'Falha do nosso lado. Pode repetir.'],
    [502, 'meta_recusou', 'A Meta recusou o envio do modelo. A mensagem traz o motivo.'],
  ]
  return (
    <>
      <P>
        Todo erro volta com o status HTTP certo e o mesmo formato. O <Cod>codigo</Cod> é estável e
        serve para o seu sistema decidir; a <Cod>mensagem</Cod> é para gente ler e pode mudar.
      </P>
      <BlocoDeCodigo trechos={[json('Erro', { erro: { codigo: 'janela_fechada', mensagem: 'Passaram mais de 24h desde a última mensagem do contato.' } })]} />
      <Sub>Códigos</Sub>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {codigos.map(([status, codigo, descricao]) => (
          <li key={codigo} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
            <span className="w-10 font-mono text-[12.5px] font-semibold text-muted">{status}</span>
            <code className="font-mono text-[13px] text-ink">{codigo}</code>
            <span className="text-[13.5px] text-muted md:ml-auto">{descricao}</span>
          </li>
        ))}
      </ul>
      <Sub>Limites</Sub>
      <ListaDeCampos
        campos={[
          { nome: 'Chamadas', tipo: '120 por minuto', descricao: <>Por chave. Acima disso, 429 com o cabeçalho <Cod>Retry-After</Cod> em segundos.</> },
          { nome: 'Tamanho do corpo', tipo: '64 KB', descricao: 'Acima disso, 413 antes de qualquer outra conferência.' },
          {
            nome: 'Modelos por dia',
            tipo: '500 por organização',
            descricao: <>Envios de modelo pela API, somando todas as chaves. Zera à meia-noite (horário de Brasília). Acima disso, 429 <Cod>teto_diario</Cod>. Para outro teto, fale com o suporte.</>,
          },
        ]}
      />
      <Sub>Quando repetir</Sub>
      <ul className="ml-5 list-disc space-y-2">
        <li>Repita em 429 <Cod>limite_excedido</Cod> (depois do <Cod>Retry-After</Cod>), 500, 502 e erro de rede, com espera crescente. No envio de modelo, repita sempre com a mesma <Cod>Idempotency-Key</Cod>.</li>
        <li>429 <Cod>teto_diario</Cod> só se resolve no dia seguinte.</li>
        <li>Em 409 <Cod>ocupado</Cod>, repita em alguns segundos. Os outros 409 não mudam repetindo.</li>
        <li>400, 401, 403, 404 e 422 não se resolvem repetindo: corrija a chamada.</li>
      </ul>
    </>
  )
}

function GravarContato() {
  return (
    <>
      <Endpoint metodo="POST" caminho="/api/v1/contatos" />
      <P>
        Cria o contato ou, se o telefone já existe na organização, atualiza. O telefone é comparado
        em qualquer grafia do mesmo número: com ou sem <Cod>55</Cod>, com ou sem o nono dígito.
      </P>
      <ListaDeCampos
        titulo="Corpo"
        campos={[
          { nome: 'telefone', tipo: 'string', obrigatorio: true, descricao: <>Com DDD, de preferência com DDI: <Cod>{TELEFONE}</Cod>. Sem DDD, a resposta é 422.</> },
          { nome: 'nome', tipo: 'string', descricao: 'Até 120 caracteres. Substitui o nome mostrado no painel.' },
          {
            nome: 'campos',
            tipo: 'object',
            descricao: (
              <>
                Até 50 pares de chave e valor (texto, número ou booleano, guardados como texto). Mesclados
                aos existentes. Um valor corrigido por alguém da equipe ou informado pelo próprio contato
                não é trocado, e o motivo volta em <Cod>avisos</Cod>.
              </>
            ),
          },
          {
            nome: 'etiquetas',
            tipo: 'string[]',
            descricao: <>Até 20 nomes de etiquetas que já existem na organização. Etiqueta inexistente não é criada e volta em <Cod>avisos</Cod>.</>,
          },
        ]}
      />
      <Nota tom="dica" titulo="Contato novo">
        <p>
          Ganha <Cod>campos.origem = &quot;API&quot;</Cod> (a menos que você mande outra origem), entra no
          funil padrão e aparece na linha do tempo como &quot;chegou por API&quot;. Depois de criado, a
          origem não muda.
        </p>
      </Nota>
      <Respostas>
        <Resposta status={201} descricao="Contato criado" aberta corpo={JSON.stringify({ contato: CONTATO_EXEMPLO, avisos: [] }, null, 2)} />
        <Resposta status={200} descricao="Contato já existia e foi atualizado" corpo={`{
  "contato": {
    "id": "6f1c2a9e-…",
    "telefone": "5511987654321",
    "…": "…"
  },
  "avisos": [
    "etiqueta \"VIP\" não existe nesta conta e não foi aplicada"
  ]
}`} />
        <Resposta status={401} descricao="Chave ausente ou inválida" corpo={`{
  "erro": {
    "codigo": "nao_autenticado",
    "mensagem": "Chave inválida ou revogada."
  }
}`} />
        <Resposta status={403} descricao="Sem contatos:escrever, ou plano sem API" corpo={`{
  "erro": {
    "codigo": "escopo_insuficiente",
    "mensagem": "Esta chave não tem o escopo contatos:escrever."
  }
}`} />
        <Resposta status={422} descricao="Corpo fora do formato, ou telefone sem DDD" corpo={`{
  "erro": {
    "codigo": "telefone_invalido",
    "mensagem": "Telefone sem DDD ou incompleto. Exemplo: 5511987654321."
  }
}`} />
        <Resposta status={429} descricao="Mais de 120 chamadas por minuto com esta chave" corpo={`{
  "erro": {
    "codigo": "limite_excedido",
    "mensagem": "Limite de 120 chamadas por minuto por chave."
  }
}`} />
      </Respostas>
    </>
  )
}

function LerContato() {
  return (
    <>
      <Endpoint metodo="GET" caminho="/api/v1/contatos/{telefone}" />
      <P>Um contato da organização, achado pelo telefone em qualquer grafia do mesmo número.</P>
      <ListaDeCampos
        titulo="Resposta"
        campos={[
          { nome: 'contato.id', tipo: 'string', descricao: 'Identificador do contato.' },
          { nome: 'contato.nome', tipo: 'string | null', descricao: 'O nome corrigido pela equipe, ou o do perfil do WhatsApp.' },
          { nome: 'contato.telefone', tipo: 'string', descricao: 'Como o WhatsApp grava: só dígitos, com DDI.' },
          { nome: 'contato.campos', tipo: 'object', descricao: 'Tudo o que foi coletado: pela automação, pela equipe ou pela API.' },
          { nome: 'contato.etiquetas', tipo: 'string[]', descricao: 'Nomes das etiquetas, em ordem alfabética.' },
          { nome: 'contato.estagio', tipo: 'string', descricao: <><Cod>novo</Cod>, <Cod>qualificado</Cod>, <Cod>negociando</Cod>, <Cod>cliente</Cod>, <Cod>perdido</Cod> ou <Cod>inativo</Cod>.</> },
          { nome: 'contato.criado_em', tipo: 'string', descricao: 'Data e hora em ISO 8601, UTC.' },
        ]}
      />
      <Respostas>
        <Resposta status={200} descricao="Contato encontrado" aberta corpo={JSON.stringify({ contato: CONTATO_EXEMPLO }, null, 2)} />
        <Resposta status={403} descricao="Sem contatos:ler, ou plano sem API" corpo={`{
  "erro": {
    "codigo": "escopo_insuficiente",
    "mensagem": "Esta chave não tem o escopo contatos:ler."
  }
}`} />
        <Resposta status={404} descricao="contato_nao_encontrado" corpo={`{
  "erro": {
    "codigo": "contato_nao_encontrado",
    "mensagem": "Nenhum contato com este telefone nesta conta."
  }
}`} />
      </Respostas>
    </>
  )
}

function ListarFluxos() {
  return (
    <>
      <Endpoint metodo="GET" caminho="/api/v1/fluxos" />
      <P>
        As automações publicadas e ligadas da organização, para descobrir o <Cod>id</Cod> que o disparo
        pede. Rascunho e automação desligada não aparecem.
      </P>
      <Respostas>
        <Resposta status={200} descricao="Lista de automações" aberta corpo={JSON.stringify({ fluxos: [FLUXO_EXEMPLO] }, null, 2)} />
        <Resposta status={403} descricao="Sem fluxos:disparar, ou plano sem API" corpo={`{
  "erro": {
    "codigo": "plano_sem_api",
    "mensagem": "O plano Essencial não inclui API para desenvolvedores. Para usar, suba de plano em Configurações > Plano e consumo."
  }
}`} />
      </Respostas>
    </>
  )
}

function DispararFluxo() {
  return (
    <>
      <Endpoint metodo="POST" caminho="/api/v1/fluxos/{fluxoId}/disparar" />
      <P>
        Começa a automação na conversa de WhatsApp do contato, como se ele tivesse acabado de entrar
        nela. A mensagem sai na hora.
      </P>
      <Nota tom="atencao" titulo="Só com a conversa aberta">
        <p>
          O WhatsApp só aceita mensagem livre até 24 horas depois da última mensagem do contato. Fora
          disso a resposta é 409 <Cod>janela_fechada</Cod> e nada é enviado. Para lembrete e cobrança,
          que caem fora da janela, use{' '}
          <Link href="/ajuda/desenvolvedores/api-enviar-template">Enviar modelo aprovado</Link>.
        </p>
      </Nota>
      <ListaDeCampos
        titulo="Corpo"
        campos={[{ nome: 'telefone', tipo: 'string', obrigatorio: true, descricao: 'Telefone de um contato que já existe na organização.' }]}
      />
      <Respostas>
        <Resposta status={202} descricao="Automação aberta" aberta corpo={JSON.stringify({ status: 'aberto', contato_id: CONTATO_EXEMPLO.id }, null, 2)} />
        <Resposta status={404} descricao="fluxo_nao_encontrado ou contato_nao_encontrado" corpo={`{
  "erro": {
    "codigo": "fluxo_nao_encontrado",
    "mensagem": "Nenhuma automação publicada e ligada com este id nesta conta."
  }
}`} />
        <Resposta status={409} descricao="janela_fechada, sem_conversa, automacao_pausada, atendimento_humano ou ocupado" corpo={`{
  "erro": {
    "codigo": "janela_fechada",
    "mensagem": "Passaram mais de 24h desde a última mensagem do contato. Fora da janela, o WhatsApp só aceita modelo aprovado."
  }
}`} />
        <Resposta status={422} descricao="Corpo sem telefone" corpo={`{
  "erro": {
    "codigo": "corpo_invalido",
    "mensagem": "telefone: obrigatório"
  }
}`} />
      </Respostas>
    </>
  )
}

const TEMPLATE_EXEMPLO = {
  nome: 'lembrete_aula',
  idioma: 'pt_BR',
  categoria: 'UTILITY',
  corpo: 'Oi, {{1}}! Sua aula é amanhã às {{2}}. Responda SIM para confirmar.',
  cabecalho: null,
  variaveis: { corpo: 2, cabecalho: 0 },
}

const CORPO_TEMPLATE = { telefone: TELEFONE, template: 'lembrete_aula', valores: { corpo: ['Maria', '7h30'] } }

const ENVIO_EXEMPLO = {
  status: 'enviada',
  mensagem_id: 'wamid.HBgNNTUxMTk4NzY1NDMyMRUCABEYEjQ5',
  contato_id: CONTATO_EXEMPLO.id,
  contato_criado: false,
  template: { nome: 'lembrete_aula', idioma: 'pt_BR' },
}

const IDEMPOTENCIA = { 'Idempotency-Key': 'pedido-8841-lembrete' }

function ListarTemplates() {
  return (
    <>
      <Endpoint metodo="GET" caminho="/api/v1/templates" />
      <P>
        Os modelos <strong className="text-ink">aprovados</strong> pela Meta na organização, com quantas
        variáveis cada um pede. Pendente, pausado e recusado não aparecem. Os modelos são criados e
        aprovados no painel, em Transmissões › Modelos aprovados.
      </P>
      <ListaDeCampos
        titulo="Resposta"
        campos={[
          { nome: 'templates[].nome', tipo: 'string', descricao: <>O nome que vai no campo <Cod>template</Cod> do envio.</> },
          { nome: 'templates[].idioma', tipo: 'string', descricao: <>Código da Meta, como <Cod>pt_BR</Cod>.</> },
          { nome: 'templates[].categoria', tipo: 'string', descricao: <><Cod>UTILITY</Cod>, <Cod>MARKETING</Cod> ou <Cod>AUTHENTICATION</Cod>. Muda o preço da mensagem na Meta.</> },
          { nome: 'templates[].corpo', tipo: 'string', descricao: <>O texto, com as variáveis como <Cod>{'{{1}}'}</Cod>, <Cod>{'{{2}}'}</Cod>.</> },
          { nome: 'templates[].cabecalho', tipo: 'string | null', descricao: <><Cod>texto</Cod>, <Cod>imagem</Cod>, <Cod>video</Cod>, <Cod>documento</Cod> ou nulo. Só texto e nulo podem ser enviados pela API por enquanto.</> },
          { nome: 'templates[].variaveis', tipo: 'object', descricao: <>Quantos valores mandar em <Cod>valores.corpo</Cod> e <Cod>valores.cabecalho</Cod>.</> },
        ]}
      />
      <Respostas>
        <Resposta status={200} descricao="Modelos aprovados" aberta corpo={JSON.stringify({ templates: [TEMPLATE_EXEMPLO] }, null, 2)} />
        <Resposta status={403} descricao="Sem mensagens:enviar, ou plano sem API" corpo={`{
  "erro": {
    "codigo": "escopo_insuficiente",
    "mensagem": "Esta chave não tem o escopo mensagens:enviar."
  }
}`} />
      </Respostas>
    </>
  )
}

function EnviarTemplate() {
  return (
    <>
      <Endpoint metodo="POST" caminho="/api/v1/mensagens/template" />
      <P>
        Envia um modelo aprovado no WhatsApp do contato, dentro ou fora da janela de 24 horas. É o caminho
        para lembrete, confirmação e cobrança. Se o telefone ainda não é contato da organização, ele é
        criado como em <Link href="/ajuda/desenvolvedores/api-gravar-contato">Criar ou atualizar contato</Link>.
      </P>
      <Nota tom="atencao" titulo="Cada mensagem é cobrada pela Meta">
        <p>
          Desde 01/10/2026 a Meta cobra cada modelo enviado, na conta do WhatsApp da organização. O valor
          depende da categoria do modelo. Por isso a permissão <Cod>mensagens:enviar</Cod> vem desmarcada e
          existe um teto de 500 modelos por dia pela API.
        </p>
      </Nota>
      <ListaDeCampos
        titulo="Cabeçalhos"
        campos={[
          {
            nome: 'Idempotency-Key',
            tipo: 'string',
            obrigatorio: true,
            descricao: (
              <>
                Até 120 caracteres, único por mensagem: um UUID ou o id do pedido no seu sistema. Repetir a
                chamada com a mesma chave em até 24 horas devolve a resposta da primeira, com o cabeçalho{' '}
                <Cod>Idempotent-Replayed: true</Cod>, e nada é enviado de novo.
              </>
            ),
          },
        ]}
      />
      <ListaDeCampos
        titulo="Corpo"
        campos={[
          { nome: 'telefone', tipo: 'string', obrigatorio: true, descricao: <>Com DDD, de preferência com DDI: <Cod>{TELEFONE}</Cod>.</> },
          { nome: 'template', tipo: 'string', obrigatorio: true, descricao: <>O <Cod>nome</Cod> do modelo, como em <Link href="/ajuda/desenvolvedores/api-listar-templates">Listar modelos</Link>.</> },
          { nome: 'idioma', tipo: 'string', descricao: 'Obrigatório só quando o mesmo nome existe em mais de um idioma.' },
          { nome: 'valores.corpo', tipo: 'string[]', descricao: <>Um valor por variável do corpo, na ordem: o primeiro entra no <Cod>{'{{1}}'}</Cod>. A quantidade precisa bater.</> },
          { nome: 'valores.cabecalho', tipo: 'string[]', descricao: 'O valor da variável do cabeçalho de texto, quando houver.' },
        ]}
      />
      <Respostas>
        <Resposta status={202} descricao="Aceito pela Meta" aberta corpo={JSON.stringify(ENVIO_EXEMPLO, null, 2)}>
          <p>
            <Cod>status</Cod> é <Cod>enviada</Cod>, ou <Cod>retida</Cod> quando a Meta segurou a mensagem para
            entregar depois. A mensagem aparece na conversa do painel com o autor API.
          </p>
        </Resposta>
        <Resposta status={400} descricao="Sem Idempotency-Key" corpo={`{
  "erro": {
    "codigo": "idempotencia_obrigatoria",
    "mensagem": "Envie o cabeçalho Idempotency-Key (até 120 caracteres), único por mensagem."
  }
}`} />
        <Resposta status={404} descricao="template_nao_encontrado" corpo={`{
  "erro": {
    "codigo": "template_nao_encontrado",
    "mensagem": "Nenhum modelo \"lembrete_aula\" nesta conta."
  }
}`} />
        <Resposta status={409} descricao="template_nao_aprovado, sem_numero ou requisicao_em_andamento" corpo={`{
  "erro": {
    "codigo": "template_nao_aprovado",
    "mensagem": "O modelo \"lembrete_aula\" está pausado na Meta. Só modelo aprovado entrega."
  }
}`} />
        <Resposta status={422} descricao="valores_incompletos, idioma_obrigatorio, telefone_invalido ou idempotencia_conflito" corpo={`{
  "erro": {
    "codigo": "valores_incompletos",
    "mensagem": "O corpo do modelo tem 2 variáveis e chegaram 1 em valores.corpo."
  }
}`} />
        <Resposta status={429} descricao="teto_diario ou limite_excedido" corpo={`{
  "erro": {
    "codigo": "teto_diario",
    "mensagem": "A organização chegou ao teto de 500 modelos por dia pela API. O contador volta a zero à meia-noite (horário de Brasília)."
  }
}`} />
        <Resposta status={502} descricao="A Meta recusou o envio" corpo={`{
  "erro": {
    "codigo": "meta_recusou",
    "mensagem": "A Meta recusou o envio: (#131026) Message undeliverable"
  }
}`} />
      </Respostas>
    </>
  )
}

export const PAGINAS_API: PaginaDev[] = [
  { slug: 'api-autenticacao', grupo: 'API', titulo: 'Autenticação', resumo: 'Crie a chave no painel e envie como Bearer.', Corpo: Autenticacao },
  { slug: 'api-erros', grupo: 'API', titulo: 'Erros e limites', resumo: 'O formato de erro, cada código e quando repetir.', Corpo: ErrosELimites },
  {
    slug: 'api-gravar-contato',
    grupo: 'API',
    titulo: 'Criar ou atualizar contato',
    resumo: 'Cadastra quem veio do seu sistema, com campos e etiquetas.',
    metodo: 'POST',
    Corpo: GravarContato,
    painel: [
      { trechos: trechos('POST', '/contatos', CORPO_CONTATO), titulo: 'Requisição' },
      { trechos: [json('201', { contato: CONTATO_EXEMPLO, avisos: [] })], titulo: 'Resposta' },
    ],
  },
  {
    slug: 'api-ler-contato',
    grupo: 'API',
    titulo: 'Consultar um contato',
    resumo: 'Um contato pelo telefone.',
    metodo: 'GET',
    Corpo: LerContato,
    painel: [
      { trechos: trechos('GET', `/contatos/${TELEFONE}`), titulo: 'Requisição' },
      { trechos: [json('200', { contato: CONTATO_EXEMPLO })], titulo: 'Resposta' },
    ],
  },
  {
    slug: 'api-listar-fluxos',
    grupo: 'API',
    titulo: 'Listar automações',
    resumo: 'As automações que dá para disparar.',
    metodo: 'GET',
    Corpo: ListarFluxos,
    painel: [
      { trechos: trechos('GET', '/fluxos'), titulo: 'Requisição' },
      { trechos: [json('200', { fluxos: [FLUXO_EXEMPLO] })], titulo: 'Resposta' },
    ],
  },
  {
    slug: 'api-disparar-fluxo',
    grupo: 'API',
    titulo: 'Disparar automação',
    resumo: 'Começa uma automação na conversa do contato.',
    metodo: 'POST',
    Corpo: DispararFluxo,
    painel: [
      { trechos: trechos('POST', '/fluxos/SEU_FLUXO_ID/disparar', { telefone: TELEFONE }), titulo: 'Requisição' },
      { trechos: [json('202', { status: 'aberto', contato_id: CONTATO_EXEMPLO.id }), json('409', { erro: { codigo: 'janela_fechada', mensagem: 'Passaram mais de 24h desde a última mensagem do contato.' } })], titulo: 'Resposta' },
    ],
  },
  {
    slug: 'api-listar-templates',
    grupo: 'API',
    titulo: 'Listar modelos',
    resumo: 'Os modelos aprovados e as variáveis de cada um.',
    metodo: 'GET',
    Corpo: ListarTemplates,
    painel: [
      { trechos: trechos('GET', '/templates'), titulo: 'Requisição' },
      { trechos: [json('200', { templates: [TEMPLATE_EXEMPLO] })], titulo: 'Resposta' },
    ],
  },
  {
    slug: 'api-enviar-template',
    grupo: 'API',
    titulo: 'Enviar modelo aprovado',
    resumo: 'Lembrete, confirmação e cobrança, mesmo fora da janela de 24h.',
    metodo: 'POST',
    Corpo: EnviarTemplate,
    painel: [
      { trechos: trechos('POST', '/mensagens/template', CORPO_TEMPLATE, IDEMPOTENCIA), titulo: 'Requisição' },
      { trechos: [json('202', ENVIO_EXEMPLO)], titulo: 'Resposta' },
    ],
  },
]
