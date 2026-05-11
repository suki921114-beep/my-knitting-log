export type ErrorLogEntry = {
  id: string;
  createdAt: string;
  message: string;
  stack?: string;
  context?: string;
  url: string;
  userAgent: string;
};

const ERROR_LOG_KEY = "knitting_error_logs";
const MAX_LOGS = 50;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getErrorLogs(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ErrorLogEntry[];
  } catch {
    return [];
  }
}

export function clearErrorLogs() {
  localStorage.removeItem(ERROR_LOG_KEY);
}

export function captureError(error: unknown, context?: string) {
  const entry: ErrorLogEntry = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    message:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
    context,
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  const logs = getErrorLogs();
  const nextLogs = [entry, ...logs].slice(0, MAX_LOGS);

  localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(nextLogs));
}

export function setupGlobalErrorLogging() {
  window.addEventListener("error", (event) => {
    captureError(event.error ?? event.message, "window.error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    captureError(event.reason, "unhandledrejection");
  });
}