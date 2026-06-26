const path = require('path');
const { execFileSync } = require('child_process');

const { parseArgs, coveragePct, rank, relativize } = require('../../scripts/coverage-rank.js');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'coverage-rank.js');

// Mimics a Jest json-summary report: a "total" row plus per-file entries.
const SUMMARY = {
    total: { lines: { pct: 80 } },
    'js/perfect.js': { lines: { pct: 100 }, branches: { pct: 100 } },
    'js/worst.js': { lines: { pct: 12.5 }, branches: { pct: 40 } },
    'js/middle.js': { lines: { pct: 75 }, branches: { pct: 10 } },
};

describe('coverage-rank', () => {
    describe('coveragePct', () => {
        test('reads the metric percent', () => {
            expect(coveragePct({ lines: { pct: 42.5 } }, 'lines')).toBe(42.5);
        });

        test('falls back to 0 when the metric or pct is absent', () => {
            expect(coveragePct({}, 'lines')).toBe(0);
            expect(coveragePct(null, 'lines')).toBe(0);
            expect(coveragePct({ lines: {} }, 'lines')).toBe(0);
        });
    });

    describe('rank', () => {
        test('sorts ascending and drops the total row', () => {
            const ranked = rank(SUMMARY, 'lines');
            expect(ranked.map((r) => r.file)).toEqual([
                'js/worst.js',
                'js/middle.js',
                'js/perfect.js',
            ]);
            expect(ranked.find((r) => r.file === 'total')).toBeUndefined();
        });

        test('ranks by the requested metric', () => {
            const ranked = rank(SUMMARY, 'branches');
            expect(ranked[0].file).toBe('js/middle.js');
        });
    });

    describe('parseArgs', () => {
        test('defaults', () => {
            expect(parseArgs([])).toMatchObject({
                metric: 'lines',
                limit: 5,
                maxPct: 100,
                json: false,
            });
        });

        test('parses flags', () => {
            const opts = parseArgs([
                '--limit',
                '3',
                '--metric',
                'branches',
                '--max-pct',
                '90',
                '--json',
            ]);
            expect(opts).toMatchObject({ limit: 3, metric: 'branches', maxPct: 90, json: true });
        });
    });

    describe('relativize', () => {
        test('returns a path relative to cwd', () => {
            expect(path.isAbsolute(relativize(path.join(process.cwd(), 'js/a.js')))).toBe(false);
        });
    });

    describe('CLI', () => {
        const run = (args) =>
            execFileSync('node', [SCRIPT, '--summary', '-', ...args], {
                input: JSON.stringify(SUMMARY),
                encoding: 'utf8',
            });

        // The script reads from a file path; feed it a temp file via a fixture summary.
        test('JSON output skips 100% files and respects --limit', () => {
            const fixture = path.join(__dirname, '__fixtures__coverage-summary.json');
            require('fs').writeFileSync(fixture, JSON.stringify(SUMMARY));
            try {
                const out = execFileSync(
                    'node',
                    [SCRIPT, '--summary', fixture, '--limit', '1', '--json'],
                    {
                        encoding: 'utf8',
                    }
                );
                const parsed = JSON.parse(out);
                expect(parsed).toEqual([{ file: 'js/worst.js', pct: 12.5 }]);
            } finally {
                require('fs').unlinkSync(fixture);
            }
        });

        test('exits 2 with a helpful message when the summary is missing', () => {
            let code = 0;
            let stderr = '';
            try {
                execFileSync('node', [SCRIPT, '--summary', 'does-not-exist.json'], {
                    encoding: 'utf8',
                });
            } catch (error) {
                code = error.status;
                stderr = String(error.stderr);
            }
            expect(code).toBe(2);
            expect(stderr).toContain('not found');
        });

        test('unknown flag fails loudly', () => {
            let code = 0;
            try {
                run(['--bogus']);
            } catch (error) {
                code = error.status;
            }
            expect(code).toBe(2);
        });
    });
});
