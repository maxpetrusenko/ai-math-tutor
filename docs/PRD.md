# Product Requirements Document

## Live AI Video Tutor

Version: draft 1  
Date: 2026-03-08  
Source of truth for input requirements: `requirements.md`

## 1. Purpose

This document turns the current requirements into an execution-ready PRD for contributors who will design, build, benchmark, and demo a low-latency AI video avatar tutor.

The goal is to remove guesswork. Statements in this PRD are labeled as one of:

- `Required`: explicitly stated by the source requirements
- `Recommended`: strong product interpretation to help execution
- `TBD`: intentionally unresolved and must not be guessed by downstream contributors

## 2. Product Summary

Build a conversational AI video tutor for students in grades 6-12 that teaches 1-3 concepts per session using the Socratic method. The tutor must support voice input, voice output, and a real-time video avatar with low enough latency to feel natural in conversation.

This is not a text chatbot. Video interaction is a hard requirement.

Recommended MVP baseline:

- use a benchmark-gated implementation plan before committing to a full stack
- use a client-side 2D animated tutor avatar for the first prototype if it satisfies the visual tutor and lip-sync requirements
- use simpler transport that meets latency goals before attempting higher-complexity media infrastructure

## 3. Problem Statement

Students benefit from interactive tutoring that guides them toward understanding instead of delivering static answers. Most AI tutoring experiences either feel like chatbots, respond too slowly for spoken conversation, or do not provide a believable visual tutor presence.

This product exists to prove that an AI tutor can:

- feel conversational in real time
- teach through guided questioning
- maintain grade-appropriate explanations
- deliver a complete voice + video tutoring loop under strict latency constraints

## 4. Users

### Primary Users

- Students in grades 6-12 seeking help with a small number of concepts in one session

### Secondary Users

- Internal platform team evaluating AI capability, educational quality, and system performance
- Reviewers or judges evaluating the prototype against demo and rubric criteria

## 5. Product Vision

Create a tutor that feels like a responsive on-screen teaching partner rather than a chatbot. A student should be able to speak naturally, receive a near-immediate spoken response from an animated tutor, and be guided toward understanding through questions, scaffolding, and adaptive feedback.

## 6. Goals

### Product Goals

- `Required` Teach 1-3 clearly scoped concepts per session
- `Required` Support grade-appropriate tutoring for grades 6-12
- `Required` Use the Socratic method as the primary teaching mode
- `Required` Deliver video-based interaction with voice input and voice output
- `Required` Achieve sub-second end-to-end response latency from end of student input to start of avatar response
- `Required` Produce a working prototype and a 1-5 minute demo video

### Success Goals

- `Required` End-to-end latency under 1 second
- `Required` Time to first audio byte under 500 ms
- `Required` Full typical response completion under 3 seconds
- `Required` Lip-sync alignment within +/- 80 ms
- `Required` Per-stage benchmarking across STT, LLM, TTS, and avatar rendering
- `Recommended` Interaction feels natural enough that pauses read as thinking, not waiting

## 7. Non Goals

These items should be treated as out of scope unless later added explicitly:

- Full multi-subject curriculum coverage
- Long-form lesson planning across many sessions
- Parent, teacher, or admin dashboards
- Student accounts, progress tracking, or persistent learning profiles beyond minimal session context
- Production-scale classroom deployment
- Guaranteed pedagogical superiority versus human tutoring
- Text-only tutoring mode as the primary product

## 8. Core User Experience

### Target Experience

1. Student begins a tutoring session with subject and grade-level context.
2. Student speaks or types a question about 1-3 concepts.
3. Tutor responds quickly with speech and synchronized avatar animation.
4. Tutor guides the student using questions, scaffolding, and redirection rather than direct lecture.
5. Student and tutor continue a short conversational loop.
6. Session demonstrates a clear learning arc and ends with the student showing improved understanding.

### UX Principles

- `Required` Conversational, not chatbot-like
- `Required` Socratic, not lecture-first
- `Required` Encouraging and engaging
- `Required` Grade-appropriate in vocabulary and reasoning
- `Recommended` Use visible listening or thinking cues during response generation when helpful
- `Recommended` Favor short, spoken-friendly tutor turns over dense monologues

## 9. Functional Requirements

### 9.1 Tutoring Interaction

