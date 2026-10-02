import type { ComponentType, ReactNode } from 'react'
import { Cod, Nota, Passo, Passos, Sub } from '@/components/ajuda/pecas'
import { BlocoDeCodigo, type Trecho } from './codigo'
import { PAGINAS_API } from './paginas-api'
import { Endpoint, ListaDeCampos, Resposta, Respostas, SeloDeMetodo, type Metodo } from './referencia'

/**
 * A documentação para desenvolvedores.
 *
 * **Só o que existe no código.** Quem integra chama a API pública com chave
 * (`src/app/api/v1/`, páginas em `paginas-api.tsx`), avisa pelo webhook de
 * entrada (`src/app/api/webhook/entrada/[clienteId]/route.ts`), é chamado pelo
 * bloco "Chama um sistema" (`src/server/efeitos/http.ts`) ou instala o chat do
 * site.
 * Cada número aqui (limites, prazos, status) sai desses arquivos; se o código
 * mudar, esta página muda junto.
 */

const BASE = 'https://autofluxos.4yu.com.br'
const URL_DO_WEBHOOK = `${BASE}/api/webhook/entrada/SEU_CLIENTE_ID`

export type PaginaDev = {
  slug: string
  grupo: string
  titulo: string
  resumo: string
  metodo?: Metodo
  Corpo: ComponentType
  /** Código grudado à direita, como nas referências de API. */
  painel?: { trechos: Trecho[]; titulo?: string }[]
}

const P = ({ children }: { children: ReactNode }) => <p>{children}</p>

/* ------------------------------------------------------------------ código */

const EXEMPLO_CORPO = '{"evento":"vaga.aberta","telefone":"5511999998888"}'

const CHAMADA: Trecho[] = [
  {
    rotulo: 'cURL',
    linguagem: 'shell',
    codigo: `corpo='${EXEMPLO_CORPO}'
assinatura=$(printf %s "$corpo" | openssl dgst -sha256 -hmac "$AUTOFLUXOS_SEGREDO" -hex | awk '{print $2}')

curl --request POST \\
  --url ${URL_DO_WEBHOOK} \\
  --header "content-type: application/json" \\
  --header "x-autofluxos-assinatura: sha256=$assinatura" \\
  --data "$corpo"`,
  },
  {
    rotulo: 'Node.js',
    linguagem: 'js',
    codigo: `import { createHmac } from 'node:crypto'

const corpo = JSON.stringify({ evento: 'vaga.aberta', telefone: '5511999998888' })
const assinatura = createHmac('sha256', process.env.AUTOFLUXOS_SEGREDO)
  .update(corpo)
  .digest('hex')

await fetch('${URL_DO_WEBHOOK}', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-autofluxos-assinatura': \`sha256=\${assinatura}\`,
  },
  body: corpo,
})`,
  },
  {
    rotulo: 'Python',
    linguagem: 'python',
    codigo: `import hashlib, hmac, json, os, requests

corpo = json.dumps({"evento": "vaga.aberta", "telefone": "5511999998888"}, separators=(",", ":"))
assinatura = hmac.new(os.environ["AUTOFLUXOS_SEGREDO"].encode(), corpo.encode(), hashlib.sha256).hexdigest()

requests.post(
    "${URL_DO_WEBHOOK}",
    data=corpo,
    headers={
        "content-type": "application/json",
        "x-autofluxos-assinatura": f"sha256={assinatura}",
    },
)`,
  },
]

const RESPOSTA_OK: Trecho[] = [{ rotulo: '200', linguagem: 'json', codigo: '{\n  "ok": true\n}' }]

/* ------------------------------------------------------------------ páginas */

