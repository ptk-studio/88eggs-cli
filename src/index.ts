#!/usr/bin/env node
import { Command } from "commander";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { whoami } from "./commands/whoami.js";
import {
  createProject,
  deleteProject,
  listProjects,
  showProject,
  updateProject,
} from "./commands/projects.js";
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
  archivePipelineDefinition,
  clonePipelineDefinition,
  publishPipelineDefinition,
  restorePipelineDefinition,
} from "./commands/pipelines.js";
import { listEventTypes, listEvents, showEvent } from "./commands/events.js";
import {
  installApp,
  listAppCatalog,
  listAppPages,
  listInstalledApps,
  showApp,
  uninstallApp,
  createAppPage,
  showAppPage,
  updateAppPage,
  showPublicPage,
} from "./commands/apps.js";
import {
  addRow,
  createDataTable,
  deleteRow,
  listDataTables,
  listRows,
  publishDataTable,
  showDataTable,
  showRow,
  updateDataTable,
  updateRow,
  deleteDataTable,
} from "./commands/data-tables.js";
import {
  acceptInvitation,
  createTeam,
  declineInvitation,
  deleteTeam,
  inviteToTeam,
  listTeamInvitations,
  listTeamMembers,
  listTeams,
  removeTeamMember,
  revokeTeamInvitation,
  showTeam,
  updateTeam,
} from "./commands/teams.js";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  showSchedule,
  updateSchedule,
} from "./commands/schedules.js";
import { cloneTemplate, listTemplates, showTemplate } from "./commands/templates.js";
import { listModels } from "./commands/models.js";
import { showProfile, updateProfile } from "./commands/profile.js";
import { listMessages, readMessage } from "./commands/messages.js";
import { listTaskInputs, saveTaskInputs, showTaskInput } from "./commands/task-inputs.js";
import {
  createPartnerProfile,
  listPartnerProfiles,
  listPartnerProfileTaskDefinitions,
  listPartnerTaskDefinitions,
  showPartner,
  showPartnerProfile,
} from "./commands/partners.js";

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

projects
  .command("show <projectId>")
  .description("Show a project's detail + your permissions")
  .allowUnknownOption()
  .action((projectId: string) => showProject(projectId));

projects
  .command("create <name>")
  .description("Create a project")
  .option("--description <text>", "a description")
  .option("--team <teamId>", "share it with a team (defaults to a personal project)")
  .action((name: string, options: { description?: string; team?: string }) =>
    createProject(name, options),
  );

projects
  .command("update <projectId>")
  .description("Update a project's name/description/team")
  .allowUnknownOption()
  .option("--name <name>", "new name")
  .option("--description <text>", "new description")
  .option("--team <teamId>", "move to a team (owner only)")
  .action((projectId: string, options: { name?: string; description?: string; team?: string }) =>
    updateProject(projectId, options),
  );

projects
  .command("delete <projectId>")
  .description("Delete a project (fails with 409 if it still has assets)")
  .allowUnknownOption()
  .action((projectId: string) => deleteProject(projectId));

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

pipelineDefinitions
  .command("clone <slug>")
  .description('Duplicate a definition within its own project ("<name> (Copy)")')
  .allowUnknownOption()
  .action((slug: string) => clonePipelineDefinition(slug));

pipelineDefinitions
  .command("publish <slug>")
  .description("Publish a definition to the global Templates catalog")
  .allowUnknownOption()
  .option("--name <name>", "template name (defaults to the definition's)")
  .option("--description <text>", "template description")
  .action((slug: string, options: { name?: string; description?: string }) =>
    publishPipelineDefinition(slug, options),
  );

pipelineDefinitions
  .command("archive <slug>")
  .description("Archive a definition (retire it from the active catalog)")
  .allowUnknownOption()
  .action((slug: string) => archivePipelineDefinition(slug));

pipelineDefinitions
  .command("restore <slug>")
  .description("Restore an archived definition to active")
  .allowUnknownOption()
  .action((slug: string) => restorePipelineDefinition(slug));

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

events
  .command("show <eventId>")
  .description("Show one event's detail")
  .allowUnknownOption()
  .action((eventId: string) => showEvent(eventId));

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

const appPage = apps.command("page").description("Manage one of an app's pages");

appPage
  .command("create <appId>")
  .description("Create a page (slug derived from title if omitted)")
  .allowUnknownOption()
  .requiredOption("--title <title>", "page title")
  .option("--slug <slug>", "custom slug")
  .action((appId: string, options: { title?: string; slug?: string }) =>
    createAppPage(appId, options),
  );

