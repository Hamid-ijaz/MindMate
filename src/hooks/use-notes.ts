"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useOffline } from '@/contexts/offline-context';
import { indexedDBService } from '@/lib/indexeddb';
import { toast } from 'sonner';

export interface Note {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  isLocal?: boolean;
  syncStatus?: 'synced' | 'pending' | 'failed';
  isPinned?: boolean;
  isArchived?: boolean;
}

export function useNotes() {
  const { user } = useAuth();
  const { isOnline, isServerReachable, addOfflineAction } = useOffline();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFullyOnline = isOnline && isServerReachable;

  // Load notes from IndexedDB or API
  const loadNotes = useCallback(async () => {
    if (!user?.email) {
      setNotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isFullyOnline) {
        // Try to fetch from API first
        try {
          const response = await fetch('/api/notes');
          if (response.ok) {
            const apiNotes = await response.json();
            // Update local storage
            await indexedDBService.syncNotes(user.email, apiNotes);
            setNotes(apiNotes);
            return;
          }
        } catch (apiError) {
          console.warn('API fetch failed, falling back to local data:', apiError);
        }
      }

      // Fallback to local data
      const localNotes = await indexedDBService.getNotes(user.email);
      setNotes(localNotes);

      if (!isFullyOnline && localNotes.length > 0) {
        toast.info('Showing cached notes (offline mode)');
      }
    } catch (err) {
      setError('Failed to load notes');
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.email, isFullyOnline]);

  // Create a new note
  const createNote = useCallback(async (noteData: Omit<Note, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.email) return null;

    const newNote: Note = {
      ...noteData,
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: isFullyOnline ? 'synced' : 'pending',
      isLocal: !isFullyOnline
    };

    try {
      // Always save to local storage first
      await indexedDBService.createNote(user.email, newNote);
      setNotes(prev => [newNote, ...prev]);

      if (isFullyOnline) {
        // Try to sync to server
        try {
          const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newNote)
          });

          if (!response.ok) {
            throw new Error('Server sync failed');
          }

          const serverNote = await response.json();
          // Update local note with server ID
          await indexedDBService.updateNote(user.email, serverNote.id, {
            ...serverNote,
            syncStatus: 'synced',
            isLocal: false
          });
          
          setNotes(prev => prev.map(n => n.id === newNote.id ? serverNote : n));
        } catch (syncError) {
          // Queue for offline sync
          await addOfflineAction({
            type: 'CREATE_NOTE',
            data: newNote,
            timestamp: Date.now()
          });
          
          toast.warning('Note created offline, will sync when connected');
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'CREATE_NOTE',
          data: newNote,
          timestamp: Date.now()
        });
        
        toast.success('Note created offline');
      }

      return newNote;
    } catch (err) {
      setError('Failed to create note');
      console.error('Error creating note:', err);
      return null;
    }
  }, [user?.email, isFullyOnline, addOfflineAction]);

  // Update a note
  const updateNote = useCallback(async (noteId: string, updates: Partial<Note>) => {
    if (!user?.email) return false;

    try {
      const updatedNote = {
        ...updates,
        id: noteId,
        updatedAt: new Date(),
        syncStatus: isFullyOnline ? 'synced' : 'pending'
      };

      // Update local storage first
      await indexedDBService.updateNote(user.email, noteId, updatedNote);
      setNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, ...updatedNote } : note
      ));

      if (isFullyOnline) {
        // Try to sync to server
        try {
          const response = await fetch(`/api/notes/${noteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedNote)
          });

          if (!response.ok) {
            throw new Error('Server sync failed');
          }
        } catch (syncError) {
          // Queue for offline sync
          await addOfflineAction({
            type: 'UPDATE_NOTE',
            data: { id: noteId, ...updatedNote },
            timestamp: Date.now()
          });
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'UPDATE_NOTE',
          data: { id: noteId, ...updatedNote },
          timestamp: Date.now()
        });
      }

      return true;
    } catch (err) {
      setError('Failed to update note');
      console.error('Error updating note:', err);
      return false;
    }
  }, [user?.email, isFullyOnline, addOfflineAction]);

  // Delete a note
  const deleteNote = useCallback(async (noteId: string) => {
    if (!user?.email) return false;

    try {
      // Remove from local storage first
      await indexedDBService.deleteNote(user.email, noteId);
      setNotes(prev => prev.filter(note => note.id !== noteId));

      if (isFullyOnline) {
        // Try to sync to server
        try {
          const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            throw new Error('Server sync failed');
          }
        } catch (syncError) {
          // Queue for offline sync
          await addOfflineAction({
            type: 'DELETE_NOTE',
            data: { id: noteId },
            timestamp: Date.now()
          });
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'DELETE_NOTE',
          data: { id: noteId },
          timestamp: Date.now()
        });
      }

      return true;
    } catch (err) {
      setError('Failed to delete note');
      console.error('Error deleting note:', err);
      return false;
    }
  }, [user?.email, isFullyOnline, addOfflineAction]);

  // Pin/Unpin a note
  const togglePin = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return false;

    return updateNote(noteId, { isPinned: !note.isPinned });
  }, [notes, updateNote]);

  // Archive/Unarchive a note
  const toggleArchive = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return false;

    return updateNote(noteId, { isArchived: !note.isArchived });
  }, [notes, updateNote]);

  // Get notes by category
  const getNotesByCategory = useCallback((category?: string) => {
    if (!category) {
      return notes.filter(note => !note.category);
    }
    return notes.filter(note => note.category === category);
  }, [notes]);

  // Get pinned notes
  const getPinnedNotes = useCallback(() => {
    return notes.filter(note => note.isPinned && !note.isArchived);
  }, [notes]);

  // Get archived notes
  const getArchivedNotes = useCallback(() => {
    return notes.filter(note => note.isArchived);
  }, [notes]);

  // Get active notes (not archived)
  const getActiveNotes = useCallback(() => {
    return notes.filter(note => !note.isArchived);
  }, [notes]);

  // Search notes
  const searchNotes = useCallback((query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return notes.filter(note => 
      !note.isArchived && (
        note.title.toLowerCase().includes(lowercaseQuery) ||
        note.content.toLowerCase().includes(lowercaseQuery) ||
        note.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
      )
    );
  }, [notes]);

  // Get all unique categories
  const getCategories = useCallback(() => {
    const categories = new Set<string>();
    notes.forEach(note => {
      if (note.category) {
        categories.add(note.category);
      }
    });
    return Array.from(categories).sort();
  }, [notes]);

  // Get all unique tags
  const getTags = useCallback(() => {
    const tags = new Set<string>();
    notes.forEach(note => {
      note.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [notes]);

  // Load notes on mount and when dependencies change
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    toggleArchive,
    getNotesByCategory,
    getPinnedNotes,
    getArchivedNotes,
    getActiveNotes,
    searchNotes,
    getCategories,
    getTags,
    refreshNotes: loadNotes,
    isOffline: !isFullyOnline
  };
}
