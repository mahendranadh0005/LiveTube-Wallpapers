const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface YouTubeMetadata {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  webpage_url: string;
  subtitles: { lang: string; name: string }[];
}

export interface LocalVideoMetadata {
  id: string;
  title: string;
  duration: number;
  thumbnailUrl: string;
  fileName: string;
}

export interface GenerateParams {
  url?: string;
  localFileId?: string;
  startSec: number;
  endSec: number;
  resolution: '720p' | '1080p' | '1440p' | '4k';
  fps: number;
  aspectRatio: '16:9' | '9:16' | '21:9';
  effects: string[];
  burnSubtitles: boolean;
  subLanguage?: string;
  seamlessLoop: boolean;
}

export async function fetchYouTubeInfo(url: string): Promise<YouTubeMetadata> {
  const response = await fetch(`${API_BASE}/video-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch video information');
  }

  return response.json();
}

export async function uploadLocalVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<LocalVideoMetadata> {
  const formData = new FormData();
  formData.append('video', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch (e) {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || 'File upload failed'));
        } catch (e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.send(formData);
  });
}

export async function startGeneration(params: GenerateParams): Promise<string> {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to start video processing');
  }

  const data = await response.json();
  return data.jobId;
}

export interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  videoFilename?: string;
  zipFilename?: string;
  title: string;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE}/job-status/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch job status');
  }
  return response.json();
}

export function getDownloadUrl(filename: string): string {
  return `${API_BASE}/download/${filename}`;
}

export function getTempFileUrl(filename: string): string {
  return `${API_BASE}/temp-file/${filename}`;
}
