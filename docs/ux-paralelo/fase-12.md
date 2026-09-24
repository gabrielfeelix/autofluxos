# Fase 12: validação integrada (23/09, sessão única)

Ambiente local, conta "Studio Pilates Revisão", porta 3101. Personas criadas
por `.ux-local/personas.mjs`: proprietário (`revisao@local.test`), Ana Gestão
(`gestao.ux@local.test`, acesso de gestão, equipe "Recepção") e Rita
Atendimento (`atende.ux@local.test`, acesso de atendimento), senha
`senha-local-123456`.

**Docker:** caiu às 21:59 de 23/09 e voltou pelo lado do Windows, mas a
integração com o WSL não recriou `/var/run/docker.sock`, e a porta 56431 do
Kong ficou presa por uma conexão de saída do Antigravity no Windows. Contorno
da sessão, sem mexer no repositório: `docker` apontando para o `docker.exe`,
um encaminhador `fwd-kong-ux` (socat) na 56441 até o Kong, e o dev subido com
`SUPABASE_URL=http://127.0.0.1:56441`. O e2e lê a 56431 do `.env.teste-local`
e não roda enquanto a porta estiver presa.

## Varredura das rotas (`.ux-local/varredura.mjs`)

45 rotas da conta × 3 personas: todas 200, nenhuma "Alguma coisa quebrou",
nenhum erro de JS. "Sem acesso" bate com `EXIGENCIA_DA_SECAO` e com as portas
das páginas:

- Gestão: sem Segmentos, Importar e Transmissões (não tem `exportar`).
- Atendimento: abre Início, Inbox, Atividades, Contatos, ficha, Funil,
  Favoritas e Relatórios; todo o resto mostra "Sem acesso". Início não mostra
  o atalho "Automações ›" (achado antigo do A3, resolvido).

## Jornadas (matriz de `08-handoff-execucao.md`)

| Jornada | Resultado |
|---|---|
| Início → pendência | OK. "67 atividades vencidas" abre `/atividades?recorte=vencidas&alcance=equipe` com 67. |
| Contatos → ficha → voltar | **Defeito, corrigido.** A ficha voltava para `/leads` sem busca, filtro nem página. A tabela passa `?volta=` com o recorte (`fichaComVolta`); conferido no navegador. |
| Inbox → ficha → Inbox | OK (e2e `contexto.spec.ts` da 8.5). |
| Funil → ficha | OK: "Ver ficha completa" leva `volta` para o funil. **Defeito, corrigido:** `FecharCartao` e `PainelDoContato` eram irmãos com a mesma `key` ("vazio"), aviso do React ao abrir cartão; prefixos `fechar:`/`painel:`, aviso sumiu. |
| Ganhar/perder → próximo funil | OK (8.4, `efeitos.mjs`). |
| Importar → Contatos | OK (8.6): recusadas por linha, segunda volta manda só elas. |
| Segmento → transmissão | **Lacuna de produto.** A nova transmissão só aceita etiqueta como público (`acaoCriarTransmissaoPorEtiqueta`); segmento salvo não chega a transmissão nenhuma, apesar de `transmissoes.segmento_id` existir desde a 0083. Não é conserto de tela: vira tarefa (12.2). |
| Transmissão → detalhe → contato | OK: destinatário é link para a conversa com `volta`. **Ajuste:** a volta agora mantém o filtro de estado e a página. |
| Canal → Automações | Parcial: o cartão do número diz "Responde em 0 de 4 situações" e "sem fluxo" por situação, sem link direto para a automação. |
| Lista → editor → publicar → lista | OK no editor: "Salvo", "Publicada v1 · com mudanças", "Entrada ligada". O ‹ volta para `/fluxos` sem a busca (baixa). |
| Gatilho → fluxo de destino | **Defeito, corrigido e conferido no navegador** (`.ux-local/j11.mjs`): o nome do destino abre o editor com `?volta=`, e o ‹ volta para `?aba=gatilhos&q=menu`, com a busca. (O script antigo usava `busca=`; o parâmetro é `q`.) |
| Testar | OK no desktop e no celular (`.ux-local/testar.mjs`): abre o simulador, responde "Desculpa, não entendi" e repete as opções, sem erro de JS. **Defeito, corrigido:** no celular o editor inteiro rolava de lado (piso de 1024px no CSS, achado da 3.5 que a 5.8 não pegou). Abaixo de 768px o piso sai, a barra de blocos vira gaveta ("+ Bloco"), o painel cobre o desenho e começa fechado, e o topo rola dentro dele. Também: "Testar" no topo com o painel recolhido não mostrava nada; agora abre o painel. |
| Pessoa/equipe → fila e atividades | Atividades: OK, gestão e atendimento veem 0 (a equipe não tem atividade), e `?responsavel=<outro>` não vaza. **Lacuna de regra:** Inbox e Contatos mostram as 60 conversas para quem tem atendimento só nos próprios. Já documentado no código (o Início conta igual ao Inbox); vira tarefa com decisão. |
| Integração com erro → reparo → origem | Parcial: "Reconectar o número ›" existe; não há volta para o fluxo ou campanha que dependia da conexão. |
