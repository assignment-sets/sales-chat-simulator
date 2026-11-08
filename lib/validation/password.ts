export interface PasswordRequirementStatus {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  requirements: {
    minLength: boolean;
    hasLower: boolean;
    hasUpper: boolean;
    hasDigit: boolean;
  };
  details: PasswordRequirementStatus[];
}

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

export const PASSWORD_REQUIREMENT_HINT =
  "At least 8 characters, including uppercase, lowercase, and a number";

/**
 * Validates password complexity against Chat2Sell / Supabase Auth policies:
 * - Length: 8 to 72 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one numeric digit
 */
export function validatePassword(password: string): PasswordValidationResult {
  const safePassword = typeof password === "string" ? password : "";

  const minLength =
    safePassword.length >= MIN_PASSWORD_LENGTH &&
    safePassword.length <= MAX_PASSWORD_LENGTH;
  const hasLower = /[a-z]/.test(safePassword);
  const hasUpper = /[A-Z]/.test(safePassword);
  const hasDigit = /[0-9]/.test(safePassword);

  const errors: string[] = [];

  if (safePassword.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  } else if (safePassword.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`);
  }

  if (!hasLower) {
    errors.push("Password must contain at least one lowercase letter.");
  }
  if (!hasUpper) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!hasDigit) {
    errors.push("Password must contain at least one number.");
  }

  const isValid = minLength && hasLower && hasUpper && hasDigit;

  const details: PasswordRequirementStatus[] = [
    {
      id: "length",
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: minLength,
    },
    {
      id: "lower",
      label: "One lowercase letter",
      met: hasLower,
    },
    {
      id: "upper",
      label: "One uppercase letter",
      met: hasUpper,
    },
    {
      id: "digit",
      label: "One number",
      met: hasDigit,
    },
  ];

  return {
    isValid,
    errors,
    requirements: {
      minLength,
      hasLower,
      hasUpper,
      hasDigit,
    },
    details,
  };
}
