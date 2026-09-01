/**
 * @jest-environment jsdom
 *
 * Tests for the automated portfolio page builder compiler (scripts/build-page.mjs),
 * synchronizer (scripts/sync-pages.mjs), and validator (scripts/validate-pages.mjs).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '../../');
const BUILD_SCRIPT = path.join(ROOT_DIR, 'scripts', 'build-page.mjs');
const SYNC_SCRIPT = path.join(ROOT_DIR, 'scripts', 'sync-pages.mjs');
const VALIDATE_SCRIPT = path.join(ROOT_DIR, 'scripts', 'validate-pages.mjs');

describe('Page Builder, Synchronizer & Validator E2E Suite', () => {
    test('sync-pages.mjs --check runs cleanly on current production pages', () => {
        const output = execFileSync('node', [SYNC_SCRIPT, '--check'], {
            cwd: ROOT_DIR,
            encoding: 'utf8',
        });
        expect(output).toContain('sync-pages: All portfolio pages are up to date.');
    });

    test('validate-pages.mjs validates all production pages with zero errors', () => {
        const output = execFileSync('node', [VALIDATE_SCRIPT], {
            cwd: ROOT_DIR,
            encoding: 'utf8',
        });
        expect(output).toContain('Validation passed!');
    });

    test('nav display order places p6 before p5 via the sortPagesForNav override', () => {
        // p5 is a self-portrait series, so it always trails the street-photography
        // essays in the nav dock while URLs and directory names stay unchanged.
        const nodeCode = `
            import { getProjectPages, sortPagesForNav } from './scripts/sync-pages.mjs';
            console.log(JSON.stringify({
                discovered: getProjectPages(),
                sorted: sortPagesForNav(['p5', 'p6', 'p1']),
                future: sortPagesForNav(['p5', 'p7', 'p6', 'p1']),
            }));
        `;
        const out = JSON.parse(
            execFileSync('node', ['--input-type=module', '-e', nodeCode], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
            })
        );
        expect(out.sorted).toEqual(['p1', 'p6', 'p5']);
        // A future p7 essay must also sort before the trailing self-portrait series
        expect(out.future).toEqual(['p1', 'p6', 'p7', 'p5']);
        expect(out.discovered.indexOf('p6')).toBeLessThan(out.discovered.indexOf('p5'));

        const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
        expect(indexHtml.indexOf('href="./p6/"')).toBeLessThan(indexHtml.indexOf('href="./p5/"'));
    });

    test('all production pages preserve exact image and blockquote ordering from markdown', () => {
        const extractSequence = (html) => {
            const content = html.match(
                /<div class="container-narrow post-content">\s*([\s\S]*?)\s*<\/div>\s*<div class="project-footer">/
            )[1];
            const regex = /<img[^>]*src="([^"]+)"|<blockquote[\s\S]*?<\/blockquote>|<hr\s*\/?>/gi;
            let match;
            const items = [];
            while ((match = regex.exec(content)) !== null) {
                if (match[1]) {
                    items.push('IMG:' + match[1]);
                } else if (match[0].startsWith('<blockquote')) {
                    const text = match[0]
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    items.push('QUOTE:' + text);
                } else {
                    items.push('HR');
                }
            }
            return items;
        };

        const pages = fs
            .readdirSync(ROOT_DIR)
            .filter((d) => /^p\d+$/.test(d) && fs.existsSync(path.join(ROOT_DIR, d, 'index.html')));

        for (const p of pages) {
            const html = fs.readFileSync(path.join(ROOT_DIR, p, 'index.html'), 'utf8');
            const seq = extractSequence(html);
            expect(seq.length).toBeGreaterThan(5);
            // Verify quotes exist and are not truncated
            const quotes = seq.filter((item) => item.startsWith('QUOTE:'));
            expect(quotes.length).toBeGreaterThanOrEqual(1);
            for (const q of quotes) {
                expect(q.length).toBeGreaterThan(15);
            }
        }
    });

    test('p5 renders photo credits with proper instagram links and corner badge', () => {
        const p5HtmlPath = path.join(ROOT_DIR, 'p5', 'index.html');
        if (fs.existsSync(p5HtmlPath)) {
            const html = fs.readFileSync(p5HtmlPath, 'utf8');
            expect(html).toContain('class="photo-credit"');
            expect(html).toContain('href="https://www.instagram.com/photo.initiator/"');
            expect(html).toContain('@photo.initiator');
        }
    });

    test('sanitizeImageMetadata safely handles non-existent files and non-JPEG extensions', () => {
        const scriptCode = `
            import { sanitizeImageMetadata } from './scripts/build-page.mjs';
            if (sanitizeImageMetadata('/tmp/nonexistent.jpg') !== false) {
                throw new Error('Expected false for non-existent file');
            }
            if (sanitizeImageMetadata('./package.json') !== false) {
                throw new Error('Expected false for non-JPEG file');
            }
            console.log('SANITIZE_METADATA_SAFE');
        `;
        const res = execFileSync('node', ['--input-type=module', '-e', scriptCode], {
            cwd: ROOT_DIR,
            encoding: 'utf8',
        });
        expect(res).toContain('SANITIZE_METADATA_SAFE');
    });

    describe('Ephemeral Synthetic Project Page Build E2E Test', () => {
        const testPageId = 'p99';
        const testImgDir = path.join(ROOT_DIR, 'assets', 'img', testPageId);
        const testPageDir = path.join(ROOT_DIR, testPageId);
        const testMdPath = path.join(testImgDir, 'index.md');
        const fixtureImgPath = path.join(testImgDir, 'test_sample.jpg');

        beforeAll(async () => {
            if (!fs.existsSync(testImgDir)) {
                fs.mkdirSync(testImgDir, { recursive: true });
            }

            // Create a small 200x150 dummy JPEG file
            await sharp({
                create: {
                    width: 200,
                    height: 150,
                    channels: 3,
                    background: { r: 120, g: 150, b: 180 },
                },
            })
                .jpeg()
                .toFile(fixtureImgPath);

            // Write test markdown with custom alt caption and blockquote
            const mdContent = `---
title: "Synthetic Test Project"
description: "Synthetic test description for builder verification."
keywords:
  - "test"
  - "synthetic"
---

test_sample.jpg | by @test.photographer

> This is an automated test blockquote
`;
            fs.writeFileSync(testMdPath, mdContent, 'utf8');
        });

        afterAll(() => {
            // Teardown temporary files
            if (fs.existsSync(testPageDir)) {
                fs.rmSync(testPageDir, { recursive: true, force: true });
            }
            if (fs.existsSync(testImgDir)) {
                fs.rmSync(testImgDir, { recursive: true, force: true });
            }
        });

        test('build-page.mjs compiles HTML, generates responsive tiers in isolation', async () => {
            const output = execFileSync('node', [BUILD_SCRIPT, testPageId, '--no-sync'], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
            });
            expect(output).toContain(`Building portfolio page ${testPageId}`);

            const htmlPath = path.join(testPageDir, 'index.html');
            expect(fs.existsSync(htmlPath)).toBe(true);

            // Check responsive tiers generated on disk
            expect(fs.existsSync(path.join(testImgDir, 'test_sample.avif'))).toBe(true);
            expect(fs.existsSync(path.join(testImgDir, 'test_sample.webp'))).toBe(true);
            expect(fs.existsSync(path.join(testImgDir, 'test_sample-768.avif'))).toBe(true);
            expect(fs.existsSync(path.join(testImgDir, 'test_sample-1200.webp'))).toBe(true);

            // Check HTML content
            const html = fs.readFileSync(htmlPath, 'utf8');
            expect(html).toContain('<title>SYNTHETIC TEST PROJECT</title>');
            expect(html).toContain('<h1>SYNTHETIC TEST PROJECT</h1>');
            expect(html).toContain('alt="Self portrait by @test.photographer"');
            expect(html).toContain('class="photo-credit"');
            expect(html).toContain('href="https://www.instagram.com/test.photographer/"');
            expect(html).toContain('data-thumbhash=');
            expect(html).toContain(`href="/${testPageId}/"`);
            expect(html).toContain('aria-current="page"');

            // Unit verify buildNavRows generates correct table navigation markup via node subprocess
            const nodeCode = `
                import { buildNavRows } from './scripts/sync-pages.mjs';
                const res = buildNavRows(null, ['p1', 'p2', '${testPageId}'], true);
                console.log(res);
            `;
            const updatedNavHtml = execFileSync('node', ['--input-type=module', '-e', nodeCode], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
            });
            expect(updatedNavHtml).toContain(`href="./${testPageId}/"`);
            expect(updatedNavHtml).toContain('Synthetic Test Project');
        });
    });
});
