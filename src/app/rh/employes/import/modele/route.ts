import { csvResponse } from "@/lib/listing";
import { employeeCsvTemplate, EMPLOYEE_CSV_HEADERS } from "@/lib/hr/validation";

export function GET() {
  const lines = employeeCsvTemplate().trim().split("\n");
  const example = (lines[1] ?? "").split(";");
  return csvResponse("modele-import-salaries", [...EMPLOYEE_CSV_HEADERS], [example]);
}
