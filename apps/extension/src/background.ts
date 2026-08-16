import { brimEstimateUrl } from "./url.js";

const WEB_ORIGIN = __WEB_ORIGIN__;

const MAPS_URL_PATTERNS = [
  "https://www.google.com/maps/dir/*",
  "https://maps.google.com/maps/dir/*",
  "https://www.google.co.uk/maps/dir/*",
  "https://maps.google.co.uk/maps/dir/*",
  "https://maps.app.goo.gl/*",
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "brim-estimate",
      title: "Estimate journey cost with Brim",
      contexts: ["page", "link"],
      documentUrlPatterns: MAPS_URL_PATTERNS,
      targetUrlPatterns: MAPS_URL_PATTERNS,
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "brim-estimate") return;
  const pageUrl = info.linkUrl ?? info.pageUrl;
  if (!pageUrl) return;
  void chrome.tabs.create({ url: brimEstimateUrl(WEB_ORIGIN, pageUrl) });
});
