# Firebase Setup Guide

This guide will help you set up Firebase for the City Hunt application.

## Prerequisites

1. A Firebase account (free tier is sufficient)
2. Firebase CLI installed: `npm install -g firebase-tools`

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## Step 2: Enable Required Services

### Enable Authentication (Anonymous)
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Anonymous** authentication
3. Click **Save**

### Enable Firestore Database
1. Go to **Firestore Database**
2. Click **Create database**
3. Start in **production mode** (we'll set security rules later)
4. Choose a location for your database

### Enable Realtime Database
1. Go to **Realtime Database**
2. Click **Create database**
3. Choose a location (preferably same as Firestore)
4. Start in **locked mode** (we'll set security rules later)

### Enable Cloud Functions
1. Go to **Functions**
2. If prompted, upgrade to Blaze plan (pay-as-you-go, free tier available)
3. Cloud Functions requires a billing account, but you get free tier usage

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app (you can name it "City Hunt Web")
5. Copy the Firebase configuration object

## Step 4: Configure Frontend

1. Copy `env.example.txt` to `.env` in the `web` directory:
   ```bash
   cd web
   cp env.example.txt .env
   ```

2. Open `.env` and fill in your Firebase configuration values:
   ```
   VITE_FIREBASE_API_KEY=your-actual-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
   ```

## Step 5: Set Up Cloud Functions

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project root:
   ```bash
   firebase init
   ```
   - Select **Functions** when prompted
   - Select your Firebase project
   - Choose JavaScript
   - Say yes to ESLint (optional)
   - Install dependencies when prompted

4. If you already have a `firebase.json`, make sure it includes functions:
   ```json
   {
     "functions": {
       "source": "backend_code"
     }
   }
   ```

5. Install function dependencies:
   ```bash
   cd backend_code
   npm install
   ```

6. Deploy the function:
   ```bash
   cd backend_code
   npm run deploy
   ```

## Step 6: Set Up Firestore Data

You need to create the group PINs in Firestore:

1. Go to **Firestore Database** in Firebase Console
2. Click **Start collection**
3. Collection ID: `groupPins`
4. Add documents with:
   - Document ID: `group1` (or `group2`, `group3`, `group4`)
   - Field: `pin` (type: string, value: e.g., "1234")
   - Repeat for all groups

Alternatively, you can use the Firebase CLI or Admin SDK to add these programmatically.

## Step 7: Set Security Rules

### Firestore Rules
1. Go to **Firestore Database** > **Rules**
2. Copy the contents of `backend_code/firestore.rules`
3. Paste and click **Publish**

### Realtime Database Rules
1. Go to **Realtime Database** > **Rules**
2. Copy the contents of `backend_code/database.rules.json`
3. Paste and click **Publish**

## Step 8: Test the Setup

1. Start your development server:
   ```bash
   cd web
   npm run dev
   ```

2. Open the app in your browser
3. Try logging in with:
   - Group: Group 1
   - PIN: (the PIN you set in Firestore for group1)

## Troubleshooting

### "Login service is not available"
- Make sure Cloud Functions are deployed
- Check that the function name matches: `authorizeGroupAccess`
- Verify your Firebase project ID is correct

### "Invalid PIN"
- Check that the group PIN exists in Firestore
- Verify the PIN value matches exactly (case-sensitive)

### Anonymous authentication fails
- Make sure Anonymous authentication is enabled in Firebase Console
- Check browser console for detailed error messages

### Environment variables not loading
- Make sure your `.env` file is in the `web` directory
- Restart your development server after creating/modifying `.env`
- Variables must start with `VITE_` to be accessible in Vite

## Next Steps

After successful setup, you can:
- Customize the groups and PINs in Firestore
- Add more functionality to the Game component
- Set up session data synchronization in Realtime Database
- Add more Cloud Functions as needed

