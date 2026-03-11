# Live AI Video Tutor / Low Latency Response

Derived from the photographed pages now organized under `images/brief/` and `images/starter-kit/`.

## Goal

Build an AI video avatar tutor that:

- teaches 1-3 concepts per session
- targets grades 6-12
- uses the Socratic method
- feels conversational, not chatbot-like
- achieves sub-second end-to-end response latency

Video interaction is a hard requirement.

## Users

- Primary: students in grades 6-12 seeking tutoring help
- Secondary: internal platform team evaluating AI capabilities

## Required Deliverables

- 1-5 minute demo video of a complete tutoring interaction
- working low-latency AI video avatar tutor prototype
- latency benchmarking framework with per-stage results
- educational interaction quality assessment showing Socratic-method effectiveness

## Core Objectives

- teach 1-3 clearly scoped concepts at a 6th-12th grade level
- guide students through questions instead of lecturing
- achieve natural-feeling conversational latency
- ship a functioning video avatar interaction, not text-only tutoring

## Core Product Requirements

### 1. Latency

Hard requirements:

- end-to-end latency from student finishing input to avatar beginning response: under 1 second
- ideal end-to-end latency: under 500 ms
- time to first audio byte: under 500 ms
- lip-sync alignment: within plus or minus 80 ms
- full response completion for a typical exchange: under 3 seconds
- per-stage latency measurement and reporting across STT, LLM, TTS, and avatar rendering
- streaming through the full pipeline; sequential execution is not acceptable

Target per-stage latency budget:

| Stage | Target | Max acceptable |
| --- | ---: | ---: |
| Speech-to-text | <150 ms | <300 ms |
| LLM time to first token | <200 ms | <400 ms |
| TTS first byte | <150 ms | <300 ms |
| Avatar rendering / lip-sync | <100 ms | <200 ms |
| Network + overhead | <50 ms | <100 ms |
| Total end-to-end | <500 ms | <1000 ms |

Latency perception guidance:

- under 200 ms: feels instant
- 200-500 ms: natural thinking pause
- 500 ms to 1 s: noticeable but still acceptable
- over 1 s: starts to feel system-like
- over 3 s: broken conversation

### 2. Video Interaction

Required:

- video-based tutor interaction
- voice input and voice output
- video avatar or equivalent real-time visual tutor representation
- smooth lip-sync
- natural conversational flow
- seamless modality handling where needed

MVP clarification:

- a client-side 2D animated tutor avatar is acceptable for the prototype if it provides a real-time visual tutor representation with visible speaking, listening, and thinking states

Video quality targets:

- avatar rendering latency under 100 ms ideal, under 200 ms acceptable
- audio/video sync within plus or minus 45 ms ideal, plus or minus 80 ms acceptable
- stable frame rate around 20-24 fps or better
- visible engagement cues such as listening or thinking behavior preferred

### 3. Educational Quality

The tutor must use the Socratic method as the primary teaching mode.

Required:

- ask guiding questions instead of giving direct answers
- scaffold understanding with smaller questions
- adapt questioning based on student responses
- redirect wrong answers instead of bluntly correcting
- ask students to explain why when they are right
- keep concepts grade-appropriate for grades 6-12
- maintain accurate subject matter content
- keep the interaction encouraging and engaging

Session expectations:

- cover 1-3 concepts per session
- show a clear learning arc in the demo
- end most tutor turns with a question that advances understanding

Grade-level guidance:

- grades 6-8: concrete language, simple analogies, early algebra / basic science
- grades 9-10: more abstract language, moderate technical vocabulary
- grades 11-12: technical vocabulary and more complex reasoning

### 4. System Architecture

The implementation should be designed for real-time, scalable AI interaction.

Required:

- clear pipeline stages
- efficient serving strategy
- streaming architecture
- benchmarking hooks for every stage
- cost / performance tradeoff analysis

Exploration areas called out in the brief:

- model quantization
- speculative decoding
- response streaming
- edge deployment
- caching and pre-computation
- smaller specialized models

Implementation guidance for planning:

- the MVP may use a WebSocket-based streaming architecture if it still satisfies the latency and visual tutor requirements
- implementation should begin with a benchmark gate that proves the latency budget closes before the full stack is built

### 5. Inputs and Outputs

Inputs:

- text or audio student input
- subject and grade-level context
- relevant conversation history for the current problem
- student pacing / learning preferences when available

Session context behavior:

