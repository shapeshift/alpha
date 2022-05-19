import type { PendoEnv } from './env'

/**
 * This is not an exhaustive list of possible initialization parameters. See
 * the agent code and associated documentation for more details.
 */
export interface PendoInitializeParams {
  visitor?: {
    id?: string
  }
  sanitizeUrl?(url: string): string
  events?: {
    ready?(): void
    deliverablesLoaded?(): void
    guidesFailed?(): void
    guidesLoaded?(): void
    validateGuide?(signatureString: string): Promise<boolean>
    validateLauncher?(signatureString: string): Promise<boolean>
    validateGlobalScript?(data: string): Promise<boolean>
  }
}

/**
 * This is very similar to PendoInitializeParams, but represents the parameter
 * of the agent's embedded IIFE.
 */
export type PendoConfig = Record<string, unknown> & { apiKey: string }

export interface Pendo {
  VERSION?: string
  _q: Array<unknown>
  initialize(params: PendoInitializeParams): void
  identify(): void
  updateOptions(): void
  pageLoad(): void
  track(): void
}

export interface Window {
  pendo?: Pendo
  pendoEnv?: PendoEnv
  pendoFixupHelpers?: Record<string, unknown>
}
