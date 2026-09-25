// Asks Google why it accepts or rejects the Maps key, without printing the key.
const fs = require("fs");
const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="));
const key = (line || "").split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
if (!key) { console.log("no key found"); process.exit(1); }

const checks = [
  ["Places (autocomplete, as used by the address box)", `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Lamai%20Beach&key=${key}`],
  ["Geocoding", `https://maps.googleapis.com/maps/api/geocode/json?address=Lamai%20Beach%20Koh%20Samui&key=${key}`],
  ["Maps JavaScript loader", `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`]
];

(async () => {
  for (const [name, url] of checks) {
    try {
      const res = await fetch(url, { headers: { Referer: "http://localhost:3000/" } });
      const text = await res.text();
      let summary;
      try {
        const json = JSON.parse(text);
        summary = `${json.status}${json.error_message ? " - " + json.error_message : ""}`;
      } catch {
        const hint = (text.match(/(\w+MapError|ApiNotActivated\w*|RefererNotAllowed\w*|InvalidKey\w*|BillingNotEnabled\w*|ApiTargetBlocked\w*)/) || [])[1];
        summary = `HTTP ${res.status}, ${text.length} bytes${hint ? ", mentions " + hint : ""}`;
      }
      console.log(`${name}: ${summary.replaceAll(key, "<key>")}`);
    } catch (e) {
      console.log(`${name}: request failed - ${e.message}`);
    }
  }
})();
