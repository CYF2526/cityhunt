const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()
const rtdb = admin.database()

/**
 * Validation functions for different stages
 * Each stage can have its own validation logic
 */
const validationFunctions = {
  // Default validation: exact match (case-insensitive, trimmed)
  default: (userAnswer, correctAnswer) => {
    return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
  },
  
  // Stage 1: Exact match
  stage1: (userAnswer, correctAnswer) => {
    return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
  },
  
  // Stage 2: Multiple possible answers (comma-separated)
  stage2: (userAnswer, correctAnswer) => {
    const user = userAnswer.trim().toLowerCase()
    const correctAnswers = correctAnswer.split(',').map(a => a.trim().toLowerCase())
    return correctAnswers.includes(user)
  },
  
  // Stage 3: Contains keyword
  stage3: (userAnswer, correctAnswer) => {
    const user = userAnswer.trim().toLowerCase()
    const keyword = correctAnswer.trim().toLowerCase()
    return user.includes(keyword)
  }
}

/**
 * Cloud Function: authorizeGroupAccess
 * 
 * This function validates a group PIN and grants access to the user.
 * 
 * Flow:
 * 1. Verify the PIN against Firestore (where PINs are stored securely)
 * 2. If valid, create an authorization "blessing" in RTDB
 * 3. Return success to the client
 * 
 * Security:
 * - PINs are stored in Firestore, only readable by this function
 * - Authorization blessings are stored in RTDB under /authorizations/{groupId}/{uid}
 */
exports.authorizeGroupAccess = functions.https.onCall(async (data, context) => {
  // Verify that the user is authenticated (anonymous auth)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to access this function.'
    )
  }

  const { groupId, pin } = data
  const uid = context.auth.uid

  // Validate input
  if (!groupId || !pin) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'groupId and pin are required.'
    )
  }

  // Validate PIN format (should be numeric)
  if (!/^\d+$/.test(pin)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'PIN must be numeric.'
    )
  }

  try {
    // Step 1: Verify PIN against Firestore
    // Firestore structure: /groupPins/{groupId} with field: pin
    const groupPinDoc = await db.collection('groupPins').doc(groupId).get()

    if (!groupPinDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Group not found.'
      )
    }

    const storedPin = groupPinDoc.data().pin

    if (storedPin !== pin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Invalid PIN.'
      )
    }

    // Step 2: Create authorization blessing in RTDB
    // Structure: /authorizations/{groupId}/{uid} = { timestamp, groupId, uid }
    const authorizationRef = rtdb.ref(`authorizations/${groupId}/${uid}`)
    await authorizationRef.set({
      timestamp: admin.database.ServerValue.TIMESTAMP,
      groupId: groupId,
      uid: uid
    })

    // Step 3: Return success
    return {
      success: true,
      message: 'Access granted',
      groupId: groupId
    }
  } catch (error) {
    // If it's already an HttpsError, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error
    }

    // Otherwise, wrap it in an HttpsError
    console.error('Error in authorizeGroupAccess:', error)
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while processing your request.',
      error.message
    )
  }
})

/**
 * Cloud Function: getStageContent
 * 
 * Fetches the content for a specific stage for a group.
 * Returns stage data including title, description, media, and validation info.
 */
exports.getStageContent = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to access this function.'
    )
  }

  const { groupId, stageId } = data

  // Validate input
  if (!groupId || stageId === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'groupId and stageId are required.'
    )
  }

  try {
    // Get group progress to check if stage is unlocked
    const progressRef = rtdb.ref(`groupProgress/${groupId}`)
    const progressSnapshot = await progressRef.once('value')
    const progress = progressSnapshot.val() || {}
    const currentStage = progress.currentStage || 0
    const completedStages = progress.completedStages || []

    // Check if stage is unlocked (stageId must be <= currentStage + 1)
    const stageNum = parseInt(stageId)
    if (stageNum > currentStage + 1) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'This stage is locked. Complete previous stages first.'
      )
    }

    // Get stage content from Firestore
    // stageId can be a number or string, ensure it's formatted as stage1, stage2, etc.
    const stageDocId = typeof stageId === 'number' ? `stage${stageId}` : stageId.startsWith('stage') ? stageId : `stage${stageId}`
    const stageDoc = await db.collection('stages').doc(stageDocId).get()

    if (!stageDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `Stage ${stageId} not found.`
      )
    }

    const stageData = stageDoc.data()
    const isCompleted = completedStages.includes(stageNum)
    const hasAnswer = stageData.answer !== undefined && stageData.answer !== null && stageData.answer !== ''

    // Return stage content (without the answer)
    return {
      success: true,
      stageId: stageNum,
      stageName: stageData.stageName || `Stage ${stageId}`,
      title: stageData.title || '',
      description: stageData.description || '',
      media: stageData.media || [],
      mediaType: stageData.mediaType || 'none', // 'none', 'image', 'video', 'both'
      isCompleted: isCompleted,
      isUnlocked: true,
      hasAnswer: hasAnswer
    }
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error
    }

    console.error('Error in getStageContent:', error)
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while fetching stage content.',
      error.message
    )
  }
})

