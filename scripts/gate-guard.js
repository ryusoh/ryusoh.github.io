#!/usr/bin/env node
/**
 * Worktree snapshot guard: don't rerun a failed gate on an unchanged tree.
 *
 * A red gate (`make precommit-fix`) over an untouched worktree cannot go
 * green — rerunning it only burns time. Take a snapshot before running the
 * gate, and check it before retrying:
 *
 *     SNAP=$(node scripts/gate-guard.js snapshot)
 *     make precommit-fix                             # fails
 *     node scripts/gate-guard.js check "$SNAP"       # unchanged -> exit 1, edit first
 *
 * The fingerprint covers `git status --porcelain`, the tracked diff against
 * `HEAD`, and the contents of untracked files, so any edit — staged, unstaged,
 * or to a brand-new file — changes it.
 */

'use strict';

const { execFileSync } = require('child_process');
const { Buffer } = require('node:buffer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function git(repo, args) {
    return execFileSync('git', args, { cwd: repo });
}

/** Return a hash of the worktree: status, tracked diff, untracked contents. */
function worktreeFingerprint(repo) {
    const digest = crypto.createHash('sha256');
    const sepBuf = Buffer.from(path.sep);
    digest.update(git(repo, ['status', '--porcelain=v1', '-z']));
    digest.update(git(repo, ['diff', 'HEAD', '--binary']));
    const others = git(repo, ['ls-files', '--others', '--exclude-standard', '-z']);
    const entries = others
        .toString('latin1')
        .split('\0')
        .filter((entry) => entry.length > 0)
        .sort();
    for (const raw of entries) {
        // Buffer paths preserve raw filename bytes (Node accepts Buffer paths).
        const rawBuf = Buffer.from(raw, 'latin1');
        try {
            digest.update(rawBuf);
            digest.update(fs.readFileSync(Buffer.concat([Buffer.from(repo), sepBuf, rawBuf])));
        } catch {
            // Untracked entry vanished or is unreadable (e.g. a dangling symlink).
        }
    }
    return digest.digest('hex');
}

function usage() {
    console.error('usage: node scripts/gate-guard.js snapshot [--repo <path>]');
    console.error('       node scripts/gate-guard.js check <snapshot> [--repo <path>]');
}

function parseArgs(argv) {
    const args = { command: null, snapshot: null, repo: process.cwd() };
    const rest = [...argv];
    while (rest.length > 0) {
        const arg = rest.shift();
        if (arg === '--repo') {
            args.repo = rest.shift();
            if (args.repo === undefined) {
                return null;
            }
        } else if (args.command === null) {
            args.command = arg;
        } else if (args.snapshot === null) {
            args.snapshot = arg;
        } else {
            return null;
        }
    }
    return args;
}

function main(argv) {
    const args = parseArgs(argv);
    if (
        args === null ||
        (args.command === 'check' && args.snapshot === null) ||
        (args.command !== 'snapshot' && args.command !== 'check')
    ) {
        usage();
        return 2;
    }

    let fingerprint;
    try {
        fingerprint = worktreeFingerprint(args.repo);
    } catch (err) {
        console.error(`gate-guard: git failed in ${args.repo}: ${err.message}`);
        return 2;
    }

    if (args.command === 'snapshot') {
        console.log(fingerprint);
        return 0;
    }
    if (fingerprint === args.snapshot) {
        console.error(
            'worktree unchanged since snapshot — edit something before rerunning the gate'
        );
        return 1;
    }
    return 0;
}

if (require.main === module) {
    process.exit(main(process.argv.slice(2)));
}

module.exports = { main, worktreeFingerprint };
