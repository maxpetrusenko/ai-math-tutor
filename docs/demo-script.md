# Demo Script

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

### Part 2: First Turn - Math (90 seconds)

3. Use the default prompt: `I don't understand how to solve for x.`
4. Click `Run Demo Turn`
5. Point out while processing:
   - **State changes**: `idle` → `thinking` → `speaking`
   - **Transcript fills** with the student question
   - **Tutor reply** streams in word by word
   - **Latency cards populate** - explain each stage
   - **Avatar mouth animates** with lip-sync during speech
6. When tutor finishes, highlight:
   - Tutor ended with a question (Socratic method)
   - Latency was under 1 second end-to-end
   - Avatar returned to `idle` state

### Part 3: Avatar Switching (30 seconds)

7. Click the `3D Three.js` button in Avatar Provider section
8. Explain:
   - 3D avatar loads on-demand (lazy loading)
   - Same lip-sync, different visual style
   - Can switch back to 2D anytime

### Part 4: Interruption Demo (30 seconds)

9. Run another turn and click `Interrupt` during speech
10. Show that:
    - Audio stops immediately
    - Avatar returns to `idle`
    - Ready for new input right away

### Part 5: Subject Variety (60 seconds)

11. Switch subject to `Science`
12. Prompt: `How does photosynthesis work?`
13. Show tutor guides toward key concepts (sunlight, chlorophyll)

14. Switch subject to `English`
15. Prompt: `What is subject-verb agreement?`
16. Show tutor adapts to language domain

### Part 6: Grade Band (30 seconds)

17. Switch grade band to `11-12`
18. Run a math turn with the same concept
19. Point out language adjusts to grade level

### Part 7: Closing (30 seconds)

20. Summarize what was shown:
    - Low-latency streaming pipeline
    - Socratic questioning approach
    - Multi-subject, multi-grade support
    - Avatar with lip-sync
    - Fast interruption

## Narration Notes

**Opening:**
> "This is Nerdy, a low-latency AI video tutor. The key innovation is that every response is generated in under a second, with full streaming from speech recognition through language model to text-to-speech and avatar animation."

**During first turn:**
> "Watch the state card move from thinking to speaking, and see how the latency cards fill in as each stage completes. The avatar's mouth motion is synchronized to the actual word timings from the speech synthesizer."

**Avatar switching:**
> "We can switch between 2D and 3D avatars. The 3D version loads only when you select it, so the default 2D path stays fast and lightweight."

**Interruption:**
> "Interruption is instant - the audio cuts cleanly and the avatar resets immediately. This is critical for a conversational feel."

**Closing:**
> "The architecture uses a modular provider system, so we can swap out speech recognition or text-to-speech services without changing the core application. This keeps the baseline cost-effective while allowing upgrades when needed."

## Technical Talking Points

- **Pipeline stages**: STT → LLM → TTS → Avatar (all streaming)
- **Provider registry**: Easy hot-swap for STT/LLM/TTS/Avatar providers
- **Socratic method**: Tutor asks questions instead of lecturing
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

### Math: Solving for x

**Prompt:** `I don't understand how to solve for x.`

**Expected tutor behavior:**
- Asks what equation the student is working with
- Guides toward isolating x
- Ends with a practice question

### Science: Photosynthesis

**Prompt:** `How does photosynthesis work?`

**Expected tutor behavior:**
- Asks what the student already knows
- Explains sunlight + chlorophyll + CO₂ → glucose
- Ends with a question about why plants need sunlight

### English: Subject-Verb Agreement

**Prompt:** `What is subject-verb agreement?`

**Expected tutor behavior:**
- Asks if student can give an example
- Explains singular vs plural verbs
- Ends with a practice sentence exercise
