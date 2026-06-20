'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Youtube, 
  UploadCloud, 
  History, 
  Sparkles, 
  Monitor, 
  Smartphone, 
  Repeat, 
  Download,
  AlertCircle
} from 'lucide-react';
import { fetchYouTubeInfo, uploadLocalVideo } from '../lib/api';

interface RecentCreation {
  id: string;
  title: string;
  thumbnail: string;
  videoFilename: string;
  zipFilename: string;
  aspectRatio: string;
  timestamp: number;
}

export default function Home() {
  const router = useRouter();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Drag & drop state
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recent creations state
  const [recentCreations, setRecentCreations] = useState<RecentCreation[]>([]);

  useEffect(() => {
    // Load recent creations
    try {
      const stored = localStorage.getItem('livetube_wallpapers');
      if (stored) {
        setRecentCreations(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent creations:', e);
    }
  }, []);

  const validateYoutubeUrl = (url: string) => {
    const p = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
    return url.match(p);
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    if (!validateYoutubeUrl(youtubeUrl)) {
      setError('Please enter a valid YouTube video URL');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Pre-fetch info to make sure video is reachable and to retrieve title
      const info = await fetchYouTubeInfo(youtubeUrl);
      // Navigate to editor with parameters
      router.push(`/editor?url=${encodeURIComponent(youtubeUrl)}&title=${encodeURIComponent(info.title)}&duration=${info.duration}&thumb=${encodeURIComponent(info.thumbnail)}`);
    } catch (err: any) {
      setError(err.message || 'Could not fetch video information. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await uploadFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file (MP4, WEBM, etc.)');
      return;
    }

    setIsLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      const metadata = await uploadLocalVideo(file, (percent) => {
        setUploadProgress(percent);
      });
      
      // Navigate to editor with local file metadata
      router.push(`/editor?localId=${metadata.id}&title=${encodeURIComponent(metadata.title)}&duration=${metadata.duration}&thumb=${encodeURIComponent(metadata.thumbnailUrl)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to upload video file. Please try again.');
      setIsLoading(false);
      setUploadProgress(null);
    }
  };

  const clearRecentCreations = () => {
    localStorage.removeItem('livetube_wallpapers');
    setRecentCreations([]);
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 md:px-8 py-12 relative overflow-hidden">
      
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />

      {/* Hero Header */}
      <div className="text-center max-w-3xl z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-400 text-xs font-semibold mb-6 uppercase tracking-wider"
        >
          <Sparkles className="w-3.5 h-3.5" /> Turn Videos into Live Wallpapers
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight"
        >
          LiveTube <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent animate-gradient">Wallpapers</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed"
        >
          Create seamless looping live wallpapers from your favorite YouTube clips or local uploads. Customized for Desktop, Mobile, and Ultrawide displays.
        </motion.p>
      </div>

      {/* Input / Upload Workspace Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="w-full max-w-2xl glass-card rounded-2xl p-6 sm:p-8 z-10 relative box-glow-primary/5"
      >
        <div className="flex flex-col gap-6">
          
          {/* YouTube URL input */}
          <form onSubmit={handleYoutubeSubmit} className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Youtube className="w-4 h-4 text-red-500" /> Enter YouTube Video URL
            </label>
            
            <div className="flex flex-col sm:flex-row gap-2 relative">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isLoading}
                className="flex-1 bg-black/40 border border-purple-500/20 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500 outline-none rounded-xl px-4 py-3.5 text-sm transition-all text-white placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={isLoading || !youtubeUrl.trim()}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl px-6 py-3.5 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/20"
              >
                {isLoading && !uploadProgress ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                Analyze Video
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-purple-500/10"></div>
            <span className="flex-shrink mx-4 text-gray-500 text-xs font-semibold uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-purple-500/10"></div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 ${
              dragActive 
                ? 'border-purple-500 bg-purple-500/10 scale-[1.02]' 
                : 'border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/5'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*"
              className="hidden"
            />
            
            {uploadProgress !== null ? (
              <div className="w-full max-w-xs text-center flex flex-col gap-2">
                <span className="text-sm font-semibold text-purple-400">Uploading Video File...</span>
                <div className="w-full bg-purple-950/40 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{uploadProgress}% Complete</span>
              </div>
            ) : (
              <>
                <UploadCloud className="w-10 h-10 text-purple-400/80 animate-pulse" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-200">Drag and drop local video file</p>
                  <p className="text-xs text-gray-500 mt-1">Supports MP4, MOV, WEBM (Up to 100MB)</p>
                </div>
              </>
            )}
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start gap-2.5 text-sm"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl mt-16 z-10">
        
        <div className="glass-card rounded-xl p-5 flex flex-col gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-100">Multi-Aspect Ratios</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Export in Desktop (16:9), Mobile (9:16), or Ultrawide (21:9) cropped formats.
            </p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 flex flex-col gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-100">Cinematic Filters</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Enhance clips with Neon Glow, Drifting Motion, Vignette, Saturation Boost, and Blur.
            </p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 flex flex-col gap-3">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
            <Repeat className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-100">Seamless Looping</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Generates a smooth 1-second crossfade overlay so wallpapers loop seamlessly.
            </p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 flex flex-col gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Download className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-100">Engine Compatible</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Get an MP4 or a packed ZIP fully configured for Wallpaper Engine setup.
            </p>
          </div>
        </div>

      </div>

      {/* Recent Creations Section */}
      {recentCreations.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="w-full max-w-5xl mt-20 z-10"
        >
          <div className="flex justify-between items-center border-b border-purple-500/10 pb-4 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-200">
              <History className="w-5 h-5 text-purple-400" /> Recent Creations
            </h2>
            <button
              onClick={clearRecentCreations}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors uppercase tracking-wider"
            >
              Clear History
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {recentCreations.slice(0, 6).map((creation) => (
              <div 
                key={creation.id}
                className="glass-card rounded-xl overflow-hidden flex flex-col group relative"
              >
                {/* Thumbnail */}
                <div className="aspect-video w-full relative bg-black/60 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={creation.thumbnail}
                    alt={creation.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-gray-300 font-mono">
                    {creation.aspectRatio}
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 flex flex-col gap-2 flex-grow">
                  <h4 className="font-semibold text-sm truncate text-gray-200" title={creation.title}>
                    {creation.title}
                  </h4>
                  <div className="text-[11px] text-gray-500">
                    {new Date(creation.timestamp).toLocaleDateString()}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <a
                      href={`http://localhost:5000/api/download/${creation.videoFilename}`}
                      download
                      className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-semibold py-2 px-3 rounded-lg text-center flex items-center justify-center gap-1.5 transition-all border border-purple-500/15"
                    >
                      <Download className="w-3.5 h-3.5" /> MP4
                    </a>
                    <a
                      href={`http://localhost:5000/api/download/${creation.zipFilename}`}
                      download
                      className="flex-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold py-2 px-3 rounded-lg text-center flex items-center justify-center gap-1.5 transition-all border border-indigo-500/15"
                    >
                      <Download className="w-3.5 h-3.5" /> WE ZIP
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <footer className="mt-auto pt-24 text-center text-xs text-gray-600 z-10 flex flex-col gap-1">
        <p>LiveTube Wallpapers — Built for aesthetic desktop and mobile setups.</p>
        <p>This utility runs locally. Files are stored temporarily and automatically cleaned up.</p>
      </footer>

    </div>
  );
}
