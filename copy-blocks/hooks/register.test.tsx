import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const TWO_BLOCKS = [
  'Run this:',
  '',
  '```bash',
  'git status',
  'git diff --stat',
  '```',
  '',
  'Then this:',
  '',
  '~~~',
  'line one',
  '',
  'line three',
  '~~~',
].join('\n')

const LABELED_BLOCKS = ['```bash', 'echo one', '```', '', '```json', '{"copy": "two"}', '```'].join('\n')

function message(text: string, isSummary?: true, requestId = 'message-1', isFirstOfReply = true) {
  return {
    plugin: 'copy-blocks',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId,
    props: { text, isFirstOfReply, ...(isSummary ? { isSummary } : {}) },
  } as const
}

function drawEngine(on: On) {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

test('a reply without fences is drawn as the engine draws it', async ($, on) => {
  // Nothing draws beneath the plugin: this hook stands for the engine.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount(message('Use `git status` inline, no fences here.'))

  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
  await ui.unmount()
})

test('two fenced blocks give two buttons under the reply', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount(message(TWO_BLOCKS))

  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons).toHaveLength(2)
  expect(buttons[0]?.text.trim()).toBe('\u{F018F} 1 bash')
  expect(buttons[1]?.text.trim()).toBe('\u{F018F} 2 text')
  await ui.unmount()
})

test('pressing button 2 copies the exact body of block 2', async ($, on) => {
  const copiedTexts: string[] = []
  const toasts: string[] = []
  mock.clock(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('ui.copy', (_, e) => {
    copiedTexts.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  const ui = await $.ui.mount(message(TWO_BLOCKS))
  await ui.press({ key: 'copy-2' })

  expect(copiedTexts).toEqual(['line one\n\nline three'])
  expect(toasts).toEqual([])
  await ui.unmount()
})

test('a failed copy toasts the reason', async ($, on) => {
  const toasts: string[] = []
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('ui.copy', () => ({ value: { isCopied: false, reason: 'no-clipboard' } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  const ui = await $.ui.mount(message(TWO_BLOCKS))
  await ui.press({ key: 'copy-1' })

  expect(toasts).toEqual(['Copy failed: no-clipboard'])
  expect(await ui.find({ type: 'Text', text: /copied/ })).toBeUndefined()
  await ui.unmount()
})

test('a summary block is drawn as the engine draws it', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount(message(TWO_BLOCKS, true))

  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
  await ui.unmount()
})

test('an unclosed fence is not counted as a block', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount(message(['```ts', 'const answer = 42', 'still open'].join('\n')))

  expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
  await ui.unmount()
})

test('a chip names its block number and language, text when there is none', async ($, on) => {
  drawEngine(on)

  const ui = await $.ui.mount(message(LABELED_BLOCKS))

  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map(button => button.text.trim())).toEqual(['\u{F018F} 1 bash', '\u{F018F} 2 json'])
  await ui.unmount()
})

test('a copy marks the pressed chip of the pressed reply only, then goes back to idle', async ($, on) => {
  const toasts: string[] = []
  const clock = mock.clock(on)
  drawEngine(on)
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  const pressedReply = await $.ui.mount(message(LABELED_BLOCKS, undefined, 'message-1'))
  const otherReply = await $.ui.mount(message(LABELED_BLOCKS, undefined, 'message-2'))
  await pressedReply.press({ key: 'copy-2' })
  await clock.settle()

  const pressedTexts = (await pressedReply.findAll({ type: 'Button' })).map(button => button.text.trim())
  expect(pressedTexts).toEqual(['\u{F018F} 1 bash', '\u2713 2 copied'])
  const copiedText = await pressedReply.find({ type: 'Text', text: /copied/ })
  expect(copiedText?.props.color).toBe('#a6e3a1')
  const otherTexts = (await otherReply.findAll({ type: 'Button' })).map(button => button.text.trim())
  expect(otherTexts).toEqual(['\u{F018F} 1 bash', '\u{F018F} 2 json'])
  expect(toasts).toEqual([])

  await clock.advance(2000)

  const idleTexts = (await pressedReply.findAll({ type: 'Button' })).map(button => button.text.trim())
  expect(idleTexts).toEqual(['\u{F018F} 1 bash', '\u{F018F} 2 json'])
  await pressedReply.unmount()
  await otherReply.unmount()
})

test('the row starts at the reply text column, after the bullet', async ($, on) => {
  drawEngine(on)

  const firstBlock = await $.ui.mount(message(LABELED_BLOCKS, undefined, 'message-1', true))
  const laterBlock = await $.ui.mount(message(LABELED_BLOCKS, undefined, 'message-2', false))

  expect((await firstBlock.find({ type: 'Box', key: 'copy-row' }))?.props.paddingLeft).toBe(2)
  expect((await laterBlock.find({ type: 'Box', key: 'copy-row' }))?.props.paddingLeft).toBe(0)
  await firstBlock.unmount()
  await laterBlock.unmount()
})
