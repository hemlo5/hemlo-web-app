export async function createMirofishEventSource(routeUrl: URL): Promise<EventSource> {
  const signedUrlRequest = new URL(routeUrl.toString());
  signedUrlRequest.searchParams.set("transport", "url");
  // The full seed is stored on custom_simulations before this call. Keeping it
  // out of query strings avoids production proxy and browser URL limits.
  signedUrlRequest.searchParams.set("reality_seed", "");

  const res = await fetch(signedUrlRequest.toString(), {
    cache: "no-store",
    credentials: "same-origin",
  });

  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : { error: await res.text().catch(() => "") };

  if (!res.ok || !payload?.url) {
    throw new Error(
      payload?.error ||
      payload?.detail ||
      `Could not create signed Modal stream URL (${res.status})`
    );
  }

  return new EventSource(payload.url);
}
