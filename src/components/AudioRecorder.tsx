import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';

interface AudioRecorderProps {
  onAudioReady?: (blob: Blob) => void;
  onClear?: () => void;
  title?: string;
  description?: string;
}

type RecorderStatus = 'idle' | 'recording' | 'review';

export function AudioRecorder({ onAudioReady, onClear, title = 'Gravar áudio', description = 'Descreva sua experiência com suas próprias palavras' }: AudioRecorderProps) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Update recording timer
  useEffect(() => {
    if (status === 'recording') {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 250);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Update playback timer
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      const start = audioRef.current.currentTime;
      playbackTimerRef.current = setInterval(() => {
        setPlaybackTime(audioRef.current?.currentTime ?? start);
        if (audioRef.current && audioRef.current.ended) {
          setIsPlaying(false);
          setPlaybackTime(0);
        }
      }, 200);
    } else if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, []);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ['audio/mp4', 'audio/m4a', 'audio/webm'];
      const mime = preferred.find((m) => (MediaRecorder as any).isTypeSupported?.(m));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data?.size) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' });
        setAudioBlob(blob);
        setStatus('review');
        setDuration(Math.max(duration, Math.round(blob.size / 16000))); // rough fallback
        onAudioReady?.(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setStatus('recording');
      setDuration(0);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar a gravação. Verifique as permissões do microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePlayback = () => {
    if (!audioBlob) return;
    if (!audioRef.current) {
      const url = URL.createObjectURL(audioBlob);
      const audioEl = new Audio(url);
      audioRef.current = audioEl;
      audioEl.onended = () => setIsPlaying(false);
    }
    const audioEl = audioRef.current;
    if (audioEl.paused) {
      audioEl.play();
      setIsPlaying(true);
    } else {
      audioEl.pause();
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    setStatus('idle');
    setDuration(0);
    setPlaybackTime(0);
    setIsPlaying(false);
    setAudioBlob(null);
    setError('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    onClear?.();
  };

  const bars = Array.from({ length: 24 });
  const miniBars = Array.from({ length: 30 });

  return (
    <div className="w-full max-w-2xl mx-auto p-4 rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full flex flex-col items-center gap-3"
            >
              <div className="text-center space-y-1">
                <h3 className="font-medium text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>

              <Button
                variant="outline"
                size="lg"
                className="h-16 w-16 rounded-full border-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
                onClick={startRecording}
              >
                <Mic className="h-6 w-6 text-primary" />
              </Button>
            </motion.div>
          )}

          {status === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex flex-col items-center gap-4"
              style={{ minHeight: 220 }}
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-sm font-medium text-red-500">{formatTime(duration)}</span>
              </div>

              <div className="h-16 flex items-center justify-center gap-[5px] w-full px-8 overflow-hidden">
                {bars.map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 rounded-full bg-red-500"
                    animate={{
                      height: [14, 30, 18, 26, 22][i % 5],
                      opacity: [0.6, 1, 0.8],
                    }}
                    transition={{
                      duration: 0.55,
                      repeat: Infinity,
                      repeatType: 'mirror',
                      delay: i * 0.03,
                    }}
                    style={{ boxShadow: '0 0 8px rgba(239,68,68,0.35)' }}
                  />
                ))}
              </div>

              <div className="text-xs text-muted-foreground text-center">Gravando... Toque para finalizar</div>

              <button
                type="button"
                onClick={stopRecording}
                className="h-16 w-16 rounded-full shadow-md flex items-center justify-center text-white border-2 border-red-500"
                style={{ backgroundColor: '#ef4444' }}
                aria-label="Parar gravação"
              >
                <Square className="h-6 w-6 fill-current" />
              </button>
            </motion.div>
          )}

          {status === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full"
            >
              <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl border border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={togglePlayback}
                  disabled={!audioBlob}
                >
                  {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                </Button>

                <div className="flex-1 space-y-1.5">
                  <div className="h-6 flex items-center gap-[2px] opacity-60">
                    {miniBars.map((_, i) => {
                      const progress = duration ? playbackTime / duration : 0;
                      const indexProgress = i / miniBars.length;
                      const isPlayed = indexProgress <= progress;
                      return (
                        <div
                          key={i}
                          className={cn('w-1 rounded-full transition-colors duration-200', isPlayed ? 'bg-primary' : 'bg-primary/20')}
                          style={{ height: Math.max(4, Math.sin(i) * 12 + 12) }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-0.5">
                    <span>{formatTime(playbackTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={deleteRecording}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-center mt-3">
                <Button variant="ghost" size="sm" onClick={deleteRecording} className="text-xs text-muted-foreground h-auto py-1">
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Gravar novamente
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="text-xs text-red-600 text-center">{error}</p>}
      </div>
    </div>
  );
}
