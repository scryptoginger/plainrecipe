import assert from "node:assert/strict";
import test from "node:test";

import { findOutboundLink } from "../resolve-parser.ts";

test("finds a recipe link while ignoring Pinterest and pinimg links", () => {
  const html = String.raw`
    {"link":"https://www.pinterest.com/pin/123/"}
    {"link":"https:\/\/i.pinimg.com\/image.jpg"}
    {"link":"https:\/\/exampleblog.com\/recipes\/soup?from=pin"}
  `;
  assert.equal(
    findOutboundLink(html),
    "https://exampleblog.com/recipes/soup?from=pin",
  );
});

test("uses og:see_also when embedded JSON has no destination", () => {
  const html = '<meta content="https://food.example/pasta" property="og:see_also">';
  assert.equal(findOutboundLink(html), "https://food.example/pasta");
});
