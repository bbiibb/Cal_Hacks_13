// Pure helpers for username-based accounts (no database, no network), so they can be unit tested.
// Used by convex/auth.ts. The Convex Auth Password provider identifies an account by
// `profile(params).email`; here that value is the lowercased USERNAME (see docs/auth.md).
import { ConvexError } from "convex/values";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 50;
export const EMAIL_MAX = 254;

// Stable codes the frontend can switch on: error.data.code
export const AUTH_ERROR_CODES = [
  "invalid_username",
  "invalid_name",
  "invalid_email",
  "weak_password",
  "username_taken",
  "invalid_credentials",
  "too_many_attempts",
  "invalid_request",
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_username: `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters: letters, numbers, or underscore.`,
  invalid_name: `First and last name are required (up to ${NAME_MAX} characters).`,
  invalid_email: "Enter a valid email address.",
  weak_password: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`,
  username_taken: "That username is already taken.",
  invalid_credentials: "Incorrect username or password.",
  too_many_attempts: "Too many failed attempts. Try again later.",
  invalid_request: "The request was not valid.",
};

export function authError(code: AuthErrorCode): ConvexError<{ code: AuthErrorCode; message: string }> {
  return new ConvexError({ code, message: MESSAGES[code] });
}

const USERNAME_RE = /^[a-z0-9_]+$/;
// Deliberately simple: one "@", no spaces, a dot in the domain part.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Trim and lowercase. Returns null when the result is not a valid username. */
export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return null;
  return USERNAME_RE.test(name) ? name : null;
}

export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

/** Trim and lowercase. Returns null when the format is not valid. */
export function normalizeContactEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > EMAIL_MAX) return null;
  return EMAIL_RE.test(email) ? email : null;
}

/** Throws ConvexError({ code: "weak_password" }). Used for sign up only. */
export function validatePassword(password: unknown): void {
  if (typeof password !== "string" || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw authError("weak_password");
  }
}

export type SignInProfile = { email: string; username: string };
export type SignUpProfile = SignInProfile & { firstName: string; lastName: string; contactEmail: string };

/**
 * Validates the client form fields and builds the profile the library stores.
 * `email` is only the account id (the lowercased username); it is not a real email address.
 * signIn needs only the username; signUp also needs firstName, lastName and email.
 */
export function buildProfile(params: Record<string, unknown>): SignInProfile | SignUpProfile {
  const username = normalizeUsername(params.username);
  if (username === null) throw authError("invalid_username");
  if (params.flow !== "signUp") return { email: username, username };

  const firstName = normalizeName(params.firstName);
  const lastName = normalizeName(params.lastName);
  if (firstName === null || lastName === null) throw authError("invalid_name");
  const contactEmail = normalizeContactEmail(params.email);
  if (contactEmail === null) throw authError("invalid_email");
  return { email: username, username, firstName, lastName, contactEmail };
}

/**
 * Maps the plain Errors thrown by the library (it does not throw ConvexError) to our codes.
 * Unknown username and wrong password are deliberately the same code, so the form does not reveal
 * which usernames exist. Returns null for errors that should not be translated.
 */
export function mapLibraryError(error: unknown): ConvexError<{ code: AuthErrorCode; message: string }> | null {
  if (error instanceof ConvexError) return null;
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("InvalidAccountId") || text.includes("InvalidSecret") || text.includes("Invalid credentials")) {
    return authError("invalid_credentials");
  }
  if (text.includes("TooManyFailedAttempts")) return authError("too_many_attempts");
  if (/Account \S+ already exists/.test(text)) return authError("username_taken");
  if (text.includes("Missing `password`") || text.includes("Missing `flow`")) return authError("invalid_request");
  return null;
}
