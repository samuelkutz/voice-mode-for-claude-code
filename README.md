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

Status: the design is final; the watcher is not implemented yet.

Usage and installation: [INSTALL.md](INSTALL.md).
