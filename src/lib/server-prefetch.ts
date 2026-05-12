import "server-only";

export function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function serverJson<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const url = new URL(path, getSiteUrl());
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
