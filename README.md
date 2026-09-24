# voice-mode-for-claude-code

Since Anthropic does not allow voice mode to access local MCP tools (like [filesystem](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)), I had to built this insane workaround.

This is a voice bridge between Claude's voice mode on your phone and Claude Code on your
Windows PC.

Voice mode leaves each request as a comment in a Claude Doc named
`voice-mode-for-claude-code`. A watcher on the PC (`npm run watch`, a visible
Node process) reads new comments every 3 minutes with a minimal headless
`claude -p` call (Haiku) and hands each request to a Claude Code session: a new
background session (`claude --bg`), or a running session you name, through its
local named pipe. The session posts progress notes and its answer in the same
comment thread, in a format written to be heard, and voice mode reads them
aloud.

Everything goes through claude.ai: there is no tunnel, no public server and no
open port on your PC.

## Talking to it

Save this standing instruction in your claude.ai personal preferences
(**Settings → Profile**). `npm run setup` prints it with your document's link
and ids filled in:

> When I say "send to Claude Code", leave a comment addressed to Claude in the
> document voice-mode-for-claude-code (link: `<your-document-link>`; document
> id: `<your-document-id>`; tab body id: `<your-tab-body-id>`), containing
> the request I say next. When I say "read Claude Code's answer", read aloud
> Claude's latest reply in that document.

Then, in voice mode, say "Send to Claude Code: run the tests", and later "Read
Claude Code's answer".

Status: working end to end on Windows 11; see the limitations in INSTALL.md.

Usage and installation: [INSTALL.md](INSTALL.md).

## Credits

The message format the watcher writes to a running session's named pipe comes
from the protocol description in
[S3cur3Th1sSh1t/claudemessaging](https://github.com/S3cur3Th1sSh1t/claudemessaging).
No code was copied.
