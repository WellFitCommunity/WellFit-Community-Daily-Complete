import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getSignedUrl } from "../../utils/getSignedUrl";
import {
  enterpriseFileUpload,
  type UploadProgress,
} from "../../services/EnterpriseFileUploadService";

interface PhotoUploadProps {
  context: "meal" | "community";
  recordId?: string;
  onSuccess?: (result: { storagePath: string; publicUrl?: string }) => void;
}

const MAX_FILE_SIZE_MB = 5;
const COMMUNITY_BUCKET = "community-moments-photos";

// derive a safe extension from MIME; fallback to jpg
function extFromMime(mime: string | undefined) {
  if (!mime) return "jpg";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
  };
  return map[mime.toLowerCase()] ?? "jpg";
}

// basic path sanitizer to avoid odd chars (defense-in-depth)
function safeSegment(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// always try to return a signed URL (works for private OR public buckets)
async function getViewUrl(bucket: string, path: string, expiresInSeconds = 3600) {
  // Use the cached version for better performance
  const signedUrl = await getSignedUrl(path, expiresInSeconds, bucket);
  if (signedUrl) {
    return signedUrl;
  }
  // Fall back to public URL (won't work on private, but harmless to return)
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return pub?.publicUrl;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ context, recordId, onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type?: "success" | "error"; text?: string }>({});
  const [caption, setCaption] = useState(""); // community only
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setMessage({});
    const file = e.target.files[0];

    // 1) Type (MIME header)
    if (!file.type?.startsWith("image/")) {
      setMessage({ type: "error", text: "Only image files are allowed." });
      e.target.value = "";
      return;
    }
    // 2) Size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setMessage({ type: "error", text: `File too large (max ${MAX_FILE_SIZE_MB}MB).` });
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const { data: authData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !authData?.user) {
        setMessage({ type: "error", text: "Please sign in first." });
        return;
      }
      const uid = authData.user.id;

      const ext = extFromMime(file.type);
      const unique =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const safeId = recordId ? safeSegment(recordId) : "";

      if (context === "community") {
        // ===== Community Moments (PRIVATE bucket) - ENTERPRISE UPLOAD =====
        const storagePath = `community/${uid}/${unique}.${ext}`;

        // Use enterprise upload service with chunking, validation, and audit trail
        const result = await enterpriseFileUpload.upload({
          bucket: COMMUNITY_BUCKET,
          path: storagePath,
          file,
          onProgress: setUploadProgress,
          containsPHI: false, // Community photos are not PHI
          dataClassification: 'internal',
        });

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        // Insert metadata row for moderation workflow
        const { error: rowErr } = await supabase.from("community_photos").insert({
          user_id: uid,
          storage_path: storagePath,
          caption: caption?.trim() || null,
          approved: false,
        });
        if (rowErr) throw rowErr;

        setCaption("");
        setMessage({ type: "success", text: "Uploaded! Pending admin approval." });

        // Return signed URL from enterprise upload
        onSuccess?.({
          storagePath,
          publicUrl: result.signedUrl || await getViewUrl(COMMUNITY_BUCKET, storagePath)
        });
      } else {
        // ===== Per-record (e.g., meals) - ENTERPRISE UPLOAD =====
        if (!recordId) {
          setMessage({ type: "error", text: "Missing recordId for this upload." });
          return;
        }

        const bucketName = `${context}-photos`; // e.g., "meal-photos"
        const filePath = `${safeId}/${unique}.${ext}`;

        // Use enterprise upload service with full validation
        const result = await enterpriseFileUpload.upload({
          bucket: bucketName,
          path: filePath,
          file,
          onProgress: setUploadProgress,
          containsPHI: false,
          dataClassification: 'internal',
        });

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        setMessage({ type: "success", text: "Upload successful!" });

        // Return signed URL from enterprise upload
        onSuccess?.({
          storagePath: filePath,
          publicUrl: result.signedUrl || await getViewUrl(bucketName, filePath)
        });
      }
    } catch (err) {
      const text =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown upload error.";
      setMessage({ type: "error", text: `Error uploading: ${text}` });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-3" aria-busy={uploading}>
      {context === "community" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="photo-caption">
            Caption (optional)
          </label>
          <input
            id="photo-caption"
            className="border p-2 rounded w-full"
            placeholder="Say something about your photo"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={300}
          />
        </div>
      )}

      <label htmlFor="photo-upload-input" className="block font-medium text-gray-700 text-base">
        {context === "community" ? "Upload Community Photo" : "Upload Photo"}
      </label>

      <input
        id="photo-upload-input"
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={handleFileChange}
        className="block w-full text-base text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
      />

      {uploading && uploadProgress && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {uploadProgress.message || `Uploading... ${Math.round(uploadProgress.percentage)}%`}
          </p>
          {uploadProgress.totalChunks > 1 && (
            <p className="text-xs text-gray-500">
              Chunk {uploadProgress.currentChunk} of {uploadProgress.totalChunks}
            </p>
          )}
        </div>
      )}
      {uploading && !uploadProgress && <p className="text-base text-gray-600">Uploading…</p>}
      {message.text && (
        <p
          role="status"
          className={`text-base ${message.type === "success" ? "text-green-600" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
};

export default PhotoUpload;
