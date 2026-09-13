// Relative API URLs work with the Vite development proxy and the production Vercel rewrite.
// A body selects POST; omitting it selects GET. Each call has a 110-second browser deadline.
export async function api(path, body) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 110000);
  try {
    const res = await fetch(`/api${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    // Provide readable feedback even when a proxy or server returns a non-JSON response.
    const data = await res
      .json()
      .catch(() => ({
        error:
          "The server returned an unreadable response. Check that the backend is running.",
      }));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  } catch (e) {
    // A browser timeout does not prove the server stopped; reload before repeating a mutation.
    if (e.name === "AbortError")
      throw new Error(
        "Request timed out. Reload the saved analysis before retrying.",
      );
    if (e instanceof TypeError)
      throw new Error(
        "Cannot reach the server. Start the backend and try again.",
      );
    throw e;
  // Clear the deadline regardless of request, parsing, or HTTP failure.
  } finally {
    clearTimeout(timer);
  }
}
