#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://3.18.213.49}"
EXPECT_PREVIEW_BYPASS="${EXPECT_PREVIEW_BYPASS:-false}"
CURL_TIMEOUT="${CURL_TIMEOUT:-15}"

BASE_URL="${BASE_URL%/}"
API_BASE="$BASE_URL/api/v1"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

BODY_FILE="$WORK_DIR/body.json"
HEADERS_FILE="$WORK_DIR/headers.txt"

request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth="${4:-}"

  local args=(-sS -m "$CURL_TIMEOUT" -X "$method" -D "$HEADERS_FILE" -o "$BODY_FILE")
  args+=(-H "Accept: application/json")

  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi

  if [[ -n "$auth" ]]; then
    args+=(-H "Authorization: Bearer $auth")
  fi

  curl "${args[@]}" -w "%{http_code}" "$url"
}

assert_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL $label: expected HTTP $expected, got HTTP $actual"
    cat "$BODY_FILE"
    echo
    exit 1
  fi

  echo "OK   $label: HTTP $actual"
}

assert_2xx() {
  local actual="$1"
  local label="$2"

  if [[ ! "$actual" =~ ^2[0-9][0-9]$ ]]; then
    echo "FAIL $label: expected HTTP 2xx, got HTTP $actual"
    cat "$BODY_FILE"
    echo
    exit 1
  fi

  echo "OK   $label: HTTP $actual"
}

assert_not_2xx() {
  local actual="$1"
  local label="$2"

  if [[ "$actual" =~ ^2[0-9][0-9]$ ]]; then
    echo "FAIL $label: expected non-2xx, got HTTP $actual"
    cat "$BODY_FILE"
    echo
    exit 1
  fi

  echo "OK   $label: HTTP $actual"
}

assert_header_contains() {
  local header="$1"
  local expected="$2"
  local label="$3"

  if ! grep -i "^$header:" "$HEADERS_FILE" | grep -iq "$expected"; then
    echo "FAIL $label: missing header $header containing $expected"
    cat "$HEADERS_FILE"
    exit 1
  fi

  echo "OK   $label"
}

extract_access_token() {
  node -e "const fs=require('fs'); const body=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(body.data?.accessToken || body.accessToken || '');" "$BODY_FILE"
}

echo "Target: $BASE_URL"
echo "Preview bypass expected: $EXPECT_PREVIEW_BYPASS"

status="$(request GET "$BASE_URL/health/live")"
assert_status "$status" "200" "health/live"
assert_header_contains "x-content-type-options" "nosniff" "helmet nosniff header"

status="$(request GET "$BASE_URL/health/ready")"
assert_status "$status" "200" "health/ready"

status="$(request GET "$API_BASE/pessoas")"
assert_status "$status" "401" "protected route rejects anonymous request"

status="$(request POST "$API_BASE/auth/session/exchange" '{"firebaseIdToken":"dev-token"}')"

if [[ "$EXPECT_PREVIEW_BYPASS" == "true" ]]; then
  assert_2xx "$status" "preview dev-token exchange"
  ACCESS_TOKEN="$(extract_access_token)"

  if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "FAIL preview dev-token exchange: accessToken not found"
    cat "$BODY_FILE"
    echo
    exit 1
  fi

  for path in empresas-prestadoras clientes contratos pessoas network/graph; do
    status="$(request GET "$API_BASE/$path" "" "$ACCESS_TOKEN")"
    assert_2xx "$status" "authenticated GET /api/v1/$path"
  done
else
  assert_not_2xx "$status" "production rejects dev-token exchange"
fi

if [[ "$BASE_URL" == https://* ]]; then
  status="$(request GET "$BASE_URL/health/live")"
  assert_status "$status" "200" "https health/live"
  assert_header_contains "strict-transport-security" "max-age" "hsts header"
fi

echo "Security smoke test completed."
