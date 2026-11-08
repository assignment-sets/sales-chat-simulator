import { describe, it, expect } from "vitest";
import {
  validatePassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENT_HINT,
} from "@/lib/validation/password";

describe("lib/validation/password.ts (Password Complexity & Policy)", () => {
  it("rejects empty or non-string passwords", () => {
    const res = validatePassword("");
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.requirements.minLength).toBe(false);
  });

  it("rejects passwords shorter than MIN_PASSWORD_LENGTH (8 chars)", () => {
    const res = validatePassword("Ab1");
    expect(res.isValid).toBe(false);
    expect(res.requirements.minLength).toBe(false);
    expect(res.requirements.hasUpper).toBe(true);
    expect(res.requirements.hasLower).toBe(true);
    expect(res.requirements.hasDigit).toBe(true);
    expect(res.errors).toContain(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  });

  it("rejects passwords exceeding MAX_PASSWORD_LENGTH (72 chars)", () => {
    const longPassword = "A1a" + "x".repeat(70);
    const res = validatePassword(longPassword);
    expect(res.isValid).toBe(false);
    expect(res.requirements.minLength).toBe(false);
    expect(res.errors).toContain(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`);
  });

  it("rejects passwords missing lowercase letters", () => {
    const res = validatePassword("SECUREPASS123");
    expect(res.isValid).toBe(false);
    expect(res.requirements.hasLower).toBe(false);
    expect(res.requirements.hasUpper).toBe(true);
    expect(res.requirements.hasDigit).toBe(true);
    expect(res.errors).toContain("Password must contain at least one lowercase letter.");
  });

  it("rejects passwords missing uppercase letters", () => {
    const res = validatePassword("securepass123");
    expect(res.isValid).toBe(false);
    expect(res.requirements.hasUpper).toBe(false);
    expect(res.requirements.hasLower).toBe(true);
    expect(res.requirements.hasDigit).toBe(true);
    expect(res.errors).toContain("Password must contain at least one uppercase letter.");
  });

  it("rejects passwords missing numeric digits", () => {
    const res = validatePassword("SecurePassword");
    expect(res.isValid).toBe(false);
    expect(res.requirements.hasDigit).toBe(false);
    expect(res.requirements.hasUpper).toBe(true);
    expect(res.requirements.hasLower).toBe(true);
    expect(res.errors).toContain("Password must contain at least one number.");
  });

  it("accepts valid passwords meeting all criteria", () => {
    const res = validatePassword("SecurePass123!");
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.requirements.minLength).toBe(true);
    expect(res.requirements.hasLower).toBe(true);
    expect(res.requirements.hasUpper).toBe(true);
    expect(res.requirements.hasDigit).toBe(true);
    expect(res.details.every((d) => d.met)).toBe(true);
  });

  it("exposes consistent PASSWORD_REQUIREMENT_HINT", () => {
    expect(PASSWORD_REQUIREMENT_HINT).toContain("8 characters");
    expect(PASSWORD_REQUIREMENT_HINT).toContain("uppercase");
    expect(PASSWORD_REQUIREMENT_HINT).toContain("lowercase");
    expect(PASSWORD_REQUIREMENT_HINT).toContain("number");
  });
});
