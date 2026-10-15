import React, { useState, useEffect } from "react";
type Api = (path: string, body?: unknown) => Promise<any>;
export function ProtectedUploads({
  api,
  unitId,
  gm = false,
}: {
  api?: Api;
  unitId: string;
  gm?: boolean;
}) {
  const [files, setFiles] = useState<any[]>([]),
    [category, setCategory] = useState("document"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    if (api) setFiles((await api("/files")).files);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [api]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
      <h3>Private evidence files</h3>
      <p>
        PDF documents or JPEG/PNG photographs, up to 2 MB. Photographs are
        decoded and stripped of hidden metadata. Files remain unavailable until
        the configured virus scanner succeeds. Uploading does not approve
        evidence or prove permission to use a photograph.
      </p>
      {!api ? (
        <p>
          Synthetic demonstration: file storage and virus scanning are
          disconnected. No files leave this browser.
        </p>
      ) : (
        <>
          <label>
            File category
            <select
              aria-label="File category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-950 p-2"
            >
              <option value="document">Document (PDF)</option>
              <option value="photo">Photograph</option>
            </select>
          </label>
          <input
            aria-label="Upload private evidence"
            type="file"
            disabled={busy || !unitId}
            accept={
              category === "document"
                ? "application/pdf"
                : "image/jpeg,image/png"
            }
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              run(async () => {
                if (file.size > 2 * 1024 * 1024)
                  throw Error("Choose a file up to 2 MB.");
                const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () =>
                    resolve(String(reader.result).split(",")[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                });
                const result = await api("/files", {
                  unitId,
                  category,
                  name: file.name,
                  base64,
                });
                await refresh();
                if (result.status !== "clean") setError(result.message);
              });
            }}
          />
          <button disabled={busy} onClick={() => run(refresh)}>
            Refresh file status
          </button>
          {gm && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("/files/retention/purge", {});
                  await refresh();
                })
              }
            >
              Purge expired private files
            </button>
          )}
          {files
            .filter((f) => f.unit_id === unitId)
            .map((f) => (
              <article className="border border-slate-700 p-3" key={f.id}>
                <p>
                  {f.name} · {f.category} · {f.status} · {f.byte_count} bytes{" "}
                  {f.width ? ` · ${f.width} × ${f.height}` : ""}
                </p>
                {f.status === "clean" && (
                  <>
                    <label>
                      Private evidence reference
                      <input
                        aria-label={`Evidence reference for ${f.name}`}
                        readOnly
                        className="w-full bg-slate-950 p-2"
                        value={`/api/files/${f.id}/download`}
                      />
                    </label>
                    <p>
                      Use this reference in the corresponding evidence record.
                      For photographs, use the inspected dimensions, MIME type{" "}
                      {f.mime} and byte count above.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const result = await api(`/files/${f.id}/download`);
                          const url = URL.createObjectURL(result.blob),
                            a = document.createElement("a");
                          a.href = url;
                          a.download =
                            f.category === "photo"
                              ? f.name.replace(/\.[^.]*$/, "") + ".jpg"
                              : f.name;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        })
                      }
                    >
                      Download {f.name}
                    </button>
                  </>
                )}
                {gm && f.status === "quarantined" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api(`/files/${f.id}/rescan`, {});
                        await refresh();
                      })
                    }
                  >
                    Scan {f.name} again
                  </button>
                )}
                {gm && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api(`/files/${f.id}/delete`, {});
                        await refresh();
                      })
                    }
                  >
                    Delete {f.name}
                  </button>
                )}
              </article>
            ))}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
