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
            expect(html).toContain('alt="Self portrait by @test.photographer"');
            expect(html).toContain('class="photo-credit"');
            expect(html).toContain('href="https://www.instagram.com/test.photographer/"');
            expect(html).toContain('data-thumbhash=');
            expect(html).toContain(`href="/${testPageId}/"`);
            expect(html).toContain('aria-current="page"');

            // Verify index.html navigation table includes the test page
            const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
            expect(indexHtml).toContain(`href="./${testPageId}/"`);

            // Verify sibling portfolio pages (e.g. p1) have their navigation dock updated
            const p1Html = fs.readFileSync(path.join(ROOT_DIR, 'p1', 'index.html'), 'utf8');
            expect(p1Html).toContain(`href="/${testPageId}/"`);

            // Verify sitemap.xml includes the newly generated page
            const sitemapXml = fs.readFileSync(path.join(ROOT_DIR, 'sitemap.xml'), 'utf8');
            expect(sitemapXml).toContain(`https://www.lyeutsaon.com/${testPageId}/`);

            // Run validator on the newly generated synthetic page
            const validateOutput = execFileSync('node', [VALIDATE_SCRIPT], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
            });
            expect(validateOutput).toContain('Validation passed!');
        });
    });
});
