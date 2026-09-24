# voice-mode-for-claude-code: usage and installation

voice-mode-for-claude-code lets you drive Claude Code on your PC by talking to
the Claude mobile app in voice mode. You speak a request, Claude Code does the
work on your PC, and voice mode reads the answer back to you.

Tested on Windows 11 with Claude Code 2.1.229 and Node.js 24.

## How it works

1. You speak a request in voice mode on your phone.
2. Voice mode posts it as a comment, addressed to Claude, in a Claude Doc named
   `voice-mode-for-claude-code` in your claude.ai account.
3. On your PC, the watcher (`npm run watch`) reads the document every 3 minutes
   and finds the new comment.
4. The watcher hands the request to a Claude Code session and replies
   "Received" in the thread. By default it starts a new background session. If
   the request names a running session, it delivers the request to that session.
5. The session posts short progress notes while it works, then its answer, in
   the same thread, in a format written to be heard.
6. You ask voice mode how it is going, and it reads the latest note aloud.

Everything goes through claude.ai. There is no tunnel, no public server and no
open port on your PC. The watcher is a normal, visible Node process.

Why the watcher exists: a comment in a Claude Doc wakes a watching Claude Code
session only when a person sends the thread to Claude from the document screen.
A comment written by Claude, such as one posted by voice mode, does not count.
The watcher closes that gap by reading the document every few minutes.

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
instructions that apply to all conversations. `npm run setup`
([step 4](#4-run-setup)) prints this instruction with your link and ids filled
in; paste what it prints. The template:

> When I say "send to Claude Code", leave a comment addressed to Claude (field
> to: ["claude"]) in the document voice-mode-for-claude-code (link: `<your-document-link>`; document
> id: `<your-document-id>`; tab body id: `<your-tab-body-id>`), containing
> the request I say next. When I say "read Claude Code's answer", read aloud
> Claude's latest reply in that document.

The link and ids let voice mode find the right document and post the comment
without searching. The phrases below assume this instruction is saved.

### Speak a request

Every request becomes a comment in the document. The watcher treats as a
request any new thread started by your account, and any reply addressed to
Claude, either in the `to` field or with the text starting "to: claude". Other
replies are ignored, because sessions post their answers through your account
too. So do not start threads in this document for anything else.

| To | Say to voice mode |
| --- | --- |
| Send a new request | "Send to Claude Code: run the tests in the CVM project." |
| Send to a specific session | "Send to Claude Code: in the session cvm-pipeline, run the tests." |
| Hear the answer or the progress | "Read Claude Code's answer." |
| Answer a question from the session | "In the same thread, reply to Claude Code: option one." |
| Check the watcher | "Read the latest reply in the watcher status thread." |
| Turn the watcher off | "Send to Claude Code: turn off the watcher." |

### What you will hear

Every note in a thread is written to be read aloud: no markdown, code or table,
and files are named without their full path. Technical detail stays in the
session, which you can open on the PC with `claude attach <id>`.

| Note | Starts with (default Portuguese text) | Who posts it |
| --- | --- | --- |
| Receipt | "Recebido." (received) | The watcher, just before it forwards the request |
| Progress | "Andamento:" (progress) | The session, at each phase, for tasks longer than a minute |
| Answer | "Terminei." (done) | The session, in three parts: what it did, the result, and whether it needs you |

When the session needs a decision, it asks one question at a time, one sentence
per option:

> I need a decision from you. The question is: this. I recommend option one,
> because of that. Option one, recommended: this. Option two, minimal: this.
> Option three, thorough: this. Option four, alternative: this. Answer with the
> number, or in your own words.

The prompt the sessions receive is in Portuguese, in [src/prompt.js](src/prompt.js),
and the watcher's own notes are in [src/watcher.js](src/watcher.js) and
[src/watch.js](src/watch.js). Edit them to change the language or the format.

### Turn the watcher on and off

- **On:** run `npm run watch` in the project folder. From your phone, dictate
  in a Claude Code session you reach through Remote Control: "run npm run watch
  in the voice-mode-for-claude-code folder, in the background". Turning it on
  through voice mode does not work: while the watcher is off, nobody reads the
  document.
- **Off:** say "Send to Claude Code: turn off the watcher", press Ctrl+C, or
  wait. The watcher stops by itself after 30 minutes without a new request.
- **Status:** the watcher reports "on" and "off" in a fixed status thread in the
  document.
- **Cap:** it forwards at most 30 requests a day.

## Requirements

| Item | Requirement |
| --- | --- |
| Operating system | Windows 10 or 11 |
| Claude Code | Signed in with a claude.ai account: `claude auth status` shows `"authMethod": "claude.ai"` |
| Plan | Pro, Max, Team or Enterprise. An API key does not work: the watcher needs the claude.ai connectors, which come with the claude.ai sign-in |
| Connector | Claude Docs enabled in your claude.ai account |
| Phone | Claude app for Android or iOS, with voice mode, using the same account |
| Node.js | 18 or later. No npm packages are needed |
| Team and Enterprise | Auto mode must not be disabled by your admin. Remote Control must be enabled if you want to start the watcher from your phone |

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

You save the standing instruction after step 4, which prints it for you.

### 3. Trust the folder where sessions start

New sessions start in the parent folder of this repository, the folder that
holds your projects. `claude --bg` refuses a folder you have not trusted. Run
`claude` there once, accept the trust prompt, and exit:

```powershell
cd ..
claude
```

To start sessions somewhere else, set `workdir` in `config.json` after step 4,
and trust that folder instead.

### 4. Run setup

```powershell
npm run setup -- https://claude.ai/code/artifact/<document-id>
```

`setup` reads the document once, finds its tab, records which MCP servers your
Claude Code loads, creates the watcher status thread, and writes `config.json`,
which git ignores. It also marks every existing comment as already seen, and
prints the standing instruction with your ids: save it as described in
[Save a standing instruction first](#save-a-standing-instruction-first).

Settings you can change in `config.json`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `workdir` | the parent folder of this repository | Where new sessions start; the session chooses the project |
| `intervalMinutes` | `3` | How often the watcher reads the document |
| `dailyCap` | `30` | Maximum requests forwarded per day |
| `idleOffMinutes` | `30` | Stops after this long without a new request |
| `workerModel` | `null` | Model for new sessions; `null` uses your default |
| `keepThreads` | `10` | Request threads kept in the document; older ones are archived and deleted |
| `keepStatusReplies` | `10` | Replies kept in the status thread |

Run `setup` again after you add or remove claude.ai connectors.

### 5. Try it

1. Run `npm run watch`.
2. In voice mode, say: "Send to Claude Code: how many markdown files are in my
   projects folder?"
3. Wait up to 3 minutes, then say: "Read Claude Code's answer."

To test without waiting, `npm run watch-once` does a single pass.

## What the watcher does on each pass

1. Stops after the idle limit.
2. Runs a minimal headless Claude Code call with Haiku that can use one Claude
   Docs tool plus tool search, and nothing else: no skills, no other built-in
   tools, every other MCP server denied. Each call is about 16,000 to 23,000
   tokens. Tool search stays on because the claude.ai connectors are often
   still connecting when a headless run starts; without it the tool is missing
   from the run.
3. Reads the comments from the tool's raw result, never from the model's text,
   and fails if the model did not make the call. Haiku sometimes skips the
   call; the watcher retries up to 3 times.
4. Keeps comments written by you, newer than the last one it processed, that
   start a new thread or are addressed to Claude. Deleted comments are skipped.
   Comments with the same text within 5 minutes count once.
5. For each request:
   - a reply inside a thread goes to the session that opened the thread,
     resuming it if it has ended;
   - a request that names a running session goes to that session, through the
     session's local named pipe;
   - anything else starts a new session with `claude --bg` in `workdir`.
6. Posts "Recebido" in the thread before forwarding, so the session's answer is
   always the latest comment, and saves what it processed.
7. Keeps the document small: when there are more than 10 request threads, it
   copies the oldest one to `logs/archive.jsonl` and deletes it, skipping
   threads whose session is still working. The status thread keeps its last 10
   replies. A Claude Doc holds at most 1000 threads and 100 comments per thread.

The watcher never executes a request itself. It only forwards.

## Security

- **Your permissions.** Sessions run as your user, with your files, git
  credentials and network access.
- **Permission mode.** New sessions run in `auto` mode, where a classifier
  reviews each action, with `git push` and `gh pr` denied by rule. Sessions can
  edit, test and commit locally; anything that leaves your PC for GitHub goes
  through you.
- **Untrusted text.** A request is text that passed through a chat. Only
  comments written by your own account are forwarded, and the document should
  stay private.
- **Messages to running sessions.** They arrive marked as coming from another
  session, so they cannot approve a pending permission or change settings.
- **Blocked sessions.** A background session that needs a permission you have
  not granted stops and waits. You approve it on the PC with
  `claude attach <id>`.
- **Endpoint protection.** Run the watcher as a visible process. Launching it
  hidden, for example through `conhost --headless` or a script host, looks like
  malware to endpoint protection such as CrowdStrike, and was blocked in
  testing.

## Cost

Everything counts against your Claude plan. On a subscription, usage inside
your allowance is not billed in dollars; the dollar figures Claude Code shows
are list-price estimates.

- Each pass uses about 16,000 to 23,000 tokens of Haiku, mostly cache reads, and
  the watcher makes about 20 passes an hour while it runs.
- Each new background session starts with a baseline of roughly 50,000 tokens
  of your default model, before any work.
- Requests sent to a running session are cheap, because its prompt cache is
  already warm.

Check real usage with `/usage` in Claude Code.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `claude --bg failed` in `logs/watcher.log` with "Workspace not trusted" | Trust `workdir`, as in [step 3](#3-trust-the-folder-where-sessions-start) |
| "Another watcher is already running" | Only one watcher runs at a time. If none is running, delete `state/lock` |
| "the model did not call" in the log | The Claude Docs connector was still connecting. Keep tool search on (the default in this project); the watcher retries 3 times |
| Headless runs cannot see the Claude Docs connector | Do not use `--strict-mcp-config` or `--bare`: the first removes the claude.ai connectors, the second ignores the claude.ai sign-in |
| The model changed unexpectedly | `--setting-sources ""` drops your model preference. Always pass `--model` |
| A comment in the document did not wake a watching session | Expected. Only a person sending the thread to Claude wakes it; the watcher exists for this reason |
| A request went to a new session instead of the one you named | The name did not match a running session. The answer says so |

## Limitations

- Tested on Windows only.
- Slash commands in a request arrive as plain text and do not run.
- A background session cannot be approved by voice.
- Phone notifications when a session finishes are not implemented.
