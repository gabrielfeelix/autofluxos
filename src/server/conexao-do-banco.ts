import 'server-only'
import type { PoolConfig } from 'pg'

/**
 * Raiz da autoridade certificadora do Supabase ("Supabase Root 2021 CA",
 * válida até abr/2031). O pooler apresenta certificado assinado por ela, e não
 * por autoridade pública, então sem este arquivo o Node não tem como conferir
 * que está falando com o Supabase de verdade.
 *
 * Certificado público, não é segredo. Fonte: o "Download certificate" do
 * painel (Database → Settings → SSL Configuration), em
 * https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
 * SHA-256 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 */
const RAIZ_DO_SUPABASE = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`

const LOCAL = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Configuração dos pools de SQL direto: TLS obrigatório e certificado
 * conferido contra a raiz do Supabase, nome do servidor incluído.
 *
 * Não depende do `sslmode` da URL. O `pg` deixa o `sslmode` da URL passar por
 * cima da opção `ssl`, e sem `sslmode` ele conecta **sem** criptografia; como
 * a URL de produção é protegida na Vercel e ninguém a lê, o parâmetro sai da
 * URL e quem decide é este arquivo. Banco local (Docker) não tem TLS e fica
 * de fora.
 *
 * Desde 19/out/2026 o projeto exige SSL (`ssl-enforcement`): conexão sem TLS
 * é recusada.
 */
export function configuracaoDoPool(url: string): PoolConfig {
  const endereco = new URL(url)
  endereco.searchParams.delete('sslmode')
  endereco.searchParams.delete('uselibpqcompat')
  const local = LOCAL.has(endereco.hostname.replace(/^\[|\]$/g, ''))
  return {
    connectionString: endereco.toString(),
    max: 1,
    ssl: local ? false : { ca: RAIZ_DO_SUPABASE, rejectUnauthorized: true },
  }
}
