import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase-config'
import './Login.css'

function Login({ setIsAuthenticated, setCurrentGroup }) {
  const [selectedGroup, setSelectedGroup] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Check if user is already logged in
  useEffect(() => {
    const currentGroup = localStorage.getItem('currentGroup')
    if (currentGroup) {
      // User is already logged in, redirect to game
      navigate('/game', { replace: true })
      if (setIsAuthenticated) {
        setIsAuthenticated(true)
      }
    }
  }, [navigate, setIsAuthenticated])

  const groups = [
    { value: 'group1', label: 'Group 1' },
    { value: 'group2', label: 'Group 2' },
    { value: 'group3', label: 'Group 3' },
    { value: 'group4', label: 'Group 4' }
  ]

  const handlePinChange = (e) => {
    const value = e.target.value
    // Only allow numeric input
    if (value === '' || /^\d+$/.test(value)) {
      setPin(value)
      setError('') // Clear error when user types
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!selectedGroup || !pin) {
      setError('Please select a group and enter a PIN')
      setLoading(false)
      return
    }

    try {
      const loginToGroup = httpsCallable(functions, 'authorizeGroupAccess')
      const result = await loginToGroup({ 
        groupId: selectedGroup, 
        pin: pin 
      })

      if (result.data.success) {
        // Login successful!
        // Save to local storage so user stays logged in on reload
        const loginData = {
          groupId: selectedGroup,
          timestamp: Date.now()
        }
        localStorage.setItem('currentGroup', selectedGroup)
        localStorage.setItem('loginData', JSON.stringify(loginData))
        
        // Update authentication state and group
        if (setIsAuthenticated) {
          setIsAuthenticated(true)
        }
        if (setCurrentGroup) {
          setCurrentGroup(selectedGroup)
        }
        
        // Navigate to game page
        navigate('/game', { replace: true })
      } else {
        setError(result.data.message || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      // Handle Firebase function errors
      if (error.code === 'functions/not-found') {
        setError('Login service is not available. Please check your Firebase configuration.')
      } else if (error.message) {
        setError(error.message)
      } else {
        setError('Invalid PIN or group. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Login</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="group-select" className="form-label">
              Select Group
            </label>
            <select
              id="group-select"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="form-select"
              required
            >
              <option value="">Choose a group...</option>
              {groups.map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="pin-input" className="form-label">
              Enter PIN
            </label>
            <input
              id="pin-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={handlePinChange}
              className="form-input"
              placeholder="Enter your PIN"
              required
            />
          </div>

          {error && (
            <div className="error-message" style={{ 
              color: '#ff4444', 
              marginBottom: '1rem', 
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login

