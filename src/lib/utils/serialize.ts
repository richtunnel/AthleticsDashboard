/**
 * Recursively converts BigInt values to strings in an object or array
 * to make it JSON-serializable
 */
export function serializeBigInt<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "bigint") {
    return String(data) as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => serializeBigInt(item)) as T;
  }

  if (typeof data === "object") {
    const serialized: any = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized as T;
  }

  return data;
}
