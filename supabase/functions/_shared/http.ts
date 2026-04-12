import { jsonResponse } from "./cors.ts";

export class HttpError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(status: number, message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        message: error.message,
        ...error.payload,
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return jsonResponse(
    {
      message,
      error: "internal_error",
    },
    { status: 500 },
  );
}
