export type Pulse = { needYou: string[]; toReview: number; running: number; total: number }

declare module 'claude-code' {
  interface PluginState {
    'project-overview': { pulse: Shaped<Pulse | null> }
  }
}
