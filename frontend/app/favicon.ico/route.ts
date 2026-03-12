const SVG_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="18" fill="#0b1020"/>
  <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#g)"/>
  <path d="M22 18h9l11 28h-8l-2-6H21l-2 6h-7l10-28zm2 16h6l-3-9-3 9z" fill="#f7f9ff"/>
  <circle cx="47" cy="19" r="5" fill="#9cf0b6"/>
  <defs>
    <linearGradient id="g" x1="8" x2="58" y1="8" y2="56" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5885ff"/>
      <stop offset="1" stop-color="#ff9c5a"/>
    </linearGradient>
  </defs>
</svg>
`.trim();

export function GET() {
  return new Response(SVG_ICON, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
}
