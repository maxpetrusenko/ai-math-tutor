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
