export type BrandingStorageReference = {
  bucket: string;
  path: string;
};

export type ParsedBrandingReference =
  | { kind: "storage"; reference: BrandingStorageReference }
  | { kind: "data_url"; url: string }
  | { kind: "external_url"; url: string };

const storageUrlPattern = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/;

function cleanPath(path: string) {
  return decodeURIComponent(path).replace(/^\/+/, "");
}

export function isBrowserSafeAssetUrl(value: string | null | undefined) {
  const rawValue = String(value || "").trim();
  return rawValue.startsWith("data:") || /^https?:\/\//i.test(rawValue);
}

export function browserSafeAssetUrl(value: string | null | undefined) {
  const rawValue = String(value || "").trim();
  return isBrowserSafeAssetUrl(rawValue) ? rawValue : null;
}

export function parseLegacyBrandingReference(
  value: string | BrandingStorageReference | null | undefined,
  defaultBucket = "branding"
): ParsedBrandingReference | null {
  if (!value) return null;

  if (typeof value === "object") {
    const bucket = String(value.bucket || "").trim();
    const path = cleanPath(String(value.path || ""));
    return bucket && path ? { kind: "storage", reference: { bucket, path } } : null;
  }

  const rawValue = value.trim();
  if (!rawValue) return null;
  if (rawValue.startsWith("data:")) return { kind: "data_url", url: rawValue };

  const storageMatch = rawValue.match(storageUrlPattern);
  if (storageMatch) {
    return {
      kind: "storage",
      reference: {
        bucket: storageMatch[1],
        path: cleanPath(storageMatch[2])
      }
    };
  }

  if (/^https?:\/\//i.test(rawValue)) {
    return { kind: "external_url", url: rawValue };
  }

  return {
    kind: "storage",
    reference: {
      bucket: defaultBucket,
      path: cleanPath(rawValue)
    }
  };
}

export async function createBrandingSignedUrl(
  supabase: { storage: { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl?: string } | null; error?: { message?: string } | null }> } } },
  reference: BrandingStorageReference,
  expiresIn = 60 * 60
) {
  const { data, error } = await supabase.storage.from(reference.bucket).createSignedUrl(reference.path, expiresIn);
  if (error) {
    throw new Error(error.message || "Unable to create signed branding asset URL.");
  }
  return data?.signedUrl || null;
}

export async function resolveBrandingAssetUrl(
  supabase: { storage: { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl?: string } | null; error?: { message?: string } | null }> } } },
  value: string | BrandingStorageReference | null | undefined,
  options: {
    allowExternalUrl?: boolean;
    defaultBucket?: string;
    expiresIn?: number;
  } = {}
) {
  const parsed = parseLegacyBrandingReference(value, options.defaultBucket || "branding");
  if (!parsed) return null;
  if (parsed.kind === "data_url") return parsed.url;
  if (parsed.kind === "external_url") return options.allowExternalUrl ? parsed.url : null;
  return createBrandingSignedUrl(supabase, parsed.reference, options.expiresIn);
}

export function canonicalBrandingReferenceFromSettings(
  settings: Record<string, unknown> | null | undefined,
  bucketKey: string,
  pathKey: string
) {
  const bucket = String(settings?.[bucketKey] || "").trim();
  const path = cleanPath(String(settings?.[pathKey] || ""));
  return bucket && path ? { bucket, path } : null;
}

export async function resolveBrandingDisplayUrl(
  supabase: { storage: { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl?: string } | null; error?: { message?: string } | null }> } } },
  input: {
    canonical?: BrandingStorageReference | null;
    legacy?: string | BrandingStorageReference | null;
    allowExternalUrl?: boolean;
    expiresIn?: number;
  }
) {
  if (input.canonical) {
    return createBrandingSignedUrl(supabase, input.canonical, input.expiresIn);
  }
  return resolveBrandingAssetUrl(supabase, input.legacy, {
    allowExternalUrl: input.allowExternalUrl,
    expiresIn: input.expiresIn
  });
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function organizationLogoReference(organization: {
  logo_url?: string | null;
  business_logo_storage_bucket?: string | null;
  business_logo_storage_path?: string | null;
  settings?: unknown;
}) {
  const settings = recordObject(organization.settings);
  const bucket = String(organization.business_logo_storage_bucket || "").trim();
  const path = String(organization.business_logo_storage_path || "").trim();
  return {
    canonical: bucket && path
      ? { bucket, path }
      : canonicalBrandingReferenceFromSettings(settings, "business_logo_storage_bucket", "business_logo_storage_path"),
    legacy: String(organization.logo_url || settings.logo_url || "").trim() || null
  };
}

export function organizationSignatureReference(organization: {
  owner_signature_url?: string | null;
  authorised_signature_storage_bucket?: string | null;
  authorised_signature_storage_path?: string | null;
  settings?: unknown;
}) {
  const settings = recordObject(organization.settings);
  const bucket = String(organization.authorised_signature_storage_bucket || "").trim();
  const path = String(organization.authorised_signature_storage_path || "").trim();
  return {
    canonical: bucket && path ? { bucket, path } : null,
    legacy: String(organization.owner_signature_url || settings.owner_signature_url || "").trim() || null
  };
}

export async function resolveOrganizationBrandingDisplayUrls(
  supabase: { storage: { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl?: string } | null; error?: { message?: string } | null }> } } },
  organization: {
    logo_url?: string | null;
    business_logo_storage_bucket?: string | null;
    business_logo_storage_path?: string | null;
    owner_signature_url?: string | null;
    authorised_signature_storage_bucket?: string | null;
    authorised_signature_storage_path?: string | null;
    settings?: unknown;
  },
  options: { allowExternalUrl?: boolean; expiresIn?: number } = {}
) {
  const logo = organizationLogoReference(organization);
  const signature = organizationSignatureReference(organization);
  const [logoUrl, signatureUrl] = await Promise.all([
    resolveBrandingDisplayUrl(supabase, { ...logo, allowExternalUrl: options.allowExternalUrl, expiresIn: options.expiresIn }),
    resolveBrandingDisplayUrl(supabase, { ...signature, allowExternalUrl: options.allowExternalUrl, expiresIn: options.expiresIn })
  ]);

  return {
    logoUrl,
    signatureUrl
  };
}
