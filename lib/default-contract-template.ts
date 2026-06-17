import { readFileSync } from "node:fs";
import { join } from "node:path";

export const defaultRentalContractTemplate = readFileSync(join(process.cwd(), "lib", "contract-templates", "default-en.html"), "utf8");