- `Required` Tutor must teach 1-3 concepts per session
- `Required` Tutor must use the Socratic method as the default interaction style
- `Required` Tutor must ask guiding questions instead of mostly giving direct answers
- `Required` Tutor must scaffold understanding with smaller questions
- `Required` Tutor must adapt based on student responses
- `Required` Tutor must redirect wrong answers instead of blunt correction
- `Required` Tutor should ask students to explain reasoning when they answer correctly
- `Required` Tutor must maintain accurate subject content
- `Required` Tutor must keep concepts grade-appropriate for grades 6-12

### 9.2 Modalities

- `Required` Student input: audio or text
- `Required` Tutor output: streamed text, synthesized voice, avatar/video output
- `Required` Voice input and voice output must be supported
- `Required` Video avatar or equivalent real-time visual tutor representation must be present
- `Optional` Diagrams or visual aids may be included
- `Recommended` The first prototype may use a client-side 2D animated tutor avatar as the equivalent real-time visual tutor representation

### 9.3 Session Context

- `Required` System must accept subject context
- `Required` System must accept grade-level context
- `Required` System must use conversation history
- `Optional` Student pacing or learning preferences may be used when available

## 10. Performance Requirements

### 10.1 Hard Latency Requirements

- `Required` End-to-end latency from student finishing input to avatar beginning response: under 1 second
- `Required` Ideal end-to-end latency target: under 500 ms
- `Required` Time to first audio byte: under 500 ms
- `Required` Full response completion for a typical exchange: under 3 seconds
- `Required` Streaming must occur through the full pipeline; purely sequential execution is unacceptable
- `Recommended` A benchmark gate should prove latency closes before the team commits to higher-risk infrastructure or avatar branches

### 10.2 Stage Latency Budget

| Stage | Target | Max acceptable |
| --- | ---: | ---: |
| Speech-to-text | <150 ms | <300 ms |
| LLM time to first token | <200 ms | <400 ms |
| TTS first byte | <150 ms | <300 ms |
| Avatar rendering / lip-sync | <100 ms | <200 ms |
| Network + overhead | <50 ms | <100 ms |
| Total end-to-end | <500 ms | <1000 ms |

### 10.3 Latency Perception Guidance

- Under 200 ms feels instant
- 200-500 ms feels like a natural thinking pause
- 500 ms to 1 second is noticeable but acceptable
- Over 1 second starts to feel system-like
- Over 3 seconds feels broken

## 11. Video and Avatar Requirements

- `Required` Video-based tutor interaction
- `Required` Smooth lip-sync
- `Required` Natural conversational flow
- `Required` Stable frame rate around 20-24 fps or better
- `Recommended` Visible engagement cues such as listening or thinking behavior

### Video Quality Targets

- `Required` Avatar rendering latency under 200 ms acceptable
- `Recommended` Avatar rendering latency under 100 ms ideal
- `Required` Audio/video sync within +/- 80 ms acceptable
- `Recommended` Audio/video sync within +/- 45 ms ideal

## 12. Educational Requirements

### Pedagogical Standard

The tutor must demonstrate the Socratic method as the primary educational interaction pattern.

### Required Behaviors

- Ask questions that advance understanding
- Break difficult ideas into smaller reasoning steps
- React to the student’s response quality, not just keywords
- Encourage explanation of reasoning
- Correct gently through redirection and follow-up questions
- Maintain a clear learning arc within a short session

### Grade-Level Guidance

- Grades 6-8: concrete language, simple analogies, early algebra or basic science
- Grades 9-10: somewhat more abstract language, moderate technical vocabulary
- Grades 11-12: more technical vocabulary and more complex reasoning

### Session Quality Bar

- `Required` Most tutor turns should end with a question that moves the student forward
- `Required` The demo should show clear conceptual progress
- `Required` The tutor should remain encouraging and not punitive

## 13. System Requirements

### Required Architecture Characteristics

- `Required` Clear pipeline stages
- `Required` Streaming architecture
- `Required` Efficient serving strategy
- `Required` Benchmarking hooks for every stage
- `Required` Cost and performance tradeoff analysis

### Recommended MVP Baseline

