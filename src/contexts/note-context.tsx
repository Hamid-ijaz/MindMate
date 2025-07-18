
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Note } from '@/lib/types';
import { noteService } from '@/lib/firestore';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';

interface NoteContextType {
  notes: Note[];
  isLoading: boolean;
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'userEmail'>) => Promise<string | undefined>;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'userEmail'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export const NoteProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      if (user?.email) {
        loadNotes();
      } else {
        setNotes([]);
        setIsLoading(false);
      }
    }
  }, [user, authLoading]);

  const loadNotes = async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const userNotes = await noteService.getNotes(user.email);
      setNotes(userNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast({
        title: "Error",
        description: "Failed to load your notes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'userEmail'>) => {
    if (!user?.email) return;
    try {
      const newNoteId = await noteService.addNote({ ...noteData, userEmail: user.email });
      const newNote: Note = {
          ...noteData,
          id: newNoteId,
          userEmail: user.email,
          createdAt: Date.now(),
          updatedAt: Date.now()
      };
      setNotes(prev => [newNote, ...prev]);
      return newNoteId;
    } catch (error) {
      console.error('Error adding note:', error);
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    }
  };

  const updateNote = async (id: string, updates: Partial<Omit<Note, 'id' | 'userEmail'>>) => {
    try {
      await noteService.updateNote(id, updates);
      setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } as Note : n)));
    } catch (error) {
      console.error('Error updating note:', error);
      toast({ title: "Error", description: "Failed to update note.", variant: "destructive" });
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await noteService.deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    }
  };

  return (
    <NoteContext.Provider value={{ notes, isLoading, addNote, updateNote, deleteNote }}>
      {children}
    </NoteContext.Provider>
  );
};

export const useNotes = (): NoteContextType => {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NoteProvider');
  }
  return context;
};
