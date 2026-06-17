export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getDefaultOrganizationSlug() {
  return process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_SLUG || "demo-fleet";
}
