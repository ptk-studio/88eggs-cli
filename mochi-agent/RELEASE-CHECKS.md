# Release checks: 88eggs-cli

A release here is a **new version published to npm** (`88eggs-cli`). The service checks for the backend it calls are in
88eggs-backend's `mochi-agent/RELEASE-CHECKS.md`. The worker (mm1-worker2) runs every check and lists the results in
the release PR (step, pass/fail, evidence, date). Publishing to npm is the Owner's step unless a recorded approval says otherwise.

## First run (blocking)

**Why:** Divorce Legal 1.1 crashed for new users at the end of onboarding, and every check before release had walked a
path with onboarding already done (post-mortem: `mochi-factory/knowledge/solutions/2026-11-19-divorce-legal-onboarding-crash.md`,
ptk-studio#235, #237). For a CLI the same trap is testing only from **our** machine, already signed in, from the source
checkout. **A failure here stops the release.**

| # | Check | What proves it |
|---|---|---|
| F1 | **Install the packed package** (`npm pack`) into an empty prefix, the way `npm install -g 88eggs-cli` does, with an **empty HOME** (no `~/.88eggs/`) | `tools/first-run.sh`: `PASS install of the packed …` |
| F2 | `--version` prints the version in `package.json`; `--help` lists the commands | `PASS` rows |
| F3 | **Never signed in:** `whoami` and a command that needs an account (`projects list`) say to run `88eggs login`, exit 1, **no stack trace**, and no credentials file is written | `PASS` rows; `tools/first-run.sh` exits 0 |
| F4 | **The first sign-in** (`88eggs login`, the browser flow) **with a test account**, then one read (`projects list`) and `logout`; the credentials file is mode `600`. Never the Owner's account | noted in the PR (account: the test one; date) |
| F5 | **A changed command, first use:** run it once against a test project (the scratch app `47Q1hn62ASKu-GLLbJ0RP` for Social Posts), including its error path (a wrong id → a clear message, exit 1) | the commands and their output in the PR |
| F6 | **The scorecard line:** *"First run on a fresh install: PASS (evidence: tools/first-run.sh output + the test-account sign-in, date)"* | in the PR |

```
bash tools/first-run.sh      # F1–F3; needs npm and network for the dependencies, no account
```

## Before the release

| # | Step | Expected |
|---|---|---|
| R1 | `pnpm install && pnpm build && pnpm test` | all pass |
| R2 | The version in `package.json` raised; the README's command list matches `--help` | yes |
| R3 | No token is printed by any new output path (AGENTS.md, Authentication) | reviewed in the PR |

## After the release

| # | Step | Expected |
|---|---|---|
| P1 | `npm view 88eggs-cli version` | the new version |
| P2 | `tools/first-run.sh` again, now from the published package (`npm install -g 88eggs-cli` in an empty prefix and HOME) | all `PASS` |
