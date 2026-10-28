# Project Overview

A mod for Claude projects. Each time a thread in a project finishes a reply, it saves a small snapshot of all the project's threads to the project folder (`.project-overview/snapshot.json`): each thread's state, what it needs from you, its latest action, its checklist and its outputs. The Project Overview page reads that snapshot and shows the threads as a colour-coded folder tree, so you see at a glance where your input is needed.

Where the app draws it, the mod also shows one line above the prompt: how many threads need you, which ones, and how many are running or ready for review.

It reads thread data through the project's own tools and makes no changes to threads. It costs no extra model calls.

## Use it in a project

The snapshot is written in every project once the mod is on your account. The page is one per project: in a project, ask Claude to "set up the project overview". The included `project-overview-setup` skill publishes the page for that project and suggests a first folder grouping.

## Install

For project threads (they run in the cloud), save the mod to your account as an uploaded plugin, so it syncs to every session.

For local Claude Code sessions in the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `andi-f-1993/mod_project_overview`, then Add plugin.

In a terminal session:

```
/plugin install project-overview --marketplace andi-f-1993/mod_project_overview
```
