.PHONY: help hooks precommit update-hooks fmt-check fmt lint lint-js lint-css lint-fix check fix

help:
	@echo "Targets:"
	@echo "  hooks         Install pre-commit git hooks (if available)"
	@echo "  precommit     Run pre-commit on all files"
	@echo "  update-hooks  pre-commit autoupdate for hook repos"
	@echo "  fmt-check     Run Prettier in check mode (uses .ci-configs)"
	@echo "  fmt           Apply Prettier formatting (uses .ci-configs)"
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
		python3 -m pre_commit run --all-files --show-diff-on-failure; \
	else \
		echo "No .pre-commit-config.yaml; skipping pre-commit."; \
	fi

update-hooks:
	@python3 -m pre_commit autoupdate --repo https://github.com/pre-commit/pre-commit-hooks || true

# --- Developer convenience (CI parity without committing) ---
fmt-check:
	@if [ -f .ci-configs/js/.prettierrc.json ]; then \
		npx prettier -c . \
		  --config .ci-configs/js/.prettierrc.json \
		  --ignore-path .ci-configs/js/.prettierignore; \
	else \
		echo "No .ci-configs/js/.prettierrc.json; skipping Prettier check."; \
	fi

fmt:
	@if [ -f .ci-configs/js/.prettierrc.json ]; then \
		npx prettier -w . \
		  --config .ci-configs/js/.prettierrc.json \
		  --ignore-path .ci-configs/js/.prettierignore; \
	else \
		npx prettier -w .; \
	fi

lint-js:
	@npx eslint . --config .ci-configs/js/eslint.config.cjs --max-warnings=0

lint-css:
	@npx -y -p @stylistic/stylelint-plugin stylelint "**/*.css" --config-basedir "$(PWD)" --formatter=unix

lint: lint-js lint-css

check: fmt-check lint

lint-fix:
	@# Apply ESLint fixes (uses shared config)
	@npx eslint . --config .ci-configs/js/eslint.config.cjs --fix --max-warnings=0 || true
	@# Apply Stylelint fixes (ensure plugin availability)
	@npx -y -p @stylistic/stylelint-plugin stylelint "**/*.css" --config-basedir "$(PWD)" --fix || true

fix: fmt lint-fix
