/**
 * Build the web-app URL the extension opens. Query only; never a path segment.
 * Dummy Maps URLs in tests. No VRMs.
 */
export function brimEstimateUrl(webOrigin: string, pageUrl: string): string {
  const origin = webOrigin.replace(/\/+$/, "");
  return `${origin}/?url=${encodeURIComponent(pageUrl)}`;
}
