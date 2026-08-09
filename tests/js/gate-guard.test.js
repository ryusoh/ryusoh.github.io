'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { main, worktreeFingerprint } = require('../../scripts/gate-guard.js');

function git(repo, args) {
    execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
}

/** Create a git repo with one committed tracked file; return its path. */
function makeRepo() {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-guard-'));
    git(repo, ['init']);
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'v1\n');
    git(repo, ['add', 'tracked.txt']);
    git(repo, [
        '-c',
        'user.email=test@example.com',
        '-c',
        'user.name=Test',
        'commit',
        '-m',
        'init',
    ]);
    return repo;
}

describe('gate-guard worktreeFingerprint', () => {
    let repo;

    beforeEach(() => {
        repo = makeRepo();
    });

    afterEach(() => {
        fs.rmSync(repo, { recursive: true, force: true });
    });

    it('is stable when the tree is unchanged', () => {
        expect(worktreeFingerprint(repo)).toBe(worktreeFingerprint(repo));
    });

    it('changes on a tracked edit', () => {
        const before = worktreeFingerprint(repo);
        fs.writeFileSync(path.join(repo, 'tracked.txt'), 'v2\n');
        expect(worktreeFingerprint(repo)).not.toBe(before);
    });

    it('changes on a staged edit', () => {
        const before = worktreeFingerprint(repo);
        fs.writeFileSync(path.join(repo, 'tracked.txt'), 'v2\n');
        git(repo, ['add', 'tracked.txt']);
        expect(worktreeFingerprint(repo)).not.toBe(before);
    });

    it('changes on a new untracked file', () => {
        const before = worktreeFingerprint(repo);
        fs.writeFileSync(path.join(repo, 'new.js'), 'const x = 1;\n');
        expect(worktreeFingerprint(repo)).not.toBe(before);
    });

    it('changes when untracked content is edited', () => {
        fs.writeFileSync(path.join(repo, 'new.js'), 'const x = 1;\n');
        const before = worktreeFingerprint(repo);
        fs.writeFileSync(path.join(repo, 'new.js'), 'const x = 2;\n');
        expect(worktreeFingerprint(repo)).not.toBe(before);
    });

    it('ignores excluded files', () => {
        fs.writeFileSync(path.join(repo, '.gitignore'), 'ignored/\n');
        const before = worktreeFingerprint(repo);
        fs.mkdirSync(path.join(repo, 'ignored'));
        fs.writeFileSync(path.join(repo, 'ignored', 'junk.txt'), 'junk\n');
        expect(worktreeFingerprint(repo)).toBe(before);
    });
});

describe('gate-guard main', () => {
    let repo;
    let logSpy;
    let errorSpy;

    beforeEach(() => {
        repo = makeRepo();
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(repo, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    it('snapshot prints the fingerprint', () => {
        expect(main(['snapshot', '--repo', repo])).toBe(0);
        expect(logSpy).toHaveBeenCalledWith(worktreeFingerprint(repo));
    });

    it('check exits 1 when the tree is unchanged', () => {
        const snap = worktreeFingerprint(repo);
        expect(main(['check', snap, '--repo', repo])).toBe(1);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('edit something before rerunning the gate')
        );
    });

    it('check exits 0 when the tree changed', () => {
        const snap = worktreeFingerprint(repo);
        fs.writeFileSync(path.join(repo, 'tracked.txt'), 'v2\n');
        expect(main(['check', snap, '--repo', repo])).toBe(0);
    });

    it('reports bad usage with exit 2', () => {
        expect(main([])).toBe(2);
        expect(main(['check', '--repo', repo])).toBe(2);
        expect(main(['bogus'])).toBe(2);
    });

    it('reports a git failure outside a repo with exit 2', () => {
        const nowhere = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-guard-nowhere-'));
        try {
            expect(main(['snapshot', '--repo', nowhere])).toBe(2);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('git failed'));
        } finally {
            fs.rmSync(nowhere, { recursive: true, force: true });
        }
    });
});
