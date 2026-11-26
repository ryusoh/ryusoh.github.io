import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { load as yamlLoad } from 'js-yaml';
import prettier from 'prettier';
import {
    SITE_ORIGIN,
    DEFAULT_OG_IMAGE,
    DEFAULT_OG_WIDTH,
    DEFAULT_OG_HEIGHT,
    GENERIC_IMAGE_ALT,
    isNoindexHtml,
    escapeHtmlAttr,
    loadCommentaryMap,
    hydratePostContentSeo,
    toAbsoluteSiteUrl,
    extractGalleryImagesFromHtml,
    buildHomeJsonLd,
    buildAboutJsonLd,
    buildProjectStructuredDataScript,
    buildImageSitemapXml,
    buildLlmsTxt,
    buildLlmsFullTxt,
    serializeJsonLd,
} from './seo.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT_DIR, 'scripts', 'templates', 'portfolio-shell.html');

const BASE_KEYWORDS = [
    'Zhuang Liu',
    'Zhuang Liu photographer',
    'Zhuang Liu photography',
    'street photography',
];

/**
 * Nav display-order overrides: a page id maps to the sort position it should
 * occupy instead of its directory number. p5 is a self-portrait series rather
 * than a street-photography essay, so it always trails the numbered essays in
 * the nav dock — any future pN automatically sorts before it.
 * URLs and directory names are unaffected.
 */
const NAV_ORDER_OVERRIDES = { p5: Number.MAX_SAFE_INTEGER };

/**
 * Sorts page ids into nav display order (numeric, with NAV_ORDER_OVERRIDES applied).
 * @param {string[]} pages
 * @returns {string[]}
 */
export function sortPagesForNav(pages) {
    const orderKey = (p) => {
        const id = p.toLowerCase();
        return NAV_ORDER_OVERRIDES[id] ?? parseInt(id.slice(1), 10);
    };
    return [...pages].sort((a, b) => orderKey(a) - orderKey(b));
}

/**
 * Discovers all active project pages in the root directory.
 * @returns {string[]} e.g. ['p1', 'p2', 'p3', 'p4']
 */
export function getProjectPages() {
    const pages = fs
        .readdirSync(ROOT_DIR, { withFileTypes: true })
        .filter(
            (d) =>
                d.isDirectory() &&
                /^p\d+$/i.test(d.name) &&
                fs.existsSync(path.join(ROOT_DIR, d.name, 'index.html'))
        )
        .map((d) => d.name);
    return sortPagesForNav(pages);
}

/**
 * Reads frontmatter object from assets/img/<page>/index.md or <page>/index.md if present.
 * @param {string} page
 * @returns {Record<string, any>}
 */
function loadPageFrontmatter(page) {
    const mdPaths = [
        path.join(ROOT_DIR, 'assets', 'img', page, 'index.md'),
        path.join(ROOT_DIR, page, 'index.md'),
    ];
    for (const mdPath of mdPaths) {
        if (!fs.existsSync(mdPath)) {
            continue;
        }
        const rawContent = fs.readFileSync(mdPath, 'utf8');
        const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        if (fmMatch) {
            try {
                return yamlLoad(fmMatch[1]) || {};
            } catch {
                return {};
            }
        }
    }
    return {};
}

/**
 * Extracts project title/nav label from index.md or index.html.
 * @param {string} page e.g. 'p1'
 * @returns {string} Project nav label
 */
