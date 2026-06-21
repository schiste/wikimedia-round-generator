#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

TOOLFORGE_SSH_USER="${TOOLFORGE_SSH_USER:-schiste}"
TOOLFORGE_SSH_HOST="${TOOLFORGE_SSH_HOST:-login.toolforge.org}"
TOOLFORGE_SSH_KEY="${TOOLFORGE_SSH_KEY:-$HOME/.ssh/id_ed25519_toolforge}"
TOOLFORGE_TOOL="${TOOLFORGE_TOOL:-logo-round-gen}"
TOOLFORGE_REPO_DIR="${TOOLFORGE_REPO_DIR:-/data/project/logo-round-gen/www/js}"
TOOLFORGE_BRANCH="${TOOLFORGE_BRANCH:-main}"
TOOLFORGE_WEBSERVICE_TYPE="${TOOLFORGE_WEBSERVICE_TYPE:-node20}"
TOOLFORGE_WEB_URL="${TOOLFORGE_WEB_URL:-https://logo-round-gen.toolforge.org}"
TOOLFORGE_READY_TIMEOUT_SECONDS="${TOOLFORGE_READY_TIMEOUT_SECONDS:-180}"
TOOLFORGE_READY_POLL_SECONDS="${TOOLFORGE_READY_POLL_SECONDS:-5}"
TOOLFORGE_VERIFY_TIMEOUT_SECONDS="${TOOLFORGE_VERIFY_TIMEOUT_SECONDS:-45}"
EXPECTED_LOGO_COUNT="${EXPECTED_LOGO_COUNT:-14}"

SKIP_BUILD=0
SKIP_PUSH=0
SKIP_REMOTE=0
VERIFY_ONLY=0

usage() {
  cat <<USAGE
Usage: $SCRIPT_NAME [options]

Build, push, deploy, restart, and verify the Toolforge logo-round-gen webservice.

Options:
  --skip-build     Do not run npm run build locally.
  --skip-push      Do not push the current branch before remote deploy.
  --skip-remote    Do not update/restart Toolforge; only run local build/push and public verification.
  --verify-only    Only run public verification for the current local HEAD.
  -h, --help       Show this help.

Environment overrides:
  TOOLFORGE_SSH_USER=$TOOLFORGE_SSH_USER
  TOOLFORGE_SSH_KEY=$TOOLFORGE_SSH_KEY
  TOOLFORGE_TOOL=$TOOLFORGE_TOOL
  TOOLFORGE_REPO_DIR=$TOOLFORGE_REPO_DIR
  TOOLFORGE_BRANCH=$TOOLFORGE_BRANCH
  TOOLFORGE_WEB_URL=$TOOLFORGE_WEB_URL
  TOOLFORGE_READY_TIMEOUT_SECONDS=$TOOLFORGE_READY_TIMEOUT_SECONDS
  TOOLFORGE_READY_POLL_SECONDS=$TOOLFORGE_READY_POLL_SECONDS
  TOOLFORGE_VERIFY_TIMEOUT_SECONDS=$TOOLFORGE_VERIFY_TIMEOUT_SECONDS
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1
      ;;
    --skip-push)
      SKIP_PUSH=1
      ;;
    --skip-remote)
      SKIP_REMOTE=1
      ;;
    --verify-only)
      VERIFY_ONLY=1
      SKIP_BUILD=1
      SKIP_PUSH=1
      SKIP_REMOTE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

short_commit="$(git rev-parse --short HEAD)"
branch="$(git branch --show-current)"

log() {
  printf '\n==> %s\n' "$*"
}

remote_quote() {
  printf '%q' "$1"
}

run_remote() {
  local command="$1"
  ssh -i "$TOOLFORGE_SSH_KEY" \
    -o BatchMode=yes \
    -o ConnectTimeout=12 \
    "$TOOLFORGE_SSH_USER@$TOOLFORGE_SSH_HOST" \
    "become $(remote_quote "$TOOLFORGE_TOOL") bash -lc $(remote_quote "$command")"
}

