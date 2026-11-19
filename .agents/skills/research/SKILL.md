---
name: research
description: Investigate a question against primary sources and write a cited Markdown findings doc. Use when the user asks you to research, investigate, or gather authoritative background on a topic.
---

# Research

Investigate a question thoroughly against **primary sources** and capture the
findings as a single cited Markdown file, so the answer is durable and
re-checkable instead of living only in chat.

## Run it in the background

Delegate the investigation to a background subagent so you can keep working
while it runs. Give it the question, the primary sources to prefer, and the
output location decided below.

## Investigate

- Consult **official documentation, source code, specifications, and first-party
  APIs**, tracing every claim to its authoritative origin rather than to
  secondary write-ups.
- For this repo's own subsystems, the primary source is the code under `js/` /
  `scripts/` plus the governing doc under `docs/` (`AGENTS.md` maps them).

## Document

Compile findings into **one Markdown file** with a source citation for each
claim (URL, file path, or spec section). Structure: the question, the answer,
then claim-by-claim evidence with citations, and an explicit "open questions /
what I couldn't verify" section.

## Store

Save following this repo's convention: durable subsystem knowledge lives under
`docs/`. Extend an existing subsystem doc when the finding maps to it; add a
new `docs/<topic>.md` for a genuinely new area and note the location in your
reply. Put ranked action items in a section of the same findings doc rather
than spawning a second file. Use the session scratchpad for throwaway
investigations.

## Verify

Before reporting completion, run `make gate` (or `make precommit-fix` when the
tree holds only your changes). Scoped Prettier/markdownlint checks help while
editing, and if the full gate was not run, state that explicitly.

## Output constraints

- Quote verbatim source language sparingly — **max ~125 characters** per quote,
  in quotation marks; paraphrase otherwise.
- Respect open-source licenses; summarize rather than reproducing files or long
  passages.
- Report what you found and what you couldn't verify — stick to verified facts
  without legal interpretation or guesses.
