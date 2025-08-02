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
  
  // Scrolling animation state
  const [scrollPosition, setScrollPosition] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [animationStarted, setAnimationStarted] = useState(false)
  
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
        if (data.menuIds && data.menuIds.length > 0) {
          await fetchMenusData(data.menuIds.map((menuId, index) => ({ menu: menuId, order: index })))
          setSlideshowInterval(data.slideshowInterval || 5000)
          setTransitionType(data.transitionType || 'normal')
        } else {
          setCurrentMenus([])
        }
      })

      // Listen for sync/reset event
      socket.on('display-sync-refresh', (data) => {
        console.log('Received sync refresh signal, preparing to reload page...')
        
        // Add a small delay to ensure all displays receive the message before refreshing
        // This helps synchronize the refresh timing across all displays
        const delay = data?.delay || 1000 // Default 1 second delay
        
        setTimeout(() => {
          console.log('Syncing display refresh now...')
          window.location.reload()
        }, delay)
      })

      return () => {
        clearInterval(pingInterval)
        socket.off('display-registered')
        socket.off('menus-updated')
        socket.off('display-sync-refresh')
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
    if (currentMenus.length === 0 || transitionType === 'scrolling') return

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
  }, [currentMenus, currentMenuIndex, currentImageIndex, slideshowInterval, transitionType])

  // Reset indices when menus change
  useEffect(() => {
    setCurrentImageIndex(0)
    setCurrentMenuIndex(0)
    setScrollPosition(0)
    setIsPushing(false)
    setNextImageIndex(0)
    setNextMenuIndex(0)
  }, [currentMenus])

  // Scrolling animation effect
  useEffect(() => {
    if (transitionType !== 'scrolling' || currentMenus.length === 0) {
      setIsScrolling(false)
      setAnimationStarted(false)
      return
    }

    const currentMenu = currentMenus[currentMenuIndex]
    if (!currentMenu || currentMenu.menuType === 'custom' || !currentMenu.images) {
      setIsScrolling(false)
      setAnimationStarted(false)
      return
    }

    setIsScrolling(true)
    
    // Delay animation start to ensure first image is fully visible
    const startTimer = setTimeout(() => {
      setAnimationStarted(true)
    }, 1000) // 1 second delay to show first image

    return () => {
      clearTimeout(startTimer)
      setIsScrolling(false)
      setAnimationStarted(false)
    }
  }, [transitionType, currentMenus, currentMenuIndex])

  // Initialize scroll position to start with first image visible (no black gap)
  useEffect(() => {
    if (transitionType === 'scrolling' && currentMenus.length > 0) {
      const currentMenu = currentMenus[currentMenuIndex]
      if (currentMenu && currentMenu.images && currentMenu.images.length > 0) {
        // Start at the height of one image so the first image is immediately visible
        setScrollPosition(window.innerHeight)
      }
    }
  }, [transitionType, currentMenus, currentMenuIndex])

  // Add CSS animation for seamless scrolling
  useEffect(() => {
    if (transitionType === 'scrolling') {
      const style = document.createElement('style')
      const imageCount = currentMenus[currentMenuIndex]?.images?.length || 1
      const totalHeight = imageCount * 100
      
      style.textContent = `
        @keyframes scrollAnimation {
          0% {
            transform: translateY(0vh);
          }
          100% {
            transform: translateY(-${totalHeight}vh);
          }
        }
      `
      document.head.appendChild(style)
      
      return () => {
        document.head.removeChild(style)
      }
    }
  }, [transitionType, currentMenus, currentMenuIndex])

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
          ></div>
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
    )
  }

  // Render image-based menu (existing functionality)
  return (
    <div className="min-h-screen bg-black relative overflow-hidden" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}>
      {/* Fullscreen Image Display */}
      <div className="min-h-screen flex items-center justify-center" style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh' }}>
        {currentImage ? (
          transitionType === 'scrolling' && isScrolling ? (
            // Scrolling animation mode with seamless loop using CSS animation
            <div 
              className="relative w-full h-full"
              style={{
                animation: animationStarted ? `scrollAnimation ${slideshowInterval / 1000}s linear infinite` : 'none',
                transform: animationStarted ? 'none' : 'translateY(0vh)', // Start with first image visible
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh'
              }}
            >
              {/* Create seamless loop by duplicating images */}
              {(() => {
                const images = currentMenu.images
                if (!images || images.length === 0) return null
                
                // Create array with images duplicated for seamless loop
                // Start with original images, then repeat them
                const seamlessImages = [
                  ...images, // Original images
                  ...images  // Duplicated images for seamless loop
                ]
                
                return seamlessImages.map((image, index) => (
                  <img
                    key={`${currentMenu._id}-${index}`}
                    src={image.imageUrl}
                    alt={`Menu Display ${index + 1}`}
                    className="w-full h-screen object-cover absolute"
                    style={{
                      top: `${index * 100}vh`,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      objectFit: 'cover'
                    }}
                  />
                ))
              })()}
            </div>
          ) : transitionType === 'push' && isPushing ? (
            // Push animation mode
            <div className="relative w-full h-full">
              {/* Current image sliding up */}
              <img
                src={currentImage.imageUrl}
                alt="Menu Display"
                className="w-full h-screen object-cover absolute"
                style={{
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  objectFit: 'cover',
                  animation: 'pushUpAnimation 0.5s ease-in-out forwards',
                  zIndex: 1
                }}
              />
              
              {/* Next image sliding in from bottom */}
              {(() => {
                const nextMenu = currentMenus[nextMenuIndex]
                const nextImage = nextMenu?.images?.[nextImageIndex]
                if (!nextImage) return null
                
                return (
                  <img
                    src={nextImage.imageUrl}
                    alt="Next Menu Display"
                    className="w-full h-screen object-cover absolute"
                    style={{
                      top: 0,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      objectFit: 'cover',
                      animation: 'pushDownAnimation 0.5s ease-in-out forwards',
                      zIndex: 2
                    }}
                  />
                )
              })()}
            </div>
          ) : (
            // Normal slideshow mode
            <img
              src={currentImage.imageUrl}
              alt="Menu Display"
              className="w-full h-full object-cover absolute inset-0"
              style={{
                width: '100vw',
                height: '100vh',
                objectFit: 'cover'
              }}
            />
          )
        ) : (
          <div className="text-center text-white">
            <div className="text-6xl mb-4">📋</div>
            <h1 className="text-4xl font-bold mb-2">No Menu Assigned.</h1>
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
        )}
      </div>
    </div>
  )
}

export default DisplayPage 