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

export interface Pendo {
  _q: Array<unknown>
  initialize(params: PendoInitializeParams): void
  identify(): void
  updateOptions(): void
  pageLoad(): void
  track(): void
}

export interface Window {
  pendo_options?: Readonly<Record<string, unknown>>
  pendo?: Pendo
}

export class PendoAgentValidationError extends Error {
  constructor(msg: string) {
    super(`failed to validate pendo agent: ${msg}`)
  }
}
