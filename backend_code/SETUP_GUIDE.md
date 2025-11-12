# City Hunt Setup Guide

This guide will help you set up the City Hunt application with stages and groups.

## Prerequisites

1. Firebase project set up (see `web/FIREBASE_SETUP.md`)
2. Cloud Functions deployed
3. Firestore and Realtime Database enabled

## Step 1: Set Up Groups

1. Go to **Firestore Database** in Firebase Console
2. Create a collection named `groupPins`
3. Add documents for each group:
   - Document ID: `group1`, `group2`, `group3`, `group4`
   - Field: `pin` (string) - e.g., "1234"

## Step 2: Set Up Firebase Storage (Optional but Recommended)

For storing images and videos, you can use Firebase Storage. See `FIREBASE_STORAGE_GUIDE.md` for detailed instructions.

**Quick Setup:**
1. Enable Firebase Storage in Firebase Console
2. Set security rules to allow public read access
3. Upload media files to `stages/stageX/` folders
4. Use the Download URLs in your stage documents

## Step 3: Create Stages

1. Go to **Firestore Database**
2. Create a collection named `stages`
3. Add stage documents with IDs: `stage1`, `stage2`, `stage3`, etc.

### Stage Document Structure

Each stage document should have these fields:

```javascript
{
  stageId: 1,                    // Number: Stage number (1, 2, 3, ...)
  stageName: "The First Clue",   // String: Display name
  title: "Welcome!",              // String: Stage title
  description: "Your journey begins...",  // String: Description (supports URLs)
  media: [                        // Array: Media items (optional)
    {
      type: "image",              // "image" or "video"
      url: "https://example.com/image.jpg",
      alt: "Description"
    }
  ],
  mediaType: "image",             // "none", "image", "video", or "both"
  answer: "cityhunt",             // String: Correct answer (not sent to client)
  validationFunction: "default",  // String: Validation function name
  hint: "Check the website!"      // String: Hint for incorrect answers
}
```

### Example Stage Documents

**Stage 1 (with Firebase Storage image):**
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
  hint: "Look at the image details!"
}
```

**Stage 1 (with external URL - alternative):**
```javascript
{
  stageId: 1,
  stageName: "The First Clue",
  title: "Welcome to City Hunt!",
  description: "Visit https://example.com/clue1 to find your first clue. The answer is hidden in the page description.",
  media: [],
  mediaType: "none",
  answer: "cityhunt",
  validationFunction: "default",
  hint: "Look at the website's meta description!"
}
```

**Stage 2:**
```javascript
{
  stageId: 2,
  stageName: "The Second Challenge",
  title: "Find the Hidden Message",
  description: "Look at this image carefully. What word do you see?",
  media: [
    {
      type: "image",
      url: "https://example.com/clue2.jpg",
      alt: "Hidden message image"
    }
  ],
  mediaType: "image",
  answer: "treasure,hidden,secret",
  validationFunction: "stage2",
  hint: "The answer might be one of several words..."
}
```

**Stage 3:**
```javascript
{
  stageId: 3,
  stageName: "Video Clue",
  title: "Watch and Learn",
  description: "Watch this video and find the keyword mentioned.",
  media: [
    {
      type: "video",
      url: "https://example.com/clue3.mp4",
      alt: "Video clue"
    }
  ],
  mediaType: "video",
  answer: "keyword",
  validationFunction: "stage3",
  hint: "Listen carefully to what the narrator says!"
}
```

## Step 4: Validation Functions

Available validation functions (defined in `backend_code/index.js`):

- **`default`**: Exact match (case-insensitive, trimmed)
  - User answer must exactly match the correct answer
  - Example: Answer "cityhunt" matches "cityhunt" or "CityHunt"

- **`stage1`**: Same as default (exact match)

- **`stage2`**: Multiple possible answers (comma-separated)
  - Correct answer field contains comma-separated values
  - User answer must match one of them
  - Example: Answer "treasure" matches if correct answer is "treasure,hidden,secret"

- **`stage3`**: Contains keyword
  - User answer must contain the keyword
  - Example: Answer "the keyword is here" matches if keyword is "keyword"

To add custom validation, edit `backend_code/index.js` and add to the `validationFunctions` object.

## Step 5: Test the Application

1. Start the frontend: `cd web && npm run dev`
2. Login with a group PIN
3. Navigate through stages
4. Test answer validation

## Step 6: Monitor Progress

Progress is stored in Realtime Database at `/groupProgress/{groupId}`. You can view it in the Firebase Console to see:
- Current stage for each group
- Completed stages
- Last update timestamp

## Tips

- **Media URLs**: 
  - **Firebase Storage** (Recommended): See `FIREBASE_STORAGE_GUIDE.md` for setup
  - **External URLs**: Any publicly accessible image/video URL works
  - **CDN URLs**: CloudFront, Cloudflare, etc.
- **Description Links**: URLs in descriptions are automatically converted to clickable links
- **Stage Ordering**: Stages are loaded dynamically - order them by `stageId` (1, 2, 3, ...)
- **Progress Persistence**: Progress persists across logins via Realtime Database
- **Security**: Answers are never sent to the client - only validated server-side

## Troubleshooting

### Stages not loading
- Check that stage documents exist in Firestore
- Verify document IDs are `stage1`, `stage2`, etc.
- Ensure all required fields are present

### Answers not validating
- Check that `validationFunction` matches a function in `backend_code/index.js`
- Verify the `answer` field is set correctly
- Check Cloud Functions logs for errors

### Progress not saving
- Verify Realtime Database rules allow writes
- Check that Cloud Functions have proper permissions
- Look for errors in Cloud Functions logs

