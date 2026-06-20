'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Sparkles, 
  Smartphone, 
  Monitor, 
  Tv, 
  Cpu, 
  Play, 
  Pause, 
  VolumeX, 
  Clock, 
  RotateCcw,
  Sliders,
  Type
} from 'lucide-react';
import { fetchYouTubeInfo, startGeneration, getJobStatus, YouTubeMetadata, getTempFileUrl } from '../../lib/api';
import { Suspense } from 'react';

// Helper to extract YouTube Video ID
function getYoutubeId(url: string): string | null {
  const regExp = /^^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
  const match = url.match(regExp);
  return (match && match[1]) ? match[1] : null;
}

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const videoUrl = searchParams.get('url') || '';
  const localFileId = searchParams.get('localId') || '';
  const initialTitle = searchParams.get('title') || 'Untitled Video';
  const initialDuration = parseFloat(searchParams.get('duration') || '0');
  const initialThumb = searchParams.get('thumb') || '';

  // Video State
  const [title, setTitle] = useState(initialTitle);
  const [duration, setDuration] = useState(initialDuration);
  const [thumb, setThumb] = useState(initialThumb);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);

  // Subtitles
  const [subtitles, setSubtitles] = useState<{ lang: string; name: string }[]>([]);
  const [selectedSubLang, setSelectedSubLang] = useState('en');
  const [burnSubtitles, setBurnSubtitles] = useState(false);

  // Settings
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(Math.min(10, initialDuration));
  const [resolution, setResolution] = useState<'720p' | '1080p' | '1440p' | '4k'>('1080p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '21:9'>('16:9');
  const [selectedEffects, setSelectedEffects] = useState<string[]>(['color_enhancement', 'vignette']);
  const [seamlessLoop, setSeamlessLoop] = useState(true);

  // Render Job State
  const [isRendering, setIsRendering] = useState(false);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatusText, setRenderStatusText] = useState('Initializing rendering...');

  // Players References
  const [isPlaying, setIsPlaying] = useState(true);
  const localPlayerRef = useRef<HTMLVideoElement>(null);
  
  // YouTube API Player
  const [ytPlayer, setYtPlayer] = useState<any>(null);
  const ytPlayerContainerId = 'youtube-editor-iframe';

  // Extract YouTube ID
  useEffect(() => {
    if (videoUrl) {
      const id = getYoutubeId(videoUrl);
      setYoutubeId(id);
      
      // Load YouTube subtitles list
      fetchYouTubeInfo(videoUrl).then((info) => {
        setSubtitles(info.subtitles);
        if (info.subtitles.length > 0) {
          // Default to English if available, else first one
          const hasEn = info.subtitles.find(s => s.lang.startsWith('en'));
          setSelectedSubLang(hasEn ? hasEn.lang : info.subtitles[0].lang);
        }
      }).catch(err => {
        console.error('Failed to reload subtitle info:', err);
      });
    }
  }, [videoUrl]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (youtubeId && !(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        initYtPlayer();
      };
    } else if (youtubeId && (window as any).YT) {
      initYtPlayer();
    }

    return () => {
      if (ytPlayer) {
        ytPlayer.destroy();
      }
    };
  }, [youtubeId]);

  const initYtPlayer = () => {
    if (!youtubeId || !(window as any).YT) return;
    
    const player = new (window as any).YT.Player(ytPlayerContainerId, {
      videoId: youtubeId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        loop: 1,
        modestbranding: 1,
        mute: 1,
        rel: 0,
        showinfo: 0,
        start: Math.floor(startSec),
        end: Math.ceil(endSec),
      },
      events: {
        onReady: (event: any) => {
          setYtPlayer(event.target);
          event.target.playVideo();
          setIsPlaying(true);
        },
        onStateChange: (event: any) => {
          // If video ended or somehow got past loop boundary, seek back to start
          if (event.data === (window as any).YT.PlayerState.ENDED) {
            event.target.seekTo(startSec, true);
            event.target.playVideo();
          }
        }
      }
    });
  };

  // Keep player looping between startSec and endSec
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (youtubeId && ytPlayer && isPlaying) {
      interval = setInterval(() => {
        try {
          const currentTime = ytPlayer.getCurrentTime();
          if (currentTime >= endSec || currentTime < startSec) {
            ytPlayer.seekTo(startSec, true);
          }
        } catch (e) {}
      }, 200);
    } else if (localFileId && localPlayerRef.current && isPlaying) {
      const video = localPlayerRef.current;
      const handleTimeUpdate = () => {
        if (video.currentTime >= endSec || video.currentTime < startSec) {
          video.currentTime = startSec;
        }
      };
      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }

    return () => clearInterval(interval);
  }, [youtubeId, ytPlayer, localFileId, startSec, endSec, isPlaying]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (isPlaying) {
      if (youtubeId && ytPlayer) ytPlayer.pauseVideo();
      if (localFileId && localPlayerRef.current) localPlayerRef.current.pause();
    } else {
      if (youtubeId && ytPlayer) ytPlayer.playVideo();
      if (localFileId && localPlayerRef.current) localPlayerRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Update slider positions
  const handleStartChange = (val: number) => {
    // Keep minimum clip duration 3 seconds
    const newStart = Math.min(val, endSec - 3);
    setStartSec(parseFloat(newStart.toFixed(1)));
    if (youtubeId && ytPlayer) ytPlayer.seekTo(newStart, true);
    if (localFileId && localPlayerRef.current) localPlayerRef.current.currentTime = newStart;
  };

  const handleEndChange = (val: number) => {
    // Keep minimum clip duration 3 seconds and maximum 30 seconds
    const newEnd = Math.max(val, startSec + 3);
    const finalEnd = Math.min(newEnd, startSec + 30);
    setEndSec(parseFloat(finalEnd.toFixed(1)));
    if (youtubeId && ytPlayer) ytPlayer.seekTo(startSec, true);
    if (localFileId && localPlayerRef.current) localPlayerRef.current.currentTime = startSec;
  };

  // Toggle Effect Helper
  const toggleEffect = (effect: string) => {
    if (selectedEffects.includes(effect)) {
      setSelectedEffects(selectedEffects.filter(e => e !== effect));
    } else {
      setSelectedEffects([...selectedEffects, effect]);
    }
  };

  // Trigger Wallpaper Generation
  const handleRender = async () => {
    setIsRendering(true);
    setRenderProgress(5);
    setRenderStatusText('Registering wallpaper task on backend...');

    try {
      const jobId = await startGeneration({
        url: videoUrl || undefined,
        localFileId: localFileId || undefined,
        startSec,
        endSec,
        resolution,
        fps,
        aspectRatio,
        effects: selectedEffects,
        burnSubtitles: burnSubtitles,
        subLanguage: burnSubtitles ? selectedSubLang : undefined,
        seamlessLoop,
      });

      setRenderJobId(jobId);
      
      // Start polling
      pollJobStatus(jobId);

    } catch (err: any) {
      alert(err.message || 'Failed to start video rendering pipeline');
      setIsRendering(false);
    }
  };

  const pollJobStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await getJobStatus(jobId);

        setRenderProgress(job.progress);
        
        if (job.status === 'processing') {
          if (job.progress < 40) {
            setRenderStatusText('Downloading video source and subtitles...');
          } else if (job.progress < 85) {
            setRenderStatusText(`Processing video with FFmpeg (${job.progress - 40}%)...`);
          } else {
            setRenderStatusText('Optimizing looping & packaging Wallpaper Engine ZIP...');
          }
        }

        if (job.status === 'completed') {
          clearInterval(interval);
          setRenderProgress(100);
          setRenderStatusText('Render completed! Redirecting...');
          
          // Save to localstorage recent creations
          try {
            const creation = {
              id: job.id,
              title: title,
              thumbnail: thumb || '/api/temp-file/' + job.videoFilename?.replace('wallpaper-', 'thumb-final-').replace('.mp4', '.jpg'),
              videoFilename: job.videoFilename,
              zipFilename: job.zipFilename,
              aspectRatio: aspectRatio,
              timestamp: Date.now(),
            };

            const existingStr = localStorage.getItem('livetube_wallpapers');
            const existing = existingStr ? JSON.parse(existingStr) : [];
            localStorage.setItem('livetube_wallpapers', JSON.stringify([creation, ...existing]));
          } catch (e) {
            console.error('LocalStorage write error:', e);
          }

          // Redirect to download screen
          setTimeout(() => {
            router.push(`/download?video=${job.videoFilename}&zip=${job.zipFilename}&title=${encodeURIComponent(title)}&thumb=${encodeURIComponent(thumb)}`);
          }, 1000);
        }

        if (job.status === 'failed') {
          clearInterval(interval);
          alert(`Rendering failed: ${job.error || 'Unknown error'}`);
          setIsRendering(false);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 1000);
  };

  // Calculate standard container size mapping
  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] h-[360px] sm:h-[480px]';
      case '21:9':
        return 'aspect-[21/9] w-full max-w-xl';
      case '16:9':
      default:
        return 'aspect-[16/9] w-full max-w-xl';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#06040a]">
      {/* Header */}
      <header className="glass-panel border-b border-purple-500/10 px-4 md:px-6 py-4 flex items-center justify-between z-25">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/')}
            className="p-2 rounded-lg hover:bg-purple-500/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-sm sm:text-base text-gray-200 truncate max-w-xs sm:max-w-md">
              {title}
            </h1>
            <p className="text-[10px] text-purple-400/70 font-mono mt-0.5">
              {youtubeId ? `YouTube ID: ${youtubeId}` : 'Local Upload Workspace'}
            </p>
          </div>
        </div>

        <button
          onClick={handleRender}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-2 px-5 rounded-lg text-xs sm:text-sm shadow-md hover:shadow-purple-500/20 transition-all flex items-center gap-1.5"
        >
          <Cpu className="w-4 h-4" /> Render Wallpaper
        </button>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Side: Video Preview Canvas */}
        <div className="flex-1 bg-black/40 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto relative border-r border-purple-500/5">
          
          <div className="relative flex flex-col items-center gap-4">
            
            {/* Aspect Ratio Box Wrapper */}
            <div className={`relative overflow-hidden rounded-xl border border-purple-500/25 bg-black box-glow-primary/5 transition-all duration-300 ${getAspectRatioClasses()}`}>
              
              {/* YouTube Player */}
              {youtubeId && (
                <div className="w-full h-full pointer-events-none relative scale-[1.01]">
                  <div id={ytPlayerContainerId} className="w-full h-full absolute inset-0" />
                </div>
              )}

              {/* Local Player */}
              {localFileId && (
                <video
                  ref={localPlayerRef}
                  src={getTempFileUrl(localFileId + '.mp4')}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover pointer-events-none"
                />
              )}

              {/* Aspect Ratio Overlay grid helper lines */}
              <div className="absolute inset-0 border border-purple-500/10 pointer-events-none flex items-center justify-center">
                <div className="w-[33.3%] h-full border-l border-r border-purple-500/5" />
                <div className="h-[33.3%] w-full border-t border-b border-purple-500/5 absolute" />
              </div>

              {/* Watermark preview overlay */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md rounded px-2 py-1 text-[9px] font-semibold tracking-wider text-purple-400 uppercase">
                {aspectRatio} Preview
              </div>
            </div>

            {/* Play/Pause Control & Loop Indicator */}
            <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-purple-500/10 backdrop-blur-md">
              <button 
                onClick={togglePlay}
                className="p-1.5 hover:bg-purple-500/20 rounded-full text-purple-400 hover:text-purple-300 transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-purple-400" /> : <Play className="w-4 h-4 fill-purple-400" />}
              </button>
              <div className="h-4 w-[1px] bg-purple-500/10" />
              <span title="Audio muted for wallpaper previews"><VolumeX className="w-3.5 h-3.5 text-gray-500" /></span>
              <div className="text-[11px] font-mono text-gray-400">
                {startSec.toFixed(1)}s - {endSec.toFixed(1)}s
              </div>
              <div className="h-4 w-[1px] bg-purple-500/10" />
              <div className="text-[10px] text-pink-400 font-semibold flex items-center gap-1">
                <RotateCcw className="w-3 h-3 animate-spin-slow" /> Seamless Loop
              </div>
            </div>
            
          </div>
        </div>

        {/* Right Side: Timeline & Customization Sidebar */}
        <div className="w-full md:w-[380px] glass-panel border-t md:border-t-0 border-purple-500/15 flex flex-col h-[400px] md:h-full overflow-y-auto">
          
          {/* Scrollable sidebar panels */}
          <div className="p-5 flex flex-col gap-6 flex-grow pb-24">
            
            {/* Panel Header */}
            <div className="flex items-center gap-2 border-b border-purple-500/10 pb-3">
              <Sliders className="w-4 h-4 text-purple-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider text-gray-300">Wallpaper Settings</h2>
            </div>

            {/* Step 2: Timeline Range Selector */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" /> 1. Select Timeline Range (Max 30s)
              </span>

              {/* Range Editor Track */}
              <div className="flex flex-col gap-2 bg-black/35 border border-purple-500/10 rounded-xl p-4">
                
                {/* Visual Sliders */}
                <div className="flex flex-col gap-3">
                  {/* Start Point */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>Clip Start</span>
                      <span className="font-mono text-purple-400 font-semibold">{startSec.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.1"
                      value={startSec}
                      onChange={(e) => handleStartChange(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 bg-purple-950/40 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* End Point */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>Clip End</span>
                      <span className="font-mono text-purple-400 font-semibold">{endSec.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.1"
                      value={endSec}
                      onChange={(e) => handleEndChange(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 bg-purple-950/40 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Duration warning */}
                <div className="text-[10px] text-gray-500 flex justify-between mt-2 pt-2 border-t border-purple-500/5">
                  <span>Selected clip: <b className="text-gray-300 font-mono">{(endSec - startSec).toFixed(1)}s</b></span>
                  <span>Video length: <b className="text-gray-300 font-mono">{duration.toFixed(0)}s</b></span>
                </div>
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-purple-400" /> 2. Aspect Ratio Layout
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '16:9', label: 'Desktop', desc: '16:9', icon: Tv },
                  { value: '9:16', label: 'Mobile', desc: '9:16', icon: Smartphone },
                  { value: '21:9', label: 'Ultrawide', desc: '21:9', icon: Monitor },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setAspectRatio(item.value as any)}
                    className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition-all ${
                      aspectRatio === item.value
                        ? 'border-purple-500/70 bg-purple-500/10 text-purple-300'
                        : 'border-purple-500/10 bg-black/20 hover:border-purple-500/30 text-gray-400'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-[10px] font-bold mt-0.5">{item.label}</span>
                    <span className="text-[8px] text-gray-500 font-mono">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality (Resolution & FPS) */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" /> 3. Output Resolution & FPS
              </span>
              <div className="grid grid-cols-2 gap-3 bg-black/20 border border-purple-500/10 p-3 rounded-xl">
                {/* Resolution */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Scale</span>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as any)}
                    className="bg-black/50 border border-purple-500/15 rounded-lg py-1.5 px-2 text-xs text-gray-200 focus:border-purple-500 outline-none"
                  >
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="1440p">1440p (2K)</option>
                    <option value="4k">4K (UHD)</option>
                  </select>
                </div>

                {/* FPS */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Frame Rate</span>
                  <select
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value) as any)}
                    className="bg-black/50 border border-purple-500/15 rounded-lg py-1.5 px-2 text-xs text-gray-200 focus:border-purple-500 outline-none"
                  >
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS (Premium)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Visual Effects Checklist */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> 4. Cinematic Filters
              </span>
              <div className="bg-black/20 border border-purple-500/10 rounded-xl p-3 flex flex-col gap-2">
                {[
                  { value: 'color_enhancement', label: 'Color Enhancement', desc: 'Vibrant colors & extra saturation' },
                  { value: 'glow_effect', label: 'Neon Glow', desc: ' ड्रीम glow in bright pixels' },
                  { value: 'motion_zoom', label: 'Motion Drifting Zoom', desc: 'Smooth slow moving zoom pan' },
                  { value: 'vignette', label: 'Soft Vignette', desc: 'Darkened border focus contrast' },
                  { value: 'particle_overlay', label: 'Film Grain overlay', desc: 'Premium cinematic texture overlay' },
                  { value: 'blur_background', label: 'Blur Background padding', desc: 'Blurred sides/margins padding' },
                ].map((effect) => (
                  <label
                    key={effect.value}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-purple-500/5 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEffects.includes(effect.value)}
                      onChange={() => toggleEffect(effect.value)}
                      className="mt-0.5 rounded border-purple-500/20 text-purple-600 focus:ring-0 focus:ring-offset-0 accent-purple-500 bg-black/60 w-3.5 h-3.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-gray-200 leading-tight">{effect.label}</span>
                      <span className="text-[9px] text-gray-500 leading-normal mt-0.5">{effect.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Closed Captions Section */}
            {subtitles.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-purple-400" /> 5. Closed Captions (Subtitles)
                </span>
                
                <div className="bg-black/20 border border-purple-500/10 rounded-xl p-3 flex flex-col gap-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={burnSubtitles}
                      onChange={(e) => setBurnSubtitles(e.target.checked)}
                      className="mt-0.5 rounded border-purple-500/20 text-purple-600 accent-purple-500 bg-black/60 w-3.5 h-3.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-gray-200">Burn Captions into Video</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">Overlay subtitles permanently on wallpaper</span>
                    </div>
                  </label>

                  {burnSubtitles && (
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-purple-500/5">
                      <span className="text-[9px] text-gray-500 uppercase font-semibold">Select Track</span>
                      <select
                        value={selectedSubLang}
                        onChange={(e) => setSelectedSubLang(e.target.value)}
                        className="bg-black/50 border border-purple-500/15 rounded-lg py-1.5 px-2 text-xs text-gray-200 focus:border-purple-500 outline-none"
                      >
                        {subtitles.map((sub) => (
                          <option key={sub.lang} value={sub.lang}>{sub.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Seamless Looping Toggle */}
            <div className="flex items-center justify-between bg-black/20 border border-purple-500/10 rounded-xl p-3">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-200">Seamless Crossfade Loop</span>
                <span className="text-[9px] text-gray-500 mt-0.5">Smoothly crossfade end of loop with start</span>
              </div>
              <input
                type="checkbox"
                checked={seamlessLoop}
                onChange={(e) => setSeamlessLoop(e.target.checked)}
                className="w-8 h-4 bg-purple-950/40 rounded-full appearance-none checked:bg-purple-500 relative cursor-pointer outline-none transition-all duration-300 before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-[2px] before:left-[2px] before:transition-all checked:before:translate-x-4"
              />
            </div>

          </div>
        </div>

      </div>

      {/* Full Screen Processing Loader Modal */}
      <AnimatePresence>
        {isRendering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-6 z-50 px-4"
          >
            {/* Pulsing processing ring */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/10" />
              {/* Spinning progress ring */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="50"
                  fill="transparent"
                  stroke="url(#purpleGradient)"
                  strokeWidth="6"
                  strokeDasharray="314.16"
                  strokeDashoffset={314.16 - (314.16 * renderProgress) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
                <defs>
                  <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9d4edd" />
                    <stop offset="100%" stopColor="#ff007f" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Inner Percentage */}
              <span className="absolute text-xl font-bold font-mono text-purple-400">
                {renderProgress}%
              </span>
            </div>

            {/* Status updates */}
            <div className="text-center max-w-sm">
              <h3 className="text-lg font-bold tracking-wide text-gray-200">Generating Live Wallpaper</h3>
              <p className="text-sm text-gray-500 mt-2 min-h-10">
                {renderStatusText}
              </p>
            </div>

            {/* Sub-bar detail */}
            <div className="w-full max-w-xs bg-purple-950/20 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${renderProgress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Editor() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-[#06040a] text-gray-400 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading Workspace Editor...</span>
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
