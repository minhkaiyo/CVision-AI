/**
 * Cloudinary upload utilities for CVision AI
 * Uses unsigned upload preset — no server-side signing needed for public assets.
 */

const CLOUD_NAME = "dyjgtjc4l";
const UPLOAD_PRESET = "studyportal_unsigned";

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
}

/**
 * Upload a file to Cloudinary with progress callback.
 * @param file - The file to upload
 * @param folder - Cloudinary folder path (e.g. "avatars/uid")
 * @param onProgress - Optional callback with 0-100 percent
 */
export function uploadToCloudinary(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const resourceType = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)
      ? "image"
      : "raw";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && data.secure_url) {
          resolve(data as CloudinaryUploadResult);
        } else {
          reject(new Error(data.error?.message ?? `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error("Invalid response from Cloudinary"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}
