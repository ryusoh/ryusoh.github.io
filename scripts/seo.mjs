import fs from 'fs';
import path from 'path';

export const SITE_ORIGIN = 'https://www.lyeutsaon.com';
export const PERSON_ID = `${SITE_ORIGIN}/#person`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const ABOUT_URL = `${SITE_ORIGIN}/about/`;
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/assets/img/og-image.png`;
export const DEFAULT_OG_WIDTH = 1447;
export const DEFAULT_OG_HEIGHT = 965;
export const GENERIC_IMAGE_ALT = 'Street photography by Zhuang Liu';

const PERSON_PORTRAIT_URL = `${SITE_ORIGIN}/assets/img/p5/DSCF9004-3.jpg`;
const PERSON_PORTRAIT_WIDTH = 1946;
const PERSON_PORTRAIT_HEIGHT = 1297;

/**
 * Returns true if HTML contains a robots or googlebot meta tag with a noindex directive.
 * @param {string} html
 * @returns {boolean}
 */
export function isNoindexHtml(html) {
    const metaTags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
    return metaTags.some((tag) => {
        const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
        const contentMatch = tag.match(/\bcontent=["']([^"']+)["']/i);
        if (!nameMatch || !contentMatch) {
            return false;
        }
        const name = nameMatch[1].trim().toLowerCase();
        if (name !== 'robots' && name !== 'googlebot') {
            return false;
        }
        return /\bnoindex\b/i.test(contentMatch[1]);
    });
}

/**
 * Escapes text for safe inclusion inside a double-quoted HTML attribute.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtmlAttr(value) {
    const raw = unescapeHtmlEntities(String(value || ''));
    return raw
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Decodes basic HTML entities back to plain text prior to JSON or XML serialization.
 * @param {string} value
 * @returns {string}
 */
export function unescapeHtmlEntities(value) {
    return String(value || '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

/**
 * Escapes text for XML element content.
 * @param {string} value
 * @returns {string}
 */
export function escapeXml(value) {
    const raw = unescapeHtmlEntities(value);
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Loads assets/img/<pageId>/commentary.json if available.
 * @param {string} rootDir
 * @param {string} pageId
 * @returns {Record<string, { subject?: string, role?: string }>}
 */
export function loadCommentaryMap(rootDir, pageId) {
    const commPath = path.join(rootDir, 'assets', 'img', pageId, 'commentary.json');
    if (!fs.existsSync(commPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(commPath, 'utf8')) || {};
    } catch {
        return {};
    }
}

/**
 * Resolves the best HTML-escaped alt attribute for a gallery image.
 * @param {string | null} customAlt
 * @param {Record<string, { subject?: string }>} commentaryMap
 * @param {string} filename
 * @returns {string}
 */
export function resolveImageAlt(customAlt, commentaryMap, filename) {
    if (customAlt && customAlt.trim()) {
        return escapeHtmlAttr(customAlt.trim());
    }
    const subject = commentaryMap[filename]?.subject?.trim();
    if (subject) {
        return escapeHtmlAttr(subject);
    }
    return GENERIC_IMAGE_ALT;
}

/**
 * Returns true if text contains CJK Unified Ideographs.
 * @param {string} text
 * @returns {boolean}
 */
export function containsCjk(text) {
    return /[\u4e00-\u9fff]/.test(text);
}

/**
 * Upgrades generic image alt attributes from commentary.json and tags CJK blockquotes with lang="zh-Hant".
 * @param {string} postContent
 * @param {Record<string, { subject?: string }>} commentaryMap
 * @returns {string}
 */
export function hydratePostContentSeo(postContent, commentaryMap) {
    let updated = postContent.replace(/<img\b([\s\S]*?)\/?>/gi, (fullTag) => {
        if (fullTag.includes('mobile-banner')) {
            return fullTag;
        }
        const srcMatch = fullTag.match(/\bsrc="\/assets\/img\/[^/]+\/([^"]+)"/);
        const altMatch = fullTag.match(/\balt="([^"]*)"/);
        if (!srcMatch || !altMatch || altMatch[1] !== GENERIC_IMAGE_ALT) {
            return fullTag;
        }
        const filename = srcMatch[1];
        const subject = commentaryMap[filename]?.subject?.trim();
        if (!subject) {
            return fullTag;
        }
        return fullTag.replace(`alt="${GENERIC_IMAGE_ALT}"`, `alt="${escapeHtmlAttr(subject)}"`);
    });

    updated = updated.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (fullBlock, inner) => {
        if (containsCjk(inner)) {
            return `<blockquote lang="zh-Hant">${inner}</blockquote>`;
        }
        return fullBlock;
    });

    return updated;
}

/**
 * Normalizes any local or relative asset path to an absolute https://www.lyeutsaon.com URL.
 * @param {string} rawUrl
 * @param {string} pageId
 * @returns {string}
 */
export function toAbsoluteSiteUrl(rawUrl, pageId = '') {
    if (!rawUrl) {
        return DEFAULT_OG_IMAGE;
    }
    if (/^https?:\/\//i.test(rawUrl)) {
        return rawUrl;
    }
    if (rawUrl.startsWith('../')) {
        return `${SITE_ORIGIN}/${rawUrl.replace(/^(\.\.\/)+/, '')}`;
    }
    if (rawUrl.startsWith('./')) {
        const prefix = pageId ? `/${pageId}/` : '/';
        return `${SITE_ORIGIN}${prefix}${rawUrl.slice(2)}`;
    }
    if (rawUrl.startsWith('/')) {
        return `${SITE_ORIGIN}${rawUrl}`;
    }
    return pageId ? `${SITE_ORIGIN}/assets/img/${pageId}/${rawUrl}` : `${SITE_ORIGIN}/${rawUrl}`;
}

/**
 * Extracts ordered gallery photograph metadata from rendered .post-content HTML.
 * @param {string} postContent
 * @returns {Array<{ src: string, absUrl: string, filename: string, alt: string, width: number, height: number, creditHandle: string | null }>}
 */
export function extractGalleryImagesFromHtml(postContent) {
    const results = [];
    const blockRegex =
        /<picture>[\s\S]*?<\/picture>(?:\s*<span\s+class="photo-credit"[^>]*>[\s\S]*?<\/span\s*>)?/gi;

    let match;
    while ((match = blockRegex.exec(postContent)) !== null) {
        const block = match[0];
        const imgMatch = block.match(/<img\b([\s\S]*?)\/?>/i);
        if (!imgMatch || imgMatch[0].includes('mobile-banner')) {
            continue;
        }
        const imgTag = imgMatch[0];
        const srcMatch = imgTag.match(/\bsrc="([^"]+)"/);
        if (!srcMatch) {
            continue;
        }
        const src = srcMatch[1];
        const altMatch = imgTag.match(/\balt="([^"]*)"/);
        const widthMatch = imgTag.match(/\bwidth="(\d+)"/);
        const heightMatch = imgTag.match(/\bheight="(\d+)"/);
        const creditMatch = block.match(
            /<span\s+class="photo-credit"[^>]*>[\s\S]*?instagram\.com\/([a-zA-Z0-9_.]+)\/?[\s\S]*?<\/span\s*>/i
        );

        results.push({
            src,
            absUrl: toAbsoluteSiteUrl(src),
            filename: path.basename(src),
            alt: unescapeHtmlEntities(altMatch ? altMatch[1] : GENERIC_IMAGE_ALT)
                .replace(/\s+/g, ' ')
                .trim(),
            width: widthMatch ? parseInt(widthMatch[1], 10) : 2048,
            height: heightMatch ? parseInt(heightMatch[1], 10) : 1365,
            creditHandle: creditMatch ? creditMatch[1] : null,
        });
    }
    return results;
}

/**
 * Builds the canonical Schema.org Person node for Zhuang Liu (lyeutsaon).
 */
export function buildPersonEntity() {
    return {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: 'Zhuang Liu',
        alternateName: ['lyeutsaon', 'Zhuang Liu (lyeutsaon)', 'Zhuang Liu Photographer'],
        identifier: 'lyeutsaon',
        url: `${SITE_ORIGIN}/`,
        mainEntityOfPage: `${SITE_ORIGIN}/`,
        image: {
            '@type': 'ImageObject',
            url: PERSON_PORTRAIT_URL,
            contentUrl: PERSON_PORTRAIT_URL,
            width: PERSON_PORTRAIT_WIDTH,
            height: PERSON_PORTRAIT_HEIGHT,
            caption: 'Self-portrait by street photographer Zhuang Liu (lyeutsaon)',
        },
        jobTitle: 'Street and Urban Documentary Photographer',
        description:
            'Zhuang Liu (lyeutsaon) is an independent street and urban documentary photographer based in the San Francisco Bay Area, working across San Francisco, San Jose, Los Angeles, and Shanghai.',
        disambiguatingDescription:
            'San Francisco Bay Area street and urban documentary photographer publishing exclusively as lyeutsaon at lyeutsaon.com and @lyeutsaon on Instagram, with bodies of work photographed in California (San Francisco, San Jose, Los Angeles) and Shanghai.',
        homeLocation: {
            '@type': 'Place',
            name: 'San Francisco Bay Area, California, USA',
        },
        workLocation: [
            { '@type': 'City', name: 'San Francisco' },
            { '@type': 'City', name: 'San Jose' },
            { '@type': 'City', name: 'Los Angeles' },
            { '@type': 'City', name: 'Shanghai' },
        ],
        sameAs: [
            'https://www.instagram.com/lyeutsaon/',
            'https://www.instagram.com/lyeutsaon.misc/',
            'https://www.linkedin.com/in/zhuangliudev/',
            'https://github.com/ryusoh',
        ],
        knowsAbout: [
            'Street Photography',
            'Urban Documentary Photography',
            'West Coast Street Culture',
            'Black and White Photography',
            'Visual Storytelling',
            'San Francisco Bay Area',
        ],
    };
}

/**
 * Builds the canonical Schema.org WebSite node.
 */
export function buildWebsiteEntity() {
    return {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: `${SITE_ORIGIN}/`,
        name: 'Zhuang Liu Photography',
        alternateName: ['Zhuang Liu', 'lyeutsaon', 'lyeutsaon.com'],
        inLanguage: 'en',
        creator: { '@id': PERSON_ID },
        publisher: { '@id': PERSON_ID },
    };
}

/**
 * Serializes a JSON-LD object safely for embedding inside <script type="application/ld+json">.
 * @param {object} obj
 * @returns {string}
 */
export function serializeJsonLd(obj) {
    return JSON.stringify(obj, null, 4).replace(/<\//g, '<\\/');
}

/**
 * Builds the homepage @graph JSON-LD object.
 * @param {Array<{ id: string, label: string, canonical: string, description: string }>} projects
 */
export function buildHomeJsonLd(projects) {
    return {
        '@context': 'https://schema.org',
        '@graph': [
            buildPersonEntity(),
            buildWebsiteEntity(),
            {
                '@type': 'CollectionPage',
                '@id': `${SITE_ORIGIN}/#collection`,
                url: `${SITE_ORIGIN}/`,
                name: 'Zhuang Liu',
                description:
                    'Portfolio of street and urban documentary photography series by Zhuang Liu (lyeutsaon), photographed in the San Francisco Bay Area, Los Angeles, and Shanghai.',
                isPartOf: { '@id': WEBSITE_ID },
                about: { '@id': PERSON_ID },
                creator: { '@id': PERSON_ID },
                hasPart: projects.map((proj) => ({
                    '@type': 'ImageGallery',
                    '@id': `${proj.canonical}#gallery`,
                    name: proj.label,
                    url: proj.canonical,
                    description: proj.description,
                })),
            },
        ],
    };
}

