import axios from 'axios';

export interface ParsedApiError {
  message: string;
  code?: string;
  status?: number;
  fieldErrors?: Record<string, string[]>;
  isNetworkError?: boolean;
  isAuthError?: boolean;
}

/**
 * Normalizes any error (Axios, Supabase, network, or JavaScript runtime error)
 * into a safe, human-readable, user-friendly format without leaking stack traces or raw SQL.
 */
export function parseApiError(error: unknown): ParsedApiError {
  if (!error) {
    return {
      message: 'An unexpected issue occurred. Please try again.',
      code: 'UNKNOWN_ERROR',
    };
  }

  // 1. Handle Axios HTTP Errors
  if (axios.isAxiosError(error)) {
    // A. Network / Timeout / Offline failures
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return {
        message: 'The request timed out. Please check your internet connection and try again.',
        code: 'TIMEOUT',
        isNetworkError: true,
      };
    }

    if (error.code === 'ERR_NETWORK' || !error.response) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      return {
        message: isOffline
          ? 'You appear to be offline. Please verify your network connection.'
          : 'Unable to reach the hospital server. Please verify your connection or try again in a few moments.',
        code: 'NETWORK_ERROR',
        isNetworkError: true,
      };
    }

    const status = error.response.status;
    const data = error.response.data as any;

    // B. Check for standardized backend payload: { error, code, field_errors }
    const backendMessage = typeof data?.error === 'string' ? data.error : null;
    const backendDetail = typeof data?.detail === 'string' ? data.detail : null;
    const backendCode = typeof data?.code === 'string' ? data.code : undefined;
    const fieldErrors = data?.field_errors && typeof data.field_errors === 'object' ? data.field_errors : undefined;

    // C. Handle status codes
    switch (status) {
      case 400: {
        // If specific validation field errors exist
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const firstKey = Object.keys(fieldErrors)[0];
          const firstMsg = fieldErrors[firstKey]?.[0] || 'Invalid input.';
          return {
            message: backendMessage || `${firstKey.replace(/_/g, ' ')}: ${firstMsg}`,
            code: backendCode || 'VALIDATION_ERROR',
            status,
            fieldErrors,
          };
        }

        // Generic field error object from DRF: { field: ["error"] }
        if (data && typeof data === 'object' && !backendMessage && !backendDetail) {
          const extractedFields: Record<string, string[]> = {};
          let firstMsg = '';
          for (const [k, v] of Object.entries(data)) {
            if (Array.isArray(v) && v.length > 0) {
              extractedFields[k] = v.map(String);
              if (!firstMsg) firstMsg = `${k.replace(/_/g, ' ')}: ${v[0]}`;
            } else if (typeof v === 'string') {
              extractedFields[k] = [v];
              if (!firstMsg) firstMsg = `${k.replace(/_/g, ' ')}: ${v}`;
            }
          }
          if (firstMsg) {
            return {
              message: firstMsg,
              code: 'VALIDATION_ERROR',
              status,
              fieldErrors: extractedFields,
            };
          }
        }

        return {
          message: backendMessage || backendDetail || 'Please review the entered information and correct any highlighted issues.',
          code: backendCode || 'BAD_REQUEST',
          status,
          fieldErrors,
        };
      }

      case 401:
        return {
          message: backendMessage || 'Your session has expired or is invalid. Please sign in again to continue.',
          code: backendCode || 'AUTHENTICATION_REQUIRED',
          status,
          isAuthError: true,
        };

      case 403:
        return {
          message: backendMessage || backendDetail || 'You do not have permission to perform this action with your current role.',
          code: backendCode || 'FORBIDDEN',
          status,
          isAuthError: true,
        };

      case 404:
        return {
          message: backendMessage || backendDetail || 'The requested hospital record could not be found. It may have been removed or moved.',
          code: backendCode || 'NOT_FOUND',
          status,
        };

      case 409:
        return {
          message: backendMessage || 'A record or conflicting schedule already exists with these details.',
          code: backendCode || 'CONFLICT',
          status,
        };

      case 422:
        return {
          message: backendMessage || backendDetail || 'The submitted data could not be processed. Please check the values and retry.',
          code: backendCode || 'UNPROCESSABLE_ENTITY',
          status,
          fieldErrors,
        };

      case 429:
        return {
          message: backendMessage || 'Too many requests were made. Please pause for a few seconds before retrying.',
          code: backendCode || 'RATE_LIMITED',
          status,
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          message: 'The hospital clinical service is temporarily unavailable. Please retry in a few moments.',
          code: backendCode || 'SERVER_UNAVAILABLE',
          status,
        };

      default:
        return {
          message: backendMessage || backendDetail || `An error occurred (HTTP ${status}). Please try again.`,
          code: backendCode || 'HTTP_ERROR',
          status,
        };
    }
  }

  // 2. Handle Supabase Auth Errors
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const rawMsg = String((error as any).message || '');
    const code = (error as any).code || (error as any).error_code;

    if (rawMsg.includes('Invalid login credentials') || code === 'invalid_credentials') {
      return {
        message: 'Incorrect email address or password. Please verify your credentials and try again.',
        code: 'INVALID_CREDENTIALS',
        isAuthError: true,
      };
    }

    if (rawMsg.includes('Email not confirmed') || code === 'email_not_confirmed') {
      return {
        message: 'Your email address has not been confirmed yet. Please verify your email before signing in.',
        code: 'EMAIL_NOT_CONFIRMED',
        isAuthError: true,
      };
    }

    if (rawMsg.includes('User already registered') || code === 'user_already_exists') {
      return {
        message: 'An account with this email address already exists. Please sign in directly.',
        code: 'USER_ALREADY_EXISTS',
      };
    }

    if (rawMsg.includes('Password should be at least') || code === 'weak_password') {
      return {
        message: 'Password must be at least 8 characters long and include numbers or special characters.',
        code: 'WEAK_PASSWORD',
      };
    }

    if (rawMsg.includes('Email rate limit exceeded') || code === 'over_email_send_rate_limit') {
      return {
        message: 'Too many authentication attempts. Please wait a few minutes before trying again.',
        code: 'RATE_LIMITED',
      };
    }

    return {
      message: rawMsg,
      code: code || 'AUTH_ERROR',
      isAuthError: true,
    };
  }

  // 3. Handle standard JavaScript Error
  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred.',
      code: error.name || 'JS_ERROR',
    };
  }

  // 4. Fallback string
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'STRING_ERROR',
    };
  }

  return {
    message: 'An unexpected issue occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Extracts a specific field error message if available
 */
export function getFieldError(parsed: ParsedApiError | null, field: string): string | undefined {
  if (!parsed || !parsed.fieldErrors) return undefined;
  const match = parsed.fieldErrors[field];
  return match && match.length > 0 ? match[0] : undefined;
}

/**
 * Sanitizes and logs developer debugging information securely without leaking
 * authentication tokens, passwords, or patient medical secrets.
 */
export function logError(context: string, error: unknown): void {
  const parsed = parseApiError(error);
  // Log structured diagnostic data without exposing auth tokens
  console.error(`[AURA HMS Error] [${context}]`, {
    message: parsed.message,
    code: parsed.code,
    status: parsed.status,
    fieldErrors: parsed.fieldErrors,
    timestamp: new Date().toISOString(),
  });
}
