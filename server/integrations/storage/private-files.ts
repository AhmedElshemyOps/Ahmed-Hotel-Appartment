import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { getStorage } from "firebase-admin/storage";
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export type CheckedFile = {
  bytes: Buffer;
  mime: string;
  width?: number;
  height?: number;
};
export async function inspectFile(
  bytes: Buffer,
  category: "document" | "photo",
): Promise<CheckedFile> {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES)
    throw Error("Choose a file up to 2 MB.");
  if (category === "document") {
    if (
      !bytes.subarray(0, 8).toString("ascii").startsWith("%PDF-") ||
      !bytes.subarray(-1024).toString("ascii").includes("%%EOF")
    )
      throw Error("Document must have a valid PDF header and end marker.");
    return { bytes, mime: "application/pdf" };
  }
  const metadata = await sharp(bytes, {
    limitInputPixels: 16000000,
    failOn: "warning",
  }).metadata();
  if (
    !["jpeg", "png"].includes(metadata.format || "") ||
    (metadata.pages && metadata.pages > 1)
  )
    throw Error("Choose one JPEG or PNG photograph, up to 16 megapixels.");
  // Decode and re-encode to inspect image bytes and omit EXIF/location metadata.
  const clean = await sharp(bytes, {
    limitInputPixels: 16000000,
    failOn: "warning",
  })
    .rotate()
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  if (clean.data.length > MAX_UPLOAD_BYTES)
    throw Error("Processed photograph exceeds 2 MB.");
  return {
    bytes: clean.data,
    mime: "image/jpeg",
    width: clean.info.width,
    height: clean.info.height,
  };
}
export type FileStore = {
  put: (key: string, bytes: Buffer) => Promise<void>;
  get: (key: string) => Promise<Buffer>;
  remove: (key: string) => Promise<void>;
};
export type Scanner = (bytes: Buffer) => Promise<"clean" | "infected">;
export const scanFile: Scanner = async (bytes) => {
  const dir = await mkdtemp(path.join(tmpdir(), "ahq-quarantine-"));
  try {
    const file = path.join(dir, "payload");
    await writeFile(file, bytes, { mode: 0o600 });
    try {
      await promisify(execFile)(
        process.env.CLAMSCAN_PATH || "clamscan",
        ["--no-summary", file],
        { timeout: 30000, maxBuffer: 4096 },
      );
      return "clean";
    } catch (e: any) {
      if (e.code === 1) return "infected";
      throw Error("File scanner unavailable. File remains quarantined.");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
export function privateStore(): FileStore {
  if (process.env.PRIVATE_UPLOAD_BUCKET) {
    const bucket = getStorage().bucket(process.env.PRIVATE_UPLOAD_BUCKET);
    const enforcePrivate = async () => {
      const [metadata] = await bucket.getMetadata();
      if (
        metadata.iamConfiguration?.publicAccessPrevention !== "enforced" ||
        !metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled
      )
        throw Error(
          "Bucket must enforce public-access prevention and uniform bucket-level access.",
        );
    };
    return {
      put: async (key, bytes) => {
        await enforcePrivate();
        await bucket
          .file(key)
          .save(bytes, {
            resumable: false,
            metadata: {
              contentType: "application/octet-stream",
              cacheControl: "private,no-store",
            },
          });
      },
      get: async (key) => {
        await enforcePrivate();
        return (await bucket.file(key).download())[0];
      },
      remove: async (key) => {
        await bucket.file(key).delete({ ignoreNotFound: true });
      },
    };
  }
  if (process.env.NODE_ENV === "production")
    throw Error("Private upload bucket must be configured.");
  const dir = process.env.PRIVATE_UPLOAD_DIR;
  if (!dir || !path.isAbsolute(dir))
    throw Error(
      "Configure an absolute private upload directory outside public and dist.",
    );
  const base = path.resolve(dir);
  if (
    [
      process.cwd(),
      path.join(process.cwd(), "public"),
      path.join(process.cwd(), "dist"),
    ].some((p) => base === p || base.startsWith(p + path.sep))
  )
    throw Error("Private storage must be outside the application directory.");
  const resolve = (key: string) => {
    if (!/^[a-f0-9]{64}\/[-a-f0-9]{36}$/.test(key))
      throw Error("Invalid object key");
    return path.join(base, key);
  };
  return {
    put: async (key, bytes) => {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file, bytes, { mode: 0o600, flag: "wx" });
    },
    get: async (key) => readFile(resolve(key)),
    remove: async (key) => {
      await rm(resolve(key), { force: true });
    },
  };
}
export const objectKey = (org: string, id = randomUUID()) =>
  createHash("sha256").update(org).digest("hex") + "/" + id;
