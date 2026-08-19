import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Severity = "P0" | "P1" | "P2";

type AuditIssue = {
  id: string;
  severity: Severity;
  category: string;
  table: string;
  record: string;
  detail: string;
};

type TableResult = {
  rows: Row[];
  error: string | null;
};

const PAGE_SIZE = 1_000;
const MONEY_TOLERANCE = 1;
const QUANTITY_TOLERANCE = 1;

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Audit impossible : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function cents(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function mills(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 1_000) : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isArchived(row: Row) {
  return Boolean(row.archived_at);
}

function opaqueRecord(table: string, id: unknown) {
  return createHash("sha256")
    .update(`${table}:${String(id ?? "unknown")}`)
    .digest("hex")
    .slice(0, 12);
}

function argumentValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const index = process.argv.indexOf(`--${name}`);
  const separate = index >= 0 ? process.argv[index + 1] : null;
  return separate && !separate.startsWith("--") ? separate.trim() || null : null;
}

async function resolveOrganizationScope() {
  const organizationId = argumentValue("organization-id");
  if (organizationId) return organizationId;

  const organizationSlug = argumentValue("organization-slug");
  if (!organizationSlug) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", organizationSlug)
    .limit(2);
  if (error) throw new Error(`Organisation de démonstration introuvable : ${error.message}`);
  if (data.length !== 1) {
    throw new Error(
      `Le filtre d'organisation doit correspondre à une seule organisation (résultats : ${data.length}).`,
    );
  }
  return String(data[0].id);
}

async function fetchAll(
  table: string,
  columns: string,
  organizationId: string | null,
): Promise<TableResult> {
  const rows: Row[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns);
    if (organizationId) {
      query = query.eq(table === "organizations" ? "id" : "organization_id", organizationId);
    }
    if (columns.split(",").includes("id")) {
      query = query.order("id", { ascending: true });
    } else {
      query = query
        .order("organization_id", { ascending: true })
        .order("product_id", { ascending: true })
        .order("warehouse_id", { ascending: true });
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) return { rows: [], error: error.message };
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return { rows, error: null };
}

const tableQueries: Record<string, string> = {
  organizations: "id",
  customer_invoices:
    "id,organization_id,invoice_number,subtotal_ht,discount_total,tax_total,total_ttc,paid_amount,remaining_amount,credit_amount,payment_status,status,archived_at",
  customer_invoice_lines:
    "id,organization_id,invoice_id,quantity,subtotal_ht,discount_amount,tax_amount,total_ttc",
  customer_payments:
    "id,organization_id,customer_id,third_party_id,payment_number,payment_date,amount,allocated_amount,available_amount,status,payment_type,reference,archived_at",
  customer_payment_allocations:
    "id,organization_id,payment_id,invoice_id,amount,cancelled_at",
  supplier_invoices:
    "id,organization_id,invoice_number,supplier_id,source_receipt_id,subtotal_ht,discount_total,tax_total,total_ttc,paid_amount,remaining_amount,payment_status,status,archived_at",
  supplier_invoice_lines:
    "id,organization_id,invoice_id,product_id,source_document_id,source_line_id,quantity,subtotal_ht,discount_amount,tax_amount,total_ttc",
  supplier_payments:
    "id,organization_id,supplier_id,payment_number,payment_date,amount,allocated_amount,available_amount,status,payment_type,reference,archived_at",
  supplier_payment_allocations:
    "id,organization_id,payment_id,invoice_id,amount,cancelled_at",
  accounting_entries:
    "id,organization_id,entry_number,status,total_debit,total_credit,source_document_type,source_document_id",
  accounting_entry_lines:
    "id,organization_id,entry_id,debit,credit",
  products:
    "id,organization_id,sku,track_stock,current_stock,status,archived_at",
  stock_moves:
    "id,organization_id,warehouse_id,product_id,move_type,direction,quantity,source_document_id,source_line_id",
  stock_levels:
    "organization_id,warehouse_id,product_id,quantity",
  treasury_accounts:
    "id,organization_id,opening_balance,current_balance,currency,status,archived_at",
  treasury_transactions:
    "id,organization_id,treasury_account_id,transaction_type,direction,amount,currency,reference,customer_payment_id,supplier_payment_id,archived_at",
  sales_documents:
    "id,organization_id,document_type,document_number,status,subtotal_ht,tax_total,total_ttc,archived_at",
  sales_document_lines:
    "id,organization_id,document_id,product_id,source_line_id,quantity,subtotal_ht,tax_amount,total_ttc",
  purchase_documents:
    "id,organization_id,document_type,document_number,supplier_id,source_document_id,related_order_id,status,stock_updated_at,subtotal_ht,discount_total,tax_total,total_ttc,archived_at",
  purchase_document_lines:
    "id,organization_id,document_id,product_id,source_line_id,quantity,ordered_quantity,received_quantity,remaining_quantity,subtotal_ht,discount_amount,tax_amount,total_ttc",
};

