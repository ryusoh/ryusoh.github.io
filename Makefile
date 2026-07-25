.PHONY: help hooks precommit precommit-fix update-hooks fmt-check fmt lint lint-js lint-css depcheck lint-fix type check fix test mutate-js sync-check

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
	@echo "  check         Run fmt-check + lint + type (quick CI parity)"
	@echo "  fix           Run fmt + lint-fix"
	@echo "  test          Run the full Jest suite with a coverage report"
	@echo "  mutate-js     StrykerJS mutation run (non-blocking; not in any gate)"

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

precommit: hooks sync-check
	@if [ -f .pre-commit-config.yaml ]; then \
		PRE_COMMIT_NO_CONCURRENCY=1 python3 -m pre_commit run --all-files --show-diff-on-failure; \
	else \
		echo "No .pre-commit-config.yaml; skipping pre-commit."; \
	fi

precommit-fix: hooks sync-check
	@if [ -f .pre-commit-config.yaml ]; then \
		echo "Running pre-commit auto-fixes..."; \
		PRE_COMMIT_NO_CONCURRENCY=1 python3 -m pre_commit run --all-files --hook-stage manual || true; \
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

check: fmt-check lint type sync-check

lint-fix:
	@$(NPX) eslint . --config eslint.config.cjs --fix --max-warnings=0 --no-warn-ignored || true
	@$(NPX) stylelint "**/*.css" --config .stylelintrc.cjs --fix --max-warnings=0 || true

fix: fmt lint-fix

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
