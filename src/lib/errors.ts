export type AppErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'rate-limit'
  | 'network'
  | 'unknown';

export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TypeError) {
    return new AppError(
      'network',
      'Could not reach GitHub',
      'Check your internet connection and try again.',
    );
  }
  return new AppError(
    'unknown',
    error instanceof Error ? error.message : 'Something went wrong',
  );
}
