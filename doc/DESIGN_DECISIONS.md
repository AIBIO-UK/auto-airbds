# DESIGN DECISIONS

Technical/implementation decisions and the reasoning behind them. All these are experimental and can be changed.

## Metrics file format: YAML

For a given AIRBDS metric version, each question's **theme** and **grade** are fixed (e.g. `ACM-1` is always Access/Important, `ACM-4` is always License/Critical). These definitions live in `src/metrics/`, one file per version named by version (`airbds_metric_v<version>.yaml`), and are the source of truth — the theme/grade in uploaded assessments are ignored in favour of them.

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

## Upload format: the AIRBDS review-template YAML shape

Assessments are uploaded to `POST /api/upload`.

**Decision:** accept uploads as **YAML in the shape of the upstream AIRBDS `review_template.yaml`** (top-level `schema_version`, `reviewer`, `dataset`, and an `answers` map keyed by question id), and treat that shape as the app's native/internal model. See the README "Upload format" section for the fields.

- **YAML (with JSON for free).** Uploads are parsed in the Function with the `yaml` package. YAML is a superset of JSON, so a single parse path accepts both syntaxes; we don't branch on `Content-Type`. (`@rollup/plugin-yaml` is a *build-time* Vite plugin and can't parse a request body, hence the separate runtime dependency.)
- **One shape, matching the template.** Rather than invent a bespoke assessment shape, we adopt the template humans already fill in. The frontend reads these field names directly (`dataset.name`/`url`/`comments`, `reviewer.name`/`review_date`, `answers.<id>.{answer,comments}`), so there is no long-lived translation layer — the read-time guards in `src/types.ts` are just untrusted-input validation, not format adaptation.
- **Unified human + AI provenance.** "Who performed the assessment" is a single field, `reviewer.name` — a model name for an AI assessment, a person's name for a human review. There is no separate `model` field. This anticipates the human-review workflow noted in `PLAN.md`.
- **Ignored template fields.** `reviewer.initials`/`orcid`/`affiliation`, `dataset.hosting_resource`/`accession`, `answers.*.not_applicable`, and `result.*` are accepted but ignored — the score and grade are recomputed from the metric definition, so trusting the upload's own totals would be redundant and spoofable.

**Server-side completeness validation.** Uploads are rejected (`400`, or `413` if oversized) unless complete: a *known* `schema_version`, non-empty reviewer name/date and dataset name/url, and a `"Yes"`/`"No"` answer for every question in that metric version. Partial templates and unknown versions can't be scored, so they're refused rather than stored half-formed.

- **Why a separate `functions/metrics.ts`.** The validator needs the per-version question-id set, but the Pages Functions bundle has no YAML loader and can't import `src/metrics/`. We keep a minimal plain-data descriptor (versions → question ids) in `functions/metrics.ts`. To stop it drifting from the real metric, `functions/metrics.test.ts` asserts it matches the YAML (Vitest *can* import the YAML, via the shared Vite config) — single source of truth enforced by test rather than a codegen step.

These choices are experimental and reversible; the previous bespoke JSON assessment shape was dropped in favour of this one.
