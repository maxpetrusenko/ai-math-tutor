import { PlaybackController } from "./playback_controller";


test("playback controller clears queue on interrupt", () => {
  const controller = new PlaybackController();
  controller.enqueue({ id: "a", text: "hello" });
  controller.enqueue({ id: "b", text: "world" });

  controller.interrupt();

  expect(controller.queueLength()).toBe(0);
  expect(controller.state).toBe("idle");
});


test("playback controller notifies listeners and completes playback", async () => {
  const controller = new PlaybackController();
  const states: string[] = [];

  const unsubscribe = controller.subscribe((state) => {
    states.push(state);
  });

  controller.enqueue({ id: "a", text: "hello", durationMs: 10 });

  await new Promise((resolve) => setTimeout(resolve, 25));

  unsubscribe();

  expect(states).toContain("speaking");
  expect(states.at(-1)).toBe("idle");
  expect(controller.queueLength()).toBe(0);
});
