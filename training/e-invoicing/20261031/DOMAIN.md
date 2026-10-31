# Electronic invoicing domain — preparatory generic UBL

The domain emits **outbound customer invoices and customer credit notes**. It does not reissue supplier documents. Source invoices, payment allocations, accounting and numbering remain owned by the existing financial services.

## Contracts

`src/lib/e-invoicing/types.ts` defines the adapter boundary. All decimal inputs and results are strings. `validateEInvoiceSnapshot(input, options)` returns a normalized snapshot only when all blocking diagnostics pass. `prepareEInvoice` returns that same snapshot for PDF rendering, XML, canonical XML, three separate SHA-256 hashes, warnings and real XSD results. Preparation errors carry `issues` or `validation`, without logging an invoice payload.

The adapter must supply exact source values (prefer PostgreSQL `numeric::text`). Customer HT is already net of line discounts. Fiscal `payableAmount` equals source TTC, `prepaidAmount` is zero and document `allowanceTotalAmount` is zero. These values do not follow later payments/credit allocations. The discount is represented at line level, never subtracted twice. Inbound supplier HT conventions require a future separate adapter.

Policy `felexia-postgres-v1`: quantity rounded to three decimals, price/discount-rate/tax-rate to two; round gross, round discount, subtract discount, round line VAT, then sum line values. Arithmetic uses scaled BigInt, PostgreSQL tie-away-from-zero rounding and no binary floating-point money calculations. A source line or header discrepancy blocks preparation; historical facts are not changed.

Seller name/address/ICE/IF are required by this preparatory profile; RC is required only when configured. Buyer type is explicit (business/consumer/export); domestic business buyers require ICE. Zero VAT requires an explicit S/Z/E/O category and reason where applicable. These policy checks do not prove identity, a fiscal exemption or DGI approval. Missing unit metadata uses C62 with a visible warning. Currency/country/unit formatting checks are technical and are not comprehensive regulatory code-list certification.

## XML runtime

Official OASIS UBL 2.1 Standard, 4 November 2013:

- https://docs.oasis-open.org/ubl/os-UBL-2.1/UBL-2.1.html
- https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-Invoice-2.1.xsd
- https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-CreditNote-2.1.xsd
- https://www.w3.org/TR/xml-c14n11/

The local bundle contains all fifteen transitive XSD files (2,899,446 original bytes), pinned in `schemas/ubl-2.1/manifest.json`; nested Git attributes preserve their bytes. Original notices remain. The official XMLDSig schema contains an internal DTD; it is trusted only through the manifest. Untrusted invoice XML always rejects DTD/entity declarations and invalid XML characters. Parsing uses NO_XXE/NONET/NO_SYS_CATALOG, no XInclude processing and the default libxml2 depth/entity limits, plus an application limit of 2MB and 50,000 markup openings. Its resolver accepts only the fifteen in-memory pinned resources and never invokes HTTP or arbitrary filesystem resolution.

`libxml2-wasm@0.7.2` performs actual schema validation and C14N1.1 without comments. XML schema validity is distinct from code-list, arithmetic, source-integrity and jurisdictional validation. `schema_sha256` is the SHA-256 of the exact schema-bundle manifest bytes. XML-file hash, canonical XML hash and canonical snapshot JSON hash are distinct; none is a qualified electronic signature or the PostgreSQL source-fingerprint hash.

The compiled schema validators and trusted buffers are cached once per server process; every document is disposed after processing. Deployment tracing must include the WASM package and `src/lib/e-invoicing/schemas/ubl-2.1/**`. Missing files or a failed checksum cause closed validation, never a successful fallback.

## Connector and signature

`createEInvoiceConnector(mode)` exposes validate/prepare/sign/submit/getStatus/getAcknowledgement/reconcile. Local validation/preparation remain available in disabled mode. Transmission requires explicit simulation. Official mode and signing throw hard errors; no credentials, endpoint URL or private key can enable them. A future signature provider interface accepts certificate/provider references and asserts no qualification.

Simulation receipts always carry `simulation:true`, authority `FELEXIA_INTERNAL_SIMULATION`, reference prefix `SIMULATED-` and an acknowledgement explicitly denying DGI transmission. Accepted/rejected/pending/unknown are internal outcomes. Deterministic references bind company and idempotency key; reusing a key for another hash fails. Transient failure/timeout can be retried; persisted simulated receipts can be reconciled after restart. This in-process domain is not a durable queue: database leases, tenant permissions, retry storage and uniqueness are enforced by the separate database/service layer.

## Verification

```powershell
npx --no-install tsx training/e-invoicing/20261031/verify-domain.ts
npx --no-install tsx training/e-invoicing/20261031/verify-decimal-parity.ts --pglite-root=<isolated-pglite-package-directory>
```

The first suite disables `fetch` during real XML/runtime/connector processing; real Invoice and CreditNote schemas, discounts, exemptions, multiple rates, Arabic/French text, malicious XML, resource bounds, hashes and simulated failures are exercised. The second compares 405 cases/3,645 fields against real PostgreSQL numeric in an isolated disposable database. No project credentials, database, email, DGI endpoint or production operation is used. JSON reports in this directory record the actual latest results.
