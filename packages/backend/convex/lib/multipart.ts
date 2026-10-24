/**
 * Minimal multipart/form-data encoder.
 * Built by hand so it does not depend on FormData/Blob support in the runtime, and is easy to unit test.
 */

export interface MultipartFile {
  /** Form field name, e.g. "file" */
  field: string;
  filename: string;
  contentType: string;
  data: Uint8Array;
}

export interface MultipartBody {
  body: Uint8Array;
  /** Value for the Content-Type header (includes the boundary) */
  contentType: string;
}

const encoder = new TextEncoder();

/** Removes characters that could break out of a quoted header value. */
function sanitize(value: string): string {
  return value.replace(/["\r\n\\]/g, "_");
}

export function buildMultipartBody(
  fields: Record<string, string>,
  file: MultipartFile,
  boundary: string = `----ss-${crypto.randomUUID()}`,
): MultipartBody {
  const parts: Uint8Array[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${sanitize(name)}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  parts.push(
    encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="${sanitize(file.field)}"; filename="${sanitize(file.filename)}"\r\nContent-Type: ${sanitize(file.contentType)}\r\n\r\n`,
    ),
  );
  parts.push(file.data);
  parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const body = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}
