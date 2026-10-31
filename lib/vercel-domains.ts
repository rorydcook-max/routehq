/**
 * Adds a business's own domain to the RoveHQ project on Vercel, which then issues its certificate
 * (launch checklist: "Own domain on the Business plan" needs VERCEL_API_TOKEN and VERCEL_PROJECT_ID).
 * Without them the domain is saved and the RoveHQ team connects it by hand from a Help conversation.
 */

const API = "https://api.vercel.com";

function settings() {
  const token = process.env.VERCEL_API_TOKEN || "";
  const project = process.env.VERCEL_PROJECT_ID || "";
  const team = process.env.VERCEL_TEAM_ID || "";
  return { token, project, query: team ? `?teamId=${encodeURIComponent(team)}` : "" };
}

export function vercelDomainsConfigured() {
  const { token, project } = settings();
  return Boolean(token && project);
}

async function call(path: string, init: RequestInit = {}) {
  const { token } = settings();
  const response = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body: body as any };
}

export async function addProjectDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!vercelDomainsConfigured()) return { ok: false, error: "not_configured" };
  const { project, query } = settings();
  const result = await call(`/v10/projects/${project}/domains${query}`, { method: "POST", body: JSON.stringify({ name: domain }) });
  // Already on the project is fine.
  if (result.ok || result.body?.error?.code === "domain_already_in_use_by_project" || result.status === 409) return { ok: true };
  return { ok: false, error: String(result.body?.error?.message || `Vercel said ${result.status}`) };
}

export async function removeProjectDomain(domain: string) {
  if (!vercelDomainsConfigured()) return;
  const { project, query } = settings();
  await call(`/v9/projects/${project}/domains/${encodeURIComponent(domain)}${query}`, { method: "DELETE" }).catch(() => null);
}

/** True once the DNS record points at Vercel and the domain is verified. */
export async function projectDomainReady(domain: string): Promise<boolean> {
  if (!vercelDomainsConfigured()) return false;
  const { project, query } = settings();
  const [config, onProject] = await Promise.all([
    call(`/v6/domains/${encodeURIComponent(domain)}/config${query}`),
    call(`/v9/projects/${project}/domains/${encodeURIComponent(domain)}${query}`)
  ]);
  return config.ok && config.body?.misconfigured === false && onProject.ok && onProject.body?.verified !== false;
}
