# Reviewer Checklist

Use this when reviewing the MVP after each major wave.

## Highest Priority

- Does the app run from docs alone without source spelunking?
- Does a real browser mic turn work end to end?
- Do latency numbers come from real events, not placeholders?
- Does interruption feel fast and clean?
- Does the tutor stay Socratic instead of lecturing?

## Product Review

- Are the chosen demo concepts scoped to `1-3` clear concepts?
- Does the tutor ask forward-moving questions?
- Is grade-band language believable for the selected audience?
- Is the tutor encouraging without sounding generic?

### Multi-Turn Quality

- Does the demo show a complete lesson arc (3+ turns)?
- Does the tutor use conversation history appropriately?
- Does each follow-up turn build on the previous one when it is the same problem?
- If the student switches problems, does the tutor stop dragging old context forward?
- Is there clear progression from confusion to understanding?
- Does the lesson end with mastery acknowledgment, not abrupt cutoff?

## UX Review

- Are `idle`, `listening`, `thinking`, and `speaking` visually obvious?
- Does the avatar feel synchronized enough to avoid distraction?
- Is typed input still useful as a debug fallback, if kept?
- Are errors visible and recoverable?

## Technical Review

- Are benchmark numbers based on live-provider timings where they matter?
- Is any part of the loop still faked or hard-coded?
- Is conversation history actually preserved across turns?
- Are env vars, ports, and startup behavior documented exactly?

### Multi-Turn Technical Verification

- History array grows with each turn (verify in network tab)
- `session.reset` event clears history and profile
- Grade band and subject persist across turns unless changed
- Clear topic shifts do not inherit stale prompt context
- Each turn latency is independent (no cumulative lag)

## Submission Review

- Does the benchmark report clearly say go / no-go?
- Does the cost / performance note justify the MVP baseline?
- Does the avatar licensing note prove the demo uses only allowed assets?
- Does the eval summary show a stable multi-turn lesson arc for all three subjects?
- Does the demo video show a real learning arc?
- Are limitations explicit?
