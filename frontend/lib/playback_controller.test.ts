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

  const unsubscribe = controller.subscribe((snapshot) => {
    states.push(snapshot.state);
  });

  controller.enqueue({ id: "a", text: "hello", durationMs: 10 });

  await new Promise((resolve) => setTimeout(resolve, 25));

  unsubscribe();

  expect(states).toContain("speaking");
  expect(states.at(-1)).toBe("idle");
  expect(controller.queueLength()).toBe(0);
});


test("playback controller keeps deferred items active until completed explicitly", async () => {
  const controller = new PlaybackController();

  controller.enqueue({ id: "a", text: "hello", durationMs: 10, deferCompletion: true });

  await new Promise((resolve) => setTimeout(resolve, 25));

  expect(controller.state).toBe("speaking");
  expect(controller.queueLength()).toBe(1);

  controller.completeActive("a");

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(controller.state).toBe("idle");
  expect(controller.queueLength()).toBe(0);
});
