// Define SnackbarOptions interface locally to avoid circular imports
export interface SnackbarOptions {
  message: string;
  severity?: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

// Error types for categorization
export enum ErrorType {
  NETWORK = 'network',
  API = 'api',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  UNKNOWN = 'unknown'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Enhanced error interface
export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

// Error logging service
class ErrorService {
  private isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Log error to console and external services
  logError(error: AppError): void {
    // Always log to console in development
    if (this.isDevelopment) {
      console.group(`🚨 Error [${error.type}] - ${error.severity.toUpperCase()}`);
      console.error('Message:', error.message);
      console.error('Original Error:', error.originalError);
      console.error('Context:', error.context);
      console.error('Timestamp:', error.timestamp.toISOString());
      console.groupEnd();
    }

    // In production, you would send to external logging service
    // Example integrations:
    // - Sentry: Sentry.captureException(error.originalError, { extra: error.context });
    // - LogRocket: LogRocket.captureException(error.originalError);
    // - Custom API: this.sendToLoggingAPI(error);

    // For now, we'll simulate external logging
    this.simulateExternalLogging(error);
  }

  private simulateExternalLogging(error: AppError): void {
    // Simulate sending to external service
    if (!this.isDevelopment) {
      // In production, this would be actual API calls to logging services
      console.log('📡 Sending error to external logging service:', {
        type: error.type,
        severity: error.severity,
        message: error.message,
        sessionId: this.sessionId,
        timestamp: error.timestamp.toISOString()
      });
    }
  }

  // Create standardized error objects
  createError(
    type: ErrorType,
    severity: ErrorSeverity,
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ): AppError {
    return {
      type,
      severity,
      message,
      originalError,
      context,
      timestamp: new Date(),
      sessionId: this.sessionId
    };
  }

  // Helper methods for common error scenarios
  createNetworkError(message: string, originalError?: Error, context?: Record<string, any>): AppError {
    return this.createError(ErrorType.NETWORK, ErrorSeverity.MEDIUM, message, originalError, context);
  }

  createAPIError(message: string, originalError?: Error, context?: Record<string, any>): AppError {
    return this.createError(ErrorType.API, ErrorSeverity.MEDIUM, message, originalError, context);
  }

  createValidationError(message: string, originalError?: Error, context?: Record<string, any>): AppError {
    return this.createError(ErrorType.VALIDATION, ErrorSeverity.LOW, message, originalError, context);
  }

  // Convert error to user-friendly message
  getUserFriendlyMessage(error: AppError): string {
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again.';
      case ErrorType.API:
        return error.message.includes('timeout') 
          ? 'The request is taking longer than expected. Please try again.'
          : `Service temporarily unavailable: ${error.message}`;
      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please log in again.';
      case ErrorType.VALIDATION:
        return error.message;
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  // Convert error to snackbar options
  toSnackbarOptions(error: AppError): SnackbarOptions {
    const severityMap = {
      [ErrorSeverity.LOW]: 'info' as const,
      [ErrorSeverity.MEDIUM]: 'warning' as const,
      [ErrorSeverity.HIGH]: 'error' as const,
      [ErrorSeverity.CRITICAL]: 'error' as const
    };

    return {
      message: this.getUserFriendlyMessage(error),
      severity: severityMap[error.severity],
      duration: error.severity === ErrorSeverity.CRITICAL ? 10000 : 6000
    };
  }

  // Retry logic helper
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        const appError = this.createNetworkError(
          `Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
          lastError,
          { ...context, attempt, maxRetries }
        );
        
        this.logError(appError);

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

// Export singleton instance
export const errorService = new ErrorService();
