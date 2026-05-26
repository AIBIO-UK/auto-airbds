# PLAN #

- Probably need to push uploads to a holding area for assessments. Displaying uploads immediately for now whilst the website is under construction
- Probably store assessments in github for record keeping. Using a Cloudflare D1 database is temporary.
- May need a feature for a user to complain about an assessment
- Need a feature to only allow authenticated users to perform uploads. Leaving this anonymous is too much of a spam target.
- Need a feature to only allow users to delete their own upload assessments. Allowing anybody to delete is just for testing purposes.
- Need an admin role that can delete any assessments unless we rely on this being done on a github storage backend.
- This website could potentially also handle assessments done by humans, though these will likely come in a different from like a spreadsheet rather than as JSON. The workflow here may be considerably different.
