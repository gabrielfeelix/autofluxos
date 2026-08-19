<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Banco de produção compartilhado — obrigatório

AutoFluxos e Verandi são produtos diferentes no **mesmo projeto Supabase de
produção**. Antes de qualquer trabalho que toque banco, migration, Auth, RLS,
Storage, extensão, função/view SQL ou Data API, leia por inteiro
`docs/BANCO-COMPARTILHADO.md` e confira o estado dos dois repositórios.

- AutoFluxos mora em `public`; Verandi mora em `app_verandi`.
- Nunca crie ou altere objeto da Verandi a partir deste repositório.
- Nunca rode `supabase db push` ou `supabase db reset` contra produção.
- Descubra a próxima migration pelo diretório atual. Não copie numeração de
  planos antigos; a próxima do AutoFluxos é `0025` enquanto `0024` for a última.
- Auth, `auth.users`, Storage, extensões, Data API, cotas e backup são globais ao
  projeto. Uma alteração neles exige avaliar os dois produtos.
- A `service_role` ignora RLS e não isola um produto do outro. Mantenha schema e
  permissões explícitos e nunca aceite identificadores SQL vindos de usuário.
- Não aplique nada em produção sem autorização explícita do usuário.
