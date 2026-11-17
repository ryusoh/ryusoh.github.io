'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Buffer } = require('buffer');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '../..');

function runEsm(code) {
    const script = `(async () => { ${code} })().then((v) => console.log(JSON.stringify(v)));`;
    return JSON.parse(
        execFileSync('node', ['--input-type=module', '-e', script], {
            cwd: ROOT_DIR,
            encoding: 'utf8',
        }).trim()
    );
}

describe('scripts/book/assets.mjs', () => {
    let tmpDir;
    let srcBuf;
    let srcHash;

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-assets-'));
        const imgDir = path.join(tmpDir, 'assets', 'img', 'p1');
        fs.mkdirSync(imgDir, { recursive: true });
        const imgPath = path.join(imgDir, 'sample.jpg');
        await sharp({
            create: {
                width: 400,
                height: 266,
                channels: 3,
                background: { r: 90, g: 82, b: 82 },
            },
        })
            .jpeg()
            .toFile(imgPath);
        srcBuf = fs.readFileSync(imgPath);
        srcHash = crypto.createHash('sha256').update(srcBuf).digest('hex');
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('passthroughs <=2048px display assets and converts screen B&W assets to 1-channel grayscale without mutating source', () => {
        const res = runEsm(`
            const { ensureBookDerivative } = await import('./scripts/book/assets.mjs');
            const asset = {
                assetId: 'p1-sample',
                source: 'assets/img/p1/sample.jpg',
                sourceSha256: ${JSON.stringify(srcHash)},
                modality: 'bw',
                derivativeRecipe: 'passthrough-or-downsample-2048',
            };
            const rootDir = ${JSON.stringify(tmpDir)};
            const disp = await ensureBookDerivative(asset, { profileId: 'display' }, { rootDir });
            const scr = await ensureBookDerivative(asset, { profileId: 'screen' }, { rootDir });
            return { disp, scr };
        `);

        expect(res.disp.action).toBe('passthrough-dct');
        expect(res.scr.action).toBe('device-gray-1ch-q84');
        expect(res.scr.channels).toBe(1);
        const afterBuf = fs.readFileSync(path.join(tmpDir, 'assets', 'img', 'p1', 'sample.jpg'));
        expect(Buffer.compare(srcBuf, afterBuf)).toBe(0);
    });
});
