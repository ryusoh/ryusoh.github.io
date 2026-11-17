'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '../..');

function runEsmJson(code) {
    const script = `(async () => { ${code} })().then((v) => console.log(JSON.stringify(v)));`;
    const out = execFileSync('node', ['--input-type=module', '-e', script], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
    });
    return JSON.parse(out.trim());
}

describe('scripts/book/inventory.mjs', () => {
    let tmpRoot;

    beforeAll(async () => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'book-inv-'));
        const p98Dir = path.join(tmpRoot, 'assets', 'img', 'p98');
        fs.mkdirSync(p98Dir, { recursive: true });

        await sharp({
            create: { width: 300, height: 200, channels: 3, background: { r: 40, g: 40, b: 40 } },
        })
            .jpeg()
            .toFile(path.join(p98Dir, 'bw1.jpg'));

        await sharp({
            create: { width: 300, height: 200, channels: 3, background: { r: 68, g: 60, b: 60 } },
        })
            .jpeg()
            .toFile(path.join(p98Dir, 'tinted1.jpg'));

        await sharp({
            create: { width: 300, height: 200, channels: 3, background: { r: 220, g: 50, b: 30 } },
        })
            .jpeg()
            .toFile(path.join(p98Dir, 'color1.jpg'));

        await sharp({
            create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 200, b: 50 } },
        })
            .jpeg()
            .toFile(path.join(p98Dir, 'orphan.jpg'));

        fs.writeFileSync(
            path.join(p98Dir, 'index.md'),
            [
                '---',
                'title: "SYNTHETIC BOOK POOL"',
                '---',
                '',
                'bw1.jpg',
                '',
                '> A synthetic epigraph line',
                '> Second line',
                '',
                'tinted1.jpg',
                'color1.jpg',
            ].join('\n'),
            'utf8'
        );
    });

    afterAll(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    test('ingests only sequenced index.md photos, ignores orphans, and classifies bw vs color', () => {
        const res = runEsmJson(`
            const { collectPoolInventory } = await import('./scripts/book/inventory.mjs');
            return await collectPoolInventory({
                rootDir: ${JSON.stringify(tmpRoot)},
                seriesIds: ['p98'],
            });
        `);

        expect(res.totalAssets).toBe(3);
        expect(res.bwCount).toBe(2);
        expect(res.colorCount).toBe(1);
        expect(res.assets.map((a) => a.filename)).toEqual(['bw1.jpg', 'tinted1.jpg', 'color1.jpg']);
        expect(res.assets[0].modality).toBe('bw');
        expect(res.assets[1].modality).toBe('bw');
        expect(res.assets[1].derivativeRecipe).toBe('neutralize-grayscale-2048');
        expect(res.assets[2].modality).toBe('color');
        expect(res.fragments).toHaveLength(1);
        expect(res.fragments[0].sourceRange).toEqual({ startLine: 7, endLine: 8 });
    });
});
