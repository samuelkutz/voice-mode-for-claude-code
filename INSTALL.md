# voice-mode-for-claude-code: usage and installation

voice-mode-for-claude-code lets you drive Claude Code on your Windows PC by
talking to the Claude mobile app in voice mode. You speak a request, Claude Code
does the work on your PC, and voice mode reads the answer back to you.

> **Status:** the design is final, but the watcher script is not written yet.
> Steps that depend on it are marked *(planned)*. Everything else was tested.

## How it works

1. You speak a request in voice mode on your phone.
2. Voice mode posts it as a comment, addressed to Claude, in a Claude Doc named
   `voice-mode-for-claude-code` in your claude.ai account.
3. On your PC, a watcher started by Windows Task Scheduler reads the document
   every 3 minutes and finds the new comment.
4. The watcher hands the request to a Claude Code session. By default it starts
   a new background session. If the request names a running session, it
   delivers the request to that session instead.
5. The session does the work and replies in the same comment thread, in a
   format written to be heard.
6. You ask voice mode whether it is done, and it reads the reply aloud.

Everything goes through claude.ai. There is no tunnel, no public server and no
open port on your PC.

Why the watcher exists: a comment in a Claude Doc wakes a watching Claude Code
session only when a person sends the thread to Claude from the document screen.
A comment written by Claude, such as one posted by voice mode, does not count.
The watcher closes that gap by reading the document on a schedule.

## How to use

### Save a standing instruction first

Without it, every spoken request would have to be:

> "In the voice-mode-for-claude-code document, leave a comment addressed to
> Claude asking: run the tests."

With it, you only say:

> "Send to Claude Code: run the tests."

This is not a keyboard shortcut. It is an instruction for the Claude you talk to
in voice mode, saved in your claude.ai personal preferences, which apply to
every conversation, voice included.

