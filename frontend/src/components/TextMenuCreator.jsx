import { useState, useRef } from 'react'
import { 
  Plus, 
  Trash2, 
  Upload, 
  Palette, 
  Type, 
  Save,
  Edit3,
  Image as ImageIcon,
  X,
  Settings,
  Eye
} from 'lucide-react'
import { createCustomMenu, updateMenu, uploadItemImage } from '../services/api'

const TextMenuCreator = ({ menu = null, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: menu?.name || '',
    description: menu?.description || '',
    category: menu?.category || 'general',
    branch: menu?.branch || 'Ateneo',
    menuItems: menu?.menuItems || [],
    design: menu?.design || {
      backgroundColor: '#000000',
      textColor: '#FFFFFF',
      titleColor: '#FFD700',
      priceColor: '#FF6B6B',
      fontFamily: 'Arial, sans-serif',
      titleFontSize: '3rem',
      itemFontSize: '1.5rem',
      descriptionFontSize: '16px',
      priceFontSize: '1.2rem',
      showMenuName: true,
      menuNameFontSize: '3rem',
      backgroundImage: ''
    }
  })
  
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(null)
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [showDesignPanel, setShowDesignPanel] = useState(false)
  const [showFullScreenDesign, setShowFullScreenDesign] = useState(false)
  const [showDesignSettings, setShowDesignSettings] = useState(false)
  const [isDragMode, setIsDragMode] = useState(false)
  const previewRef = useRef(null)
  const [draggingKey, setDraggingKey] = useState(null)
  const [resizingState, setResizingState] = useState(null) // { index, startX, startY, startW, startH, handle }

  const getPreviewRect = () => {
    const el = previewRef.current
    if (!el) return null
    return el.getBoundingClientRect()
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

  const getDefaultPosForKey = (key) => {
    // Defaults in percentages to form a readable layout
    if (key === 'title') return { left: 5, top: 5 }
    if (key === 'menuDescription') return { left: 5, top: 15 }
    // item-<index>-<field>
    const match = key.match(/^item-(\d+)-(name|price|desc|image)$/)
    if (match) {
      const index = Number(match[1])
      const field = match[2]
      const baseTop = 25 + index * 12
      if (field === 'image') return { left: 5, top: baseTop }
      if (field === 'name') return { left: 15, top: baseTop }
      if (field === 'desc') return { left: 15, top: baseTop + 5 }
      if (field === 'price') return { left: 80, top: baseTop }
    }
    return { left: 5, top: 5 }
  }

  const getPosForKey = (key) => {
    if (key === 'title') return formData.design.titlePos || getDefaultPosForKey(key)
    if (key === 'menuDescription') return formData.design.menuDescriptionPos || getDefaultPosForKey(key)
    const match = key.match(/^item-(\d+)-(name|price|desc|image)$/)
    if (match) {
      const index = Number(match[1])
      const field = match[2]
      const layout = formData.menuItems[index]?.layout || {}
      if (field === 'image') return layout.imagePos || getDefaultPosForKey(key)
      if (field === 'name') return layout.namePos || getDefaultPosForKey(key)
      if (field === 'desc') return layout.descPos || getDefaultPosForKey(key)
      if (field === 'price') return layout.pricePos || getDefaultPosForKey(key)
    }
    return getDefaultPosForKey(key)
  }

  const getImageSizeForIndex = (index) => {
    const layout = formData.menuItems[index]?.layout || {}
    // default 80px square thumbnail similar to existing h-20 w-20
    const width = typeof layout.imageWidth === 'number' ? layout.imageWidth : 80
    const height = typeof layout.imageHeight === 'number' ? layout.imageHeight : 80
    return { width, height }
  }

  const setImageSizeForIndex = (index, size) => {
    const item = formData.menuItems[index] || {}
    const layout = item.layout || {}
    const newLayout = { ...layout, imageWidth: size.width, imageHeight: size.height }
    handleMenuItemChange(index, 'layout', newLayout)
  }

  const setPosForKey = (key, pos) => {
    if (key === 'title') {
      handleDesignChange('titlePos', pos)
      return
    }
    if (key === 'menuDescription') {
      handleDesignChange('menuDescriptionPos', pos)
      return
    }
    const match = key.match(/^item-(\d+)-(name|price|desc|image)$/)
    if (match) {
      const index = Number(match[1])
      const field = match[2]
      const item = formData.menuItems[index] || {}
      const layout = item.layout || {}
      const newLayout = { ...layout }
      if (field === 'image') newLayout.imagePos = pos
      if (field === 'name') newLayout.namePos = pos
      if (field === 'desc') newLayout.descPos = pos
      if (field === 'price') newLayout.pricePos = pos
      handleMenuItemChange(index, 'layout', newLayout)
    }
  }

  const onPreviewMouseMove = (e) => {
    if (resizingState) {
      const rect = getPreviewRect()
      if (!rect) return
      const dx = e.clientX - resizingState.startX
      const dy = e.clientY - resizingState.startY
      let newW = resizingState.startW
      let newH = resizingState.startH
      // Simple aspect-free resizing; modify based on handle
      if (resizingState.handle === 'se') {
        newW = Math.max(20, resizingState.startW + dx)
        newH = Math.max(20, resizingState.startH + dy)
      } else if (resizingState.handle === 'e') {
        newW = Math.max(20, resizingState.startW + dx)
      } else if (resizingState.handle === 's') {
        newH = Math.max(20, resizingState.startH + dy)
      }

      // Clamp to preview bounds roughly
      const maxW = rect.width
      const maxH = rect.height
      newW = clamp(newW, 20, maxW)
      newH = clamp(newH, 20, maxH)
      setImageSizeForIndex(resizingState.index, { width: Math.round(newW), height: Math.round(newH) })
      return
    }
    if (!draggingKey) return
    const rect = getPreviewRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Calculate maximum allowed positions to keep elements within bounds
    // Use conservative estimates for different element types
    let maxElementWidth = 150 // pixels - conservative estimate
    let maxElementHeight = 80 // pixels - conservative estimate
    
    // Adjust based on element type for better boundaries
    if (draggingKey === 'title') {
      maxElementWidth = 300
      maxElementHeight = 100
    } else if (draggingKey === 'menuDescription') {
      maxElementWidth = 400
      maxElementHeight = 60
    } else if (draggingKey.includes('image')) {
      maxElementWidth = 100
      maxElementHeight = 100
    } else if (draggingKey.includes('name')) {
      maxElementWidth = 200
      maxElementHeight = 40
    } else if (draggingKey.includes('desc')) {
      maxElementWidth = 300
      maxElementHeight = 50
    } else if (draggingKey.includes('price')) {
      maxElementWidth = 150
      maxElementHeight = 40
    }
    
    const maxLeftPct = Math.max(0, 100 - (maxElementWidth / rect.width) * 100)
    const maxTopPct = Math.max(0, 100 - (maxElementHeight / rect.height) * 100)
    
    const leftPct = clamp((x / rect.width) * 100, 0, maxLeftPct)
    const topPct = clamp((y / rect.height) * 100, 0, maxTopPct)
    setPosForKey(draggingKey, { left: leftPct, top: topPct })
  }

  const stopDragging = () => setDraggingKey(null)
  const stopResizing = () => setResizingState(null)

  const handleAddMenuItem = () => {
    setFormData(prev => ({
      ...prev,
      menuItems: [...prev.menuItems, {
        name: '',
        description: '',
        price: '',
        imageUrl: '',
        fileName: '',
        fileSize: null,
        mimeType: '',
        order: prev.menuItems.length
      }]
    }))
  }

  const handleRemoveMenuItem = (index) => {
    setFormData(prev => ({
      ...prev,
      menuItems: prev.menuItems.filter((_, i) => i !== index)
    }))
  }

  const handleMenuItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      menuItems: prev.menuItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const handlePriceChange = (index, value) => {
    // Remove any existing peso symbol and non-numeric characters except decimal point
    let cleanValue = value.replace(/[₱\s,]/g, '')
    
    // Only allow numbers and decimal point
    cleanValue = cleanValue.replace(/[^0-9.]/g, '')
    
    // Ensure only one decimal point
    const parts = cleanValue.split('.')
    if (parts.length > 2) {
      cleanValue = parts[0] + '.' + parts.slice(1).join('')
    }
    
    // Add peso symbol if there's a value
    const formattedValue = cleanValue ? `₱${cleanValue}` : ''
    
    handleMenuItemChange(index, 'price', formattedValue)
  }

  const handleImageUpload = async (index, file) => {
    if (!file) return

    setUploadingImage(index)
    try {
      const formData = new FormData()
      formData.append('itemImage', file)
      
      const response = await uploadItemImage(formData)
      const imageData = response.data
      
      handleMenuItemChange(index, 'imageUrl', imageData.imageUrl)
      handleMenuItemChange(index, 'fileName', imageData.fileName)
      handleMenuItemChange(index, 'fileSize', imageData.fileSize)
      handleMenuItemChange(index, 'mimeType', imageData.mimeType)
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploadingImage(null)
    }
  }

  const handleBackgroundImageUpload = async (file) => {
    if (!file) return

    setUploadingBackground(true)
    try {
      const formData = new FormData()
      formData.append('itemImage', file)
      
      const response = await uploadItemImage(formData)
      const imageData = response.data
      
      handleDesignChange('backgroundImage', imageData.imageUrl)
    } catch (error) {
      console.error('Background image upload error:', error)
      alert('Failed to upload background image. Please try again.')
    } finally {
      setUploadingBackground(false)
    }
  }

  const handleDesignChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      design: {
        ...prev.design,
        [field]: value
      }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('Please enter a menu name')
      return
    }

    if (formData.menuItems.length === 0) {
      alert('Please add at least one menu item')
      return
    }

    // Validate menu items
    for (let i = 0; i < formData.menuItems.length; i++) {
      const item = formData.menuItems[i]
      if (!item.name.trim()) {
        alert(`Please enter a name for item ${i + 1}`)
        return
      }
    }

    setLoading(true)
    try {
      if (menu) {
        // Update existing menu
        await updateMenu(menu._id, formData)
      } else {
        // Create new menu
        await createCustomMenu(formData)
      }
      onSave()
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save menu. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const parseFontToPx = (value) => {
    if (value == null) return 16
    if (typeof value === 'number') return value
    const str = String(value).trim()
    if (str.endsWith('px')) return parseInt(str, 10) || 0
    if (str.endsWith('rem')) return Math.round((parseFloat(str) || 0) * 16)
    if (str.endsWith('em')) return Math.round((parseFloat(str) || 0) * 16)
    const num = parseFloat(str)
    return Number.isNaN(num) ? 16 : num
  }

  // Allow saving directly from full-screen design mode
  const saveFromDesign = async () => {
    try {
      await handleSubmit({ preventDefault: () => {} })
    } catch (err) {
      // no-op: handleSubmit already shows error
    }
  }

  const fontOptions = [
    'Arial, sans-serif',
    'Helvetica, sans-serif',
    'Times New Roman, serif',
    'Georgia, serif',
    'Verdana, sans-serif',
    'Tahoma, sans-serif',
    'Trebuchet MS, sans-serif',
    'Impact, sans-serif',
    'Comic Sans MS, cursive'
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {menu ? 'Edit Text Menu' : 'Create Text Menu'}
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFullScreenDesign(true)}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <Palette className="h-4 w-4" />
              <span>Design</span>
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
          {/* Main Form */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Menu Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="general">General</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="drinks">Drinks</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch
                </label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({...formData, branch: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="Ateneo">Ateneo</option>
                  <option value="Lasalle">Lasalle</option>
                  <option value="PUP">PUP</option>
                  <option value="UST">UST</option>
                  <option value="FEU">FEU</option>
                  <option value="Mapua">Mapua</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows="3"
              />
            </div>

            {/* Menu Items */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-md font-medium text-gray-900">Menu Items</h4>
                <button
                  type="button"
                  onClick={handleAddMenuItem}
                  className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Item</span>
                </button>
              </div>

              {formData.menuItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No menu items yet.</p>
                  <p className="text-sm">Click "Add Item" to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.menuItems.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h5 className="font-medium text-gray-900">Item {index + 1}</h5>
                        <button
                          type="button"
                          onClick={() => handleRemoveMenuItem(index)}
                          className="text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleMenuItemChange(index, 'name', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Price
                          </label>
                          <input
                            type="text"
                            value={item.price}
                            onChange={(e) => handlePriceChange(index, e.target.value)}
                            placeholder="e.g., ₱299.00"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={item.description}
                          onChange={(e) => handleMenuItemChange(index, 'description', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          rows="2"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Food Image (optional)
                        </label>
                        <div className="flex items-center space-x-4">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(index, e.target.files[0])}
                            className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-colors"
                          />
                          {uploadingImage === index && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                          )}
                        </div>
                        {item.imageUrl && (
                          <div className="mt-2">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-20 w-20 object-cover rounded-md border border-gray-200"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>


        {/* Submit Button */}
        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{menu ? 'Update Menu' : 'Create Menu'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Full Screen Design Mode */}
      {showFullScreenDesign && (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          {/* Top Navigation Bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Palette className="h-5 w-5 mr-2" />
                Design Mode
              </h2>
              <span className="text-sm text-gray-500">
                {formData.name || 'Untitled Menu'}
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={saveFromDesign}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                title="Save Menu"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => setIsDragMode(!isDragMode)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  isDragMode 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Toggle Drag Mode"
              >
                <Edit3 className="h-4 w-4" />
                <span>{isDragMode ? 'Dragging Enabled' : 'Drag Mode'}</span>
              </button>
              <button
                onClick={() => setShowDesignSettings(!showDesignSettings)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  showDesignSettings 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>Design Settings</span>
              </button>
              
              <button
                onClick={() => setShowFullScreenDesign(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Exit Design</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div 
            className="flex-1 flex relative min-h-0"
            onMouseMove={onPreviewMouseMove}
            onMouseUp={() => { stopDragging(); stopResizing(); }}
            onMouseLeave={() => { stopDragging(); stopResizing(); }}
          >
            {/* Design Settings Panel */}
            {showDesignSettings && (
              <div className="w-80 bg-white border-r border-gray-200 h-full overflow-y-auto">
                <div className="p-6 pb-24">
                  <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Design Settings
                  </h3>

                  <div className="space-y-6">
                    {/* Background Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Background Color
                      </label>
                      <input
                        type="color"
                        value={formData.design.backgroundColor}
                        onChange={(e) => handleDesignChange('backgroundColor', e.target.value)}
                        className="w-full h-12 border border-gray-300 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Background Image */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Background Image
                      </label>
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleBackgroundImageUpload(e.target.files[0])}
                          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-colors"
                        />
                        {uploadingBackground && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                            <span>Uploading...</span>
                          </div>
                        )}
                        {formData.design.backgroundImage && (
                          <div className="relative">
                            <img
                              src={formData.design.backgroundImage}
                              alt="Background"
                              className="w-full h-24 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={() => handleDesignChange('backgroundImage', '')}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Text Colors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Text Color
                        </label>
                        <input
                          type="color"
                          value={formData.design.textColor}
                          onChange={(e) => handleDesignChange('textColor', e.target.value)}
                          className="w-full h-12 border border-gray-300 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Title Color
                        </label>
                        <input
                          type="color"
                          value={formData.design.titleColor}
                          onChange={(e) => handleDesignChange('titleColor', e.target.value)}
                          className="w-full h-12 border border-gray-300 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Price Color
                        </label>
                        <input
                          type="color"
                          value={formData.design.priceColor}
                          onChange={(e) => handleDesignChange('priceColor', e.target.value)}
                          className="w-full h-12 border border-gray-300 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Font Settings */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Font Family
                      </label>
                      <select
                        value={formData.design.fontFamily}
                        onChange={(e) => handleDesignChange('fontFamily', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {fontOptions.map(font => (
                          <option key={font} value={font}>
                            {font.split(',')[0]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Menu Name Toggle */}
                    <div>
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.design.showMenuName}
                          onChange={(e) => handleDesignChange('showMenuName', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Show Menu Name</span>
                      </label>
                    </div>

                    {/* Font Sizes */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Font Sizes</h4>
                      
                      {formData.design.showMenuName && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">
                            Menu Name (px)
                          </label>
                          <input
                            type="number"
                            min={8}
                            max={200}
                            step={1}
                            value={parseFontToPx(formData.design.menuNameFontSize)}
                            onChange={(e) => handleDesignChange('menuNameFontSize', `${e.target.value}px`)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Item Names (px)
                        </label>
                        <input
                          type="number"
                          min={8}
                          max={120}
                          step={1}
                          value={parseFontToPx(formData.design.itemFontSize)}
                          onChange={(e) => handleDesignChange('itemFontSize', `${e.target.value}px`)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Item Descriptions (px)
                        </label>
                        <input
                          type="number"
                          min={8}
                          max={120}
                          step={1}
                          value={parseFontToPx(formData.design.descriptionFontSize)}
                          onChange={(e) => handleDesignChange('descriptionFontSize', `${e.target.value}px`)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Prices (px)
                        </label>
                        <input
                          type="number"
                          min={8}
                          max={120}
                          step={1}
                          value={parseFontToPx(formData.design.priceFontSize)}
                          onChange={(e) => handleDesignChange('priceFontSize', `${e.target.value}px`)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Area */}
            <div className="flex-1 flex items-center justify-center p-4 bg-gray-100">
              <div 
                className="rounded-lg shadow-2xl relative overflow-hidden"
                ref={previewRef}
                style={{
                  width: '1280px', // 1920 * 2/3 for larger preview
                  height: '720px', // 1080 * 2/3 for larger preview (maintains 16:9 ratio)
                  backgroundColor: formData.design.backgroundColor,
                  color: formData.design.textColor,
                  fontFamily: formData.design.fontFamily,
                  backgroundImage: formData.design.backgroundImage ? `url(${formData.design.backgroundImage})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  border: isDragMode ? '2px dashed #3B82F6' : 'none',
                  boxShadow: isDragMode ? '0 0 0 1px rgba(59, 130, 246, 0.1)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
              >
                {/* Background overlay removed for cleaner preview */}
                
                <div className="relative h-full p-12" style={{ zIndex: 2 }}>
                  {formData.design.showMenuName && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${getPosForKey('title').left}%`,
                        top: `${getPosForKey('title').top}%`,
                        transform: 'translate(-0%, -0%)',
                        cursor: isDragMode ? 'move' : 'default',
                        userSelect: isDragMode ? 'none' : 'auto'
                      }}
                      onMouseDown={(e) => {
                        if (isDragMode) {
                          e.preventDefault()
                          setDraggingKey('title')
                        }
                      }}
                    >
                      <h1 
                        className="font-bold"
                        style={{
                          color: formData.design.titleColor,
                          fontSize: formData.design.menuNameFontSize,
                          textAlign: 'center'
                        }}
                      >
                        {formData.name || 'Menu Title'}
                      </h1>
                    </div>
                  )}

                  {formData.description && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${getPosForKey('menuDescription').left}%`,
                        top: `${getPosForKey('menuDescription').top}%`,
                        transform: 'translate(-0%, -0%)',
                        cursor: isDragMode ? 'move' : 'default',
                        userSelect: isDragMode ? 'none' : 'auto'
                      }}
                      onMouseDown={(e) => {
                        if (isDragMode) {
                          e.preventDefault()
                          setDraggingKey('menuDescription')
                        }
                      }}
                    >
                      <p style={{ fontSize: formData.design.descriptionFontSize }}>
                        {formData.description}
                      </p>
                    </div>
                  )}

                  <div className="absolute inset-0" style={{ pointerEvents: isDragMode ? 'auto' : 'none' }} />

                  <div className="flex-1 space-y-6 overflow-y-auto">
                    {formData.menuItems.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-500">
                          <ImageIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg opacity-60">No menu items yet</p>
                          <p className="text-sm">Add items to see your menu preview</p>
                        </div>
                      </div>
                    ) : (
                      formData.menuItems.map((item, index) => (
                        <div key={index}>
                          {/* Item Image */}
                          {item.imageUrl && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${getPosForKey(`item-${index}-image`).left}%`,
                                top: `${getPosForKey(`item-${index}-image`).top}%`,
                                cursor: isDragMode ? 'move' : 'default',
                                userSelect: isDragMode ? 'none' : 'auto'
                              }}
                              onMouseDown={(e) => {
                                if (isDragMode) {
                                  e.preventDefault()
                                  setDraggingKey(`item-${index}-image`)
                                }
                              }}
                            >
                              {(() => {
                                const size = getImageSizeForIndex(index)
                                return (
                                  <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      style={{ width: `${size.width}px`, height: `${size.height}px` }}
                                      className="object-cover rounded-lg shadow-md select-none"
                                      draggable={false}
                                    />
                                    {isDragMode && (
                                      <>
                                        <div
                                          style={{
                                            position: 'absolute',
                                            right: '-6px',
                                            bottom: '-6px',
                                            width: '12px',
                                            height: '12px',
                                            background: '#3B82F6',
                                            borderRadius: '9999px',
                                            cursor: 'se-resize',
                                            boxShadow: '0 0 0 2px white'
                                          }}
                                          onMouseDown={(e) => {
                                            e.stopPropagation()
                                            const current = getImageSizeForIndex(index)
                                            setResizingState({ index, startX: e.clientX, startY: e.clientY, startW: current.width, startH: current.height, handle: 'se' })
                                          }}
                                        />
                                        <div
                                          style={{
                                            position: 'absolute',
                                            right: '-6px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: '12px',
                                            height: '12px',
                                            background: '#3B82F6',
                                            borderRadius: '9999px',
                                            cursor: 'e-resize',
                                            boxShadow: '0 0 0 2px white'
                                          }}
                                          onMouseDown={(e) => {
                                            e.stopPropagation()
                                            const current = getImageSizeForIndex(index)
                                            setResizingState({ index, startX: e.clientX, startY: e.clientY, startW: current.width, startH: current.height, handle: 'e' })
                                          }}
                                        />
                                        <div
                                          style={{
                                            position: 'absolute',
                                            left: '50%',
                                            bottom: '-6px',
                                            transform: 'translateX(-50%)',
                                            width: '12px',
                                            height: '12px',
                                            background: '#3B82F6',
                                            borderRadius: '9999px',
                                            cursor: 's-resize',
                                            boxShadow: '0 0 0 2px white'
                                          }}
                                          onMouseDown={(e) => {
                                            e.stopPropagation()
                                            const current = getImageSizeForIndex(index)
                                            setResizingState({ index, startX: e.clientX, startY: e.clientY, startW: current.width, startH: current.height, handle: 's' })
                                          }}
                                        />
                                      </>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                          {/* Item Name */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${getPosForKey(`item-${index}-name`).left}%`,
                              top: `${getPosForKey(`item-${index}-name`).top}%`,
                              cursor: isDragMode ? 'move' : 'default',
                              userSelect: isDragMode ? 'none' : 'auto'
                            }}
                            onMouseDown={(e) => {
                              if (isDragMode) {
                                e.preventDefault()
                                setDraggingKey(`item-${index}-name`)
                              }
                            }}
                          >
                            <h3 
                              className="font-semibold"
                              style={{ fontSize: formData.design.itemFontSize }}
                            >
                              {item.name || 'Item Name'}
                            </h3>
                          </div>

                          {/* Item Description */}
                          {item.description && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${getPosForKey(`item-${index}-desc`).left}%`,
                                top: `${getPosForKey(`item-${index}-desc`).top}%`,
                                cursor: isDragMode ? 'move' : 'default',
                                userSelect: isDragMode ? 'none' : 'auto'
                              }}
                              onMouseDown={(e) => {
                                if (isDragMode) {
                                  e.preventDefault()
                                  setDraggingKey(`item-${index}-desc`)
                                }
                              }}
                            >
                              <p className="opacity-80" style={{ fontSize: formData.design.descriptionFontSize }}>{item.description}</p>
                            </div>
                          )}

                          {/* Item Price */}
                          {item.price && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${getPosForKey(`item-${index}-price`).left}%`,
                                top: `${getPosForKey(`item-${index}-price`).top}%`,
                                cursor: isDragMode ? 'move' : 'default',
                                userSelect: isDragMode ? 'none' : 'auto'
                              }}
                              onMouseDown={(e) => {
                                if (isDragMode) {
                                  e.preventDefault()
                                  setDraggingKey(`item-${index}-price`)
                                }
                              }}
                            >
                              <span 
                                className="font-bold"
                                style={{
                                  color: formData.design.priceColor,
                                  fontSize: formData.design.priceFontSize
                                }}
                              >
                                {item.price}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TextMenuCreator 