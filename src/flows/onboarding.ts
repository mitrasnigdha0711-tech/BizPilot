import { createAuthRegister, createBusiness, ApiError } from '@/lib/api';
import type { Business } from '@/types/business';
import type { User } from '@/types/user';

export type OnboardingStep = 'account' | 'business' | 'done';

export interface AccountInput {
  name: string;
  email: string;
  password: string;
}

export interface BusinessSetupInput {
  name: string;
  services: string[];
  monthlyProjectTarget: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  currency: string;
}

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export type FlowResult<T, F extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<F>; formError?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_MONTHLY_TARGET = 200;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveOnboardingStep(
  user: Pick<User, 'businessId'> | null | undefined,
  business: Business | null | undefined,
): OnboardingStep {
  if (!user) return 'account';
  if (!user.businessId || !business) return 'business';
  return 'done';
}

export function validateAccount(input: AccountInput): FieldErrors<keyof AccountInput> {
  const errors: FieldErrors<keyof AccountInput> = {};
  if (!input.name.trim()) {
    errors.name = 'Enter your name';
  }
  if (!EMAIL_PATTERN.test(normalizeEmail(input.email))) {
    errors.email = 'Enter a valid email address';
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return errors;
}

export function validateBusinessSetup(
  input: BusinessSetupInput,
): FieldErrors<keyof BusinessSetupInput> {
  const errors: FieldErrors<keyof BusinessSetupInput> = {};

  if (!input.name.trim()) {
    errors.name = 'Enter a business name';
  }
  if (input.services.length === 0) {
    errors.services = 'Add at least one service';
  }
  if (
    !Number.isInteger(input.monthlyProjectTarget) ||
    input.monthlyProjectTarget < 1 ||
    input.monthlyProjectTarget > MAX_MONTHLY_TARGET
  ) {
    errors.monthlyProjectTarget = `Target must be a whole number between 1 and ${MAX_MONTHLY_TARGET}`;
  }
  if (!TIME_PATTERN.test(input.workingHoursStart)) {
    errors.workingHoursStart = 'Use the HH:mm format';
  }
  if (!TIME_PATTERN.test(input.workingHoursEnd)) {
    errors.workingHoursEnd = 'Use the HH:mm format';
  }
  if (
    !errors.workingHoursStart &&
    !errors.workingHoursEnd &&
    input.workingHoursStart >= input.workingHoursEnd
  ) {
    errors.workingHoursEnd = 'End time must be after start time';
  }
  if (!CURRENCY_PATTERN.test(input.currency)) {
    errors.currency = 'Use a three-letter currency code, such as USD';
  }

  return errors;
}

export async function registerAccount(
  input: AccountInput,
): Promise<FlowResult<User, keyof AccountInput>> {
  const errors = validateAccount(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    const user = await createAuthRegister({
      email: normalizeEmail(input.email),
      password: input.password,
      name: input.name.trim(),
    });
    return { ok: true, value: user };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, errors: {}, formError: err.message };
    }
    throw err;
  }
}

export async function submitBusinessSetup(
  input: BusinessSetupInput,
): Promise<FlowResult<Business, keyof BusinessSetupInput>> {
  const errors = validateBusinessSetup(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    const business = await createBusiness({
      name: input.name.trim(),
      services: input.services,
      monthlyProjectTarget: input.monthlyProjectTarget,
      workingHoursStart: input.workingHoursStart,
      workingHoursEnd: input.workingHoursEnd,
      currency: input.currency,
    });
    return { ok: true, value: business };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, errors: {}, formError: err.message };
    }
    throw err;
  }
}