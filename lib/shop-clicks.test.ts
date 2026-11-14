import { describe, it, expect } from "vitest";
import { buildShopClickBody, classifyShopHref, isCountableButton, pageKind, resolvePart, utcDay } from "./shop-clicks";
import { buildAmazonSearchUrl, buildGoogleShoppingUrl, buildPcPartPickerUrl } from "./shopping-links";

const NAMES = ["NVIDIA GeForce RTX 4070", "NVIDIA GeForce RTX 4070 SUPER", "AMD Ryzen 7 9800X3D"];

describe("classifyShopHref", () => {
  it("recognises the links shopping-links builds", () => {
    process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG = "test-21";
    expect(classifyShopHref(buildAmazonSearchUrl("NVIDIA GeForce RTX 4070")!)).toEqual({
      retailer: "amazon",
      query: "NVIDIA GeForce RTX 4070",
    });
    expect(classifyShopHref(buildGoogleShoppingUrl("AMD Ryzen 7 9800X3D"))).toEqual({
      retailer: "google-shopping",
      query: "AMD Ryzen 7 9800X3D",
    });
    expect(classifyShopHref(buildPcPartPickerUrl("NVIDIA GeForce RTX 4070"))).toEqual({
      retailer: "pcpartpicker",
      query: "RTX 4070",
    });
  });

  it("ignores other links", () => {
    expect(classifyShopHref("https://www.tomshardware.com/reviews/gpu-hierarchy,4388.html")).toBeNull();
    expect(classifyShopHref("https://www.google.com/search?q=RTX+4070")).toBeNull(); // not Shopping
    expect(classifyShopHref("https://www.amazon.de/dp/B0CGJ9STNF")).toBeNull();
    expect(classifyShopHref("https://evil.example/s?k=RTX")).toBeNull();
    expect(classifyShopHref("https://amazon.de.evil.example/s?k=RTX")).toBeNull();
  });

  it("ignores malformed, empty and oversized queries", () => {
    expect(classifyShopHref("not a url")).toBeNull();
    expect(classifyShopHref("https://www.amazon.de/s?k=")).toBeNull();
    expect(classifyShopHref(`https://www.amazon.de/s?k=${"x".repeat(121)}`)).toBeNull();
  });
});

describe("pageKind", () => {
  it.each([
    ["/", "home"],
    ["/cpus", "cpus"],
    ["/gpus", "gpus"],
    ["/cpu/amd-ryzen-7-9800x3d", "cpu"],
    ["/gpu/nvidia-geforce-rtx-4070", "gpu"],
    ["/bottleneck/a-vs-b", "pair"],
    ["/local-ai", "local-ai"],
    ["/local-ai/coding-agents", "local-ai"],
    ["/terms", "other"],
  ])("%s → %s", (path, kind) => {
    expect(pageKind(path)).toBe(kind);
  });
});

describe("resolvePart", () => {
  it("matches a full model name exactly", () => {
    expect(resolvePart({ retailer: "amazon", query: "NVIDIA GeForce RTX 4070" }, NAMES)).toBe("NVIDIA GeForce RTX 4070");
    expect(resolvePart({ retailer: "amazon", query: "RTX 4070" }, NAMES)).toBeNull();
  });

  it("matches PCPartPicker's shortened name", () => {
    expect(resolvePart({ retailer: "pcpartpicker", query: "RTX 4070 SUPER" }, NAMES)).toBe("NVIDIA GeForce RTX 4070 SUPER");
  });

  it("rejects names outside the catalogue", () => {
    expect(resolvePart({ retailer: "google-shopping", query: "anything at all" }, NAMES)).toBeNull();
  });
});

describe("utcDay", () => {
  it("truncates to midnight UTC", () => {
    expect(utcDay(new Date("2026-11-14T23:59:59+02:00")).toISOString()).toBe("2026-11-14T00:00:00.000Z");
    expect(utcDay(new Date("2026-11-15T01:30:00+02:00")).toISOString()).toBe("2026-11-14T00:00:00.000Z");
  });
});

describe("isCountableButton", () => {
  it("counts left and middle clicks only", () => {
    expect(isCountableButton(0)).toBe(true);
    expect(isCountableButton(1)).toBe(true);
    expect(isCountableButton(2)).toBe(false);
  });
});

describe("buildShopClickBody", () => {
  it("builds the body the API expects for a shop link", () => {
    expect(JSON.parse(buildShopClickBody(buildGoogleShoppingUrl("AMD Ryzen 7 9800X3D"), "/cpu/x")!)).toEqual({
      retailer: "google-shopping",
      query: "AMD Ryzen 7 9800X3D",
      page: "cpu",
    });
  });

  it("is null for other links", () => {
    expect(buildShopClickBody("https://hardwarestack.dev/gpus", "/")).toBeNull();
  });
});
