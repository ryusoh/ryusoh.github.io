import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT_DIR, 'scripts', 'templates', 'portfolio-shell.html');

/**
 * Discovers all active project pages in the root directory.
 * @returns {string[]} e.g. ['p1', 'p2', 'p3', 'p4']
 */
export function getProjectPages() {
    return fs
        .readdirSync(ROOT_DIR, { withFileTypes: true })
        .filter(
            (d) =>
                d.isDirectory() &&
                /^p\d+$/i.test(d.name) &&
                fs.existsSync(path.join(ROOT_DIR, d.name, 'index.html'))
        )
        .map((d) => d.name)
        .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
}

/**
 * Extracts project title/nav label from index.md or index.html.
 * @param {string} page e.g. 'p1'
 * @returns {string} Project nav label
 */
export function getProjectTitle(page) {
    // 1. Check assets/img/p<N>/index.md or p<N>/index.md frontmatter
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
            // First line might be title if not frontmatter
            const firstLine = content.split('\n')[0].trim();
            if (firstLine && !firstLine.startsWith('---')) {
                return firstLine;
            }
        }
    }

    // 2. Fallback: extract from existing index.html nav link or heading
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
    // Standard labels for existing pages
    const knownLabels = {
        p1: 'I Tear Up the Bay When I Come Through',
        p2: 'I Do Not Care If We Go Down in History as Barbarians',
        p3: 'Aerobatic Activities',
        p4: 'Das Gespenst',
    };
    if (knownLabels[page.toLowerCase()]) {
        return knownLabels[page.toLowerCase()];
    }

    // If title is ALL CAPS, convert to Title Case for nav
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
 * @param {string | null} activePage e.g. 'p1', or null for index.html
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
 * Parses existing page index.html into metadata and content slots.
 */
export function parseExistingPage(page) {
    const htmlPath = path.join(ROOT_DIR, page, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Title
    const titleMatch = html.match(/<title>(.*?)<\/title>/s);
    const pageTitle = titleMatch ? titleMatch[1].trim() : getProjectTitle(page);

    // Meta Description
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*?)"\s*\/?>/s);
    const description = descMatch ? descMatch[1].trim() : '';

    // Meta Keywords
    const keyMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*?)"\s*\/?>/s);
    const keywords = keyMatch ? keyMatch[1].trim() : 'Zhuang Liu, photography, street photography';

    // Canonical & OG URL
    const canonical = `https://www.lyeutsaon.com/${page}/`;

    // OG Title & Desc
    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*?)"\s*\/?>/s);
    const metaTitle = ogTitleMatch
        ? ogTitleMatch[1].trim()
        : `${pageTitle} | Zhuang Liu Photography`;

    const ogDescMatch = html.match(
        /<meta\s+property="og:description"\s+content="([^"]*?)"\s*\/?>/s
    );
    const metaDesc = ogDescMatch ? ogDescMatch[1].trim() : description;

    // OG Image
    const ogImgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*?)"\s*\/?>/s);
    const ogImage = ogImgMatch ? ogImgMatch[1].trim() : '../assets/img/og-image.png';

    // Heading
    const headingMatch = html.match(/<div class="post-heading">\s*<h1>(.*?)<\/h1>/s);
    const heading = headingMatch ? headingMatch[1].trim() : pageTitle;

    // Post content
    const contentMatch = html.match(
        /<div class="container-narrow post-content">\s*([\s\S]*?)\s*<\/div>\s*<div class="project-footer">/
    );
    const postContent = contentMatch ? contentMatch[1].trim() : '';

    return {
        pageTitle,
        description,
        keywords,
        canonical,
        metaTitle,
        metaDesc,
        ogImage,
        heading,
        postContent,
    };
}

/**
 * Renders a project page from template and parsed data.
 */
export function renderProjectPage(page, data, pages, template) {
    const navRows = buildNavRows(page, pages, false);

    let output = template
        .replace(/{{PAGE_TITLE}}/g, data.pageTitle)
        .replace(/{{DESCRIPTION}}/g, data.description)
        .replace(/{{KEYWORDS}}/g, data.keywords)
        .replace(/{{CANONICAL_URL}}/g, data.canonical)
        .replace(/{{META_TITLE}}/g, data.metaTitle)
        .replace(/{{META_DESCRIPTION}}/g, data.metaDesc)
        .replace(/{{OG_IMAGE}}/g, data.ogImage)
        .replace(/{{HEADING}}/g, data.heading)
        .replace(/<!-- SLOT:NAV_LINKS -->/g, navRows)
        .replace(/<!-- SLOT:POST_CONTENT -->/g, data.postContent);

    return output;
}

import prettier from 'prettier';

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
 * Main sync execution function.
 * @param {boolean} checkOnly
 * @returns {Promise<number>} exit code (0 for clean, 1 for drift in check mode)
 */
export async function syncAllPages(checkOnly = false) {
    const pages = getProjectPages();
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    let drifted = false;

    // 1. Sync index.html
    const indexPath = path.join(ROOT_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        const currentIndexHtml = fs.readFileSync(indexPath, 'utf8');
        const navRows = buildNavRows(null, pages, true);
        const navRegex =
            /(<nav aria-label="Portfolio projects">\s*<table id="nav" role="presentation">\s*<tbody>)([\s\S]*?)(<\/tbody>\s*<\/table>\s*<\/nav>)/;
        if (navRegex.test(currentIndexHtml)) {
            const rawNewIndexHtml = currentIndexHtml.replace(
                navRegex,
                `$1\n${navRows}\n</tbody>\n                    </table>\n                </nav>`
            );
            const formattedIndexHtml = await formatHtml(rawNewIndexHtml, indexPath);
            if (formattedIndexHtml !== currentIndexHtml) {
                if (checkOnly) {
                    console.error('sync-pages: index.html navigation table is out of sync.');
                    drifted = true;
                } else {
                    fs.writeFileSync(indexPath, formattedIndexHtml, 'utf8');
                    console.log('Synchronized index.html navigation');
                }
            }
        }
    }

    // 2. Sync all project pages
    for (const page of pages) {
        const htmlPath = path.join(ROOT_DIR, page, 'index.html');
        if (!fs.existsSync(htmlPath)) continue;

        const currentHtml = fs.readFileSync(htmlPath, 'utf8');
        const data = parseExistingPage(page);
        const rawRenderedHtml = renderProjectPage(page, data, pages, template);
        const formattedRenderedHtml = await formatHtml(rawRenderedHtml, htmlPath);

        if (currentHtml.trim() !== formattedRenderedHtml.trim()) {
            if (checkOnly) {
                console.error(
                    `sync-pages: ${page}/index.html is out of sync with portfolio-shell.html.`
                );
                drifted = true;
            } else {
                fs.writeFileSync(htmlPath, formattedRenderedHtml, 'utf8');
                console.log(`Synchronized ${page}/index.html`);
            }
        }
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
