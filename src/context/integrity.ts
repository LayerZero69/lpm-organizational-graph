import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { ContextIntegrityPort } from './contracts.js'

export class Sha256ContextIntegrity implements ContextIntegrityPort {
  readonly algorithm = 'SHA256_HMAC_SHA256' as const
  private readonly signingSecret: string | null
  private readonly keyInvalid: boolean

  constructor(signingSecret?: string) {
    this.signingSecret = signingSecret ?? null
    this.keyInvalid = signingSecret !== undefined && signingSecret.trim().length === 0
  }

  async hash(payload: string): Promise<string> {
    return createHash('sha256').update(payload, 'utf8').digest('hex')
  }

  async sign(hash: string): Promise<string> {
    if (this.signingSecret === null) throw new Error('OCS_SIGNING_KEY_UNAVAILABLE')
    if (this.keyInvalid) throw new Error('OCS_SIGNING_KEY_INVALID')
    return createHmac('sha256', this.signingSecret).update(hash, 'utf8').digest('hex')
  }

  async verifyToken(hash: string, token: string): Promise<{
    readonly valid: boolean
    readonly reason:
      | 'VERIFICATION_KEY_UNAVAILABLE'
      | 'VERIFICATION_KEY_INVALID'
      | 'AUTHENTICATION_TOKEN_MALFORMED'
      | 'AUTHENTICATION_TOKEN_MISMATCH'
      | null
  }> {
    if (this.signingSecret === null) return { valid: false, reason: 'VERIFICATION_KEY_UNAVAILABLE' }
    if (this.keyInvalid) return { valid: false, reason: 'VERIFICATION_KEY_INVALID' }
    if (!isSha256Hex(token)) return { valid: false, reason: 'AUTHENTICATION_TOKEN_MALFORMED' }

    const expected = createHmac('sha256', this.signingSecret).update(hash, 'utf8').digest('hex')
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'))
      ? { valid: true, reason: null }
      : { valid: false, reason: 'AUTHENTICATION_TOKEN_MISMATCH' }
  }
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

export function timingSafeSha256Equal(left: string, right: string): boolean {
  if (!isSha256Hex(left) || !isSha256Hex(right)) return false
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}
