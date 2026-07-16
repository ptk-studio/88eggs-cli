#!/usr/bin/env node
import { Command } from "commander";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { whoami } from "./commands/whoami.js";
import { listProjects } from "./commands/projects.js";
import {
  addAssetTag,
  likeAsset,
  listLikedAssets,
  listAssets,
  listAssetTags,
  moveAsset,
  removeAssetTag,
  showAsset,
  unlikeAsset,
} from "./commands/assets.js";
import { listTaskDefinitions, showTaskDefinition, startTask } from "./commands/task-definitions.js";
import { listTasks, taskStatus } from "./commands/tasks.js";
import {
  listPipelineDefinitions,
  listPipelines,
  pipelineStatus,
  retryPipeline,
  reviewPipeline,
  showPipelineDefinition,
  startPipeline,
} from "./commands/pipelines.js";
import { listEventTypes, listEvents } from "./commands/events.js";
import {
  installApp,
  listAppCatalog,
  listAppPages,
  listInstalledApps,
  showApp,
  uninstallApp,
} from "./commands/apps.js";

const program = new Command();

program.name("88eggs").description("CLI for 88eggs").version("0.5.0");

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

const assets = program.command("assets").description("Browse and manage assets");

assets
  .command("list")
  .description("List a project's assets")
  .requiredOption("--project <projectId>", "project to list assets from")
  .option("--tag <tag>", "filter by tag")
  .option("--name <name>", "filter by (partial, case-insensitive) asset name")
  .option("--type <type>", "filter by type: image, video, or audio")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action(
    (options: {
      project: string;
      tag?: string;
      name?: string;
      type?: string;
      page?: string;
      limit?: string;
    }) => listAssets(options),
  );

assets
  .command("liked")
  .description("List your liked assets (every accessible project, or one with --project)")
  .option("--project <projectId>", "scope to one project")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action((options: { project?: string; page?: string; limit?: string }) =>
    listLikedAssets(options),
  );

assets
  .command("tags")
  .description("List distinct tags (across all accessible projects, or one project with --project)")
  .option("--project <projectId>", "scope to one project")
  .action((options: { project?: string }) => listAssetTags(options));

// .allowUnknownOption() on every command below whose only arguments are
// bare ids/tags (no real options of their own to typo-check): ids are
// nanoid-generated (see 88eggs-backend's `nanoid()`), whose alphabet
// includes `-`, so an id can start with a dash. Commander otherwise
// parses a leading-dash positional as an unrecognized option and errors
// out -- intermittent (~1.5% of ids) and impossible for a caller to work
// around, so this isn't optional polish.
assets
  .command("show <assetId>")
  .description("Show one asset, including a signed URL")
  .allowUnknownOption()
  .action((assetId: string) => showAsset(assetId));

assets
  .command("move <assetId> <projectId>")
  .description("Move an asset to a different project")
  .allowUnknownOption()
  .action((assetId: string, projectId: string) => moveAsset(assetId, projectId));

assets
  .command("like <assetId>")
  .description("Like an asset")
  .allowUnknownOption()
  .action((assetId: string) => likeAsset(assetId));

assets
  .command("unlike <assetId>")
  .description("Unlike an asset")
  .allowUnknownOption()
  .action((assetId: string) => unlikeAsset(assetId));

const assetTag = assets.command("tag").description("Add/remove a single tag on an asset");

assetTag
  .command("add <assetId> <tag>")
  .description("Add one tag")
  .allowUnknownOption()
  .action((assetId: string, tag: string) => addAssetTag(assetId, tag));

assetTag
  .command("remove <assetId> <tag>")
  .description("Remove one tag")
  .allowUnknownOption()
  .action((assetId: string, tag: string) => removeAssetTag(assetId, tag));

const taskDefinitions = program
  .command("task-definitions")
  .description("Browse the task-definition catalog and start tasks");

taskDefinitions
  .command("list")
  .description("List the task-definition catalog")
  .action(() => listTaskDefinitions());

taskDefinitions
  .command("show <slug>")
  .description("Show one task definition's detail + parameter spec")
  .allowUnknownOption()
  .action((slug: string) => showTaskDefinition(slug));

taskDefinitions
  .command("start <slug>")
  .description("Start a task (unset parameters fall back to the definition's own defaults)")
  .option("--project <projectId>", "defaults to your oldest project if omitted")
  .option("--name <name>", 'a label for the task (default: "<task definition name> <random word>")')
  .option(
    "--param <keyValue>",
    'a "key=value" parameter override, repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .action(
    (slug: string, options: { project?: string; name?: string; param: string[] }) =>
      startTask(slug, options),
  );

