import { createHash, createHmac } from 'node:crypto'
import type { ContextIntegrityPort } from './contracts.js'

export class Sha256ContextIntegrity implements ContextIntegrityPort {
  private readonly signingSecret: string | null

  constructor(signingSecret?: string) {
    this.signingSecret = signingSecret ?? null
  }

  async hash(payload: string): Promise<string> {
    return createHash('sha256').update(payload, 'utf8').digest('hex')
  }

  async sign(hash: string): Promise<string> {
    if (this.signingSecret === null) throw new Error('OCS_SIGNING_KEY_UNAVAILABLE')
    return createHmac('sha256', this.signingSecret).update(hash, 'utf8').digest('hex')
  }
}
