export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export type ThirdPartyType = "customer" | "supplier" | "both";

export type ThirdParty = {
  id: string;
  type: ThirdPartyType;
  name: string;
  commercialName: string;
  ice: string;
  city: string;
  email: string;
  phone: string;
  balance: number;
  status: "active" | "inactive" | "blocked";
};

export type Product = {
  id: string;
  type: "product" | "service";
  sku: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  taxRate: number;
  stock: number;
  minStock: number;
  status: "active" | "inactive";
};

export type DocumentRow = {
  id: string;
  number: string;
  customer: string;
  documentDate: string;
  dueDate?: string;
  status: string;
  total: number;
  paid?: number;
};

export type CashTransaction = {
  id: string;
  account: string;
  label: string;
  date: string;
  type: "in" | "out";
  amount: number;
};
