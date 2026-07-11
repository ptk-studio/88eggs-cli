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
import { listWorkflows, runWorkflow, showWorkflow } from "./commands/workflows.js";
import { listRuns, runStatus } from "./commands/runs.js";
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

program.name("88eggs").description("CLI for 88eggs").version("0.4.0");

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
  .option("--name <name>", 'a label for the run (default: "<workflow name> <random word>")')
  .option(
    "--param <keyValue>",
    'a "key=value" parameter override, repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .action(
    (slug: string, options: { project?: string; name?: string; param: string[] }) =>
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

const events = program
  .command("events")
  .description("Browse the activity log (runs/jobs/assets/apps/workers)");

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
