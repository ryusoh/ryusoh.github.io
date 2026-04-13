.PHONY: help hooks precommit precommit-fix update-hooks fmt-check fmt lint lint-js lint-css lint-fix check fix

NPX ?= ./scripts/run-npx.sh

help:
	@echo "Targets:"
	@echo "  hooks         Install pre-commit git hooks (if available)"
	@echo "  precommit     Run pre-commit on all files"
	@echo "  precommit-fix Run pre-commit auto-fixes on all files"
	@echo "  update-hooks  pre-commit autoupdate for hook repos"
	@echo "  fmt-check     Run Prettier in check mode"
	@echo "  fmt           Apply Prettier formatting"
	@echo "  lint          Run JS/CSS lint (ESLint/Stylelint)"
	@echo "  lint-fix      Apply ESLint/Stylelint auto-fixes"
	@echo "  check         Run fmt-check + lint (quick CI parity)"
	@echo "  fix           Run fmt + lint-fix"

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

precommit: hooks
	@if [ -f .pre-commit-config.yaml ]; then \
		PRE_COMMIT_NO_CONCURRENCY=1 python3 -m pre_commit run --all-files --show-diff-on-failure; \
	else \
		echo "No .pre-commit-config.yaml; skipping pre-commit."; \
	fi

precommit-fix: hooks
	@if [ -f .pre-commit-config.yaml ]; then \
		echo "Running pre-commit auto-fixes..."; \
		PRE_COMMIT_NO_CONCURRENCY=1 python3 -m pre_commit run --all-files --hook-stage manual || true; \
	else \
		echo "No .pre-commit-config.yaml; skipping pre-commit fix."; \
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

lint: lint-js lint-css

check: fmt-check lint

lint-fix:
	@$(NPX) eslint . --config eslint.config.cjs --fix --max-warnings=0 --no-warn-ignored || true
	@$(NPX) stylelint "**/*.css" --config .stylelintrc.cjs --fix --max-warnings=0 || true

fix: fmt lint-fix
