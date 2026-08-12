# Aplicar dark mode design system

## Goal
Aplicar o protótipo escuro às telas existentes sem alterar regras de negócio, acrescentando apenas a rota visual de login.

## Tasks
- [x] Definir fontes, tokens e estilos globais do protótipo → Verificar: layout raiz renderiza em dark mode sem flash.
- [x] Criar marca e shell lateral compartilhados → Verificar: navegação de Clientes e Sair funciona.
- [x] Reestilizar lista de clientes e visão do cliente → Verificar: criação, abertura de fluxo, leads e conexão de número continuam funcionando.
- [x] Reestilizar lista e detalhe de leads → Verificar: colunas dinâmicas, estados e histórico continuam íntegros.
- [x] Reestilizar editor, nós, painel e simulador → Verificar: editar, ligar, testar, salvar e publicar mantêm o comportamento atual.
- [x] Criar `/login` integrado à senha única existente → Verificar: entrada, credencial inválida, sessão HTTP-only e logout funcionam.
- [x] Validar tipos, testes e build de produção → Verificar: `npm run typecheck`, `npm test` e `npm run build` passam.

## Done When
- [x] As telas desktop correspondem ao protótipo e nenhuma regra funcional existente foi substituída.
