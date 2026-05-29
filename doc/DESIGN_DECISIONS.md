# DESIGN DECISIONS

Technical/implementation decisions and the reasoning behind them. All these are experimental and can be changed.

## Metrics file format: YAML

For a given AIRBDS metric version, each question's **theme** and **grade** are fixed (e.g. `ACM-1` is always Access/Important, `ACM-4` is always License/Critical). These definitions live in `src/metrics/`, one file per version named by version (`airbds-<version>.yaml`), and are the source of truth — the theme/grade in uploaded assessments are ignored in favour of them.

**Decision:** store these per-version definition files as **YAML**.

The options considered were a TypeScript module, JSON, and YAML.

- **TypeScript module** (e.g. `export const QUESTIONS = {...} as const`)
    - **Pros**
        - Compile-time type safety and editor autocomplete on the keys/values.
        - Zero extra build configuration — imports directly.
    - **Cons**
        - **Not language-neutral**. It is *code*, not data. Other languages (e.g. a Python assessor agent, validation scripts, future backend tooling) cannot read it without a JavaScript runtime, or must resort to brittle parsing. This was the deciding factor against it: the metric definitions are reference data we may want to read from many tools and possibly publish as a spec.
- **JSON**
    - **Pros**
        - Language-neutral — readable natively by essentially every language.
        - Zero extra build configuration on the web side (native `import`/`fetch`).
    - **Cons**
        - No comments, so the data cannot be annotated inline.
        - No compile-time type safety.
- **YAML** (chosen)
    - **Pros**
        - **Language-neutral**, like JSON — readable by any tool, not just the web frontend. This was a hard requirement.
        - **Best authoring/maintenance ergonomics** for a long, mostly-flat lookup table: no braces/quotes/trailing-comma hazards, clean line-per-field diffs that make version-to-version changes easy to review.
        - **Comments** are supported, so entries and files can be annotated (e.g. why a question is Critical).
        - Format matches the domain — metric definitions read like spec/config data.
    - **Cons**
        - Needs a build dependency (`@rollup/plugin-yaml`) to `import` YAML in Vite; configured once in `vite.config.ts` and, because Vitest shares that config, it applies to tests too. Other languages need a YAML parser (ubiquitous, but one more dependency everywhere).
        - No compile-time type safety (a YAML file resolves to `unknown`).

**Trade-offs accepted / mitigations.** We accept the build-plugin dependency and the loss of compile-time types as the cost of language-neutrality plus good authoring ergonomics. To recover most of the lost safety, `src/metrics/index.ts` **validates each file at load** and throws a clear error if a definition is malformed, so a bad file fails loudly rather than silently dropping questions. A registry in `index.ts` is required regardless of format (a bundle can't pick a file by version string at runtime), so YAML does not add that cost over JSON.
