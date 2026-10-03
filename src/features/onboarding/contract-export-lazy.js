// Downloads load on demand so first paint never carries them: the video needs
// the H.264 muxer; the document only needs the small PDF writer.
const loadVideo = () => import("./contract-export.js");
const loadDocument = () => import("./contract-document.js");

export const renderContractVideo = (...args) => loadVideo().then((module) => module.renderContractVideo(...args));
export const downloadSignedContractPdf = (...args) => loadDocument().then((module) => module.downloadSignedContractPdf(...args));
