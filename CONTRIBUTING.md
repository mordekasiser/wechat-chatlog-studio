# Contributing

Thanks for contributing to Chatlog Studio.

## Scope

- Keep each change focused on one clear goal.
- Avoid unrelated refactors in the same pull request.
- Preserve the local-first, Windows-only design unless the change explicitly expands support.

## Development Setup

```powershell
python -m pip install -e ".[dev]"
```

If you are working directly from a source checkout on Windows, you can also use:

```powershell
scripts\chatlog.bat install --dev
```

## Verification

Run the test suite before opening a PR:

```powershell
python -m pytest
```

Build the package before release-related changes:

```powershell
python -m build
```

## Before You Commit

- Do not commit local chat exports, decrypted databases, caches, archives, or personal data.
- Do not commit virtual environments or build output.
- Update `README.md` and `README.zh-CN.md` when user-facing behavior changes.
- Add or update tests when behavior changes.

## Before Public Release

- Audit current files, old refs, and tags for secrets or private material before publishing the repository.
- Review branch and tag history for leaked exports, databases, tokens, private notes, or internal-only documents.
- Check whether private rule files such as local `AGENTS.md`, `agent.md`, `codex/agent.md`, or similar guidance ever entered history.
- Remove or rewrite history if commits expose machine-specific paths, usernames, home directories, or other local environment details.
- Confirm screenshots, examples, and command snippets do not reveal personal account data or workstation information.
- Re-check release artifacts and generated files before creating a public tag or GitHub release.

Recommended checks:

```powershell
git tag --list
git log --all -- AGENTS.md
git log --all -- CLAUDE.md
git log --all -- GEMINI.md
git log --all -S "C:\Users\" -- .
git log --all -S "/Users/" -- .
git log --all -S "/home/" -- .
```

## Pull Requests

- Explain what changed and why.
- Include the validation commands you ran.
- Mention any limitations or follow-up work that remains.
