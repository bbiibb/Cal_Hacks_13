import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
  buildProfile,
  mapLibraryError,
  normalizeContactEmail,
  normalizeUsername,
  validatePassword,
} from "../convex/lib/authProfile";

function codeOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e instanceof ConvexError ? (e.data as { code: string }).code : "not-convex-error";
  }
  return "no-error";
}

const signUp = { flow: "signUp", username: "  Dr_Test1 ", password: "longenough", firstName: " Ada ", lastName: "Lovelace", email: " Ada@Example.com " };

describe("normalizeUsername", () => {
  it("trims and lowercases", () => expect(normalizeUsername("  Ab_12 ")).toBe("ab_12"));
  it("enforces length 3-20", () => {
    expect(normalizeUsername("ab")).toBeNull();
    expect(normalizeUsername("a".repeat(21))).toBeNull();
    expect(normalizeUsername("a".repeat(20))).toBe("a".repeat(20));
  });
  it("rejects other characters and non-strings", () => {
    expect(normalizeUsername("a b c")).toBeNull();
    expect(normalizeUsername("a-b")).toBeNull();
    expect(normalizeUsername("a@b.com")).toBeNull();
    expect(normalizeUsername(5)).toBeNull();
  });
});

describe("normalizeContactEmail", () => {
  it("accepts and lowercases", () => expect(normalizeContactEmail(" A@B.co ")).toBe("a@b.co"));
  it("rejects bad formats", () => {
    for (const bad of ["", "a", "a@b", "a@@b.co", "a b@c.co", "a@b..co", undefined]) {
      expect(normalizeContactEmail(bad)).toBeNull();
    }
  });
});

describe("validatePassword", () => {
  it("accepts 8 to 128 characters", () => {
    expect(codeOf(() => validatePassword("12345678"))).toBe("no-error");
    expect(codeOf(() => validatePassword("a".repeat(128)))).toBe("no-error");
  });
  it("rejects short, long and non-string", () => {
    expect(codeOf(() => validatePassword("1234567"))).toBe("weak_password");
    expect(codeOf(() => validatePassword("a".repeat(129)))).toBe("weak_password");
    expect(codeOf(() => validatePassword(undefined))).toBe("weak_password");
  });
});

describe("buildProfile", () => {
  it("builds a sign-up profile with the username as account id", () => {
    expect(buildProfile(signUp)).toEqual({
      email: "dr_test1",
      username: "dr_test1",
      firstName: "Ada",
      lastName: "Lovelace",
      contactEmail: "ada@example.com",
    });
  });
  it("needs only the username to sign in", () => {
    expect(buildProfile({ flow: "signIn", username: "Dr_Test1", password: "x" })).toEqual({ email: "dr_test1", username: "dr_test1" });
  });
  it("uses stable error codes", () => {
    expect(codeOf(() => buildProfile({ ...signUp, username: "no" }))).toBe("invalid_username");
    expect(codeOf(() => buildProfile({ flow: "signIn" }))).toBe("invalid_username");
    expect(codeOf(() => buildProfile({ ...signUp, firstName: "  " }))).toBe("invalid_name");
    expect(codeOf(() => buildProfile({ ...signUp, lastName: undefined }))).toBe("invalid_name");
    expect(codeOf(() => buildProfile({ ...signUp, email: "nope" }))).toBe("invalid_email");
  });
});

describe("mapLibraryError", () => {
  const code = (m: string) => (mapLibraryError(new Error(m))?.data as { code: string } | undefined)?.code;
  it("maps unknown username and wrong password to the same code", () => {
    expect(code("InvalidAccountId")).toBe("invalid_credentials");
    expect(code("[Request ID: 1] Server Error\nUncaught Error: InvalidSecret at x")).toBe("invalid_credentials");
  });
  it("maps rate limiting and duplicates", () => {
    expect(code("TooManyFailedAttempts")).toBe("too_many_attempts");
    expect(code("Account bob already exists")).toBe("username_taken");
  });
  it("leaves unknown errors and ConvexErrors alone", () => {
    expect(mapLibraryError(new Error("boom"))).toBeNull();
    expect(mapLibraryError(new ConvexError({ code: "invalid_name" }))).toBeNull();
  });
});
