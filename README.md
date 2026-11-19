# 88eggs-cli

CLI for 88eggs. Signs in with your 88eggs username (or email) and
password (the same ones you use on app.88eggs.com) and talks to the
88eggs API (`https://api.88eggs.com`) on your behalf. (`88eggs-frontend`/`88eggs-backend` are private repos, not
linked here.)

This exists so [`88eggs-skills`](https://github.com/ptk-studio/88eggs-skills)
has something to drive, mirroring how `vercel-labs/agent-skills`' deploy
skill drives the `vercel` CLI and `supabase/agent-skills` drives the
`supabase` CLI — a skill shells out to `88eggs`, `88eggs` owns its own
login, and no skill ever handles a raw token itself.

## Install

Published on npm as [`88eggs-cli`](https://www.npmjs.com/package/88eggs-cli):

```bash
npm install -g 88eggs-cli
```

Or from source, for local development on the CLI itself:

```bash
pnpm install
pnpm build
npm link   # makes the `88eggs` command available globally
```

## Commands

```bash
88eggs login           # sign in with your username/email and password
88eggs logout          # sign out, remove stored credentials
88eggs whoami           # show the currently signed-in account
88eggs projects list    # list your projects (--scope mine|shared|all)

88eggs assets list --project <projectId>   # list a project's assets (--name, --type, --page, --limit)
88eggs assets show <assetId>               # one item, incl. a signed URL
88eggs assets move <assetId> <projectId>   # move to a different project

88eggs tasks list                          # the task catalog
88eggs tasks show <slug>                    # one task's detail + parameter spec
88eggs tasks start <slug> [--project <projectId>] [--name <name>] [--param key=value ...]
                                            # start a task run; unset parameters use the task's
                                            # own defaults; omit --project to use your oldest one;
                                            # omit --name to get "<task name> <random word>"
88eggs task-runs list [--project <projectId>]  # list task runs (every accessible project, or one)
                                            # (--page, --limit)
88eggs task-runs status <taskRunId>        # poll a task run's status (model, cost, outputs, result asset)

88eggs pipelines list [--project <projectId>]   # the pipeline catalog
88eggs pipelines show <slug>               # one pipeline's detail + parameter spec
88eggs pipelines start <slug> [--project <projectId>] [--name <name>] [--param key=value ...]
                                            # start a pipeline run; unset parameters use the
                                            # pipeline's own defaults
88eggs pipeline-runs list [--project <projectId>]
                                            # list pipeline runs (--page, --limit)
88eggs pipeline-runs status <pipelineRunId>  # full state: status, per-step timeline, review gates
88eggs pipeline-runs review <pipelineRunId> --approve [--field key=value ...]
88eggs pipeline-runs review <pipelineRunId> --reject
                                            # work the current review gate (approve, optionally
                                            # overriding the gate's prefilled fields; reject re-rolls)
88eggs pipeline-runs retry <pipelineRunId>   # resume a failed pipeline run from its failed step

88eggs events types                        # the known event types (the live catalog)
88eggs events list [--project <projectId>] # list events (every accessible project, or one)
                                            # (--type <eventTypeKey>, --page, --limit)

88eggs apps catalog                        # the installable app catalog (App Store)
88eggs apps install <slug> --project <projectId> [--name <name>]
                                            # install a catalog app into a project
88eggs apps list --project <projectId>     # a project's installed apps
88eggs apps show <appId>                    # one installed app
88eggs apps uninstall <appId>               # uninstall (archive) an app; its pages are kept
88eggs apps pages <appId> [--archived]      # an installed app's pages

88eggs data-tables list [--project <projectId>] [--archived]
                                            # data tables (all accessible projects, or one)
88eggs data-tables show <tableId>          # one table's schema (columns)
88eggs data-tables create <name> [--project <projectId>] [--column key:type[:label] ...]
                                            # create a table; column type is
                                            # text|textarea|number|boolean|asset; Id + status
                                            # columns are built in
88eggs data-tables update <tableId> [--name <name>] [--column key:type[:label] ...]
                                            # [--status-option <value> ...] [--archive|--restore]
88eggs data-tables publish <tableId> [--name <name>]
                                            # publish the schema to Templates (rows not shared)
88eggs data-tables rows list <tableId> [--column <key> --value <value>] [--page --limit]
88eggs data-tables rows show <tableId> <rowId>
88eggs data-tables rows add <tableId> [--cell key=value ...] [--status <status>]
88eggs data-tables rows update <tableId> <rowId> [--cell key=value ...] [--status <status>]
88eggs data-tables rows delete <tableId> <rowId>
88eggs data-tables delete <tableId>        # delete a table (rows cascade)

88eggs notes list --project <projectId> [--roots | --parent <path>] [--archived|--all] [--q <text>]
                                            # a project's notes (flat, or one level of the tree)
88eggs notes show <noteId>                  # one note (metadata + markdown content)
88eggs notes by-path --project <projectId> --path <slug>
                                            # resolve one note by its path slug
88eggs notes create <name> --project <projectId> --path <slug> [--content <md>|--content-file <file>] [--parent <path>]
                                            # path is a unique slug: ^[a-zA-Z0-9._-]+$ (e.g. README.md); --parent nests it
88eggs notes update <noteId> [--name] [--path] [--content|--content-file] [--parent <path>|--top-level] [--archive|--restore]
                                            # rename re-links children; --archive cascades to descendants

88eggs projects show <projectId>           # detail + your permissions
88eggs projects create <name> [--description <text>] [--team <teamId>]
88eggs projects update <projectId> [--name] [--description] [--team]
88eggs projects delete <projectId>         # 409 if it still has assets

88eggs pipelines clone <slug>              # duplicate within its project
88eggs pipelines publish <slug> [--name] [--description]
88eggs pipelines archive <slug> | restore <slug>

88eggs schedules list [--project <projectId>]
88eggs schedules show <scheduleId>
88eggs schedules create (--definition <slug> | --set <slug>) --cron "<expr>" --name <name>
                                            # [--timezone <tz>] [--project <id>] [--param k=v ...] [--disabled]
88eggs schedules update <scheduleId> [--name] [--cron] [--timezone] [--enable|--disable] [--param k=v ...]
88eggs schedules delete <scheduleId>

88eggs pipeline-sets list [--project <id>] [--status draft|active|archived] [--query <text>] [--json]   # read-only
88eggs pipeline-sets show <idOrSlug> [--project <id>] [--json]   # steps, ceiling, estimate, validation
88eggs pipeline-sets validate <idOrSlug> [--project <id>]        # exit code 1 when it does not validate
88eggs pipeline-set-runs list [--project <id>] [--set <idOrSlug>] [--status <s>] [--needs-me] [--json]
88eggs pipeline-set-runs status <runId> [--json]                 # cost against the ceiling, each step

88eggs templates list [--type <type>] [--q <query>]
88eggs templates show <templateId>
88eggs templates clone <templateId> [--project <projectId>] [--name <name>]

88eggs task-inputs list [--project <projectId>]  # saved input presets
88eggs task-inputs show <templateId>
88eggs task-inputs save <taskRunId> --name <name> [--description <text>]

88eggs teams list | show <teamId> | create <name> | update <teamId> --name <name> | delete <teamId>
88eggs teams members <teamId> | remove-member <teamId> <userId>
88eggs teams invitations <teamId> | invite <teamId> <email> | revoke-invitation <teamId> <invitationId>
88eggs invitations accept <invitationId> | decline <invitationId>

88eggs partner-profiles list | show <id> | create --name --slug --email | tasks <id>
88eggs partners show <slug> | tasks <slug>

88eggs apps page create <appId> --title <title> [--slug <slug>]
88eggs apps page show <appId> <pageId>
88eggs apps page update <appId> <pageId> [--title] [--slug] [--archive|--restore]
88eggs apps public-page <slug>             # a public page's metadata

88eggs events show <eventId>               # one event's detail
88eggs models                              # the supported-model catalog
88eggs profile show | update [--name] [--description]
88eggs messages list | read <messageId>
```

## Using this with an agent

Install [`88eggs-skills`](https://github.com/ptk-studio/88eggs-skills)
to let an agent (Claude Code, etc.) drive this CLI on your behalf:

```bash
npx skills add ptk-studio/88eggs-skills --skill list-projects
```

The skill checks `88eggs whoami` first and only runs `88eggs login`
after asking you — since it prompts for your password — so `88eggs-cli` still needs to be installed and on your
`PATH` (see **Install** above) before the skill can do anything.

## How auth works

Since 0.10.0 the CLI signs in through the 88eggs API's own Better Auth
sign-in (Supabase was removed from 88eggs in 2026-11):

1. `88eggs login` asks for your username or email and your password
   (typed with echo off; `-u <name>` skips the first prompt).
2. It sends them once, over HTTPS, to `POST https://api.88eggs.com/auth/sign-in`,
   which answers with a session token. The password is never stored.
3. The token is written to `~/.88eggs/credentials.json` (mode `600`) and
   sent as `Authorization: Bearer <token>` on every other command.
4. There's no refresh token: when the session ends, the API answers 401
   and the CLI says to run `88eggs login` again. `88eggs logout` revokes
   the session on the API and deletes the file.

A credentials file from an older (Supabase-based) version is treated as
"not signed in": run `88eggs login` once after upgrading.

`88eggs whoami` asks the API (`GET /profile`) who the stored session
belongs to, so an ended session shows up as "not signed in".

## Local development

Point the CLI at a local `88eggs-backend` instead of production. Env
vars are prefixed `EGGS_`, not `88EGGS_` — shell env var names can't
start with a digit:

```bash
EGGS_API_URL=http://localhost:3000 88eggs login
```

## Testing

```bash
pnpm test        # unit tests (credentials storage, the API client, login)
pnpm typecheck
pnpm lint
```

Login is unit-tested with a mocked API (`src/commands/login.test.ts`):
it posts to `/auth/sign-in` and stores only the session token, never
the password. The live sign-in needs a real account, so it's checked by
hand after a release: `88eggs login`, then `88eggs whoami` and
`88eggs projects list`.

