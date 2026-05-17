export async function createMirofishEventSource(routeUrl: URL): Promise<EventSource> {
  const endpoint = new URL(routeUrl.pathname, routeUrl.origin);
  const params = Object.fromEntries(routeUrl.searchParams.entries());
  params.transport = "url";
  // The full seed is stored on custom_simulations before this call. Keeping it
  // out of request URLs avoids production proxy and browser URL limits.
  params.reality_seed = "";

  const res = await fetch(endpoint.toString(), {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
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