/**
 * Builds the /about/ ProfilePage @graph JSON-LD object.
 * @param {Array<{ id: string, label: string, canonical: string, description: string }>} projects
 */
export function buildAboutJsonLd(projects) {
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'BreadcrumbList',
                '@id': `${ABOUT_URL}#breadcrumb`,
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Zhuang Liu',
                        item: `${SITE_ORIGIN}/`,
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: 'About & Colophon',
                        item: ABOUT_URL,
                    },
                ],
            },
            {
                '@type': 'ProfilePage',
                '@id': `${ABOUT_URL}#profilepage`,
                url: ABOUT_URL,
                name: 'About Zhuang Liu (lyeutsaon) — Street Photographer',
                description:
                    'Biography, artist statement, series index, and attribution colophon for San Francisco Bay Area street and documentary photographer Zhuang Liu (lyeutsaon).',
                isPartOf: { '@id': WEBSITE_ID },
                mainEntity: { '@id': PERSON_ID },
                hasPart: projects.map((proj) => ({
                    '@type': 'ImageGallery',
                    '@id': `${proj.canonical}#gallery`,
                    name: proj.label,
                    url: proj.canonical,
                })),
            },
            buildPersonEntity(),
            buildWebsiteEntity(),
        ],
    };
}

/**
 * Builds an individual ImageObject node for a gallery photograph.
 * @param {string} canonical
 * @param {object} img
 * @param {number} index
 */
