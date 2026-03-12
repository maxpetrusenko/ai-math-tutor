# Lesson Progress Resume Design

## Goal

Make `/session` feel like a guided lesson instead of a blank chat.

The tutor should:

- know which lesson the learner started
- show a very simple lesson program and current task
- remember where the learner stopped
- resume by leading with the next question instead of waiting for a blank prompt

## Scope

This pass keeps the existing Nerdy session runtime and lesson store architecture.

It adds:

- persisted lesson progress data inside the lesson thread
- a simple lesson brief in the session UI
- current task and next-question state
- resume behavior that restores the current task and leads with the next question

It does not add:

- a new analytics backend
- full mastery scoring
- teacher dashboards
- long multi-step curriculum planning beyond the current lesson

## Learning Data Definition

For this pass, "learning data" means learner-linked lesson progress data that survives page reloads and resume flows through the existing lesson thread store paths:

- local persisted store
- existing remote lesson API if configured
- existing Firebase lesson store if authenticated

This is enough to say we have learning data for lesson resume and progress state, even if it is not yet full reporting analytics.

### Follow-on usage

The same persisted lesson state now also powers dashboard resume entry points:

- active lesson quick-start on `/dashboard`
- continue-learning cards on `/dashboard`
- archived lesson deep-links into `/session?resume=<archiveId>`

## UX

### Session top

Keep the tutor-led hero, but add one compact lesson brief card near the composer or avatar stage with:

- lesson title
- subject
- grade band
- simple program list with 2 to 4 steps
- current task
- status such as `Step 2 of 3`

The card must stay simple. No heavy LMS chrome.

### First tutor turn

When a learner launches a lesson from `/lessons`, the tutor should not wait on a blank screen forever.

Instead:

- if there is no lesson progress yet, seed a first guided tutor turn for that lesson
- the seeded turn should introduce the lesson, name the first task, and end with a direct next question

Example shape:

"We are working on Intro to Fractions. First task: adding fractions with unlike denominators. Ready to find a common denominator for 1/4 and 2/3?"

### Resume behavior

When a learner resumes an active or archived lesson:

- restore the lesson brief and progress state
- show what step they were on
- make the tutor lead with the pending next question for that lesson state

If a previous explicit next question exists, use that.
If not, derive a simple resume question from the current task.

## Data Model

Extend persisted lesson thread data with a small `lessonState` object.

Suggested shape:

- `lessonId`
- `lessonTitle`
- `program`: ordered step list
- `currentStepIndex`
- `currentTask`
- `nextQuestion`
- `lastTutorAction`: optional short summary
- `startedFromCatalog`: boolean

This should remain optional so old threads still hydrate safely.

## Data Flow

### New lesson from catalog

1. Learner clicks a lesson card on `/lessons`.
2. Session receives lesson id from query string.
3. Session resolves lesson metadata from the lesson catalog.
4. Session seeds `lessonState` if the current thread is empty or for a new session.
5. Session renders the lesson brief and tutor-led opening question.

### Active lesson restore

1. Existing thread hydrates from local or remote store.
2. Session restores `lessonState`.
3. UI shows current task and step status.
4. Tutor welcome/resume message uses `nextQuestion` when available.

### After each turn

Keep this pass simple:

- persist the `lessonState`
- keep current step unless the tutor or learner advances it later
- do not attempt autonomous mastery inference yet

## Implementation Notes

- Use the shared lesson catalog as the source of lesson metadata.
- Add a thin view-model/helper layer for seeded lesson programs/questions instead of hardcoding inside `TutorSession`.
- Keep backward compatibility in persisted thread normalization.
- Favor a small new section in the session UI over a major layout rewrite.

## Testing

Add focused tests for:

- seed lesson state from lesson query
- restore lesson state from persisted thread
- show lesson brief and current task in session shell
- resume copy/questions prefer persisted `nextQuestion`
- old persisted threads still hydrate without lesson state

## Success Criteria

- learner opens a lesson and immediately sees what the lesson is and what the current task is
- tutor leads with a direct question for the task
- learner can leave and come back and still see where they stopped
- persisted lesson data survives the current local/Firebase/API storage paths