export function getProjectTitle(page) {
    const mdPaths = [
        path.join(ROOT_DIR, 'assets', 'img', page, 'index.md'),
        path.join(ROOT_DIR, page, 'index.md'),
    ];
    for (const mdPath of mdPaths) {
        if (fs.existsSync(mdPath)) {
            const content = fs.readFileSync(mdPath, 'utf8');
            const match = content.match(/^title:\s*["']?(.*?)["']?$/m);
            if (match && match[1].trim()) {
                return match[1].trim();
            }
            const firstLine = content.split('\n')[0].trim();
            if (firstLine && !firstLine.startsWith('---')) {
                return firstLine;
            }
        }
    }

    const htmlPath = path.join(ROOT_DIR, page, 'index.html');
    if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const headingMatch = html.match(/<div class="post-heading">\s*<h1>(.*?)<\/h1>/s);
        if (headingMatch && headingMatch[1].trim()) {
            return headingMatch[1].trim();
        }
    }

    return page.toUpperCase();
}

/**
 * Standard project titles map for nice sentence/title case nav labels
 */
export function getNavLabel(page, rawTitle) {
    const knownLabels = {
        p1: 'I Tear Up the Bay When I Come Through',
        p2: 'I Do Not Care If We Go Down in History as Barbarians',
        p3: 'Aerobatic Activities',
        p4: 'Das Gespenst',
    };
    if (knownLabels[page.toLowerCase()]) {
        return knownLabels[page.toLowerCase()];
    }

    if (rawTitle && rawTitle === rawTitle.toUpperCase()) {
        return rawTitle
            .toLowerCase()
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
    return rawTitle || page.toUpperCase();
}

/**
 * Builds the <table id="nav"> tbody content for a given active page.
 * @param {string | null} activePage e.g. 'p1', or null for index.html / about
 * @param {string[]} pages
 * @param {boolean} isRoot whether this is index.html
 * @returns {string}
 */
export function buildNavRows(activePage, pages, isRoot = false) {
    return pages
        .map((p) => {
            const rawTitle = getProjectTitle(p);
            const label = getNavLabel(p, rawTitle);
            const href = isRoot ? `./${p}/` : `/${p}/`;
            const isCurrent = activePage && activePage.toLowerCase() === p.toLowerCase();
            const currentAttr = isCurrent ? ' aria-current="page"' : '';

            return `                            <tr>
                                <td class="portfolio-link">
                                    <a href="${href}"${currentAttr} data-page-transition data-destination="project"
                                        >${label}</a
                                    >
                                </td>
                            </tr>`;
        })
        .join('\n');
}

/**
 * Synchronizes the nav table in index.html.
 * @param {string[]} pages
 * @returns {Promise<boolean>} whether index.html changed
 */
export async function syncIndexNav(pages) {
    const indexPath = path.join(ROOT_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) return false;

    const html = fs.readFileSync(indexPath, 'utf8');
    const navRows = buildNavRows(null, pages, true);

    const navRegex =
        /(<nav aria-label="Portfolio projects">\s*<table id="nav" role="presentation">\s*<tbody>)([\s\S]*?)(<\/tbody>\s*<\/table>\s*<\/nav>)/;
    if (!navRegex.test(html)) return false;

    const rawNewHtml = html.replace(
        navRegex,
        `$1\n${navRows}\n</tbody>\n                    </table>\n                </nav>`
    );
    const newHtml = await formatHtml(rawNewHtml, indexPath);
    if (newHtml !== html) {
        fs.writeFileSync(indexPath, newHtml, 'utf8');
        return true;
    }
    return false;
}

/**
 * Parses existing page index.html (and index.md frontmatter/commentary) into metadata and content slots.
 */
export function parseExistingPage(page) {
    const htmlPath = path.join(ROOT_DIR, page, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const frontmatter = loadPageFrontmatter(page);
    const commentaryMap = loadCommentaryMap(ROOT_DIR, page);

    const rawTitle = getProjectTitle(page);
    const navLabel = getNavLabel(page, rawTitle);

    const titleMatch = html.match(/<title>(.*?)<\/title>/s);
    const pageTitle = titleMatch ? titleMatch[1].trim() : rawTitle;

    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*?)"\s*\/?>/s);
    const htmlDescription = descMatch ? descMatch[1].trim() : '';
    const description =
        typeof frontmatter.description === 'string' && frontmatter.description.trim()
            ? frontmatter.description.trim()
            : htmlDescription;

    const keyMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*?)"\s*\/?>/s);
    const htmlKeywords = keyMatch
        ? keyMatch[1].trim()
        : 'Zhuang Liu, photography, street photography';
    const keywords = Array.isArray(frontmatter.keywords)
        ? Array.from(new Set([...BASE_KEYWORDS, ...frontmatter.keywords])).join(', ')
        : htmlKeywords;

    const canonical = `${SITE_ORIGIN}/${page}/`;

    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*?)"\s*\/?>/s);
    const metaTitle = ogTitleMatch
        ? ogTitleMatch[1].trim()
        : `${pageTitle} | Zhuang Liu Photography`;

    const ogDescMatch = html.match(
        /<meta\s+property="og:description"\s+content="([^"]*?)"\s*\/?>/s
    );
    const metaDesc =
        typeof frontmatter.description === 'string' && frontmatter.description.trim()
            ? frontmatter.description.trim()
            : ogDescMatch
              ? ogDescMatch[1].trim()
              : description;

    const headingMatch = html.match(/<div class="post-heading">\s*<h1>(.*?)<\/h1>/s);
    const heading = headingMatch ? headingMatch[1].trim() : pageTitle;

    const contentMatch = html.match(
        /<div class="container-narrow post-content">\s*([\s\S]*?)\s*<\/div>\s*<div class="project-footer">/
    );
    const rawPostContent = contentMatch ? contentMatch[1].trim() : '';
    const postContent = hydratePostContentSeo(rawPostContent, commentaryMap);
    const images = extractGalleryImagesFromHtml(postContent);

    const ogImgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*?)"\s*\/?>/s);
    const rawOgImg = ogImgMatch ? ogImgMatch[1].trim() : '';
    const ogWidthMatch = html.match(/<meta\s+property="og:image:width"\s+content="(\d+)"\s*\/?>/s);
    const ogHeightMatch = html.match(
        /<meta\s+property="og:image:height"\s+content="(\d+)"\s*\/?>/s
    );
    const ogAltMatch = html.match(/<meta\s+property="og:image:alt"\s+content="([^"]*?)"\s*\/?>/s);

    const isGenericOg =
        !rawOgImg || rawOgImg.endsWith('/og-image.png') || rawOgImg === 'og-image.png';

    let ogImage = DEFAULT_OG_IMAGE;
    let ogImageWidth = ogWidthMatch ? parseInt(ogWidthMatch[1], 10) : DEFAULT_OG_WIDTH;
    let ogImageHeight = ogHeightMatch ? parseInt(ogHeightMatch[1], 10) : DEFAULT_OG_HEIGHT;
    let ogImageAlt = ogAltMatch ? ogAltMatch[1].trim() : escapeHtmlAttr(metaTitle);

    if (frontmatter.ogImage) {
        ogImage = toAbsoluteSiteUrl(frontmatter.ogImage, page);
    } else if (isGenericOg && images.length > 0) {
        ogImage = images[0].absUrl;
        ogImageWidth = images[0].width;
        ogImageHeight = images[0].height;
        ogImageAlt = escapeHtmlAttr(images[0].alt);
    } else if (rawOgImg) {
        ogImage = toAbsoluteSiteUrl(rawOgImg, page);
        if (images.length > 0 && ogImage === images[0].absUrl) {
            ogImageWidth = images[0].width;
            ogImageHeight = images[0].height;
            if (!ogAltMatch || ogImageAlt === GENERIC_IMAGE_ALT) {
                ogImageAlt = escapeHtmlAttr(images[0].alt);
            }
        }
    }

    let heroPreload = '';
    const heroMatch = html.match(
        /<link\s+rel="preload"\s+as="image"[^>]*type="image\/avif"[^>]*\/?>/i
    );
    if (heroMatch) {
        heroPreload = heroMatch[0].trim();
    } else if (images.length > 0) {
        const fullSrc = images[0].src;
        const baseName = path.basename(fullSrc, path.extname(fullSrc));
        heroPreload = `<link
            rel="preload"
            as="image"
            type="image/avif"
            href="/assets/img/${page}/${baseName}-768.avif"
            imagesrcset="/assets/img/${page}/${baseName}-768.avif 768w, /assets/img/${page}/${baseName}-1200.avif 1200w, /assets/img/${page}/${baseName}.avif 2048w"
            imagesizes="(max-width: 480px) 100vw, (max-width: 768px) 90vw, 900px"
            fetchpriority="high"
        />`;
    }

    return {
        id: page,
        navLabel,
        pageTitle,
        description,
        keywords,
        canonical,
        metaTitle,
        metaDesc,
        ogImage,
        ogImageWidth,
        ogImageHeight,
        ogImageAlt,
        heading,
        heroPreload,
        postContent,
        images,
    };
}

