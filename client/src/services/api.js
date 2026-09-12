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
    const data = await res
      .json()
      .catch(() => ({
        error:
          "The server returned an unreadable response. Check that the backend is running.",
      }));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  } catch (e) {
    if (e.name === "AbortError")
      throw new Error(
        "Request timed out. Reload the saved analysis before retrying.",
      );
    if (e instanceof TypeError)
      throw new Error(
        "Cannot reach the server. Start the backend and try again.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
