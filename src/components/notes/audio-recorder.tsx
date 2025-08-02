"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Play, Pause, Trash2, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface AudioRecorderProps {
  onAudioSave: (audioBlob: Blob, audioUrl: string) => void;
  onAudioDelete?: () => void;
  existingAudioUrl?: string;
  maxDuration?: number; // in seconds
  maxFileSize?: number; // in MB
}

export function AudioRecorder({ 
  onAudioSave, 
  onAudioDelete, 
  existingAudioUrl,
  maxDuration = 300, // 5 minutes default
  maxFileSize = 10 // 10MB default
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>(existingAudioUrl || '');
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileSize, setFileSize] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioUrl && !existingAudioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, existingAudioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const size = audioBlob.size / (1024 * 1024); // Convert to MB
        
        if (size > maxFileSize) {
          toast({
            title: "File too large",
            description: `Audio file size (${size.toFixed(1)}MB) exceeds the ${maxFileSize}MB limit.`,
            variant: "destructive"
          });
          return;
        }

        setFileSize(size);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        onAudioSave(audioBlob, url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000); // Capture every second
      setIsRecording(true);
      setDuration(0);
      setRecordingProgress(0);
      
      // Start the timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          setRecordingProgress((newDuration / maxDuration) * 100);
          
          // Auto-stop at max duration
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          
          return newDuration;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const deleteAudio = () => {
    if (audioUrl && !existingAudioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl('');
    setDuration(0);
    setRecordingProgress(0);
    setFileSize(0);
    setIsPlaying(false);
    onAudioDelete?.();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an audio file.",
        variant: "destructive"
      });
      return;
    }

    const size = file.size / (1024 * 1024);
    if (size > maxFileSize) {
      toast({
        title: "File too large",
        description: `File size (${size.toFixed(1)}MB) exceeds the ${maxFileSize}MB limit.`,
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setFileSize(size);
    
    // Get duration
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      setDuration(Math.floor(audio.duration));
      setIsProcessing(false);
    };
    
    onAudioSave(file, url);
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `voice-note-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Voice Recording</span>
          </div>
          {fileSize > 0 && (
            <Badge variant="outline" className="text-xs">
              {fileSize.toFixed(1)}MB
            </Badge>
          )}
        </div>

        {/* Recording Progress */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-500 animate-pulse">● Recording</span>
                <span>{formatTime(duration)} / {formatTime(maxDuration)}</span>
              </div>
              <Progress value={recordingProgress} className="h-2" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audio Player */}
        {audioUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="hidden"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={isPlaying ? pauseAudio : playAudio}
                  disabled={isProcessing}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {duration > 0 ? formatTime(duration) : 'Loading...'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={downloadAudio}
                  title="Download audio"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={deleteAudio}
                  className="text-destructive hover:text-destructive"
                  title="Delete audio"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Controls */}
        {!audioUrl && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isRecording ? "destructive" : "default"}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className="flex-1"
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              title="Upload audio file"
            >
              <Upload className="w-4 h-4" />
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Instructions */}
        {!audioUrl && !isRecording && (
          <p className="text-xs text-muted-foreground text-center">
            Click to record or upload an audio file (max {maxFileSize}MB, {formatTime(maxDuration)})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