appPage
  .command("show <appId> <pageId>")
  .description("Show one page's detail")
  .allowUnknownOption()
  .action((appId: string, pageId: string) => showAppPage(appId, pageId));

appPage
  .command("update <appId> <pageId>")
  .description("Update a page's title/slug, or archive/restore it")
  .allowUnknownOption()
  .option("--title <title>", "new title")
  .option("--slug <slug>", "new slug")
  .option("--archive", "archive the page")
  .option("--restore", "restore an archived page")
  .action(
    (
      appId: string,
      pageId: string,
      options: { title?: string; slug?: string; archive?: boolean; restore?: boolean },
    ) => updateAppPage(appId, pageId, options),
  );

apps
  .command("public-page <slug>")
  .description("Show a public page's metadata by slug")
  .allowUnknownOption()
  .action((slug: string) => showPublicPage(slug));

const dataTables = program
  .command("data-tables")
  .description("Create and manage a project's data tables and their rows");

dataTables
  .command("list")
  .description("List data tables (all accessible projects, or one with --project)")
  .option("--project <projectId>", "scope to one project")
  .option("--archived", "list archived tables instead of active")
  .action((options: { project?: string; archived?: boolean }) => listDataTables(options));

dataTables
  .command("show <tableId>")
  .description("Show one table's schema (columns)")
  .allowUnknownOption()
  .action((tableId: string) => showDataTable(tableId));

dataTables
  .command("create <name>")
  .description("Create a data table (built-in Id + status columns are always added)")
  .option("--project <projectId>", "defaults to your oldest project if omitted")
  .option(
    "--column <spec>",
    'a column as "key:type[:label]" (type: text|textarea|number|boolean|asset), repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .action((name: string, options: { project?: string; column: string[] }) =>
    createDataTable(name, options),
  );

