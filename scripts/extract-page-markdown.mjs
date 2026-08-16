#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Losslessly extracts markdown content and metadata from an existing portfolio HTML page.
 * @param {string} pageId e.g. 'p1'
 */
export function extractPageMarkdown(pageId) {
    const cleanId = pageId.toLowerCase().trim();
    const htmlPath = path.join(ROOT_DIR, cleanId, 'index.html');
    if (!fs.existsSync(htmlPath)) {
        throw new Error(`Page not found: ${htmlPath}`);
    }

    const html = fs.readFileSync(htmlPath, 'utf8');

    // Title / Heading
    const headingMatch = html.match(/<div class="post-heading">\s*<h1>(.*?)<\/h1>/s);
    const title = headingMatch ? headingMatch[1].trim() : cleanId.toUpperCase();

    // Description
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*?)"\s*\/?>/s);
    const description = descMatch ? descMatch[1].trim() : '';

    // Keywords
    const keyMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*?)"\s*\/?>/s);
    const keywordsList = keyMatch
        ? keyMatch[1]
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean)
        : ['Zhuang Liu', 'street photography'];

    // Post content
    const contentMatch = html.match(
        /<div class="container-narrow post-content">\s*([\s\S]*?)\s*<\/div>\s*<div class="project-footer">/
    );
    if (!contentMatch) {
        throw new Error(`Could not locate .post-content container in ${htmlPath}`);
    }
    const postContent = contentMatch[1];

    // Extract elements in exact sequential order
    const regex = /<img[^>]*src="([^"]+)"|<blockquote[\s\S]*?<\/blockquote>|<hr\s*\/?>/gi;
    let match;
    const bodyLines = [];

    while ((match = regex.exec(postContent)) !== null) {
        if (match[1]) {
            // Image tag
            const src = match[1];
            if (src.includes('mobile-banner')) continue;
            const filename = path.basename(src);

            // Alt text
            const fullImg = match[0];
            const altMatch = fullImg.match(/alt="([^"]*?)"/);
            const altText = altMatch ? altMatch[1].trim() : '';
            if (altText && altText !== 'Street photography by Zhuang Liu' && altText !== 'Banner') {
                bodyLines.push(`${filename} | ${altText}`);
            } else {
                bodyLines.push(filename);
            }
        } else if (match[0].startsWith('<blockquote')) {
            // Blockquote
            const rawBlock = match[0];
            let quoteText = rawBlock
                .replace(/<\/?blockquote>/gi, '')
                .replace(/<footer[\s\S]*?<\/footer>/gi, '')
                .trim();

            // Extract footer attribution if present
            const footerMatch = rawBlock.match(/<footer[\s\S]*?<\/footer>/i);

            // Convert paragraphs
            const pMatches = [...quoteText.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
            const formattedParas = [];

            if (pMatches.length > 0) {
                for (const pm of pMatches) {
                    const lines = pm[1]
                        .split(/<br\s*\/?>/i)
                        .map((l) => l.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
                        .filter(Boolean);
                    if (lines.length > 1) {
                        formattedParas.push(lines.join('\n> <br />\n> '));
                    } else if (lines.length === 1) {
                        formattedParas.push(lines[0]);
                    }
                }
            } else {
                formattedParas.push(quoteText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
            }

            let mdQuote = '> ' + formattedParas.join('\n>\n> ');
            if (footerMatch) {
                const cleanFooter = footerMatch[0].replace(/\s+/g, ' ').trim();
                mdQuote += '\n>\n> ' + cleanFooter;
            }
            bodyLines.push({ type: 'quote', text: mdQuote });
        } else {
            // HR
            bodyLines.push({ type: 'hr', text: '---' });
        }
    }

    // Build markdown body with clean grouping
    const bodyChunks = [];
    let currentImageGroup = [];

    function flushImages() {
        if (currentImageGroup.length > 0) {
            bodyChunks.push(currentImageGroup.join('\n'));
            currentImageGroup = [];
        }
    }

    for (const item of bodyLines) {
        if (typeof item === 'string') {
            currentImageGroup.push(item);
        } else {
            flushImages();
            bodyChunks.push(item.text);
        }
    }
    flushImages();

    const BASE_KEYWORDS = new Set([
        'Zhuang Liu',
        'Zhuang Liu photographer',
        'Zhuang Liu photography',
        'street photography',
    ]);
    const uniqueKeywords = keywordsList.filter((k) => !BASE_KEYWORDS.has(k));

    const frontmatterLines = [
        '---',
        `title: "${title}"`,
        `description: "${description}"`,
    ];

    if (uniqueKeywords.length > 0) {
        frontmatterLines.push('keywords:');
        uniqueKeywords.forEach((k) => frontmatterLines.push(`  - "${k}"`));
    }
    frontmatterLines.push('---');

    const finalMarkdown = `${frontmatterLines.join('\n')}\n\n${bodyChunks.join('\n\n')}\n`;
    const targetDir = path.join(ROOT_DIR, 'assets', 'img', cleanId);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, 'index.md');
    fs.writeFileSync(targetPath, finalMarkdown, 'utf8');
    console.log(`Extracted markdown: ${targetPath}`);
    return targetPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const pageId = process.argv[2];
    if (!pageId) {
        console.error('Usage: node scripts/extract-page-markdown.mjs <pageId>');
        process.exit(1);
    }
    extractPageMarkdown(pageId);
}
