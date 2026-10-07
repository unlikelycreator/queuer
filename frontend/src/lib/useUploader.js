import { useState } from 'react';
import toast from 'react-hot-toast';
import * as api from '@/api/endpoints';

/**
 * Small helper for "attach files" inputs: uploads picked files straight away and keeps
 * the returned file descriptors until the form is submitted.
 */
export default function useUploader({ isPublic = false } = {}) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const pick = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    if (picked.some((f) => f.size > 15 * 1024 * 1024)) {
      toast.error('Each file must be under 15MB');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      picked.forEach((f) => fd.append('files', f));
      const res = await (isPublic ? api.uploadPublicFiles(fd) : api.uploadFiles(fd));
      setFiles((prev) => [...prev, ...res.data.files].slice(0, 5));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Some files failed to upload');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remove = (filename) => setFiles((prev) => prev.filter((f) => f.filename !== filename));
  const reset = () => setFiles([]);

  return { files, uploading, pick, remove, reset };
}