async function main() {
const organizationId = await resolveOrganizationScope();
const tableEntries = await Promise.all(
  Object.entries(tableQueries).map(async ([table, columns]) => [
    table,
    await fetchAll(table, columns, organizationId),
  ] as const),
);
const tables = Object.fromEntries(tableEntries) as Record<string, TableResult>;

const issues: AuditIssue[] = [];
const issueCounters = new Map<string, number>();

function addIssue(
  severity: Severity,
  category: string,
  table: string,
  id: unknown,
  detail: string,
) {
  const next = (issueCounters.get(category) ?? 0) + 1;
  issueCounters.set(category, next);
  issues.push({
    id: `${category}-${String(next).padStart(4, "0")}`,
    severity,
    category,
    table,
    record: opaqueRecord(table, id),
    detail,
  });
}

function availableRows(table: string) {
  return tables[table]?.rows ?? [];
}

function groupBy(rows: Row[], key: string) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const value = text(row[key]);
    if (!value) continue;
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return grouped;
}

function allocationSums(
  allocations: Row[],
  paymentsById: Map<string, Row>,
  validPaymentStatuses: Set<string>,
) {
  const byPayment = new Map<string, number>();
  const byInvoice = new Map<string, number>();

  for (const allocation of allocations) {
    if (allocation.cancelled_at) continue;
    const paymentId = text(allocation.payment_id);
    const invoiceId = text(allocation.invoice_id);
    const payment = paymentsById.get(paymentId);
    if (!payment || isArchived(payment) || !validPaymentStatuses.has(text(payment.status))) {
      continue;
    }
    const amount = cents(allocation.amount);
    byPayment.set(paymentId, (byPayment.get(paymentId) ?? 0) + amount);
    byInvoice.set(invoiceId, (byInvoice.get(invoiceId) ?? 0) + amount);
  }

  return { byPayment, byInvoice };
}

