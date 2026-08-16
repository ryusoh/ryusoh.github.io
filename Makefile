.PHONY: help hooks precommit precommit-fix update-hooks fmt-check fmt lint lint-js lint-css depcheck lint-fix type check fix test mutate-js sync-check sync-pages sync-pages-check thinking-check images thumbhashes assets page extract

NPX ?= ./scripts/run-npx.sh

help:
	@echo "Targets:"
	@echo "  hooks         Install pre-commit git hooks (if available)"
	@echo "  precommit     Run pre-commit on all files"
	@echo "  precommit-fix Run pre-commit auto-fixes on all files"
	@echo "  update-hooks  pre-commit autoupdate for hook repos"
	@echo "  fmt-check     Run Prettier in check mode"
	@echo "  fmt           Apply Prettier formatting"
	@echo "  lint          Run JS/CSS lint (ESLint/Stylelint) + dependency-structure gate"
	@echo "  lint-fix      Apply ESLint/Stylelint auto-fixes"
	@echo "  type          JS strict type check (tsc --checkJs on whitelist)"
	@echo "  thinking-check Stream-of-consciousness scan (comments, abandoned tests)"
	@echo "  sync-pages    Synchronize portfolio pages with portfolio-shell.html template"
	@echo "  sync-pages-check Check portfolio pages are in sync with shell template"
	@echo "  check         Run fmt-check + lint + type + sync-check + sync-pages-check"
	@echo "  fix           Run fmt + lint-fix + sync-pages"
	@echo "  test          Run the full Jest suite with a coverage report"
	@echo "  mutate-js     StrykerJS mutation run (non-blocking; not in any gate)"
	@echo "  images        Batch build multi-tier AVIF and WebP responsive gallery images"
	@echo "  thumbhashes   Batch generate 28-char ThumbHash placeholders for gallery images"
	@echo "  assets        Run images + thumbhashes generation pipeline"
	@echo "  page          Build/generate a portfolio page (e.g. make page ID=p5)"

hooks:
	@if [ ! -f .pre-commit-config.yaml ]; then \
		echo "No .pre-commit-config.yaml; skipping pre-commit hook installation."; \
		exit 0; \
	fi
	@if git config --get core.hooksPath >/dev/null 2>&1; then \
		echo "Note: core.hooksPath is set; skipping pre-commit hook installation."; \
	else \
		python3 -m pre_commit install || true; \
	fi

# Resolve pre-commit once: prefer the `pre-commit` binary (brew/pipx), fall
# back to `python3 -m pre_commit`. Empty when neither exists — the precommit
# targets below fail loudly in that case instead of silently skipping every
# hook (a missing module previously printed an error yet exited 0).
PRECOMMIT := $(shell command -v pre-commit 2>/dev/null || (python3 -m pre_commit --version >/dev/null 2>&1 && echo "python3 -m pre_commit"))

precommit: hooks sync-check
	@if [ -f .pre-commit-config.yaml ]; then \
		if [ -z "$(PRECOMMIT)" ]; then \
			echo "ERROR: pre-commit is not installed (e.g. brew install pre-commit or pip install pre-commit)."; \
			exit 1; \
		fi; \
		PRE_COMMIT_NO_CONCURRENCY=1 $(PRECOMMIT) run --all-files --show-diff-on-failure; \
	else \
		echo "No .pre-commit-config.yaml; skipping pre-commit."; \
	fi

precommit-fix: hooks sync-check
	@if [ -f .pre-commit-config.yaml ]; then \
		if [ -z "$(PRECOMMIT)" ]; then \
			echo "ERROR: pre-commit is not installed (e.g. brew install pre-commit or pip install pre-commit)."; \
			exit 1; \
		fi; \
		echo "Running pre-commit auto-fixes..."; \
		PRE_COMMIT_NO_CONCURRENCY=1 $(PRECOMMIT) run --all-files --hook-stage manual || true; \
		echo "Staging auto-fixed files..."; \
		git add -u; \
	else \
		echo "No .pre-commit-config.yaml; skipping pre-commit fix."; \
	fi

