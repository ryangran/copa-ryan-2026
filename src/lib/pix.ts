// Gerador de BR Code PIX (EMV QRCPS-MPM) — padrão Banco Central do Brasil

function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`
}

export function gerarPixBRCode(params: {
  chave: string
  nome: string
  cidade: string
  valor: number
  txid?: string
}): string {
  const { chave, nome, cidade, valor, txid = '***' } = params

  const nomeLimpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').substring(0, 25).trim()
  const cidadeLimpa = cidade.normalize('NFD').replace(/[̀-ͯ]/g, '').substring(0, 15).trim()
  const txidLimpo = txid.replace(/[^a-zA-Z0-9*]/g, '').substring(0, 25) || '***'

  const merchantAccount = tlv('26',
    tlv('00', 'BR.GOV.BCB.PIX') +
    tlv('01', chave)
  )

  const additionalData = tlv('62', tlv('05', txidLimpo))

  const payload =
    tlv('00', '01') +
    merchantAccount +
    tlv('52', '0000') +
    tlv('53', '986') +
    (valor > 0 ? tlv('54', valor.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', nomeLimpo) +
    tlv('60', cidadeLimpa) +
    additionalData +
    '6304'

  return payload + crc16(payload)
}
