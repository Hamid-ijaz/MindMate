"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Mic, MicOff, Plus, Edit3, Play, Pause, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '@/contexts/task-context';
import { cn } from '@/lib/utils';
import { Priority, TimeOfDay } from '@/lib/types';

interface VoiceTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialStream?: MediaStream | null;
}

export function VoiceTaskDialog({ isOpen, onClose, initialStream }: VoiceTaskDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [transcript, setTranscript] = useState('');
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  const { toast } = useToast();
  const { addTask, setIsSheetOpen, setPreFilledData } = useTasks();

  const maxDuration = 60; // 1 minute max for voice tasks

  useEffect(() => {
    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        setTranscript(finalTranscript + interimTranscript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };
      
      recognitionRef.current = recognition;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [audioUrl]);

  // Auto-start recording when dialog opens
  useEffect(() => {
    if (isOpen && !isRecording && !audioUrl) {
      startRecording();
    }
  }, [isOpen]);

  const startRecording = async () => {
    try {
      // Use provided initialStream if available (acquired on touchstart in AddTaskButton).
      const stream = initialStream ? initialStream : await navigator.mediaDevices.getUserMedia({ 
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
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks
        // If stream was provided by caller, we still stop tracks here to free microphone.
        try {
          stream.getTracks().forEach(track => track.stop());
        } catch (e) {
          // ignore
        }
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);
      setRecordingProgress(0);
      
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      
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
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  const playAudio = () => {
    if (audioUrl && audioRef.current) {
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

  const handleQuickAdd = async () => {
    if (!transcript.trim()) {
      toast({
        title: "No Content",
        description: "Please record something before adding the task.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const taskData = {
        title: transcript.trim(),
        description: '',
        category: 'Personal',
        priority: 'Medium' as Priority,
        duration: 30,
        timeOfDay: 'Morning' as TimeOfDay
      };
      
      await addTask(taskData as any);
      
      toast({
        title: "Task Added",
        description: "Your voice task has been added successfully.",
      });
      
      onClose();
      resetDialog();
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add the task. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditMore = () => {
    if (!transcript.trim()) {
      toast({
        title: "No Content",
        description: "Please record something before editing.",
        variant: "destructive"
      });
      return;
    }

    // Set pre-filled data with the transcript
    setPreFilledData({
      title: transcript.trim(),
      description: '',
      category: 'Personal',
      priority: 'Medium' as Priority,
      duration: 30,
      timeOfDay: 'Morning' as TimeOfDay
    });

    // Close this dialog and open the task sheet
    onClose();
    resetDialog();
    setIsSheetOpen(true);
  };

  const resetDialog = () => {
    setIsRecording(false);
    setIsPlaying(false);
    setDuration(0);
    setAudioUrl('');
    setTranscript('');
    setRecordingProgress(0);
    setIsProcessing(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Stop any initialStream tracks (safety) -- it may already be stopped elsewhere
    if (initialStream) {
      try {
        initialStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        resetDialog();
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Voice Task</DialogTitle>
          <DialogDescription>
            Record your task and we'll convert it to text automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recording Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                {/* Recording Animation */}
                <AnimatePresence>
                  {isRecording && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="relative"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 bg-red-500/20 rounded-full"
                      />
                      <div className="relative bg-red-500 rounded-full p-4">
                        <Mic className="h-8 w-8 text-white" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isRecording && !audioUrl && (
                  <Button
                    onClick={startRecording}
                    size="lg"
                    className="rounded-full h-16 w-16 bg-primary hover:bg-primary/90"
                  >
                    <Mic className="h-8 w-8" />
                  </Button>
                )}

                {/* Progress and Duration */}
                {isRecording && (
                  <div className="w-full space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{formatDuration(duration)}</span>
                      <span>{formatDuration(maxDuration)}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${recordingProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Recording Controls */}
                {isRecording && (
                  <Button
                    onClick={stopRecording}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Recording
                  </Button>
                )}

                {/* Playback Controls */}
                {audioUrl && !isRecording && (
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={isPlaying ? pauseAudio : playAudio}
                      variant="outline"
                      size="sm"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {isPlaying ? 'Pause' : 'Play'}
                    </Button>
                    
                    <Badge variant="secondary">
                      {formatDuration(duration)}
                    </Badge>
                  </div>
                )}

                {audioUrl && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transcript Display */}
          {transcript && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Transcript:</h4>
                  <p className="text-sm bg-muted p-3 rounded-md min-h-[60px]">
                    {transcript || "Listening..."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {audioUrl && transcript && (
            <div className="flex space-x-3">
              <Button
                onClick={handleQuickAdd}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleEditMore}
                variant="outline"
                className="flex-1"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit More
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
