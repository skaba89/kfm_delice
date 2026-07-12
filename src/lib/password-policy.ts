/**
 * Password policy — validates password strength.
 *
 * Production: min 12 chars, uppercase, lowercase, digit, special char.
 * Dev/Staging: min 6 chars (relaxed for convenience).
 */

import { isProductionMode } from './runtime-mode';

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (isProductionMode()) {
    // Strict production policy
    if (password.length < 12) {
      errors.push('Le mot de passe doit faire au moins 12 caractères');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une majuscule');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une minuscule');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un chiffre');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un caractère spécial (!@#$...)');
    }
  } else {
    // Relaxed dev/staging policy
    if (password.length < 6) {
      errors.push('Le mot de passe doit faire au moins 6 caractères');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
