import { headers as nextHeaders } from "next/headers";

export type RequestMetadata = {
  ip: string | null;
  userAgent: string | null;
};

type HeaderLike =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined
  | null;

export function extractRequestMetadataFromHeaders(headerSource: HeaderLike): RequestMetadata {
  const userAgent = getHeaderValue(headerSource, "user-agent");
  const ip =
    firstHeaderValue(headerSource, "x-forwarded-for") ||
    getHeaderValue(headerSource, "cf-connecting-ip") ||
    getHeaderValue(headerSource, "x-real-ip") ||
    getHeaderValue(headerSource, "remote-addr") ||
    getHeaderValue(headerSource, "client-ip");

  return {
    ip: ip ?? null,
    userAgent: userAgent ?? null,
  };
}

export async function getRequestMetadataFromContext(): Promise<RequestMetadata> {
  try {
    const headerStore = await nextHeaders();
    return extractRequestMetadataFromHeaders(headerStore);
  } catch (_) {
    return { ip: null, userAgent: null };
  }
}

function getHeaderValue(source: HeaderLike, key: string): string | null {
  if (!source) {
    return null;
  }

  if (source instanceof Headers) {
    return source.get(key) ?? null;
  }

  const value = source[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function firstHeaderValue(source: HeaderLike, key: string): string | null {
  const raw = getHeaderValue(source, key);
  if (!raw) {
    return null;
  }

  return raw.split(",").map((value) => value.trim()).find(Boolean) ?? null;
}