ensure_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short --branch
    echo "Refusing to deploy with uncommitted changes. Commit or stash them first." >&2
    exit 1
  fi
}

wait_for_public_ready() {
  local deadline status
  deadline=$(($(date +%s) + TOOLFORGE_READY_TIMEOUT_SECONDS))

  while [[ "$(date +%s)" -lt "$deadline" ]]; do
    status="$(curl --max-time "$TOOLFORGE_VERIFY_TIMEOUT_SECONDS" -fsS -o /dev/null -w '%{http_code}' "$TOOLFORGE_WEB_URL/api/healthz" || true)"
    if [[ "$status" == "200" ]]; then
      echo "Toolforge health check is ready."
      return 0
    fi

    echo "Waiting for Toolforge health check; last status: ${status:-curl-error}"
    sleep "$TOOLFORGE_READY_POLL_SECONDS"
  done

  echo "Timed out waiting for Toolforge health check after ${TOOLFORGE_READY_TIMEOUT_SECONDS}s." >&2
  exit 1
}

latest_server_log() {
  run_remote "toolforge webservice -l 120 logs | grep 'WikiRound server listening' | tail -n 1" || true
}

wait_for_fresh_server_log() {
  local previous_line="$1"
  local deadline current_line
  deadline=$(($(date +%s) + TOOLFORGE_READY_TIMEOUT_SECONDS))

  while [[ "$(date +%s)" -lt "$deadline" ]]; do
    current_line="$(latest_server_log)"
    if [[ -n "$current_line" && "$current_line" != "$previous_line" ]]; then
      echo "$current_line"
      return 0
    fi

    echo "Waiting for new Toolforge server listening log..."
    sleep "$TOOLFORGE_READY_POLL_SECONDS"
  done

  echo "Timed out waiting for a fresh Toolforge server listening log after ${TOOLFORGE_READY_TIMEOUT_SECONDS}s." >&2
  exit 1
}

verify_public() {
  log "Verifying $TOOLFORGE_WEB_URL at $short_commit"

  local headers
  headers="$(curl --max-time "$TOOLFORGE_VERIFY_TIMEOUT_SECONDS" -fsSI "$TOOLFORGE_WEB_URL/")"
  printf '%s\n' "$headers"
  grep -qi '^HTTP/.* 200' <<<"$headers"
  grep -qi '^cache-control: no-cache' <<<"$headers"

  local html asset_path asset_headers
  html="$(curl --max-time "$TOOLFORGE_VERIFY_TIMEOUT_SECONDS" -fsS -H 'Cache-Control: no-cache' "$TOOLFORGE_WEB_URL/?verify=$short_commit")"
  asset_path="$(grep -o '/assets/index-[^"]*\.js' <<<"$html" | head -n 1)"
  if [[ -z "$asset_path" ]]; then
    echo "Could not find hashed JS asset in deployed HTML." >&2
    exit 1
  fi

  asset_headers="$(curl --max-time "$TOOLFORGE_VERIFY_TIMEOUT_SECONDS" -fsSI "$TOOLFORGE_WEB_URL$asset_path")"
  printf '%s\n' "$asset_headers"
  grep -qi '^HTTP/.* 200' <<<"$asset_headers"
  grep -qi '^cache-control: public, max-age=31536000, immutable' <<<"$asset_headers"

  node --input-type=module - "$TOOLFORGE_WEB_URL" "$short_commit" "$EXPECTED_LOGO_COUNT" "$TOOLFORGE_VERIFY_TIMEOUT_SECONDS" <<'NODE'
const [baseUrl, commit, expectedLogoCount, timeoutSeconds] = process.argv.slice(2);
const timeoutMs = Number(timeoutSeconds) * 1000;

