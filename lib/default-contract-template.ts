import { readFileSync } from "node:fs";
import { join } from "node:path";

// The agreement's layout and standard terms. Owners do not edit this: they add their own terms as plain text (section 20).
// Read once when the server starts: after editing the HTML, restart (or touch this file in development).
export const defaultRentalContractTemplate = readFileSync(join(process.cwd(), "lib", "contract-templates", "default-en.html"), "utf8");
