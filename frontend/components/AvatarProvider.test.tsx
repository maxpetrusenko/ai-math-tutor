import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";


afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});


test("avatar provider lazy loads the 3d avatar branch", async () => {
  vi.doMock("./Avatar3D", () => {
    throw new Error("Avatar3D was imported eagerly");
  });

  await expect(import("./AvatarProvider")).resolves.toBeTruthy();
}, 10000);

test("3d hero loading fallback stays inside the hero shell", async () => {
  vi.doMock("next/dynamic", () => ({
    default: (_loader: unknown, options: { loading: React.ComponentType }) => {
      const Loading = options.loading;
      return function MockDynamicComponent() {
        return <Loading />;
      };
    },
  }));

  const { AvatarProvider } = await import("./AvatarProvider");

  render(
    <AvatarProvider
      config={{ provider: "threejs", type: "3d" }}
      energy={0.2}
      nowMs={0}
      state="idle"
      timestamps={[]}
      variant="hero"
    />
  );

  expect(screen.getByTestId("avatar-surface-3d")).toBeInTheDocument();
  expect(screen.queryByTestId("avatar-surface-3d-loading")).not.toBeInTheDocument();
  expect(screen.getByTestId("avatar-3d-loading")).toBeInTheDocument();
});

test("3d chunk load failures fall back to the 2d shell instead of crashing the page", async () => {
  vi.doMock("next/dynamic", () => ({
    default: () => function MockDynamicComponent() {
      throw new Error("Loading chunk _app-pages-browser_components_Avatar3D_tsx failed.");
    },
  }));

  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const { AvatarProvider } = await import("./AvatarProvider");

  render(
    <AvatarProvider
      config={{ provider: "threejs", type: "3d", assetRef: "human" }}
      energy={0.2}
      nowMs={0}
      state="idle"
      subtitle="Tutor fallback"
      timestamps={[]}
      variant="hero"
    />
  );

  expect(await screen.findByTestId("avatar-surface-2d")).toBeInTheDocument();
  expect(screen.getByText("Tutor fallback")).toBeInTheDocument();
  consoleErrorSpy.mockRestore();
});

test("svg avatars render inside the 2d shell", async () => {
  const { AvatarProvider } = await import("./AvatarProvider");

  render(
    <AvatarProvider
      config={{ provider: "svg", type: "2d", assetRef: "nova" }}
      energy={0.6}
      nowMs={90}
      state="speaking"
      subtitle="Hint mode active"
      timestamps={[{ endMs: 120, startMs: 0, word: "factor" }]}
    />
  );

  expect(screen.getByTestId("avatar-surface-2d")).toBeInTheDocument();
  expect(screen.getByText("Hint mode active")).toBeInTheDocument();
  expect(screen.getByText("Give me hints")).toBeInTheDocument();
  expect(Number(screen.getByTestId("avatar-mouth").getAttribute("data-open"))).toBeGreaterThan(0.8);
});

test("managed avatars render a remote-session placeholder shell", async () => {
  const { AvatarProvider } = await import("./AvatarProvider");

  render(
    <AvatarProvider
      config={{ provider: "simli", providerId: "simli-b97a7777-live", type: "video" }}
      energy={0.2}
      nowMs={0}
      state="idle"
      subtitle="Remote tutor ready"
      timestamps={[]}
      variant="hero"
    />
  );

  expect(screen.getByTestId("avatar-surface-managed")).toBeInTheDocument();
  expect(screen.getByText("Remote LiveKit avatar.")).toBeInTheDocument();
  expect(screen.getByText("Remote tutor ready")).toBeInTheDocument();
});
