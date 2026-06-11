# PLAN #

## Uploading
- Need to ensure that assessments are contributed with a permissive license.
- Probably need to push uploads to a holding area for assessments. Displaying uploads immediately for now whilst the website is under construction
  - A possible alternative is to immediately display an assessment but tag it as 'unmoderated and needs review'. Anti-spamming measures can still limit that IP to one upload or total uploads on a dataset allowed at any one time.
    - Implemented (partial): every entry now shows a `STATUS` of `UNMODERATED` — both in the main list and at the bottom of its metadata box on the detail page (`src/moderation.ts`). A `moderated` status will follow once there is something to moderate entries with (Assessor Agent or human-in-the-loop).
- Need a feature to reduce potential upload spamming. (Interim: the `/api/upload` endpoint is public but rate-limited per IP in D1, plus a global upload cap. Still want a moderation/holding queue so spam never appears publicly.)
- May want a feature to give an uploader an id by which they can modify an assessment for a given period of time. For example, a human may ask their assistant to produce an initial assessment, upload that, but then realize that some of it is inaccurate and work with their assistant to improve it. Then they want to upload the improved version. This would also give them an opportunity to delete it.
- This website could potentially also handle assessments done by humans, though these will likely come in a different from like a spreadsheet rather than as JSON. The workflow here may be considerably different.

## Storage
- Probably store assessments in github for record keeping. Using a Cloudflare D1 database is temporary.

## Management
- Need admin action logging so we know who deleted an entry and when (would cover other admin functions in the future)
- May need a feature for a user to complain about an assessment
- ~~Need an admin role that can delete assessments~~ **Done:** deletion is admin-only, gated by **Cloudflare Access** (an allowlist of admin emails; multi-admin, equal rights). `DELETE /api/entries/:id` verifies the Access JWT ([`functions/auth.ts`](../functions/auth.ts)); the public list is read-only with an **Admin** button linking to `/admin`. See the README "Admin area" and `DESIGN_DECISIONS.md`. (Doing deletion via a GitHub storage backend instead remains a separate future option.)

## Information
- Add a page describing the scoring system for a version of the AIRBDS metric. We should be able to auto-generate this out of the appropriate metrics YAML.

## Other
- Extend skill instructions to openai in airbs-metrics repository and test.