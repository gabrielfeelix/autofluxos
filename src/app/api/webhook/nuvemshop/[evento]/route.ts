/**
 * Os três avisos de LGPD da Nuvemshop em endereço próprio
 * (`/store-redact`, `/customers-redact`, `/customers-data-request`), que é
 * como o portal do parceiro sugere cadastrar. O tratamento é o mesmo da rota
 * de cima: a assinatura confere o corpo e o `event` diz o que é, o caminho
 * não decide nada.
 */
export { POST, dynamic } from '../route'
