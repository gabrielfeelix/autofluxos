# Aviso de pedido da PCYES para o AutoFluxos

Para o Gui. Quando um pedido passar para **processando** (pagamento
aprovado), a loja manda um `POST` para o AutoFluxos. É o que dispara a pesquisa
pós-compra pelo WhatsApp.

## Endereço

```
POST https://autofluxos.4yu.com.br/api/webhook/entrada/64dbc3a9-1f77-4892-9770-e3e4be9e14cd
Content-Type: application/json
x-autofluxos-assinatura: sha256=<HMAC-SHA256 do corpo, em hex>
```

O segredo do HMAC chega à parte, pelo Gabriel. A assinatura é calculada sobre
o corpo **exatamente como enviado** (os mesmos bytes). Sem assinatura, ou com
assinatura errada, a resposta é `401`.

## Corpo

```json
{
  "evento": "pedido.processando",
  "telefone": "44999998888",
  "dados": {
    "pedido": "000123456",
    "nome": "Maria",
    "customer_id": 182,
    "aceita_whatsapp": true
  }
}
```

| Campo | O que é |
|---|---|
| `evento` | Sempre `pedido.processando`. |
| `telefone` | Telefone de cobrança, só dígitos, com DDD. O 55 é opcional. |
| `dados.pedido` | `increment_id` do pedido. Cada pedido recebe a pesquisa uma vez só. |
| `dados.nome` | Primeiro nome do cliente. Vai na mensagem. |
| `dados.customer_id` | ID do cliente na Magento. É para onde vão os 250 PC Points. Convidado: omitir. |
| `dados.aceita_whatsapp` | `true` só se o cliente aceitou receber WhatsApp no cadastro. Sem `true`, nada é enviado. |

## Respostas

- `200 {"ok":true}`: recebido. O envio acontece logo depois, sem segurar a loja.
- `401`: assinatura ausente ou errada.
- `413`: corpo acima de 64 KB.
- `429`: mais de 120 avisos por minuto.

Mandar o mesmo pedido duas vezes não duplica a mensagem.

## Exemplo de assinatura (PHP)

```php
$corpo = json_encode($payload, JSON_UNESCAPED_UNICODE);
$assinatura = 'sha256=' . hash_hmac('sha256', $corpo, $segredo);
// enviar $corpo como está, com o cabeçalho x-autofluxos-assinatura: $assinatura
```
