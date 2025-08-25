
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Note } from '@/lib/types';
import { noteService } from '@/lib/firestore';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import { useOffline } from './offline-context';
import { indexedDBService } from '@/lib/indexeddb';

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
  const { isOnline, isServerReachable, addOfflineAction } = useOffline();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log('📝 NoteContext useEffect triggered - authLoading:', authLoading, 'user:', user?.email);
    if (!authLoading) {
      if (user?.email) {
        console.log('✅ User authenticated, loading notes...');
        loadNotes();
      } else {
        console.log('🚪 No user, clearing notes...');
        setNotes([]);
        setIsLoading(false);
      }
    }
  }, [user, authLoading, isOnline, isServerReachable]);

  const loadNotes = async () => {
    if (!user?.email) return;
    console.log('🔄 loadNotes called for user:', user.email);
    setIsLoading(true);
    const isFullyOnline = isOnline && isServerReachable;
    console.log('🌐 Notes connection status - Online:', isOnline, 'Server reachable:', isServerReachable, 'Fully online:', isFullyOnline);
    
    try {
      // Ensure IndexedDB is properly initialized before proceeding
      await indexedDBService.init();
      console.log('✅ IndexedDB initialized for notes');
      
      if (isFullyOnline) {
        try {
          console.log('📡 Attempting to load notes from server...');
          // Try to load from server first when online
          const userNotes = await noteService.getNotes(user.email);
          console.log('📊 Server notes loaded:', userNotes.length);
          setNotes(userNotes);
          // Cache notes in IndexedDB
          await indexedDBService.syncNotes(user.email, userNotes);
          console.log('💾 Notes synced to IndexedDB');
          return; // Success, we're done
        } catch (serverError) {
          console.warn('⚠️ Failed to load notes from server, falling back to offline cache:', serverError);
        }
      }

      // Fallback to offline cache
      console.log('📱 Loading notes from offline cache...');
      const cachedNotes = await indexedDBService.getNotes(user.email);
      console.log('💾 Cached notes loaded:', cachedNotes.length);
      setNotes(cachedNotes);

      if (!isFullyOnline && cachedNotes.length > 0) {
        toast({
          title: "Offline Mode",
          description: "Showing cached notes (offline mode)",
        });
      }
      
    } catch (error) {
      console.error('❌ Error loading notes:', error);
      toast({
        title: "Error",
        description: "Failed to load your notes.",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 loadNotes completed');
      setIsLoading(false);
    }
  };

  const addNote = async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'userEmail'>) => {
    if (!user?.email) return;
    
    const isFullyOnline = isOnline && isServerReachable;
    
    try {
      // Ensure IndexedDB is properly initialized before proceeding
      await indexedDBService.init();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      toast({
        title: "Storage Error",
        description: "Failed to initialize local storage. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    // Generate local note for immediate UI update
    const now = Date.now();
    const localId = `note_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const newNote: Note = {
      ...noteData,
      id: localId,
      userEmail: user.email,
      createdAt: now,
      updatedAt: now,
      syncStatus: isFullyOnline ? 'synced' : 'pending',
      isLocal: !isFullyOnline
    } as Note;

    // Optimistically update UI immediately
    setNotes(prev => [newNote, ...prev]);

    try {
      // Always save to IndexedDB first
      await indexedDBService.createNote(user.email, newNote);
      
      if (isFullyOnline) {
        try {
          // Try to sync to server
          const serverId = await noteService.addNote({ ...noteData, userEmail: user.email });
          
          // Update with server ID
          const serverNote = { ...newNote, id: serverId, syncStatus: 'synced', isLocal: false };
          await indexedDBService.updateNote(user.email, localId, serverNote);
          setNotes(prev => prev.map(n => n.id === localId ? serverNote : n));
          
          toast({
            title: "Note Created",
            description: "Note created successfully",
          });
          return serverId;
        } catch (syncError) {
          console.warn('Failed to sync note to server:', syncError);
          // Queue for offline sync
          await addOfflineAction({
            type: 'CREATE_NOTE',
            data: newNote,
            timestamp: Date.now()
          });
          
          toast({
            title: "Note Created Offline",
            description: "Note created offline, will sync when connected",
            variant: "default",
          });
          return localId;
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'CREATE_NOTE',
          data: newNote,
          timestamp: Date.now()
        });
        
        toast({
          title: "Note Created",
          description: "Note created offline",
        });
        return localId;
      }
    } catch (error) {
      console.error('Error adding note:', error);
      // Remove from UI on error
      setNotes(prev => prev.filter(n => n.id !== localId));
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    }
  };

  const updateNote = async (id: string, updates: Partial<Omit<Note, 'id' | 'userEmail'>>) => {
    if (!user?.email) return;

    const isFullyOnline = isOnline && isServerReachable;
    
    try {
      // Ensure IndexedDB is properly initialized before proceeding
      await indexedDBService.init();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      toast({
        title: "Storage Error",
        description: "Failed to initialize local storage. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    const updatedData = {
      ...updates,
      updatedAt: Date.now(),
      syncStatus: isFullyOnline ? 'synced' : 'pending'
    };

    // Optimistically update UI immediately
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...updatedData } as Note : n)));

    try {
      // Always update IndexedDB first
      await indexedDBService.updateNote(user.email, id, updatedData);
      
      if (isFullyOnline) {
        try {
          // Try to sync to server
          await noteService.updateNote(id, updates);
          
          // Update sync status on success
          const syncedData = { ...updatedData, syncStatus: 'synced', isLocal: false };
          await indexedDBService.updateNote(user.email, id, syncedData);
          setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...syncedData } as Note : n)));
          
        } catch (syncError) {
          console.warn('Failed to sync note update to server:', syncError);
          // Queue for offline sync
          await addOfflineAction({
            type: 'UPDATE_NOTE',
            data: { id, ...updatedData },
            timestamp: Date.now()
          });
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'UPDATE_NOTE',
          data: { id, ...updatedData },
          timestamp: Date.now()
        });
        
        toast({
          title: "Note Updated",
          description: "Note updated offline, will sync when connected",
        });
      }
    } catch (error) {
      console.error('Error updating note:', error);
      // Revert UI change on error
      setNotes(prev => prev.map(n => {
        if (n.id === id) {
          const { ...originalNote } = n;
          delete (originalNote as any).updatedAt;
          delete (originalNote as any).syncStatus;
          return originalNote;
        }
        return n;
      }));
      
      toast({ title: "Error", description: "Failed to update note.", variant: "destructive" });
    }
  };

  const deleteNote = async (id: string) => {
    if (!user?.email) return;

    const isFullyOnline = isOnline && isServerReachable;
    
    try {
      // Ensure IndexedDB is properly initialized before proceeding
      await indexedDBService.init();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      toast({
        title: "Storage Error",
        description: "Failed to initialize local storage. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    // Store original note for potential rollback
    const originalNote = notes.find(n => n.id === id);
    
    // Optimistically update UI immediately
    setNotes(prev => prev.filter(n => n.id !== id));

    try {
      // Always remove from IndexedDB first
      await indexedDBService.deleteNote(user.email, id);
      
      if (isFullyOnline) {
        try {
          // Try to sync deletion to server
          await noteService.deleteNote(id);
        } catch (syncError) {
          console.warn('Failed to sync note deletion to server:', syncError);
          // Queue for offline sync
          await addOfflineAction({
            type: 'DELETE_NOTE',
            data: { id },
            timestamp: Date.now()
          });
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'DELETE_NOTE',
          data: { id },
          timestamp: Date.now()
        });
        
        toast({
          title: "Note Deleted",
          description: "Note deleted offline, will sync when connected",
        });
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      // Rollback UI change on error
      if (originalNote) {
        setNotes(prev => [...prev, originalNote]);
      }
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
