# PLAN #

- Probably need to push uploads to a holding area for assessments. Displaying uploads immediately for now whilst the website is under construction
- Probably store assessments in github for record keeping. Using a Cloudflare D1 database is temporary.
- May need a feature for a user to complain about an assessment
- Need a feature to reduce potential upload spamming.
- Need an admin role that can delete assessments unless we rely on this being done on a github storage backend.
- This website could potentially also handle assessments done by humans, though these will likely come in a different from like a spreadsheet rather than as JSON. The workflow here may be considerably different.
- Need to ensure that assessments are contributed with a permissive license.
- Add a page describing the scoring system for a version of the AIRBDS metric. We should be able to auto-generate this out of the appropriate metrics YAML.