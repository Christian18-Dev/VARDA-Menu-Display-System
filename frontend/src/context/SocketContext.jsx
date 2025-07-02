import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const SocketContext = createContext()

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)

  useEffect(() => {
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    const baseDelay = 1000

    const connectSocket = () => {
      // Use environment variable for backend URL, fallback to localhost for development
      const backendUrl = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:5000' : 'https://varda-menu-display-system.onrender.com')
      const newSocket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: false, // We'll handle reconnection manually
        forceNew: true
      })

      newSocket.on('connect', () => {
        console.log('Connected to server')
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttempts = 0 // Reset attempts on successful connection
      })

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        setIsConnected(false)
        setConnectionError(error.message)
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = baseDelay * Math.pow(2, reconnectAttempts)
          console.log(`Reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`)
          
          setTimeout(() => {
            reconnectAttempts++
            newSocket.connect()
          }, delay)
        } else {
          console.error('Max reconnection attempts reached')
          setConnectionError('Unable to connect to server after multiple attempts')
        }
      })

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason)
        setIsConnected(false)
        
        // Only attempt reconnection if it wasn't a manual disconnect
        if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = baseDelay * Math.pow(2, reconnectAttempts)
            console.log(`Reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`)
            
            setTimeout(() => {
              reconnectAttempts++
              newSocket.connect()
            }, delay)
          }
        }
      })

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts')
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttempts = 0
      })

      newSocket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error)
        setConnectionError('Reconnection failed')
      })

      newSocket.on('reconnect_failed', () => {
        console.error('Reconnection failed after all attempts')
        setConnectionError('Unable to reconnect to server')
      })

      setSocket(newSocket)

      return newSocket
    }

    const socketInstance = connectSocket()

    return () => {
      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [])

  const value = {
    socket,
    isConnected,
    connectionError
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
} 