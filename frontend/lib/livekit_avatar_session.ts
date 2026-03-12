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

class LiveKitAvatarBootstrapHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LiveKitAvatarBootstrapHttpError";
    this.status = status;
  }
}

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

function isLikelyLocalBackendHost(hostname: string) {
  if (!hostname) {
    return false;
  }

  if (
    hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.startsWith("10.")
    || hostname.startsWith("192.168.")
  ) {
    return true;
  }

  const private172Match = hostname.match(/^172\.(\d{1,3})\./);
  if (private172Match) {
    const secondOctet = Number.parseInt(private172Match[1] ?? "", 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return hostname.endsWith(".local") || hostname.endsWith(".internal");
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
    const origin = window.location.origin;
    const hostname = window.location.hostname || "127.0.0.1";
    const localBackendUrl = `http://${hostname}:8000/api/avatars/livekit/session`;

    if (isLikelyLocalBackendHost(hostname)) {
      urls.push(localBackendUrl);
      urls.push("http://127.0.0.1:8000/api/avatars/livekit/session");
      urls.push("http://localhost:8000/api/avatars/livekit/session");
      urls.push(`${origin}/api/avatars/livekit/session`);
    } else {
      urls.push(`${origin}/api/avatars/livekit/session`);
      urls.push(localBackendUrl);
      urls.push("http://127.0.0.1:8000/api/avatars/livekit/session");
      urls.push("http://localhost:8000/api/avatars/livekit/session");
    }
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
        throw new LiveKitAvatarBootstrapHttpError(response.status, detail);
      }

      return response.json() as Promise<LiveKitAvatarBootstrapResponse>;
    } catch (error) {
      if (error instanceof LiveKitAvatarBootstrapHttpError) {
        if (error.status === 404) {
          lastNetworkError = error;
          continue;
        }
        throw error;
      }
      lastNetworkError = error instanceof Error ? error : new Error("Could not start LiveKit avatar session.");
    }
  }

  throw lastNetworkError ?? new Error("Could not start LiveKit avatar session.");
}