/**
 * Renders a project page from template and parsed data.
 */
export function renderProjectPage(page, data, pages, template) {
    const navRows = buildNavRows(page, pages, false);
    const navLabel = data.navLabel || getNavLabel(page, getProjectTitle(page));
    const ogImage = toAbsoluteSiteUrl(data.ogImage || '', page);
    const ogImageWidth = String(data.ogImageWidth || DEFAULT_OG_WIDTH);
    const ogImageHeight = String(data.ogImageHeight || DEFAULT_OG_HEIGHT);
    const ogImageAlt = data.ogImageAlt || escapeHtmlAttr(data.metaTitle || navLabel);
    const structuredData = buildProjectStructuredDataScript(page, {
        navLabel,
        heading: data.heading,
        description: data.description,
        canonical: data.canonical,
        ogImage,
        postContent: data.postContent,
    });

    const output = template
        .replace(/{{PAGE_TITLE}}/g, data.pageTitle)
        .replace(/{{DESCRIPTION}}/g, escapeHtmlAttr(data.description))
        .replace(/{{KEYWORDS}}/g, escapeHtmlAttr(data.keywords))
        .replace(/{{CANONICAL_URL}}/g, data.canonical)
        .replace(/{{META_TITLE}}/g, escapeHtmlAttr(data.metaTitle))
        .replace(/{{META_DESCRIPTION}}/g, escapeHtmlAttr(data.metaDesc))
        .replace(/{{OG_IMAGE}}/g, ogImage)
        .replace(/{{OG_IMAGE_WIDTH}}/g, ogImageWidth)
        .replace(/{{OG_IMAGE_HEIGHT}}/g, ogImageHeight)
        .replace(/{{OG_IMAGE_ALT}}/g, ogImageAlt)
        .replace(/{{HEADING}}/g, data.heading)
        .replace(/<!-- SLOT:HERO_PRELOAD -->/g, data.heroPreload || '')
        .replace(/<!-- SLOT:NAV_LINKS -->/g, navRows)
        .replace(/<!-- SLOT:POST_CONTENT -->/g, data.postContent)
        .replace(/<!-- SLOT:STRUCTURED_DATA -->/g, structuredData);

    return output;
}

