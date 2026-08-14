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