dataTables
  .command("update <tableId>")
  .description("Rename a table, replace its columns, set status options, or archive/restore")
  .allowUnknownOption()
  .option("--name <name>", "new table name")
  .option(
    "--column <spec>",
    'replace the columns; "key:type[:label]", repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .option(
    "--status-option <value>",
    "an allowed status value for the row editor, repeatable",
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .option("--archive", "archive the table (hidden from default listings)")
  .option("--restore", "restore an archived table to active")
  .action(
    (
      tableId: string,
      options: {
        name?: string;
        column: string[];
        statusOption: string[];
        archive?: boolean;
        restore?: boolean;
      },
    ) => updateDataTable(tableId, options),
  );

dataTables
  .command("publish <tableId>")
  .description("Publish the table's schema to the Templates catalog (rows are not shared)")
  .allowUnknownOption()
  .option("--name <name>", "template name (defaults to the table's name)")
  .action((tableId: string, options: { name?: string }) => publishDataTable(tableId, options));

dataTables
  .command("delete <tableId>")
  .description("Delete a data table (its rows cascade)")
  .allowUnknownOption()
  .action((tableId: string) => deleteDataTable(tableId));

const rows = dataTables.command("rows").description("List and manage a table's rows");

rows
  .command("list <tableId>")
  .description("List rows (newest first), optionally filtered by one column")
  .allowUnknownOption()
  .option("--column <key>", "column to filter on (use status for the status column)")
  .option("--value <value>", "value to match (empty string matches no-status rows)")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action(
    (
      tableId: string,
      options: { column?: string; value?: string; page?: string; limit?: string },
    ) => listRows(tableId, options),
  );

rows
  .command("show <tableId> <rowId>")
  .description("Show one row's cells")
  .allowUnknownOption()
  .action((tableId: string, rowId: string) => showRow(tableId, rowId));

rows
  .command("add <tableId>")
  .description("Insert a row")
  .allowUnknownOption()
  .option(
    "--cell <keyValue>",
    'a "key=value" cell, repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .option("--status <status>", "the row's status (a first-class column, not a --cell)")
  .action((tableId: string, options: { cell: string[]; status?: string }) =>
    addRow(tableId, options),
  );

rows
  .command("update <tableId> <rowId>")
  .description("Merge-update a row's cells (omitted cells are left alone)")
  .allowUnknownOption()
  .option(
    "--cell <keyValue>",
    'a "key=value" cell, repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .option("--status <status>", "set the row's status (empty string clears it)")
  .action((tableId: string, rowId: string, options: { cell: string[]; status?: string }) =>
    updateRow(tableId, rowId, options),
  );

rows
  .command("delete <tableId> <rowId>")
  .description("Delete one row")
  .allowUnknownOption()
  .action((tableId: string, rowId: string) => deleteRow(tableId, rowId));

const teams = program.command("teams").description("Manage teams, members, and invitations");

teams.command("list").description("List teams you belong to").action(() => listTeams());
teams
  .command("show <teamId>")
  .description("Team detail + members")
  .allowUnknownOption()
  .action((teamId: string) => showTeam(teamId));
teams
  .command("create <name>")
  .description("Create a team (you become owner)")
  .action((name: string) => createTeam(name));
teams
  .command("update <teamId>")
  .description("Rename a team")
  .allowUnknownOption()
  .requiredOption("--name <name>", "new name")
  .action((teamId: string, options: { name?: string }) => updateTeam(teamId, options));
teams
  .command("delete <teamId>")
  .description("Delete a team")
  .allowUnknownOption()
  .action((teamId: string) => deleteTeam(teamId));
teams
  .command("members <teamId>")
  .description("List a team's members")
  .allowUnknownOption()
  .action((teamId: string) => listTeamMembers(teamId));
teams
  .command("remove-member <teamId> <userId>")
  .description("Remove a member (or leave the team)")
  .allowUnknownOption()
  .action((teamId: string, userId: string) => removeTeamMember(teamId, userId));
teams
  .command("invitations <teamId>")
  .description("List a team's pending invitations")
  .allowUnknownOption()
  .action((teamId: string) => listTeamInvitations(teamId));
teams
  .command("invite <teamId> <email>")
  .description("Invite someone by email")
  .allowUnknownOption()
  .action((teamId: string, email: string) => inviteToTeam(teamId, email));
teams
  .command("revoke-invitation <teamId> <invitationId>")
  .description("Revoke a pending invitation")
  .allowUnknownOption()
  .action((teamId: string, invitationId: string) => revokeTeamInvitation(teamId, invitationId));

const invitations = program
  .command("invitations")
  .description("Accept or decline invitations sent to you");
invitations
  .command("accept <invitationId>")
  .description("Accept an invitation")
  .allowUnknownOption()
  .action((invitationId: string) => acceptInvitation(invitationId));
invitations
  .command("decline <invitationId>")
  .description("Decline an invitation")
  .allowUnknownOption()
  .action((invitationId: string) => declineInvitation(invitationId));

const schedules = program
  .command("schedules")
  .description("Manage recurring pipeline schedules");
schedules
  .command("list")
  .description("List schedules (all accessible projects, or one with --project)")
  .option("--project <projectId>", "scope to one project")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action((options: { project?: string; page?: string; limit?: string }) =>
    listSchedules(options),
  );
schedules
  .command("show <scheduleId>")
  .description("Show a schedule's detail")
  .allowUnknownOption()
  .action((scheduleId: string) => showSchedule(scheduleId));
schedules
  .command("create")
  .description("Create a recurring schedule for a pipeline definition")
  .requiredOption("--definition <slug>", "the pipeline definition to run")
  .requiredOption("--cron <expr>", "a cron expression")
  .requiredOption("--name <name>", "a name for the schedule")
  .option("--timezone <tz>", "IANA timezone (default UTC)")
  .option("--project <projectId>", "defaults to your oldest project if omitted")
  .option("--disabled", "create it disabled")
  .option(
    "--param <keyValue>",
    'a "key=value" pipeline input, repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .action(
    (options: {
      definition?: string;
      cron?: string;
      name?: string;
      timezone?: string;
      project?: string;
      disabled?: boolean;
      param: string[];
    }) => createSchedule(options),
  );
schedules
  .command("update <scheduleId>")
  .description("Edit a schedule's name/cron/timezone/inputs, or enable/disable it")
  .allowUnknownOption()
  .option("--name <name>", "new name")
  .option("--cron <expr>", "new cron expression")
  .option("--timezone <tz>", "new timezone")
  .option("--enable", "enable the schedule")
  .option("--disable", "disable the schedule")
  .option(
    "--param <keyValue>",
    'replace the inputs; "key=value", repeatable',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .action(
    (
      scheduleId: string,
      options: {
        name?: string;
        cron?: string;
        timezone?: string;
        enable?: boolean;
        disable?: boolean;
        param: string[];
      },
    ) => updateSchedule(scheduleId, options),
  );
schedules
  .command("delete <scheduleId>")
  .description("Delete a schedule (past pipelines unaffected)")
  .allowUnknownOption()
  .action((scheduleId: string) => deleteSchedule(scheduleId));

const templates = program
  .command("templates")
  .description("Browse the Templates catalog and clone one into a project");
templates
  .command("list")
  .description("List templates")
  .option("--type <type>", "filter by type (pipeline-definition | data-table)")
  .option("--q <query>", "search name/description")
  .option("--page <page>", "page number")
  .option("--limit <limit>", "page size")
  .action((options: { type?: string; q?: string; page?: string; limit?: string }) =>
    listTemplates(options),
  );
templates
  .command("show <templateId>")
  .description("Show one template's detail")
  .allowUnknownOption()
  .action((templateId: string) => showTemplate(templateId));
templates
  .command("clone <templateId>")
  .description("Materialize a template into a project (pipeline definition or data table)")
  .allowUnknownOption()
  .option("--project <projectId>", "defaults to your oldest project if omitted")
  .option("--name <name>", "name for the materialized copy")
  .action((templateId: string, options: { project?: string; name?: string }) =>
    cloneTemplate(templateId, options),
  );

program
  .command("models")
  .description("List the catalog of supported models")
  .action(() => listModels());

const profile = program.command("profile").description("Your own profile");
profile.command("show").description("Show your profile").action(() => showProfile());
profile
  .command("update")
  .description("Update your full name / description")
  .option("--name <name>", "your full name")
  .option("--description <text>", "your description")
  .action((options: { name?: string; description?: string }) => updateProfile(options));

const messages = program.command("messages").description("Your messages");
messages.command("list").description("List your messages + unread count").action(() => listMessages());
messages
  .command("read <messageId>")
  .description("Mark one message read")
  .allowUnknownOption()
  .action((messageId: string) => readMessage(messageId));

const taskInputs = program
  .command("task-inputs")
  .description("Saved presets of a task definition's inputs");
taskInputs
  .command("list")
  .description("List task inputs (yours or published; --project scopes to one)")
  .option("--project <projectId>", "scope to one project")
  .action((options: { project?: string }) => listTaskInputs(options));
taskInputs
  .command("show <templateId>")
  .description("Show one task-input preset's full inputs")
  .allowUnknownOption()
  .action((templateId: string) => showTaskInput(templateId));
taskInputs
  .command("save <taskId>")
  .description("Save a run task's inputs as a new personal task-input preset")
  .allowUnknownOption()
  .requiredOption("--name <name>", "a name for the preset")
  .option("--description <text>", "a description")
  .action((taskId: string, options: { name?: string; description?: string }) =>
    saveTaskInputs(taskId, options),
  );

const partnerProfiles = program
  .command("partner-profiles")
  .description("Your partner profiles (publisher identities for tasks/apps)");
partnerProfiles
  .command("list")
  .description("List partner profiles you own")
  .action(() => listPartnerProfiles());
partnerProfiles
  .command("show <partnerProfileId>")
  .description("Show a partner profile's detail")
  .allowUnknownOption()
  .action((partnerProfileId: string) => showPartnerProfile(partnerProfileId));
partnerProfiles
  .command("create")
  .description("Create a partner profile (starts pending review)")
  .requiredOption("--name <name>", "display name")
  .requiredOption("--slug <slug>", "url slug")
  .requiredOption("--email <email>", "contact email")
  .option("--description <text>", "a description")
  .action((options: { name?: string; slug?: string; email?: string; description?: string }) =>
    createPartnerProfile(options),
  );
partnerProfiles
  .command("task-definitions <partnerProfileId>")
  .description("List task definitions owned by a partner profile (your management view)")
  .allowUnknownOption()
  .action((partnerProfileId: string) => listPartnerProfileTaskDefinitions(partnerProfileId));

const partners = program
  .command("partners")
  .description("Browse a partner's public page by slug");
partners
  .command("show <slug>")
  .description("A partner's public page")
  .allowUnknownOption()
  .action((slug: string) => showPartner(slug));
partners
  .command("task-definitions <slug>")
  .description("A partner's published task definitions")
  .allowUnknownOption()
  .action((slug: string) => listPartnerTaskDefinitions(slug));

program.parseAsync(process.argv);
