#!/usr/bin/env node
/**
 * CLI dispatcher for the Infinite Systems photobook pipeline.
 * Enforces authority boundaries across inventory, validate, sync, optimize, layout, render, preview, proof, and preflight.
 */

import { fileURLToPath } from 'url';

export const SUBCOMMANDS = Object.freeze({
    inventory: './book/inventory.mjs',
    validate: './book/validate.mjs',
    plan: './book/sync.mjs',
    apply: './book/sync.mjs',
    orchestrate: './book/optimize.mjs',
    layout: './book/layout.mjs',
    render: './book/render.mjs',
    preview: './book/preview.mjs',
    proof: './book/proof.mjs',
    preflight: './book/preflight.mjs',
    repro: './book/preflight.mjs',
});

export function formatHelp() {
    return [
        'Usage: node scripts/book.mjs <subcommand> [options]',
        '',
        'Subcommands:',
        '  inventory    Scan p1..p6 index.md pool (127 photos) and classify bw/color',
        '  validate     Validate book/sequence.yaml against JSON Schema and invariants',
        '  plan         Diff inventory against book/sequence.yaml (read-only plan)',
        '  apply        Apply an approved plan ID (--plan <id>) to book/sequence.yaml',
        '  orchestrate  Generate seeded candidate proposals in .cache/book-runs/',
        '  layout       Compile approved ledger + profile into canonical layout IR',
        '  render       Render display and screen PDFs via Typst and QPDF',
        '  preview      Launch two-tier live preview and exact-PDF review service',
        '  proof        Rasterize PDF spreads and contact-sheet diffs via Poppler',
        '  preflight    Run structural, PPI, font, contrast, and veraPDF gates',
        '  repro        Run two-build reproducibility check in isolated temp dirs',
    ].join('\n');
}

export async function runCli(argv = process.argv.slice(2)) {
    const [cmd, ...rest] = argv;
    if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
        process.stdout.write(`${formatHelp()}\n`);
        return 0;
    }
    const targetModule = SUBCOMMANDS[cmd];
    if (!targetModule) {
        process.stderr.write(`Unknown book subcommand: ${cmd}\n${formatHelp()}\n`);
        return 1;
    }
    const mod = await import(targetModule);
    if (typeof mod.run === 'function') {
        return await mod.run(rest, { subcommand: cmd });
    }
    throw new Error(`Module ${targetModule} does not export a run() function.`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    runCli().then(
        (code) => {
            process.exitCode = code || 0;
        },
        (err) => {
            process.stderr.write(`${err?.stack || err}\n`);
            process.exitCode = 1;
        }
    );
}
