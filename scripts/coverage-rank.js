#!/usr/bin/env node
/**
 * Rank source files by test coverage, lowest first.
 *
 * Reads a Jest `coverage-summary.json` (produced by
 * `jest --coverage --coverageReporters=json-summary`) and prints the
 * least-covered files. This exists to kill a real routine bug: reading a
 * truncated coverage table from the terminal, seeing only the bottom rows, and
 * re-testing files already at 100 percent while the worst files at the top are
 * ignored every run.
 *
 * Usage:
 *   npx jest --coverage --coverageReporters=json-summary --coverageReporters=text
 *   node scripts/coverage-rank.js --limit 5
 */

'use strict';

const fs = require('fs');
const path = require('path');

const METRICS = ['lines', 'statements', 'branches', 'functions'];
const DEFAULT_SUMMARY = path.join('coverage', 'coverage-summary.json');

function parseArgs(argv) {
    const opts = {
        summary: DEFAULT_SUMMARY,
        metric: 'lines',
        limit: 5,
        maxPct: 100,
        json: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--json') {
            opts.json = true;
        } else if (arg === '--summary') {
            opts.summary = argv[(i += 1)];
        } else if (arg === '--metric') {
            opts.metric = argv[(i += 1)];
        } else if (arg === '--limit') {
            opts.limit = Number(argv[(i += 1)]);
        } else if (arg === '--max-pct') {
            opts.maxPct = Number(argv[(i += 1)]);
        } else {
            fail(`unknown argument: ${arg}`);
        }
    }
    if (!METRICS.includes(opts.metric)) {
        fail(`--metric must be one of ${METRICS.join(', ')}`);
    }
    if (!Number.isFinite(opts.limit) || !Number.isFinite(opts.maxPct)) {
        fail('--limit and --max-pct must be numbers');
    }
    return opts;
}

function fail(message) {
    process.stderr.write(`coverage-rank: ${message}\n`);
    process.exit(2);
}

function coveragePct(entry, metric) {
    const section = entry && entry[metric];
    const value = section && section.pct;
    return typeof value === 'number' ? value : 0;
}

function rank(summary, metric) {
    return Object.keys(summary)
        .filter((file) => file !== 'total')
        .map((file) => ({ file, pct: coveragePct(summary[file], metric) }))
        .sort((a, b) => a.pct - b.pct);
}

function relativize(file) {
    return path.relative(process.cwd(), file) || file;
}

function main(argv) {
    const opts = parseArgs(argv);

    let summary;
    try {
        summary = JSON.parse(fs.readFileSync(opts.summary, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            fail(
                `${opts.summary} not found. Generate it first with: ` +
                    'npx jest --coverage --coverageReporters=json-summary'
            );
        }
        fail(`could not read ${opts.summary}: ${error.message}`);
    }

    const rows = rank(summary, opts.metric).filter((row) => row.pct < opts.maxPct);
    const selected = opts.limit > 0 ? rows.slice(0, opts.limit) : rows;

    if (opts.json) {
        const payload = selected.map((row) => ({ file: relativize(row.file), pct: row.pct }));
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
    }
    for (const row of selected) {
        process.stdout.write(`${row.pct.toFixed(2).padStart(6)}  ${relativize(row.file)}\n`);
    }
}

main(process.argv.slice(2));