/**
 * Formats HTML string using repo's prettier configuration.
 * @param {string} html
 * @param {string} filepath
 * @returns {Promise<string>}
 */
export async function formatHtml(html, filepath) {
    try {
        const options = await prettier.resolveConfig(filepath);
        return await prettier.format(html, { ...options, filepath });
    } catch {
        return html;
    }
}

/**
 * Synchronizes sitemap.xml with all active portfolio pages and Google Image Sitemap entries.
 * @param {string[]} pages e.g. ['p1', 'p2', 'p3', 'p4']
 * @param {boolean} checkOnly
 * @param {Array<ReturnType<typeof parseExistingPage>> | null} parsedPages
 * @returns {Promise<boolean>} whether sitemap drifted
 */
export async function syncSitemap(pages, checkOnly = false, parsedPages = null) {
    const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
    const today = new Date().toISOString().split('T')[0];
    const aboutPath = path.join(ROOT_DIR, 'about', 'index.html');
    const hasAboutPage =
        fs.existsSync(aboutPath) && !isNoindexHtml(fs.readFileSync(aboutPath, 'utf8'));

    const existingLastmods = new Map();
    let currentSitemap = '';
    if (fs.existsSync(sitemapPath)) {
        currentSitemap = fs.readFileSync(sitemapPath, 'utf8');
        const urlMatches = [
            ...currentSitemap.matchAll(
                /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g
            ),
        ];
        for (const m of urlMatches) {
            existingLastmods.set(m[1].trim(), m[2].trim());
        }
    }

    const entries =
        parsedPages ||
        pages
            .filter((p) => fs.existsSync(path.join(ROOT_DIR, p, 'index.html')))
            .map((p) => parseExistingPage(p));

    const expectedSitemap = buildImageSitemapXml(entries, existingLastmods, today, hasAboutPage);

    if (currentSitemap.trim() !== expectedSitemap.trim()) {
        if (checkOnly) {
            console.error('sync-pages: sitemap.xml is out of sync.');
            return true;
        }
        fs.writeFileSync(sitemapPath, expectedSitemap, 'utf8');
        console.log('Synchronized sitemap.xml');
    }
    return false;
}

/**
 * Synchronizes llms.txt and llms-full.txt manifests for AI/LLM search grounding.
 * @param {Array<ReturnType<typeof parseExistingPage>>} parsedPages
 * @param {boolean} checkOnly
 * @returns {boolean} whether either manifest drifted
 */
