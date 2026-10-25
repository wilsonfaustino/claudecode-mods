// The number of the block just copied in a message, 0 for none.
export type CopiedBlockNumber = number

declare module 'claude-code' {
  interface PluginState {
    'copy-blocks': { copiedBlock: StateFamily<CopiedBlockNumber> }
  }
}
