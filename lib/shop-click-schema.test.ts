import { describe, it, expect } from "vitest";
import { MAX_BODY_CHARS, parseShopClick } from "./shop-click-schema";
import { buildShopClickBody } from "./shop-clicks";
import { buildGoogleShoppingUrl } from "./shopping-links";

const NAMES = ["NVIDIA GeForce RTX 4070"];
const valid = { retailer: "amazon", query: "NVIDIA GeForce RTX 4070", page: "pair" };

describe("parseShopClick", () => {
  it("accepts a valid click and resolves the part", () => {
    expect(parseShopClick(JSON.stringify(valid), NAMES)).toEqual({
      ok: true,
      click: { retailer: "amazon", page: "pair", part: "NVIDIA GeForce RTX 4070" },
    });
  });

  it("trims the query before matching", () => {
    expect(parseShopClick(JSON.stringify({ ...valid, query: "  NVIDIA GeForce RTX 4070 " }), NAMES).ok).toBe(true);
  });

  it.each([
    ["a JSON string", "click"],
    ["null", null],
    ["unknown retailer", { ...valid, retailer: "ebay" }],
    ["unknown page", { ...valid, page: "admin" }],
    ["empty query", { ...valid, query: "  " }],
    ["oversized query", { ...valid, query: "x".repeat(121) }],
    ["missing field", { retailer: "amazon", query: "NVIDIA GeForce RTX 4070" }],
  ])("rejects %s as invalid", (_, body) => {
    expect(parseShopClick(JSON.stringify(body), NAMES)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a body that isn't JSON", () => {
    expect(parseShopClick("not json", NAMES)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an oversized body before parsing it", () => {
    expect(parseShopClick("x".repeat(MAX_BODY_CHARS + 1), NAMES)).toEqual({ ok: false, reason: "too-large" });
  });

  it("rejects a query that names no catalogue part", () => {
    expect(parseShopClick(JSON.stringify({ ...valid, query: "Some Other GPU" }), NAMES)).toEqual({ ok: false, reason: "unknown-part" });
  });
});

describe("client–server contract", () => {
  it("accepts the body the browser tracker builds", () => {
    const body = buildShopClickBody(buildGoogleShoppingUrl("NVIDIA GeForce RTX 4070"), "/gpus")!;
    expect(parseShopClick(body, NAMES)).toEqual({
      ok: true,
      click: { retailer: "google-shopping", page: "gpus", part: "NVIDIA GeForce RTX 4070" },
    });
  });
});
