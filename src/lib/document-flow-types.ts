export type DocumentFlowStep = {
  label: string;
  number: string;
  href?: string;
  status?: string | null;
  isCurrent?: boolean;
  type?: string;
};
