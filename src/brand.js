export const STRIX_BRAND = Object.freeze({
  name: "Strix United",
  logo: "/brand/strix/strix-united-fc27.png",
  logoFallback: "/brand/strix/strix-united-fc27-256.webp",
  avifSet: [128, 256, 384, 512]
    .map((size) => `/brand/strix/strix-united-fc27-${size}.avif ${size}w`)
    .join(", "),
  webpSet: [128, 256, 384, 512]
    .map((size) => `/brand/strix/strix-united-fc27-${size}.webp ${size}w`)
    .join(", "),
});

export const RASTRO_BRAND = Object.freeze({
  name: "Rastro",
  color: "#2F80FF",
  logo: "/brand/rastro/rastro-mark.png",
  logoCompact: "/brand/rastro/rastro-mark.png",
});

export const NEXT_CLUBS_BRAND = Object.freeze({
  name: "Next Clubs",
  color: "#C7FF2F",
  logo: "/brand/next-clubs/nextclubs-logo-tight.png",
  sourceLogo: "/brand/next-clubs/nextclubs-logo.png",
});
