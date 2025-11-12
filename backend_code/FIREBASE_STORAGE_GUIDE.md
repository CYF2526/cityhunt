# Firebase Storage Guide for Media Files

This guide explains how to use Firebase Storage to store and serve images and videos for City Hunt stages.

## Overview

Firebase Storage allows you to store media files (images, videos) directly in your Firebase project. This provides:
- Secure file storage
- Automatic CDN delivery
- Easy file management
- Integration with Firebase Console

## Step 1: Enable Firebase Storage

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **Get started**
5. Choose **Start in production mode** (we'll set security rules)
6. Select a storage location (preferably same as your other Firebase services)
7. Click **Done**

## Step 2: Set Up Security Rules

1. In Firebase Console, go to **Storage** > **Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read access to stage media
    match /stages/{stageId}/{allPaths=**} {
      allow read: if true;  // Public read for stage media
      allow write: if false; // Only admins can write (via console or Admin SDK)
    }
    
    // Optional: Allow authenticated users to read their group's media
    match /groups/{groupId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

3. Click **Publish**

**Note**: For production, you might want to restrict reads to authenticated users only. The above rules allow public read access for simplicity.

## Step 3: Upload Media Files

### Option A: Using Firebase Console (Easiest)

1. Go to **Storage** in Firebase Console
2. Click **Get started** if you haven't already
3. Click the folder icon or **Add file**
4. Create a folder structure:
   ```
   stages/
     stage1/
       image1.jpg
       video1.mp4
     stage2/
       image2.jpg
     ...
   ```
5. Upload your files
6. After upload, click on a file to see its details
7. Copy the **Download URL** (you'll need this for stage documents)

### Option B: Using Firebase CLI

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Upload files:
   ```bash
   firebase storage:upload ./local-image.jpg stages/stage1/image1.jpg
   ```

### Option C: Using Admin SDK (Programmatic)

Create a script to upload files programmatically:

```javascript
// upload-media.js
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

admin.initializeApp();

const bucket = admin.storage().bucket();

async function uploadFile(localFilePath, storagePath) {
  try {
    await bucket.upload(localFilePath, {
      destination: storagePath,
      metadata: {
        cacheControl: 'public, max-age=31536000', // 1 year cache
      },
    });
    
    // Get public URL
    const file = bucket.file(storagePath);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491', // Far future date
    });
    
    console.log(`Uploaded: ${storagePath}`);
    console.log(`URL: ${url}`);
    return url;
  } catch (error) {
    console.error(`Error uploading ${storagePath}:`, error);
    throw error;
  }
}

// Example usage
async function main() {
  const stage1Image = await uploadFile(
    './images/stage1-clue.jpg',
    'stages/stage1/clue.jpg'
  );
  console.log('Stage 1 image URL:', stage1Image);
}

main();
```

## Step 4: Get Public URLs

### Method 1: Using Firebase Console

1. Navigate to your file in Storage
2. Click on the file
3. Copy the **Download URL** from the file details
4. This URL looks like: `https://firebasestorage.googleapis.com/v0/b/PROJECT_ID.appspot.com/o/stages%2Fstage1%2Fimage.jpg?alt=media&token=TOKEN`

### Method 2: Using gsutil (Google Cloud Storage)

```bash
gsutil ls gs://PROJECT_ID.appspot.com/stages/stage1/
gsutil cp local-image.jpg gs://PROJECT_ID.appspot.com/stages/stage1/image.jpg
```

### Method 3: Get URL Programmatically

If you need to generate URLs dynamically in Cloud Functions:

```javascript
// In your Cloud Function
const admin = require('firebase-admin');
const bucket = admin.storage().bucket();

async function getPublicUrl(storagePath) {
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-09-2491', // Far future
  });
  return url;
}

// Or get the public URL directly (if file is public)
function getPublicUrlDirect(storagePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
}
```

## Step 5: Update Stage Documents

Use the Firebase Storage URLs in your Firestore stage documents:

### Example Stage with Firebase Storage Media

```javascript
{
  stageId: 1,
  stageName: "The First Clue",
  title: "Welcome to City Hunt!",
  description: "Look at this image carefully. What do you see?",
  media: [
    {
      type: "image",
      url: "https://firebasestorage.googleapis.com/v0/b/YOUR_PROJECT_ID.appspot.com/o/stages%2Fstage1%2Fclue.jpg?alt=media&token=TOKEN",
      alt: "First clue image"
    }
  ],
  mediaType: "image",
  answer: "cityhunt",
  validationFunction: "default",
  hint: "Check the image details!"
}
```

### Example with Multiple Media Files

```javascript
{
  stageId: 2,
  stageName: "The Second Challenge",
  title: "Find the Hidden Message",
  description: "Watch this video and examine the image.",
  media: [
    {
      type: "image",
      url: "https://firebasestorage.googleapis.com/v0/b/YOUR_PROJECT_ID.appspot.com/o/stages%2Fstage2%2Fimage.jpg?alt=media&token=TOKEN",
      alt: "Hidden message image"
    },
    {
      type: "video",
      url: "https://firebasestorage.googleapis.com/v0/b/YOUR_PROJECT_ID.appspot.com/o/stages%2Fstage2%2Fvideo.mp4?alt=media&token=TOKEN",
      alt: "Instruction video"
    }
  ],
  mediaType: "both",
  answer: "treasure",
  validationFunction: "default",
  hint: "Look at both media files!"
}
```

## Step 6: Best Practices

### File Organization

Organize files in a clear structure:
```
stages/
  stage1/
    image1.jpg
    video1.mp4
  stage2/
    image2.jpg
  ...
```

### File Naming

- Use descriptive names: `clue-image.jpg`, `instruction-video.mp4`
- Avoid spaces (use hyphens or underscores)
- Include file extensions

### File Sizes

- **Images**: Optimize before upload (recommended max: 2MB per image)
- **Videos**: Compress videos (recommended max: 10MB per video)
- Use tools like:
  - Image optimization: TinyPNG, ImageOptim
  - Video compression: HandBrake, FFmpeg

### Caching

Firebase Storage URLs include cache control. Set appropriate cache headers:
- Images: Long cache (1 year)
- Videos: Medium cache (1 month)

### Security

1. **Public Read Access**: For stage media, public read is usually fine
2. **Private Media**: If you need private media, use signed URLs in Cloud Functions
3. **File Validation**: Validate file types and sizes on upload

## Step 7: Update Cloud Functions (Optional)

If you want to generate Storage URLs dynamically in Cloud Functions:

```javascript
// In backend_code/index.js
const admin = require('firebase-admin');
const bucket = admin.storage().bucket();

// Add this helper function
async function getStorageUrl(storagePath) {
  try {
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    
    if (!exists) {
      return null;
    }
    
    // Get public URL
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491',
    });
    
    return url;
  } catch (error) {
    console.error('Error getting storage URL:', error);
    return null;
  }
}

// In getStageContent function, you can process media URLs
// If media contains storage paths instead of full URLs:
if (stageData.media && Array.isArray(stageData.media)) {
  for (const mediaItem of stageData.media) {
    // If it's a storage path (starts with 'stages/')
    if (mediaItem.url && mediaItem.url.startsWith('stages/')) {
      mediaItem.url = await getStorageUrl(mediaItem.url);
    }
  }
}
```

## Step 8: Testing

1. Upload a test image to Firebase Storage
2. Copy the Download URL
3. Add it to a test stage document in Firestore
4. Test in the app to ensure the image loads correctly

## Troubleshooting

### Images Not Loading

1. **Check URL**: Ensure the URL is correct and accessible
2. **Check Security Rules**: Verify Storage rules allow public read
3. **Check CORS**: Firebase Storage should handle CORS automatically
4. **Check File Exists**: Verify file exists in Storage

### CORS Errors

Firebase Storage handles CORS automatically. If you see CORS errors:
1. Check that the file exists
2. Verify security rules allow read access
3. Check browser console for specific error messages

### Large File Uploads

For large files (>10MB):
1. Consider compressing files before upload
2. Use Firebase Storage resumable uploads for large files
3. Monitor storage usage (free tier: 5GB)

### URL Expiration

- **Download URLs from Console**: These include tokens that don't expire
- **Signed URLs**: Set expiration far in the future (e.g., '03-09-2491')
- **Public URLs**: If file is public, you can construct URLs directly

## Storage Limits (Free Tier)

- **Storage**: 5GB total
- **Downloads**: 1GB/day
- **Uploads**: 1GB/day

Monitor usage in Firebase Console > Storage > Usage tab.

## Migration from External URLs

If you're migrating from external URLs to Firebase Storage:

1. Download existing media files
2. Upload to Firebase Storage
3. Update Firestore stage documents with new URLs
4. Test each stage to ensure media loads correctly

## Example: Complete Setup Script

```javascript
// setup-storage-media.js
const admin = require('firebase-admin');
const path = require('path');

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function setupStageMedia(stageId, mediaFiles) {
  const uploadedMedia = [];
  
  for (const file of mediaFiles) {
    const storagePath = `stages/stage${stageId}/${path.basename(file.localPath)}`;
    
    // Upload file
    await bucket.upload(file.localPath, {
      destination: storagePath,
      metadata: {
        cacheControl: 'public, max-age=31536000',
        contentType: file.contentType,
      },
    });
    
    // Get public URL
    const fileRef = bucket.file(storagePath);
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2491',
    });
    
    uploadedMedia.push({
      type: file.type,
      url: url,
      alt: file.alt || '',
    });
  }
  
  // Update Firestore document
  await db.collection('stages').doc(`stage${stageId}`).update({
    media: uploadedMedia,
    mediaType: mediaFiles.length === 1 ? mediaFiles[0].type : 'both',
  });
  
  console.log(`Stage ${stageId} media uploaded successfully`);
}

// Usage
setupStageMedia(1, [
  {
    localPath: './images/stage1-clue.jpg',
    type: 'image',
    contentType: 'image/jpeg',
    alt: 'First clue image',
  },
]);
```

## Summary

1. ✅ Enable Firebase Storage
2. ✅ Set security rules (public read for stage media)
3. ✅ Upload media files (Console, CLI, or Admin SDK)
4. ✅ Get public URLs
5. ✅ Update Firestore stage documents with Storage URLs
6. ✅ Test media loading in the app

Your City Hunt app now supports Firebase Storage for media files! 🎉

