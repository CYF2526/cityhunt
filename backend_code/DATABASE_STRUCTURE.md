# Database Structure

This document describes the Firestore and Realtime Database structure for the City Hunt application.

## Firestore Collections

### Collection: `stages`

Each document represents a stage in the city hunt. Document IDs should be `stage1`, `stage2`, `stage3`, etc.

**Document Structure:**
```javascript
{
  stageId: number,              // Stage number (1, 2, 3, ...)
  stageName: string,             // Display name (e.g., "The First Clue")
  title: string,                // Stage title
  description: string,           // Rich text description (supports URLs)
  media: array,                  // Array of media objects
  mediaType: string,             // 'none', 'image', 'video', or 'both'
  answer: string,                // Correct answer (not sent to client)
  validationFunction: string,    // Name of validation function ('default', 'stage1', 'stage2', 'stage3')
  hint: string                   // Hint shown when answer is incorrect
}
```

**Media Object Structure:**
```javascript
{
  type: string,    // 'image' or 'video' (optional, auto-detected from URL)
  url: string,     // URL to the media file (Firebase Storage or external URL)
  alt: string      // Alt text for images (optional)
}
```

**Media URL Sources:**
- **Firebase Storage** (Recommended): `https://firebasestorage.googleapis.com/v0/b/PROJECT_ID.appspot.com/o/stages%2Fstage1%2Fimage.jpg?alt=media&token=TOKEN`
- **External URLs**: Any publicly accessible image/video URL
- See `FIREBASE_STORAGE_GUIDE.md` for detailed Firebase Storage setup instructions

**Example Stage Document:**
```javascript
{
  stageId: 1,
  stageName: "The First Clue",
  title: "Welcome to the City Hunt!",
  description: "Your journey begins here. Visit https://example.com/clue1 to find your first clue. Look for the answer in the description.",
  media: [
    {
      type: "image",
      url: "https://example.com/image1.jpg",
      alt: "First clue image"
    }
  ],
  mediaType: "image",
  answer: "cityhunt",
  validationFunction: "default",
  hint: "Check the website description carefully!"
}
```

### Collection: `groupPins`

Stores PINs for each group. Document IDs are group IDs (e.g., `group1`, `group2`).

**Document Structure:**
```javascript
{
  pin: string    // PIN for the group
}
```

**Example:**
```javascript
{
  pin: "1234"
}
```

## Realtime Database Structure

### Path: `/groupProgress/{groupId}`

Stores progress for each group.

**Structure:**
```javascript
{
  currentStage: number,           // Highest stage number reached (0-indexed, so 0 = stage 1)
  completedStages: array,         // Array of completed stage numbers [1, 2, 3, ...]
  lastUpdated: timestamp          // Server timestamp of last update
}
```

**Example:**
```javascript
{
  currentStage: 2,              // Group has completed up to stage 3 (0-indexed: 0=stage1, 1=stage2, 2=stage3)
  completedStages: [1, 2, 3],   // Stages 1, 2, and 3 are completed
  lastUpdated: 1234567890
}
```

### Path: `/authorizations/{groupId}/{uid}`

Stores authorization records for users in groups.

**Structure:**
```javascript
{
  timestamp: timestamp,
  groupId: string,
  uid: string
}
```

## Validation Functions

Validation functions are defined in `backend_code/index.js`. Available functions:

- `default`: Exact match (case-insensitive, trimmed)
- `stage1`: Exact match (case-insensitive, trimmed)
- `stage2`: Multiple possible answers (comma-separated in answer field)
- `stage3`: Contains keyword (user answer must contain the keyword)

To add a new validation function, add it to the `validationFunctions` object in `index.js` and reference it in the stage document's `validationFunction` field.

## Setting Up Stages

1. Go to Firestore Console
2. Create a collection named `stages`
3. Add documents with IDs: `stage1`, `stage2`, `stage3`, etc.
4. Fill in all required fields for each stage
5. Make sure `stageId` matches the document ID number (stage1 = 1, stage2 = 2, etc.)

## Notes

- Stages are dynamically loaded - no hardcoding required
- Progress persists across logins via Realtime Database
- Answers are never sent to the client for security
- Media URLs can be from any source (Firebase Storage, external URLs, etc.)
- Description supports plain text and URLs (auto-converted to links)

