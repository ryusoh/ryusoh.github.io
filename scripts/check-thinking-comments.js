#!/usr/bin/env node
/**
 * Stream-of-consciousness gate (AGENTS.md non-negotiable #9).
 *
 * Deterministic scan of ALL git-tracked JS/CSS sources (not just tests —
 * unattended agents write both) for:
 * 1. Thinking-out-loud comments (mid-write interjections, coverage-chasing
 *    notes; the full pattern list is THINKING_RE below).
 * 2. Abandoned test bodies: it/test calls whose callback body is empty or
 *    holds only comments — the JS form of an abandoned stub test.
 *
 * Exit code 1 (and one line per violation) if anything is found. Wired into
 * the pre-commit config as the `thinking-check` hook and into `make check` as
 * the `thinking-check` target. The repo's two Python utility scripts
 * (scripts/sync_commands.py, tools/sync_commands.py) are out of scope: the
 * repo has no Python tests, and telling comments from string literals in
 * Python needs a tokenizer this stdlib-only Node script does not have.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');

const SCAN_EXTENSIONS = ['.js', '.cjs', '.mjs', '.css'];

// Third-party trees are not ours to police (AGENTS.md non-negotiable #5).
const EXCLUDED_PARTS = ['node_modules/', 'js/vendor/', 'assets/vendor/'];

// Anchored-at-start patterns match the comment text after the marker is
// stripped; unanchored ones may appear anywhere in the comment.
const THINKING_RE = new RegExp(
    [
        '\\bwait[,!?…—]', // mid-write hesitation interjection
        '^hmm+\\b',
        '^huh\\b',
        '^ah[,!?]', // "Ah, ..."
        '^oh\\s+(?:wait|hmm|no)\\b',
        '^oops\\b',
        '^nope\\b',
        '^hold on\\b',
        '^actually[,!?]',
        '^how about\\b',
        "^let'?s (?:check|see|try|look)\\b",
        '^let me think\\b',
        '\\bto (?:hit|reach) line \\d+', // coverage-chasing notes
    ].join('|'),
    'i'
);

// A `//` or `/*` that is not part of a URL scheme (`https://`) or a path.
const JS_INLINE_MARKER_RE = /(?<![:\w/])(\/\/|\/\*)/;

// it/test calls whose callback body holds only whitespace or comments — the
// JS form of the abandoned stub test.
const JS_EMPTY_TEST_RE =
    /\b(?:it|test)\s*\(\s*(['"`])((?:\\.|(?!\1).)*?)\1\s*,\s*(?:async\s+)?(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{(?<body>[^{}]*)\}/gs;

const JS_COMMENT_STRIP_RE = /\/\/[^\n]*|\/\*.*?\*\//gs;

function thinkingInComment(text) {
    return THINKING_RE.test(text.trim());
}

function* scanJsEmptyTests(src) {
    // `[^{}]*` bodies mean no nested blocks — a match is whitespace/comments
    // at most, so flagging on comment-stripped emptiness is exact.
    for (const match of src.matchAll(JS_EMPTY_TEST_RE)) {
        const body = match.groups.body.replace(JS_COMMENT_STRIP_RE, '').trim();
        if (!body) {
            const lineno = src.slice(0, match.index).split('\n').length;
            yield { lineno, title: match[2] };
        }
    }
}

function* scanJsComments(src) {
    // Line-based with minimal block-comment state; `//` preceded by `:` (URL
    // schemes) or word chars is not treated as a comment start.
    let inBlock = false;
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const stripped = line.replace(/^\s+/, '');
        if (inBlock) {
            const text = stripped.replace(/^\*/, '').trim();
            if (thinkingInComment(text)) {
                yield { lineno: i + 1, text };
            }
            if (stripped.includes('*/')) {
                inBlock = false;
            }
            continue;
        }
        if (stripped.startsWith('//') || stripped.startsWith('/*')) {
            const text = stripped.slice(2).replace(/^\*/, '').trim();
            if (thinkingInComment(text)) {
                yield { lineno: i + 1, text };
            }
            if (stripped.startsWith('/*') && !stripped.includes('*/')) {
                inBlock = true;
            }
            continue;
        }
        const match = JS_INLINE_MARKER_RE.exec(line);
        if (match) {
            const rest = line.slice(match.index + match[0].length);
            const text = rest.replace(/^\*/, '').trim();
            if (thinkingInComment(text)) {
                yield { lineno: i + 1, text };
            }
            if (match[1] === '/*' && !rest.includes('*/')) {
                inBlock = true;
            }
        }
    }
}

function isScanned(path) {
    if (!SCAN_EXTENSIONS.some((ext) => path.endsWith(ext))) {
        return false;
    }
    if (path.endsWith('.min.js')) {
        return false;
    }
    return !EXCLUDED_PARTS.some((part) => path.includes(part));
}

function iterTrackedSources() {
    // Git-tracked source files in scope (tracked only, so .gitignore is
    // honored). Run from the repo root, as `make` and pre-commit do.
    const out = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
    return out.split('\n').filter(isScanned);
}

function* findViolations(paths) {
    for (const path of paths) {
        const src = fs.readFileSync(path, 'utf8');
        for (const { lineno, text } of scanJsComments(src)) {
            yield `${path}:${lineno}: thinking-out-loud comment: // ${text}`;
        }
        if (!path.endsWith('.css')) {
            for (const { lineno, title } of scanJsEmptyTests(src)) {
                yield `${path}:${lineno}: abandoned test body (empty callback): '${title}'`;
            }
        }
    }
}

function main() {
    const violations = [...findViolations(iterTrackedSources())];
    for (const violation of violations) {
        console.error(`x ${violation}`);
    }
    if (violations.length > 0) {
        console.error(
            `\n${violations.length} stream-of-consciousness violation(s) ` +
                '(AGENTS.md non-negotiable #9). Delete the reasoning — ' +
                'code comments state facts about behaviour.'
        );
        return 1;
    }
    console.log('thinking-check: no stream-of-consciousness comments or abandoned test bodies');
    return 0;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    thinkingInComment,
    scanJsComments,
    scanJsEmptyTests,
    iterTrackedSources,
    findViolations,
};