# .claude/commands/ is generated from .agents/skills/ (the canonical source) by
# tools/sync_commands.py. Fail if regeneration is not a no-op (content hash of
# the tree before vs after), so the generated copy can never silently go stale.
sync-check:
	@before=$$(find .claude/commands -type f | LC_ALL=C sort | xargs shasum | shasum | cut -d' ' -f1); \
	python3 tools/sync_commands.py >/dev/null; \
	after=$$(find .claude/commands -type f | LC_ALL=C sort | xargs shasum | shasum | cut -d' ' -f1); \
	if [ "$$before" = "$$after" ]; then \
		echo "sync-check: .claude/commands is up to date"; \
	else \
		echo "sync-check FAIL: .claude/commands was stale and has been regenerated — commit the updated files (python3 tools/sync_commands.py)."; \
		exit 1; \
	fi

update-hooks:
	@python3 -m pre_commit autoupdate --repo https://github.com/pre-commit/pre-commit-hooks || true

# --- Developer convenience (CI parity without committing) ---
fmt-check:
	@$(NPX) prettier -c . --config .prettierrc.cjs --ignore-path .prettierignore

fmt:
	@$(NPX) prettier -w . --config .prettierrc.cjs --ignore-path .prettierignore

lint-js:
	@$(NPX) eslint . --config eslint.config.cjs --max-warnings=0 --no-warn-ignored

lint-css:
	@$(NPX) stylelint "**/*.css" --config .stylelintrc.cjs --max-warnings=0 --formatter=unix

lint: lint-js lint-css depcheck

# Dependency-structure gate: no circular imports. Rules: .dependency-cruiser.cjs
# (alias-resolution stub: .dependency-cruiser.webpack.cjs — see its header for
# why it's a webpack stub and not options.tsConfig).
depcheck:
	@$(NPX) dependency-cruiser js sw.js --config .dependency-cruiser.cjs

# JS strict type check (tsc --checkJs on whitelist; blocking — see
# docs/js-typing-strategy.md). The whitelist starts small and grows
# incrementally, so this never fails on unannotated files outside it.
type:
	@$(NPX) tsc -p jsconfig.json

# Stream-of-consciousness gate (AGENTS.md non-negotiable #9): deterministic
# scan of all tracked JS/CSS for thinking-out-loud comments and abandoned
# it()/test() bodies. Also a blocking pre-commit hook (same script).
thinking-check:
	@node scripts/check-thinking-comments.js

sync-pages:
	@node scripts/sync-pages.mjs

sync-pages-check:
	@node scripts/sync-pages.mjs --check

check: fmt-check lint type sync-check sync-pages-check thinking-check

lint-fix:
	@$(NPX) eslint . --config eslint.config.cjs --fix --max-warnings=0 --no-warn-ignored || true
	@$(NPX) stylelint "**/*.css" --config .stylelintrc.cjs --fix --max-warnings=0 || true

fix: fmt lint-fix sync-pages

# Mutation testing (NON-BLOCKING — not part of lint/check/precommit).
# coverageAnalysis is "off" because the repo's jsdom testEnvironment does not
# report per-test coverage to Stryker; tests still kill mutants via
# enableFindRelatedTests. Incremental results cache in reports/ (gitignored).
# js/block-navigation.js is excluded from the default mutate scope: its
# white-box tests rewrite the source text (injecting internals into the
# `testing` export), which Stryker's instrumented sandbox copies break —
# 8 dry-run failures of the form "testing.<fn> is not a function".
# Scope a smoke run with: npx stryker run --mutate js/<file>.js
mutate-js:
	@$(NPX) stryker run

# Full Jest suite + coverage report (fund-style on-demand check).
test:
	@$(NPX) jest --coverage

# Responsive image generation & ThumbHash pipeline
images:
	@node scripts/build-images.mjs

thumbhashes:
	@node scripts/generate-thumbhashes.mjs

assets: images thumbhashes

# Build a single portfolio page from markdown (supports `make page p5` or `make page ID=p5`)
ifeq (page,$(firstword $(MAKECMDGOALS)))
  PAGE_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  .PHONY: $(PAGE_ARGS)
  $(eval $(PAGE_ARGS):;@true)
endif

page:
	@node scripts/build-page.mjs $(if $(ID),$(ID),$(PAGE_ARGS))

# Extract markdown from an existing portfolio HTML page (supports `make extract p5` or `make extract ID=p5`)
ifeq (extract,$(firstword $(MAKECMDGOALS)))
  EXTRACT_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  .PHONY: $(EXTRACT_ARGS)
  $(eval $(EXTRACT_ARGS):;@true)
endif

extract:
	@node scripts/extract-page-markdown.mjs $(if $(ID),$(ID),$(EXTRACT_ARGS))
