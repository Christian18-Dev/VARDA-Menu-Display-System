import { useState, useEffect } from 'react'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  getDisplays, 
  getMenus, 
  uploadMenu, 
  deleteMenu, 
  updateDisplayMenus,
  createDisplay,
  deleteDisplay 
} from '../services/api'
import { fixMenuImageUrls } from '../utils/imageUtils'
import { 
  Upload, 
  Monitor, 
  Image, 
  Trash2, 
  Plus, 
  Wifi, 
  WifiOff,
  Settings,
  Eye,
  Clock,
  Grid,
  List,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Type,
  Edit3,
  LogOut,
  User
} from 'lucide-react'
import TextMenuCreator from './TextMenuCreator'

// Glassmorphic confirmation modal
const ConfirmModal = ({ open, title, message, onCancel, onConfirm, confirmText = 'Delete', loading = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 max-w-sm w-full text-center animate-fade-in">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors shadow-md"
            disabled={loading}
          >
            {loading ? 'Deleting...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Glassmorphic modal for forms
const GlassModal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 max-w-lg w-full animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-bold text-gray-900">{title}</h4>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none px-2">×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { socket, isConnected } = useSocket()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [displays, setDisplays] = useState([])
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('displays')
  const [viewMode, setViewMode] = useState('grid') // grid or list
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [selectedDisplayBranch, setSelectedDisplayBranch] = useState('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  // Custom menu states
  const [showTextMenuCreator, setShowTextMenuCreator] = useState(false)
  const [editingMenu, setEditingMenu] = useState(null)
  
  // Form states
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    category: 'general',
    branch: 'Ateneo',
    images: []
  })
  const [displayForm, setDisplayForm] = useState({
    name: '',
    displayId: '',
    location: '',
    branch: 'Ateneo'
  })
  const [displayMenus, setDisplayMenus] = useState({}) // { displayId: { menuIds: [], slideshowInterval: 5000, transitionType: 'normal' } }

  // Accordion state for expanded display
  const [expandedDisplayId, setExpandedDisplayId] = useState(null);

  // Modal state for delete confirmation
  const [modal, setModal] = useState({ open: false, type: '', id: null, name: '', loading: false });

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (socket) {
      socket.on('update-success', handleUpdateSuccess)
      return () => {
        socket.off('update-success', handleUpdateSuccess)
      }
    }
  }, [socket])

  // Auto-hide messages after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [displaysRes, menusRes] = await Promise.all([
        getDisplays(),
        getMenus()
      ])
      
      // Fix image URLs for menus
      const fixedMenus = menusRes.data.map(menu => fixMenuImageUrls(menu))
      const fixedDisplays = displaysRes.data.map(display => ({
        ...display,
        currentMenus: display.currentMenus?.map(cm => ({
          ...cm,
          menu: cm.menu ? fixMenuImageUrls(cm.menu) : cm.menu
        }))
      }))
      
      setDisplays(fixedDisplays)
      setMenus(fixedMenus)
      
      // Initialize display menus state
      const displayMenusState = {}
      fixedDisplays.forEach(display => {
        displayMenusState[display.displayId] = {
          menuIds: display.currentMenus?.map(cm => cm.menu?._id).filter(Boolean) || [],
          slideshowInterval: display.slideshowInterval || 5000,
          transitionType: display.transitionType || 'normal'
        }
      })
      setDisplayMenus(displayMenusState)
    } catch (error) {
      console.error('Error fetching data:', error)
      setErrorMessage('Failed to load data. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSuccess = (data) => {
    console.log('Update successful:', data)
    setSuccessMessage('Settings updated successfully!')
    fetchData() // Refresh data
  }

  const handleMenuUpload = async (e) => {
    e.preventDefault()
    if (!menuForm.images.length) {
      setErrorMessage('Please select at least one image')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      menuForm.images.forEach((image, index) => {
        formData.append('menuImages', image)
      })
      formData.append('name', menuForm.name)
      formData.append('description', menuForm.description)
      formData.append('category', menuForm.category)
      formData.append('branch', menuForm.branch)

      await uploadMenu(formData)
      setMenuForm({ name: '', description: '', category: 'general', branch: 'Ateneo', images: [] })
      setSuccessMessage('Menu uploaded successfully!')
      fetchData()
    } catch (error) {
      console.error('Upload error:', error)
      setErrorMessage('Failed to upload menu. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleCreateDisplay = async (e) => {
    e.preventDefault()
    try {
      await createDisplay(displayForm)
      setDisplayForm({ name: '', displayId: '', location: '', branch: 'Ateneo' })
      setShowCreateForm(false)
      setSuccessMessage('Display created successfully!')
      fetchData()
    } catch (error) {
      console.error('Create display error:', error)
      setErrorMessage('Failed to create display. Please try again.')
    }
  }

  const handleAssignMenus = async (displayId) => {
    const displayData = displayMenus[displayId]
    if (!displayData) return
    
    try {
      await updateDisplayMenus(displayId, displayData.menuIds, displayData.slideshowInterval, displayData.transitionType)
      if (socket) {
        socket.emit('update-display', { 
          displayId, 
          menuIds: displayData.menuIds, 
          slideshowInterval: displayData.slideshowInterval,
          transitionType: displayData.transitionType
        })
      }
      setSuccessMessage('Display settings updated!')
    } catch (error) {
      console.error('Assign menus error:', error)
      setErrorMessage('Failed to update display settings.')
    }
  }

  const openDeleteModal = (type, id, name) => {
    setModal({ open: true, type, id, name, loading: false });
  };
  const closeModal = () => setModal({ ...modal, open: false, loading: false });

  const handleDeleteMenu = async (menuId, menuName) => {
    openDeleteModal('menu', menuId, menuName);
  };

  const confirmDeleteMenu = async () => {
    setModal((m) => ({ ...m, loading: true }));
    try {
      await deleteMenu(modal.id);
      setSuccessMessage('Menu deleted successfully!');
      fetchData();
    } catch (error) {
      console.error('Delete menu error:', error);
      setErrorMessage('Failed to delete menu.');
    } finally {
      closeModal();
    }
  };

  const handleDeleteDisplay = async (displayId, displayName) => {
    openDeleteModal('display', displayId, displayName);
  };

  const confirmDeleteDisplay = async () => {
    setModal((m) => ({ ...m, loading: true }));
    try {
      await deleteDisplay(modal.id);
      setSuccessMessage('Display deleted successfully!');
      fetchData();
    } catch (error) {
      console.error('Delete display error:', error);
      setErrorMessage('Failed to delete display.');
    } finally {
      closeModal();
    }
  };

  const getDisplayUrl = (displayId) => {
    return `${window.location.origin}/VARDA-Menu-Display-System/display/${displayId}`
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)
    setMenuForm({ ...menuForm, images: files })
  }

  const handleDisplayMenuChange = (displayId, menuIds) => {
    setDisplayMenus(prev => ({
      ...prev,
      [displayId]: {
        ...prev[displayId],
        menuIds: menuIds
      }
    }))
  }

  const handleSlideshowIntervalChange = (displayId, interval) => {
    setDisplayMenus(prev => ({
      ...prev,
      [displayId]: {
        ...prev[displayId],
        slideshowInterval: interval
      }
    }))
  }

  const handleTransitionTypeChange = (displayId, transitionType) => {
    setDisplayMenus(prev => ({
      ...prev,
      [displayId]: {
        ...prev[displayId],
        transitionType: transitionType
      }
    }))
  }

  const handleTextMenuSave = () => {
    setShowTextMenuCreator(false)
    setEditingMenu(null)
    setSuccessMessage('Custom menu saved successfully!')
    fetchData()
  }

  const handleTextMenuCancel = () => {
    setShowTextMenuCreator(false)
    setEditingMenu(null)
  }

  const handleEditTextMenu = (menu) => {
    setEditingMenu(menu)
    setShowTextMenuCreator(true)
  }

  const handleCreateTextMenu = () => {
    setEditingMenu(null)
    setShowTextMenuCreator(true)
  }

  // Filter menus based on search and category
  const filteredMenus = menus.filter(menu => {
    const matchesSearch = menu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         menu.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || menu.category === selectedCategory
    const matchesBranch = selectedBranch === 'all' || menu.branch === selectedBranch
    return matchesSearch && matchesCategory && matchesBranch
  })

  // Filter displays based on branch
  const filteredDisplays = displays.filter(display => {
    const matchesBranch = selectedDisplayBranch === 'all' || display.branch === selectedDisplayBranch
    return matchesBranch
  })

  // Separate custom menus and image menus
  const customMenus = menus.filter(menu => menu.menuType === 'custom')
  const imageMenus = menus.filter(menu => menu.menuType === 'image' || !menu.menuType)

  const categories = ['all', 'general', 'breakfast', 'lunch', 'dinner', 'drinks']

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/30 backdrop-blur-lg border-b border-white/40 shadow-xl rounded-b-3xl transition-all duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">VARDA Menu System</h1>
              <p className="text-gray-600">Admin Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchData}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <Wifi className="h-4 w-4" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-red-600">
                    <WifiOff className="h-4 w-4" />
                    <span className="text-sm">Disconnected</span>
                  </div>
                )}
              </div>
              
              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700">
                  <User className="h-4 w-4" />
                  <span>{user?.username || user?.email}</span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-800">{errorMessage}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="-mb-px flex space-x-8 bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg p-2 border border-white/30">
            <button
              onClick={() => setActiveTab('displays')}
              className={`py-3 px-6 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 border-2 ${
                activeTab === 'displays'
                  ? 'bg-gradient-to-r from-indigo-400 via-blue-300 to-pink-200 text-indigo-900 border-indigo-400 shadow-lg'
                  : 'bg-white/60 text-gray-600 border-transparent hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              <Monitor className="inline h-4 w-4 mr-2" />
              Displays ({filteredDisplays.length})
            </button>
            <button
              onClick={() => setActiveTab('menus')}
              className={`py-3 px-6 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 border-2 ${
                activeTab === 'menus'
                  ? 'bg-gradient-to-r from-indigo-400 via-blue-300 to-pink-200 text-indigo-900 border-indigo-400 shadow-lg'
                  : 'bg-white/60 text-gray-600 border-transparent hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              <Image className="inline h-4 w-4 mr-2" />
              Menus ({menus.length})
            </button>
            <button
              onClick={() => setActiveTab('custom-menus')}
              className={`py-3 px-6 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 border-2 ${
                activeTab === 'custom-menus'
                  ? 'bg-gradient-to-r from-indigo-400 via-blue-300 to-pink-200 text-indigo-900 border-indigo-400 shadow-lg'
                  : 'bg-white/60 text-gray-600 border-transparent hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              <Type className="inline h-4 w-4 mr-2" />
              Custom Menu
            </button>
          </nav>
        </div>

        {/* Displays Tab */}
        {activeTab === 'displays' && (
          <div className="space-y-6">
            {/* Create Display Section */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <h3 className="text-lg font-medium text-gray-900">Display Management</h3>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <select
                      value={selectedDisplayBranch} 
                      onChange={(e) => setSelectedDisplayBranch(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Branches</option>
                      <option value="Ateneo">Ateneo</option>
                      <option value="Lasalle">Lasalle</option>
                      <option value="PUP">PUP</option>
                      <option value="UST">UST</option>
                      <option value="FEU">FEU</option>
                      <option value="Mapua">Mapua</option>
                    </select>
                    <button
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Display</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <GlassModal open={showCreateForm} onClose={() => setShowCreateForm(false)} title="Create New Display">
                <form onSubmit={handleCreateDisplay} className="flex flex-col gap-5 items-center">
                  <input
                    type="text"
                    placeholder="Display Name"
                    value={displayForm.name}
                    onChange={(e) => setDisplayForm({...displayForm, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Display ID (unique)"
                    value={displayForm.displayId}
                    onChange={(e) => setDisplayForm({...displayForm, displayId: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={displayForm.location}
                    onChange={(e) => setDisplayForm({...displayForm, location: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                    required
                  />
                  <select
                    value={displayForm.branch}
                    onChange={(e) => setDisplayForm({...displayForm, branch: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  >
                    <option value="Ateneo">Ateneo</option>
                    <option value="Lasalle">Lasalle</option>
                    <option value="PUP">PUP</option>
                    <option value="UST">UST</option>
                    <option value="FEU">FEU</option>
                    <option value="Mapua">Mapua</option>
                  </select>
                  <div className="flex w-full gap-3 mt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-primary-600 text-white px-4 py-3 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors text-base"
                    >
                      <Plus className="inline h-4 w-4 mr-2" />
                      Create Display
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-base"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </GlassModal>
            </div>

            {/* Displays List */}
            <div className="bg-white/40 backdrop-blur-lg rounded-3xl shadow-xl border border-white/30">
              <div className="px-6 py-4 border-b border-white/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <h3 className="text-lg font-medium text-gray-900">Display Screens</h3>
                </div>
              </div>
              <div className="divide-y divide-white/20">
                {filteredDisplays.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Monitor className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No displays found.</p>
                    <p className="text-sm">Create your first display to get started.</p>
                  </div>
                ) : (
                  filteredDisplays.map((display) => {
                    const isExpanded = expandedDisplayId === display._id;
                    return (
                      <div key={display._id} className="transition-all">
                        {/* Accordion summary row */}
                        <div
                          className={`w-full flex items-center justify-between px-6 py-4 bg-white/60 hover:bg-indigo-50 rounded-2xl transition-all duration-200 cursor-pointer ${isExpanded ? 'shadow-lg' : ''}`}
                          onClick={() => setExpandedDisplayId(isExpanded ? null : display._id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedDisplayId(isExpanded ? null : display._id);
                            }
                          }}
                          aria-expanded={isExpanded}
                        >
                          <div className="flex-1 text-left">
                            <div className="flex items-center space-x-3 mb-1">
                              <h4 className="text-lg font-semibold text-gray-900">{display.name}</h4>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {display.currentMenus?.length || 0} menu(s)
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                              <div><span className="font-medium">ID:</span> {display.displayId}</div>
                              <div><span className="font-medium">Location:</span> {display.location}</div>
                              <div><span className="font-medium">Branch:</span> {display.branch || 'Ateneo'}</div>
                              <div><span className="font-medium">Last Seen:</span> {new Date(display.lastSeen).toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 ml-4">
                            <a
                              href={getDisplayUrl(display.displayId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              <Eye className="h-4 w-4" />
                              <span>View</span>
                            </a>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteDisplay(display.displayId, display.name); }}
                              className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
                              title="Delete display"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Delete</span>
                            </button>
                            <span className={`ml-2 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                            </span>
                          </div>
                        </div>
                        {/* Accordion details row */}
                        {isExpanded && (
                          <div className="px-6 pb-6 pt-2">
                            <div className="mt-2 p-4 bg-white/80 rounded-2xl shadow-xl scale-105 transition-all duration-300 border border-indigo-100">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-medium text-gray-900">Menu Assignment for {display.name}</h5>
                                <button
                                  onClick={() => handleAssignMenus(display.displayId)}
                                  className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 transition-colors"
                                >
                                  Apply Changes
                                </button>
                              </div>
                              {/* Current Assignment Preview */}
                              {displayMenus[display.displayId]?.menuIds.length > 0 && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                  <p className="text-sm font-medium text-blue-800 mb-2">
                                    Currently Assigned ({displayMenus[display.displayId].menuIds.length} menu(s)):
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {displayMenus[display.displayId].menuIds.map(menuId => {
                                      const menu = menus.find(m => m._id === menuId)
                                      return menu ? (
                                        <span key={menuId} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                          {menu.name} ({menu.menuType === 'custom' ? `${menu.menuItems?.length || 0} items` : `${menu.images?.length || 0} images`})
                                        </span>
                                      ) : null
                                    })}
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Menus for this Display (Ctrl+Click for multiple)
                                  </label>
                                  <select
                                    multiple
                                    value={displayMenus[display.displayId]?.menuIds || []}
                                    onChange={(e) => {
                                      const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
                                      handleDisplayMenuChange(display.displayId, selectedOptions)
                                    }}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-32"
                                  >
                                    {menus.map((menu) => (
                                      <option key={menu._id} value={menu._id}>
                                        {menu.name} ({menu.menuType === 'custom' ? `${menu.menuItems?.length || 0} items` : `${menu.images?.length || 0} images`})
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Only this display will show these menus
                                  </p>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Slideshow Interval for this Display
                                    </label>
                                    <div className="flex items-center space-x-2">
                                      <Clock className="h-4 w-4 text-gray-500" />
                                      <input
                                        type="number"
                                        min="1000"
                                        max="30000"
                                        step="1000"
                                        value={displayMenus[display.displayId]?.slideshowInterval || 5000}
                                        onChange={(e) => handleSlideshowIntervalChange(display.displayId, parseInt(e.target.value))}
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                      />
                                      <span className="text-sm text-gray-500">ms</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Time between image transitions for this display only
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Transition Type
                                    </label>
                                    <select
                                      value={displayMenus[display.displayId]?.transitionType || 'normal'}
                                      onChange={(e) => handleTransitionTypeChange(display.displayId, e.target.value)}
                                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    >
                                      <option value="normal">Normal Slideshow</option>
                                      <option value="scrolling">Scrolling Animation</option>
                                      <option value="push">Push Animation</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Normal: Fade between images | Scrolling: Images scroll down the screen | Push: Images slide upward
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Menus Tab */}
        {activeTab === 'menus' && (
          <div className="space-y-6">
            {/* Upload Menu Section */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Upload New Menu</h3>
              </div>
              <div className="p-6">
                <form onSubmit={handleMenuUpload} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Menu Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter menu name"
                        value={menuForm.name}
                        onChange={(e) => setMenuForm({...menuForm, name: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </label>
                      <select
                        value={menuForm.category}
                        onChange={(e) => setMenuForm({...menuForm, category: e.target.value})}
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Branch
                      </label>
                      <select
                        value={menuForm.branch}
                        onChange={(e) => setMenuForm({...menuForm, branch: e.target.value})}
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
                      placeholder="Enter menu description"
                      value={menuForm.description}
                      onChange={(e) => setMenuForm({...menuForm, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows="3"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Images (select multiple for slideshow) *
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-colors"
                        required
                      />
                      {menuForm.images.length > 0 && (
                        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-800">
                            ✓ Selected {menuForm.images.length} image(s)
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Images will be displayed in the order selected
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-primary-600 text-white px-4 py-3 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </div>
                    ) : (
                      <>
                        <Upload className="inline h-4 w-4 mr-2" />
                        Upload Menu
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Menus Management Section */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <h3 className="text-lg font-medium text-gray-900">Uploaded Menus</h3>
                  
                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search menus..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Branches</option>
                      <option value="Ateneo">Ateneo</option>
                      <option value="Lasalle">Lasalle</option>
                      <option value="PUP">PUP</option>
                      <option value="UST">UST</option>
                      <option value="FEU">FEU</option>
                      <option value="Mapua">Mapua</option>
                    </select>
                    <div className="flex border border-gray-300 rounded-md">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        <Grid className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-2 ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {filteredMenus.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Image className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No menus found.</p>
                    <p className="text-sm">Upload your first menu to get started.</p>
                  </div>
                ) : (
                  <div className={viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
                    : "space-y-4"
                  }>
                    {filteredMenus.map((menu) => (
                      <div key={menu._id} className={`border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow ${
                        viewMode === 'list' ? 'flex' : ''
                      }`}>
                        {menu.images && menu.images.length > 0 && (
                          <div className={`relative ${viewMode === 'list' ? 'w-48 flex-shrink-0' : ''}`}>
                            <img
                              src={menu.images[0].imageUrl}
                              alt={menu.name}
                              className={`${viewMode === 'list' ? 'h-32 w-full' : 'h-48 w-full'} object-cover`}
                            />
                            {menu.images.length > 1 && (
                              <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                                +{menu.images.length - 1} more
                              </div>
                            )}
                          </div>
                        )}
                        <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-lg font-medium text-gray-900">{menu.name}</h4>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                menu.menuType === 'custom' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {menu.menuType === 'custom' ? 'Custom' : 'Image'}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteMenu(menu._id, menu.name)}
                              className="text-red-600 hover:text-red-700 transition-colors"
                              title="Delete menu"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {menu.description && (
                            <p className="text-sm text-gray-600 mb-2">{menu.description}</p>
                          )}
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                              <span className="capitalize">{menu.category}</span>
                              <span className="text-gray-300">•</span>
                              <span className="capitalize">{menu.branch || 'main'}</span>
                            </div>
                            <span>
                              {menu.menuType === 'custom' 
                                ? `${menu.menuItems?.length || 0} items` 
                                : `${menu.images?.length || 0} images`
                              }
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-gray-400">
                            {new Date(menu.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Custom Menus Tab */}
        {activeTab === 'custom-menus' && (
          <div className="space-y-6">
            {/* Custom Menu Creator Section */}
            {showTextMenuCreator ? (
              <TextMenuCreator 
                menu={editingMenu}
                onSave={handleTextMenuSave}
                onCancel={handleTextMenuCancel}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Custom Menu Management</h3>
                    <button
                      onClick={handleCreateTextMenu}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Custom Menu</span>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {customMenus.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Type className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No custom menus created yet.</p>
                      <p className="text-sm">Create your first custom menu to get started.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {customMenus.map((menu) => (
                        <div key={menu._id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-lg font-medium text-gray-900">{menu.name}</h4>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Custom
                                </span>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditTextMenu(menu)}
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                  title="Edit menu"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMenu(menu._id, menu.name)}
                                  className="text-red-600 hover:text-red-700 transition-colors"
                                  title="Delete menu"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {menu.description && (
                              <p className="text-sm text-gray-600 mb-2">{menu.description}</p>
                            )}
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div className="flex items-center space-x-2">
                                <span className="capitalize">{menu.category}</span>
                                <span className="text-gray-300">•</span>
                                <span className="capitalize">{menu.branch || 'main'}</span>
                              </div>
                              <span>{menu.menuItems?.length || 0} items</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-400">
                              {new Date(menu.createdAt).toLocaleDateString()}
                            </div>
                            
                            {/* Preview of menu items */}
                            {menu.menuItems && menu.menuItems.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-2">Preview:</p>
                                <div className="space-y-1">
                                  {menu.menuItems.slice(0, 3).map((item, index) => (
                                    <div key={index} className="flex items-center justify-between text-xs">
                                      <span className="truncate">{item.name}</span>
                                      {item.price && <span className="text-gray-500">{item.price}</span>}
                                    </div>
                                  ))}
                                  {menu.menuItems.length > 3 && (
                                    <p className="text-xs text-gray-400">+{menu.menuItems.length - 3} more items</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={modal.open}
        title={modal.type === 'display' ? 'Delete Display?' : 'Delete Menu?'}
        message={modal.type === 'display'
          ? `Are you sure you want to delete the display "${modal.name}"? This action cannot be undone.`
          : `Are you sure you want to delete the menu "${modal.name}"? This action cannot be undone.`}
        onCancel={closeModal}
        onConfirm={modal.type === 'display' ? confirmDeleteDisplay : confirmDeleteMenu}
        confirmText="Delete"
        loading={modal.loading}
      />
    </div>
  )
}

export default AdminDashboard 