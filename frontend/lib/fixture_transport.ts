import { resolveAvatarProvider } from "../components/avatar_registry";
import type { SessionTransport, TutorTurnRequest, TutorTurnResult } from "../components/TutorSession";

type FixtureScenarioId = "guided-fractions" | "science-observation";

type FixtureTurn = {
  tutorText: string;
  latency: TutorTurnResult["latency"];
};

type FixtureScenario = {
  id: FixtureScenarioId;
  turns: FixtureTurn[];
};

type FixtureTransportOptions = {
  avatarId?: string;
  scenarioId?: FixtureScenarioId;
};

const FIXTURE_SCENARIOS: Record<FixtureScenarioId, FixtureScenario> = {
  "guided-fractions": {
    id: "guided-fractions",
    turns: [
      {
        tutorText: "Let us anchor the fraction idea first. If one pizza is cut into four equal slices, what fraction is one slice?",
        latency: {
          speechEndToSttFinalMs: 80,
          sttFinalToLlmFirstTokenMs: 65,
          llmFirstTokenToTtsFirstAudioMs: 95,
        },
      },
      {
        tutorText: "Good instinct to check the operation. Before multiplying, what does the denominator tell you about the size of each piece?",
        latency: {
          speechEndToSttFinalMs: 82,
          sttFinalToLlmFirstTokenMs: 68,
          llmFirstTokenToTtsFirstAudioMs: 98,
        },
      },
    ],
  },
  "science-observation": {
    id: "science-observation",
    turns: [
      {
        tutorText: "Start with an observation. When a plant gets light, what change do you expect to notice over time?",
        latency: {
          speechEndToSttFinalMs: 78,
          sttFinalToLlmFirstTokenMs: 63,
          llmFirstTokenToTtsFirstAudioMs: 92,
        },
      },
      {
        tutorText: "Nice. Now push it one step further. Why would less light change the way that plant grows?",
        latency: {
          speechEndToSttFinalMs: 79,
          sttFinalToLlmFirstTokenMs: 64,
          llmFirstTokenToTtsFirstAudioMs: 93,
        },
      },
    ],
  },
};

function buildWordTimestamps(text: string): TutorTurnResult["timestamps"] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => ({
      word,
      startMs: index * 120,
      endMs: index * 120 + 90,
    }));
}

export function createFixtureTransport(options: FixtureTransportOptions = {}): SessionTransport {
  const scenario = FIXTURE_SCENARIOS[options.scenarioId ?? "guided-fractions"];
  const avatar = options.avatarId ? resolveAvatarProvider(options.avatarId) : null;
  let currentSessionId = "fixture-session";
  let turnIndex = 0;

  return {
    async connect() {
      return "connected";
    },
    getSessionId() {
      return currentSessionId;
    },
    async runTurn(request: TutorTurnRequest) {
      const turn = scenario.turns[Math.min(turnIndex, scenario.turns.length - 1)];
      turnIndex += 1;

      return {
        transcript: request.studentText,
        tutorText: turn.tutorText,
        state: "speaking",
        latency: turn.latency,
        timestamps: buildWordTimestamps(turn.tutorText),
        avatarConfig: avatar
          ? {
              assetRef: avatar.config.assetRef,
              model_url: avatar.config.model_url,
              provider: avatar.config.provider,
              type: avatar.config.type,
            }
          : undefined,
      };
    },
    async interrupt() {
      return;
    },
    async reset() {
      turnIndex = 0;
    },
    async switchSession(sessionId) {
      currentSessionId = sessionId;
      turnIndex = 0;
    },
  };
}