function auditPaymentDomain(options: {
  domain: "customer" | "supplier";
  invoiceTable: string;
  paymentTable: string;
  allocationTable: string;
  partyKey: string;
  creditKey?: string;
}) {
  const invoices = availableRows(options.invoiceTable).filter((row) => !isArchived(row));
  const payments = availableRows(options.paymentTable).filter((row) => !isArchived(row));
  const allocations = availableRows(options.allocationTable);
  const invoicesById = new Map(invoices.map((row) => [text(row.id), row]));
  const paymentsById = new Map(payments.map((row) => [text(row.id), row]));
  const validStatuses = new Set(["confirmed", "partially_allocated", "allocated"]);
  const sums = allocationSums(allocations, paymentsById, validStatuses);

  for (const allocation of allocations) {
    if (allocation.cancelled_at) continue;
    const allocationId = allocation.id;
    const payment = paymentsById.get(text(allocation.payment_id));
    const invoice = invoicesById.get(text(allocation.invoice_id));
    if (!payment || !invoice) {
      addIssue(
        "P0",
        "ORPHAN_ALLOCATION",
        options.allocationTable,
        allocationId,
        `Allocation ${options.domain} sans paiement ou facture active correspondante.`,
      );
      continue;
    }
    if (
      text(payment.organization_id) !== text(allocation.organization_id) ||
      text(invoice.organization_id) !== text(allocation.organization_id)
    ) {
      addIssue(
        "P0",
        "CROSS_TENANT_RELATION",
        options.allocationTable,
        allocationId,
        `Allocation ${options.domain} reliant des organisations différentes.`,
      );
    }
  }

  for (const payment of payments) {
    if (!validStatuses.has(text(payment.status))) continue;
    const allocated = sums.byPayment.get(text(payment.id)) ?? 0;
    const amount = cents(payment.amount);
    const storedAllocated = cents(payment.allocated_amount);
    const storedAvailable = cents(payment.available_amount);
    if (allocated > amount + MONEY_TOLERANCE) {
      addIssue(
        "P0",
        "PAYMENT_OVERALLOCATED",
        options.paymentTable,
        payment.id,
        `Paiement ${options.domain} alloué au-delà de son montant de ${((allocated - amount) / 100).toFixed(2)} MAD.`,
      );
    }
    if (
      Math.abs(storedAllocated - allocated) > MONEY_TOLERANCE ||
      Math.abs(storedAvailable - Math.max(amount - allocated, 0)) > MONEY_TOLERANCE
    ) {
      addIssue(
        "P0",
        "PAYMENT_TOTAL_MISMATCH",
        options.paymentTable,
        payment.id,
        `Montants d'allocation stockés incohérents pour un paiement ${options.domain}.`,
      );
    }
    if (
      allocated === 0 &&
      text(payment.payment_type) === `${options.domain}_payment`
    ) {
      addIssue(
        "P1",
        "UNALLOCATED_PAYMENT",
        options.paymentTable,
        payment.id,
        `Paiement ${options.domain} confirmé sans affectation.`,
      );
    }
  }

  for (const invoice of invoices) {
    const total = cents(invoice.total_ttc);
    const allocated = sums.byInvoice.get(text(invoice.id)) ?? 0;
    const credits = options.creditKey ? cents(invoice[options.creditKey]) : 0;
    const expectedRemaining = Math.max(total - allocated - credits, 0);
    const storedPaid = cents(invoice.paid_amount);
    const storedRemaining = cents(invoice.remaining_amount);
    const expectedPaymentStatus =
      allocated + credits <= MONEY_TOLERANCE
        ? "unpaid"
        : expectedRemaining <= MONEY_TOLERANCE
          ? "paid"
          : "partial";

    if (
      Math.abs(storedPaid - allocated) > MONEY_TOLERANCE ||
      Math.abs(storedRemaining - expectedRemaining) > MONEY_TOLERANCE ||
      text(invoice.payment_status) !== expectedPaymentStatus
    ) {
      addIssue(
        "P0",
        "INVOICE_PAYMENT_MISMATCH",
        options.invoiceTable,
        invoice.id,
        `Facture ${options.domain} incohérente entre total, allocations, avoirs et reste à payer.`,
      );
    }

    if (expectedRemaining === 0 && !["paid", "cancelled"].includes(text(invoice.status))) {
      addIssue(
        "P0",
        "IMPOSSIBLE_INVOICE_STATUS",
        options.invoiceTable,
        invoice.id,
        `Facture ${options.domain} soldée avec un statut non soldé.`,
      );
    }
    if (expectedRemaining > MONEY_TOLERANCE && text(invoice.status) === "paid") {
      addIssue(
        "P0",
        "IMPOSSIBLE_INVOICE_STATUS",
        options.invoiceTable,
        invoice.id,
        `Facture ${options.domain} marquée payée avec un reste positif.`,
      );
    }
  }

  const potentialDuplicates = new Map<string, Row[]>();
  for (const payment of payments) {
    if (!validStatuses.has(text(payment.status))) continue;
    if (!text(payment.reference)) continue;
    const party = text(payment[options.partyKey] ?? payment.third_party_id);
    const key = [
      text(payment.organization_id),
      party,
      text(payment.payment_date),
      cents(payment.amount),
      text(payment.reference).toLocaleLowerCase("fr"),
    ].join("|");
    potentialDuplicates.set(key, [...(potentialDuplicates.get(key) ?? []), payment]);
  }
  for (const duplicateRows of potentialDuplicates.values()) {
    if (duplicateRows.length < 2) continue;
    for (const duplicate of duplicateRows) {
      addIssue(
        "P0",
        "POTENTIAL_DUPLICATE_PAYMENT",
        options.paymentTable,
        duplicate.id,
        `Paiement ${options.domain} potentiellement dupliqué le même jour pour le même tiers et le même montant.`,
      );
    }
  }
}