/**
 * Cloud Function: validateAnswer
 * 
 * Validates a user's answer for a specific stage.
 * Uses the validation function specified in the stage data.
 */
exports.validateAnswer = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to access this function.'
    )
  }

  const { groupId, stageId, answer } = data

  // Validate input
  if (!groupId || stageId === undefined || !answer) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'groupId, stageId, and answer are required.'
    )
  }

  try {
    // Get stage data from Firestore
    const stageDocId = typeof stageId === 'number' ? `stage${stageId}` : stageId.startsWith('stage') ? stageId : `stage${stageId}`
    const stageDoc = await db.collection('stages').doc(stageDocId).get()

    if (!stageDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `Stage ${stageId} not found.`
      )
    }

    const stageData = stageDoc.data()
    const correctAnswer = stageData.answer
    
    // If stage doesn't have an answer field, it's considered the last stage and doesn't accept submissions
    if (correctAnswer === undefined || correctAnswer === null || correctAnswer === '') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This stage does not accept answer submissions.'
      )
    }
    
    const validationFunctionName = stageData.validationFunction || 'default'
    const hint = stageData.hint || 'Try again!'

    // Get validation function
    const validationFunction = validationFunctions[validationFunctionName] || validationFunctions.default

    // Validate answer
    const isValid = validationFunction(answer, correctAnswer)

    if (isValid) {
      // Answer is correct - update progress
      const progressRef = rtdb.ref(`groupProgress/${groupId}`)
      const progressSnapshot = await progressRef.once('value')
      const progress = progressSnapshot.val() || { currentStage: 0, completedStages: [] }

      const stageNum = parseInt(stageId)
      const currentStage = progress.currentStage || 0
      const completedStages = progress.completedStages || []

      // Add to completed stages if not already there
      if (!completedStages.includes(stageNum)) {
        completedStages.push(stageNum)
      }

      // Update current stage if this is the next stage
      const newCurrentStage = Math.max(currentStage, stageNum)

      // Update progress in RTDB
      await progressRef.update({
        currentStage: newCurrentStage,
        completedStages: completedStages,
        lastUpdated: admin.database.ServerValue.TIMESTAMP
      })

      return {
        success: true,
        correct: true,
        message: 'Correct answer! You can proceed to the next stage.'
      }
    } else {
      // Answer is incorrect - return hint
      return {
        success: true,
        correct: false,
        hint: hint,
        message: 'Incorrect answer. Try again!'
      }
    }
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error
    }

    console.error('Error in validateAnswer:', error)
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while validating the answer.',
      error.message
    )
  }
})

/**
 * Cloud Function: getGroupProgress
 * 
 * Gets the current progress for a group.
 */
exports.getGroupProgress = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to access this function.'
    )
  }

  const { groupId } = data

  if (!groupId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'groupId is required.'
    )
  }

  try {
    const progressRef = rtdb.ref(`groupProgress/${groupId}`)
    const progressSnapshot = await progressRef.once('value')
    const progress = progressSnapshot.val() || { currentStage: 0, completedStages: [] }

    // Get total number of stages from Firestore
    // Stages are stored as stage1, stage2, etc., so we count all documents
    const stagesSnapshot = await db.collection('stages').get()
    const totalStages = stagesSnapshot.size

    return {
      success: true,
      currentStage: progress.currentStage || 0,
      completedStages: progress.completedStages || [],
      totalStages: totalStages
    }
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error
    }

    console.error('Error in getGroupProgress:', error)
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while fetching progress.',
      error.message
    )
  }
})

