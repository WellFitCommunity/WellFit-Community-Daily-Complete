"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const supabaseClient_1 = require("../lib/supabaseClient");
const PhotoGallery = ({ context, recordId }) => {
    const [urls, setUrls] = (0, react_1.useState)([]);
    const bucketName = `${context}-photos`;
    (0, react_1.useEffect)(() => {
        supabaseClient_1.supabase.storage
            .from(bucketName)
            .list(recordId, { limit: 100 })
            .then(({ data, error }) => {
            if (error) {
                console.error('List error:', error.message);
                return;
            }
            if (data) {
                const publicUrls = data.map(file => supabaseClient_1.supabase.storage.from(bucketName).getPublicUrl(`${recordId}/${file.name}`).data.publicUrl);
                setUrls(publicUrls);
            }
        });
    }, [bucketName, recordId]);
    if (!urls.length) {
        return <p className="text-gray-500 italic">No photos yet.</p>;
    }
    return (<div className="grid grid-cols-2 gap-3">
      {urls.map(url => (<img key={url} src={url} alt="Uploaded" className="w-full rounded shadow-sm"/>))}
    </div>);
};
exports.default = PhotoGallery;
