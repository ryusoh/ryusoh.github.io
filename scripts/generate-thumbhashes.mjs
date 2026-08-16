import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { rgbaToThumbHash, thumbHashToDataURL } from 'thumbhash';

function getProjectPages() {
    const assetsDir = path.join('assets', 'img');
    if (!fs.existsSync(assetsDir)) return ['p1', 'p2', 'p3', 'p4'];
    return fs
        .readdirSync(assetsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^p\d+$/i.test(d.name))
        .map((d) => d.name)
        .sort((a, b) => {
            const numA = parseInt(a.slice(1), 10);
            const numB = parseInt(b.slice(1), 10);
            return numA - numB;
        });
}

const pages = getProjectPages();

async function generateThumbHashes() {
    const hashMap = {};
    const dataUrlMap = {};

    for (const page of pages) {
        const dir = path.join('assets', 'img', page);
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|JPG)$/i.test(f));

        for (const file of files) {
            const inputPath = path.join(dir, file);
            const image = sharp(inputPath);
            const { data, info } = await image
                .resize(100, 100, { fit: 'inside' })
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const hash = rgbaToThumbHash(info.width, info.height, data);
            const base64 = Buffer.from(hash).toString('base64');
            const dataUrl = thumbHashToDataURL(hash);
            const srcKey = `/assets/img/${page}/${file}`;
            hashMap[srcKey] = base64;
            dataUrlMap[srcKey] = dataUrl;
            console.log(`${file}: ${base64}`);
        }
    }

    console.log(`\nGenerated ${Object.keys(hashMap).length} ThumbHashes.`);

    for (const page of pages) {
        const htmlPath = path.join(page, 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Inject data-thumbhash and inline style into <img> tags
        html = html.replace(/<img\s+([^>]*?src="([^"]+?)"[^>]*?)\s*\/?>/gs, (match, attrs, src) => {
            if (match.includes('mobile-banner')) return match;
            const hash = hashMap[src];
            const dataUrl = dataUrlMap[src];
            if (!hash || !dataUrl) return match;

            const cleanAttrs = attrs
                .replace(/\s*data-thumbhash="[^"]*"/g, '')
                .replace(/\s*style="[^"]*"/g, '')
                .trim();

            return `<img data-thumbhash="${hash}" style="background-image: url('${dataUrl}'); background-size: cover; background-position: center;" ${cleanAttrs} />`;
        });

        // Add script tags for vendor/thumbhash.js and js/thumbhash-init.js if not present
        if (!html.includes('thumbhash-init.js')) {
            html = html.replace(
                '</head>',
                '    <script src="/js/vendor/thumbhash.js" defer></script>\n    <script src="/js/thumbhash-init.js" defer></script>\n</head>'
            );
        }

        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log(`Updated ${htmlPath}`);
    }
}

generateThumbHashes().catch((err) => {
    console.error(err);
    process.exit(1);
});
