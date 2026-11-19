#!/usr/bin/env bash
# check-mirror — probe live origin health (direct GitHub Pages, no Cloudflare
# proxy/ECH/Rocket Loader, apex HTTPS 301), gallery fallback markup, CSP,
# mirror reachability, byte-size parity with primary, anti-hotlink 403, and
# missing-object 404.
# Used by both `make mirror-check` and .github/workflows/mirror-check.yml.

set -euo pipefail

MIRROR_ORIGIN="${MIRROR_ORIGIN:-https://lyeutsaon-mirror.oss-cn-hangzhou.aliyuncs.com}"
PAGE_URL="${PAGE_URL:-https://www.lyeutsaon.com/p1/}"
APEX_URL="${APEX_URL:-https://lyeutsaon.com/}"
SITE_HOST="${SITE_HOST:-www.lyeutsaon.com}"
APEX_HOST="${APEX_HOST:-lyeutsaon.com}"
MIRROR_HOST="${MIRROR_ORIGIN#https://}"
MIRROR_HOST="${MIRROR_HOST#http://}"

# 1. Origin & proxy regression guard: Cloudflare Free proxy advertises
#    cloudflare-ech.com (TYPE65 ECH) + QUIC and suffers severe evening packet
#    loss from Mainland China ISPs, breaking visitors before fallbacks run.
hdrs=$(curl -fsSI -m 30 "$PAGE_URL")
server=$(grep -i '^server:' <<< "$hdrs" | awk 'NR==1 {gsub(/\r/, ""); print tolower($2)}')
[ "$server" = "github.com" ] \
    || { echo "FAIL: $PAGE_URL served by '$server' (want github.com — check Cloudflare DNS-only)"; exit 1; }

apex_hdrs=$(curl -sSI -m 30 "$APEX_URL")
apex_code=$(awk 'NR==1 {gsub(/\r/, ""); print $2}' <<< "$apex_hdrs")
apex_loc=$(grep -i '^location:' <<< "$apex_hdrs" | awk 'NR==1 {gsub(/\r/, ""); print $2}')
[ "$apex_code" = "301" ] && [ "$apex_loc" = "https://$SITE_HOST/" ] \
    || { echo "FAIL: $APEX_URL returned $apex_code -> '$apex_loc' (want 301 -> https://$SITE_HOST/)"; exit 1; }

for host in "$SITE_HOST" "$APEX_HOST"; do
    doh=$(curl -fsS -m 15 -H 'accept: application/dns-json' \
        "https://cloudflare-dns.com/dns-query?name=${host}&type=HTTPS")
    if grep -qi 'cloudflare-ech\.com\|ech=' <<< "$doh"; then
        echo "FAIL: $host advertises HTTPS/ECH DNS record (Cloudflare proxy enabled?)"
        exit 1
    fi
done

# 2. Live gallery fallback markup, CSP, and absence of Cloudflare HTML injection
html=$(curl -fsS -m 30 "$PAGE_URL")

if grep -qE 'rocket-loader|/cdn-cgi/' <<< "$html"; then
    echo "FAIL: $PAGE_URL contains Cloudflare injected markup (rocket-loader or /cdn-cgi/)"
    exit 1
fi

# No `echo | grep -q` pipes: under pipefail, grep -q exiting on
# first match SIGPIPEs the writer and the pipeline reports 141.
grep -q "data-fallbacks='\[\"$MIRROR_ORIGIN" <<< "$html" \
    || { echo "FAIL: $PAGE_URL has no mirror data-fallbacks for $MIRROR_ORIGIN"; exit 1; }

grep -o 'img-src [^;]*' <<< "$html" | grep -qF "$MIRROR_HOST" \
    || { echo "FAIL: CSP img-src missing mirror origin ($MIRROR_HOST)"; exit 1; }

# 3. Mirror reachability, byte parity, anti-hotlink 403, missing-object 404
url=$(grep -o "data-fallbacks='\[\"[^\"]*" <<< "$html" | awk 'NR==1 {sub(/.*\["/, ""); print}')
primary="https://${SITE_HOST}${url#"$MIRROR_ORIGIN"}"
echo "probing $url"

tmp_body=$(mktemp)
trap 'rm -f "$tmp_body"' EXIT

code=$(curl -sS -o "$tmp_body" -m 30 -w '%{http_code}' "$url")
if [ "$code" != 200 ]; then
    oss_code=$(grep -o '<Code>[^<]*</Code>' "$tmp_body" | awk 'NR==1 {gsub(/<\/?Code>/, ""); print}' || true)
    oss_ec=$(grep -o '<EC>[^<]*</EC>' "$tmp_body" | awk 'NR==1 {gsub(/<\/?EC>/, ""); print}' || true)
    echo "FAIL: mirror returned $code (want 200)${oss_code:+ Code=$oss_code}${oss_ec:+ EC=$oss_ec}"
    exit 1
fi

m=$(curl -sSI -m 30 "$url" | grep -i '^content-length' | tr -d '\r' | awk '{print $2}')
p=$(curl -sSI -m 30 "$primary" | grep -i '^content-length' | tr -d '\r' | awk '{print $2}')
[ -n "$m" ] && [ "$m" = "$p" ] \
    || { echo "FAIL: size mismatch mirror=$m primary=$p"; exit 1; }

code=$(curl -sS -o /dev/null -m 30 -H 'Referer: https://evil.example/' -w '%{http_code}' "$url")
[ "$code" = 403 ] || { echo "FAIL: hotlink referer returned $code (want 403)"; exit 1; }

code=$(curl -sS -o /dev/null -m 30 -w '%{http_code}' "$MIRROR_ORIGIN/assets/img/p1/__nonexistent__-1200.webp")
[ "$code" = 404 ] || { echo "FAIL: missing object returned $code (want 404)"; exit 1; }

echo "OK: origin direct GitHub Pages (no ECH/CF), apex 301 valid, fallbacks & CSP ok, bytes match ($m), hotlink blocked, 404 sane"
