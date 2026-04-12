type ApiErrorPayload = {
  error?: string;
};

export type JsonRequestOptions = RequestInit & {
  skipJsonContentType?: boolean;
};

export const getApiErrorMessage = async (
  response: Response,
  fallback: string
): Promise<string> => {
  const data = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  return data?.error || fallback;
};

export const requestJson = async <T>(
  input: string,
  init?: JsonRequestOptions
): Promise<T> => {
  const { skipJsonContentType, ...requestInit } = init ?? {};

  const response = await fetch(input, {
    ...requestInit,
    headers: {
      ...(skipJsonContentType ? {} : { 'Content-Type': 'application/json' }),
      ...(requestInit.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload;
};