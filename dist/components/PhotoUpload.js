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
const PhotoUpload = ({ context, recordId }) => {
    const [uploading, setUploading] = (0, react_1.useState)(false);
    const bucketName = `${context}-photos`;
    const handleFileChange = async (e) => {
        if (!e.target.files?.length)
            return;
        const file = e.target.files[0];
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}.${ext}`;
        const filePath = `${recordId}/${fileName}`;
        setUploading(true);
        const { error } = await supabaseClient_1.supabase.storage
            .from(bucketName)
            .upload(filePath, file, { upsert: false });
        setUploading(false);
        if (error) {
            alert('Error uploading: ' + error.message);
        }
        else {
            alert('Upload successful!');
        }
        e.target.value = '';
    };
    return (<div className="space-y-1">
      <label className="block font-medium text-gray-700">Upload Photo</label>
      <input type="file" accept="image/*" disabled={uploading} onChange={handleFileChange} className="block"/>
      {uploading && <p className="text-gray-500 text-sm">Uploading…</p>}
    </div>);
};
exports.default = PhotoUpload;
