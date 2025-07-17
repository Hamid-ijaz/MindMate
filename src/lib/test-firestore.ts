/**
 * Test script to verify Firebase Firestore connection
 * Run this in the browser console to test the connection
 */

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

export const testFirestoreConnection = async () => {
  try {
    console.log('🔥 Testing Firestore connection...');
    
    // Test 1: Add a test document
    console.log('📝 Adding test document...');
    const testCollection = collection(db, 'test');
    const docRef = await addDoc(testCollection, {
      message: 'Hello Firestore!',
      timestamp: new Date(),
      testField: 'MindMate Firebase Test'
    });
    console.log('✅ Test document added with ID:', docRef.id);
    
    // Test 2: Read the test document
    console.log('📖 Reading test documents...');
    const querySnapshot = await getDocs(testCollection);
    querySnapshot.forEach((doc) => {
      console.log('📄 Document:', doc.id, '=>', doc.data());
    });
    
    // Test 3: Delete the test document
    console.log('🗑️ Cleaning up test document...');
    await deleteDoc(doc(db, 'test', docRef.id));
    console.log('✅ Test document deleted');
    
    console.log('🎉 Firestore connection test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Firestore connection test failed:', error);
    return false;
  }
};

// Auto-run test if in development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('MindMate Firebase Test Utils loaded. Run testFirestoreConnection() to test connection.');
}