- `Recommended` Start with a WebSocket-based streaming transport if it meets latency requirements
- `Recommended` Use a single authority for turn detection and interruption handling
- `Recommended` Favor a simpler visual tutor representation in the first prototype before evaluating photoreal avatar branches
- `Recommended` Keep speculative generation bounded so only committed text is sent to TTS
- `Recommended` Verify provider quotas, streaming behavior, and timestamp support before implementation begins

### Explicit Exploration Areas

Contributors are expected to evaluate these, not assume all must be used:

- model quantization
- speculative decoding
- response streaming
- edge deployment
- caching and pre-computation
- smaller specialized models

### Architecture Constraint

The system must be designed as a real-time interactive pipeline, not a batch chain of disconnected components.

## 14. Deliverables

- `Required` Working low-latency AI video avatar tutor prototype
- `Required` 1-5 minute demo video of a complete tutoring interaction
- `Required` Latency benchmarking framework with per-stage results
- `Required` Educational interaction quality assessment showing Socratic-method effectiveness
- `Required` Setup and usage documentation
- `Recommended` Major decision log
- `Recommended` Explicit limitations and future recommendations
- `Recommended` Benchmark report documenting phase-gate decisions, p50/p95 latency, and any deferred branches

## 15. Acceptance Criteria

The project should not be considered complete unless all of the following are true:

- A student can interact with the tutor using voice
- The tutor responds with synthesized speech and visible avatar output
- The avatar response starts in under 1 second after student input ends
- First audio byte arrives in under 500 ms
- Lip-sync stays within +/- 80 ms
- A typical exchange completes in under 3 seconds
- Per-stage latency is measured and reported
- The demo clearly shows 1-3 concepts being taught
- The demo clearly shows Socratic questioning
- The system can be run from provided instructions

## 16. Success Metrics

### Primary Metrics

- End-to-end latency
- Time to first audio byte
- Lip-sync alignment error
- Full response completion time
- Per-stage latency variance
- Percentage of tutor turns that are Socratic rather than declarative
- Reviewer assessment of grade appropriateness

### Secondary Metrics

- Conversation naturalness
- Response coherence
- Student engagement cues
- Setup reproducibility
- Cost per session estimate

## 17. Evaluation Rubric

This section exists so downstream teams do not have to reverse-engineer judging criteria.

| Area | Weight | What matters |
| --- | ---: | --- |
| Latency performance | 25% | response speed and consistency |
| Video integration | 15% | working video tutor interaction |
| Educational quality | 25% | pedagogy, accuracy, helpfulness |
| Technical innovation | 15% | optimization and architecture choices |
| Implementation quality | 10% | code quality, setup, reproducibility |
| Documentation | 10% | analysis, limitations, recommendations |

### Rubric Highlights

Latency:

- Excellent: under 500 ms end-to-end, lip-sync within 45 ms, strong streaming, low variance
- Good: under 1 second end-to-end, lip-sync within 80 ms, mostly streaming
- Acceptable: under 2 seconds end-to-end, lip-sync within 125 ms
- Poor: over 2 seconds, weak or absent streaming, unstable latency

Video:

- Excellent: fully functional avatar with real-time lip-sync, under 100 ms render latency, natural expression
- Good: working avatar, under 200 ms render latency, acceptable sync
- Acceptable: basic avatar, under 500 ms render latency
- Poor: missing or broken avatar, bad sync, unusable frame rate

Educational quality:

- Excellent: consistently Socratic, adaptive, encouraging, clear learning arc
- Good: mostly Socratic with occasional direct answers
- Acceptable: mixed guiding and telling
- Poor: lecture-heavy, weak adaptation, unclear concepts

Implementation quality:

- Excellent: modular architecture, one-command setup, strong benchmarking, 15+ tests
- Good: reasonable architecture, easy setup, useful benchmarking
- Acceptable: basic structure, minimal tests
- Poor: hard to run, weak structure, weak evidence

Documentation:

- Excellent: detailed latency analysis, tradeoffs, limitations, recommendations, cost analysis where relevant
- Good: solid latency analysis and tradeoff discussion
- Acceptable: basic reporting
- Poor: missing analysis or unclear instructions

## 18. Automatic Deductions and Bonuses

### Automatic Deductions

- No 1-5 minute demo video: -15
- No Socratic method: -10
- Cannot run from provided instructions: -10
- No video avatar component: -15
- No per-stage latency measurements: -10
- End-to-end latency over 3 seconds: -10
- Lip-sync over 200 ms: -5

