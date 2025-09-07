# 🛠️ **CRITICAL FIX: Google Tasks Settings Being Wiped Out**

## 🚨 **Root Cause Identified**

The Google Tasks integration was **losing connection tokens** due to a critical bug in the `updateGoogleTasksSettings` method.

### **❌ The Problem**

**What was happening**:
1. OAuth callback saves complete settings (tokens, connection status, etc.)
2. Sync operation calls `updateGoogleTasksSettings` with **only** `syncStatus: 'syncing'`
3. Method **OVERWRITES entire settings object** with just the syncStatus field
4. **All tokens lost** → Connection appears disconnected on next API call

**Evidence from logs**:
```
✅ Settings saved successfully  (OAuth callback - tokens saved)
💾 Saving Google Tasks settings...  (Sync operation - only syncStatus)
❌ Google Tasks not connected  (Next API call - no tokens found)
```

### **🔧 The Fix**

**Changed** `updateGoogleTasksSettings` in `src/lib/firestore.ts`:

**Before (❌ Bug)**:
```typescript
const updateData = {
  ...settings,  // Only new partial data
  lastSyncAt: settings.lastSyncAt || Date.now()
};
```

**After (✅ Fixed)**:
```typescript
const updateData = {
  ...existingSettings,  // Start with ALL existing data
  ...settings,          // Override with new data
  lastSyncAt: settings.lastSyncAt || Date.now()
};
```

### **🎯 Impact**

**✅ What's Fixed**:
- ✅ **Tokens preserved** during sync status updates
- ✅ **Connection state stable** across API calls
- ✅ **Partial updates safe** - no data loss
- ✅ **Better logging** for debugging

**✅ Operations That Now Work**:
- ✅ **Manual sync** (tokens stay connected)
- ✅ **Automatic task sync** (connection remains stable)
- ✅ **Multiple API calls** (no more intermittent disconnections)

---

## 📋 **Problematic Calls That Are Now Safe**

### **1. Sync Status Updates**
```typescript
// This was WIPING OUT tokens - now safe
await googleTasksService.updateGoogleTasksSettings(userEmail, {
  syncStatus: 'syncing'  // Only updates syncStatus, preserves tokens
});
```

### **2. Error Status Updates**
```typescript
// This was WIPING OUT tokens - now safe
await googleTasksService.updateGoogleTasksSettings(userEmail, {
  syncStatus: 'error',
  lastError: 'Some error message'  // Preserves all other data
});
```

### **3. Token Refresh Updates**
```typescript
// This was OK before, still OK now
await googleTasksService.updateGoogleTasksSettings(userEmail, {
  accessToken: newToken,
  tokenExpiresAt: newExpiry  // Preserves other settings
});
```

---

## 🧪 **Testing Results Expected**

### **Before Fix** (❌):
```
1. Connect to Google → ✅ Success
2. Trigger sync → ❌ "Google Tasks not connected"  
3. Check connection → ❌ Shows disconnected
```

### **After Fix** (✅):
```
1. Connect to Google → ✅ Success
2. Trigger sync → ✅ Sync works properly
3. Check connection → ✅ Still connected
4. Create task → ✅ Syncs to Google Tasks
```

---

## 🔍 **Debug Logging Added**

The fix includes better logging to track settings updates:

```
💾 Updating Google Tasks settings: {
  isConnected: true,
  hasAccessToken: true,
  hasRefreshToken: true,
  syncStatus: 'syncing',
  // ... other preserved fields
}
```

---

## 🎉 **SOLUTION SUMMARY**

**✅ ROOT CAUSE**: Settings merge bug causing token data loss
**✅ FIX APPLIED**: Proper merging of existing + new settings  
**✅ IMPACT**: Google Tasks connection now stable across all operations
**✅ READY FOR**: Immediate testing - sync should work reliably

**🚀 Please test**: 
1. Connect to Google Tasks
2. Trigger manual sync
3. Create a new task
4. Verify all operations work without disconnection errors!
