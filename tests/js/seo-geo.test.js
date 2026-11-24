/**
 * @jest-environment jsdom
 *
 * Tests for SEO and GEO (Generative Engine Optimization) infrastructure:
 * Schema.org @graph entity disambiguation, commentary alt-text hydration,
 * CJK blockquote locale tagging, Google Image Sitemap, robots.txt scoping,
 * and deterministic llms.txt / llms-full.txt manifests.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '../../');
const SITE_ORIGIN = 'https://www.lyeutsaon.com';
const PERSON_ID = `${SITE_ORIGIN}/#person`;

function parseJsonLd(html) {
    const match = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    expect(match).not.toBeNull();
    return JSON.parse(match[1]);
}

function getActiveProjectIds() {
    return fs
        .readdirSync(ROOT_DIR, { withFileTypes: true })
        .filter(
            (d) =>
                d.isDirectory() &&
                /^p\d+$/i.test(d.name) &&
                !['p98', 'p99'].includes(d.name.toLowerCase()) &&
                fs.existsSync(path.join(ROOT_DIR, d.name, 'index.html'))
        )
        .map((d) => d.name);
}

describe('SEO & GEO Site Infrastructure', () => {
    test('index.html defines a valid @graph with disambiguated Person, WebSite, CollectionPage, and existing portrait asset', () => {
        const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
        const ld = parseJsonLd(indexHtml);
        expect(Array.isArray(ld['@graph'])).toBe(true);

        const person = ld['@graph'].find((n) => n['@type'] === 'Person');
        const website = ld['@graph'].find((n) => n['@type'] === 'WebSite');
        const collection = ld['@graph'].find((n) => n['@type'] === 'CollectionPage');

        expect(person).toBeDefined();
        expect(person['@id']).toBe(PERSON_ID);
        expect(person.identifier).toBe('lyeutsaon');
        expect(person.alternateName).toContain('lyeutsaon');
        expect(person.disambiguatingDescription).toMatch(/San Francisco Bay Area/);
        expect(person.disambiguatingDescription).toMatch(/lyeutsaon\.com/);

        // Regression guard: Person image URL must resolve to an actual file on disk (no 404 avatar)
        const portraitRel = person.image.contentUrl.replace(`${SITE_ORIGIN}/`, '');
        expect(fs.existsSync(path.join(ROOT_DIR, portraitRel))).toBe(true);

        expect(website).toBeDefined();
        expect(website.creator).toEqual({ '@id': PERSON_ID });
        expect(collection).toBeDefined();
        expect(collection.hasPart.length).toBeGreaterThanOrEqual(1);
    });

    test('about/index.html provides a single-h1 ProfilePage aligned with visible disambiguation prose', () => {
        const aboutPath = path.join(ROOT_DIR, 'about', 'index.html');
        expect(fs.existsSync(aboutPath)).toBe(true);

        const aboutHtml = fs.readFileSync(aboutPath, 'utf8');
        document.documentElement.innerHTML = aboutHtml;

        expect(document.querySelectorAll('h1')).toHaveLength(1);
        expect(document.querySelectorAll('h2').length).toBeGreaterThanOrEqual(3);

        const bodyText = document.body.textContent;
        expect(bodyText).toContain('lyeutsaon');
        expect(bodyText).toContain('San Francisco Bay Area');
        expect(bodyText).toContain('Los Angeles');
        expect(bodyText).toContain('Shanghai');
        expect(bodyText).not.toContain('hotsauceliuliu');

        const aboutCss = fs.readFileSync(path.join(ROOT_DIR, 'css', 'about.css'), 'utf8');
        expect(aboutCss).toContain("'Syne'");
        expect(aboutCss).not.toMatch(/font-family:\s*'Helvetica Neue'/);

        const ld = parseJsonLd(aboutHtml);
        const profilePage = ld['@graph'].find((n) => n['@type'] === 'ProfilePage');
        expect(profilePage).toBeDefined();
        expect(profilePage.mainEntity).toEqual({ '@id': PERSON_ID });
    });

    test('all active gallery pages emit absolute OG images, ImageGallery JSON-LD, and hydrated commentary alt text', () => {
        const pages = getActiveProjectIds();
        expect(pages.length).toBeGreaterThan(0);

        for (const page of pages) {
            const html = fs.readFileSync(path.join(ROOT_DIR, page, 'index.html'), 'utf8');
            const ogImg = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
            const twImg = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);

            expect(ogImg).not.toBeNull();
            expect(ogImg[1].startsWith(`${SITE_ORIGIN}/assets/img/`)).toBe(true);
            expect(twImg).not.toBeNull();
            expect(twImg[1]).toBe(ogImg[1]);

            const ld = parseJsonLd(html);
            const gallery = ld['@graph'].find((n) => n['@type'] === 'ImageGallery');
            const breadcrumb = ld['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
            expect(gallery).toBeDefined();
            expect(breadcrumb).toBeDefined();
            expect(gallery.author).toEqual({ '@id': PERSON_ID });
            expect(gallery.associatedMedia.length).toBeGreaterThan(0);

            const commPath = path.join(ROOT_DIR, 'assets', 'img', page, 'commentary.json');
            if (fs.existsSync(commPath)) {
                expect(html).not.toContain('alt="Street photography by Zhuang Liu"');
            }
        }
    });

    test('sitemap.xml includes Google Image Sitemap namespace, /about/, and escaped image captions', () => {
        const sitemap = fs.readFileSync(path.join(ROOT_DIR, 'sitemap.xml'), 'utf8');
        expect(sitemap).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
        expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
        expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/about/</loc>`);
        expect(sitemap).toContain('<image:image>');
        expect(sitemap).toContain('<image:loc>');
        expect(sitemap).toContain('<image:caption>');
        expect(sitemap).not.toContain('&amp;quot;');
    });

    test('llms.txt, llms-full.txt, and robots.txt scope crawlers to public portfolio content', () => {
        const llms = fs.readFileSync(path.join(ROOT_DIR, 'llms.txt'), 'utf8');
        const llmsFull = fs.readFileSync(path.join(ROOT_DIR, 'llms-full.txt'), 'utf8');
        const robots = fs.readFileSync(path.join(ROOT_DIR, 'robots.txt'), 'utf8');

        expect(llms).toContain('# Zhuang Liu (lyeutsaon)');
        expect(llms).toContain('San Francisco Bay Area');
        expect(llms).toContain('Shanghai');
        expect(llms).not.toContain('hotsauceliuliu');
        expect(llmsFull).toContain('# Complete Series & Plate Catalog');

        for (const page of getActiveProjectIds()) {
            expect(llms).toContain(`${SITE_ORIGIN}/${page}/`);
            expect(llmsFull).toContain(`${SITE_ORIGIN}/${page}/`);
        }

        expect(robots).toContain('Allow: /llms.txt');
        expect(robots).toContain('Disallow: /docs/');
        expect(robots).toContain('Disallow: /tests/');
        expect(robots).toContain('Disallow: /assets/img/p99/');
        expect(robots).toContain('User-agent: Google-Extended');
        expect(robots).toContain('User-agent: OAI-SearchBot');
    });

    test('scripts/seo.mjs unit helpers handle commentary hydration, CJK lang tagging, and multiline photo credits', () => {
        const nodeScript = `
            import {
                hydratePostContentSeo,
                extractGalleryImagesFromHtml,
                buildProjectStructuredDataScript,
            } from './scripts/seo.mjs';

            const sampleHtml = \`
                <div align="center" class="image-container">
                    <div class="image-wrapper">
                        <picture>
                            <img src="/assets/img/p99/frame1.jpg" alt="Self portrait by @guest_lens" width="1200" height="800" />
                        </picture>
                        <span class="photo-credit"
                            >by <a href="https://www.instagram.com/guest_lens/">@guest_lens</a></span
                        >
                    </div>
                </div>
                <div align="center">
                    <picture>
                        <img src="/assets/img/p99/frame2.jpg" alt="Street photography by Zhuang Liu" width="1600" height="1067" />
                    </picture>
                </div>
                <blockquote><p>他的臉朝向過去</p></blockquote>
            \`;

            const hydrated = hydratePostContentSeo(sampleHtml, {
                'frame2.jpg': { subject: 'Fog over "Market" & Sutro' },
            });
            const images = extractGalleryImagesFromHtml(hydrated);
            const ldScript = buildProjectStructuredDataScript('p99', {
                navLabel: 'Synthetic Gallery',
                heading: 'SYNTHETIC GALLERY',
                description: 'Synthetic description',
                canonical: 'https://www.lyeutsaon.com/p99/',
                ogImage: 'https://www.lyeutsaon.com/assets/img/p99/frame1.jpg',
                postContent: hydrated,
            });
            console.log(JSON.stringify({ hydrated, images, ldScript }));
        `;

        const out = JSON.parse(
            execFileSync('node', ['--input-type=module', '-e', nodeScript], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
            })
        );

        expect(out.hydrated).toContain('alt="Fog over &quot;Market&quot; &amp; Sutro"');
        expect(out.hydrated).toContain('<blockquote lang="zh-Hant">');
        expect(out.images).toHaveLength(2);
        expect(out.images[0].creditHandle).toBe('guest_lens');
        expect(out.images[1].alt).toBe('Fog over "Market" & Sutro');
        const parsedLd = parseJsonLd(out.ldScript);
        const synGallery = parsedLd['@graph'].find((n) => n['@type'] === 'ImageGallery');
        expect(synGallery.inLanguage).toEqual(['en', 'zh-Hant']);
        expect(out.ldScript).toContain('Photo by @guest_lens');
    });
});
