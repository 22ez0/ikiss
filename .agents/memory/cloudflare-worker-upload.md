---
name: Cloudflare Workers module upload via REST API
description: Correct multipart form shape for PUT /workers/scripts/{name} with ES module workers
---

To upload an ES-module format Worker (`export default { fetch, scheduled }`) via `PUT /accounts/{acc}/workers/scripts/{name}`, the multipart form field name for the script part must differ from the `main_module` value in the metadata JSON part, with the actual filename set via `filename=` on that field — e.g. `-F 'metadata={"main_module":"worker.js",...};type=application/json' -F "file=@worker.js;filename=worker.js;type=application/javascript+module"`.

**Why:** Using the same string for both the form field name and `main_module` (e.g. field named `worker.js` with `main_module: "worker.js"`) makes Cloudflare unable to resolve the module and it fails with "No such module" or "Could not read content for part" errors.

**How to apply:** Whenever redeploying a Cloudflare Worker from the CLI/API (not the dashboard), use a generic field name like `file` and rely on the `filename=` parameter to supply the module name referenced by `main_module`.
