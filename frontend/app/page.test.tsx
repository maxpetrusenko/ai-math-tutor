import React from "react";
import { render, screen } from "@testing-library/react";

import Page from "./page";

test("page renders the landing hero", async () => {
  render(await Page());

  expect(screen.getByText("Your Personal AI Math Tutor")).toBeInTheDocument();
  expect(screen.getAllByText("Start Learning Free")).toHaveLength(2);
  expect(screen.getByText("What Students Say")).toBeInTheDocument();
});
