# claudecode-mods

Mods for the Claude Code terminal.

## copy-blocks

Adds a row of copy chips under each assistant reply that has fenced code blocks. Click a chip (`󰆏 1 bash`) to copy the body of that block, without the fence lines. The chip shows `✓ 1 copied` for 2 seconds.

### Install

At the prompt of a Claude Code terminal session:

```
/plugin install copy-blocks --marketplace wilsonfaustino/claudecode-mods
```

Answer `y` to add the marketplace, then pick a scope.

### Requirements

- Fullscreen layout (`"tui": "fullscreen"` in settings). The terminal reports mouse clicks on transcript rows only in this layout.
- A [Nerd Font](https://www.nerdfonts.com/) in your terminal for the copy glyph. Without one, the glyph shows as a missing-character box.
- The colors are hardcoded to the Catppuccin Mocha palette and suit dark themes. To change them, edit the constants at the top of `copy-blocks/hooks/register.tsx`.

## License

MIT