auditPaymentDomain({
  domain: "customer",
  invoiceTable: "customer_invoices",
  paymentTable: "customer_payments",
  allocationTable: "customer_payment_allocations",
  partyKey: "customer_id",
  creditKey: "credit_amount",
});
auditPaymentDomain({
  domain: "supplier",
  invoiceTable: "supplier_invoices",
  paymentTable: "supplier_payments",
  allocationTable: "supplier_payment_allocations",
  partyKey: "supplier_id",
});

function auditDocumentTotals(
  headerTable: string,
  lineTable: string,
  numberKey: string,
  parentKey: string,
) {
  const linesByParent = groupBy(availableRows(lineTable), parentKey);
  for (const header of availableRows(headerTable).filter((row) => !isArchived(row))) {
    const lines = linesByParent.get(text(header.id)) ?? [];
    if (lines.length === 0) {
      if (!new Set(["draft", "cancelled"]).has(text(header.status))) {
        addIssue(
          "P0",
          "DOCUMENT_WITHOUT_LINES",
          headerTable,
          header.id,
          `Document validé sans ligne (${numberKey}).`,
        );
      }
      continue;
    }

    const expected = lines.reduce<{
      subtotal: number;
      discount: number;
      tax: number;
      total: number;
    }>(
      (sum, line) => ({
        subtotal: sum.subtotal + cents(line.subtotal_ht),
        discount: sum.discount + cents(line.discount_amount),
        tax: sum.tax + cents(line.tax_amount),
        total: sum.total + cents(line.total_ttc),
      }),
      { subtotal: 0, discount: 0, tax: 0, total: 0 },
    );
    const monetaryDifferences = [
      ["subtotal_ht", cents(header.subtotal_ht), expected.subtotal],
      ["discount_total", cents(header.discount_total), expected.discount],
      ["tax_total", cents(header.tax_total), expected.tax],
      ["total_ttc", cents(header.total_ttc), expected.total],
    ].filter(([, stored, calculated]) =>
      Math.abs(Number(stored) - Number(calculated)) > MONEY_TOLERANCE,
    );
    if (monetaryDifferences.length > 0) {
      addIssue(
        "P0",
        "DOCUMENT_TOTAL_MISMATCH",
        headerTable,
        header.id,
        [
          `Statut ${text(header.status) || "inconnu"}`,
          text(header.document_type) ? `type ${text(header.document_type)}` : null,
          monetaryDifferences
            .map(
              ([field, stored, calculated]) =>
                `${String(field)} stocké ${(Number(stored) / 100).toFixed(2)} / calculé ${(Number(calculated) / 100).toFixed(2)} MAD`,
            )
            .join(", "),
        ]
          .filter(Boolean)
          .join(" — "),
      );
    }
  }
}

auditDocumentTotals(
  "customer_invoices",
  "customer_invoice_lines",
  "invoice_number",
  "invoice_id",
);
auditDocumentTotals(
  "supplier_invoices",
  "supplier_invoice_lines",
  "invoice_number",
  "invoice_id",
);
auditDocumentTotals(
  "sales_documents",
  "sales_document_lines",
  "document_number",
  "document_id",
);
auditDocumentTotals(
  "purchase_documents",
  "purchase_document_lines",
  "document_number",
  "document_id",
);

