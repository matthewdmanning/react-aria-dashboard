/**
 * Carries the service's own name for a failure, so a caller — the offline queue
 * especially — can tell a denial from a transport problem without reading the
 * message.
 */
export class RequestFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RequestFailure";
  }
}

export async function failureFrom(
  response: Response,
  fallback = `Request failed with ${response.status}`,
): Promise<RequestFailure> {
  const body: unknown = await response.json().catch(() => undefined);
  const { code, message } =
    typeof body === "object" && body !== null
      ? (body as { code?: string; message?: string })
      : {};
  return new RequestFailure(code ?? "invalid-request", message ?? fallback);
}
