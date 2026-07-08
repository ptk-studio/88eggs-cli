#!/usr/bin/env node
import { Command } from "commander";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { whoami } from "./commands/whoami.js";
import { listProjects } from "./commands/projects.js";
import {
  addMediaTag,
  likeMedia,
  listLikedMedia,
  listMedia,
  listMediaTags,
  moveMedia,
  removeMediaTag,
  showMedia,
  unlikeMedia,
} from "./commands/media.js";
import { listWorkflows, runWorkflow, showWorkflow } from "./commands/workflows.js";
import { listRuns, runStatus } from "./commands/runs.js";
import { listEventTypes, listEvents } from "./commands/events.js";

const program = new Command();

program.name("88eggs").description("CLI for 88eggs").version("0.1.0");

program
  .command("login")
  .description("Sign in with Google via your browser")
  .action(login);

program
  .command("logout")
  .description("Sign out and remove stored credentials")
  .action(logout);

program
  .command("whoami")
  .description("Show the currently signed-in account")
  .action(whoami);

const projects = program.command("projects").description("Manage 88eggs projects");

projects
  .command("list")
  .description("List your projects")
  .option("--scope <scope>", "mine, shared, or all", "all")
  .action((options: { scope: "mine" | "shared" | "all" }) => listProjects(options));

const media = program.command("media").description("Browse and manage media");

media
  .command("list")
  .description("List a project's media")
  .requiredOption("--project <projectId>", "project to list media from")
  .option("--tag <tag>", "filter by tag")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action((options: { project: string; tag?: string; page?: string; limit?: string }) =>
    listMedia(options),
  );

media
  .command("liked")
  .description("List your liked media, across every accessible project")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action((options: { page?: string; limit?: string }) => listLikedMedia(options));

media
  .command("tags")
  .description("List distinct tags (across all accessible projects, or one project with --project)")
  .option("--project <projectId>", "scope to one project")
  .action((options: { project?: string }) => listMediaTags(options));

// .allowUnknownOption() on every command below whose only arguments are
// bare ids/tags (no real options of their own to typo-check): ids are
// nanoid-generated (see 88eggs-backend's `nanoid()`), whose alphabet
// includes `-`, so an id can start with a dash. Commander otherwise
// parses a leading-dash positional as an unrecognized option and errors
// out -- intermittent (~1.5% of ids) and impossible for a caller to work
// around, so this isn't optional polish.
media
  .command("show <mediaId>")
  .description("Show one media item, including a signed URL")
  .allowUnknownOption()
  .action((mediaId: string) => showMedia(mediaId));

media
  .command("move <mediaId> <projectId>")
  .description("Move media to a different project")
  .allowUnknownOption()
  .action((mediaId: string, projectId: string) => moveMedia(mediaId, projectId));

media
  .command("like <mediaId>")
  .description("Like a media item")
  .allowUnknownOption()
  .action((mediaId: string) => likeMedia(mediaId));

media
  .command("unlike <mediaId>")
  .description("Unlike a media item")
  .allowUnknownOption()
  .action((mediaId: string) => unlikeMedia(mediaId));

const mediaTag = media.command("tag").description("Add/remove a single tag on a media item");

mediaTag
  .command("add <mediaId> <tag>")
  .description("Add one tag")
  .allowUnknownOption()
  .action((mediaId: string, tag: string) => addMediaTag(mediaId, tag));

mediaTag
  .command("remove <mediaId> <tag>")
  .description("Remove one tag")
  .allowUnknownOption()
  .action((mediaId: string, tag: string) => removeMediaTag(mediaId, tag));

const workflows = program.command("workflows").description("Browse and run 88eggs workflows");

workflows
  .command("list")
  .description("List the workflow catalog")
  .action(() => listWorkflows());

workflows
  .command("show <slug>")
  .description("Show one workflow's detail + parameter spec")
  .allowUnknownOption()
  .action((slug: string) => showWorkflow(slug));

workflows
  .command("run <slug>")
  .description("Start a run (unset parameters fall back to the workflow's own defaults)")
  .option("--project <projectId>", "defaults to your oldest project if omitted")
  .option(
    "--param <keyValue>",
    'a "key=value" parameter override, repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .action((slug: string, options: { project?: string; param: string[] }) =>
    runWorkflow(slug, options),
  );

const runs = program.command("runs").description("Check on workflow runs");

runs
  .command("list")
  .description("List runs (every accessible project, or one with --project)")
  .option("--project <projectId>", "limit to one project")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action((options: { project?: string; page?: string; limit?: string }) =>
    listRuns(options),
  );

runs
  .command("status <runId>")
  .description("One run's status (for polling), with its jobs")
  .allowUnknownOption()
  .action((runId: string) => runStatus(runId));

const events = program.command("events").description("Browse the activity log (runs/jobs/media)");

events
  .command("types")
  .description("List the known event types (run/job started/finished, media added)")
  .action(() => listEventTypes());

events
  .command("list")
  .description("List events (every accessible project, or one with --project)")
  .option("--project <projectId>", "limit to one project")
  .option("--type <eventTypeKey>", "filter to one event type (see `events types`)")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action(
    (options: { project?: string; type?: string; page?: string; limit?: string }) =>
      listEvents(options),
  );

program.parseAsync(process.argv);
