# LetterBrick Korean MVP Readiness

Updated: 2026-07-10

## Verdict

Limited public beta is possible. It is not yet a polished paid product, but it is strong enough to show to a small group of overseas Korean learners if it is framed as an early beta with 7 open lessons.

## Third-Party Developer View

### Ready
- Three language entry pages exist: English, Spanish, Simplified Chinese.
- Landing pages route directly to a real Day 1 lesson without requiring signup.
- Daily lesson UI can switch language by `?lang=en`, `?lang=es`, or `?lang=zh`.
- Localized content exists for Days 1-7 in Spanish and Chinese.
- Waitlist source is separated by market: `korean-mvp-en`, `korean-mvp-es`, `korean-mvp-zh`.
- JavaScript syntax checks pass.

### Risks
- Landing pages still duplicate markup. Good enough for MVP, but not ideal if copy or layout changes often.
- Pronunciation quality depends on the browser's Korean speech synthesis voice.
- The lesson is static and stores progress locally. It does not yet identify users across devices.
- There is no analytics event tracking for `start lesson`, `copy complete`, `skip copy`, `finish lesson`, or `join waitlist`.
- The lesson is not yet a full curriculum experience beyond the first localized seven days.

### Improvements Applied
- Reframed landing CTA from beta signup to free lesson trial.
- Added no-account / beginner-friendly / 7-lessons-open trust chips.
- Added a keyboard fallback in copy practice so beginners without Korean input do not get blocked.
- Replaced fake audio timing with browser Korean speech synthesis where supported.
- Added this readiness report for release review.

## Korean Learner View

### Ready
- The first screen clearly explains what the learner will do.
- The sample sentence is emotionally engaging and easier to remember than textbook drills.
- Translation, romanization, vocabulary, and variation steps reduce beginner anxiety.
- The "make your own sentence" step creates a real learning payoff.

### Friction
- Beginners may not know how to type Korean yet.
- Learners may expect real native audio; browser TTS is useful but not ideal.
- The copy check requires exact matching, which can feel strict.
- Some learners will want level labels such as "absolute beginner", "A1", or "knows Hangul".
- There is no quick explanation of Hangul prerequisites.

### Next Improvements
- Add analytics events before external release.
- Add a Hangul / Korean keyboard mini-guide page.
- Record native-speaker audio for the first 7 lessons.
- Add level badges: Absolute beginner, Hangul learner, K-drama phrase learner.
- Add a short post-lesson question: "Was this too easy, right, or too hard?"
