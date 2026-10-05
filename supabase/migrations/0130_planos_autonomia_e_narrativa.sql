-- 0130: planos v2 (05/out/2026, docs/HANDOFF-05-OUT-PLANOS-V2.md, itens 2 e 3).
--
-- O modelo de IA é o mesmo em todo plano; o que sobe é autonomia. Dois
-- recursos novos, do Operação para cima: `ia_ferramentas` (a IA consulta e
-- age: agenda, loja, pedido, cobrança) e `sequencias` (acompanhamento). O
-- Essencial segue com IA que conversa com contexto.
--
-- O plano do meio volta a se chamar "Operação" (o id `operacao` nunca mudou),
-- e o texto dos três cards passa a contar a escada Organizar / Automatizar /
-- Decidir, com o Leitor (0129) somado ao Essencial.
--
-- **Tem que estar no ar antes do código.** O código confere os dois recursos
-- novos; sem eles nas linhas, Operação e Escala perderiam IA com consulta e
-- sequência nova até a migration chegar.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. Escreve só
-- as três linhas de plano que a 4YU publica; `recursos` é somado, nunca
-- substituído, para não desfazer ajuste feito na tela Planos.

set search_path = public, extensions;

update public.planos
   set recursos = recursos || '["ia_ferramentas","sequencias"]'::jsonb
 where id in ('operacao', 'escala')
   and not (recursos ? 'ia_ferramentas');

update public.planos
   set recursos = recursos || '["sequencias"]'::jsonb
 where id in ('operacao', 'escala')
   and not (recursos ? 'sequencias');

update public.planos set nome = 'Operação' where id = 'operacao';

update public.planos set
  resumo = 'Organize sua operação comercial. Centralize contatos, atendimento, funil e atividades em um único lugar.',
  itens = '["Até 1.000 conversas por mês","3 atendentes inclusos","Leitores ilimitados, sem custo","1 número de WhatsApp e chat do site","CRM com funil, etiquetas e atividades","Robôs ilimitados, com modelos prontos do seu ramo","IA que conversa e transcreve áudio","Transmissões: 2.000 envios por mês"]'::jsonb
where id = 'essencial';

update public.planos set
  resumo = 'Automatize o que hoje depende da equipe. Use chatbot, IA, sequências e automações para ganhar velocidade e consistência.',
  itens = '["Tudo do Essencial","Até 3.000 conversas por mês","10 atendentes inclusos","2 números de WhatsApp","IA que consulta e age: agenda, catálogo e pedido","Sequências de acompanhamento","Transmissões sem limite","Origem de cada cliente por anúncio","Distribuição automática e análise de vendas","Integrações prontas e API"]'::jsonb
where id = 'operacao';

update public.planos set
  resumo = 'Transforme dados em decisões. Gerencie múltiplos canais, permissões, integrações e inteligência com mais controle.',
  itens = '["Tudo da Operação","Até 8.000 conversas por mês","25 atendentes inclusos","Até 5 números de WhatsApp","Loja conectada: frete, pedido e cupom no chat","Sua própria chave de IA, sem teto de respostas","Webhooks e acesso por pessoa","Suporte prioritário"]'::jsonb
where id = 'escala';
