import { afterEach, expect, test, vi } from "vitest";


afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});


test("avatar provider lazy loads the 3d avatar branch", async () => {
  vi.doMock("./Avatar3D", () => {
    throw new Error("Avatar3D was imported eagerly");
  });

  await expect(import("./AvatarProvider")).resolves.toBeTruthy();
});
