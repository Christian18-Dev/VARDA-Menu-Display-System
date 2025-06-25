import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { getMenu } from '../services/api'

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

  useEffect(() => {
    if (socket && displayId) {
      // Register this display with the server
      socket.emit('register-display', displayId)

      // Listen for display registration response
      socket.on('display-registered', (data) => {
        if (data.success) {
          setDisplayInfo(data.display)
          if (data.display.currentMenus && data.display.currentMenus.length > 0) {
            fetchMenusData(data.display.currentMenus)
            setSlideshowInterval(data.display.slideshowInterval || 5000)
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
        } else {
          setCurrentMenus([])
        }
      })

      return () => {
        socket.off('display-registered')
        socket.off('menus-updated')
      }
    }
  }, [socket, displayId])

  const fetchMenusData = async (menuRefs) => {
    try {
      const menuPromises = menuRefs.map(async (menuRef) => {
        const response = await getMenu(menuRef.menu)
        return {
          ...response.data,
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
    if (currentMenus.length === 0) return

    const interval = setInterval(() => {
      setCurrentImageIndex(prevIndex => {
        const currentMenu = currentMenus[currentMenuIndex]
        if (!currentMenu) return 0
        
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
          return 0
        }
        
        // For image-based menus, handle image slideshow
        if (!currentMenu.images) return 0
        
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
    }, slideshowInterval)

    return () => clearInterval(interval)
  }, [currentMenus, currentMenuIndex, slideshowInterval])

  // Reset indices when menus change
  useEffect(() => {
    setCurrentImageIndex(0)
    setCurrentMenuIndex(0)
  }, [currentMenus])

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
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Fullscreen Image Display */}
      <div className="min-h-screen flex items-center justify-center">
        {currentImage ? (
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
        ) : (
          <div className="text-center text-white">
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
        )}
      </div>
    </div>
  )
}

export default DisplayPage 