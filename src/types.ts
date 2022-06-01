export type PendoLauncher = {
  arm(): void
  launch(idPrefix?: string): void
  reset(): void
  get transmissionLog(): Record<string, unknown>[]
}

export interface Window {
  pendoLauncher?: PendoLauncher
}
