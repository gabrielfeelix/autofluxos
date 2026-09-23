# Revisão UX/UI — operação (Atividades, Contatos e Funil)

Data: 23/09/2026  
Escopo: leitura estática do código atual, sem execução da aplicação, sem banco e sem produção. Este documento registra evidência de implementação e hipóteses visuais separadamente.

## Registro incremental

### 23/09 — baseline confirmado no código

- Atividades é uma lista server-rendered agrupada apenas em Vencidas/Hoje/Depois, com largura máxima de 900px. Há responsável e tipo como texto secundário, mas cada item só oferece abrir contato. Ver [página de atividades](../../src/app/clientes/[clienteId]/atividades/page.tsx:58). **Certeza: confirmado no código. Impacto: alto.**
- Contatos já usa layout flex para consumir a altura disponível e uma tabela horizontal com `min-w-[820px]`; a seleção ocupa a primeira coluna e Contato a segunda. Ver [tabela](../../src/app/clientes/[clienteId]/leads/page.tsx:459). **Certeza: confirmado no código.**
- A tabela de Contatos não aplica `position: sticky` em nenhum dos dois primeiros `th`/`td`; portanto, ao rolar horizontalmente, seleção e identidade desaparecem. Ver [cabeçalho e células](../../src/app/clientes/[clienteId]/leads/page.tsx:476). **Certeza: confirmado no código. Impacto: alto.**
- A busca de Contatos é um formulário em linha com `flex-1 basis-[240px]`; em telas largas ela cresce para ocupar todo o espaço disponível, enquanto o botão Buscar fica ao lado. Isso explica a percepção de campo “enorme”; não há largura máxima. Ver [busca](../../src/app/clientes/[clienteId]/leads/page.tsx:324). **Certeza: confirmado no código. Impacto: médio.**
- Os filtros de Contatos são duas navegações de links em formato de pills, uma para nível (“Cliente”) e outra para etiquetas. Etiquetas derivadas, manuais e nível aparecem em faixas separadas, com contagens apenas nas manuais. Ver [filtros](../../src/app/clientes/[clienteId]/leads/page.tsx:350). **Certeza: confirmado no código; julgamento de “badges soltos” exige execução/validação visual. Impacto: médio.**
- Contatos oferece ações relevantes (Colunas, Segmentos, Importar, Criar contato, CSV) todas no mesmo agrupamento superior. Em largura intermediária o `flex-wrap` pode criar uma barra de ações fragmentada. Ver [ações da lista](../../src/app/clientes/[clienteId]/leads/page.tsx:259). **Certeza: confirmado no código; severidade visual exige execução. Impacto: médio.**
- O controle Colunas oculta campos via CSS/localStorage, mas os campos fixos `cliente`, `situacao` e `ultima` também entram na configuração. Isso é útil para reduzir largura, porém seleção e Contato não são configuráveis nem protegidos como contexto da linha. Ver [controle de colunas](../../src/components/lead/colunas-da-tabela.tsx:37) e [colunas da lista](../../src/app/clientes/[clienteId]/leads/page.tsx:249). **Certeza: confirmado no código. Impacto: médio.**
- Funil ocupa a largura inteira (`main` sem `max-w`) e trata o quadro como a tela; colunas têm largura fixa de 290/300px e rolagem horizontal. Ver [estrutura do funil](../../src/app/clientes/[clienteId]/quadros/page.tsx:64) e [colunas](../../src/components/quadros/quadro.tsx:284). **Certeza: confirmado no código.**
- Funil tem busca por contato, situação, filtro de responsável e ordenação em toolbar; responsável aparece como filtro ativo removível, com estado anunciado por `aria-live`. Ver [toolbar do funil](../../src/components/quadros/barra-do-quadro.tsx:45). **Certeza: confirmado no código.**
- Funil oferece ações diretamente no contexto: adicionar contato por etapa, menu do cartão, arrastar com alternativa de menu, abrir painel e fechar/ganhar/perder. Ver [cartão do funil](../../src/components/quadros/quadro.tsx:382). **Certeza: confirmado no código.**
- A identificação de responsável no cartão é apenas iniciais em uma pill; o nome completo está em `title`. Na toolbar, o filtro de responsável usa nome. Para operação visual densa isso dá baixa descoberta de “quem é quem” em cartões. Ver [responsável no cartão](../../src/components/quadros/quadro.tsx:500). **Certeza: confirmado no código; impacto visual exige execução. Impacto: médio.**

## Próximos pontos a verificar

1. Executar visualmente em desktop largo, tablet e viewport móvel: confirmar se a largura de Atividades é realmente subutilizada, se a barra de ações de Contatos quebra, e se as pills de filtro parecem controles ou etiquetas decorativas.
2. Validar teclado/foco em tabela horizontal: sticky da seleção e Contato deve preservar foco visível, contraste e leitura por leitor de tela.
3. Verificar se “Atividades” tem criação/conclusão/adiamento no fluxo real; a página atual só lista e abre contato, embora a intenção do usuário peça ações de atividade.

