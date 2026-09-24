# Fase 12: validação integrada (23/09, sessão única)

Ambiente local, conta "Studio Pilates Revisão", porta 3101. Personas criadas
por `.ux-local/personas.mjs`: proprietário (`revisao@local.test`), Ana Gestão
(`gestao.ux@local.test`, acesso de gestão, equipe "Recepção") e Rita
Atendimento (`atende.ux@local.test`, acesso de atendimento), senha
`senha-local-123456`.

**Parada no meio:** o Docker do Windows caiu às 21:59 (o daemon sumiu do
WSL), levando o Supabase local. Varredura e jornadas abaixo foram feitas antes
disso; a volta do editor pelo gatilho (J11) e os prints finais em
`prints-depois/` ficaram para quando o Docker voltar.

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
| Segmento → transmissão | Parcial: Segmentos explica a regra; o clique em "Nova transmissão" do script não achou o botão (seletor), não conferido a fundo. |
| Transmissão → detalhe → contato | OK: destinatário é link para a conversa com `volta`. **Ajuste:** a volta agora mantém o filtro de estado e a página. |
| Canal → Automações | Parcial: o cartão do número diz "Responde em 0 de 4 situações" e "sem fluxo" por situação, sem link direto para a automação. |
| Lista → editor → publicar → lista | OK no editor: "Salvo", "Publicada v1 · com mudanças", "Entrada ligada". O ‹ volta para `/fluxos` sem a busca (baixa). |
| Gatilho → fluxo de destino | **Defeito, corrigido no código:** "Ligada, mas o destino nunca foi publicado" com o nome do destino em texto solto. O nome virou link para o editor com `?volta=` da aba; o editor aceita `volta` (mesma regra da ficha, `voltaInterna`). Typecheck, lint e testes ok; **ida e volta no navegador pendente** (Docker caiu). |
| Testar | Não conferido (seletor do script). O aviso de IA e HTTP reais é da 3.2. |
| Pessoa/equipe → fila e atividades | Atividades: OK, gestão e atendimento veem 0 (a equipe não tem atividade), e `?responsavel=<outro>` não vaza. **Lacuna de regra:** Inbox e Contatos mostram as 60 conversas para quem tem atendimento só nos próprios. Já documentado no código (o Início conta igual ao Inbox); vira tarefa com decisão. |
| Integração com erro → reparo → origem | Parcial: "Reconectar o número ›" existe; não há volta para o fluxo ou campanha que dependia da conexão. |
