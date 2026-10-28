---
name: project-overview-setup
description: Set up the Project Overview page for the current Claude project. Use when the person asks to set up, add, create or open the project overview (or thread overview) in a project.
---

# Set up Project Overview for this project

The Project Overview page shows this project's threads as a colour-coded folder tree. It reads the snapshot that the project-overview mod writes to `.project-overview/snapshot.json` in the project folder after each thread's reply, and keeps its folders in its own database.

1. Find this project's id (`chan_...`) in your session context. If you cannot find it, ask the person for the project link and take the id from it.
2. Copy `overview-page.html` from this skill's folder to your scratchpad and replace `__PROJECT_ID__` with the project id. Change nothing else.
3. Publish it with the Artifact tool as a new artifact: `icon: "tree"`, `capabilities: {"files": {"project": "<project id>"}, "db": {}}`, description "Folder tree of this project's threads, colour-coded by what needs you."
4. Seed a first grouping: list the project's threads, propose 3 to 5 folders from their titles, and write one database document with ArtifactData `set`, collection `layout`, doc_id `main`, data `{"folders": [{"id": "...", "name": "..."}], "placement": {"<thread_id>": "<folder id>"}, "names": {}, "obsolete": {}, "after": {}}`. Thread ids are the `cmsg_...` ids.
5. If `/mnt/project-files/.project-overview/snapshot.json` does not exist yet, say that it appears after the next reply in any thread of the project, once the mod is installed on the person's account.
6. Pin the artifact if the person asks, and give them the link in one line, with a note that they can rename folders, move threads and prepare handovers there.
