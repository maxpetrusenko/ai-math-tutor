declare module "@met4citizen/talkinghead" {
  export type TalkingHeadOptions = {
    avatarMood?: string;
    cameraPanEnable?: boolean;
    cameraRotateEnable?: boolean;
    cameraView?: "full" | "mid" | "upper" | "head";
    cameraZoomEnable?: boolean;
    lipsyncModules?: string[];
    modelFPS?: number;
    modelPixelRatio?: number;
    modelMovementFactor?: number;
  };

  export type TalkingHeadAvatarOptions = {
    avatarMood?: string;
    baseline?: Record<string, number>;
    body?: "F" | "M";
    lipsyncLang?: string;
    url: string;
  };

  export type TalkingHeadAudioCue = {
    words: string[];
    wtimes: number[];
    wdurations: number[];
  };

  export class TalkingHead {
    lipsync: Record<string, unknown>;
    mtAvatar: Record<string, {
      applied: number;
      fixed: number | null;
      needsUpdate: boolean;
      v: number;
      value: number;
    }>;
    morphs: Array<{
      morphTargetDictionary: Record<string, number>;
      morphTargetInfluences: number[];
    }>;
    constructor(node: HTMLElement, options?: TalkingHeadOptions);
    dispose(): void;
    setFixedValue(morphTarget: string, value: number | null, transitionMs?: number | null): void;
    setMood(mood: string): void;
    speakAudio(cue: TalkingHeadAudioCue, options?: { isRaw?: boolean; lipsyncLang?: string }): void;
    stopSpeaking(): void;
    showAvatar(
      avatar: TalkingHeadAvatarOptions,
      onProgress?: ((event: ProgressEvent) => void) | null
    ): Promise<void>;
    streamInterrupt(): void;
    streamStop(): void;
  }
}

declare module "@met4citizen/talkinghead/modules/lipsync-en.mjs" {
  export class LipsyncEn {
    preProcessText(text: string): string;
    wordsToVisemes(word: string): {
      durations: number[];
      times: number[];
      visemes: string[];
    };
  }
}
