// The export pipeline (H.264 muxer, PDF writer) is only needed when someone
// downloads their contract. Loading it on demand keeps it out of the entry bundle.
const load = () => import("./contract-export.js");

export const renderContractVideo = (...args) => load().then((module) => module.renderContractVideo(...args));
export const downloadSignedContractPdf = (...args) => load().then((module) => module.downloadSignedContractPdf(...args));
