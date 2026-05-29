# PRODUCT DECISIONS

All these are experimental and can be changed.

The philosophy is to make uploads as easy as possible. This is to gather as many assessments as we can. This may mean tradeoffs against other desirable properties.

- **Anonymous uploads**
    - **Pros**
        - **Lowest barrier**. The user barely needs to think. Their agent asks `(Optional) Upload this assessment anonymously to AIRBDS?`. No name or personal details are attached.
        - **No management**. If the website accepts attributed assessments then there may be a need to let the user selectively delete their own uploads, change the personal details attached to an assessment, etc. Not recording anything avoids all this.
        - **No stigma**. Some people may be reluctant to offend dataset providers with low-scoring assessments.
    - **Cons**
        - **Spam**. Anonymous uploads will be more subject to spam. Need measures to reduce this. Will have a holding area to hold contributed assessments pending Assessor Agent or human-in-the-loop approval.
        - **Lower quality**. Anonymous uploads may be lower quality without attribution. However, I (justincc) presume that most assessments are done for the user's own use, so the incentive is to have high quality assessments.
        - **Lower incentive**. Not being attributed may reduce the incentive to contribute assessments. This is the inverse of the **No stigma** pro. I (justincc) think that this is not a major factor as it's a model that has done the assessment - the user has played no significant role in the content.
- **Consented uploads**. Uploads will always check for consent. An AI skill or other system should always check with the commissioner of the assessment before uploading. We may want a specific field in the JSON upload to confirm that consent has been given.
