import { describe, it, expect } from "vitest";
import { DODO_PRODUCTS, getDodoProductByTier, getDodoProductById } from "@/lib/dodo/products";

describe("Dodo Products Configuration", () => {
  it("defines all three subscription tiers with valid product IDs and pricing", () => {
    expect(DODO_PRODUCTS.solo).toBeDefined();
    expect(DODO_PRODUCTS.team).toBeDefined();
    expect(DODO_PRODUCTS.scale).toBeDefined();

    expect(DODO_PRODUCTS.solo.productId).toMatch(/^pdt_/);
    expect(DODO_PRODUCTS.solo.usdPriceCents).toBe(500);
    expect(DODO_PRODUCTS.solo.inrPricePaise).toBe(39900);

    expect(DODO_PRODUCTS.team.productId).toMatch(/^pdt_/);
    expect(DODO_PRODUCTS.team.usdPriceCents).toBe(2900);
    expect(DODO_PRODUCTS.team.inrPricePaise).toBe(199900);

    expect(DODO_PRODUCTS.scale.productId).toMatch(/^pdt_/);
    expect(DODO_PRODUCTS.scale.usdPriceCents).toBe(7900);
    expect(DODO_PRODUCTS.scale.inrPricePaise).toBe(549900);
  });

  it("retrieves product by tier ID", () => {
    const solo = getDodoProductByTier("solo");
    expect(solo.name).toBe("Chat2Sell Solo");

    const team = getDodoProductByTier("team");
    expect(team.name).toBe("Chat2Sell Team");

    const scale = getDodoProductByTier("scale");
    expect(scale.name).toBe("Chat2Sell Scale");
  });

  it("retrieves product by Dodo product ID", () => {
    const soloId = DODO_PRODUCTS.solo.productId;
    const product = getDodoProductById(soloId);
    expect(product).toBeDefined();
    expect(product?.tierId).toBe("solo");

    const unknown = getDodoProductById("pdt_unknown");
    expect(unknown).toBeUndefined();
  });
});
