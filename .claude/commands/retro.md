---
description: Retrospective — turn this session's friction into durable repo improvements (the compounding loop)
argument-hint: "[optional focus area, e.g. 'particle animation']"
---

You just finished a task. Run a **compounding-loop retrospective** so the next task
in this repo is closer to one-shot. Be honest and concrete, and prefer patching the
repo over re-explaining things in chat.

Work through these steps:

1. **Diagnose the friction.** Look back over THIS session and name the specific
   things that cost tokens or caused back-and-forth: wrong guesses, missing
   context, repeated verification, commands you had to discover, knowledge you
   re-derived from scratch, edits that matched the wrong file. Quote concrete
   moments — don't generalize.
   If the user provided a focus area (`$ARGUMENTS`), focus the retrospective there.

2. **Map each friction point to a durable artifact.** For each one, name the
   thing that would have prevented it:
    - the `AGENTS.md` at the repo root (auto-loaded context: where things live,
      how to run/verify, project conventions) — **only** if the rule is broadly
      useful and stable. Extend it sparingly, since it is auto-loaded context for
      every future session and every edit busts the prompt cache;
    - a knowledge doc under `docs/` for anything too long or specific for
      `AGENTS.md`;
    - a `Makefile` target (this repo uses `make check` / `make fix` / `make fmt`);
    - a Jest test or a lint/Prettier/Stylelint rule that turns a manual check into
      an automated gate;
    - a new or updated `.agents/skills/<name>/SKILL.md` for a multi-step prompt
      worth replaying on demand (`.claude/commands/` is generated from these by
      `tools/sync_commands.py` — don't edit it directly).

3. **Check what already exists first.** Read the relevant `Makefile`, `README.md`,
   `.pre-commit-config.yaml`, lint configs, existing `docs/`, and `.agents/skills/`
   before adding anything, so you patch real gaps instead of duplicating. Don't
   put repo knowledge in chat or memory if it belongs in a version-controlled file.

4. **Implement the safe, high-leverage fixes now.** Knowledge capture, small
   `AGENTS.md`/`.jules/*.md` edits, scoped skills, deduplication, and tests/lint
   rules are usually safe to just do. Promote standards up the ratchet: prose →
   checklist → lint/Prettier rule → CI-blocking check.

5. **Ask before anything heavy or hard to reverse** — new dependencies, tool
   installs, CI workflow changes under `.github/`, file moves, anything
   outward-facing. Present the trade-off and let me choose; don't install it
   unilaterally.

6. **Verify and report.** Run `make check` (and `npx jest` if tests are relevant),
   keep lint and tests green, and summarize what you changed and exactly how it
   pays off next time. Do not commit unless explicitly asked.

Guiding test: _a correction given today should be impossible to need next month_ —
because it now lives in the repo, not in this conversation.