### Bonus Opportunities

- Under 500 ms end-to-end consistently: +3
- Lip-sync within 45 ms: +2
- Novel documented pipeline optimization: +3
- Production-ready cost analysis and scaling plan: +2

## 19. Assumptions To Avoid

Downstream contributors must not assume the following unless explicitly assigned:

- Any provider beyond the currently locked MVP baseline
- Whether the tutor is browser-based, desktop-based, or mobile-based
- Whether the avatar is photorealistic, stylized, 2D, or 3D
- Which subjects are in the demo unless specified elsewhere
- Whether voice-first or text-first is the main entry path
- What the target cost envelope is
- What deployment topology is required for final delivery

## 20. Open Questions and TBD Decisions

These are intentionally unresolved in the source requirements and should be assigned explicitly later.

### Product Decisions

- `TBD` Which subjects and exact concepts will be used in the demo
- `TBD` Whether the MVP is voice-first with text fallback or equal support for both
- `TBD` Whether diagrams or visual aids are part of MVP or stretch scope
- `TBD` What level of tutor persona and visual expressiveness is expected

### Technical Decisions

- `Resolved` STT provider: Deepgram
- `Resolved` Realtime transport baseline: backend WebSocket
- `Resolved` Frontend stack baseline: Next.js 15 with TypeScript
- `Resolved` Backend stack baseline: FastAPI
- `Resolved` Primary LLM: MiniMax-M2.5
- `Resolved` Secondary LLM fallback for evaluation: `Gemini 3.1 Flash-Lite Preview`
- `Resolved` MVP visual tutor baseline: client-side 2D animated tutor avatar
- `Resolved` Primary TTS provider for implementation: Cartesia Sonic-3
- `Resolved` A fallback TTS branch may be opened only if the primary path fails the benchmark gate
- `Resolved` The response pipeline should use committed phrase or sentence playback to minimize delay without unstable audio
- `Resolved` MVP implementation should begin with a benchmark gate before higher-risk avatar or transport branches open
- `TBD` Whether inference runs locally, at the edge, or in the cloud
- `TBD` What cost target is acceptable per session
- `TBD` What observability stack records latency metrics

### Evaluation Decisions

- `TBD` How Socratic effectiveness will be scored operationally
- `TBD` Who signs off on educational quality
- `TBD` What counts as a representative “typical exchange” for latency measurement

## 21. Risks

### Product Risks

- Fast responses may reduce educational quality if the tutor becomes too shallow
- Strong pedagogy may increase latency if prompt or model strategy is too heavy
- Avatar realism may increase complexity without improving learning outcomes

### Technical Risks

- One slow stage can consume the entire latency budget
- Good component benchmarks may still fail at full pipeline latency
- Lip-sync and rendering quality may degrade under streaming pressure
- Network variability may make local demos perform differently from hosted demos

### Delivery Risks

- Teams may optimize for rubric points while missing natural conversation quality
- Teams may ship a good demo but weak reproducibility
- Teams may guess undefined requirements and build the wrong thing

## 22. Recommended Workstreams For Later Task Split

This section is guidance only. It does not assign implementation order, but it identifies natural ownership boundaries.

- Product and pedagogy
- Conversation design and prompt strategy
- Speech pipeline: STT and TTS
- Client-side avatar and rendering
- WebSocket session and turn-taking orchestration
- Benchmark harness and latency reporting
- Benchmarking and observability
- Demo production
- Evaluation, documentation, and evidence packaging

## 23. Submission Checklist

- 1-5 minute demo video exists
- App runs with one command or very small setup
- README explains setup and usage
- Video avatar interaction works with lip-sync
- End-to-end latency is measured and under 1 second
- Per-stage latency breakdown is reported
- Lip-sync alignment is measured and within 80 ms
- Socratic tutoring is clearly demonstrated
- Optimization strategies are documented per stage
- Major decisions are logged
- Limitations are explicit

## 24. Final Direction

If there is any conflict between a downstream design choice and this PRD, contributors should prefer:

1. Explicit `Required` items in this document
2. Measured latency and pedagogical evidence over intuition
3. Marking unknowns as `TBD` over silently filling gaps

This project should be executed as a product prototype with hard technical constraints, not as a pure research demo and not as a generic chatbot.
