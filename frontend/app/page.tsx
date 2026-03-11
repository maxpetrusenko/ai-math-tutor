import React from "react";
import { cookies } from "next/headers";
import { TutorSession } from "../components/TutorSession";
import { AVATAR_PROVIDER_COOKIE_NAME } from "../lib/avatar_preference";

export default async function Page() {
  const cookieStore = await cookies();
  const initialAvatarProviderId = cookieStore.get(AVATAR_PROVIDER_COOKIE_NAME)?.value;

  return <TutorSession initialAvatarProviderId={initialAvatarProviderId} />;
}