export function syncLlmsManifests(parsedPages, checkOnly = false) {
    let drifted = false;
    const llmsPath = path.join(ROOT_DIR, 'llms.txt');
    const llmsFullPath = path.join(ROOT_DIR, 'llms-full.txt');

    const expectedLlms = buildLlmsTxt(
        parsedPages.map((p) => ({
            id: p.id,
            navLabel: p.navLabel,
            canonical: p.canonical,
            description: p.description,
            imageCount: p.images.length,
        }))
    );
    const expectedLlmsFull = buildLlmsFullTxt(parsedPages);

    for (const [targetPath, expected, label] of [
        [llmsPath, expectedLlms, 'llms.txt'],
        [llmsFullPath, expectedLlmsFull, 'llms-full.txt'],
    ]) {
        const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
        if (current.trim() !== expected.trim()) {
            if (checkOnly) {
                console.error(`sync-pages: ${label} is out of sync.`);
                drifted = true;
            } else {
                fs.writeFileSync(targetPath, expected, 'utf8');
                console.log(`Synchronized ${label}`);
            }
        }
    }
    return drifted;
}

/**
 * Synchronizes nav links and @graph JSON-LD in a non-gallery shell page (index.html or about/index.html).
 */
async function syncShellPage(htmlPath, pages, isRoot, jsonLdObj, label, checkOnly) {
    if (!fs.existsSync(htmlPath)) {
        return false;
    }
    const currentHtml = fs.readFileSync(htmlPath, 'utf8');
    const navRows = buildNavRows(null, pages, isRoot);
    let updatedHtml = currentHtml;

    const navRegex =
        /(<nav aria-label="Portfolio projects">\s*<table id="nav" role="presentation">\s*<tbody>)([\s\S]*?)(<\/tbody>\s*<\/table>\s*<\/nav>)/;
    if (navRegex.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(
            navRegex,
            `$1\n${navRows}\n</tbody>\n                    </table>\n                </nav>`
        );
    }

    const ldRegex = /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i;
    const ldBlock = `<script type="application/ld+json">\n${serializeJsonLd(jsonLdObj)}\n</script>`;
    if (ldRegex.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(ldRegex, ldBlock);
    }

    const formattedHtml = await formatHtml(updatedHtml, htmlPath);
    if (formattedHtml !== currentHtml) {
        if (checkOnly) {
            console.error(`sync-pages: ${label} is out of sync.`);
            return true;
        }
        fs.writeFileSync(htmlPath, formattedHtml, 'utf8');
        console.log(`Synchronized ${label}`);
    }
    return false;
}

/**
 * Synchronizes js/preloader.js assetSets and imageDirectories with discovered project pages.
 * @param {string[]} pages e.g. ['p1', 'p2', 'p3', 'p4', 'p5']
 * @param {boolean} checkOnly
 * @returns {Promise<boolean>} whether preloader drifted
 */