function Visao() {
  return (
    <>
      <P>
        O AutoFluxos conversa com outros sistemas de cinco formas. Escolha pela direção em que o
        dado anda.
      </P>
      <ul className="ml-5 list-disc space-y-2">
        <li>
          <strong className="text-ink">O seu sistema chama o AutoFluxos.</strong> Cadastra contatos,
          consulta dados, envia modelos aprovados, move o funil e dispara automações com uma chave da organização. Use a{' '}
          <a className="font-medium text-primary hover:underline" href="/ajuda/desenvolvedores/api-autenticacao">API</a>.
        </li>
        <li>
          <strong className="text-ink">O AutoFluxos avisa o seu sistema.</strong> Contato novo, mudança de
          etapa e oportunidade ganha ou perdida chegam ao seu CRM ou planilha num POST assinado. Use os{' '}
          <a className="font-medium text-primary hover:underline" href="/ajuda/desenvolvedores/webhooks-de-saida">webhooks de saída</a>.
        </li>
        <li>
          <strong className="text-ink">O seu sistema avisa o AutoFluxos.</strong> Um evento (vaga
          aberta, pedido enviado, consulta confirmada) abre uma conversa no WhatsApp do contato,
          sem chave, só com um segredo de assinatura. Use o{' '}
          <a className="font-medium text-primary hover:underline" href="/ajuda/desenvolvedores/webhook-de-entrada">webhook de entrada</a>.
        </li>
        <li>
          <strong className="text-ink">O AutoFluxos consulta o seu sistema.</strong> No meio da
          conversa, a automação busca horários, cria um cadastro ou registra um pedido. Use o bloco{' '}
          <a className="font-medium text-primary hover:underline" href="/ajuda/desenvolvedores/chamar-seu-sistema">Chama um sistema</a>.
        </li>
        <li>
          <strong className="text-ink">O seu site atende pelo AutoFluxos.</strong> Um script coloca
          o chat no site e as conversas caem na mesma caixa de entrada. Veja{' '}
          <a className="font-medium text-primary hover:underline" href="/ajuda/desenvolvedores/chat-do-site">Chat do site</a>.
        </li>
      </ul>
      <Sub>API</Sub>
      <Endpoint metodo="GET" caminho={`${BASE}/api/v1`} />
      <Sub>Webhook de entrada</Sub>
      <Endpoint metodo="POST" caminho={`${BASE}/api/webhook/entrada/{clienteId}`} />
    </>
  )
}

function ConfigurarWebhook() {
  return (
    <>
      <P>
        O webhook de entrada recebe um evento do seu sistema e abre a automação ligada a ele no
        WhatsApp do contato. A configuração é feita no painel, na organização que vai receber os
        eventos.
      </P>
      <Passos>
        <Passo n={1} titulo="Crie o webhook">
          <p>
            Em <strong className="text-ink">Automações</strong>, aba <strong className="text-ink">Eventos</strong>,
            crie um webhook de entrada. O segredo aparece <strong className="text-ink">uma única vez</strong>:
            guarde num cofre do seu servidor, nunca no navegador nem no repositório.
          </p>
        </Passo>
        <Passo n={2} titulo="Cadastre o evento e a automação">
          <p>
            Dê um nome ao evento (por exemplo <Cod>vaga.aberta</Cod>) e escolha a automação que ele
            abre. O nome é comparado exatamente como foi escrito.
          </p>
        </Passo>
        <Passo n={3} titulo="Envie o evento assinado">
          <p>
            Faça um <Cod>POST</Cod> com o corpo em JSON e a assinatura HMAC no cabeçalho. Veja{' '}
            <a className="font-medium text-primary hover:underline" href="/ajuda/desenvolvedores/assinatura">Assinar a requisição</a>.
          </p>
        </Passo>
      </Passos>
      <Nota tom="dica" titulo="O plano precisa incluir o webhook">
        <p>Organização sem o recurso recebe 403 até o plano mudar.</p>
      </Nota>
    </>
  )
}

function Assinatura() {
  return (
    <>
      <P>
        Toda chamada leva o cabeçalho <Cod>x-autofluxos-assinatura</Cod> com o HMAC-SHA256 do
        corpo, calculado com o segredo do webhook e escrito em hexadecimal depois de{' '}
        <Cod>sha256=</Cod>.
      </P>
      <Sub>Como calcular</Sub>
      <Passos>
        <Passo n={1} titulo="Serialize o corpo uma vez">
          <p>Gere o JSON e guarde a string. A assinatura vale para esses bytes exatos.</p>
        </Passo>
        <Passo n={2} titulo="Calcule o HMAC">
          <p>HMAC-SHA256 da string, com o segredo como chave, em hexadecimal (64 caracteres).</p>
        </Passo>
        <Passo n={3} titulo="Envie a mesma string">
          <p>Mande no corpo exatamente a string assinada. Reformatar o JSON depois quebra a assinatura.</p>
        </Passo>
      </Passos>
      <BlocoDeCodigo trechos={CHAMADA} />
      <Sub>Trocar o segredo</Sub>
      <P>
        Uma organização pode ter mais de um webhook ativo, e o AutoFluxos aceita a assinatura de
        qualquer um deles. Para trocar sem parar a integração: crie um novo, passe o seu sistema
        para o segredo novo e só então apague o antigo.
      </P>
    </>
  )
}

