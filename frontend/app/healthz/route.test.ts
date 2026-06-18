test("frontend healthz route reports readiness without caching", async () => {
  const { GET } = await import("./route");

  const response = await GET();

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    service: "frontend",
    status: "ok",
  });
});