export async function syncPreloaderAssets(pages, checkOnly = false) {
    const preloaderPath = path.join(ROOT_DIR, 'js', 'preloader.js');
    if (!fs.existsSync(preloaderPath)) return false;

    const currentContent = fs.readFileSync(preloaderPath, 'utf8');

    const imageDirectories = {};
    const assetSets = {};

    for (const page of pages) {
        imageDirectories[page] = `/assets/img/${page}/`;
        const htmlPath = path.join(ROOT_DIR, page, 'index.html');
        if (fs.existsSync(htmlPath)) {
            const html = fs.readFileSync(htmlPath, 'utf8');
            const matches = [
                ...html.matchAll(/<img\b(?![^>]*class="[^"]*mobile-banner)[^>]*\bsrc="([^"]+)"/g),
            ];
            assetSets[page] = matches.map((m) => m[1]);
        }
    }

    const dirsJson = JSON.stringify(imageDirectories, null, 16)
        .replace(/^{/, '{\n')
        .replace(/^ {16}/gm, '                ');
    const assetsJson = JSON.stringify(assetSets, null, 16)
        .replace(/^{/, '{\n')
        .replace(/^ {16}/gm, '                ');

    const dirsRegex = /(this\.imageDirectories\s*=\s*)\{[\s\S]*?\};/;
    const assetsRegex = /(this\.assetSets\s*=\s*)\{[\s\S]*?\};/;

    let newContent = currentContent;
    if (dirsRegex.test(newContent)) {
        newContent = newContent.replace(dirsRegex, `$1${dirsJson};`);
    }
    if (assetsRegex.test(newContent)) {
        newContent = newContent.replace(assetsRegex, `$1${assetsJson};`);
    }

    let formattedContent = newContent;
    try {
        const prettierConfig = (await prettier.resolveConfig(preloaderPath)) || {};
        formattedContent = await prettier.format(newContent, {
            ...prettierConfig,
            filepath: preloaderPath,
        });
    } catch {
        formattedContent = newContent;
    }

    if (formattedContent.trim() !== currentContent.trim()) {
        if (checkOnly) {
            console.error('sync-pages: js/preloader.js asset sets are out of sync.');
            return true;
        }
        fs.writeFileSync(preloaderPath, formattedContent, 'utf8');
        console.log('Synchronized js/preloader.js');
        return true;
    }
    return false;
}

/**
 * Synchronizes all project pages, index.html, about/index.html, sitemap.xml, and llms.txt.
 * @param {boolean} checkOnly If true, only reports drift without writing files.
 * @returns {Promise<number>} Exit code (0 for success, 1 for drift in check mode).
 */
export async function syncAllPages(checkOnly = false) {
    const pages = getProjectPages();
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    let drifted = false;

    const parsedPages = pages
        .filter((p) => fs.existsSync(path.join(ROOT_DIR, p, 'index.html')))
        .map((p) => parseExistingPage(p));

    const projectSummaries = parsedPages.map((p) => ({
        id: p.id,
        label: p.navLabel,
        canonical: p.canonical,
        description: p.description,
    }));

    // 1. Sync all project pages first so parsedPages reflects hydrated HTML
    for (const data of parsedPages) {
        const htmlPath = path.join(ROOT_DIR, data.id, 'index.html');
        const currentHtml = fs.readFileSync(htmlPath, 'utf8');
        const rawRenderedHtml = renderProjectPage(data.id, data, pages, template);
        const formattedRenderedHtml = await formatHtml(rawRenderedHtml, htmlPath);

        if (currentHtml.trim() !== formattedRenderedHtml.trim()) {
            if (checkOnly) {
                console.error(
                    `sync-pages: ${data.id}/index.html is out of sync with portfolio-shell.html.`
                );
                drifted = true;
            } else {
                fs.writeFileSync(htmlPath, formattedRenderedHtml, 'utf8');
                console.log(`Synchronized ${data.id}/index.html`);
            }
        }
    }

    // 2. Sync sitemap.xml (with Google Image Sitemap entries)
    if (await syncSitemap(pages, checkOnly, parsedPages)) {
        drifted = true;
    }

    // 3. Sync llms.txt & llms-full.txt
    if (syncLlmsManifests(parsedPages, checkOnly)) {
        drifted = true;
    }

    // 4. Sync index.html navigation table & @graph JSON-LD
    const indexDrifted = await syncShellPage(
        path.join(ROOT_DIR, 'index.html'),
        pages,
        true,
        buildHomeJsonLd(projectSummaries),
        'index.html',
        checkOnly
    );
    if (indexDrifted) drifted = true;

    // 5. Sync about/index.html navigation table & ProfilePage JSON-LD (if present)
    const aboutDrifted = await syncShellPage(
        path.join(ROOT_DIR, 'about', 'index.html'),
        pages,
        false,
        buildAboutJsonLd(projectSummaries),
        'about/index.html',
        checkOnly
    );
    if (aboutDrifted) drifted = true;

    // 6. Sync js/preloader.js asset sets
    if (await syncPreloaderAssets(pages, checkOnly)) {
        drifted = true;
    }

    if (checkOnly && drifted) {
        console.error('sync-pages FAIL: Pages are out of sync. Run "make sync-pages" to update.');
        return 1;
    }

    if (!drifted) {
        console.log('sync-pages: All portfolio pages are up to date.');
    }
    return 0;
}

// Direct CLI invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const isCheck = process.argv.includes('--check');
    syncAllPages(isCheck)
        .then((exitCode) => process.exit(exitCode))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
