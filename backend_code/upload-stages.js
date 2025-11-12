const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

// Initialize Firebase Admin
// Make sure to set GOOGLE_APPLICATION_CREDENTIALS environment variable
// or provide service account key file path
if (!admin.apps.length) {
  try {
    // Try to initialize with default credentials (from environment variable)
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    })
  } catch (error) {
    // If default credentials fail, try service account file
    const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || './serviceAccountKey.json'
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(path.resolve(serviceAccountPath))
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      })
    } else {
      console.error('Error: Firebase Admin not initialized.')
      console.error('Please set GOOGLE_APPLICATION_CREDENTIALS environment variable')
      console.error('or provide serviceAccountKey.json file in the current directory.')
      process.exit(1)
    }
  }
}

const db = admin.firestore()

async function checkStagesCollection() {
  try {
    // Verify Firestore connection by attempting to access the stages collection
    const stagesRef = db.collection('stages')
    await stagesRef.limit(1).get()
    return true
  } catch (error) {
    // If we get a permission error or connection error, collection is not accessible
    if (error.code === 7 || error.code === 16 || error.message.includes('permission') || error.message.includes('not found')) {
      return false
    }
    // For other errors, still return false to be safe
    return false
  }
}

async function uploadStages(stagesData) {
  const batch = db.batch()
  let batchCount = 0
  const BATCH_LIMIT = 500 // Firestore batch limit

  for (const stage of stagesData) {
    // Ensure stageId matches document ID format
    const docId = stage.stageId ? `stage${stage.stageId}` : stage.docId || `stage${stage.stageId}`
    
    if (!docId) {
      console.error(`Skipping stage without docId or stageId:`, stage)
      continue
    }

    const docRef = db.collection('stages').doc(docId)
    
    // Prepare document data (exclude docId from data)
    const { docId: _, ...stageData } = stage
    
    batch.set(docRef, {
      ...stageData,
      stageId: stage.stageId || parseInt(docId.replace('stage', ''))
    }, { merge: false }) // Overwrite completely
    
    batchCount++

    // Firestore batch limit is 500 operations
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit()
      console.log(`Committed batch of ${batchCount} documents`)
      batchCount = 0
    }
  }

  // Commit remaining documents
  if (batchCount > 0) {
    await batch.commit()
    console.log(`Committed final batch of ${batchCount} documents`)
  }
}

async function main() {
  // Get stages data file path from command line or use default
  const stagesFile = process.argv[2] || './stages-data.json'
  
  if (!fs.existsSync(stagesFile)) {
    console.error(`Error: Stages data file not found: ${stagesFile}`)
    console.error('Usage: node upload-stages.js [path-to-stages-data.json]')
    process.exit(1)
  }

  // Read stages data
  let stagesData
  try {
    const fileContent = fs.readFileSync(stagesFile, 'utf8')
    stagesData = JSON.parse(fileContent)
  } catch (error) {
    console.error(`Error reading or parsing ${stagesFile}:`, error.message)
    process.exit(1)
  }

  // Ensure stagesData is an array
  if (!Array.isArray(stagesData)) {
    console.error('Error: Stages data must be an array')
    process.exit(1)
  }

  if (stagesData.length === 0) {
    console.error('Error: No stages data found in file')
    process.exit(1)
  }

  console.log(`Found ${stagesData.length} stage(s) to upload`)

  // Check if stages collection exists
  console.log('Checking if stages collection exists...')
  const collectionExists = await checkStagesCollection()
  
  if (!collectionExists) {
    console.error('Error: stages collection not found or not accessible')
    process.exit(1)
  }

  console.log('Stages collection found. Uploading documents...')

  try {
    await uploadStages(stagesData)
    console.log(`Successfully uploaded ${stagesData.length} stage document(s)`)
  } catch (error) {
    console.error('Error uploading stages:', error.message)
    process.exit(1)
  }
}

// Run the script
main()
  .then(() => {
    console.log('Upload complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

