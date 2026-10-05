import { readFileSync } from "node:fs";
import { join } from "node:path";

// Read once when the server starts: after editing the HTML, restart (or touch this file in development).
export const defaultRentalContractTemplate = readFileSync(join(process.cwd(), "lib", "contract-templates", "default-en.html"), "utf8");