function DispararEvento() {
  return (
    <>
      <Endpoint metodo="POST" caminho="/api/webhook/entrada/{clienteId}" />
      <P>
        Abre a automação cadastrada para o <Cod>evento</Cod> na conversa de WhatsApp do contato
        dono do <Cod>telefone</Cod>. A resposta volta na hora e o envio acontece em seguida.
      </P>
      <ListaDeCampos
        titulo="Parâmetro do caminho"
        campos={[{ nome: 'clienteId', tipo: 'string', obrigatorio: true, descricao: 'Identificador da organização. Aparece na tela do webhook, no painel.' }]}
      />
      <ListaDeCampos
        titulo="Cabeçalhos"
        campos={[
          { nome: 'x-autofluxos-assinatura', tipo: 'string', obrigatorio: true, descricao: <>HMAC-SHA256 do corpo em hexadecimal, no formato <Cod>sha256=&lt;hex&gt;</Cod>.</> },
          { nome: 'content-type', tipo: 'string', obrigatorio: true, descricao: <Cod>application/json</Cod> },
        ]}
      />
      <ListaDeCampos
        titulo="Corpo"
        campos={[
          { nome: 'evento', tipo: 'string', obrigatorio: true, descricao: 'Nome do evento cadastrado no painel, de 1 a 120 caracteres. A comparação é exata.' },
          { nome: 'telefone', tipo: 'string', obrigatorio: true, descricao: 'Telefone do contato com DDI e DDD, de 1 a 40 caracteres. O contato precisa já existir na organização.' },
          { nome: 'dados', tipo: 'object', descricao: 'Informações extras do evento. Quando a janela de 24 horas do WhatsApp está fechada, viram uma anotação no contato.' },
        ]}
      />
      <Respostas>
        <Resposta status={200} descricao="Evento recebido" aberta>
          <p>
            Corpo <Cod>{'{"ok": true}'}</Cod>. Também volta 200 quando não há automação para o evento,
            o telefone não é de um contato ou a janela de 24 horas está fechada: nesses casos nada é
            enviado e o motivo fica registrado no painel.
          </p>
        </Resposta>
        <Resposta status={400} descricao="Corpo ilegível, JSON inválido ou sem evento e telefone" corpo={`{
  "erro": "corpo inválido: espera { evento, telefone }"
}`} />
        <Resposta status={401} descricao="Assinatura ausente ou inválida" corpo={`{
  "erro": "assinatura inválida"
}`} />
        <Resposta status={403} descricao="O plano da organização não inclui webhook de entrada" corpo={`{
  "erro": "webhook pausado: o plano da organização não inclui webhook de entrada"
}`} />
        <Resposta status={413} descricao="Corpo acima de 64 KB" corpo={`{
  "erro": "corpo excede 64 KB"
}`} />
        <Resposta status={429} descricao="Mais de 120 chamadas por minuto para a organização" corpo={`{
  "erro": "muitas chamadas"
}`} />
      </Respostas>
    </>
  )
}

function Limites() {
  return (
    <>
      <ListaDeCampos
        campos={[
          { nome: 'Chamadas', tipo: '120 por minuto', descricao: 'Por organização. Acima disso a resposta é 429.' },
          { nome: 'Tamanho do corpo', tipo: '64 KB', descricao: 'Acima disso a resposta é 413, antes de qualquer outra conferência.' },
          { nome: 'Novas tentativas', tipo: 'nenhuma', descricao: 'O AutoFluxos não enfileira nem repete eventos. Se a sua chamada falhar, repita do seu lado.' },
          { nome: 'Duplicidade', tipo: 'sem chave', descricao: 'Não há identificador de idempotência: o mesmo evento enviado duas vezes abre a automação duas vezes.' },
        ]}
      />
      <Sub>Boas práticas</Sub>
      <ul className="ml-5 list-disc space-y-2">
        <li>Repita só em 429 e em erro de rede, com espera crescente. Erro 400, 401 e 403 não se resolve repetindo.</li>
        <li>Guarde no seu sistema que o evento foi enviado, para não mandar o mesmo duas vezes.</li>
        <li>Mantenha o segredo no servidor. Quem tem o segredo consegue abrir conversas em nome da sua empresa.</li>
      </ul>
    </>
  )
}

