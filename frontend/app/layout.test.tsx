import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  IBM_Plex_Mono: () => ({ variable: "font-body" }),
  Space_Grotesk: () => ({ variable: "font-heading" }),
}));

import RootLayout from "./layout";

test("root layout wraps children in html and body tags", () => {
  const markup = renderToStaticMarkup(
    <RootLayout>
      <div>child</div>
    </RootLayout>
  );

  expect(markup).toContain("lang=\"en\"");
  expect(markup).toContain("font-heading font-body");
  expect(markup).toContain("<body><div>child</div></body>");
});

test("root layout suppresses hydration warnings on body attributes", () => {
  const element = RootLayout({
    children: <div>child</div>,
  });

  expect(element.props.children.props.suppressHydrationWarning).toBe(true);
});
