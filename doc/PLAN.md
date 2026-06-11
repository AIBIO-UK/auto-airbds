# PLAN #

## Uploading
- Need to ensure that assessments are contributed with a permissive license.
- Probably need to push uploads to a holding area for assessments. Displaying uploads immediately for now whilst the website is under construction
  - A possible alternative is to immediately display an assessment but tag it as 'unmoderated and needs review'. Anti-spamming measures can still limit that IP to one upload or total uploads on a dataset allowed at any one time.
- Need a feature to reduce potential upload spamming. (Interim: the `/api/upload` endpoint is public but rate-limited per IP in D1, plus a global upload cap. Still want a moderation/holding queue so spam never appears publicly.)
- May want a feature to give an uploader an id by which they can modify an assessment for a given period of time. For example, a human may ask their assistant to produce an initial assessment, upload that, but then realize that some of it is inaccurate and work with their assistant to improve it. Then they want to upload the improved version. This would also give them an opportunity to delete it.
- This website could potentially also handle assessments done by humans, though these will likely come in a different from like a spreadsheet rather than as JSON. The workflow here may be considerably different.

## Storage
- Probably store assessments in github for record keeping. Using a Cloudflare D1 database is temporary.

## Management
- May need a feature for a user to complain about an assessment
- Need an admin role that can delete assessments unless we rely on this being done on a github storage backend. (Note: `DELETE /api/entries/:id` is currently unauthenticated — must be locked down now that uploads are public.)

## Information
- Add a page describing the scoring system for a version of the AIRBDS metric. We should be able to auto-generate this out of the appropriate metrics YAML.

## Other
- Extend skill instructions to openai in airbs-metrics repository and test.