These WAV files are fixed speech fixtures for the runtime benchmark.

Purpose:

- stable STT input for `python -m backend.benchmarks.run_latency_benchmark --mode runtime`
- reproducible speech pacing before `speech_end`
- avoid re-transcribing synthetic TTS output during the benchmark itself

Generated on macOS with:

```bash
say -v Samantha -o math_linear_equation_intro.aiff "I don't understand how to solve for x."
afconvert -f WAVE -d LEI16@22050 math_linear_equation_intro.aiff math_linear_equation_intro.wav
```

Repeat the same pattern for the other canned prompt ids.
