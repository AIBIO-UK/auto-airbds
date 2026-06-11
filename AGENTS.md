# Agent Instructions

## General Instructions
- Always begin work by creating your own git worktree under .claude/worktrees/
  (each worktree is automatically on its own branch), unless you have been
  explicitly asked to integrate on main. This keeps parallel agents from sharing
  a working tree and keeps all feature work off main.
- main is the integration and test branch. Only merge branches into main and/or
  push when explicitly asked to integrate; otherwise leave main untouched.
- Documentation must be kept up to date with any relevant changes to the project.
- All new functionality must have an accompanying passing unit test.
- Tests should always be run after making any changes and any fails fixed.

## Locations

### Documentation
- README.md
- AGENTS.md
- CLAUDE.md (symlink to AGENTS.md)
- doc/ other documentation including planned future features/changes and product decisions
