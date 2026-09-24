# voice-mode-for-claude-code

A voice bridge between Claude's voice mode on your phone and Claude Code on your
Windows PC.

Voice mode leaves each request as a comment in a Claude Doc named
`voice-mode-for-claude-code`. A watcher on the PC, started by Windows Task
Scheduler, reads new comments with a minimal headless `claude -p` call (Haiku)
and hands each request to a Claude Code session: a new background session
(`claude --bg`), or a running session you name, through its local named pipe.
The session replies in the same comment thread, in a format written to be heard,
and voice mode reads the reply aloud.

Everything goes through claude.ai: there is no tunnel, no public server and no
open port on your PC.

## Talking to it

Save this standing instruction in your claude.ai personal preferences
(**Settings → Profile**), replacing `<your-document-link>` with the link to your
document:

> When I say "send to Claude Code", leave a comment addressed to Claude in the
> document voice-mode-for-claude-code (`<your-document-link>`), containing the
> request I say next. When I say "read Claude Code's answer", read aloud
> Claude's latest reply in that document.

Then, in voice mode, say "Send to Claude Code: run the tests", and later "Read
Claude Code's answer".

Status: the design is final; the watcher is not implemented yet.

Usage and installation: [INSTALL.md](INSTALL.md).
