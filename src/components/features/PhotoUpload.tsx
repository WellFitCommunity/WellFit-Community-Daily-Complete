import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

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
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) {
    // Fall back to public URL (won’t work on private, but harmless to return)
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    return pub?.publicUrl;
  }
  return data?.signedUrl;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ context, recordId, onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type?: "success" | "error"; text?: string }>({});
  const [caption, setCaption] = useState(""); // community only

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
      const cacheControl = "public, max-age=31536000, immutable";

      if (context === "community") {
        // ===== Community Moments (PRIVATE bucket) =====
        const storagePath = `community/${uid}/${unique}.${ext}`;

        // IMPORTANT: use the correct bucket
        const { error: upErr } = await supabase.storage
          .from(COMMUNITY_BUCKET)
          .upload(storagePath, file, {
            upsert: false,
            contentType: file.type,
            cacheControl,
          });
        if (upErr) throw upErr;

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

        // Return a signed URL so the uploader can preview their own image immediately
        const viewUrl = await getViewUrl(COMMUNITY_BUCKET, storagePath);
        onSuccess?.({ storagePath, publicUrl: viewUrl });
      } else {
        // ===== Per-record (e.g., meals) =====
        if (!recordId) {
          setMessage({ type: "error", text: "Missing recordId for this upload." });
          return;
        }

        const bucketName = `${context}-photos`; // e.g., "meal-photos"
        const filePath = `${safeId}/${unique}.${ext}`;

        const { error } = await supabase.storage.from(bucketName).upload(filePath, file, {
          upsert: false,
          contentType: file.type,
          cacheControl,
        });
        if (error) throw error;

        setMessage({ type: "success", text: "Upload successful!" });

        // Signed URL works regardless of bucket privacy
        const viewUrl = await getViewUrl(bucketName, filePath);
        onSuccess?.({ storagePath: filePath, publicUrl: viewUrl });
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

      {uploading && <p className="text-base text-gray-600">Uploading…</p>}
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