function buildGalleryImageNode(canonical, img, index) {
    const base = {
        '@type': 'ImageObject',
        '@id': `${canonical}#image-${index + 1}`,
        url: img.absUrl,
        contentUrl: img.absUrl,
        width: img.width,
        height: img.height,
        caption: img.alt,
    };

    if (img.creditHandle) {
        return {
            ...base,
            creator: {
                '@type': 'Person',
                name: `@${img.creditHandle}`,
                sameAs: `https://www.instagram.com/${img.creditHandle}/`,
            },
            creditText: `Photo by @${img.creditHandle}`,
            about: { '@id': PERSON_ID },
        };
    }

    return {
        ...base,
        creator: { '@id': PERSON_ID },
        creditText: 'Zhuang Liu (@lyeutsaon)',
        copyrightNotice: '© Zhuang Liu (lyeutsaon.com). All rights reserved.',
        acquireLicensePage: `${SITE_ORIGIN}/`,
    };
}

/**
 * Builds the <script type="application/ld+json"> markup for a portfolio series page.
 * @param {string} pageId
 * @param {{ navLabel: string, heading: string, description: string, canonical: string, ogImage: string, postContent: string }} data
 * @returns {string}
 */
export function buildProjectStructuredDataScript(pageId, data) {
    const images = extractGalleryImagesFromHtml(data.postContent || '');
    const hasCjk = containsCjk(data.postContent || '');
    const mediaNodes = images.map((img, idx) => buildGalleryImageNode(data.canonical, img, idx));

    const galleryNode = {
        '@type': 'ImageGallery',
        '@id': `${data.canonical}#gallery`,
        url: data.canonical,
        name: data.navLabel,
        headline: unescapeHtmlEntities(data.heading),
        description: unescapeHtmlEntities(data.description),
        inLanguage: hasCjk ? ['en', 'zh-Hant'] : 'en',
        isPartOf: { '@id': WEBSITE_ID },
        author: { '@id': PERSON_ID },
        creator: { '@id': PERSON_ID },
        copyrightHolder: { '@id': PERSON_ID },
        image: data.ogImage,
        numberOfItems: mediaNodes.length,
        associatedMedia: mediaNodes,
    };

    const ld = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'BreadcrumbList',
                '@id': `${data.canonical}#breadcrumb`,
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Zhuang Liu',
                        item: `${SITE_ORIGIN}/`,
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: data.navLabel,
                        item: data.canonical,
                    },
                ],
            },
            galleryNode,
        ],
    };

    return `<script type="application/ld+json">\n${serializeJsonLd(ld)}\n</script>`;
}

