import { useState } from 'react'
import { 
  Plus, 
  Trash2, 
  Upload, 
  Palette, 
  Type, 
  Save,
  Edit3,
  Image as ImageIcon
} from 'lucide-react'
import { createCustomMenu, updateMenu, uploadItemImage } from '../services/api'

const TextMenuCreator = ({ menu = null, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: menu?.name || '',
    description: menu?.description || '',
    category: menu?.category || 'general',
    menuItems: menu?.menuItems || [],
    design: menu?.design || {
      backgroundColor: '#000000',
      textColor: '#FFFFFF',
      titleColor: '#FFD700',
      priceColor: '#FF6B6B',
      fontFamily: 'Arial, sans-serif',
      titleFontSize: '3rem',
      itemFontSize: '1.5rem',
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
              onClick={() => setShowDesignPanel(!showDesignPanel)}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
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

          {/* Design Panel */}
          {showDesignPanel && (
            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
                  <Palette className="h-4 w-4 mr-2" />
                  Design Settings
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Background Color
                    </label>
                    <input
                      type="color"
                      value={formData.design.backgroundColor}
                      onChange={(e) => handleDesignChange('backgroundColor', e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Background Image (optional)
                    </label>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleBackgroundImageUpload(e.target.files[0])}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-colors"
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
                            className="w-full h-20 object-cover rounded-md border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleDesignChange('backgroundImage', '')}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Text Color
                    </label>
                    <input
                      type="color"
                      value={formData.design.textColor}
                      onChange={(e) => handleDesignChange('textColor', e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title Color
                    </label>
                    <input
                      type="color"
                      value={formData.design.titleColor}
                      onChange={(e) => handleDesignChange('titleColor', e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price Color
                    </label>
                    <input
                      type="color"
                      value={formData.design.priceColor}
                      onChange={(e) => handleDesignChange('priceColor', e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Font Family
                    </label>
                    <select
                      value={formData.design.fontFamily}
                      onChange={(e) => handleDesignChange('fontFamily', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {fontOptions.map(font => (
                        <option key={font} value={font}>
                          {font.split(',')[0]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.design.showMenuName}
                        onChange={(e) => handleDesignChange('showMenuName', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Show Menu Name</span>
                    </label>
                  </div>

                  {formData.design.showMenuName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Menu Name Font Size
                      </label>
                      <select
                        value={formData.design.menuNameFontSize}
                        onChange={(e) => handleDesignChange('menuNameFontSize', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="2rem">Small</option>
                        <option value="3rem">Medium</option>
                        <option value="4rem">Large</option>
                        <option value="5rem">Extra Large</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title Font Size
                    </label>
                    <select
                      value={formData.design.titleFontSize}
                      onChange={(e) => handleDesignChange('titleFontSize', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="2rem">Small</option>
                      <option value="3rem">Medium</option>
                      <option value="4rem">Large</option>
                      <option value="5rem">Extra Large</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item Font Size
                    </label>
                    <select
                      value={formData.design.itemFontSize}
                      onChange={(e) => handleDesignChange('itemFontSize', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="1rem">Small</option>
                      <option value="1.5rem">Medium</option>
                      <option value="2rem">Large</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price Font Size
                    </label>
                    <select
                      value={formData.design.priceFontSize}
                      onChange={(e) => handleDesignChange('priceFontSize', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="1rem">Small</option>
                      <option value="1.2rem">Medium</option>
                      <option value="1.5rem">Large</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        {formData.menuItems.length > 0 && (
          <div className="mt-8">
            <h4 className="text-md font-medium text-gray-900 mb-4">Preview</h4>
            <div 
              className="border border-gray-300 rounded-lg p-6 relative overflow-hidden"
              style={{
                backgroundColor: formData.design.backgroundColor,
                color: formData.design.textColor,
                fontFamily: formData.design.fontFamily,
                backgroundImage: formData.design.backgroundImage ? `url(${formData.design.backgroundImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {/* Background overlay for better text readability */}
              {formData.design.backgroundImage && (
                <div 
                  className="absolute inset-0 bg-black bg-opacity-40"
                  style={{ zIndex: 1 }}
                ></div>
              )}
              
              <div className="relative" style={{ zIndex: 2 }}>
                {formData.design.showMenuName && (
                  <h2 
                    className="text-center mb-6 font-bold"
                    style={{
                      color: formData.design.titleColor,
                      fontSize: formData.design.menuNameFontSize
                    }}
                  >
                    {formData.name || 'Menu Title'}
                  </h2>
                )}
                
                {formData.description && (
                  <p className="text-center mb-6 opacity-80" style={{ fontSize: formData.design.itemFontSize }}>
                    {formData.description}
                  </p>
                )}

                <div className="space-y-4">
                  {formData.menuItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-16 w-16 object-cover rounded-md"
                          />
                        )}
                        <div>
                          <h3 
                            className="font-semibold"
                            style={{ fontSize: formData.design.itemFontSize }}
                          >
                            {item.name || 'Item Name'}
                          </h3>
                          {item.description && (
                            <p className="opacity-80 text-sm">{item.description}</p>
                          )}
                        </div>
                      </div>
                      {item.price && (
                        <span 
                          className="font-bold"
                          style={{
                            color: formData.design.priceColor,
                            fontSize: formData.design.priceFontSize
                          }}
                        >
                          {item.price}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
    </div>
  )
}

export default TextMenuCreator 