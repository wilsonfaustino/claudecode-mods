import { atom, memberOf, read, update } from 'claude-code'
import type { Register } from 'claude-code'

export type CodeBlock = { info: string; body: string }

const OPENING_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
// Nerd Font nf-md-content_copy.
export const COPY_GLYPH = '\u{F018F}'
// The engine draws a reply's first block as [bullet column of minWidth 2, text], so the text starts at column 2.
export const BULLET_COLUMNS = 2
const COPIED_MS = 2000
// Catppuccin Mocha: surface0, surface1, mauve, green, subtext0.
const IDLE_BACKGROUND = '#313244'
const HOVER_BACKGROUND = '#45475a'
const ACCENT_COLOR = '#cba6f7'
const COPIED_COLOR = '#a6e3a1'
const IDLE_COLOR = '#a6adc8'

export function findCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const lines = text.split('\n')
  let lineIndex = 0
  while (lineIndex < lines.length) {
    const opening = OPENING_FENCE.exec(lines[lineIndex] ?? '')
    const fence = opening?.[1] ?? ''
    const info = (opening?.[2] ?? '').trim()
    // A backtick fence's info string may not hold a backtick (CommonMark).
    if (!opening || (fence.startsWith('`') && info.includes('`'))) {
      lineIndex++
      continue
    }
    const closingFence = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`)
    const closingIndex = lines.findIndex((line, index) => index > lineIndex && closingFence.test(line))
    // An unclosed fence is not a block.
    if (closingIndex === -1) break
    blocks.push({ info: info.split(/\s+/)[0] ?? '', body: lines.slice(lineIndex + 1, closingIndex).join('\n') })
    lineIndex = closingIndex + 1
  }
  return blocks
}

export function buttonLabel(block: CodeBlock, blockNumber: number): string {
  return `${COPY_GLYPH} ${blockNumber} ${block.info || 'text'}`
}

export function copiedLabel(blockNumber: number): string {
  return `✓ ${blockNumber} copied`
}

// One member per message (keyed by requestId): the number of the block just copied, 0 for none.
const copiedBlock = atom({ plugin: 'copy-blocks', key: 'copiedBlock' } as const, 0)

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const blocks = findCodeBlocks(e.props.text)
    if (e.props.isSummary || blocks.length === 0) return next(e)

    const inner = await next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const copiedInMessage = memberOf(copiedBlock, e)
    const copiedBlockNumber = await read($, copiedInMessage)

    return (
      <Box flexDirection="column">
        {inner}
        <Box key="copy-row" flexDirection="row" flexWrap="wrap" gap={1} paddingLeft={e.props.isFirstOfReply ? BULLET_COLUMNS : 0}>
          {blocks.map((block, index) => {
            const blockNumber = index + 1
            const isCopied = copiedBlockNumber === blockNumber
            return (
              <Box key={`chip-${blockNumber}`}>
                <Button
                  key={`copy-${blockNumber}`}
                  plain
                  onPress={async press => {
                    const result = await $.ui.copy({ text: block.body, surface: press.surface })
                    if (!result.isCopied) {
                      $.ui.toast(`Copy failed: ${result.reason}`)
                      return
                    }
                    await update($, copiedInMessage, () => blockNumber)
                    $.clock.after(COPIED_MS, () => {
                      void update($, copiedInMessage, current => (current === blockNumber ? 0 : current))
                    })
                  }}
                >
                  {isCopied ? (
                    <Text color={COPIED_COLOR} backgroundColor={IDLE_BACKGROUND}>
                      {` ${copiedLabel(blockNumber)} `}
                    </Text>
                  ) : (
                    <Text
                      color={IDLE_COLOR}
                      backgroundColor={IDLE_BACKGROUND}
                      hover={{ color: ACCENT_COLOR, backgroundColor: HOVER_BACKGROUND }}
                    >
                      {` ${buttonLabel(block, blockNumber)} `}
                    </Text>
                  )}
                </Button>
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
