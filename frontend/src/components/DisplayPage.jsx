import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { getMenu } from '../services/api'
import { fixMenuImageUrls } from '../utils/imageUtils'

const DisplayPage = () => {
  const { displayId } = useParams()
  const { socket, isConnected } = useSocket()
  const [currentMenus, setCurrentMenus] = useState([])
  const [displayInfo, setDisplayInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Slideshow state
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [currentMenuIndex, setCurrentMenuIndex] = useState(0)
  const [slideshowInterval, setSlideshowInterval] = useState(5000)
  const [transitionType, setTransitionType] = useState('normal')
  const [isPaused, setIsPaused] = useState(false)
  

  
  // Push animation state
  const [isPushing, setIsPushing] = useState(false)
  const [pushDirection, setPushDirection] = useState('up')
  const [nextImageIndex, setNextImageIndex] = useState(0)
  const [nextMenuIndex, setNextMenuIndex] = useState(0)

  useEffect(() => {
    if (socket && displayId) {
      // Register this display with the server
      socket.emit('register-display', displayId)
      
      // Set up ping interval (every 30 seconds)
      const pingInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping')
        }
      }, 30000)
      
      // Initial ping
      socket.emit('ping')

      // Listen for display registration response
      socket.on('display-registered', (data) => {
        if (data.success) {
          setDisplayInfo(data.display)
          if (data.display.currentMenus && data.display.currentMenus.length > 0) {
            fetchMenusData(data.display.currentMenus)
            setSlideshowInterval(data.display.slideshowInterval || 5000)
            setTransitionType(data.display.transitionType || 'normal')
          } else {
            setLoading(false)
          }
        } else {
          setError('Display not found')
          setLoading(false)
        }
      })

      // Listen for menu updates
      socket.on('menus-updated', async (data) => {
        // Safety check: only process updates meant for this display
        if (data.displayId && data.displayId !== displayId) {
          console.log(`Ignoring menu update for display ${data.displayId}, this is display ${displayId}`);
          return;
        }
        
        if (data.menuIds && data.menuIds.length > 0) {
          await fetchMenusData(data.menuIds.map((menuId, index) => ({ menu: menuId, order: index })))
          setSlideshowInterval(data.slideshowInterval || 5000)
          setTransitionType(data.transitionType || 'normal')
        } else {
          setCurrentMenus([])
        }
      })

      // Listen for sync/reset event (legacy)
      socket.on('display-sync-refresh', (data) => {
        if (!data || !data.targetTime) {
          console.error('Invalid sync data received');
          return;
        }
        
        // Calculate network latency (one-way trip time)
        const now = Date.now();
        const serverTime = data.serverTime || now;
        const networkLatency = Math.max(0, now - serverTime);
        
        // Calculate time until target sync time (accounting for network latency)
        const targetTime = data.targetTime;
        const timeUntilSync = targetTime - now - networkLatency;
        
        console.log('🔁 SYNC: Received sync command', {
          serverTime: new Date(serverTime).toISOString(),
          targetTime: new Date(targetTime).toISOString(),
          networkLatency: `${networkLatency}ms`,
          timeUntilSync: `${timeUntilSync}ms`,
          currentTime: new Date(now).toISOString()
        });
        
        // If the target time is in the past, sync immediately
        if (timeUntilSync <= 0) {
          console.log('⏱️ SYNC: Target time already passed, syncing immediately');
          window.location.reload();
          return;
        }
        
        // Show countdown in the UI (optional)
        const countdownEl = document.getElementById('sync-countdown');
        if (countdownEl) {
          countdownEl.textContent = `Syncing in ${Math.ceil(timeUntilSync / 1000)}s`;
          countdownEl.style.display = 'block';
        }
        
        // Set up precise timing for the sync
        const startTime = performance.now();
        const syncAt = startTime + timeUntilSync;
        
        const syncReload = () => {
          const now = performance.now();
          const remaining = syncAt - now;
          
          // Update countdown (optional)
          if (countdownEl) {
            countdownEl.textContent = `Syncing in ${Math.max(0, Math.ceil(remaining / 100) / 10)}s`;
          }
          
          if (remaining <= 0) {
            console.log('🔄 SYNC: Synchronized reload at', new Date().toISOString());
            if (countdownEl) countdownEl.style.display = 'none';
            window.location.reload();
          } else {
            // Use requestAnimationFrame for precise timing
            requestAnimationFrame(syncReload);
          }
        };
        
        // Start the sync process
        console.log(`⏱️ SYNC: Will sync in ${Math.ceil(timeUntilSync / 100) / 10} seconds`);
        requestAnimationFrame(syncReload);
      });

      // Pause all displays
      socket.on('display-pause', () => {
        setIsPaused(true)
      })

      // Resume all displays at synchronized target time
      socket.on('display-resume', (data) => {
        const now = Date.now()
        const serverTime = data?.serverTime || now
        const targetTime = data?.targetTime || now
        const latency = Math.max(0, now - serverTime)
        const timeUntil = Math.max(0, targetTime - now - latency)

        // Optional: show countdown
        const countdownEl = document.getElementById('sync-countdown')
        if (countdownEl) {
          countdownEl.style.display = 'block'
          countdownEl.textContent = `Resuming in ${Math.ceil(timeUntil/1000)}s`
        }

        const start = performance.now()
        const resumeAt = start + timeUntil
        const tick = () => {
          const remaining = resumeAt - performance.now()
          if (countdownEl) {
            countdownEl.textContent = `Resuming in ${Math.max(0, Math.ceil(remaining/100)/10)}s`
          }
          if (remaining <= 0) {
            // Reset indices so everyone starts aligned
            setCurrentImageIndex(0)
            setCurrentMenuIndex(0)
            setIsPushing(false)
            setNextImageIndex(0)
            setNextMenuIndex(0)
            setIsPaused(false)
            if (countdownEl) countdownEl.style.display = 'none'
          } else {
            requestAnimationFrame(tick)
          }
        }
        requestAnimationFrame(tick)
      })

      return () => {
        clearInterval(pingInterval)
        socket.off('display-registered')
        socket.off('menus-updated')
        socket.off('display-sync-refresh')
        socket.off('display-pause')
        socket.off('display-resume')
      }
    }
  }, [socket, displayId])

  const fetchMenusData = async (menuRefs) => {
    try {
      const menuPromises = menuRefs.map(async (menuRef) => {
        const response = await getMenu(menuRef.menu)
        return {
          ...fixMenuImageUrls(response.data),
          order: menuRef.order
        }
      })
      
      const menus = await Promise.all(menuPromises)
      // Sort by order
      menus.sort((a, b) => a.order - b.order)
      setCurrentMenus(menus)
      setError(null)
    } catch (error) {
      console.error('Error fetching menus:', error)
      setError('Failed to load menus')
    } finally {
      setLoading(false)
    }
  }

  // Slideshow effect
  useEffect(() => {
    if (isPaused || currentMenus.length === 0) return

    const interval = setInterval(() => {
      const currentMenu = currentMenus[currentMenuIndex]
      if (!currentMenu) return
      
      // For custom-based menus, we don't need image slideshow
      if (currentMenu.menuType === 'custom') {
        // Move to next menu after a delay
        setCurrentMenuIndex(prevMenuIndex => {
          const nextMenuIndex = prevMenuIndex + 1
          if (nextMenuIndex >= currentMenus.length) {
            return 0 // Loop back to first menu
          }
          return nextMenuIndex
        })
        return
      }
      
      // For image-based menus, handle image slideshow
      if (!currentMenu.images) return
      
      if (transitionType === 'push') {
        // Handle push animation
        const nextImgIndex = currentImageIndex + 1
        let nextMenuIdx = currentMenuIndex
        let nextImgIdx = nextImgIndex
        
        if (nextImgIndex >= currentMenu.images.length) {
          // Move to next menu
          nextMenuIdx = currentMenuIndex + 1
          if (nextMenuIdx >= currentMenus.length) {
            nextMenuIdx = 0 // Loop back to first menu
          }
          nextImgIdx = 0 // Reset image index for new menu
        }
        
        // Set next image/menu for push animation
        setNextImageIndex(nextImgIdx)
        setNextMenuIndex(nextMenuIdx)
        setIsPushing(true)
        
        // After animation completes, update current indices
        setTimeout(() => {
          setCurrentImageIndex(nextImgIdx)
          setCurrentMenuIndex(nextMenuIdx)
          setIsPushing(false)
        }, 500) // Animation duration
      } else {
        // Normal slideshow mode
        setCurrentImageIndex(prevIndex => {
          const nextImageIndex = prevIndex + 1
          if (nextImageIndex >= currentMenu.images.length) {
            // Move to next menu
            setCurrentMenuIndex(prevMenuIndex => {
              const nextMenuIndex = prevMenuIndex + 1
              if (nextMenuIndex >= currentMenus.length) {
                return 0 // Loop back to first menu
              }
              return nextMenuIndex
            })
            return 0 // Reset image index for new menu
          }
          return nextImageIndex
        })
      }
    }, slideshowInterval)

    return () => clearInterval(interval)
  }, [currentMenus, currentMenuIndex, currentImageIndex, slideshowInterval, transitionType, isPaused])

  // Reset indices when menus change
  useEffect(() => {
    setCurrentImageIndex(0)
    setCurrentMenuIndex(0)
    setIsPushing(false)
    setNextImageIndex(0)
    setNextMenuIndex(0)
  }, [currentMenus])



  // Add CSS animation for push effect
  useEffect(() => {
    if (transitionType === 'push') {
      const style = document.createElement('style')
      
      style.textContent = `
        @keyframes pushUpAnimation {
          0% {
            transform: translateY(0vh);
          }
          100% {
            transform: translateY(-100vh);
          }
        }
        
        @keyframes pushDownAnimation {
          0% {
            transform: translateY(100vh);
          }
          100% {
            transform: translateY(0vh);
          }
        }
      `
      document.head.appendChild(style)
      
      return () => {
        document.head.removeChild(style)
      }
    }
  }, [transitionType])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">{error}</p>
          <p className="text-gray-400">Display ID: {displayId}</p>
        </div>
      </div>
    )
  }

  const currentMenu = currentMenus[currentMenuIndex]
  const currentImage = currentMenu?.images?.[currentImageIndex]

  // Render custom-based menu
  if (currentMenu?.menuType === 'custom') {
    const design = currentMenu.design || {}
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div 
          className="min-h-screen relative overflow-hidden"
          style={{
            backgroundColor: design.backgroundColor || '#000000',
            color: design.textColor || '#FFFFFF',
            fontFamily: design.fontFamily || 'Arial, sans-serif',
            backgroundImage: design.backgroundImage ? `url(${design.backgroundImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Background overlay for better text readability */}
          {design.backgroundImage && (
            <div 
              className="absolute inset-0 bg-black bg-opacity-40"
              style={{ zIndex: 1 }}
            />
          )}
          
          <div className="min-h-screen flex flex-col justify-center items-center p-8 relative" style={{ zIndex: 2 }}>
            {/* Menu Title */}
            {design.showMenuName !== false && (
              <h1 
                className="text-center mb-8 font-bold"
                style={{
                  color: design.titleColor || '#FFD700',
                  fontSize: design.menuNameFontSize || design.titleFontSize || '3rem'
                }}
              >
                {currentMenu.name}
              </h1>
            )}
            
            {/* Menu Description */}
            {currentMenu.description && (
              <p 
                className="text-center mb-12 opacity-80"
                style={{ fontSize: design.itemFontSize || '1.5rem' }}
              >
                {currentMenu.description}
              </p>
            )}

            {/* Menu Items */}
            {currentMenu.menuItems && currentMenu.menuItems.length > 0 && (
              <div className="w-full max-w-4xl space-y-6">
                {currentMenu.menuItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-24 w-24 object-cover rounded-lg shadow-lg"
                        />
                      )}
                      <div>
                        <h3 
                          className="font-semibold"
                          style={{ fontSize: design.itemFontSize || '1.5rem' }}
                        >
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="opacity-80 mt-1">{item.description}</p>
                        )}
                      </div>
                    </div>
                    {item.price && (
                      <span 
                        className="font-bold"
                        style={{
                          color: design.priceColor || '#FF6B6B',
                          fontSize: design.priceFontSize || '1.2rem'
                        }}
                      >
                        {item.price}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render image-based menu
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Sync Countdown Overlay */}
      <div 
        id="sync-countdown" 
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '5px',
          zIndex: 1000,
          display: 'none',
          fontSize: '16px',
          fontWeight: 'bold',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
        }}
      />

      {!currentImage ? (
        <div className="min-h-screen flex items-center justify-center text-center text-white">
          <div>
            <div className="text-6xl mb-4">📋</div>
            <h1 className="text-4xl font-bold mb-2">No Menu Assigned</h1>
            <p className="text-xl text-gray-300">
              Please assign menus from the admin dashboard
            </p>
            {displayInfo && (
              <div className="mt-8 p-4 bg-white bg-opacity-10 rounded-lg">
                <p className="text-sm text-gray-300">
                  Display: {displayInfo.name} ({displayInfo.location})
                </p>
                <p className="text-sm text-gray-400">ID: {displayInfo.displayId}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-screen">
          {(() => {
            // Push Animation
            if (transitionType === 'push' && isPushing) {
              const nextMenu = currentMenus[nextMenuIndex]
              const nextImage = nextMenu?.images?.[nextImageIndex]
              
              return (
                <div className="relative w-full h-full">
                  <img
                    src={currentImage.imageUrl}
                    alt="Menu Display"
                    className="w-full h-full object-cover absolute"
                    style={{
                      animation: 'pushUpAnimation 0.5s ease-in-out forwards',
                      zIndex: 1
                    }}
                  />
                  
                  {nextImage && (
                    <img
                      src={nextImage.imageUrl}
                      alt="Next Menu Display"
                      className="w-full h-full object-cover absolute top-0 left-0"
                      style={{
                        animation: 'pushDownAnimation 0.5s ease-in-out forwards',
                        zIndex: 2
                      }}
                    />
                  )}
                </div>
              )
            }
            
            // Default static image
            return (
              <img
                src={currentImage.imageUrl}
                alt="Menu Display"
                className="w-full h-full object-cover"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default DisplayPage 