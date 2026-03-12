import { getCurrentFirebaseIdToken } from "./firebase_auth";

export type LiveKitAvatarBootstrapResponse = {
  participant_identity: string;
  provider: "simli" | "liveavatar";
  provider_id: string;
  room_metadata: Record<string, unknown>;
  room_name: string;
  token: string;
  url: string;
};

function toAvatarSessionUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : url.protocol === "ws:" ? "http:" : url.protocol;
    url.pathname = "/api/avatars/livekit/session";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

function resolveLiveKitAvatarApiUrls() {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    return [];
  }

  const urls: string[] = [];

  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_LESSON_API_URL) {
    urls.push(`${process.env.NEXT_PUBLIC_LESSON_API_URL.replace(/\/api\/lessons$/, "")}/api/avatars/livekit/session`);
  }

  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_WS_URL) {
    const envUrl = toAvatarSessionUrl(process.env.NEXT_PUBLIC_SESSION_WS_URL);
    if (envUrl) {
      urls.push(envUrl);
    }
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname || "127.0.0.1";
    urls.push(`http://${hostname}:8000/api/avatars/livekit/session`);
  } else {
    urls.push("http://127.0.0.1:8000/api/avatars/livekit/session");
    urls.push("http://localhost:8000/api/avatars/livekit/session");
  }

  return [...new Set(urls.filter(Boolean))];
}

export async function createLiveKitAvatarSession(
  avatarProviderId: string,
  participantName: string,
): Promise<LiveKitAvatarBootstrapResponse> {
  const apiUrls = resolveLiveKitAvatarApiUrls();
  if (apiUrls.length === 0) {
    throw new Error("Could not resolve the LiveKit avatar backend URL.");
  }

  const idToken = await getCurrentFirebaseIdToken();
  let lastNetworkError: Error | null = null;

  for (const apiUrl of apiUrls) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          avatarProviderId,
          participantName,
        }),
      });

      if (!response.ok) {
        let detail = "Could not start LiveKit avatar session.";
        try {
          const payload = await response.json() as { detail?: string };
          if (payload.detail) {
            detail = payload.detail;
          }
        } catch {
          // Keep the default message if the backend does not return JSON.
        }
        throw new Error(detail);
      }

      return response.json() as Promise<LiveKitAvatarBootstrapResponse>;
    } catch (error) {
      lastNetworkError = error instanceof Error ? error : new Error("Could not start LiveKit avatar session.");
    }
  }

  throw lastNetworkError ?? new Error("Could not start LiveKit avatar session.");
}
