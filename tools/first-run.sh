#!/bin/bash
# First run (blocking release check; ptk-studio#237): install the PACKED CLI the way a new user gets it from npm,
# into an empty prefix with an empty HOME (no ~/.88eggs/credentials.json), and check what a first-time user sees.
# Needs no account and never signs in. Exit 1 on any failure.
set -u
W=$(mktemp -d "${TMPDIR:-/tmp}/88eggs-first-run.XXXX"); trap 'rm -rf "$W"' EXIT
mkdir -p "$W/home" "$W/prefix"
fail=0
check() { # check <label> <expected exit> <expected text> -- <args...>
  local label=$1 want=$2 text=$3; shift 4
  out=$(HOME="$W/home" "$W/prefix/bin/88eggs" "$@" 2>&1); code=$?
  if [ "$code" = "$want" ] && grep -qF -- "$text" <<<"$out"; then echo "PASS  $label"; else echo "FAIL  $label (exit $code): $(head -1 <<<"$out")"; fail=1; fi
}
tgz=$(npm pack --pack-destination "$W" 2>/dev/null | tail -1) || { echo "FAIL  npm pack"; exit 1; }
HOME="$W/home" npm install -g --prefix "$W/prefix" "$W/$tgz" --no-audit --no-fund >/dev/null 2>&1 || { echo "FAIL  install of the packed $tgz"; exit 1; }
echo "PASS  install of the packed $tgz into an empty prefix"
v=$(node -p "require('./package.json').version")
check "--version prints $v" 0 "$v" -- --version
check "--help lists the commands" 0 "Usage: 88eggs" -- --help
check "whoami, never signed in: tells you to log in" 1 "88eggs login" -- whoami
check "a signed-in command, never signed in: tells you to log in, no stack trace" 1 "88eggs login" -- projects list
if HOME="$W/home" "$W/prefix/bin/88eggs" projects list 2>&1 | grep -qE "^\s+at |Error: .*\n\s+at "; then echo "FAIL  a stack trace was printed"; fail=1; fi
[ -e "$W/home/.88eggs/credentials.json" ] && { echo "FAIL  a credentials file was written without a login"; fail=1; }
exit $fail
