# Protected evidence uploads

Staff with compliance responsibility can upload/read documents; distribution responsibility controls photographs. GM can manage both. Company/unit checks run on the server. The upload UI appears in readiness and the Management Centre. Uploaded files do not verify a permit, approve a photograph's usage rights or publish an OTA listing.

## Processing and storage

- Maximum 2 MB input. PDFs need a PDF header/end marker; photos must decode as a single JPEG/PNG with at most 16 megapixels. SVG, videos and arbitrary files are excluded.
- Sharp decodes, applies orientation and re-encodes photos to JPEG, omitting EXIF/location metadata. Stored dimensions/size/MIME describe the processed bytes. Names are labels, not object paths.
- One upload/scan runs per server process; upload requests are limited to six per minute per company account. These controls complement the global request/body limits.
- Records start quarantined. Both original and stored bytes require a successful ClamAV scan. Infected files are rejected and removed where storage is available. Scanner/storage failures stay unavailable; there is no “assume clean” fallback.
- GM can scan an unexpired quarantined file again after the scanner is restored. Downloads require current membership/capability, clean/unexpired status, object checksum and a final availability check. Responses force attachment download and no-store/nosniff; storage keys and bucket URLs are not returned.
- Production uses `PRIVATE_UPLOAD_BUCKET` through the runtime service identity. The bucket must enforce public-access prevention and uniform bucket-level access; the adapter checks both. No public ACL or signed public download URL is created.
- Development may use an absolute `PRIVATE_UPLOAD_DIR` outside the app/public/dist directories. Files are written with restrictive filesystem modes. This filesystem backend is rejected in production.

The application image does **not** install ClamAV or update signatures. An approved scanner executable and current signature database must be provided by the hosting environment; `CLAMSCAN_PATH` defaults to `clamscan`. Until that exists, uploads stay quarantined. Portable/API tests use an explicitly simulated scanner; they do not establish real antivirus operation. Production image/scanner validation is a staging gate.

## Linking uploaded evidence

Copy a clean file's `/api/files/<id>/download` reference into the relevant document/photo evidence field. External HTTPS references remain supported. For photos use the inspected dimensions, byte count and MIME shown in the file list. Server saving rejects private references from another company/apartment/category, unscanned/expired/deleted files, or mismatched photo metadata. A user cannot satisfy an apartment's evidence check with another apartment's upload.

Current readiness reads and newly generated readiness reports recheck private file availability. Unavailable document evidence becomes effectively unverified; unavailable media becomes effectively unapproved. This can suspend effective rentability. The original immutable history/report snapshots are retained. Files are downloaded through authenticated app controls; pasting an API reference into an unauthenticated browser tab will not bypass login.

## Retention and deletion

Initial app retention is 365 days from upload. Expired files stop downloading. GM can delete files or run **Purge expired private files**, which marks expired files unavailable and retries deletion of previously marked objects. A deletion/scan race cannot make a deleted record clean again. There is no scheduled purge worker installed; schedule an approved maintenance process before operating at scale. No legal-hold workflow or legally approved retention schedule is asserted. Align the fixed app limit and bucket lifecycle/backup policies with the company's approved requirements before using real documents.

PDF checks plus antivirus are not a full PDF sanitizer or guarantee that every PDF feature is harmless. Additional document sanitization, actual scanner/signature health, object-store backup/restore, deployed IAM, retention and recovery require acceptance. Treat the local synthetic demo as disconnected; it never uploads files.