function ChamarSeuSistema() {
  return (
    <>
      <P>
        O bloco <strong className="text-ink">Chama um sistema</strong> faz uma requisição HTTP no
        meio da conversa e guarda partes da resposta em variáveis. É assim que a automação consulta
        horários, cria cadastros ou registra pedidos no seu sistema.
      </P>
      <Sub>Como a requisição sai</Sub>
      <ListaDeCampos
        campos={[
          { nome: 'Métodos', tipo: 'GET, POST, DELETE', descricao: <>Padrão <Cod>GET</Cod>. Um <Cod>POST</Cod> sem <Cod>content-type</Cod> vai como <Cod>application/json</Cod>.</> },
          { nome: 'Endereço', tipo: 'https', descricao: 'Só HTTPS, e nunca para rede interna (localhost, 10.x, 172.16 a 31, 192.168, 169.254). Aceita variáveis como {{telefone}}.' },
          { nome: 'Tempo limite', tipo: '10 segundos', descricao: 'Por tentativa. Até 3 redirecionamentos, 40 segundos no total.' },
          { nome: 'Novas tentativas', tipo: 'nenhuma', descricao: 'Se falhar, a conversa segue pelo caminho de erro que você desenhar, ou vai para a equipe.' },
          { nome: 'Teste', tipo: 'X-AutoFluxos-Teste: 1', descricao: 'Cabeçalho enviado só nos disparos da aba Testar do editor, para o seu sistema ignorar.' },
        ]}
      />
      <Sub>Credenciais</Sub>
      <P>
        Cadastre a chave do seu sistema em <strong className="text-ink">Ajustes, Chaves</strong>. O
        valor fica no cofre e não volta para a tela nem para o desenho da automação. Três formas:
      </P>
      <BlocoDeCodigo
        titulo="Como cada tipo chega no seu servidor"
        trechos={[
          { rotulo: 'bearer', linguagem: 'texto', codigo: 'Authorization: Bearer <valor>' },
          { rotulo: 'cabeçalho', linguagem: 'texto', codigo: '<campo>: <valor>' },
          { rotulo: 'query', linguagem: 'texto', codigo: 'https://seu-sistema.com/rota?<campo>=<valor>' },
        ]}
      />
      <Sub>Ler a resposta</Sub>
      <P>
        Em <strong className="text-ink">Guardar da resposta</strong>, cada linha leva um caminho com
        pontos até o valor e a variável que recebe. Para a resposta abaixo, <Cod>cliente.nome</Cod>{' '}
        guarda Ana e <Cod>horarios[]</Cod> transforma a lista em opções de menu.
      </P>
      <BlocoDeCodigo
        trechos={[
          {
            rotulo: 'Resposta do seu sistema',
            linguagem: 'json',
            codigo: '{\n  "cliente": { "id": 42, "nome": "Ana" },\n  "horarios": ["07:00", "10:00", "15:00"]\n}',
          },
        ]}
      />
      <Nota tom="dica" titulo="Modelo pronto">
        <p>
          O modelo <strong className="text-ink">O meu próprio sistema</strong> já vem com{' '}
          <Cod>POST</Cod>, JSON e o corpo <Cod>{'{"nome":"{{nome}}","telefone":"{{telefone}}"}'}</Cod>.
        </p>
      </Nota>
    </>
  )
}

function ChatDoSite() {
  return (
    <>
      <P>
        O chat do site coloca um balão de atendimento no seu site. As mensagens chegam na mesma
        caixa de entrada do WhatsApp e passam pelas mesmas automações.
      </P>
      <Passos>
        <Passo n={1} titulo="Cadastre os domínios">
          <p>
            Em <strong className="text-ink">Conversas, Canais, Site</strong>, informe os endereços onde
            o chat vai aparecer. Só HTTPS; o domínio com e sem <Cod>www.</Cod> é aceito.
          </p>
        </Passo>
        <Passo n={2} titulo="Cole o script">
          <p>Antes do fim do <Cod>&lt;body&gt;</Cod>, em todas as páginas:</p>
          <BlocoDeCodigo
            trechos={[{ rotulo: 'HTML', linguagem: 'texto', codigo: `<script src="${BASE}/chat/v1.js" data-chave="SUA_CHAVE" async></script>` }]}
          />
        </Passo>
        <Passo n={3} titulo="Publique e teste">
          <p>Abra o site num domínio cadastrado. Fora da lista, o balão não carrega.</p>
        </Passo>
      </Passos>
    </>
  )
}

