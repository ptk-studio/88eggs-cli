# Scheduled work: 88eggs-cli (R93)

**Nothing is scheduled in this repo** (checked 2026-11-18: no cron, no scheduled GitHub Action; the CI workflow runs on
pushes and PRs only). Everything 88eggs runs on a schedule (the dispatch loop, the maintenance jobs, the pipeline
schedules and the Offers) runs in **88eggs-worker**: see its `SCHEDULE.md`. Hub-wide jobs that read 88eggs are in the
hub's `mochi-factory/SCHEDULE.md`. The standard: `mochi-factory/project-groups/AGENTS.md`, "Scheduled work". A
change that adds a scheduled job here adds its row in the same PR.
