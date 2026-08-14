/**
 * Tests for scripts/check-thinking-comments.js (the thinking-check gate).
 *
 * The gate scans tracked sources — this file included — so sample violations
 * are assembled at runtime from pieces that never form a comment marker or an
 * it()/test() call in the source text. Python cases from the upstream suite
 * are out of scope: the gate scans JS/CSS only (see the script header).
 */

const {
    thinkingInComment,
    scanJsComments,
    scanJsEmptyTests,
    iterTrackedSources,
    findViolations,
} = require('../../scripts/check-thinking-comments.js');

// Marker/call builders: the pieces never form a scannable pattern in source.
const LC = '/' + '/'; // line-comment marker
const BC = '/' + '*'; // block-comment open
const BE = '*' + '/'; // block-comment close
const IT = 'i' + 't';
const TEST = 'te' + 'st';

const FLAGGED_COMMENTS = [
    'Wait, if core is empty',
    'wait! that breaks',
    'Ah, that explains it',
    'Hmm this is odd',
    'huh',
    'Oh wait, no',
    'oh no this cannot be',
    'Oops wrong branch',
    'Nope, try again',
    'Hold on, is this right',
    'Actually, just pass empty string',
    'How about a command in the trie',
    "Let's check `handleCommand`",
    "lets look at what's in the map",
    'Let me think about this',
    'To hit line 238, core must be empty',
    'blocks to reach line 746.', // mid-comment coverage note
];

const CLEAN_COMMENTS = [
    'Retry after the backoff interval',
    'wait for the DOM before binding', // "wait" without trailing punctuation is prose
    'It groups by table, so counting works',
    "Expands to 'due' via the switchShortcuts map",
    'Matches the legacy behaviour of upstream',
];

describe('check-thinking-comments', () => {
    describe('thinkingInComment', () => {
        test('flags thinking-out-loud openers', () => {
            for (const text of FLAGGED_COMMENTS) {
                expect(thinkingInComment(text)).toBe(true);
            }
        });

        test('does not flag factual comments', () => {
            for (const text of CLEAN_COMMENTS) {
                expect(thinkingInComment(text)).toBe(false);
            }
        });

        test('flags the measured fleet deliberation patterns', () => {
            // Fixtures assembled from pieces so the banned phrases never
            // appear whole in this file (the gate scans it too).
            const flagged = [
                'Let' + "'s assume the user provides an rgba string",
                'for simplicity let' + "'s rely on globalAlpha",
                'If we just use globalAlpha, it might' + ' be easier.',
                'This is' + ' tricky without a full color parser.',
            ];
            for (const text of flagged) {
                expect(thinkingInComment(text)).toBe(true);
            }
            const clean = ['Assume the API returns JSON', 'It lets the caller decide'];
            for (const text of clean) {
                expect(thinkingInComment(text)).toBe(false);
            }
        });
    });

    describe('scanJsComments', () => {
        test('flags a line comment with its line number', () => {
            const src = 'const x = 1;\n' + LC + ' Wait, is this right?\n';
            const hits = [...scanJsComments(src)];
            expect(hits).toEqual([{ lineno: 2, text: 'Wait, is this right?' }]);
        });

        test('flags block comments and their interior lines', () => {
            const src = [BC + ' Ah, now I see ' + BE, BC, ' * Hmm not sure', ' ' + BE].join('\n');
            const hits = [...scanJsComments(src)];
            expect(hits.map((h) => h.lineno)).toEqual([1, 3]);
        });

        test('does not treat a URL scheme as a comment', () => {
            const src = 'const u = "https://example.com/wait,x";\n';
            expect([...scanJsComments(src)]).toEqual([]);
        });

        test('does not flag a clean comment', () => {
            const src = LC + ' Retry after the backoff interval\n';
            expect([...scanJsComments(src)]).toEqual([]);
        });
    });

    describe('scanJsEmptyTests', () => {
        test('flags an empty arrow-function callback', () => {
            const src = IT + "('does nothing', () => {});\n";
            expect([...scanJsEmptyTests(src)]).toEqual([{ lineno: 1, title: 'does nothing' }]);
        });

        test('flags an empty function callback', () => {
            const src = TEST + '("nothing", function () {\n});\n';
            expect([...scanJsEmptyTests(src)]).toEqual([{ lineno: 1, title: 'nothing' }]);
        });

        test('flags a callback body of only comments', () => {
            const src = IT + "('planned', () => {\n  " + LC + ' cover the edge case later\n});\n';
            expect([...scanJsEmptyTests(src)]).toEqual([{ lineno: 1, title: 'planned' }]);
        });

        test('flags a multiline template-literal title with async', () => {
            const src = IT + '(`async\nnothing`, async () => {\n});\n';
            expect([...scanJsEmptyTests(src)]).toEqual([{ lineno: 1, title: 'async\nnothing' }]);
        });

        test('does not flag a real test', () => {
            const src = IT + "('works', () => { expect(true).toBe(true); });\n";
            expect([...scanJsEmptyTests(src)]).toEqual([]);
        });
    });

    describe('repo tree', () => {
        test('the tracked tree is clean', () => {
            // The gate is also exercised here so a violation fails the test
            // suite even when someone runs Jest without the make target.
            expect([...findViolations(iterTrackedSources())]).toEqual([]);
        });
    });

    describe('findViolations', () => {
        test('skips paths that no longer exist on disk instead of throwing', () => {
            const paths = ['this/file/does/not/exist.js'];
            expect([...findViolations(paths)]).toEqual([]);
        });
    });
});