/**
 * Builds sitemap.xml including Google Image Sitemap <image:image> entries.
 * @param {Array<{ canonical: string, navLabel: string, images: Array<{ absUrl: string, alt: string }> }>} projectEntries
 * @param {Map<string, string>} existingLastmods
 * @param {string} today
 * @param {boolean} hasAboutPage
 * @returns {string}
 */
export function buildImageSitemapXml(projectEntries, existingLastmods, today, hasAboutPage = true) {
    const homeLoc = `${SITE_ORIGIN}/`;
    const urls = [
        `    <url>
        <loc>${homeLoc}</loc>
        <lastmod>${existingLastmods.get(homeLoc) || today}</lastmod>
    </url>`,
    ];

    if (hasAboutPage) {
        urls.push(`    <url>
        <loc>${ABOUT_URL}</loc>
        <lastmod>${existingLastmods.get(ABOUT_URL) || today}</lastmod>
    </url>`);
    }

    for (const entry of projectEntries) {
        const lastmod = existingLastmods.get(entry.canonical) || today;
        const imageTags = entry.images
            .map(
                (img) => `        <image:image>
            <image:loc>${escapeXml(img.absUrl)}</image:loc>
            <image:title>${escapeXml(`${entry.navLabel} — Zhuang Liu`)}</image:title>
            <image:caption>${escapeXml(img.alt)}</image:caption>
        </image:image>`
            )
            .join('\n');
        const imageBlock = imageTags ? `\n${imageTags}` : '';
        urls.push(`    <url>
        <loc>${entry.canonical}</loc>
        <lastmod>${lastmod}</lastmod>${imageBlock}
    </url>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`;
}

/**
 * Builds the concise /llms.txt Markdown manifest for AI search and grounding engines.
 * @param {Array<{ id: string, navLabel: string, canonical: string, description: string, imageCount: number }>} projectEntries
 * @returns {string}
 */
export function buildLlmsTxt(projectEntries) {
    const seriesBullets = projectEntries
        .map(
            (p) =>
                `- [${p.navLabel}](${p.canonical}): ${unescapeHtmlEntities(p.description)} (${p.imageCount} photographs)`
        )
        .join('\n');

    return `# Zhuang Liu (lyeutsaon) — Street Photography

> Zhuang Liu (handle: lyeutsaon) is an independent street and urban documentary photographer based in the San Francisco Bay Area, California. His photographs explore urban reality, nocturnal light, street theater, and contemporary alienation across the San Francisco Bay Area (San Francisco, San Jose), Los Angeles / California, and Shanghai.

## Entity Identity & Disambiguation

- **Canonical Name:** Zhuang Liu
- **Artist Handle / Identifier:** lyeutsaon (\`@lyeutsaon\`)
- **Primary Domain:** ${SITE_ORIGIN}/
- **Biography & Colophon:** ${ABOUT_URL}
- **Active Geographic Scope:** San Francisco Bay Area (San Francisco, San Jose), Los Angeles / California (US West Coast), and Shanghai.
- **Canonical Attribution Scope:** All photographic works by this artist are published exclusively under Zhuang Liu / lyeutsaon (\`lyeutsaon.com\`, Instagram \`@lyeutsaon\` and \`@lyeutsaon.misc\`), covering only the series and cities listed in this manifest.

## Photography Series & Galleries

${seriesBullets}

## Monograph

- **Infinite Systems** (by Zhuang Liu): A 127-plate sequenced portrait and street photography monograph compiled from the portfolio archive.

## Official Profiles & Contact

- [Official Website](${SITE_ORIGIN}/)
- [About & Attribution Colophon](${ABOUT_URL})
- [Extended Catalog for LLMs](${SITE_ORIGIN}/llms-full.txt)
- [Instagram — Primary Street Portfolio (@lyeutsaon)](https://www.instagram.com/lyeutsaon/)
- [Instagram — Secondary Archive (@lyeutsaon.misc)](https://www.instagram.com/lyeutsaon.misc/)
- [LinkedIn (zhuangliudev)](https://www.linkedin.com/in/zhuangliudev/)
- [GitHub (ryusoh)](https://github.com/ryusoh)
- Contact & Licensing: mailto:info@lyeutsaon.com
`;
}

/**
 * Extracts plain-text blockquotes from rendered postContent for llms-full.txt.
 * @param {string} postContent
 * @returns {string[]}
 */
function extractBlockquotesText(postContent) {
    return [...postContent.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)]
        .map((m) =>
            unescapeHtmlEntities(
                m[1]
                    .replace(/<br\s*\/?>/gi, ' / ')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
            )
        )
        .filter(Boolean);
}

/**
 * Builds the comprehensive /llms-full.txt catalog with series statements and plate descriptions.
 * @param {Array<{ id: string, navLabel: string, canonical: string, description: string, postContent: string, images: Array<{ filename: string, alt: string, creditHandle: string | null }> }>} projectEntries
 * @returns {string}
 */
export function buildLlmsFullTxt(projectEntries) {
    const sections = projectEntries.map((p) => {
        const quotes = extractBlockquotesText(p.postContent);
        const quoteBlock =
            quotes.length > 0
                ? `\n### Epigraphs & Series Notes\n\n${quotes.map((q) => `> ${q}`).join('\n\n')}\n`
                : '';
        const plateLines = p.images
            .map((img, idx) => {
                const creditSuffix = img.creditHandle ? ` (Photo by @${img.creditHandle})` : '';
                return `${idx + 1}. \`${img.filename}\` — ${img.alt}${creditSuffix}`;
            })
            .join('\n');

        return `## ${p.navLabel}

- **URL:** ${p.canonical}
- **Summary:** ${unescapeHtmlEntities(p.description)}
- **Plate Count:** ${p.images.length}
${quoteBlock}
### Sequenced Plates

${plateLines}`;
    });

    return `${buildLlmsTxt(
        projectEntries.map((p) => ({
            id: p.id,
            navLabel: p.navLabel,
            canonical: p.canonical,
            description: p.description,
            imageCount: p.images.length,
        }))
    )}
# Complete Series & Plate Catalog

${sections.join('\n\n')}
`;
}
