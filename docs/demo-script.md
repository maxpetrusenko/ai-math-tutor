# Demo Script

## Demo Day Configuration (LOCKED)

The following settings are frozen for acceptance demo:

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Default Avatar | `human-css-2d` | Fast, lightweight, credible 2D visual tutor |
| Alternative Avatars | `human-threejs-3d`, `robot-css-2d` | One 3D option plus one distinct 2D look |
| STT Provider | Deepgram | Production baseline, low latency |
| Primary LLM | MiniMax-M2.5 | Meets latency budget, strong Socratic capability |
| Fallback LLM | Gemini 3.1 Flash-Lite Preview | Evaluation and comparison only |
| Primary TTS | Cartesia Sonic-3 | Best lip-sync timestamps in MVP baseline |
| Avatar Providers | CSS (2D), Three.js (3D) | Client-side rendering, no external avatar API |

## Concepts

1. Linear equations (algebra)
2. Photosynthesis basics (biology)
3. Subject-verb agreement (English)

## Demo Arc

### Part 1: Introduction (30 seconds)

1. Open the session shell at `http://localhost:3000`
2. Show the UI panels:
   - **Hero card** with connection state (`connected`) and session state
   - **Latency cards** (STT, LLM, TTS, E2E) - explain we track every stage
   - **Tutor State** panel - explain the student prompt and subject/grade controls
   - **Avatar panel** - explain we have both 2D and 3D options

### Part 2: Multi-Turn Math Lesson (2 minutes)

3. Set subject to `Math`, grade band to `6-8`
4. Turn 1: Use the prompt: `I don't understand how to solve for x.`
5. Click `Send Text Turn`
6. Point out while processing:
   - **State changes**: `idle` → `thinking` → `speaking`
   - **Transcript fills** with the student question
   - **Tutor reply** streams in word by word
   - **Latency cards populate** - explain each stage
   - **Avatar mouth animates** with lip-sync during speech
   - **Conversation history** shows both student and tutor messages
7. When tutor finishes, highlight:
   - Tutor ended with a question (Socratic method)
   - Latency was under 1 second end-to-end
   - Avatar returned to `idle` state
   - History panel now shows the first exchange
8. Turn 2 (Follow-up): Type: `The equation is 2x + 4 = 10`
9. Explain: "Notice the tutor uses the relevant conversation history to continue the lesson. If I switch to a new problem, it should reset context instead of forcing the old one."
10. Turn 3 (Follow-up): Type: `I subtracted 4 and got 2x = 6`
11. Point out: Tutor confirms progress and guides to next step
12. Turn 4 (Follow-up): Type: `So x = 3`
13. Turn 5 (Closure): Type: `Because I divided both sides by 2`
14. Highlight: Complete learning arc from confusion to mastery in 5 turns

### Part 3: Avatar Switching (30 seconds)

15. Change `Render mode` to `3D`
16. Pick `Human 3D`
17. Explain:
   - 3D avatar loads on-demand (lazy loading)
   - Same lip-sync, different visual style
   - Can switch back to 2D anytime
18. Change `Render mode` back to `2D`
19. Pick `Robot`

### Part 4: Interruption Demo (30 seconds)

20. Run another turn and click `Interrupt` during speech
21. Show that:
    - Audio stops immediately
    - Avatar returns to `idle`
    - Ready for new input right away

### Part 5: Subject Variety (60 seconds)

22. Click `New Lesson`
23. Switch subject to `Science`
24. Prompt: `How does photosynthesis work?`
25. Show tutor guides toward key concepts (sunlight, chlorophyll)

26. Click `New Lesson`
27. Switch subject to `English`
28. Prompt: `What is subject-verb agreement?`
29. Show tutor adapts to language domain

### Part 6: Grade Band (30 seconds)

30. Switch grade band to `11-12`
31. Run an English turn with the same concept
32. Point out language adjusts to grade level

### Part 7: Closing (30 seconds)

33. Summarize what was shown:
    - Low-latency streaming pipeline
    - Socratic multi-turn questioning approach
    - Multi-subject, multi-grade support
    - Avatar with lip-sync
    - Fast interruption

## Narration Notes

**Opening:**
> "This is Nerdy, a low-latency AI video tutor. The key innovation is that every response is generated in under a second, with full streaming from speech recognition through language model to text-to-speech and avatar animation."

**During first turn:**
> "Watch the state card move from thinking to speaking, and see how the latency cards fill in as each stage completes. The avatar's mouth motion is synchronized to the actual word timings from the speech synthesizer."

**Avatar switching:**
> "We can switch between 2D and 3D avatars from the selector. The 3D version loads only when you choose it, so the default 2D path stays fast and lightweight."

**Interruption:**
> "Interruption is instant - the audio cuts cleanly and the avatar resets immediately. This is critical for a conversational feel."

**Closing:**
> "The architecture uses a modular provider system, so we can swap out speech recognition or text-to-speech services without changing the core application. This keeps the baseline cost-effective while allowing upgrades when needed."

## Technical Talking Points

- **Pipeline stages**: STT → LLM → TTS → Avatar (all streaming)
- **Provider registry**: Easy hot-swap for STT/LLM/TTS/Avatar providers
- **Socratic method**: Tutor asks questions instead of lecturing
- **Lesson continuity**: Follow-up turns reuse relevant session history, but clear topic shifts start fresh
- **Grade bands 6-12**: Language adapts to audience
- **Subjects**: Math, Science, English (extensible architecture)

## Rehearsal Checklist

- [ ] Practice the math turn explanation
- [ ] Time the demo (target: 4-5 minutes total)
- [ ] Verify avatar switching is smooth (no FOUC)
- [ ] Test interruption timing (should be instant)
- [ ] Confirm all 3 subjects work correctly
- [ ] Check latency numbers look reasonable

## Recording Tips

- Keep DevTools closed
- Use 1080p or higher resolution
- Mouse movements should be deliberate
- Point to specific UI elements when explaining
- Wait for animations to complete before clicking next

## Demo Concepts

### Math: Solving for x (Multi-Turn)

**Turn 1:** `I don't understand how to solve for x.`
**Turn 2:** `The equation is 2x + 4 = 10`
**Turn 3:** `I subtracted 4 and got 2x = 6`
**Turn 4:** `So x = 3`
**Turn 5:** `Because I divided both sides by 2`

**Expected progression:**
- Diagnose current understanding
- Guide toward isolating variable
- Confirm each step
- Build confidence through scaffolding
- End with clear mastery summary

### Science: Photosynthesis (Multi-Turn)

**Turn 1:** `How does photosynthesis work?`
**Turn 2:** `I know plants need sunlight and water`
**Turn 3:** `What does the plant do with carbon dioxide?`
**Turn 4:** `So sunlight + CO2 + water becomes glucose and oxygen?`
**Turn 5:** `Because it's how plants make their food and oxygen for us`

**Expected progression:**
- Check prior knowledge
- Introduce key inputs (sunlight, water, CO2)
- Explain the process
- Verify understanding of formula
- Close with importance statement

### English: Subject-Verb Agreement (Multi-Turn)

**Turn 1:** `What is subject-verb agreement?`
**Turn 2:** `I think it means the verb matches the subject`
**Turn 3:** `So 'The dog runs' but 'The dogs run'?`
**Turn 4:** `What about 'Neither of the students are here'?`
**Turn 5:** `Oh, 'neither' is singular so it should be 'is'!`

**Expected progression:**
- Assess current understanding
- Define with examples
- Practice basic singular/plural
- Address tricky cases (indefinite pronouns)
- Verify correction mastery
