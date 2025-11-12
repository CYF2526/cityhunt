import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { signInAnonymously } from 'firebase/auth'
import { auth } from './firebase-config'
import Login from './pages/Login'
import Game from './pages/Game'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null) // null = checking, true/false = determined
  const [currentGroup, setCurrentGroup] = useState(null)

  useEffect(() => {
    // Sign in anonymously on app load
    signInAnonymously(auth)
      .then(() => {
        console.log('Anonymous authentication successful')
        // Check if user has a stored login session
        const storedGroup = localStorage.getItem('currentGroup')
        setIsAuthenticated(!!storedGroup)
        setCurrentGroup(storedGroup)
      })
      .catch((error) => {
        console.error('Anonymous authentication failed:', error)
        setIsAuthenticated(false)
      })
  }, [])

  // Listen for storage changes to update group when user logs in/out
  useEffect(() => {
    const handleStorageChange = () => {
      const storedGroup = localStorage.getItem('currentGroup')
      setCurrentGroup(storedGroup)
      setIsAuthenticated(!!storedGroup)
    }

    // Listen for storage events (when localStorage changes in other tabs/windows)
    window.addEventListener('storage', handleStorageChange)
    
    // Also check on focus (for same-tab updates)
    const handleFocus = () => {
      const storedGroup = localStorage.getItem('currentGroup')
      if (storedGroup !== currentGroup) {
        setCurrentGroup(storedGroup)
        setIsAuthenticated(!!storedGroup)
      }
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [currentGroup])

  // Format group name for display (group1 -> Group 1)
  const formatGroupName = (group) => {
    if (!group) return null
    return group.replace('group', 'Group ')
  }

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return null // or a loading spinner
  }

  return (
    <Router>
      <div className="app">
        <header className="top-bar">
          <h1 className="top-bar-title">CYF 2526 CITY HUNT</h1>
          {currentGroup && (
            <div className="top-bar-group">
              {formatGroupName(currentGroup)}
            </div>
          )}
        </header>
        <main className="main-content">
          <Routes>
            <Route 
              path="/" 
              element={
                <Navigate 
                  to={isAuthenticated ? "/game" : "/login"} 
                  replace 
                />
              } 
            />
            <Route 
              path="/login" 
              element={<Login setIsAuthenticated={setIsAuthenticated} setCurrentGroup={setCurrentGroup} />} 
            />
            <Route 
              path="/game" 
              element={<Game setIsAuthenticated={setIsAuthenticated} setCurrentGroup={setCurrentGroup} />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App