Where to save it: on claude.ai, open **Settings → Profile** and find the
personal preferences field (the one that asks what Claude should consider in its
responses). If your menu names it differently, use the field for personal
instructions that apply to all conversations. Paste this, replacing
`<your-document-link>` with the link from
[step 2 of the installation](#2-create-the-document):

> When I say "send to Claude Code", leave a comment addressed to Claude in the
> document voice-mode-for-claude-code (`<your-document-link>`), containing the
> request I say next. When I say "read Claude Code's answer", read aloud
> Claude's latest reply in that document.

The link lets voice mode find the right document without searching by name. The
phrases below assume this instruction is saved.

### Speak a request

Every request becomes a comment in the document, addressed to Claude. The
watcher ignores comments that are not addressed to Claude.

| To | Say to voice mode |
| --- | --- |
| Send a new request | "Send to Claude Code: run the tests in the CVM project." |
| Send to a specific session | "Send to Claude Code: in the session cvm-pipeline, run the tests." |
| Hear the answer | "Read Claude Code's answer." |
| Answer a question from the session | "In the same thread, reply to Claude Code: option one." |
| Turn the watcher off | "Send to Claude Code: turn off the watcher." |

### What the answer sounds like

The session replies in three parts: what it did, the result, and whether it
needs you. There is no markdown, code or table, and files are named without
their full path, because voice mode reads everything aloud. Technical detail
stays in the session log, which you can see on the PC with `claude logs <id>`.

Without a decision:

> I did this. Result: that. I don't need you.

With a decision, one decision at a time, one sentence per option:

> I did this. Result: that. I need a decision from you. The question is: this.
> I recommend option one, because of that. Option one, recommended: this.
> Option two, minimal: this. Option three, thorough: this. Option four,
> alternative: this. Answer with the number, or in your own words.

### Turn the watcher on and off

- **On:** in a Claude Code session, run
  `schtasks /change /tn voice-mode-for-claude-code-watcher /enable`. From your
  phone, you can dictate "turn on the watcher" in a session you reach through
  Remote Control. Turning it on through voice mode does not work: while the
  watcher is off, nobody reads the document.
- **Off:** say "Send to Claude Code: turn off the watcher", or wait. The watcher
  turns itself off after 30 minutes without a new request.
- **Hours:** it only runs from 08:00 to 19:00, and it forwards at most 30
  requests a day.

## Requirements

| Item | Requirement |
| --- | --- |
| Operating system | Windows 10 or 11 |
| Claude Code | 2.1.234 or later, signed in with a claude.ai account (`claude auth status` shows `"authMethod": "claude.ai"`) |
| Plan | Pro, Max, Team or Enterprise. An API key does not work: the watcher needs the claude.ai connectors, which come with the claude.ai sign-in |
| Connector | Claude Docs enabled in your claude.ai account |
| Phone | Claude app for Android or iOS, with voice mode, using the same account |
| Node.js | 18 or later |
| Team and Enterprise | Auto mode must not be disabled by your admin. Remote Control must be enabled if you want to turn the watcher on from your phone |

## Installation

### 1. Clone the repository

```powershell
git clone https://github.com/samuelkutz/voice-mode-for-claude-code.git
cd voice-mode-for-claude-code
```

### 2. Create the document

In Claude (desktop, web or Claude Code), ask:

> Create a Claude Doc named voice-mode-for-claude-code. It will hold comments
> between my phone and Claude Code.

Copy the document link. It looks like
`https://claude.ai/code/artifact/<document-id>`.

Keep the document private. Anyone who can comment on it can send work to your
PC.

Then save the standing instruction with this link, as described in
[Save a standing instruction first](#save-a-standing-instruction-first).

### 3. Check that headless Claude Code can read the document

This is the command the watcher is built on. Replace `<document-id>` and run it
in PowerShell:

```powershell
$env:ENABLE_TOOL_SEARCH = "false"
claude -p 'Call the Claude Docs read tool on ref {"object":"project","id":"<document-id>"} and output only the list of tab ids.' `
  --model haiku --output-format json --tools "" --disable-slash-commands `
  --no-session-persistence --allowedTools "mcp__claude_ai_Claude_Docs__read"
```

Look at `num_turns` in the output. It must be 2 or more. A value of 1 means the
model answered without calling the tool, so the connector is not reachable from
headless runs on your machine.

### 4. Configure the watcher *(planned)*

```powershell
npm install
npm run setup -- https://claude.ai/code/artifact/<document-id>
```

`setup` reads the document once, finds its tab id and writes `config.json`.
`config.json` is ignored by git. The settings you can change:

| Setting | Default | Meaning |
| --- | --- | --- |
| `docUrl` | from `setup` | The document |
| `workdir` | the parent folder of your projects | Where new sessions start; the session chooses the project |
| `intervalMinutes` | `3` | How often the watcher reads the document |
| `windowStart`, `windowEnd` | `08:00`, `19:00` | Hours when the watcher runs |
| `dailyCap` | `30` | Maximum requests forwarded per day |
| `idleOffMinutes` | `30` | Turns itself off after this long without a new request |

### 5. Register the scheduled task *(planned)*

```powershell
npm run install-task
```

This creates the Task Scheduler task `voice-mode-for-claude-code-watcher`, set
to run every 3 minutes between the configured hours, and leaves it disabled.
Turn it on as described in
[Turn the watcher on and off](#turn-the-watcher-on-and-off).

### 6. Try it

1. Turn the watcher on.
2. In voice mode, say: "Send to Claude Code: how many files are in my projects
   folder?"
3. Wait up to 3 minutes, then say: "Read Claude Code's answer."

## What the watcher does on each run

1. Stops if the time is outside the configured hours, or if the daily cap is
   reached.
2. Runs a minimal headless Claude Code call with Haiku that can only read the
   document. It loads no skills, no built-in tools and no write tools, which
   keeps each run near 6,000 tokens.
3. Accepts the result only if the model really called the read tool.
4. Keeps comments that are addressed to Claude, written by you, and newer than
   the last one it processed. Comments with the same text within 5 minutes count
   once.
5. For each request:
   - a reply inside a thread goes to the session that opened the thread,
     resuming it if it has ended;
   - a request that names a running session goes to that session, through the
     session's local named pipe;
   - anything else starts a new session with `claude --bg` in `workdir`.
6. Saves the last processed comment, and turns itself off after the idle limit
   or on "turn off the watcher".

The watcher never executes a request itself. It only forwards.

## Security

- **Your permissions.** Sessions run as your Windows user, with your files, git
  credentials and network access.
- **Permission mode.** New sessions run in `auto` mode, where a classifier
  reviews each action, and with `git push` and `gh pr` denied by rule. Sessions
  can edit, test and commit locally; anything that leaves your PC for GitHub
  goes through you.
- **Untrusted text.** A request is text that passed through a chat. Only
  comments written by your own account are forwarded, and the document should
  stay private.
- **Blocked sessions.** A background session that needs a permission you have
  not granted stops and waits. You approve it on the PC with
  `claude attach <id>`.

## Cost

Everything counts against your Claude plan. On a subscription, usage inside
your allowance is not billed in dollars; the dollar figures Claude Code shows
are list-price estimates.

- Each watcher run uses about 6,000 tokens of Haiku.
- Each new background session starts with a baseline of roughly 50,000 tokens
  of your default model, before any work.
- Requests sent to a running session are cheap, because its prompt cache is
  already warm.

Check real usage with `/usage` in Claude Code.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The watcher says there is nothing new, but there are comments | The model answered without calling the tool. The watcher must reject runs with fewer than 2 turns |
| Headless runs cannot see the Claude Docs connector | Do not use `--strict-mcp-config` or `--bare`: the first removes the claude.ai connectors, the second ignores the claude.ai sign-in |
| The model changed unexpectedly | `--setting-sources ""` drops your model preference. Always pass `--model` |
| A comment in the document did not wake a watching session | Expected. Only a person sending the thread to Claude wakes it; the watcher exists for this reason |
| A request went to a new session instead of the one you named | The name did not match a running session. The reply says so |

## Limitations

- Windows only.
- Slash commands in a request arrive as plain text and do not run.
- A background session cannot be approved by voice.
- Phone notifications when a session finishes are not implemented. Whether a
  background session can send them is still untested.
