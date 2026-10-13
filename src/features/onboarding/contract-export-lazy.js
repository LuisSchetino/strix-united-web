// Downloads load on demand so first paint never carries them: the video needs
// the H.264 muxer; the document only needs the small PDF writer.
// A download asked for after the site was updated reloads the tab onto the new build
// (see ui/fresh-deploy.js) instead of failing with a missing file.
import { freshImport } from "../../ui/fresh-deploy.js";

const loadVideo = freshImport(() => import("./contract-export.js"));
const loadDocument = freshImport(() => import("./contract-document.js"));

export const renderContractVideo = (...args) => loadVideo().then((module) => module.renderContractVideo(...args));
export const downloadSignedContractPdf = (...args) => loadDocument().then((module) => module.downloadSignedContractPdf(...args));
