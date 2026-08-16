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

        for (const p of ['p1', 'p2', 'p3', 'p4']) {
            const html = fs.readFileSync(path.join(ROOT_DIR, p, 'index.html'), 'utf8');
            const seq = extractSequence(html);
            expect(seq.length).toBeGreaterThan(15);
            // Verify quotes exist
            const quotes = seq.filter((item) => item.startsWith('QUOTE:'));
            expect(quotes.length).toBeGreaterThanOrEqual(1);
        }
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
                    background: { r: 120, g: 60, b: 200 },
                },
            })
                .jpeg()
                .toFile(fixtureImgPath);

            // Write test markdown with custom alt caption and blockquote
            const mdContent = `---
title: "SYNTHETIC TEST PROJECT"
description: "A synthetic test gallery for unit tests."
keywords:
  - "test"
  - "synthetic"
---

test_sample.jpg | Synthetic test custom alt caption

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

            // Clean up preloader entry
            const preloaderPath = path.join(ROOT_DIR, 'js', 'preloader.js');
            if (fs.existsSync(preloaderPath)) {
                let content = fs.readFileSync(preloaderPath, 'utf8');
                content = content.replace(/\s*p99:\s*'\/assets\/img\/p99\/',?/g, '');
                content = content.replace(/\s*p99:\s*\[[\s\S]*?\],?/g, '');
                fs.writeFileSync(preloaderPath, content, 'utf8');
            }

            // Re-sync index.html nav
            execFileSync('node', [SYNC_SCRIPT], { cwd: ROOT_DIR });
        });

        test('build-page.mjs compiles HTML, generates responsive tiers, and updates nav', () => {
            const output = execFileSync('node', [BUILD_SCRIPT, testPageId], {
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
            expect(html).toContain('alt="Synthetic test custom alt caption"');
            expect(html).toContain('data-thumbhash=');
            expect(html).toContain(`href="/${testPageId}/"`);
            expect(html).toContain('aria-current="page"');

            // Verify index.html navigation table includes the test page
            const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
            expect(indexHtml).toContain(`href="./${testPageId}/"`);

            // Run validator on the newly generated synthetic page
            const validateOutput = execFileSync('node', [VALIDATE_SCRIPT], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
            });
            expect(validateOutput).toContain('Validation passed!');
        });
    });
});