- preserve conversation history when the student is clearly continuing the same problem
- treat an explicit topic or problem shift as a fresh turn instead of forcing old context into the reply
- avoid hardcoded starter prompts or hardcoded lesson topics in the shipped UX

Outputs:

- streamed tutor text
- synthesized tutor voice
- required avatar / video output
- optional diagrams or visual aids
- latency and quality metrics

## Success Criteria

Minimum success criteria:

- under 1 second end-to-end response latency
- under 500 ms to first streamed audio byte
- lip-sync within plus or minus 80 ms
- full response completion under 3 seconds for typical queries
- clear Socratic questioning
- grade-appropriate teaching
- 1-5 minute demo video covering 1-3 concepts
- no stilted or disconnected conversational feel

## Evaluation Rubric

### Weights

| Area | Weight | Focus |
| --- | ---: | --- |
| Latency performance | 25% | response speed and consistency |
| Video integration | 15% | working video tutor interaction |
| Educational quality | 25% | pedagogy, accuracy, helpfulness |
| Technical innovation | 15% | optimization and architecture choices |
| Implementation quality | 10% | code quality, setup, reproducibility |
| Documentation | 10% | analysis, limitations, recommendations |

### Rubric Highlights

Latency:

- excellent: end-to-end under 500 ms, lip-sync within 45 ms, strong streaming, low variance
- good: end-to-end under 1 s, lip-sync within 80 ms, most pipeline streaming
- acceptable: end-to-end under 2 s, lip-sync within 125 ms
- poor: over 2 s, no meaningful streaming, unstable latency

Video:

- excellent: fully functional avatar with real-time lip-sync, under 100 ms render latency, natural expression
- good: working avatar, under 200 ms render latency, acceptable sync
- acceptable: basic avatar, under 500 ms render latency
- poor: missing or broken avatar, bad sync, unusable frame rate

Educational quality:

- excellent: consistently Socratic, adaptive, encouraging, clear learning arc
- good: mostly Socratic with occasional direct answers
- acceptable: mixed guiding and telling
- poor: lectures, no adaptation, unclear concepts

Implementation quality:

- excellent: modular architecture, one-command setup, strong benchmarking, 15+ tests
- good: reasonable architecture, easy setup, useful benchmarking
- acceptable: basic structure, minimal tests
- poor: disorganized, hard to run, weak documentation

Documentation:

- excellent: detailed latency analysis, tradeoffs, limitations, recommendations, cost analysis when relevant
- good: solid latency analysis and tradeoff discussion
- acceptable: basic reporting only
- poor: missing analysis and recommendations

### Automatic Deductions

- no 1-5 minute demo video: minus 15
- no Socratic method: minus 10
- cannot run from provided instructions: minus 10
- no video avatar component: minus 15
- no per-stage latency measurements: minus 10
- end-to-end latency over 3 seconds: minus 10
- lip-sync over 200 ms: minus 5

### Bonus Points

- under 500 ms end-to-end consistently: plus 3
- lip-sync within 45 ms: plus 2
- novel documented pipeline optimization: plus 3
- production-ready cost analysis and scaling plan: plus 2

## Submission Checklist

- 1-5 minute demo video shows 1-3 concepts taught through the Socratic method
- app runs with one command or very small setup
- README explains setup and usage
- video avatar interaction works with lip-sync
- end-to-end latency is measured and under 1 second
- per-stage latency breakdown is reported
- lip-sync alignment is measured and within 80 ms
- Socratic tutoring is clearly demonstrated
- optimization strategies are documented per stage
- major decisions are logged
- limitations are explicit

## Ambiguous Decisions Left to the Builder

The brief explicitly leaves these choices open:

- text-first versus voice-first interaction emphasis
- where to trade latency against response quality
- build versus buy for speech components
- acceptable cost envelope for real-time inference at scale

## Research Questions From the Brief

- How do you keep STT -> LLM -> TTS -> avatar under 1 second end to end?
- Which stage is the main bottleneck?
- Which optimizations matter most per stage?
- Do voice and video improve learning versus text-only?
- Which LLMs best balance latency and tutoring quality?
- Which avatar stack can stay under 100 ms render / lip-sync latency?
- What does this cost at scale?

## Implementation Guidance Captured From the Brief

Suggested architecture paths:

- collapsed managed pipeline: fastest path to demo, least control
- composable streamed pipeline: recommended starting point
- self-hosted open-source pipeline: most control, most complexity

Core architectural principle:

- the pipeline must be streamed end to end; LLM output should stream into TTS, and TTS should stream into the avatar renderer