const accountingLinesByEntry = groupBy(
  availableRows("accounting_entry_lines"),
  "entry_id",
);
const accountingSources = new Map<string, Row>([
  ...availableRows("customer_invoices").map(
    (invoice) => [`customer_invoice:${text(invoice.id)}`, invoice] as const,
  ),
  ...availableRows("supplier_invoices").map(
    (invoice) => [`supplier_invoice:${text(invoice.id)}`, invoice] as const,
  ),
]);
for (const entry of availableRows("accounting_entries")) {
  const lines = accountingLinesByEntry.get(text(entry.id)) ?? [];
  const debit = lines.reduce((sum, line) => sum + cents(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + cents(line.credit), 0);
  if (text(entry.status) === "posted" && Math.abs(debit - credit) > MONEY_TOLERANCE) {
    addIssue(
      "P0",
      "UNBALANCED_ACCOUNTING_ENTRY",
      "accounting_entries",
      entry.id,
      `Écriture comptable déséquilibrée de ${(Math.abs(debit - credit) / 100).toFixed(2)} MAD.`,
    );
  }
  if (
    Math.abs(cents(entry.total_debit) - debit) > MONEY_TOLERANCE ||
    Math.abs(cents(entry.total_credit) - credit) > MONEY_TOLERANCE
  ) {
    addIssue(
      "P0",
      "ACCOUNTING_HEADER_MISMATCH",
      "accounting_entries",
      entry.id,
      "Totaux de l'écriture différents de la somme de ses lignes.",
    );
  }
  const source = accountingSources.get(
    `${text(entry.source_document_type)}:${text(entry.source_document_id)}`,
  );
  if (
    text(entry.status) === "posted" &&
    source &&
    Math.abs(debit - cents(source.total_ttc)) > MONEY_TOLERANCE
  ) {
    addIssue(
      "P0",
      "ACCOUNTING_SOURCE_TOTAL_MISMATCH",
      "accounting_entries",
      entry.id,
      `Écriture ${text(entry.source_document_type)} de ${(debit / 100).toFixed(2)} MAD différente du document source à ${(cents(source.total_ttc) / 100).toFixed(2)} MAD.`,
    );
  }
  for (const line of lines) {
    if (text(line.organization_id) !== text(entry.organization_id)) {
      addIssue(
        "P0",
        "CROSS_TENANT_RELATION",
        "accounting_entry_lines",
        line.id,
        "Ligne comptable rattachée à une écriture d'une autre organisation.",
      );
    }
  }
}

const movesByProduct = groupBy(availableRows("stock_moves"), "product_id");
const levelsByProduct = groupBy(availableRows("stock_levels"), "product_id");
for (const product of availableRows("products").filter(
  (row) => !isArchived(row) && row.track_stock === true,
)) {
  const moves = movesByProduct.get(text(product.id)) ?? [];
  const movementQuantity = moves.reduce(
    (sum, move) =>
      sum + (text(move.direction) === "out" ? -mills(move.quantity) : mills(move.quantity)),
    0,
  );
  const levelQuantity = (levelsByProduct.get(text(product.id)) ?? []).reduce(
    (sum, level) => sum + mills(level.quantity),
    0,
  );
  const currentStock = mills(product.current_stock);

  if (currentStock !== 0 && moves.length === 0) {
    addIssue(
      "P0",
      "STOCK_WITHOUT_MOVEMENT",
      "products",
      product.id,
      "Stock non nul sans aucun mouvement explicatif.",
    );
  }
  if (Math.abs(currentStock - movementQuantity) > QUANTITY_TOLERANCE) {
    addIssue(
      "P0",
      "STOCK_MOVEMENT_MISMATCH",
      "products",
      product.id,
      "Stock courant différent du cumul des mouvements.",
    );
  }
  if (Math.abs(currentStock - levelQuantity) > QUANTITY_TOLERANCE) {
    addIssue(
      "P0",
      "STOCK_LEVEL_MISMATCH",
      "products",
      product.id,
      "Stock courant différent du cumul des emplacements.",
    );
  }
}

const sourceRequiredMoveTypes = new Set([
  "delivery_out",
  "customer_return_in",
  "purchase_receipt_in",
]);
const purchaseDocumentsById = new Map(
  availableRows("purchase_documents").map((document) => [text(document.id), document]),
);
const purchaseLinesById = new Map(
  availableRows("purchase_document_lines").map((line) => [text(line.id), line]),
);
const salesDocumentsById = new Map(
  availableRows("sales_documents").map((document) => [text(document.id), document]),
);
const salesLinesById = new Map(
  availableRows("sales_document_lines").map((line) => [text(line.id), line]),
);
for (const move of availableRows("stock_moves")) {
  if (
    sourceRequiredMoveTypes.has(text(move.move_type)) &&
    (!text(move.source_document_id) || !text(move.source_line_id))
  ) {
    addIssue(
      "P0",
      "STOCK_MOVEMENT_WITHOUT_SOURCE",
      "stock_moves",
      move.id,
      "Mouvement métier sans document ou ligne source.",
    );
  }

  if (text(move.move_type) === "purchase_receipt_in") {
    const sourceDocument = purchaseDocumentsById.get(text(move.source_document_id));
    const sourceLine = purchaseLinesById.get(text(move.source_line_id));
    if (
      !sourceDocument ||
      text(sourceDocument.document_type) !== "supplier_receipt" ||
      text(sourceDocument.status) !== "validated" ||
      text(sourceDocument.organization_id) !== text(move.organization_id) ||
      !sourceLine ||
      text(sourceLine.document_id) !== text(sourceDocument.id) ||
      text(sourceLine.product_id) !== text(move.product_id)
    ) {
      addIssue(
        "P0",
        "INVALID_STOCK_SOURCE",
        "stock_moves",
        move.id,
        "Entrée de stock fournisseur sans réception validée et ligne source cohérentes.",
      );
    }
  }

  if (text(move.move_type) === "delivery_out") {
    const sourceDocument = salesDocumentsById.get(text(move.source_document_id));
    const sourceLine = salesLinesById.get(text(move.source_line_id));
    if (
      !sourceDocument ||
      text(sourceDocument.document_type) !== "delivery_note" ||
      text(sourceDocument.status) !== "validated" ||
      text(sourceDocument.organization_id) !== text(move.organization_id) ||
      !sourceLine ||
      text(sourceLine.document_id) !== text(sourceDocument.id) ||
      text(sourceLine.product_id) !== text(move.product_id)
    ) {
      addIssue(
        "P0",
        "INVALID_STOCK_SOURCE",
        "stock_moves",
        move.id,
        "Sortie de stock client sans bon de livraison source cohérent.",
      );
    }
  }

  if (text(move.move_type) === "customer_return_in") {
    const sourceDocument = salesDocumentsById.get(text(move.source_document_id));
    const sourceLine = salesLinesById.get(text(move.source_line_id));
    if (
      !sourceDocument ||
      text(sourceDocument.document_type) !== "return_note" ||
      text(sourceDocument.status) !== "validated" ||
      text(sourceDocument.organization_id) !== text(move.organization_id) ||
      !sourceLine ||
      text(sourceLine.document_id) !== text(sourceDocument.id) ||
      text(sourceLine.product_id) !== text(move.product_id)
    ) {
      addIssue(
        "P0",
        "INVALID_STOCK_SOURCE",
        "stock_moves",
        move.id,
        "Entree de stock client sans bon de retour valide et ligne source coherents.",
      );
    }
  }
}

for (const invoice of availableRows("supplier_invoices").filter((row) => !isArchived(row))) {
  const sourceReceiptId = text(invoice.source_receipt_id);
  if (!sourceReceiptId) continue;
  const receipt = purchaseDocumentsById.get(sourceReceiptId);
  if (
    !receipt ||
    text(receipt.document_type) !== "supplier_receipt" ||
    text(receipt.organization_id) !== text(invoice.organization_id) ||
    text(receipt.supplier_id) !== text(invoice.supplier_id)
  ) {
    addIssue(
      "P0",
      "INVALID_DOCUMENT_SOURCE",
      "supplier_invoices",
      invoice.id,
      "Facture fournisseur reliée à une réception absente, d'un autre tenant ou d'un autre fournisseur.",
    );
  } else if (text(receipt.status) !== "validated") {
    addIssue(
      "P1",
      "INVALID_DOCUMENT_STATE",
      "supplier_invoices",
      invoice.id,
      "Facture fournisseur issue d'une réception non validée.",
    );
  }
}

const transactionsByAccount = groupBy(
  availableRows("treasury_transactions").filter(
    (row) => !isArchived(row) && text(row.transaction_type) !== "opening_balance",
  ),
  "treasury_account_id",
);
for (const account of availableRows("treasury_accounts").filter(
  (row) => !isArchived(row),
)) {
  const transactions = transactionsByAccount.get(text(account.id)) ?? [];
  const expected = transactions.reduce(
    (sum, transaction) =>
      sum +
      (text(transaction.direction) === "out"
        ? -cents(transaction.amount)
        : cents(transaction.amount)),
    cents(account.opening_balance),
  );
  if (Math.abs(cents(account.current_balance) - expected) > MONEY_TOLERANCE) {
    addIssue(
      "P0",
      "TREASURY_BALANCE_MISMATCH",
      "treasury_accounts",
      account.id,
      "Solde du compte différent du solde initial augmenté des mouvements.",
    );
  }
}

const referenceTables = [
  ["customer_invoices", "invoice_number"],
  ["supplier_invoices", "invoice_number"],
  ["customer_payments", "payment_number"],
  ["supplier_payments", "payment_number"],
  ["sales_documents", "document_number"],
  ["purchase_documents", "document_number"],
  ["accounting_entries", "entry_number"],
] as const;

for (const [table, referenceKey] of referenceTables) {
  const grouped = new Map<string, Row[]>();
  for (const row of availableRows(table).filter((record) => !isArchived(record))) {
    const key = `${text(row.organization_id)}|${text(row[referenceKey]).toLocaleLowerCase("fr")}`;
    if (!text(row[referenceKey])) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  for (const duplicateRows of grouped.values()) {
    if (duplicateRows.length < 2) continue;
    for (const duplicate of duplicateRows) {
      addIssue(
        "P0",
        "DUPLICATE_REFERENCE",
        table,
        duplicate.id,
        `Référence dupliquée dans ${table}.`,
      );
    }
  }
}

for (const [table, result] of Object.entries(tables)) {
  if (table === "organizations" || result.error) continue;
  for (const row of result.rows) {
    if (!("organization_id" in row) || text(row.organization_id)) continue;
    addIssue(
      "P0",
      "MISSING_TENANT",
      table,
      row.id ?? `${table}-${issues.length}`,
      `Ligne métier sans organization_id dans ${table}.`,
    );
  }
}

const unavailableTables = Object.entries(tables)
  .filter(([, result]) => result.error)
  .map(([table, result]) => ({ table, error: result.error }));

const severityOrder: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };
issues.sort(
  (left, right) =>
    severityOrder[left.severity] - severityOrder[right.severity] ||
    left.category.localeCompare(right.category) ||
    left.record.localeCompare(right.record),
);

const report = {
  generatedAt: new Date().toISOString(),
  mode: "READ_ONLY" as const,
  scope: organizationId ? "SINGLE_ORGANIZATION" : "ALL_ORGANIZATIONS",
  tableCounts: Object.fromEntries(
    Object.entries(tables).map(([table, result]) => [table, result.rows.length]),
  ),
  unavailableTables,
  summary: {
    P0: issues.filter((issue) => issue.severity === "P0").length,
    P1: issues.filter((issue) => issue.severity === "P1").length,
    P2: issues.filter((issue) => issue.severity === "P2").length,
    total: issues.length,
  },
  summaryByCategory: Object.fromEntries(
    [...issueCounters.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  ),
  summaryByCategoryAndTable: Object.fromEntries(
    [...new Set(issues.map((issue) => `${issue.category}:${issue.table}`))]
      .sort()
      .map((key) => [
        key,
        issues.filter((issue) => `${issue.category}:${issue.table}` === key).length,
      ]),
  ),
  issues,
};

if (process.argv.includes("--summary-json")) {
  const sampleCategories = [...new Set(issues.map((issue) => issue.category))];
  console.log(
    JSON.stringify(
      {
        generatedAt: report.generatedAt,
        mode: report.mode,
        scope: report.scope,
        tableCounts: report.tableCounts,
        unavailableTables: report.unavailableTables,
        summary: report.summary,
        summaryByCategory: report.summaryByCategory,
        summaryByCategoryAndTable: report.summaryByCategoryAndTable,
        samples: Object.fromEntries(
          sampleCategories.map((category) => [
            category,
            issues.filter((issue) => issue.category === category).slice(0, 3),
          ]),
        ),
      },
      null,
      2,
    ),
  );
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("# Audit d'intégrité FelexiaERP");
  console.log("");
  console.log(`- Mode : ${report.mode}`);
  console.log(`- Généré le : ${report.generatedAt}`);
  console.log(`- P0 : ${report.summary.P0}`);
  console.log(`- P1 : ${report.summary.P1}`);
  console.log(`- Tables indisponibles : ${report.unavailableTables.length}`);
  console.log("");
  for (const issue of report.issues) {
    console.log(
      `- [${issue.severity}] ${issue.id} (${issue.record}) — ${issue.detail}`,
    );
  }
  for (const unavailable of report.unavailableTables) {
    console.log(`- [BLOCKED] ${unavailable.table} — ${unavailable.error}`);
  }
}

if (report.unavailableTables.length > 0) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(
    "Audit d'intégrité interrompu :",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
