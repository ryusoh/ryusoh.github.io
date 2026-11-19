#!/usr/bin/env bash
# check-mirror — probe live gallery fallback markup, CSP, mirror reachability,
# byte-size parity with primary, anti-hotlink 403, and missing-object 404.
# Used by both `make mirror-check` and .github/workflows/mirror-check.yml.

set -euo pipefail

MIRROR_ORIGIN="${MIRROR_ORIGIN:-https://lyeutsaon-mirror.oss-cn-hangzhou.aliyuncs.com}"
PAGE_URL="${PAGE_URL:-https://www.lyeutsaon.com/p1/}"
MIRROR_HOST="${MIRROR_ORIGIN#https://}"
MIRROR_HOST="${MIRROR_HOST#http://}"

html=$(curl -fsS -m 30 "$PAGE_URL")

# No `echo | grep -q` pipes: under pipefail, grep -q exiting on
# first match SIGPIPEs the writer and the pipeline reports 141.
grep -q "data-fallbacks='\[\"$MIRROR_ORIGIN" <<< "$html" \
    || { echo "FAIL: $PAGE_URL has no mirror data-fallbacks for $MIRROR_ORIGIN"; exit 1; }

grep -o 'img-src [^;]*' <<< "$html" | grep -qF "$MIRROR_HOST" \
    || { echo "FAIL: CSP img-src missing mirror origin ($MIRROR_HOST)"; exit 1; }

url=$(grep -o "data-fallbacks='\[\"[^\"]*" <<< "$html" | awk 'NR==1 {sub(/.*\["/, ""); print}')
primary="https://www.lyeutsaon.com${url#"$MIRROR_ORIGIN"}"
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

echo "OK: fallbacks present, CSP allows mirror, bytes match ($m), hotlink blocked, 404 sane"
