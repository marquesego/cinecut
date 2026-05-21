/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, ChangeEvent, DragEvent, MouseEvent } from 'react';
import { 
  Plus, 
  Play, 
  Pause, 
  Scissors, 
  Trash2, 
  Download, 
  ChevronRight, 
  ChevronLeft,
  Film,
  List,
  Clock,
  Layout,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Settings2,
  Maximize2,
  Grid,
  Sparkles,
  Layers,
  Repeat,
  Eye,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Clip, Cut } from './types';
import { exportToPremiereXML } from './utils/exportXml';

const CLIP_COLORS = [
  "#3b82f6", // Royal blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#6366f1"  // Indigo
];

const FPS = 50;
const ZOOM_PIXELS_PER_SECOND = 20; // 1 second = 20 pixels on timeline

// Preloaded Mixkit high-quality nature clips for instant editor playability
const PRELOADED_CLIPS = [
  {
    id: "mix-1-stream",
    name: "mixkit-forest-stream-sunlight.mp4",
    url: "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
    duration: 18.4
  },
  {
    id: "mix-2-peaks",
    name: "mixkit-mountain-peaks-aerial.mp4",
    url: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-thick-forest-and-mountains-34306-large.mp4",
    duration: 12.8
  },
  {
    id: "mix-3-city",
    name: "mixkit-urban-timelapse-at-night.mp4",
    url: "https://assets.mixkit.co/videos/preview/mixkit-time-lapse-of-a-city-at-night-8451-large.mp4",
    duration: 32.5
  }
];

