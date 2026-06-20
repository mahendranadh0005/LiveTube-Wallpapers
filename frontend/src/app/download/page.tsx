'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Download, 
  Tv, 
  Smartphone, 
  HelpCircle, 
  CheckCircle, 
  Monitor, 
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getDownloadUrl } from '../../lib/api';
import { Suspense } from 'react';

function DownloadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const videoFilename = searchParams.get('video') || '';
  const zipFilename = searchParams.get('zip') || '';
  const title = searchParams.get('title') || 'Live Wallpaper';
  const thumb = searchParams.get('thumb') || '';

  // Expandable installation instructions
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  const videoUrl = videoFilename ? getDownloadUrl(videoFilename) : '';
  const zipUrl = zipFilename ? getDownloadUrl(zipFilename) : '';

  const toggleGuide = (guide: string) => {
    if (openGuide === guide) setOpenGuide(null);
    else setOpenGuide(guide);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#06040a]">
      {/* Header */}
      <header className="glass-panel border-b border-purple-500/10 px-4 md:px-6 py-4 flex items-center justify-between z-20">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Create New Wallpaper
        </button>
        
        <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-green-400" /> Generation Complete!
        </span>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto">
        
        {/* Left Side: Live Preview Panel */}
        <div className="flex-grow bg-black/40 flex flex-col items-center justify-center p-6 md:p-12 relative border-r border-purple-500/5 min-h-[350px]">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/5 blur-[120px] pointer-events-none" />

          {/* Main Visual Preview wrapper */}
          <div className="w-full max-w-2xl flex flex-col items-center gap-4 relative">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 self-start pl-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Loops preview
            </h3>
            
            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl relative bg-black/60 max-w-xl group">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  No preview available
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Verify effects, looping, and borders. Right click or long press to inspect frames directly.
            </p>
          </div>
        </div>

        {/* Right Side: Details & Downloads Panel */}
        <div className="w-full md:w-[420px] p-6 sm:p-8 flex flex-col gap-6 overflow-y-auto">
          
          {/* Wallpaper Title Card */}
          <div className="flex flex-col gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-200 leading-tight">
              {title}
            </h1>
            <p className="text-xs text-purple-400/80 font-mono">
              File: {videoFilename.substring(0, 20)}...
            </p>
          </div>

          <div className="h-[1px] bg-purple-500/10" />

          {/* Downloads Block */}
          <div className="flex flex-col gap-5">
            
            {/* Desktop Downloads */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-purple-400" /> Desktop Live Wallpapers
              </span>

              <div className="flex flex-col gap-2">
                {/* MP4 */}
                <a
                  href={videoUrl}
                  download
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-between text-xs sm:text-sm transition-all shadow-md hover:shadow-purple-500/20 border border-purple-500/20"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" /> Download MP4 Wallpaper
                  </span>
                  <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded text-purple-300 font-mono uppercase">MP4</span>
                </a>

                {/* Wallpaper Engine ZIP */}
                <a
                  href={zipUrl}
                  download
                  className="bg-black/40 hover:bg-purple-500/5 text-purple-400 hover:text-purple-300 font-semibold py-3 px-4 rounded-xl flex items-center justify-between text-xs sm:text-sm border border-purple-500/15 hover:border-purple-500/30 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-indigo-400" /> Wallpaper Engine ZIP
                  </span>
                  <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-indigo-400 font-mono uppercase">ZIP Bundle</span>
                </a>
              </div>
            </div>

            {/* Mobile Downloads */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-purple-400" /> Mobile Live Wallpapers
              </span>

              <div className="flex flex-col gap-2">
                {/* Vertical MP4 */}
                <a
                  href={videoUrl}
                  download
                  className="bg-black/40 hover:bg-purple-500/5 text-purple-400 hover:text-purple-300 font-semibold py-3 px-4 rounded-xl flex items-center justify-between text-xs sm:text-sm border border-purple-500/15 hover:border-purple-500/30 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-pink-400" /> Android Live MP4
                  </span>
                  <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-pink-400 font-mono uppercase">9:16</span>
                </a>

                {/* iOS Lock Screen version */}
                <a
                  href={videoUrl}
                  download
                  className="bg-black/40 hover:bg-purple-500/5 text-purple-400 hover:text-purple-300 font-semibold py-3 px-4 rounded-xl flex items-center justify-between text-xs sm:text-sm border border-purple-500/15 hover:border-purple-500/30 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-400" /> iOS / Lock Screen Clip
                  </span>
                  <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-blue-400 font-mono uppercase">iOS Vibe</span>
                </a>
              </div>
            </div>

          </div>

          <div className="h-[1px] bg-purple-500/10" />

          {/* Installation / Setup Guide */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-purple-400" /> How to Set Up Live Wallpapers
            </span>

            <div className="flex flex-col gap-2">
              
              {/* Wallpaper Engine Guide */}
              <div className="border border-purple-500/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGuide('engine')}
                  className="w-full bg-black/25 px-4 py-3 flex justify-between items-center text-xs font-semibold text-gray-300 hover:bg-purple-500/5 transition-colors"
                >
                  <span>Wallpaper Engine (Desktop)</span>
                  {openGuide === 'engine' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openGuide === 'engine' && (
                  <div className="bg-black/10 p-4 text-xs text-gray-400 leading-relaxed flex flex-col gap-2">
                    <p>1. Extract the downloaded <b>Wallpaper Engine ZIP</b> package.</p>
                    <p>2. Open your Steam directory: <code className="bg-black/40 px-1 py-0.5 rounded text-[10px]">steamapps/common/wallpaper_engine/projects/myprojects</code>.</p>
                    <p>3. Move the extracted folder containing <code className="text-[10px]">project.json</code> and <code className="text-[10px]">wallpaper.mp4</code> into the <code className="text-[10px]">myprojects</code> directory.</p>
                    <p>4. Open Wallpaper Engine and select your newly rendered custom wallpaper!</p>
                  </div>
                )}
              </div>

              {/* Windows Native Guide */}
              <div className="border border-purple-500/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGuide('windows')}
                  className="w-full bg-black/25 px-4 py-3 flex justify-between items-center text-xs font-semibold text-gray-300 hover:bg-purple-500/5 transition-colors"
                >
                  <span>Free Windows alternatives (Lively)</span>
                  {openGuide === 'windows' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openGuide === 'windows' && (
                  <div className="bg-black/10 p-4 text-xs text-gray-400 leading-relaxed flex flex-col gap-2">
                    <p>1. Download the free, open-source application <b>Lively Wallpaper</b> from the Microsoft Store or GitHub.</p>
                    <p>2. Drag-and-drop the generated <b>MP4 Wallpaper</b> directly into the Lively window.</p>
                    <p>3. Provide a name and hit Apply to set the seamless loop as your desktop wallpaper.</p>
                  </div>
                )}
              </div>

              {/* Android Guide */}
              <div className="border border-purple-500/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGuide('android')}
                  className="w-full bg-black/25 px-4 py-3 flex justify-between items-center text-xs font-semibold text-gray-300 hover:bg-purple-500/5 transition-colors"
                >
                  <span>Android Setup Guide</span>
                  {openGuide === 'android' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openGuide === 'android' && (
                  <div className="bg-black/10 p-4 text-xs text-gray-400 leading-relaxed flex flex-col gap-2">
                    <p>1. Transfer the <b>Android Live MP4</b> file to your phone.</p>
                    <p>2. Go to Google Photos or your default Gallery app, select the video file.</p>
                    <p>3. Tap the options menu (three dots) and select <b>Set as Wallpaper</b> or <b>Set as Live Wallpaper</b>.</p>
                    <p>4. Alternatively, use free apps like <i>Video to Wallpaper</i> or <i>Lively Wallpaper Mobile</i>.</p>
                  </div>
                )}
              </div>

              {/* iOS Guide */}
              <div className="border border-purple-500/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGuide('ios')}
                  className="w-full bg-black/25 px-4 py-3 flex justify-between items-center text-xs font-semibold text-gray-300 hover:bg-purple-500/5 transition-colors"
                >
                  <span>iOS / iPhone Setup Guide</span>
                  {openGuide === 'ios' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openGuide === 'ios' && (
                  <div className="bg-black/10 p-4 text-xs text-gray-400 leading-relaxed flex flex-col gap-2">
                    <p>1. Transfer the <b>iOS Lock Screen Clip</b> to your iPhone Camera Roll.</p>
                    <p>2. Convert the video into a <i>Live Photo</i> using a free App Store utility (such as <i>intLive</i> or <i>turnLive</i>).</p>
                    <p>3. Go to Settings &gt; Wallpaper, select the Live Photo, and enable the "Live Photo" motion option for your Lock Screen.</p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-auto pt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-xs text-purple-400 hover:text-purple-300 underline font-semibold transition-colors"
            >
              Make another live wallpaper
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-[#06040a] text-gray-400 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading Download Page...</span>
        </div>
      </div>
    }>
      <DownloadContent />
    </Suspense>
  );
}
