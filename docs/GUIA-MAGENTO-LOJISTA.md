# Como gerar o token de leitura do Magento para o AutoFluxos

Para o responsável técnico da loja. Leva uns 5 minutos.

## Para que serve

Com este token, o atendimento automático no WhatsApp diz **quantas unidades
restam** de cada produto. Sem ele, o atendimento já funciona, mas só diz se o
produto tem ou não tem em estoque. A foto do produto aparece com ou sem token
na maioria das lojas; o token só é usado para ela se a loja não deixar o
catálogo aberto.

**O acesso é usado só para leitura.** O AutoFluxos só faz consultas (GET) em
três pontos: estoque vendável, configuração de estoque e, se preciso, fotos do
produto.
Nada é criado, alterado ou apagado na loja. Você pode revogar a qualquer
momento, sem falar com a gente (passo 6).

> Um aviso honesto: o Magento não separa "ler" de "alterar" nas permissões da
> integração. Por isso a garantia de só leitura está no nosso código, que não
> tem nenhuma chamada de escrita, e não no escopo do token. Marque só as
> permissões do passo 2 para reduzir o alcance ao mínimo.

## Passo a passo

1. No painel do Magento: **Sistema › Extensões › Integrações › Adicionar nova
   integração**.
   - Nome: `AutoFluxos (somente leitura)`
   - Deixe em branco a URL de callback e a URL de link de identidade.
   - Confirme com a senha do seu usuário administrador.

2. Aba **API**, em "Acesso a recursos": escolha **Personalizado** e marque
   **só**:
   - **Lojas › Inventário › Estoques** (estoque vendável), se aparecer. Esse
     item só existe em lojas com o módulo de Inventário (MSI). No código do
     Magento ele é `Magento_InventorySalesApi::stock`;
   - **Catálogo › Inventário** (estoque antigo e fotos). No código do Magento
     é `Magento_Catalog::catalog_inventory`, e ele inclui **Produtos**.

   Esses dois códigos são os que a própria loja da PCYES pediu ao recusar uma
   consulta sem token (23/set/2026). Os nomes na tela mudam um pouco entre
   versões do Magento. Se o AutoFluxos disser
   que a loja recusou o token mesmo com o passo 5 feito, é permissão faltando:
   nos avise qual versão da loja e dizemos qual item marcar.

3. **Salvar**. Na lista, clique em **Ativar** e depois em **Permitir**.

4. Copie o **Token de acesso** (Access Token). Não é o "Consumer Key" nem o
   "Consumer Secret".

5. Magento 2.4.4 ou mais novo: vá em **Lojas › Configuração › Serviços ›
   OAuth › Consumer Settings** e deixe **"Allow OAuth Access Tokens to be used
   as standalone Bearer tokens"** em **Sim**. Sem isso, o Magento recusa o
   token mesmo estando certo.
   [Documentação da Adobe](https://developer.adobe.com/commerce/php/development/backward-incompatible-changes/)

6. Mande o token para quem cuida do AutoFluxos na sua empresa, **por um canal
   privado** (não em grupo). Ele cola em **Integrações › Loja Magento › Foto e
   estoque exato**, e o AutoFluxos confere o token na hora, antes de guardar.

## Para revogar

**Sistema › Extensões › Integrações › AutoFluxos (somente leitura) › Excluir.**

O atendimento volta sozinho a dizer só se tem ou não tem em estoque, sem erro
para o cliente.