export default function App() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [currentClipId, setCurrentClipId] = useState<string | null>(null);
  
  // Source Monitor Playhead and Markers
  const [sourceTime, setSourceTime] = useState(0);
  const [isSourcePlaying, setIsSourcePlaying] = useState(false);
  const [markIn, setMarkIn] = useState<number | null>(null);
  const [markOut, setMarkOut] = useState<number | null>(null);

  // Program Monitor Playhead
  const [sequenceTime, setSequenceTime] = useState(0);
  const [isSequencePlaying, setIsSequencePlaying] = useState(false);

  const [selectedTrack, setSelectedTrack] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Controls Layout space
  const [showProjectBin, setShowProjectBin] = useState(true);
  const [showSegmentsBin, setShowSegmentsBin] = useState(false);

  // Drag Grab Offset (to drag clip exactly from where the mouse grabbed it)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [draggingCutId, setDraggingCutId] = useState<string | null>(null);
  const [dragGrabOffset, setDragGrabOffset] = useState<number>(0);

  // Monitors Ref
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const programVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active clip in Source Monitor
  const currentSourceClip = clips.find(c => c.id === currentClipId);

  // Load sample videos or handle configuration
  useEffect(() => {
    // Generate File placeholders to satisfy standard types requiring actual File object
    const filesList = PRELOADED_CLIPS.map(item => {
      const emptyFile = new File([""], item.name, { type: "video/mp4" });
      return {
        id: item.id,
        name: item.name,
        url: item.url,
        file: emptyFile,
        duration: item.duration
      };
    });
    setClips(filesList);
    setCurrentClipId(filesList[0].id);
  }, []);

  // Compute absolute Sequence Total Duration based on latest clips
  const totalSequenceDuration = cuts.length > 0 
    ? Math.max(...cuts.map(c => c.startTime + (c.out - c.in))) 
    : 0;

  // Format Timecode Helper: HH:MM:SS:FF
  const formatTimecode = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * FPS);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    
    newFiles.forEach((file: File) => {
      const url = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        const newClip: Clip = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: url,
          file: file,
          duration: tempVideo.duration
        };
        setClips(prev => [...prev, newClip]);
        setCurrentClipId(newClip.id);
        if (sourceVideoRef.current) {
          sourceVideoRef.current.src = url;
        }
      };
    });
  };

  // Switch source monitor asset
  const selectSourceClip = (clip: Clip) => {
    setCurrentClipId(clip.id);
    setMarkIn(null);
    setMarkOut(null);
    if (sourceVideoRef.current) {
      sourceVideoRef.current.src = clip.url;
      sourceVideoRef.current.currentTime = 0;
      setIsSourcePlaying(false);
    }
  };

  const setIn = () => {
    if (sourceVideoRef.current) {
      const tc = sourceVideoRef.current.currentTime;
      setMarkIn(tc);
      if (markOut !== null && tc >= markOut) {
        setMarkOut(null);
      }
    }
  };

  const setOut = () => {
    if (sourceVideoRef.current) {
      const tc = sourceVideoRef.current.currentTime;
      if (markIn === null || tc > markIn) {
        setMarkOut(tc);
      }
    }
  };

  // Insert cut onto the sequence (either sequentially, or at current sequence playhead)
  const insertCutAtPlayhead = () => {
    if (!currentClipId || !currentSourceClip) return;
    const startOffset = markIn !== null ? markIn : 0;
    const endOffset = markOut !== null ? markOut : currentSourceClip.duration;
    const duration = endOffset - startOffset;

    // Place exactly at current sequence playhead or end of track if playhead is 0
    const placeTime = sequenceTime > 0 ? sequenceTime : totalSequenceDuration;

    const newCut: Cut = {
      id: Math.random().toString(36).substr(2, 9),
      clipId: currentClipId,
      clipName: currentSourceClip.name,
      in: startOffset,
      out: endOffset,
      track: selectedTrack,
      color: CLIP_COLORS[clips.findIndex(c => c.id === currentClipId) % CLIP_COLORS.length],
      startTime: placeTime
    };

    setCuts(prev => [...prev, newCut]);
    // Move playhead forward elegantly
    setSequenceTime(placeTime + duration);
  };

  const deleteCut = (id: string) => {
    setCuts(prev => prev.filter(c => c.id !== id));
  };

  const toggleSourcePlay = () => {
    if (!sourceVideoRef.current) return;
    if (isSourcePlaying) {
      sourceVideoRef.current.pause();
      setIsSourcePlaying(false);
    } else {
      sourceVideoRef.current.play().catch(() => {});
      setIsSourcePlaying(true);
    }
  };

  const toggleSequencePlay = () => {
    if (isSequencePlaying) {
      setIsSequencePlaying(false);
    } else {
      if (sequenceTime >= totalSequenceDuration) {
        setSequenceTime(0);
      }
      setIsSequencePlaying(true);
    }
  };

  const scrubSource = (delta: number) => {
    if (sourceVideoRef.current) {
      sourceVideoRef.current.currentTime = Math.max(0, Math.min(currentSourceClip?.duration || 100, sourceVideoRef.current.currentTime + delta));
    }
  };

  const scrubSequence = (delta: number) => {
    setSequenceTime(prev => Math.max(0, Math.min(totalSequenceDuration, prev + delta)));
  };

  const stepSourceFrame = (frames: number) => {
    if (sourceVideoRef.current) {
      sourceVideoRef.current.currentTime = Math.max(0, sourceVideoRef.current.currentTime + (frames / FPS));
    }
  };

  // COMPOSITOR SYNCRONIZATION ENGINE
  // Retrieve the active top visual cut for a specific Sequence playtime
  const getActiveCutAtTime = (time: number) => {
    // Check Track V2 (Overlay) first!
    const v2Cut = cuts.find(c => c.track === 1 && time >= c.startTime && time < c.startTime + (c.out - c.in));
    if (v2Cut) return v2Cut;

    // Fallback to Track V1 (Primary)
    const v1Cut = cuts.find(c => c.track === 0 && time >= c.startTime && time < c.startTime + (c.out - c.in));
    return v1Cut || null;
  };

  // Hook to advance the timeline sequence playhead smoothly
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = () => {
      if (!isSequencePlaying) return;

      const now = performance.now();
      const deltaSec = (now - lastTime) / 1000 * playbackRate;
      lastTime = now;

      setSequenceTime(prev => {
        const next = prev + deltaSec;
        if (next >= totalSequenceDuration) {
          setIsSequencePlaying(false);
          return totalSequenceDuration;
        }
        return next;
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    if (isSequencePlaying) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isSequencePlaying, totalSequenceDuration, playbackRate]);

  // Hook to compositionally update correct Program Monitor video states
  const lastProgramSrcRef = useRef<string | null>(null);
  const lastActiveCutIdRef = useRef<string | null>(null);

  useEffect(() => {
    const activeCut = getActiveCutAtTime(sequenceTime);
    
    if (!activeCut) {
      if (programVideoRef.current) {
        programVideoRef.current.pause();
        programVideoRef.current.src = "";
      }
      lastProgramSrcRef.current = null;
      lastActiveCutIdRef.current = null;
      return;
    }

    const clip = clips.find(c => c.id === activeCut.clipId);
    if (!clip || !programVideoRef.current) return;

    // Translate global timeline playhead to clip visual timestamp
    const internalPosition = activeCut.in + (sequenceTime - activeCut.startTime);

    if (lastActiveCutIdRef.current !== activeCut.id || programVideoRef.current.src !== clip.url) {
      lastActiveCutIdRef.current = activeCut.id;
      programVideoRef.current.src = clip.url;
      programVideoRef.current.currentTime = internalPosition;
      
      if (isSequencePlaying) {
        programVideoRef.current.play().catch(() => {});
      } else {
        programVideoRef.current.pause();
      }
    } else {
      // Sync frame drifts
      const deltaFrame = Math.abs(programVideoRef.current.currentTime - internalPosition);
      if (deltaFrame > 0.2) {
        programVideoRef.current.currentTime = internalPosition;
      }

      if (isSequencePlaying && programVideoRef.current.paused) {
        programVideoRef.current.play().catch(() => {});
      } else if (!isSequencePlaying && !programVideoRef.current.paused) {
        programVideoRef.current.pause();
      }
    }
  }, [sequenceTime, isSequencePlaying, cuts, clips]);

  // Volume & Speed Controller binds
  useEffect(() => {
    if (sourceVideoRef.current) {
      sourceVideoRef.current.volume = isMuted ? 0 : volume;
      sourceVideoRef.current.playbackRate = playbackRate;
    }
    if (programVideoRef.current) {
      programVideoRef.current.volume = isMuted ? 0 : volume;
      programVideoRef.current.playbackRate = playbackRate;
    }
  }, [volume, isMuted, playbackRate]);

  // Drag operations from the Bin
  const handleDragStartClip = (e: React.DragEvent, id: string) => {
    setDraggingClipId(id);
    setDraggingCutId(null);
    setDragGrabOffset(0);
  };

  // Drag start of existing Cut
  const handleDragStartCut = (e: React.DragEvent, cut: Cut) => {
    setDraggingCutId(cut.id);
    setDraggingClipId(null);

    // Track offset grabbing
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    setDragGrabOffset(cursorX / ZOOM_PIXELS_PER_SECOND);
  };

  // Handle file drops inside track
  const handleDropOnTrack = (e: React.DragEvent, trackIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    const trackContainer = e.currentTarget as HTMLElement;
    const rect = trackContainer.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const dropTimelineSeconds = cursorX / ZOOM_PIXELS_PER_SECOND;

    let targetStartSeconds = Math.max(0, dropTimelineSeconds - dragGrabOffset);

    if (draggingClipId) {
      const clip = clips.find(c => c.id === draggingClipId);
      if (clip) {
        const duration = Math.min(10, clip.duration);
        const newCut: Cut = {
          id: Math.random().toString(36).substr(2, 9),
          clipId: clip.id,
          clipName: clip.name,
          in: 0,
          out: duration,
          track: trackIdx,
          color: CLIP_COLORS[clips.findIndex(c => c.id === clip.id) % CLIP_COLORS.length],
          startTime: targetStartSeconds
        };
        setCuts(prev => [...prev, newCut]);
      }
    } else if (draggingCutId) {
      setCuts(prev => prev.map(c => {
        if (c.id === draggingCutId) {
          return {
            ...c,
            track: trackIdx,
            startTime: targetStartSeconds
          };
        }
        return c;
      }));
    }

    setDraggingClipId(null);
    setDraggingCutId(null);
    setDragGrabOffset(0);
  };

  // Ruler clicking & scrubbing
  const handleRulerScrub = (e: React.MouseEvent) => {
    const parent = e.currentTarget as HTMLElement;
    
    const updateTimeFromPos = (moveEvent: MouseEvent) => {
      const bounding = parent.getBoundingClientRect();
      const x = moveEvent.clientX - bounding.left;
      const calcSec = Math.max(0, x / ZOOM_PIXELS_PER_SECOND);
      setSequenceTime(calcSec);
    };

    const killListeners = () => {
      window.removeEventListener('mousemove', updateTimeFromPos);
      window.removeEventListener('mouseup', killListeners);
    };

    window.addEventListener('mousemove', updateTimeFromPos);
    window.addEventListener('mouseup', killListeners);

    // Trigger instant click seek
    const bounding = parent.getBoundingClientRect();
    const x = e.clientX - bounding.left;
    setSequenceTime(Math.max(0, x / ZOOM_PIXELS_PER_SECOND));
  };

  // Trim adjustments (Expanding or contracting cut frame ranges)
  const handleTrimStart = (e: React.MouseEvent, cutId: string, handleSide: 'in' | 'out') => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;

    const cut = cuts.find(c => c.id === cutId);
    if (!cut) return;

    const originalIn = cut.in;
    const originalOut = cut.out;
    const originalStartTime = cut.startTime;
    const clip = clips.find(cl => cl.id === cut.clipId);
    if (!clip) return;

    const maxLimit = clip.duration;

    const moveTrim = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / ZOOM_PIXELS_PER_SECOND;

      setCuts(prev => prev.map(c => {
        if (c.id === cutId) {
          if (handleSide === 'in') {
            // Trim left In-point: raises In-Point and moves sequence start position rightward
            const newIn = Math.max(0, Math.min(originalOut - 0.25, originalIn + deltaSec));
            const newStart = originalStartTime + (newIn - originalIn);
            return {
              ...c,
              in: newIn,
              startTime: newStart
            };
          } else {
            // Trim right Out-point: shrinks or swells clip output time window
            const newOut = Math.min(maxLimit, Math.max(originalIn + 0.25, originalOut + deltaSec));
            return {
              ...c,
              out: newOut
            };
          }
        }
        return c;
      }));
    };

    const stopTrim = () => {
      window.removeEventListener('mousemove', moveTrim);
      window.removeEventListener('mouseup', stopTrim);
    };

    window.addEventListener('mousemove', moveTrim);
    window.addEventListener('mouseup', stopTrim);
  };

  // Accessibility Fallback: append loaded clip
  const appendClipToTrack = (clip: Clip, trackIdx: number) => {
    const trackCuts = cuts.filter(c => c.track === trackIdx);
    const endPosition = trackCuts.reduce((max, c) => Math.max(max, c.startTime + (c.out - c.in)), 0);

    const newCut: Cut = {
      id: Math.random().toString(36).substr(2, 9),
      clipId: clip.id,
      clipName: clip.name,
      in: 0,
      out: Math.min(10, clip.duration),
      track: trackIdx,
      color: CLIP_COLORS[clips.findIndex(c => c.id === clip.id) % CLIP_COLORS.length],
      startTime: endPosition
    };
    setCuts(prev => [...prev, newCut]);
  };

  // Main global hotkey definitions
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch(e.key.toLowerCase()) {
        case 'j':
          scrubSequence(-5);
          break;
        case 'k':
          e.preventDefault();
          toggleSequencePlay();
          break;
        case 'l':
          scrubSequence(5);
          break;
        case 'i':
          setIn();
          break;
        case 'o':
          setOut();
          break;
        case ' ':
          e.preventDefault();
          toggleSequencePlay();
          break;
        case 'arrowleft':
          setSequenceTime(prev => Math.max(0, prev - 0.1));
          break;
        case 'arrowright':
          setSequenceTime(prev => Math.min(totalSequenceDuration, prev + 0.1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [markIn, markOut, isSequencePlaying, countOfCuts => cuts.length, clips, totalSequenceDuration]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0F0F11] text-gray-200 font-sans selection:bg-blue-600/30 overflow-hidden select-none">
      
      {/* High Polish Premium Editor Header */}
      <header className="h-12 bg-[#18181C] border-b border-[#25252B] flex items-center justify-between px-5 select-none shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Video className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold tracking-tight text-white uppercase text-sm">CineCut Pro</span>
            <span className="text-[10px] text-blue-500 font-bold tracking-wider rounded-md border border-blue-500/30 bg-blue-500/5 px-1 py-0.2">
              NLE RESOLVE
            </span>
          </div>
        </div>

        {/* Sidebar panels layouts quick switches */}
        <div className="flex items-center gap-1 bg-[#121215] p-1 rounded-md border border-[#25252B]">
          <button 
            onClick={() => setShowProjectBin(!showProjectBin)}
            className={`px-3 py-1 text-[10px] font-bold tracking-wider rounded uppercase transition-all duration-150 ${showProjectBin ? 'bg-[#2A2A35] text-white border border-[#3E3E4F]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Project Bin
          </button>
          <button 
            onClick={() => setShowSegmentsBin(!showSegmentsBin)}
            className={`px-3 py-1 text-[10px] font-bold tracking-wider rounded uppercase transition-all duration-150 ${showSegmentsBin ? 'bg-[#2A2A35] text-white border border-[#3E3E4F]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Segments Pool
          </button>
        </div>

        {/* Premiere-style Actions */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => exportToPremiereXML(cuts, clips, FPS)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-1.5 rounded text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Premiere XML
          </button>
          <button className="p-1.5 hover:bg-white/5 rounded text-gray-400">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Workspace Grid Container */}
      <main className="flex-1 flex overflow-hidden min-h-0 bg-[#0A0A0C]">
        
        {/* Project Bin Left-Sidebar */}
        <AnimatePresence initial={false}>
          {showProjectBin && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-[#25252B] bg-[#141418] flex flex-col h-full overflow-hidden shrink-0 z-30"
            >
              <div className="px-4 py-3 border-b border-[#25252B] flex items-center justify-between bg-[#19191E]">
                <span className="text-[10px] font-black tracking-[0.15em] text-gray-400 uppercase flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-blue-500" />
                  PROJECT MEDIA
                </span>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 hover:bg-white/5 rounded text-blue-400 transition-colors"
                  title="Import Video File"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Clip assets items */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
                {clips.map(clip => {
                  const isCurrent = currentClipId === clip.id;
                  return (
                    <div 
                      key={clip.id}
                      draggable
                      onDragStart={(e) => handleDragStartClip(e, clip.id)}
                      onClick={() => selectSourceClip(clip)}
                      className={`group p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all border ${isCurrent ? 'bg-[#22222E]/80 border-blue-500/40 text-white shadow-md' : 'hover:bg-[#1C1C22]/60 border-transparent text-gray-400'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-16 h-10 bg-black rounded overflow-hidden relative flex-shrink-0 border border-white/5">
                          {clip.url.startsWith("http") ? (
                            <div className="w-full h-full flex items-center justify-center bg-blue-500/10">
                              <Video className="w-4 h-4 text-blue-400" />
                            </div>
                          ) : (
                            <video src={clip.url} className="w-full h-full object-cover opacity-70" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-3 h-3 text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold truncate leading-tight">{clip.name}</p>
                          <p className="text-[9px] font-mono text-gray-500 mt-0.5">{formatTimecode(clip.duration)}</p>
                        </div>
                      </div>

                      {/* Quick track inserts buttons */}
                      <div className="grid grid-cols-2 gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); appendClipToTrack(clip, 0); }}
                          className="py-1 bg-[#1C1C22] hover:bg-blue-500/10 border border-[#2B2B33] hover:border-blue-500/30 rounded text-[9px] font-bold text-gray-300 hover:text-blue-400"
                        >
                          + Insert V1
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); appendClipToTrack(clip, 1); }}
                          className="py-1 bg-[#1C1C22] hover:bg-blue-500/10 border border-[#2B2B33] hover:border-blue-500/30 rounded text-[9px] font-bold text-gray-300 hover:text-blue-400"
                        >
                          + Insert V2
                        </button>
                      </div>
                    </div>
                  );
                })}

                {clips.length === 0 && (
                  <div className="h-48 flex flex-col items-center justify-center p-4 text-center opacity-10">
                    <Film className="w-10 h-10 mb-2" />
                    <span className="text-[10px] font-semibold tracking-wider">BIN EMPTY</span>
                  </div>
                )}
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                multiple 
                accept="video/*" 
                className="hidden" 
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Center Canvas Workspace: DUAL MONITOR setup */}
        <section className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar p-3 gap-3">
          
          {/* Dual Source and Program Monitor block */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[300px] flex-shrink-0">
            
            {/* 1. LEFT: SOURCE MONITOR (In/Out selectors) */}
            <div className="bg-[#141418] border border-[#25252B] rounded-lg overflow-hidden flex flex-col shadow-lg">
              <div className="px-3 py-1.5 border-b border-[#25252B] bg-[#19191E] flex items-center justify-between text-[10px] font-bold tracking-wider text-gray-400">
                <span className="uppercase text-blue-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  Source Monitor: [In-Out Clipper]
                </span>
                <span className="font-mono text-gray-500 truncate max-w-[170px]">{currentSourceClip?.name || "No Asset"}</span>
              </div>

              {/* Video Player Display */}
              <div className="flex-1 bg-black relative flex items-center justify-center min-h-[170px] border-b border-[#202025]">
                <video 
                  ref={sourceVideoRef}
                  onTimeUpdate={() => setSourceTime(sourceVideoRef.current?.currentTime || 0)}
                  className="w-full h-full max-h-[220px] object-contain"
                  onPlay={() => setIsSourcePlaying(true)}
                  onPause={() => setIsSourcePlaying(false)}
                />

                {/* Markers overlays on source display */}
                {markIn !== null && (
                  <div className="absolute top-2 left-2 bg-blue-500/90 backdrop-blur-md text-white font-mono text-[9px] font-bold rounded px-1.5 py-0.5 border border-blue-400/20">
                    [{formatTimecode(markIn)}
                  </div>
                )}
                {markOut !== null && (
                  <div className="absolute top-2 right-2 bg-red-500/90 backdrop-blur-md text-white font-mono text-[9px] font-bold rounded px-1.5 py-0.5 border border-red-400/20">
                    {formatTimecode(markOut)}]
                  </div>
                )}

                {/* HUD Source Timecode */}
                <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 border border-white/5 rounded font-mono text-[10px] tracking-widest text-blue-400">
                  {formatTimecode(sourceTime)}
                </div>

                {!currentClipId && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-black/90">
                    <Film className="w-8 h-8 mb-2 opacity-20" />
                    <span className="text-[9px] tracking-widest uppercase">Select Asset from Project Bin</span>
                  </div>
                )}
              </div>

              {/* Source Controls */}
              <div className="p-3 bg-[#16161C] space-y-2">
                
                {/* Scrub Slider */}
                <div className="relative h-1 bg-[#2D2D35] rounded-full overflow-hidden cursor-pointer group">
                  <div 
                    className="absolute inset-y-0 left-0 bg-blue-500"
                    style={{ width: `${(sourceTime / (currentSourceClip?.duration || 1)) * 100}%` }}
                  />
                  {markIn !== null && (
                    <div 
                      className="absolute inset-y-0 bg-blue-400 w-0.5" 
                      style={{ left: `${(markIn / (currentSourceClip?.duration || 1)) * 100}%` }}
                    />
                  )}
                  {markOut !== null && (
                    <div 
                      className="absolute inset-y-0 bg-red-400 w-0.5" 
                      style={{ left: `${(markOut / (currentSourceClip?.duration || 1)) * 100}%` }}
                    />
                  )}
                  <input 
                    type="range"
                    min={0}
                    max={currentSourceClip?.duration || 100}
                    step={0.05}
                    value={sourceTime}
                    onChange={(e) => {
                      if (sourceVideoRef.current) sourceVideoRef.current.currentTime = parseFloat(e.target.value);
                    }}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>

                {/* Controls Bar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => scrubSource(-3)}
                      className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white"
                      title="Back 3s"
                    >
                      <Rewind className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={toggleSourcePlay}
                      className="w-7 h-7 bg-blue-600 hover:bg-blue-500 rounded text-white flex items-center justify-center"
                    >
                      {isSourcePlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />}
                    </button>
                    <button 
                      onClick={() => scrubSource(3)}
                      className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white"
                      title="Forward 3s"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Redirection Markers (Set In point / Set Out Point) */}
                  <div className="flex items-center gap-1.5 bg-[#121215] p-1 rounded border border-[#2D2D35]">
                    <button 
                      onClick={setIn}
                      className="px-2 py-0.5 rounded text-[9px] font-black uppercase text-blue-400 hover:bg-white/5"
                      title="Set In Marker [I]"
                    >
                      Mark IN [I]
                    </button>
                    <div className="w-px h-3 bg-white/10" />
                    <button 
                      onClick={setOut}
                      className="px-2 py-0.5 rounded text-[9px] font-black uppercase text-red-400 hover:bg-white/5"
                      title="Set Out Marker [O]"
                    >
                      Mark OUT [O]
                    </button>
                  </div>

                  {/* Put to Timeline */}
                  <button 
                    onClick={insertCutAtPlayhead}
                    className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-[9px] rounded flex items-center gap-1 uppercase"
                    title="Insert current marked clip onto sequence track"
                  >
                    <Layers className="w-3 h-3" />
                    Insert Clip [V{selectedTrack+1}]
                  </button>
                </div>
              </div>
            </div>

            {/* 2. RIGHT: PROGRAM SEQUENCE MONITOR (Composite player) */}
            <div className="bg-[#141418] border border-[#25252B] rounded-lg overflow-hidden flex flex-col shadow-lg">
              <div className="px-3 py-1.5 border-b border-[#25252B] bg-[#19191E] flex items-center justify-between text-[10px] font-bold tracking-wider text-gray-400">
                <span className="uppercase text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Program Monitor: [Master Sequence]
                </span>
                <span className="text-gray-500 uppercase font-bold tracking-widest text-[8px] bg-white/5 px-1 py-0.5 rounded">OUTPUT COMPOSTER</span>
              </div>

              {/* Video Composite Display */}
              <div className="flex-1 bg-black relative flex items-center justify-center min-h-[170px] border-b border-[#202025]">
                <video 
                  ref={programVideoRef}
                  className="w-full h-full max-h-[220px] object-contain pointer-events-none"
                />

                {/* HUD Master sequence timecode */}
                <div className="absolute bottom-2 left-2 bg-black/90 border border-white/5 rounded px-2 py-1 flex items-center gap-1.5 text-xs sm:text-sm font-black font-mono tracking-widest text-emerald-400 shadow-md">
                  <span className="text-[9px] text-gray-500">PLAYHEAD:</span>
                  {formatTimecode(sequenceTime)}
                </div>

                {/* DB peak level vertical indicator overlay next to the monitor (Adds supreme Premiere Pro vibe!) */}
                <div className="absolute right-2 top-2 bottom-2 w-1.5 bg-gray-950/80 rounded border border-white/5 p-0.2 flex flex-col justify-end overflow-hidden">
                  <div 
                    className={`w-full rounded-sm transition-all duration-100 ${isSequencePlaying ? 'h-[60%] bg-gradient-to-t from-green-500 via-yellow-500 to-red-500' : 'h-1 bg-green-500'}`} 
                  />
                </div>

                {/* Overlay indicating which track is displaying */}
                {getActiveCutAtTime(sequenceTime) && (
                  <div className="absolute top-2 left-2 bg-emerald-500/95 text-black px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase">
                    V{getActiveCutAtTime(sequenceTime)!.track + 1} LIVE COMP
                  </div>
                )}

                {cuts.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-black/90">
                    <Layers className="w-8 h-8 mb-2 opacity-20" />
                    <span className="text-[9px] tracking-widest uppercase">Timeline Sequence is Currently Empty</span>
                  </div>
                )}
              </div>

              {/* Program Output Controls */}
              <div className="p-3 bg-[#16161C] space-y-2">
                
                {/* Master Sequence Seek Slider */}
                <div className="relative h-1 bg-[#2D2D35] rounded-full overflow-hidden cursor-pointer group">
                  <div 
                    className="absolute inset-y-0 left-0 bg-emerald-500"
                    style={{ width: `${(sequenceTime / Math.max(1, totalSequenceDuration)) * 100}%` }}
                  />
                  <input 
                    type="range"
                    min={0}
                    max={Math.max(1, totalSequenceDuration)}
                    step={0.05}
                    value={sequenceTime}
                    onChange={(e) => setSequenceTime(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer animate-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => scrubSequence(-5)}
                      className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white"
                      title="Back 5s [J]"
                    >
                      <Rewind className="w-3.5 h-3.5" />
                    </button>
                    
                    <button 
                      onClick={toggleSequencePlay}
                      className="w-10 h-7 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-bold flex items-center justify-center hover:scale-[1.03] transition-transform"
                      title="Play/Pause Timeline [K / Space]"
                    >
                      {isSequencePlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />}
                    </button>

                    <button 
                      onClick={() => scrubSequence(5)}
                      className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white"
                      title="Forward 5s [L]"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Volume Seek bar */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsMuted(!isMuted)} className="text-gray-500 hover:text-white">
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <input 
                      type="range" min="0" max="1" step="0.1" value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-14 sm:w-20 accent-emerald-500 h-1 rounded cursor-pointer"
                    />
                  </div>

                  {/* Speed Playback modifier */}
                  <div>
                    <select 
                      value={playbackRate}
                      onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                      className="bg-[#121215] border border-[#2D2D35] rounded px-2 py-0.5 text-[9px] font-bold text-gray-400 outline-none outline-0"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1.0x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2.0x</option>
                    </select>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Quick Info & Warnings / Shortcut Help Strip */}
          <div className="bg-[#121215] border border-[#23232A] rounded px-4 py-2 text-[10px] text-gray-500 flex flex-wrap gap-4 items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>Pro Keyboard Controls: <kbd className="bg-white/5 px-1 py-0.2 rounded border border-white/10 text-white select-none">Space</kbd> / <kbd className="bg-white/5 px-1 py-0.2 rounded border border-white/10 text-white select-none">K</kbd> Play Sequence • <kbd className="bg-white/5 px-1 py-0.2 rounded border border-white/10 text-white select-none">J</kbd> Back 5s • <kbd className="bg-white/5 px-1 py-0.2 rounded border border-white/10 text-white select-none">L</kbd> Forward 5s • <kbd className="bg-white/5 px-1 py-0.2 rounded border border-white/10 text-white select-none">I</kbd>/<kbd className="bg-white/5 px-1 py-0.2 rounded border border-white/10 text-white select-none">O</kbd> Source Markers</span>
            </div>
            
            {/* Active insertion track selector */}
            <div className="flex items-center gap-1">
              <span className="opacity-50 font-bold uppercase tracking-tight mr-1 bg-[#1A1A22] block px-1 py-0.2 rounded text-[7px] text-gray-400">Insert Target Track:</span>
              <button 
                onClick={() => setSelectedTrack(0)}
                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors ${selectedTrack === 0 ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}
              >
                Track V1
              </button>
              <button 
                onClick={() => setSelectedTrack(1)}
                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors ${selectedTrack === 1 ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}
              >
                Track V2
              </button>
            </div>
          </div>
        </section>

        {/* Right Segments / Cuts panel */}
        <AnimatePresence initial={false}>
          {showSegmentsBin && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-[#25252B] bg-[#141418] flex flex-col h-full overflow-hidden shrink-0 z-30"
            >
              <div className="px-4 py-3 border-b border-[#25252B] bg-[#19191E] flex items-center justify-between">
                <span className="text-[10px] font-black tracking-[0.15em] text-gray-400 uppercase flex items-center gap-1.5">
                  <List className="w-3.5 h-3.5 text-blue-500" />
                  SEGMENTS LIST
                </span>
                <span className="bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.2 rounded-full text-[9px] font-black text-blue-400">
                  {cuts.length} Active
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar bg-black/10">
                <AnimatePresence mode="popLayout">
                  {cuts.map((cut, index) => (
                    <motion.div 
                      key={cut.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, x: 20 }}
                      className="group bg-[#1D1D24] border border-[#2B2B33] rounded overflow-hidden flex"
                    >
                      <div className="w-1 h-full select-none" style={{ backgroundColor: cut.color }} />
                      <div className="flex-1 p-2 min-w-0 pr-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[7px] font-black text-blue-400 uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 px-1 py-0.2 rounded">
                              TRACK V{cut.track + 1}
                            </span>
                            <span className="text-[8px] text-gray-600 font-bold">#{index+1}</span>
                          </div>
                          <p className="text-[10px] font-bold text-white truncate group-hover:text-blue-400 transition-colors">{cut.clipName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 text-[9px] text-gray-500 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Start: {formatTimecode(cut.startTime)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col border-l border-[#2B2B33] bg-[#121215]/30">
                        <button 
                          onClick={() => setSequenceTime(cut.startTime)}
                          className="flex-1 w-8 flex items-center justify-center text-gray-500 hover:text-white"
                          title="Seek sequence timeline to this clip"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                        <button 
                          onClick={() => deleteCut(cut.id)}
                          className="flex-1 w-8 border-t border-[#2B2B33] flex items-center justify-center text-gray-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {cuts.length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-center opacity-10">
                    <Scissors className="w-10 h-10 mb-2" />
                    <span className="text-[10px] uppercase font-bold">No Cuts Created</span>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER: Professional Non-Linear NLE timeline */}
      <footer className="h-64 border-t border-[#25252B] bg-[#121216] flex flex-col shadow-inner shrink-0 z-40 select-none">
        
        {/* Timeline controller statistics */}
        <div className="h-8 border-b border-[#25252B] flex items-center justify-between px-5 bg-[#16161C] shrink-0">
          <div className="flex items-center gap-4 text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Layout className="w-3.5 h-3.5" />
              TIMELINE SEQUENCER TRACK ASSEMBLY
            </span>
            <div className="h-3 w-px bg-[#25252B]" />
            <span className="opacity-45">Timing:</span>
            <span className="text-white font-mono">{FPS} Frames / Sec</span>
          </div>

          {/* MASTER SEQUENCE DURATION BADGE */}
          <div className="bg-black/60 px-3 py-1.5 rounded border border-white/5 flex items-center gap-2 transform -scale-y-100">
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">SEQUENCE TOTAL DUR:</span>
            <span className="text-xs font-bold text-green-400 font-mono tracking-widest">
              {formatTimecode(totalSequenceDuration)}
            </span>
          </div>
        </div>

        {/* NLE tracks assembly area: sticky labels + horizontal track viewport */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Sticky Left Headers */}
          <div className="w-20 bg-[#16161B] border-r border-[#25252B] flex flex-col z-20 shrink-0 shadow-lg text-[9px] font-extrabold uppercase select-none">
            {/* Ruler label spacing */}
            <div className="h-6 border-b border-[#25252B] bg-black/40 flex items-center justify-center text-gray-600">
              TIMECODE
            </div>
            {/* Track V2 overlay */}
            <div className="flex-1 border-b border-[#202025] flex flex-col items-center justify-center bg-[#17171E] group relative hover:bg-[#1E1E26] transition-colors p-1">
              <span className="text-blue-400">Track 2</span>
              <span className="text-[7px] text-gray-500 tracking-tighter mt-0.5">V2 OVERLAY</span>
            </div>
            {/* Track V1 primary */}
            <div className="flex-1 flex flex-col items-center justify-center bg-[#14141A] group relative hover:bg-[#1E1E26] transition-colors p-1">
              <span className="text-blue-400">Track 1</span>
              <span className="text-[7px] text-gray-500 tracking-tighter mt-0.5">V1 PRIMARY</span>
            </div>
          </div>

          {/* Draggable tracks block layout on the right */}
          <div className="flex-1 overflow-x-auto custom-scrollbar relative bg-[#08080A]">
            
            {/* Shared Master Coordinates Container (ruler horizontal stretch determines grid size) */}
            <div 
              className="relative py-2 flex flex-col h-full shrink-0 select-none pb-4"
              style={{ width: `${Math.max(1600, (totalSequenceDuration + 25) * ZOOM_PIXELS_PER_SECOND)}px` }}
            >
              
              {/* Vertical Scrubbing Red Playhead overlay bar */}
              <div 
                className="absolute top-0 bottom-0 w-px bg-red-500 cursor-ew-resize py-2 z-30 pointer-events-none"
                style={{ left: `${sequenceTime * ZOOM_PIXELS_PER_SECOND}px` }}
              >
                {/* Red pin point marker handle at ruler location */}
                <div className="absolute top-0 -translate-x-1/2 w-3.5 h-4 bg-red-500 rounded-b-md shadow-lg flex items-center justify-center border border-red-400">
                  <div className="w-0.5 h-1.5 bg-white/60" />
                </div>
              </div>

              {/* TIMING RULER (Draggable & Clickable) */}
              <div 
                onMouseDown={handleRulerScrub}
                className="h-6 border-b border-[#25252B] bg-[#0E0E12] relative text-[8px] font-mono text-gray-500 overflow-hidden shrink-0 select-none cursor-ew-resize"
              >
                {Array.from({ length: Math.ceil(Math.max(80, totalSequenceDuration + 40) / 2) }).map((_, i) => {
                  const seconds = i * 2;
                  const leftPos = seconds * ZOOM_PIXELS_PER_SECOND;
                  return (
                    <div key={seconds} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${leftPos}px` }}>
                      <div className="h-1.5 w-px bg-white/10" />
                      <span className="mb-0.5 tracking-tighter text-white/30 transform -translate-x-1/2">{seconds}s</span>
                    </div>
                  );
                })}
              </div>

              {/* Tracks strip containers (V2 first, V1 second) */}
              <div className="flex-1 flex flex-col py-1 gap-2 relative">
                
                {[1, 0].map(trackIdx => {
                  const trackCuts = cuts.filter(c => c.track === trackIdx);
                  
                  return (
                    <div 
                      key={trackIdx}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnTrack(e, trackIdx)}
                      className={`relative flex-1 w-full bg-white/[0.015] border-y border-[#18181E] transition-all flex items-center overflow-hidden`}
                    >
                      {trackCuts.map(cut => {
                        const duration = cut.out - cut.in;
                        const isDraggingSelf = draggingCutId === cut.id;
                        
                        return (
                          <div
                            key={cut.id}
                            draggable
                            onDragStart={(e) => handleDragStartCut(e, cut)}
                            className={`absolute h-[85%] rounded border flex items-center transition-shadow shadow cursor-grab active:cursor-grabbing hover:shadow-lg ${isDraggingSelf ? 'opacity-35' : ''}`}
                            style={{ 
                              left: `${cut.startTime * ZOOM_PIXELS_PER_SECOND}px`,
                              width: `${Math.max(40, duration * ZOOM_PIXELS_PER_SECOND)}px`,
                              backgroundColor: cut.color,
                              borderColor: `rgba(255, 255, 255, 0.25)`
                            }}
                          >
                            {/* Inner clip gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />

                            {/* Left trim handle */}
                            <div 
                              onMouseDown={(e) => handleTrimStart(e, cut.id, 'in')}
                              className="absolute inset-y-0 left-0 w-1.5 hover:w-2 hover:bg-white active:bg-blue-300 bg-black/35 cursor-ew-resize transition-all z-20"
                              title="Trim Clip In-point (Drag)"
                            />

                            {/* Center Cut Details */}
                            <div className="px-1.5 min-w-0 pr-3 pointer-events-none select-none z-10 flex flex-col justify-center h-full text-left leading-none">
                              <span className="text-[9px] font-extrabold text-white truncate drop-shadow-sm uppercase">
                                {cut.clipName}
                              </span>
                              <span className="text-[7.5px] font-semibold font-mono text-white/70 tracking-tighter mt-0.5">
                                {formatTimecode(duration)}
                              </span>
                            </div>

                            {/* Right trim handle */}
                            <div 
                              onMouseDown={(e) => handleTrimStart(e, cut.id, 'out')}
                              className="absolute inset-y-0 right-0 w-1.5 hover:w-2 hover:bg-white active:bg-blue-300 bg-black/35 cursor-ew-resize transition-all z-20"
                              title="Trim Clip Out-point (Drag)"
                            />
                          </div>
                        );
                      })}

                      {trackCuts.length === 0 && (
                        <div className="absolute inset-0 flex items-center pl-6 pointer-events-none opacity-10">
                          <span className="text-[8px] font-black uppercase tracking-wider font-mono">TRACK EMPTY: DRAG MEDIA HERE</span>
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>

            </div>

          </div>
        </div>
      </footer>

      {/* Styled custom Scrollbars */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 9px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.4);
        }
      `}} />
    </div>
  );
}
