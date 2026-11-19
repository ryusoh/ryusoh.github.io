#!/usr/bin/env node
/**
 * probe-china — Mainland China DNS (AliDNS DoH) and HTTPS reachability probe
 * via Globalping (https://api.globalping.io). Zero external dependencies.
 *
 * Usage:
 *   node scripts/probe-china.mjs [--limit 5] [--resolver 223.5.5.5]
 */

const SITE_HOST = process.env.SITE_HOST || 'www.lyeutsaon.com';
const APEX_HOST = process.env.APEX_HOST || 'lyeutsaon.com';
const MIRROR_HOST = process.env.MIRROR_HOST || 'lyeutsaon-mirror.oss-cn-hangzhou.aliyuncs.com';
const MIRROR_PATH = process.env.MIRROR_PATH || '/assets/img/p1/DSCF4775-1200.webp';

function parseArgs(argv) {
    const opts = { limit: 5, resolver: '' };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--limit' && argv[i + 1]) {
            opts.limit = Math.max(1, Number.parseInt(argv[++i], 10) || 5);
        } else if (argv[i] === '--resolver' && argv[i + 1]) {
            opts.resolver = argv[++i];
        }
    }
    return opts;
}

async function queryAliDns(name, type) {
    const url = `https://dns.alidns.com/resolve?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
        throw new Error(`AliDNS HTTP ${res.status} for ${name} type=${type}`);
    }
    const data = await res.json();
    return Array.isArray(data.Answer) ? data.Answer.map((a) => a.data) : [];
}

async function checkDns() {
    let ok = true;
    console.log('=== AliDNS (China) DNS & ECH Check ===');
    for (const host of [SITE_HOST, APEX_HOST]) {
        const aRecs = await queryAliDns(host, 1);
        const httpsRecs = await queryAliDns(host, 65);
        const hasEch = httpsRecs.some((v) => /ech=|cloudflare-ech\.com/i.test(v));
        const hasCfIp = aRecs.some((ip) => /^(104\.21\.|172\.67\.)/.test(ip));
        console.log(`  ${host}: A=[${aRecs.join(', ')}] TYPE65=[${httpsRecs.join(', ')}]`);
        if (hasEch || hasCfIp) {
            console.error(
                `  FAIL: ${host} still points to Cloudflare proxy/ECH (${aRecs.join(', ')})`
            );
            ok = false;
        }
    }
    return ok;
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGlobalpingHttp({ target, path, expectedCode, limit, resolver }) {
    const measurementOptions = {
        protocol: 'HTTPS',
        port: 443,
        request: { path, method: 'HEAD' },
    };
    if (resolver) {
        measurementOptions.resolver = resolver;
    }

    const createRes = await fetch('https://api.globalping.io/v1/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'ryusoh-china-probe/1.0' },
        body: JSON.stringify({
            type: 'http',
            target,
            locations: [{ country: 'CN', limit }],
            measurementOptions,
        }),
        signal: AbortSignal.timeout(15000),
    });
    if (!createRes.ok) {
        throw new Error(`Globalping create failed: HTTP ${createRes.status}`);
    }
    const { id } = await createRes.json();

    let data = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
        await sleep(1500);
        const pollRes = await fetch(`https://api.globalping.io/v1/measurements/${id}`, {
            signal: AbortSignal.timeout(15000),
        });
        data = await pollRes.json();
        if (data.status !== 'in-progress') {
            break;
        }
    }

    const results = (data && data.results) || [];
    let passed = 0;
    console.log(`\n=== CN HTTPS HEAD https://${target}${path} (expect ${expectedCode}) ===`);
    for (const item of results) {
        const p = item.probe || {};
        const r = item.result || {};
        const ok = r.status === 'finished' && r.statusCode === expectedCode;
        if (ok) {
            passed += 1;
        }
        const t = r.timings || {};
        const label = `${p.city || '?'} (${p.network || '?'} AS${p.asn || '?'})`;
        const detail = ok
            ? `code=${r.statusCode} ip=${r.resolvedAddress || '?'} ttfb=${t.firstByte ?? '?'}ms total=${t.total ?? '?'}ms`
            : `FAIL status=${r.status} code=${r.statusCode ?? 'none'} total=${t.total ?? '?'}ms`;
        console.log(`  [${label}] ${detail}`);
    }
    console.log(`  Summary: ${passed}/${results.length} passed`);
    return results.length > 0 && passed > 0;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const dnsOk = await checkDns();
    const probes = [
        { target: SITE_HOST, path: '/', expectedCode: 200 },
        { target: SITE_HOST, path: '/p1/', expectedCode: 200 },
        { target: APEX_HOST, path: '/', expectedCode: 301 },
        { target: MIRROR_HOST, path: MIRROR_PATH, expectedCode: 200 },
    ];

    let allOk = dnsOk;
    for (const probe of probes) {
        const ok = await runGlobalpingHttp({ ...probe, ...opts });
        if (!ok) {
            allOk = false;
        }
    }

    if (!allOk) {
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(`probe-china error: ${err.message}`);
    process.exitCode = 1;
});
