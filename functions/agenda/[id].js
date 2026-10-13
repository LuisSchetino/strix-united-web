import { serveLinkPreview } from "../_lib/link-preview.js";

// A direct link to one item: the app for people, a card for chat apps (see _lib/link-preview.js).
export const onRequest = serveLinkPreview;
