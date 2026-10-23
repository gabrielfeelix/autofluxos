# D. Bancos com API Pix de cobrança e boleto, vistos por um sistema terceiro

Data da pesquisa: 23/10/2026. Método: documentação oficial lida quando o portal permitiu (Efí, Cora, Sicredi PDF, spec BACEN, changelog do Inter). Portais do Inter (referências), Banco do Brasil e Sicoob são SPA ou bloqueiam leitura automática: nesses, o que veio de SDK, guia de ERP ou resumo de busca está marcado como **[fonte indireta]**, e o que não achei está marcado `[?]`. Nada de endpoint inventado.

Legenda: `[?]` = não confirmado em doc oficial. **[fonte indireta]** = SDK/ERP/blog de terceiro, ou resumo de busca.

---

## 0. Resposta curta

1. **Um adaptador "API Pix padrão" é viável e vale a pena.** Efí, Inter, Sicoob, Sicredi, BB e (provavelmente) C6 falam o padrão BACEN (`cob`, `cobv`, `webhook/{chave}`, `pix`). O que varia é configuração: URL base, URL do token, estilo de autenticação do token, escopos, headers extras, e como o webhook é protegido. A **Cora não é padrão BACEN** (API própria, `invoices`), mas é a mais simples de plugar. Os bancos do padrão compartilham um único fluxo de ~5 chamadas.
2. **O ponto crítico não é a API, é o webhook com mTLS.** A spec BACEN diz que o callback `POST {webhookUrl}/pix` "está protegido por uma camada de autenticação mTLS" ([bacen/pix-api openapi.yaml](https://github.com/bacen/pix-api/blob/master/openapi.yaml)). Vercel não valida certificado de cliente na entrada (não achei doc oficial que suporte; só resposta de IA no fórum: [community.vercel.com/t/mtls-de-entrada/29186](https://community.vercel.com/t/mtls-de-entrada/29186)). Saídas: (a) **Efí documenta "skip mTLS"** com header no cadastro do webhook mais `hmac` na URL; (b) **Cora** nem usa mTLS no webhook; (c) para os demais, **polling** (recomendado como base de tudo) ou um receptor mTLS fora da Vercel.
3. **Maior atrito é o dono**: gerar certificado e credenciais num painel (Efí: self-service; Inter: com análise; Sicoob: certificado ICP-Brasil; Sicredi: via "técnico integrador" e chamado; BB: portal de desenvolvedor mais convênio). Isso é onboarding, não código.
4. **Ordem recomendada**: Efí, Cora, Inter, Sicoob, Sicredi, BB. C6 por último ou só sob demanda.

---

## 1. O padrão BACEN (base do adaptador comum)

Fonte: [openapi.yaml v2.10.0 do bacen/pix-api](https://github.com/bacen/pix-api/blob/master/openapi.yaml) (lido por trechos; o arquivo tem 9.124 linhas).

| Item | Padrão |
|---|---|
| Cobrança imediata | `PUT /cob/{txid}` (txid do recebedor), `POST /cob` (PSP gera o txid, opcional), `PATCH /cob/{txid}` (revisar/remover), `GET /cob/{txid}`, `GET /cob?inicio&fim` |
| Cobrança com vencimento | `PUT /cobv/{txid}`, `PATCH`, `GET /cobv/{txid}`, `GET /cobv?inicio&fim` |
| **txid** | regex `[a-zA-Z0-9]{26,35}`, criado só pelo recebedor, único por CPF/CNPJ do recebedor. UUID sem hífens (32) serve. |
| Status da cob | `ATIVA`, `CONCLUIDA`, `REMOVIDA_PELO_USUARIO_RECEBEDOR`, `REMOVIDA_PELO_PSP` (o enum formal fica na seção `components/schemas`, que não li até o fim [?] para o último valor) |
| Campos mínimos do `cob` | `calendario.expiracao` (segundos), `valor.original` (string "123.45"), `chave`, e `devedor` {cpf ou cnpj, nome} (opcional na imediata) |
| Retorno | objeto cob com `txid`, `status`, `location`, `pixCopiaECola`; Pix recebidos aparecem em `pix[]` dentro do `GET /cob/{txid}` (com `endToEndId`, `valor`, `horario`, `devolucoes[]`) |
| Consulta de Pix | `GET /pix/{e2eid}`, `GET /pix?inicio&fim&txid=...` (bom para polling) |
| Devolução | `PUT /pix/{e2eid}/devolucao/{id}`, `GET /pix/{e2eid}/devolucao/{id}`; id da devolução `[a-zA-Z0-9]{1,35}` |
| Webhook | `PUT /webhook/{chave}` body `{"webhookUrl": "https://..."}`, `GET`, `DELETE`. O PSP chama `POST {webhookUrl}/pix` (o `/pix` é concatenado) com `{"pix":[{endToEndId, txid, valor, horario, ...}]}`. Uma chave, uma URL. |
| Auth | OAuth2 client_credentials + mTLS (RFC 8705): [Sicredi cita explicitamente "mTLS, que é o padrão utilizado pelo Banco Central"](https://www.sicredi.com.br/media/produtos/filer_public/2026/01/13/guia_tecnico_integracoes_apipix.pdf) |

Observação: o webhook só avisa de Pix **associado a txid** (cob/cobv). Aviso é só gatilho; a regra do AutoFluxos (reler pelo `GET /cob/{txid}`) casa perfeitamente com o padrão.

---

## 2. Banco por banco

### 2.1 Efí (ex-Gerencianet)

**Padrão BACEN: sim.** Melhor documentada e a única que oficializa "skip mTLS".

1. **Credenciais (self-service, sem gerente)**: conta Efí Empresas; menu API, "Criar aplicação", habilitar API Pix e escolher escopos; cada aplicação gera 2 pares Client_Id/Client_Secret (Produção e Homologação). Certificado: API, "Meus Certificados", "Novo Certificado", baixa `.p12` **uma única vez** (só no momento da criação); um certificado serve a várias aplicações; até 5 por ambiente. Fonte: [dev.efipay.com.br/docs/api-pix/credenciais](https://dev.efipay.com.br/docs/api-pix/credenciais). Custo de certificado: grátis (emitido pela Efí) [?] não vi menção de taxa.
2. **OAuth**: `POST /oauth/token`, Basic com Client_Id:Secret, body JSON `{"grant_type":"client_credentials"}`, `expires_in` 3600 s. **mTLS obrigatório em todas as requisições, inclusive no token.** Mesma fonte. Bases: produção `https://pix.api.efipay.com.br`, homologação `https://pix-h.api.efipay.com.br`.
3. **Cob imediata**: `POST /v2/cob` (Efí gera txid), `PUT /v2/cob/:txid`, `PATCH`, `GET /v2/cob/:txid` (e `?revisao=N`), `GET /v2/cob?inicio&fim`. Escopos `cob.write`/`cob.read`. Campos: `calendario.expiracao`, `devedor`, `valor.original`, `chave`, `solicitacaoPagador`, `infoAdicionais`, `loc`. Resposta traz `pixCopiaECola`. txid duplicado dá `txid_duplicado`. Fonte: [cobrancas-imediatas](https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas). **Cobv**: `PUT /v2/cobv/:txid` (201), `PATCH`, `GET`, lista; `cobv.write/read`; `calendario.dataDeVencimento` e `validadeAposVencimento`. Fonte: [cobrancas-com-vencimento](https://dev.efipay.com.br/docs/api-pix/cobrancas-com-vencimento).
4. **Consulta/estados**: `ATIVA`, `CONCLUIDA`, `REMOVIDA_PELO_USUARIO_RECEBEDOR`; cancelar = `PATCH` com esse status; devoluções vêm no array `pix[].devolucoes` do `GET`. Sandbox: valores de R$ 0,01 a R$ 10,00 são confirmados e disparam webhook; acima de R$ 10 fica ATIVA sem webhook.
5. **Webhook**: `PUT /v2/webhook/:chave` (`webhook.write`), sucesso 201. Na criação a Efí manda uma notificação de teste e faz **duas verificações de mTLS** (uma sem certificado que deve ser recusada, outra com o handshake certo); erro 400 "A autenticação de TLS mútuo não está configurada na URL informada". **Skip mTLS**: header `x-skip-mtls-checking: true` no `PUT` do cadastro; neste caso a Efí documenta exigir `hmac` na URL (`?hmac=xyz&ignorar=`, o `ignorar=` evita que `/pix` seja anexado) e recomenda restringir ao IP `34.193.116.226`. A página não especifica algoritmo do hmac: é um segredo nosso na query string, validado por nós. Retentativas: qualquer não-2xx gera até 9 tentativas (5 a 160 min), timeout 60 s; reenvio manual `POST /v2/gn/webhook/reenviar` (30 dias). Fonte: [webhooks (pt)](https://dev.efipay.com.br/docs/api-pix/webhooks) e [(en)](https://dev.efipay.com.br/en/docs/api-pix/webhooks/) (o nome do header só aparece na versão em inglês).
6. **Boleto**: API Cobranças separada. `POST /v1/charge/one-step` cria cobrança e boleto numa chamada; **Bolix** = boleto com Pix (retorna `pix.qrcode` copia e cola); `notification_url` + `custom_id` em `metadata`; ao mudar o status a Efí faz POST na URL ([doc boleto](https://dev.efipay.com.br/docs/api-cobrancas/boleto)). Token da Cobranças: `POST /v1/authorize` (Basic, client_credentials), expira em 600 s, bases `https://cobrancas.api.efipay.com.br` / `cobrancas-h...` ([credenciais Cobranças](https://dev.efipay.com.br/docs/api-cobrancas/credenciais)). Se a Cobranças exige mTLS: a página não diz `[?]`. A notificação da Cobranças é POST com token a consultar (padrão Efí, não BACEN) `[?]` detalhe.
7. **Pix Automático**: sim, em produção na API Pix: `POST/GET/PATCH /v2/rec`, `solicrec`, `cobr` (`PUT/POST /v2/cobr`, retentativa), `locrec`; escopos `rec.*`, `solicrec.*`, `cobr.*`; 4 jornadas descritas. Webhooks próprios `/v2/webhookrec` e `/v2/webhookcobr`. Fonte: [pix-automatico](https://dev.efipay.com.br/docs/api-pix/pix-automatico).
8. **Sandbox**: sim (`pix-h`), credenciais e certificado de homologação separados.
9. **Popularidade em pequeno negócio**: razoável (muito comum em integrações de e-commerce/WhatsApp, bastante usada por autônomos e infoprodutores) **[opinião, sem dado oficial]**.
10. **Riscos**: o `.p12` só baixa uma vez (se perder, gera outro); tarifa por Pix recebido existe (a doc menciona "notificação de tarifa" em `PUT /v2/gn/config`; valores não confirmados [?]); a Efí não tem conta com gerente, então é a mais "sem fricção". Passo a passo do dono: abrir conta Efí Empresas, criar aplicação com escopos, baixar `.p12`, copiar Client_Id/Secret, ter uma chave Pix, enviar tudo ao AutoFluxos (a gente registra o webhook com skip).
11. **Veredito: ótimo. Esforço P** como primeiro banco (inclui o adaptador comum). Boleto/Bolix: +P.

### 2.2 Banco Inter (Inter Empresas)

**Padrão BACEN: sim** (paths `/pix/v2/cob`, `/pix/v2/cobv/{txid}`, `/pix/v2/webhook/{chave}`; scopes `cobv.write/read`, `webhook.read`...). Fonte: resumo da busca sobre [developers.inter.co/references/pix](https://developers.inter.co/references/pix); o portal é SPA e a página não renderiza por fetch, então os detalhes são **[fonte indireta]**. Base de produção citada: `https://cdpj.partners.bancointer.com.br`.

1. **Credenciais**: Internet Banking PJ (login por QR code), "Soluções para sua empresa", "Nova Integração", aceitar permissões, depois baixar e **ativar** chaves e certificado. Fonte: [home do portal](https://developers.inter.co/). **Mudança importante de 2025/26** (changelog oficial):
   - 24/12/2025: Pix e Banking (exceto saldo/extrato) **desabilitados para novas integrações**, "sem data estabelecida para retorno" ([changelog](https://developers.inter.co/changelog/24/12/2025)).
   - 12/03/2026: reabilitadas, mas pedem **formulário e análise** (status "Em validação"; enquanto assim, não cria nova integração) ([changelog](https://developers.inter.co/changelog/12/03/2026)).
   - 10/04/2026: "novo processo de análise... antes da liberação dos certificados" ([changelog](https://developers.inter.co/changelog/10/04/2026)).
   Prazo e critérios da análise `[?]`. É risco real de atrito e de reversão unilateral do banco.
2. **OAuth**: token de 60 min que deve ser reutilizado (resumo de busca do portal, **[fonte indireta]**); endpoint exato e se o token exige mTLS: `[?]` (SDKs de terceiros mostram mTLS com .crt/.key do portal, **[fonte indireta]**). Certificado: renovação até 90 dias após expirar, mantendo clientId/secret; o certificado novo precisa ser reinstalado ([changelog 24/12/2025](https://developers.inter.co/changelog/24/12/2025), [19/11/2024](https://developers.inter.co/changelog/19/11/2024)). Guia de terceiro fala em 12 meses de validade **[fonte indireta]**.
3/4. **cob/cobv**: existem; também **lote de cobv** (`lotecobv`) (changelog 23/08/2024). Callback inclui `nome` e `cpfCnpj` do pagador (10/09/2024). Detalhes de campos: seguem BACEN `[?]` quirks próprios.
5. **Webhook**: `PUT /pix/v2/webhook/{chave}` com `webhookUrl` HTTPS; callbacks trazem header `x-conta-corrente`; até 4 retentativas (20, 30, 60, 120 min) **[fonte indireta]**; lista de IPs publicada na doc (changelog 21/07/2025); **validador de URL do webhook** (14/01/2025); reenvio de callback por id (14/04/2025). **Se o Inter exige mTLS no receptor e se oferece skip: `[?]`, não consegui ler a página de webhook.** Testar no sandbox antes de prometer.
6. **Boleto**: API Cobrança "Boleto com Pix" **V3** (V2 descontinuada em 18/05/2026; V3 gera o QR Pix automaticamente; `PUT /webhook` mantido; endpoint de retry de callbacks) ([changelog 18/05/2026](https://developers.inter.co/changelog/18/05/2026), [05/12/2025](https://developers.inter.co/changelog/05/12/2025)).
7. **Pix Automático**: em produção desde 08/07/2025 ([changelog](https://developers.inter.co/changelog/08/07/2025)); guia de jornadas (03/07/2025).
8. **Sandbox**: sim, com collection Postman.
9. **Popularidade**: alta entre MEI/microempresa (conta PJ gratuita, muito aberta por autônomos) **[opinião]**.
10. **Riscos**: análise/aprovação do banco, API já foi "desligada" para novos clientes uma vez; mudança de V2 para V3 do boleto mostra ciclo de deprecação curto; certificado com validade e renovação manual.
11. **Veredito: muito demandado, mas arriscado. Esforço M** (padrão BACEN, mais quirks e dependência de aprovação). Só vale depois da Efí e com teste real de uma conta do Gabriel.

### 2.3 Sicoob

**Padrão BACEN: sim** (manual API Pix 2.2.1 de 2021 lista `PUT/PATCH/GET/POST /cob`, `PUT/GET/DELETE /webhook/{chave}`, `GET /webhook`): [Manual Sicoob Pix](https://www.sicoob.com.br/documents/61112012/64877374/Sicoob+Pix+%E2%80%93+Manual+para+utiliza%C3%A7%C3%A3o+da+API+Pix.pdf/994711e9-bdf4-a479-f9f1-33266d83d58c?t=1627932447480&download=true) **[fonte indireta, o PDF veio como HTML; dado vem do resumo de busca]** e portal [developers.sicoob.com.br](https://developers.sicoob.com.br/portal/) (SPA, não lido).

1. **Credenciais**: cadastro de "Aplicativo" por conta em developers.sicoob.com.br. Exige **certificado ICP-Brasil** (A1, e-CNPJ), em `.pfx` (comunicação) e `.cer`/PEM (cadastro); o Sicoob então gera o `ClientId`; a doc de um SDK manda "procurar a agência" **[fonte indireta: [SharpSistemas/SicoobAPI](https://github.com/SharpSistemas/SicoobAPI)]**. Tipos de acesso no portal: Associado, Associado PJ, Yoou ([OpenPix](https://developers.openpix.com.br/en/docs/bank-integrations/integration-sicoob)). Prazo/custo do certificado: custo é do dono (e-CNPJ A1 pago) `[?]` valor. Sicoob não aceita certificado autoassinado em produção **[fonte indireta]**.
2. **OAuth**: client_credentials com token **vinculado ao certificado** (RFC 8705); token dura 300 s **[fonte indireta]**; host de token e escopos exatos `[?]` (SDK lista escopos `cob`, `cobv`, `lotecobv`, `pix`, `webhook`, `payloadlocation`, Read/Write). Sandbox usa client credentials simples, produção usa certificado **[fonte indireta]**.
3/4. cob/cobv padrão, conforme manual 2021 (pode ter mudado).
5. **Webhook**: POST em `{url}/pix`, sem header especial, corpo `{"pix":[...]}`; segundo o suporte do Sicoob, identificação por IP **[fonte indireta]**. mTLS no receptor e skip: `[?]`.
6. **Boleto**: API Cobrança Bancária do Sicoob existe (pacote `Sicoob.Cobranca`), exige convênio de cobrança `[?]` detalhes.
7. **Pix Automático**: `[?]`.
8. **Sandbox**: sim, no portal.
9. **Popularidade**: alta no interior e entre cooperados, baixa fora **[opinião]**.
10. **Riscos**: a doc oficial é descrita por devs como "falha, incompleta" (README do SDK acima); SDKs maliciosos circulam no NuGet (um impersonando o SDK do Sicoob exfiltra certificados; [Socket](https://socket.dev/blog/malicious-nuget-package-impersonates-sicoob-sdk)): nunca usar SDK de terceiro, falar HTTP direto; ida à agência para o dono.
11. **Veredito: viável, atrito alto. Esforço M.**

### 2.4 Banco do Brasil

**Padrão BACEN: sim para Pix** (`https://api-pix.bb.com.br/pix/v2/cobv`, `PUT`, token `https://oauth.bb.com.br/oauth/token`, escopos `cobv.write/read`, `pix.write/read` segundo [guia da Celcoin, indireta](https://suporte.celcoin.com.br/hc/pt-br/articles/50242888352667-Configura%C3%A7%C3%A3o-do-Pix-BB-Banco-do-Brasil)). Os portais [bb.com.br/developers](https://bb.com.br/developers) e [apoio.developers.bb.com.br](https://apoio.developers.bb.com.br/) devolveram 403 ou página em branco (JS), então tudo abaixo é **[fonte indireta]** e boa parte é `[?]`.

1. **Credenciais**: aplicação no portal de desenvolvedores do BB; entrega `client_id`, `client_secret`, `developer_application_key` (header/parametro `gw-dev-app-key` em homologação, `gw-app-key` em produção) e um **certificado** (.pfx) que o cliente sobe no integrador (Celcoin acima). Há aviso de que o BB vai trocar `gw-dev-app-key` por header de CNPJ para parceiros `[?]`. Passos no portal, prazo e custo `[?]`. A API de Cobrança (boleto) exige **convênio de cobrança ativo** com o BB ([BB, API de Cobrança](https://www.bb.com.br/site/developers/api-cobranca/), via resumo de busca).
2. **OAuth**: client_credentials, `Content-Type: application/x-www-form-urlencoded`; token exige certificado? `[?]` (para Pix, spec BACEN diz sim).
3/4. cob/cobv padrão; também webhook que só cobre Pix com txid (resumo do portal de apoio, indireto).
5. **Webhook**: PSP exige mTLS no receptor para a API de Arrecadação (pré-requisito "certificados mTLS para usuários de webhook", resumo de busca). Skip: `[?]`.
6. **Boleto**: API Cobrança v2, "Gerar Pix de boletos"/BolePix; convênio obrigatório.
7. **Pix Automático**: BB divulga suporte em blog; API `[?]`.
8. **Sandbox**: sim (`api.sandbox.bb.com.br`, `oauth.sandbox.bb.com.br`, segundo o SDK da DBSeller, indireta).
9. **Popularidade**: alta (base enorme de MEI e produtor rural), mas com perfil mais "agência".
10. **Riscos**: ambiente de homologação com host próprio, chaves divergentes entre ambientes, convênio de cobrança, doc inacessível por automação.
11. **Veredito: viável mas com muito `[?]`. Esforço G** por incerteza de onboarding; só com cliente real em mãos.

### 2.5 Sicredi

**Padrão BACEN: sim, com doc oficial excelente**: [Guia técnico API Pix Sicredi (jan/2026)](https://www.sicredi.com.br/media/produtos/filer_public/2026/01/13/guia_tecnico_integracoes_apipix.pdf), 51 páginas (li o PDF).

1. **Credenciais (o mais trabalhoso)**: o associado precisa ter chave Pix na conta Sicredi, celular e e-mail atualizados na cooperativa e passar pela cooperativa para receber um **ID de adesão** por e-mail. Quem faz o trabalho técnico é um **"técnico do associado"**: cadastra-se no Portal do Desenvolvedor ([developer.sicredi.com.br](https://developer.sicredi.com.br)), abre chamado "Acesso à API Pix" informando CNPJ e ID de adesão (resposta em 2 horas úteis), gera um **CSR** no portal (Registrar Novo CSR), o Sicredi assina e disponibiliza o `.CER` mais a cadeia, o técnico baixa a chave privada e gera Client_ID/Secret em "Gerar Credenciais". Homologação só por e-mail a `integracoes_pix@sicredi.com.br`. **Um terceiro (AutoFluxos) teria de ser o "técnico integrador" de cada associado**: o guia prevê isso, mas é um processo manual por cliente `[?]` se é viável em escala.
2. **OAuth**: `POST https://api-pix.sicredi.com.br/oauth/token`, Basic client_id:secret, `application/x-www-form-urlencoded`, `grant_type=client_credentials` e `scope` (ex.: `cob.write cob.read cobv.write cobv.read webhook.read webhook.write`, separado por espaço ou `+`). mTLS obrigatório. API base: `https://api-pix.sicredi.com.br/api/v2` (o exemplo do guia usa `/api/v3/cob/...`, divergência a conferir `[?]`).
3/4. cob/cobv padrão; devolução e consulta de Pix recebidos descritas.
5. **Webhook**: `PUT /webhook/{chave}` com `webhookURL`. O servidor receptor deve: TLS 443 com certificado de **CA pública**, URL HTTPS, e ter a **cadeia completa do Sicredi instalada como confiável**; validação do certificado do Sicredi (`webhook-sicredi.CER`) é **opcional**. Isso sugere que o Sicredi se apresenta com certificado e o servidor deveria confiar nele, mas o guia **não diz claramente se rejeita receptor sem mTLS**: `[?]`, testar.
6. **Boleto**: boleto híbrido e cobrança têm suporte e e-mail próprios (`homologacoes_recebimentos@sicredi.com.br`); API de Cobrança é outra, não lida `[?]`.
7. **Pix Automático**: sim, Anexo III do guia (jornadas 1 a 4, `POST /v1/rec`, `/v2/cobv`).
8. **Sandbox**: homologação sob pedido por e-mail.
9. **Popularidade**: alta entre associados de cooperativa Sicredi no Sul e Centro-Oeste **[opinião]**.
10. **Riscos**: onboarding manual por cliente, CSR/chave privada gerada no portal, validade de certificado a renovar.
11. **Veredito: viável tecnicamente, difícil de escalar. Esforço G** (principalmente processo, não código).

### 2.6 Cora

**Padrão BACEN: NÃO.** API própria (REST de `invoices`), mas a mais simples de plugar. Docs oficiais lidas em [developers.cora.com.br](https://developers.cora.com.br/) (versão `.md` de cada página e `llms.txt`).

1. **Credenciais**: modalidade **Integração Direta** (cliente usa as APIs na própria conta). Pede-se em app ou Cora Web, "Conta > Integrações via APIs"; entrega `client-id`, **certificado `.pem` e `private-key`**, distintos por ambiente (Stage e produção) ([Instruções iniciais](https://developers.cora.com.br/docs/instrucoes-iniciais), [Client Credentials](https://developers.cora.com.br/docs/client-credentials-int-direta)). Plano exigido e custo: um agregador diz que precisa do plano CoraPro (R$ 44,90/mês) **[fonte indireta]**, não vi isso na doc oficial `[?]`. Certificado vale cerca de 1 ano (artigo do [Omie](https://ajuda.omie.com.br/pt-BR/articles/15552592-configurando-a-integracao-com-o-banco-cora-pix-via-api), **indireta**). Há também modalidade **Parceria Cora** (OAuth authorization_code, o dono autoriza o app, sem certificado do dono): seria o melhor caminho para um SaaS, mas é programa comercial com a Cora (empresas ERP/CRM) `[?]` requisitos.
2. **OAuth**: `POST https://matls-clients.api.cora.com.br/token` (Stage: `matls-clients.api.stage.cora.com.br`) com `--cert/--key`, `grant_type=client_credentials&client_id=...`, **sem secret**, token de 86.400 s. **mTLS em tudo na Integração Direta.**
3. **Pix**: `QR code Pix v2` (mesmo recurso `invoices`, forma "pix"), campos `customer`, `services[].amount` em centavos, `payment_terms.due_date`, `code` (nosso id), header **`Idempotency-Key` (UUID obrigatório)**. Resposta tem `id`, `status`, `pix.emv` (**o copia e cola**), QR em PNG. Mínimo de **R$ 5,00** (500) por QR; precisa de chave Pix cadastrada ([doc](https://developers.cora.com.br/reference/qr-code-pix-v2)).
4. **Estados**: `DRAFT`, `OPEN`, `IN_PAYMENT`, `LATE`, `PAID`, `CANCELLED`. Cancelamento: endpoint de cancelamento de boleto (mesmo recurso) `[?]` se cancela QR Pix.
5. **Webhook (ótimo para Vercel)**: cadastra-se via API (`Criação de endpoints`, `resource` + `trigger`, ex. `invoice.paid`); a Cora faz **POST sem corpo**, com os dados nos **headers**: `webhook-event-id`, `webhook-event-type`, `webhook-resource-id` e `user-agent: Cora-Webhook` ([doc](https://developers.cora.com.br/reference/exemplo-de-post-da-notifica%C3%A7%C3%A3o)). A doc não fala em mTLS nem em assinatura no receptor, o que casa com "só o id sai do aviso": relê-se `GET invoice` pelo `resource-id`. Retentativas: `[?]`.
6. **Boleto**: sim, `Boletos v2` (boleto registrado e carnê), mesmo `POST /v2/invoices`.
7. **Pix Automático**: `[?]`, não aparece na lista da doc.
8. **Sandbox**: Stage, com endpoint para simular pagamento.
9. **Popularidade**: alta entre MEI/pequenas empresas de serviço e contadores **[opinião]**.
10. **Riscos**: não padrão (adaptador próprio), certificado com validade anual, mínimo de R$ 5, requisito de plano `[?]`.
11. **Veredito: bom. Esforço M** (adaptador próprio, mas fluxo curto e webhook trivial).

### 2.7 C6 Bank PJ

**Padrão BACEN: provável, `[?]`.** Não consegui ler a doc oficial (site com bloqueio Cloudflare para automação; portal C6 Developers não localizado).

- O C6 oferece integração com ERP e exige cadastro no portal "C6 Developers", homologação do sistema e só depois a integração (blog do banco: [c6bank.com.br/blog/api-c6-bank](https://www.c6bank.com.br/blog/api-c6-bank), resumo de busca). O Omie diz que a API habilita **Boleto + Pix juntos** (carteira de cobrança contratada), com Client ID/Secret e certificado entregues pelo banco, e tarifa dependente do plano ([Omie](https://ajuda.omie.com.br/pt-BR/articles/17059704-configurando-a-integracao-com-o-c6-bank-boleto-pix-via-api), indireta).
- Sinal de que há API Pix padrão: um pacote PHP de terceiros lista cob, cobv e webhook ([packagist](https://packagist.org/packages/divulgueregional/api-c6-bank), indireta).
- **Homologação formal do integrador pelo C6 e carteira contratada** indicam fricção alta e dependência de gerente.
- **Veredito: deixar para depois. Esforço G** (incerteza).

### 2.8 Os que não têm, ou não têm acesso fácil

- **Nubank PJ**: não encontrei API pública para recebimento Pix. O que existe é cobrança dentro do app (QR e copia e cola manuais, gratuita) ([Tecnoblog](https://tecnoblog.net/385939/nubank-libera-cobranca-via-pix-conta-pj/), [Canaltech](https://canaltech.com.br/negocios/nubank-lanca-novo-qr-code-para-clientes-pj-receberem-por-pix-204674/)). **Sem API acessível a pequeno negócio.**
- **Itaú**: tem API Pix (padrão), mas SDKs relatam duas habilitações junto ao banco (Pix/bolecode e alteração de boleto) e o portal é de parceiro/devportal; acesso sem gerente `[?]` (não confirmado). Resumo de busca, indireta.
- **Bradesco**: manual oficial da API Pix 2.0.0 (out/2020) com OAuth2, cobrança, devolução e webhook ([PDF](https://banco.bradesco/pix/assets/docs/api_pix_200.pdf)); contratação via banco/gerente `[?]`.
- **Santander**: página de Pix no developer.santander.com.br existe (slide deck), conteúdo não lido; acesso sem gerente `[?]`.
- Conclusão: **tratar como "só com gerente, fora do escopo"**. Dono desses bancos usa Efí, Cora ou Inter de segunda conta, ou entra por gateway que já foi feito (Mercado Pago, Asaas, PagBank, InfinitePay).

---

## 3. Comparativo rápido

| Banco | Padrão BACEN | Cert do cliente | Token exige mTLS | Webhook sem mTLS no nosso lado | Autoserviço | Boleto por API | Pix Automático | Esforço |
|---|---|---|---|---|---|---|---|---|
| Efí | sim | .p12 grátis, self-service | sim | **sim (skip + hmac + IP)** | sim | sim (Bolix) | sim | P |
| Cora | não (própria) | .pem/.key pelo app | sim | **sim, aviso sem corpo e sem mTLS** | sim (plano `[?]`) | sim | `[?]` | M |
| Inter | sim | .crt/.key, **com análise** | `[?]` | `[?]` | análise do banco | sim (V3) | sim | M |
| Sicoob | sim | **ICP-Brasil do dono** | sim | `[?]` | via agência | sim (convênio) | `[?]` | M |
| Sicredi | sim | CSR via "técnico", chamado | sim | `[?]` (doc ambígua) | não | via outra API | sim | G |
| BB | sim | .pfx via portal | `[?]` | `[?]` | portal + convênio | sim (convênio) | `[?]` | G |
| C6 | provável | pelo banco | `[?]` | `[?]` | gerente/homologação | só junto com Pix | `[?]` | G |

---

## 4. Webhook com mTLS na Vercel: como resolver

**Fato**: a spec BACEN protege o callback com mTLS; o PSP checa isso ao cadastrar (a Efí testa recusar conexão sem certificado). A Vercel termina o TLS na borda e **não oferece verificação de certificado de cliente** (não achei suporte na doc oficial; resposta do fórum diz que não há `[?]` confirmação oficial).

Opções, da melhor para a pior:

1. **Polling como mecanismo primário (recomendado, vale para todos os bancos padrão BACEN).** Sem receptor, sem mTLS de entrada. Estratégia:
   - ao criar a cobrança, agendar leituras `GET /cob/{txid}` com atraso crescente (poucos segundos nos primeiros minutos, depois a cada 1 a 5 min até vencer);
   - reconciliação em lote por `GET /pix?inicio&fim` (lista Pix recebidos do período) a cada N minutos, uma vez por conexão ativa.
   - Cuidado: **cron da Vercel no plano Hobby só roda 1x/dia** (limite conhecido `[?]` conferir plano atual). O agendador tem de ser externo: **Supabase `pg_cron` + `pg_net`** chamando uma rota nossa autenticada (o banco já está no Supabase), ou GitHub Actions.
   - Custo: latência de até 1 a 5 min para marcar pago, mais chamadas ao banco do dono (cuidar de rate limit; BACEN não fixa um limite universal `[?]`).
2. **Efí: skip mTLS.** `PUT /v2/webhook/:chave` com header `x-skip-mtls-checking: true` e URL `https://.../api/webhook/pix/<conexaoId>?hmac=<segredo>&ignorar=`. Validar o `hmac` (comparação em tempo constante), opcionalmente o IP `34.193.116.226`, extrair só `txid`/`endToEndId` e **reler com `GET /v2/cob/:txid`**. Atende a regra "nunca confiar no corpo". Polling continua como rede de segurança (a Efí reenvia 9 vezes mas pode falhar).
3. **Cora: sem mTLS no webhook**, receber o POST normal da Vercel, validar o `webhook-resource-id` relendo o `invoice`.
4. **Receptor mTLS fora da Vercel (só para quem não tem skip):** um proxy minúsculo (Fly.io, VPS pequeno, ou AWS API Gateway com mTLS/truststore e Lambda) que exige certificado de cliente da cadeia do banco, e repassa **só o txid** à Vercel com HMAC nosso. Alternativa: Cloudflare na frente com mTLS (disponibilidade em planos baixos `[?]` não verificada). Cuidado: cada banco usa uma CA diferente para o certificado de cliente do webhook (Sicredi exige instalar a cadeia dele); manter um truststore por banco. Só vale se algum cliente grande exigir latência de segundos. Custo de operar um servidor adicional e responder 2xx rápido (a Efí tem timeout de 60 s).
5. **Não fazer**: tentar "validar" mTLS dentro da função serverless (o handshake já passou), nem aceitar o corpo do webhook como verdade.

---

## 5. Desenho do adaptador comum

### 5.1 Contrato (o `GatewayDePagamento` de `src/channels/pagamento.ts`)

- `criarCobranca`: `txid = referencia sem hífens` (UUID de 32 chars cabe em `[a-zA-Z0-9]{26,35}`). `PUT /cob/{txid}` (se `venceEm` for no futuro próximo) ou `PUT /cobv/{txid}` (se a cobrança tem vencimento por data). `calendario.expiracao = segundos até venceEm` (limite do banco `[?]`). `valor.original = (centavos/100).toFixed(2)` (string, sem float). `devedor` só se `documento` preenchido (cpf 11 dígitos, cnpj 14). `chave` da conexão. Retorna `{pagamentoId: txid, preferenciaId: null, pixCopiaCola: resp.pixCopiaECola, link: null}`.
- `lerPagamento(txid)`: `GET /cob/{txid}` (ou `/cobv`). Mapa: `ATIVA` -> `pendente`; `CONCLUIDA` -> `paga` (valor e `pagaEm` de `pix[0].valor` e `pix[0].horario`); `REMOVIDA_PELO_USUARIO_RECEBEDOR` ou `REMOVIDA_PELO_PSP` -> `cancelada`; `pix[].devolucoes[]` com status `DEVOLVIDO` somando o valor pago -> `estornada`. `referencia` = txid.
- `cancelarPagamento`: `PATCH /cob/{txid}` com `{"status":"REMOVIDA_PELO_USUARIO_RECEBEDOR"}` (só enquanto `ATIVA`; já pago dá 400, "está certo").
- `criarAutorizacaoPix` / `lerAdesao` / `encerrarAdesao`: Pix Automático (`rec`, `solicrec`, `cobr`), só para bancos que expõem (Efí, Inter, Sicredi), fase posterior.

### 5.2 Extensões necessárias na interface

`AcessoAoGateway` hoje é `{token, ambiente}`. O padrão BACEN pede mais. Proposta (sem alterar nada agora): um segredo por conexão guardado criptografado no cofre, contendo `{ banco, clientId, clientSecret, certificadoPem, chavePrivadaPem (ou p12 + senha), chavePix, ambiente }`, e o adaptador devolvendo um `Agent` do `undici` com `connect: { cert, key }` por requisição. Cache de token por conexão em memória/DB com margem (validades: Efí 3600 s, Inter 3600 s, Sicoob 300 s, Cora 86400 s, Efí Cobranças 600 s). Os dados do certificado nunca saem do cofre em log.

### 5.3 Tabela de configuração por banco (`BancoPixConfig`)

```
{
  id: 'efi' | 'inter' | 'sicoob' | 'sicredi' | 'bb',
  baseUrl: { producao, teste },
  tokenUrl: { producao, teste },
  tokenAuth: 'basic' | 'client_id_no_corpo',   // Efí/Sicredi: Basic; Sicoob/Inter: no corpo [?]
  tokenBody: 'json' | 'form',                   // Efí: JSON; Sicredi: form
  escopos: string[],                            // cob.write cob.read cobv.* pix.read webhook.*
  mtlsNoToken: boolean,                         // Efí, Sicredi: sim
  headersExtras?: Record<string,string>,        // BB: gw-dev-app-key
  prefixoPath?: string,                         // Inter: /pix/v2 ; Efí: /v2 ; Sicredi: /api/v2
  webhook: 'skip_mtls_hmac' | 'polling_apenas' | 'receptor_mtls',
  ids: { mapearStatus, formatoTxid }
}
```

Cora entra como **segundo adaptador** (`CoraGateway`) porque não é padrão BACEN, mas com a mesma interface.

### 5.4 Conformidade com nossas regras

- "O dinheiro nunca passa por nós": ok, cob na conta do dono, `chave` do dono.
- "Nunca confiar no corpo do webhook": ok, só `txid`/`endToEndId` é extraído e relido por `GET`.
- Vercel serverless: `undici`/`https.Agent` com mTLS de saída funciona; certificado criptografado no cofre; guardar a validade do certificado e avisar o dono antes de vencer (Inter ~12 meses `[fonte indireta]`, Cora ~1 ano `[fonte indireta]`, Sicredi mostra validade no portal).

---

## 6. Os 3 maiores riscos

1. **Webhook mTLS na Vercel**: só Efí (skip) e Cora (sem mTLS) casam; para os outros, depender de polling. Planejar polling como primário e webhook como otimização.
2. **Onboarding do dono (certificado)**: Inter com análise e histórico de desligar a API para novos clientes (changelogs de 24/12/2025, 12/03/2026, 10/04/2026); Sicoob exige e-CNPJ ICP-Brasil; Sicredi exige "técnico integrador" por cliente. Cada passo perde parte dos donos. Meta realista: Efí e Cora como "conexão em minutos".
3. **Guarda de certificado + privada de cada cliente**: chave privada de conta bancária de terceiros no nosso cofre eleva muito o peso de um vazamento (qualquer escopo `pix.send`/`cob.write` ali). Mitigar pedindo **só escopos de recebimento** (`cob.*`, `cobv.*`, `pix.read`, `webhook.*`, nunca `pix.send`), criptografia em repouso com chave por tenant, e renovação monitorada. Efí permite escolher escopos por aplicação, então dá para limitar.

---

## 7. O que ficou `[?]` (para checar com conta de teste)

- Inter: endpoint de token, mTLS no token, se o webhook exige mTLS no receptor ou aceita desligar; prazo da análise.
- Sicoob: host do token, escopos exatos, webhook mTLS, boleto/convênio, Pix Automático.
- Sicredi: se o webhook recusa receptor sem mTLS (guia é ambíguo); `/api/v2` vs `/api/v3`.
- BB: passos do portal, prazo, custo, mTLS do token e do webhook, Pix Automático, mudança do `gw-dev-app-key`.
- C6: tudo (padrão ou não, webhook, certificado).
- Cora: plano exigido, retentativas do webhook, cancelamento de QR Pix, Pix Automático, requisitos da modalidade Parceria.
- Efí: tarifas de Pix recebido; se a API Cobranças (boleto) exige mTLS; algoritmo sugerido do hmac (não especificado, é segredo nosso).
- Limites de taxa (rate limit) dos bancos.
- Plano Hobby da Vercel e frequência de cron.

## 8. Fontes principais

- BACEN: https://github.com/bacen/pix-api/blob/master/openapi.yaml
- Efí: https://dev.efipay.com.br/docs/api-pix/credenciais, /webhooks, /cobrancas-imediatas, /cobrancas-com-vencimento, /pix-automatico, /endpoints-exclusivos-efi; https://dev.efipay.com.br/docs/api-cobrancas/boleto e /credenciais
- Inter: https://developers.inter.co/ (home, changelog 10/04/2026, 12/03/2026, 24/12/2025, 18/05/2026, 08/07/2025, 14/01/2025, 21/07/2025)
- Sicredi: https://www.sicredi.com.br/media/produtos/filer_public/2026/01/13/guia_tecnico_integracoes_apipix.pdf
- Cora: https://developers.cora.com.br/ (docs/instrucoes-iniciais, client-credentials-int-direta, reference/qr-code-pix-v2, criação de endpoints, exemplo de POST da notificação)
- Indiretas: guia Celcoin para BB, README SDK SicoobAPI, OpenPix Sicoob, Omie (Cora e C6), Socket (SDK malicioso Sicoob).
