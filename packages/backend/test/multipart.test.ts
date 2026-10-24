import { describe, expect, it } from "vitest";
import { buildMultipartBody } from "../convex/lib/multipart";

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("buildMultipartBody", () => {
  it("encodes fields and the file with the given boundary", () => {
    const { body, contentType } = buildMultipartBody(
      { model: "ink-whisper", language: "en" },
      { field: "file", filename: "recording.webm", contentType: "audio/webm", data: new Uint8Array([1, 2, 3]) },
      "XBOUNDARY",
    );
    expect(contentType).toBe("multipart/form-data; boundary=XBOUNDARY");

    const text = decode(body);
    expect(text).toContain('--XBOUNDARY\r\nContent-Disposition: form-data; name="model"\r\n\r\nink-whisper\r\n');
    expect(text).toContain('name="language"\r\n\r\nen\r\n');
    expect(text).toContain('name="file"; filename="recording.webm"\r\nContent-Type: audio/webm\r\n\r\n');
    expect(text.endsWith("\r\n--XBOUNDARY--\r\n")).toBe(true);
  });

  it("keeps the file bytes intact, including non-text bytes", () => {
    const data = new Uint8Array([0, 255, 128, 10, 13, 45, 45]);
    const { body } = buildMultipartBody(
      {},
      { field: "file", filename: "a.wav", contentType: "audio/wav", data },
      "B",
    );
    const header = new TextEncoder().encode(
      '--B\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n',
    );
    expect(Array.from(body.slice(header.length, header.length + data.length))).toEqual(Array.from(data));
  });

  it("removes quotes and line breaks from header values", () => {
    const { body } = buildMultipartBody(
      {},
      { field: "file", filename: 'evil"\r\nname.webm', contentType: "audio/webm", data: new Uint8Array([1]) },
      "B",
    );
    const text = decode(body);
    expect(text).toContain('filename="evil___name.webm"');
  });

  it("generates a unique boundary by default", () => {
    const file = { field: "file", filename: "a.webm", contentType: "audio/webm", data: new Uint8Array([1]) };
    const a = buildMultipartBody({}, file).contentType;
    const b = buildMultipartBody({}, file).contentType;
    expect(a).not.toBe(b);
  });
});