const tasks = program.command("tasks").description("Check on tasks");

tasks
  .command("list")
  .description("List tasks (every accessible project, or one with --project)")
  .option("--project <projectId>", "limit to one project")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action((options: { project?: string; page?: string; limit?: string }) =>
    listTasks(options),
  );

tasks
  .command("status <taskId>")
  .description("One task's status (for polling)")
  .allowUnknownOption()
  .action((taskId: string) => taskStatus(taskId));

const pipelineDefinitions = program
  .command("pipeline-definitions")
  .description("Browse the pipeline catalog and start pipelines");

pipelineDefinitions
  .command("list")
  .description("List the pipeline-definition catalog (every accessible project, or one with --project)")
  .option("--project <projectId>", "limit to one project")
  .action((options: { project?: string }) => listPipelineDefinitions(options));

pipelineDefinitions
  .command("show <slug>")
  .description("Show one pipeline definition's detail + parameter spec")
  .allowUnknownOption()
  .action((slug: string) => showPipelineDefinition(slug));

pipelineDefinitions
  .command("start <slug>")
  .description("Start a pipeline (unset parameters fall back to the definition's own defaults)")
  .option("--project <projectId>", "defaults to your oldest project if omitted")
  .option("--name <name>", "a label for the pipeline")
  .option(
    "--param <keyValue>",
    'a "key=value" parameter override, repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .action(
    (slug: string, options: { project?: string; name?: string; param: string[] }) =>
      startPipeline(slug, options),
  );

const pipelines = program
  .command("pipelines")
  .description("Check on pipelines and work their review gates");

pipelines
  .command("list")
  .description("List pipelines (every accessible project, or one with --project)")
  .option("--project <projectId>", "limit to one project")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action((options: { project?: string; page?: string; limit?: string }) =>
    listPipelines(options),
  );

pipelines
  .command("status <pipelineId>")
  .description("One pipeline's full state: status, steps, review gates")
  .allowUnknownOption()
  .action((pipelineId: string) => pipelineStatus(pipelineId));

pipelines
  .command("review <pipelineId>")
  .description("Approve or reject the current review step")
  .option("--approve", "approve the gate (optionally with edited --field values)")
  .option("--reject", "reject (re-rolls the step under review)")
  .option(
    "--field <keyValue>",
    'a "key=value" gate-field override on approval, repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .allowUnknownOption()
  .action(
    (pipelineId: string, options: { approve?: boolean; reject?: boolean; field: string[] }) =>
      reviewPipeline(pipelineId, options),
  );

pipelines
  .command("retry <pipelineId>")
  .description("Resume a failed pipeline from its failed step")
  .allowUnknownOption()
  .action((pipelineId: string) => retryPipeline(pipelineId));

const events = program
  .command("events")
  .description("Browse the activity log (tasks/assets/apps/workers)");

events
  .command("types")
  .description("List the known event types (the live catalog)")
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

const apps = program
  .command("apps")
  .description("Browse the app catalog and manage a project's installed apps");

apps
  .command("catalog")
  .description("List the installable app catalog (the App Store)")
  .action(() => listAppCatalog());

apps
  .command("list")
  .description("List a project's installed apps")
  .requiredOption("--project <projectId>", "project to list installed apps from")
  .action((options: { project: string }) => listInstalledApps(options));

apps
  .command("install <slug>")
  .description("Install a catalog app into a project (by its catalog slug)")
  .requiredOption("--project <projectId>", "project to install into")
  .option("--name <name>", "override the installed app's name (defaults to the listing's)")
  .action((slug: string, options: { project: string; name?: string }) =>
    installApp(slug, options),
  );

apps
  .command("show <appId>")
  .description("Show one installed app")
  .allowUnknownOption()
  .action((appId: string) => showApp(appId));

apps
  .command("uninstall <appId>")
  .description("Uninstall (archive) an installed app; its pages are kept")
  .allowUnknownOption()
  .action((appId: string) => uninstallApp(appId));

apps
  .command("pages <appId>")
  .description("List an installed app's pages")
  .option("--archived", "include archived pages")
  .allowUnknownOption()
  .action((appId: string, options: { archived?: boolean }) =>
    listAppPages(appId, options),
  );

program.parseAsync(process.argv);
