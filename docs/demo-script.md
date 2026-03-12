# Demo Script

Status: engineering complete, ready for recording  
Last verified: 2026-03-12

## What This Demo Actually Shows

This script matches the UI and flows that are currently shipped.

- tutor session lives at `/session`
- avatar switching lives at `/avatar`
- model defaults live at `/models`
- primary interaction controls are `Send`, `Hold to talk`, `History`, `New`
- interruption is shown with `Escape`
- visible lip sync is shown on the default SVG tutor and is covered by browser smoke

## Verified Baseline

Fresh evidence captured on 2026-03-12:

- backend: `python3 -m pytest -q` -> `174 passed`
- frontend verify: `cd frontend && pnpm verify` -> `35` files, `128` tests, build and typecheck pass
- browser smoke: `cd frontend && pnpm e2e` -> `10 passed`

## Demo Goal

Show one tight story:

1. the tutor responds fast
2. the tutor stays Socratic
3. the avatar visibly lip syncs
4. interruption is immediate
5. avatar mode switches cleanly

Do not try to show every page. Keep it crisp.

## Recommended Recording Flow

### Part 1: Open and Frame the Product

1. Start the app with `bash scripts/dev.sh`
2. Open `http://127.0.0.1:3000/session`
3. Say:
   - "This is Nerdy, a realtime tutor with a live avatar, streaming speech, and a Socratic teaching loop."
4. Point to:
   - `Tutor Session`
   - the subject / grade chips
   - the avatar hero
   - the prompt composer

### Part 2: Show the Main Turn

5. In the `Student prompt` box, enter:
   - `Fractions still confuse me.`
6. Click `Send`
7. While the tutor replies, say:
   - "The tutor is already speaking, and the avatar mouth movement is tied to the returned word timings."
8. Point to:
   - the speaking avatar
   - the subtitle text
   - the latency panel

### Part 3: Show Multi-Turn Continuity

9. Enter:
   - `I think one slice out of four is one fourth.`
10. Click `Send`
11. Open `History`
12. Say:
   - "The session stores the current lesson thread so follow-up turns stay on the same problem."
13. Point to:
   - the conversation history panel
   - the archived lesson behavior after `New`

### Part 4: Show Interruptibility

14. Close `History`
15. Enter:
   - `Can you give me one more hint?`
16. Click `Send`
17. While the tutor is speaking, press `Escape`
18. Say:
   - "Interruption is immediate. Audio stops, the avatar settles, and the session is ready for the next turn."

### Part 5: Show Avatar Switching

19. Open `http://127.0.0.1:3000/avatar`
20. Show `2D` first with the default SVG tutor
21. Click `3D`
22. Select `Human 3D`
23. Say:
   - "The richer avatar branch is opt in. The default 2D path stays light and fast."
24. Click back to `2D`
25. Select `Robot`
26. Return to `http://127.0.0.1:3000/session`

### Part 6: Close

27. Say:
   - "The current acceptance lane is the fast runtime path. Public-provider bakeoff results are documented separately, but the shipped runtime and browser gates are green."
28. End with:
   - "Nerdy now has a verified realtime tutor loop, visible lip sync, clean interruption, avatar mode switching, and documented demo flow."

## Suggested Narration

### Opening

> This is Nerdy, a realtime AI tutor. The core loop is student input, streamed tutor reasoning, synthesized speech, and a visible avatar response that feels conversational instead of chatbot like.

### During The First Reply

> The important part here is that the tutor is not just returning text. It is speaking through a live playback path, and the default SVG avatar now has visible mouth motion tied to the returned timestamps.

### During History

> The lesson is stateful. Follow-up turns stay inside the current thread, and the archived lesson list lets you come back to prior work after starting a new one.

### During Interrupt

> Interruption matters for conversation quality. Escape stops the active response right away so the student can redirect without waiting for the tutor to finish.

### During Avatar Switching

> The avatar system is provider driven. We keep the session contract stable and let the visual layer switch between lightweight 2D and opt-in 3D.

### Closing

> Engineering-wise, the backend tests, frontend verify gate, and browser smoke suite are all green. The remaining manual step is recording the final demo video from this script.

## Prompts That Read Well On Camera

- `Fractions still confuse me.`
- `I think one slice out of four is one fourth.`
- `Can you give me one more hint?`

## Avoid In The Recording

- do not describe controls that are not on the current page
- do not promise public-stack latency closure
- do not claim a dedicated on-screen `Interrupt` button exists
- do not claim science and english are selectable from the current session shell

## Completion Note

For engineering sign-off, this document plus `docs/script-demo.md` and `docs/post.md` are the final readable handoff set.
