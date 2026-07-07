#!/usr/bin/env node
import { Command } from "commander";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { whoami } from "./commands/whoami.js";
import { listProjects } from "./commands/projects.js";

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

program.parseAsync(process.argv);
