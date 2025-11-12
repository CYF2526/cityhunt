# City Hunt Cloud Functions

This directory contains Firebase Cloud Functions for the City Hunt application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure you have Firebase CLI installed:
```bash
npm install -g firebase-tools
```

3. Login to Firebase:
```bash
firebase login
```

4. Initialize Firebase Functions (if not already done):
```bash
firebase init functions
```

5. Deploy the functions:
```bash
npm run deploy
```

## Functions

### `authorizeGroupAccess`

A callable Cloud Function that validates group PINs and grants access.

**Request:**
```javascript
{
  groupId: string,
  pin: string
}
```

**Response:**
```javascript
{
  success: boolean,
  message: string,
  groupId: string
}
```

### `getStageContent`

Fetches the content for a specific stage for a group.

**Request:**
```javascript
{
  groupId: string,
  stageId: number
}
```

**Response:**
```javascript
{
  success: boolean,
  stageId: number,
  stageName: string,
  title: string,
  description: string,
  media: array,
  mediaType: string,
  isCompleted: boolean,
  isUnlocked: boolean
}
```

### `validateAnswer`

Validates a user's answer for a specific stage.

**Request:**
```javascript
{
  groupId: string,
  stageId: number,
  answer: string
}
```

**Response (Correct):**
```javascript
{
  success: boolean,
  correct: true,
  message: string
}
```

**Response (Incorrect):**
```javascript
{
  success: boolean,
  correct: false,
  hint: string,
  message: string
}
```

### `getGroupProgress`

Gets the current progress for a group.

**Request:**
```javascript
{
  groupId: string
}
```

**Response:**
```javascript
{
  success: boolean,
  currentStage: number,
  completedStages: array,
  totalStages: number
}
```

## Firestore Structure

The function expects the following Firestore structure:

**Collection: `groupPins`**
- Document ID: `{groupId}` (e.g., `group1`, `group2`)
- Fields:
  - `pin`: string (the PIN for this group)

Example:
```
groupPins/
  group1/
    pin: "1234"
  group2/
    pin: "5678"
```

## Realtime Database Structure

The function creates authorization records in RTDB:

**Path: `/authorizations/{groupId}/{uid}`**
- `timestamp`: Server timestamp
- `groupId`: string
- `uid`: string (user's anonymous auth UID)

## Security Rules

Make sure your Firestore security rules prevent clients from reading `groupPins`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Prevent clients from reading groupPins
    match /groupPins/{document=**} {
      allow read: if false;
      allow write: if false;
    }
    
    // Add other rules as needed
  }
}
```

For RTDB, you can allow authenticated users to read their own authorizations:

```json
{
  "rules": {
    "authorizations": {
      "$groupId": {
        "$uid": {
          ".read": "$uid === auth.uid",
          ".write": false
        }
      }
    }
  }
}
```