async function readJson(path) {
  console.error(`Checking ${path}`);
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${payload.message || JSON.stringify(payload)}`);
  }
  return { response, payload };
}

const health = await readJson('/api/healthz');
if (!health.payload.ok) {
  throw new Error('/api/healthz did not report ok');
}

const logos = await readJson(`/api/logos?refresh=1&verify=${encodeURIComponent(commit)}`);
const logoCount = logos.payload.logos?.length || 0;
const errorCount = logos.payload.errors?.length || 0;
const expected = Number(expectedLogoCount);
const wikimedia = logos.payload.logos?.find((logo) => logo.id === 'wikimedia');
if (logoCount !== expected || errorCount !== 0 || wikimedia?.commonsPageTitle !== 'File:Wikimedia-logo black.svg') {
  throw new Error(`Unexpected /api/logos result: ${JSON.stringify({
    logoCount,
    errorCount,
    wikimediaTitle: wikimedia?.commonsPageTitle
  })}`);
}

const title = encodeURIComponent('File:Wikimedia Armenia logo.svg');
const single = await readJson(`/api/logo?title=${title}&refresh=1&verify=${encodeURIComponent(commit)}`);
if (!single.payload.logo?.svg || single.payload.errors?.length) {
  throw new Error(`Unexpected /api/logo result: ${JSON.stringify({
    title: single.payload.logo?.commonsPageTitle,
    hasSvg: Boolean(single.payload.logo?.svg),
    errors: single.payload.errors?.length || 0
  })}`);
}

console.log(JSON.stringify({
  health: health.payload.ok,
  logos: logoCount,
  logoErrors: errorCount,
  singleLogo: single.payload.logo.commonsPageTitle,
  singleErrors: single.payload.errors?.length || 0
}, null, 2));
NODE
}

if [[ "$VERIFY_ONLY" -eq 0 ]]; then
  log "Checking local branch and worktree"
  if [[ "$branch" != "$TOOLFORGE_BRANCH" ]]; then
    echo "Refusing to deploy branch '$branch'; expected '$TOOLFORGE_BRANCH'." >&2
    exit 1
  fi
  ensure_clean_worktree

  if [[ "$SKIP_BUILD" -eq 0 ]]; then
    log "Building locally"
    npm run build
  fi

  if [[ "$SKIP_PUSH" -eq 0 ]]; then
    log "Pushing origin $TOOLFORGE_BRANCH"
    git push origin "$TOOLFORGE_BRANCH"
  fi

  if [[ "$SKIP_REMOTE" -eq 0 ]]; then
    log "Checking SSH and remote account"
    ssh -i "$TOOLFORGE_SSH_KEY" -o BatchMode=yes -o ConnectTimeout=12 "$TOOLFORGE_SSH_USER@$TOOLFORGE_SSH_HOST" 'whoami'
    run_remote 'whoami'

    log "Updating Toolforge checkout to origin/$TOOLFORGE_BRANCH"
    run_remote "git -C $(remote_quote "$TOOLFORGE_REPO_DIR") fetch origin $(remote_quote "$TOOLFORGE_BRANCH")"
    run_remote "git -C $(remote_quote "$TOOLFORGE_REPO_DIR") reset --hard origin/$(remote_quote "$TOOLFORGE_BRANCH")"

    remote_commit="$(run_remote "git -C $(remote_quote "$TOOLFORGE_REPO_DIR") rev-parse --short HEAD" | tail -n 1)"
    if [[ "$remote_commit" != "$short_commit" ]]; then
      echo "Remote commit $remote_commit does not match local commit $short_commit." >&2
      exit 1
    fi

    previous_server_log="$(latest_server_log)"

    log "Restarting Toolforge webservice"
    run_remote "toolforge webservice $(remote_quote "$TOOLFORGE_WEBSERVICE_TYPE") restart"

    log "Waiting for restarted Toolforge server log"
    wait_for_fresh_server_log "$previous_server_log"

    log "Checking Toolforge health endpoint"
    wait_for_public_ready

    log "Recent Toolforge logs"
    run_remote 'toolforge webservice -l 60 logs'
  fi
fi

verify_public

log "Deploy verification complete for $short_commit"