function Verandi() {
  const linhas: [Metodo, string, string][] = [
    ['GET', '/pessoas?telefone={{telefone}}', 'Reconhece quem está falando'],
    ['POST', '/pessoas', 'Cadastra a pessoa'],
    ['GET', '/pessoas/{{pessoa_id}}', 'Agenda da pessoa'],
    ['GET', '/disponibilidade?de=&ate=', 'Dias e horários livres'],
    ['GET', '/catalogo', 'Modalidades e profissionais'],
    ['POST', '/participacoes', 'Marca o horário'],
    ['GET', '/participacoes/{{participacao_id}}', 'Consulta uma marcação'],
    ['DELETE', '/participacoes/{{participacao_id}}', 'Desmarca'],
    ['POST', '/espera', 'Entra na lista de espera'],
  ]
  return (
    <>
      <P>
        A integração com a Verandi usa os modelos prontos do bloco Chama um sistema, sobre a API{' '}
        <Cod>https://verandi.4yu.com.br/api/v1</Cod> com chave <Cod>vr_</Cod> do tipo bearer.
        Estas são as chamadas que os modelos fazem:
      </P>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {linhas.map(([metodo, caminho, descricao]) => (
          <li key={metodo + caminho} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="w-16">
              <SeloDeMetodo metodo={metodo} />
            </span>
            <code className="font-mono text-[13px] text-ink">{caminho}</code>
            <span className="ml-auto text-[13.5px] text-muted">{descricao}</span>
          </li>
        ))}
      </ul>
      <P>
        Para montar a conversa bloco a bloco, veja{' '}
        <a className="font-medium text-primary hover:underline" href="/ajuda/receitas">Seis modelos de conversa com a agenda</a>.
      </P>
    </>
  )
}

export const PAGINAS_DEV: PaginaDev[] = [
  { slug: 'visao-geral', grupo: 'Introdução', titulo: 'Visão geral', resumo: 'As cinco formas de integrar um sistema com o AutoFluxos.', Corpo: Visao },
  ...PAGINAS_API,
  { slug: 'webhook-de-entrada', grupo: 'Webhook de entrada', titulo: 'Configurar o webhook', resumo: 'Receba eventos do seu sistema e abra uma automação no WhatsApp do contato.', Corpo: ConfigurarWebhook },
  { slug: 'assinatura', grupo: 'Webhook de entrada', titulo: 'Assinar a requisição', resumo: 'Como calcular o HMAC-SHA256 que autentica cada chamada.', Corpo: Assinatura },
  {
    slug: 'disparar-evento',
    grupo: 'Webhook de entrada',
    titulo: 'Disparar um evento',
    resumo: 'Abre a automação do evento na conversa do contato.',
    metodo: 'POST',
    Corpo: DispararEvento,
    painel: [{ trechos: CHAMADA, titulo: 'Requisição' }, { trechos: RESPOSTA_OK, titulo: 'Resposta' }],
  },
  { slug: 'limites', grupo: 'Webhook de entrada', titulo: 'Limites e boas práticas', resumo: 'Quantas chamadas, qual tamanho e o que fazer quando falha.', Corpo: Limites },
  { slug: 'chamar-seu-sistema', grupo: 'Saída para o seu sistema', titulo: 'Chamar o seu sistema', resumo: 'Requisições HTTP feitas no meio da conversa, credenciais e leitura da resposta.', Corpo: ChamarSeuSistema },
  { slug: 'verandi', grupo: 'Saída para o seu sistema', titulo: 'Chamadas da Verandi', resumo: 'Os endpoints da agenda que os modelos prontos usam.', Corpo: Verandi },
  { slug: 'chat-do-site', grupo: 'Site', titulo: 'Instalar o chat do site', resumo: 'Coloque o atendimento no seu site com uma linha de script.', Corpo: ChatDoSite },
]

export function acharPaginaDev(slug: string) {
  return PAGINAS_DEV.find((pagina) => pagina.slug === slug)
}
