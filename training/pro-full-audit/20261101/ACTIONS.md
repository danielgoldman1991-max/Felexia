# Inventaire des actions serveur

223 exports dans 41 fichiers « use server ». Inventaire source, pas une certification de succès ni une analyse complète des permissions. Les appels indirects ne sont pas développés.

| Fichier | Fonction | Tables directes | RPC directs | Gardes nommées directes |
|---|---|---|---|---|
| src/lib/accounting-actions.ts:62 | listAccountingJournals | accounting_journals |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:74 | listAccountingAccounts | accounting_accounts |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:95 | getAccountingAccount | accounting_accounts |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:109 | listAccountingAuxiliaries | accounting_auxiliaries |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:127 | listAccountingFiscalYears | accounting_fiscal_years |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:139 | listAccountingPeriods | accounting_periods |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:154 | listAccountingEntries | accounting_entries |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:192 | getAccountingEntry | accounting_entries, accounting_entry_lines |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:226 | getAccountingSettings | accounting_settings |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:238 | createAccountingEntry | accounting_journals |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:306 | postAccountingEntry | accounting_entries |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:333 | cancelAccountingEntry | accounting_entries |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:353 | archiveAccountingEntry | accounting_entries |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:435 | generateCustomerInvoiceAccountingEntry | customer_invoices, third_parties, customer_invoice_lines |  | requireActiveWorkspace, ensureAccounts |
| src/lib/accounting-actions.ts:554 | generateSupplierInvoiceAccountingEntry | supplier_invoices, supplier_invoice_lines |  | requireActiveWorkspace, ensureAccounts |
| src/lib/accounting-actions.ts:674 | generateCustomerPaymentAccountingEntry | customer_payments, third_parties |  | requireActiveWorkspace, ensureAccounts |
| src/lib/accounting-actions.ts:762 | generateSupplierPaymentAccountingEntry | supplier_payments, third_parties |  | requireActiveWorkspace, ensureAccounts |
| src/lib/accounting-actions.ts:850 | updateAccountingSettings | accounting_settings |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:876 | updateAccountingEntryLineAccount | accounting_entry_lines, accounting_entries, accounting_accounts |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:943 | postCustomerInvoiceToAccounting | customer_invoices |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:977 | postSupplierInvoiceToAccounting | supplier_invoices |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:1010 | postCustomerPaymentToAccounting | customer_payments |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:1043 | postSupplierPaymentToAccounting | supplier_payments |  | requireActiveWorkspace |
| src/lib/accounting-actions.ts:1076 | createChartOfAccount | accounting_accounts |  | requireProWorkspace |
| src/lib/accounting-actions.ts:1128 | updateChartOfAccount | accounting_accounts, accounting_entry_lines |  | requireProWorkspace |
| src/lib/accounting-actions.ts:1211 | archiveChartOfAccount | accounting_accounts, accounting_entry_lines |  | requireProWorkspace |
| src/lib/accounting-actions.ts:1249 | toggleChartOfAccountActive | accounting_accounts |  | requireProWorkspace |
| src/lib/accounting-actions.ts:1277 | ensureDefaultChartOfAccountsAction |  |  | ensureDefaultChartOfAccountsAction, requireProWorkspace, ensureDefaultChartOfAccounts |
| src/lib/actions/activate-plan.ts:13 | activatePlanAction | subscription_plans, organization_subscriptions |  |  |
| src/lib/actions/company.ts:28 | updateCompanyAction | organizations, organization-logos, company_settings | set_organization_logo | requireActiveWorkspace |
| src/lib/actions/complete-invitation.ts:20 | completeInvitationAction | invitations, organization_members, profiles | accept_invitation_for_user |  |
| src/lib/actions/create-entreprise.ts:21 | createEntrepriseAction | profiles, organizations, company_settings | create_organization_with_owner, finalize_organization_onboarding | ensureAccountingBaseSetup |
| src/lib/actions/documents.ts:10 | updateDocumentSettingsAction | document_settings |  | requireActiveWorkspace |
| src/lib/actions/ensure-reference-data.ts:7 | ensureCustomerCategories | customer_categories |  | ensureCustomerCategories, requireActiveWorkspace |
| src/lib/actions/ensure-reference-data.ts:35 | ensureProductCategories | product_categories |  | ensureProductCategories, requireActiveWorkspace |
| src/lib/actions/ensure-reference-data.ts:66 | ensureUnits | units |  | ensureUnits, requireActiveWorkspace |
| src/lib/actions/ensure-reference-data.ts:96 | ensureAllReferenceData |  |  | ensureAllReferenceData, ensureCustomerCategories, ensureProductCategories, ensureUnits |
| src/lib/actions/numbering.ts:11 | correctNumberingCounterAction |  | correct_numbering_counter | requireActiveWorkspace |
| src/lib/actions/password-recovery.ts:10 | requestPasswordRecovery |  |  |  |
| src/lib/actions/password-recovery.ts:27 | completePasswordRecovery |  |  |  |
| src/lib/actions/preferences.ts:9 | updatePreferencesAction | user_preferences |  | requireActiveWorkspace |
| src/lib/actions/quick-create.ts:9 | quickCreateCustomerCategory | customer_categories |  | requireActiveWorkspace |
| src/lib/actions/quick-create.ts:21 | quickCreateProductCategory | product_categories |  | requireActiveWorkspace |
| src/lib/actions/quick-create.ts:40 | quickCreateUnit | units |  | requireActiveWorkspace |
| src/lib/actions/quick-create.ts:58 | quickCreateProduct | tax_rates, products |  | requireActiveWorkspace |
| src/lib/actions/register-admin.ts:15 | registerAdminAction |  |  | ensureProfileFromAuthUser |
| src/lib/actions/register-company.ts:25 | registerCompanyAction | profiles, organizations, roles, organization_members, company_settings, organization-logos |  |  |
| src/lib/actions/roles.ts:8 | createRoleAction | roles |  | requireActiveWorkspace |
| src/lib/actions/roles.ts:41 | deleteRoleAction | roles |  | requireActiveWorkspace |
| src/lib/actions/roles.ts:78 | updateRolePermissionsAction | role_permissions |  | requireActiveWorkspace |
| src/lib/actions/start-trial.ts:6 | startTrialAction |  |  |  |
| src/lib/actions/supplier-open-invoices.ts:5 | getSupplierOpenInvoicesAction |  |  |  |
| src/lib/auth-actions.ts:13 | loginAction |  |  |  |
| src/lib/auth-actions.ts:82 | logoutAction |  |  |  |
| src/lib/auth-actions/company.ts:12 | createCompanyAction |  | create_organization_with_owner |  |
| src/lib/auth-actions/signup.ts:13 | signUpAction |  |  |  |
| src/lib/commerce-actions.ts:93 | createSalesQuote | sales_quotes, sales_quote_lines |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:174 | updateSalesQuote | sales_quotes, sales_quote_lines |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:274 | archiveSalesQuote | sales_quotes |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:297 | sendSalesQuote | sales_quotes |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:331 | acceptSalesQuote | sales_quotes |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:365 | rejectSalesQuote | sales_quotes |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:399 | convertQuoteToOrder | sales_quotes, sales_quote_lines, sales_orders, sales_order_lines |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:506 | createSalesOrder | sales_orders, sales_order_lines |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:606 | updateSalesOrder | sales_orders, sales_order_lines |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:721 | archiveSalesOrder | sales_orders |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:744 | confirmSalesOrder | sales_orders |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:778 | createDeliveryFromOrder | sales_orders, delivery_notes, delivery_note_lines |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:849 | createDeliveryNote | delivery_notes, delivery_note_lines |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:907 | updateDeliveryNote | delivery_notes, delivery_note_lines |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:977 | archiveDeliveryNote | delivery_notes |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:1000 | validateDeliveryNote | delivery_notes |  | requireActiveWorkspace |
| src/lib/commerce-actions.ts:1034 | markDeliveryAsDelivered | delivery_notes |  | requireActiveWorkspace |
| src/lib/credit-note-actions.ts:103 | createCustomerCreditNote |  |  |  |
| src/lib/credit-note-actions.ts:110 | updateCustomerCreditNote |  |  |  |
| src/lib/credit-note-actions.ts:122 | createCreditNoteFromReturn |  |  |  |
| src/lib/credit-note-actions.ts:133 | validateCustomerCreditNote | customer_credit_notes, sales_documents |  | requireActiveWorkspace |
| src/lib/credit-note-actions.ts:161 | cancelCustomerCreditNote | customer_credit_notes |  | requireActiveWorkspace |
| src/lib/credit-note-actions.ts:186 | applyCreditNoteToInvoices |  | apply_customer_credit_note_atomic | requireActiveWorkspace |
| src/lib/credit-note-actions.ts:200 | unapplyCreditNoteFromInvoice |  | unapply_customer_credit_note_atomic | requireActiveWorkspace |
| src/lib/credit-note-actions.ts:212 | postCustomerCreditNote |  | save_accounting_entry_atomic | requireActiveWorkspace |
| src/lib/dashboard-data.ts:15 | getLightDashboardData | treasury_accounts |  | requireActiveWorkspace |
| src/lib/dashboard-data.ts:92 | getDashboardData | customer_invoices, customer_payments, treasury_accounts, sales_documents, products, stock_levels, customer_invoice_lines, product_categories, third_parties |  | requireActiveWorkspace |
| src/lib/document-actions.ts:65 | uploadDocumentAction | documents |  | requireProWorkspace |
| src/lib/document-actions.ts:147 | archiveDocumentAction | documents |  |  |
| src/lib/document-actions.ts:167 | deleteDocumentAction | documents |  |  |
| src/lib/e-invoicing/actions.ts:57 | prepareEinvoiceAction | einvoice_versions, einvoice_validations | einvoice_save_preparation | assertEinvoiceWrite |
| src/lib/e-invoicing/actions.ts:121 | validateEinvoiceAction |  |  |  |
| src/lib/e-invoicing/actions.ts:122 | issueEinvoiceAction |  |  |  |
| src/lib/e-invoicing/actions.ts:123 | readyEinvoiceAction |  |  |  |
| src/lib/e-invoicing/actions.ts:126 | issueAndArchiveEinvoiceAction |  | einvoice_issue_and_archive | assertEinvoiceWrite |
| src/lib/e-invoicing/actions.ts:137 | simulateEinvoiceAction |  | einvoice_enqueue_simulation | assertEinvoiceWrite |
| src/lib/e-invoicing/actions.ts:148 | processEinvoiceJobsAction |  |  | assertEinvoiceWrite |
| src/lib/e-invoicing/actions.ts:152 | saveEinvoiceSettingsAction |  | einvoice_update_settings | assertEinvoiceConfiguration |
| src/lib/e-invoicing/actions.ts:173 | checkEinvoiceIntegrityAction |  |  | assertEinvoiceWrite |
| src/lib/e-invoicing/actions.ts:176 | checkRegulatorySourcesAction |  |  | assertEinvoiceConfiguration |
| src/lib/e-invoicing/actions.ts:179 | reviewRegulatoryChangeAction |  |  | assertEinvoiceConfiguration |
| src/lib/e-invoicing/actions.ts:182 | recordBackupVerificationAction |  |  | assertEinvoiceConfiguration |
| src/lib/hr/actions.ts:11 | createHrEmployeeAction | hr_employees |  | requireWritableHrWorkspace, ensureHrReferenceData |
| src/lib/hr/actions.ts:42 | updateHrEmployeeAction | hr_employees |  | requireWritableHrWorkspace |
| src/lib/hr/actions.ts:70 | createHrContractAction | hr_contracts |  | requireWritableHrWorkspace |
| src/lib/hr/actions.ts:94 | createHrLeaveRequestAction | hr_leave_requests |  | requireWritableHrWorkspace |
| src/lib/hr/actions.ts:113 | createHrPayrollPeriodAction | hr_payroll_periods |  | requireWritableHrWorkspace |
| src/lib/hr/actions.ts:153 | calculateHrPayrollPeriodAction | hr_payroll_periods, hr_employees, hr_settings, hr_payslips |  | requireWritableHrWorkspace |
| src/lib/invoice-actions.ts:221 | prepareInvoiceLinesFromDeliveryNotes |  |  |  |
| src/lib/invoice-actions.ts:230 | listBillableDeliveryNotesForInvoice |  |  |  |
| src/lib/invoice-actions.ts:239 | createCustomerInvoice |  | save_customer_invoice_atomic |  |
| src/lib/invoice-actions.ts:256 | updateCustomerInvoice | customer_invoices | save_customer_invoice_atomic |  |
| src/lib/invoice-actions.ts:308 | validateCustomerInvoice |  |  |  |
| src/lib/invoice-actions.ts:313 | markInvoiceAsSent |  |  |  |
| src/lib/invoice-actions.ts:318 | cancelCustomerInvoice |  |  |  |
| src/lib/invoice-actions.ts:323 | archiveCustomerInvoice | customer_invoices |  | requireActiveWorkspace |
| src/lib/invoice-actions.ts:339 | createInvoiceFromOrder |  |  |  |
| src/lib/organization-actions.ts:84 | uploadOrganizationLogoForOrganization | organizations | set_organization_logo | assertCanUpdateOrganizationLogo |
| src/lib/organization-actions.ts:183 | uploadOrganizationLogo |  |  |  |
| src/lib/payment-actions.ts:38 | getCustomerOpenItemsAction |  |  |  |
| src/lib/payment-actions.ts:83 | createCustomerPayment |  | create_customer_payment_atomic | requireActiveWorkspace |
| src/lib/payment-actions.ts:147 | updateCustomerPayment | customer_payments | update_customer_payment_atomic | requireActiveWorkspace |
| src/lib/payment-actions.ts:190 | allocatePaymentToInvoices | customer_payments | allocate_customer_payment_atomic | requireActiveWorkspace |
| src/lib/payment-actions.ts:230 | unallocatePaymentFromInvoice | customer_payment_allocations | unallocate_customer_payment_atomic | requireActiveWorkspace |
| src/lib/payment-actions.ts:265 | cancelCustomerPayment |  | cancel_customer_payment_atomic | requireActiveWorkspace |
| src/lib/payment-actions.ts:292 | confirmCustomerPayment | customer_payments |  | requireActiveWorkspace |
| src/lib/payment-actions.ts:304 | archiveCustomerPayment | customer_payments |  | requireActiveWorkspace |
| src/lib/product-actions.ts:115 | createProduct | tax_rates, products |  | requireActiveWorkspace, requireProWorkspace |
| src/lib/product-actions.ts:227 | updateProduct | tax_rates, products |  | requireActiveWorkspace, requireProWorkspace |
| src/lib/product-actions.ts:337 | archiveProduct | products |  | requireActiveWorkspace |
| src/lib/product-actions.ts:363 | createProductCategory | product_categories |  | requireActiveWorkspace |
| src/lib/product-actions.ts:388 | updateProductCategory | product_categories |  | requireActiveWorkspace |
| src/lib/product-actions.ts:417 | archiveProductCategory | product_categories |  | requireActiveWorkspace |
| src/lib/product-actions.ts:443 | createUnit | units |  | requireActiveWorkspace |
| src/lib/product-actions.ts:470 | updateUnit | units |  | requireActiveWorkspace |
| src/lib/product-actions.ts:498 | archiveUnit | units |  | requireActiveWorkspace |
| src/lib/product-actions.ts:524 | createTaxRate | tax_rates |  | requireActiveWorkspace |
| src/lib/product-actions.ts:566 | updateTaxRate | tax_rates |  | requireActiveWorkspace |
| src/lib/product-actions.ts:609 | archiveTaxRate | tax_rates |  | requireActiveWorkspace |
| src/lib/product-actions.ts:631 | setDefaultTaxRate | tax_rates |  | requireActiveWorkspace |
| src/lib/purchase-actions.ts:139 | createSupplierOrder | third_parties, purchase_documents |  | requireProWorkspace |
| src/lib/purchase-actions.ts:182 | updateSupplierOrder | purchase_documents, purchase_document_lines |  | requireProWorkspace |
| src/lib/purchase-actions.ts:219 | confirmSupplierOrder | purchase_documents |  | requireProWorkspace |
| src/lib/purchase-actions.ts:236 | cancelSupplierOrder | purchase_documents |  | requireProWorkspace |
| src/lib/purchase-actions.ts:257 | createSupplierReceipt | purchase_documents, purchase_document_lines |  | requireProWorkspace |
| src/lib/purchase-actions.ts:379 | validateSupplierReceipt | purchase_documents, purchase_document_lines, products |  | requireProWorkspace |
| src/lib/purchase-actions.ts:456 | cancelSupplierReceipt | purchase_documents |  | requireProWorkspace |
| src/lib/purchase-actions.ts:490 | createSupplierInvoice | supplier_invoices | save_supplier_invoice_atomic | requireActiveWorkspace |
| src/lib/purchase-actions.ts:571 | updateSupplierInvoice | supplier_invoices | save_supplier_invoice_atomic | requireActiveWorkspace |
| src/lib/purchase-actions.ts:623 | validateSupplierInvoice | supplier_invoices, third_parties, supplier_invoice_lines |  | requireActiveWorkspace |
| src/lib/purchase-actions.ts:752 | cancelSupplierInvoice | supplier_invoices |  | requireActiveWorkspace |
| src/lib/purchase-actions.ts:767 | archiveSupplierInvoice | supplier_invoices |  | requireActiveWorkspace |
| src/lib/purchase-actions.ts:794 | recalculateSupplierInvoicePaymentStatusAction |  |  | requireActiveWorkspace |
| src/lib/purchase-actions.ts:864 | createSupplierPayment |  | create_supplier_payment_atomic | requireActiveWorkspace |
| src/lib/purchase-actions.ts:940 | allocateSupplierPaymentToInvoices | supplier_payments | allocate_supplier_payment_atomic | requireActiveWorkspace |
| src/lib/purchase-actions.ts:980 | cancelSupplierPayment | supplier_payments | cancel_supplier_payment_atomic | requireActiveWorkspace |
| src/lib/purchase-actions.ts:1032 | archivePurchaseDocument | purchase_documents |  | requireProWorkspace |
| src/lib/reminder-actions.ts:24 | createCustomerReminder | customer_reminders, customer_reminder_invoices |  | requireActiveWorkspace |
| src/lib/reminder-actions.ts:92 | markReminderAsSent |  |  |  |
| src/lib/reminder-actions.ts:97 | cancelCustomerReminder |  |  |  |
| src/lib/reminder-actions.ts:102 | archiveCustomerReminder | customer_reminders |  | requireActiveWorkspace |
| src/lib/sales-actions.ts:439 | createSalesQuote | sales_documents |  | requireProWorkspace |
| src/lib/sales-actions.ts:494 | updateSalesQuote | sales_documents, sales_document_lines |  | requireProWorkspace |
| src/lib/sales-actions.ts:564 | createSalesOrder | sales_documents |  | requireProWorkspace |
| src/lib/sales-actions.ts:619 | updateSalesOrder | sales_documents, sales_document_lines |  | requireProWorkspace |
| src/lib/sales-actions.ts:689 | archiveSalesDocument | sales_documents |  | requireProWorkspace |
| src/lib/sales-actions.ts:745 | markQuoteAsSent |  |  |  |
| src/lib/sales-actions.ts:754 | acceptQuote |  |  |  |
| src/lib/sales-actions.ts:763 | rejectQuote |  |  |  |
| src/lib/sales-actions.ts:772 | convertQuoteToOrder | sales_documents |  | requireProWorkspace |
| src/lib/sales-actions.ts:840 | confirmOrder |  |  | requireProWorkspace |
| src/lib/sales-actions.ts:854 | createDeliveryFromOrder | sales_documents |  | requireProWorkspace |
| src/lib/sales-actions.ts:876 | createDeliveryNoteFromOrder | sales_documents, sales_document_lines |  | requireProWorkspace |
| src/lib/sales-actions.ts:1001 | createManualDeliveryNote |  |  |  |
| src/lib/sales-actions.ts:1008 | validateDeliveryNote | sales_documents, sales_document_lines |  | requireProWorkspace |
| src/lib/sales-actions.ts:1074 | markDeliveryAsDelivered | sales_documents |  | requireProWorkspace |
| src/lib/sales-actions.ts:1092 | createReturnFromDelivery | sales_documents, sales_document_lines |  | requireProWorkspace |
| src/lib/sales-actions.ts:1205 | validateReturnNote | sales_documents, sales_document_lines |  | requireProWorkspace |
| src/lib/stock-actions.ts:85 | createManualStockEntry |  |  |  |
| src/lib/stock-actions.ts:93 | createStockAdjustment |  |  |  |
| src/lib/stock-location-actions.ts:59 | createStockLocation | warehouses |  | requireProWorkspace, ensureCodeIsUnique |
| src/lib/stock-location-actions.ts:83 | updateStockLocation | warehouses |  | requireProWorkspace, ensureCodeIsUnique |
| src/lib/stock-location-actions.ts:106 | archiveStockLocation | warehouses |  | requireProWorkspace |
| src/lib/stock-location-actions.ts:124 | setDefaultStockLocation |  |  | requireProWorkspace |
| src/lib/supplier-credit-note-actions.ts:54 | createSupplierCreditNote |  |  |  |
| src/lib/supplier-credit-note-actions.ts:58 | updateSupplierCreditNote |  |  |  |
| src/lib/supplier-credit-note-actions.ts:62 | validateSupplierCreditNote | supplier_credit_notes |  |  |
| src/lib/supplier-credit-note-actions.ts:73 | cancelSupplierCreditNote | supplier_credit_notes |  |  |
| src/lib/supplier-credit-note-actions.ts:85 | applySupplierCreditNote |  | apply_supplier_credit_note_atomic |  |
| src/lib/supplier-credit-note-actions.ts:95 | unapplySupplierCreditNote |  | unapply_supplier_credit_note_atomic |  |
| src/lib/supplier-credit-note-actions.ts:103 | postSupplierCreditNoteToAccounting |  | save_accounting_entry_atomic | ensureAccountingBaseSetup |
| src/lib/tax/dgi-vat-export-actions.ts:108 | generateDgiVatXmlAction | tax_export_batches |  | requireProWorkspace |
| src/lib/tax/vat-declaration-actions.ts:34 | createVatDeclarationAction | vat_declarations |  | requireProWorkspace |
| src/lib/tax/vat-declaration-actions.ts:172 | validateVatDeclarationAction | vat_declarations |  | requireProWorkspace |
| src/lib/tax/vat-declaration-actions.ts:222 | archiveVatDeclarationAction | vat_declarations |  | requireProWorkspace |
| src/lib/tax/vat-declaration-actions.ts:264 | autoFixVatDeclarationAnomaliesAction | vat_declarations |  | requireProWorkspace |
| src/lib/third-party-actions.ts:276 | createThirdParty | third_parties |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:307 | updateThirdParty | third_parties |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:348 | archiveThirdParty | third_parties |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:385 | restoreThirdParty | third_parties |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:399 | convertProspectToCustomer | third_parties, audit_logs |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:454 | createThirdPartyContact | third_party_contacts |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:496 | updateThirdPartyContact | third_party_contacts |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:540 | deleteThirdPartyContact | third_party_contacts |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:576 | createThirdPartyAddress | third_party_addresses |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:619 | updateThirdPartyAddress | third_party_addresses |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:664 | deleteThirdPartyAddress | third_party_addresses |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:700 | uploadThirdPartyAttachment | third_parties, third_party_attachments |  | requireActiveWorkspace |
| src/lib/third-party-actions.ts:777 | archiveThirdPartyAttachment | third_party_attachments |  | requireActiveWorkspace |
| src/lib/treasury-actions.ts:90 | createTreasuryAccount | treasury_accounts |  | requireActiveWorkspace |
| src/lib/treasury-actions.ts:130 | updateTreasuryAccount | treasury_accounts |  | requireActiveWorkspace |
| src/lib/treasury-actions.ts:167 | archiveTreasuryAccount | treasury_accounts |  | requireActiveWorkspace |
| src/lib/treasury-actions.ts:180 | setDefaultTreasuryAccount |  |  | requireActiveWorkspace |
| src/lib/treasury-actions.ts:192 | createManualTreasuryTransaction | treasury_accounts | create_treasury_transfer, create_treasury_transaction_atomic | requireActiveWorkspace |
| src/lib/treasury-actions.ts:259 | archiveTreasuryTransaction |  | archive_treasury_transaction_atomic | requireActiveWorkspace |
| src/lib/treasury-actions.ts:286 | importBankStatement | bank_statement_imports, bank_statement_lines |  | requireProWorkspace |
| src/lib/treasury-actions.ts:386 | cancelBankStatementImport | bank_statement_imports |  | requireProWorkspace |
| src/lib/treasury-actions.ts:399 | reconcileStatementLineWithTransaction | bank_statement_lines, treasury_transactions, bank_reconciliations |  | requireProWorkspace |
| src/lib/treasury-actions.ts:427 | confirmAutomaticReconciliations | bank_statement_lines, treasury_transactions, bank_reconciliations |  | requireProWorkspace |
| src/lib/treasury-actions.ts:471 | ignoreStatementLine | bank_statement_lines |  | requireProWorkspace |
| src/lib/treasury-actions.ts:487 | createTransactionFromStatementLine | bank_statement_lines | create_treasury_transaction_from_statement_line_atomic | requireProWorkspace |
| src/lib/treasury-actions.ts:510 | unreconcileStatementLine |  |  |  |
| src/lib/treasury-forecast-actions.ts:24 | createTreasuryForecastItem | treasury_forecast_items |  | requireProWorkspace |
| src/lib/treasury-forecast-actions.ts:68 | updateTreasuryForecastItem | treasury_forecast_items |  | requireProWorkspace |
| src/lib/treasury-forecast-actions.ts:118 | setTreasuryForecastItemStatus | treasury_forecast_items |  | requireProWorkspace |
| src/lib/treasury-forecast-actions.ts:141 | archiveTreasuryForecastItem | treasury_forecast_items |  | requireProWorkspace |
| src/lib/tva-actions.ts:30 | generateDgiVatPreparationAction | tax_export_batches |  | requireProWorkspace |
