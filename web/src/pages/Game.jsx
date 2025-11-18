import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase-config'
import './Game.css'

function Game({ setIsAuthenticated, setCurrentGroup }) {
  const [currentGroup, setLocalCurrentGroup] = useState(null)
  const [currentStageId, setCurrentStageId] = useState(1)
  const [stageData, setStageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [progress, setProgress] = useState({ currentStage: 0, completedStages: [], totalStages: 0 })
  const [hasInitialized, setHasInitialized] = useState(false)
  const [activeTab, setActiveTab] = useState('game') // 'game' or 'profile'
  const navigate = useNavigate()

  const loadProgress = useCallback(async (groupId, isInitial = false) => {
    try {
      const getGroupProgress = httpsCallable(functions, 'getGroupProgress')
      const result = await getGroupProgress({ groupId })
      
      if (result.data.success) {
        const progressData = {
          currentStage: result.data.currentStage || 0,
          completedStages: result.data.completedStages || [],
          totalStages: result.data.totalStages || 0
        }
        setProgress(progressData)
        
        // Only set current stage on initial load
        if (isInitial) {
          // Set current stage to the first unlocked stage (currentStage + 1, or 1 if no progress)
          const firstUnlockedStage = progressData.currentStage === 0 ? 1 : progressData.currentStage + 1
          // Allow navigation up to totalStages (includes finish stage)
          setCurrentStageId(Math.min(firstUnlockedStage, progressData.totalStages || 1))
        }
      }
    } catch (error) {
      console.error('Error loading progress:', error)
      if (!isInitial) {
        // Only show error if not initial load (to avoid blocking initial render)
        setError('Failed to load progress. Please try again.')
      }
    }
  }, [])

  // Check authentication and load progress on mount
  useEffect(() => {
    const storedGroup = localStorage.getItem('currentGroup')
    if (!storedGroup) {
      navigate('/login', { replace: true })
      if (setIsAuthenticated) {
        setIsAuthenticated(false)
      }
    } else {
      setLocalCurrentGroup(storedGroup)
      if (!hasInitialized) {
        loadProgress(storedGroup, true)
        setHasInitialized(true)
      }
    }
  }, [navigate, setIsAuthenticated, hasInitialized, loadProgress])

  // Load stage content when stage changes
  useEffect(() => {
    if (currentGroup && currentStageId) {
      loadStageContent(currentGroup, currentStageId)
    }
  }, [currentGroup, currentStageId])

  const loadStageContent = async (groupId, stageId) => {
    setLoading(true)
    setError('')
    setHint('')
    setIsCorrect(false)
    setAnswer('')

    try {
      const getStageContent = httpsCallable(functions, 'getStageContent')
      const result = await getStageContent({ groupId, stageId })

      if (result.data.success) {
        setStageData(result.data)
          setIsCorrect(result.data.isCompleted || false)
        
        // Reload progress to get latest state (not initial load)
        await loadProgress(groupId, false)
      } else {
        setError('Failed to load stage content.')
      }
    } catch (error) {
      console.error('Error loading stage content:', error)
      if (error.code === 'functions/permission-denied') {
        setError('This stage is locked. Complete previous stages first.')
      } else {
        setError('Failed to load stage content. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (e) => {
    const value = e.target.value
    // Only allow alphanumeric characters and spaces
    if (/^[a-zA-Z0-9 ]*$/.test(value)) {
      setAnswer(value)
      setError('')
      setHint('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!answer.trim()) {
      setError('Please enter an answer.')
      return
    }

    if (isCorrect) {
      return // Already answered correctly
    }

    setSubmitting(true)
    setError('')
    setHint('')

    try {
      const validateAnswer = httpsCallable(functions, 'validateAnswer')
      const result = await validateAnswer({
        groupId: currentGroup,
        stageId: currentStageId,
        answer: answer.trim()
      })

      if (result.data.success) {
        if (result.data.correct) {
          setIsCorrect(true)
          setAnswer('') // Clear answer after correct submission
          // Reload progress to get updated state (not initial load)
          await loadProgress(currentGroup, false)
        } else {
          setHint(result.data.hint || 'Try again!')
          setError(result.data.message || 'Incorrect answer. Try again!')
        }
      }
    } catch (error) {
      console.error('Error validating answer:', error)
      setError('Failed to validate answer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (currentStageId > 1) {
      setCurrentStageId(currentStageId - 1)
    }
  }

  const handleNext = () => {
    // Allow navigation to next stage if:
    // 1. Not on the last playable stage (currentStageId < playableStages) and current stage is correct, OR
    // 2. On the last playable stage (currentStageId === playableStages) and all playable stages are completed
    const playableStages = Math.max(0, (progress.totalStages || 0) - 1)
    const allPlayableStagesCompleted = progress.completedStages?.length === playableStages && playableStages > 0
    if ((currentStageId < playableStages && isCorrect) || 
        (currentStageId === playableStages && allPlayableStagesCompleted)) {
      setCurrentStageId(currentStageId + 1)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('currentGroup')
    localStorage.removeItem('loginData')
    
    if (setIsAuthenticated) {
      setIsAuthenticated(false)
    }
    if (setCurrentGroup) {
      setCurrentGroup(null)
    }
    
    navigate('/login', { replace: true })
  }


  // Don't render if not logged in
  if (!currentGroup) {
    return null
  }

  const isFirstStage = currentStageId === 1
  // Calculate playable stages (totalStages - 1, since last stage is finish stage without answer)
  const playableStages = Math.max(0, (progress.totalStages || 0) - 1)
  const isLastStage = currentStageId >= playableStages
  // A stage without an answer field is considered the last stage
  // hasAnswer defaults to true for backward compatibility (if undefined, assume it has an answer)
  const hasNoAnswer = stageData?.hasAnswer === false
  const isEffectivelyLastStage = isLastStage || hasNoAnswer
  // Check if all playable stages are completed (playableStages excludes the finish stage)
  const allStagesCompleted = progress.completedStages?.length === playableStages && playableStages > 0
  // Allow going to next stage if: (1) current stage is correct and not last playable stage, OR
  // (2) on last playable stage and all playable stages are completed (to go to finish stage)
  const canGoNext = (isCorrect && currentStageId < playableStages) || 
                    (currentStageId === playableStages && allStagesCompleted)
  // Show submission form only if stage has an answer field (or hasAnswer is undefined for backward compatibility) and is not correct
  const showSubmissionForm = !isCorrect && (stageData?.hasAnswer !== false)

  // Render description with support for links and formatting
  const renderDescription = (description) => {
    if (!description) return null
    
    // Simple link detection - convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = description.split(urlRegex)
    
    return (
      <div className="stage-description">
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="stage-link"
              >
                {part}
              </a>
            )
          }
          return <span key={index}>{part}</span>
        })}
      </div>
    )
  }

  return (
    <div className="game-container">
      {/* Game Tab Content */}
      {activeTab === 'game' && (
        <>
          {/* Navigation Bar */}
          <div className="stage-navigation">
            <button
              className="nav-button nav-button-back"
              onClick={handleBack}
              disabled={isFirstStage || loading || submitting}
            >
              ← Back
            </button>
            
            <div className="stage-name">
              {loading ? 'Loading...' : (stageData?.stageName || `Stage ${currentStageId}`)}
            </div>
            
            <button
              className="nav-button nav-button-next"
              onClick={handleNext}
              disabled={!canGoNext || loading || submitting}
            >
              Next →
            </button>
          </div>

          {/* Main Content Area */}
          <div className="game-content-wrapper">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading stage content...</p>
          </div>
        ) : stageData ? (
          <div className={`stage-content ${allStagesCompleted ? 'all-completed' : ''}`}>
            {/* Title */}
            <h2 className="stage-title">{stageData.title}</h2>
            
            {/* Celebration Message */}
            {allStagesCompleted && (
              <div className="celebration-message">
                <div className="celebration-icon">🎉</div>
                <h3 className="celebration-title">Congratulations!</h3>
                <p className="celebration-text">You've completed all stages of the City Hunt!</p>
              </div>
            )}

            {/* Description */}
            {renderDescription(stageData.description)}

            {/* Media */}
            {stageData.media && stageData.media.length > 0 && (
              <div className="stage-media">
                {stageData.media.map((mediaItem, index) => {
                  if (mediaItem.type === 'image' || (!mediaItem.type && /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaItem.url))) {
                    return (
                      <img
                        key={index}
                        src={mediaItem.url}
                        alt={mediaItem.alt || `Stage ${currentStageId} image ${index + 1}`}
                        className="stage-image"
                        loading="lazy"
                      />
                    )
                  } else if (mediaItem.type === 'video' || /\.(mp4|webm|ogg)$/i.test(mediaItem.url)) {
                    return (
                      <video
                        key={index}
                        src={mediaItem.url}
                        controls
                        className="stage-video"
                      >
                        Your browser does not support the video tag.
                      </video>
                    )
                  }
                  return null
                })}
              </div>
            )}

            {/* Answer Section */}
            <div className="answer-section">
              {isCorrect && stageData?.hasAnswer !== false && (
                <div className="success-indicator">
                  <span className="tick-icon">✓</span>
                  <span>{stageData.successMessage || 'Correct! You can proceed to the next stage.'}</span>
                </div>
              )}

              {error && (
                <div className="error-message">{error}</div>
              )}

              {hint && (
                <div className="hint-message">
                  <strong>Hint:</strong> {hint}
                </div>
              )}

              {showSubmissionForm && (
                <form onSubmit={handleSubmit} className="answer-form">
                  <input
                    type="text"
                    value={answer}
                    onChange={handleAnswerChange}
                    placeholder="Enter your answer (letters, numbers, and spaces only)"
                    className="answer-input"
                    disabled={isCorrect || submitting || loading}
                    maxLength={200}
                  />
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={isCorrect || submitting || loading || !answer.trim()}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="error-container">
            <p>{error || 'Failed to load stage content.'}</p>
            <button onClick={() => loadStageContent(currentGroup, currentStageId)}>
              Retry
            </button>
          </div>
        )}
      </div>
        </>
      )}

      {/* Profile Tab Content */}
      {activeTab === 'profile' && (
        <div className="profile-content-wrapper">
          <div className="profile-content">
            <div className="profile-item">
              <h2 className="profile-label">Stages Completed</h2>
              <div className="profile-value">
                {(() => {
                  const playableStages = Math.max(0, (progress.totalStages || 0) - 1)
                  const allPlayableCompleted = progress.completedStages?.length === playableStages && playableStages > 0
                  const onFinishStage = currentStageId === (progress.totalStages || 0)
                  // Show full count when on finish stage and all playable stages are completed
                  const displayCount = (allPlayableCompleted && onFinishStage) 
                    ? (progress.totalStages || 0) 
                    : (progress.completedStages?.length || 0)
                  return `${displayCount} / ${progress.totalStages || 0}`
                })()}
              </div>
            </div>
            <div className="profile-item">
              <button className="profile-logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div className="bottom-nav">
        <button
          className={`bottom-nav-item ${activeTab === 'game' ? 'active' : ''}`}
          onClick={() => setActiveTab('game')}
        >
          <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span className="bottom-nav-label">Game</span>
        </button>
        <button
          className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="bottom-nav-label">Profile</span>
        </button>
      </div>
    </div>
  )
}

export default Game
