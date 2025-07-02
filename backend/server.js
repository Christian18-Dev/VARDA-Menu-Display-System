const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { createServer } = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
require('dotenv').config();

const app = express();
const server = createServer(app);

// Trust proxy for rate limiting (needed when deployed behind a proxy like Render)
app.set('trust proxy', 1);
// CORS configuration for both development and production
const allowedOrigins = [
  "http://localhost:5173", 
  "http://localhost:3000", 
  "http://localhost:3001",
  "https://christian18-dev.github.io",
  "https://varda-menu-display-system.onrender.com" // Your actual Render backend URL
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Note: No longer using local file storage - images are stored as Base64 in MongoDB

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const Display = require('./models/Display');
const Menu = require('./models/Menu');
const User = require('./models/User');

// Import authentication middleware and routes
const { authenticateToken, requireAdmin } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

// Utility function to handle image URLs (now supports both Base64 and external URLs)
const fixImageUrls = (data) => {
  try {
    // Handle null/undefined data
    if (!data) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => fixImageUrls(item));
    }
    
    if (data && typeof data === 'object') {
      const fixed = { ...data };
      
      // Handle menu images (Base64 or external URLs)
      if (fixed.images && Array.isArray(fixed.images)) {
        fixed.images = fixed.images.map(image => {
          if (!image || typeof image !== 'object') return image;
          return {
            ...image,
            // Keep Base64 URLs as-is, only fix relative URLs if they exist
            imageUrl: image.imageUrl && typeof image.imageUrl === 'string' && 
                     !image.imageUrl.startsWith('data:') && 
                     !image.imageUrl.startsWith('http') 
              ? `${process.env.BACKEND_URL || 'https://varda-menu-display-system.onrender.com'}${image.imageUrl}` 
              : image.imageUrl
          };
        });
      }
      
      // Handle menu items with images
      if (fixed.menuItems && Array.isArray(fixed.menuItems)) {
        fixed.menuItems = fixed.menuItems.map(item => {
          if (!item || typeof item !== 'object') return item;
          return {
            ...item,
            imageUrl: item.imageUrl && typeof item.imageUrl === 'string' && 
                     !item.imageUrl.startsWith('data:') && 
                     !item.imageUrl.startsWith('http') 
              ? `${process.env.BACKEND_URL || 'https://varda-menu-display-system.onrender.com'}${item.imageUrl}` 
              : item.imageUrl
          };
        });
      }
      
      // Handle background image
      if (fixed.design && fixed.design.backgroundImage && 
          typeof fixed.design.backgroundImage === 'string' && 
          !fixed.design.backgroundImage.startsWith('data:') && 
          !fixed.design.backgroundImage.startsWith('http')) {
        fixed.design.backgroundImage = `${process.env.BACKEND_URL || 'https://varda-menu-display-system.onrender.com'}${fixed.design.backgroundImage}`;
      }
      
      return fixed;
    }
    
    return data;
  } catch (error) {
    console.error('Error in fixImageUrls:', error);
    return data; // Return original data if there's an error
  }
};

// Socket connection tracking
const connectedClients = new Map();

// Helper function for formatted logging
const logSocketEvent = (event, socketId, additionalInfo = '') => {
  const timestamp = new Date().toISOString();
  const shortId = socketId.substring(0, 8);
  const eventEmoji = event === 'connect' ? '🔗' : event === 'disconnect' ? '🔌' : '📡';
  const eventText = event === 'connect' ? 'CONNECTED' : event === 'disconnect' ? 'DISCONNECTED' : event.toUpperCase();
  
  console.log(`${eventEmoji} [${timestamp}] ${eventText} | ID: ${shortId}... | ${additionalInfo}`);
};

// Periodic status logging every 60 seconds
const logSystemStatus = () => {
  const timestamp = new Date().toISOString();
  const totalClients = connectedClients.size;
  
  // Count displays vs admin clients
  let displayClients = 0;
  let adminClients = 0;
  const connectedDisplays = [];
  
  connectedClients.forEach((clientInfo, socketId) => {
    if (clientInfo.displayId) {
      displayClients++;
      connectedDisplays.push(clientInfo.displayId);
    } else {
      adminClients++;
    }
  });
  
  console.log(`\n📊 [${timestamp}] SYSTEM STATUS | Total Clients: ${totalClients} | Displays: ${displayClients} | Admin: ${adminClients}`);
  
  if (connectedDisplays.length > 0) {
    console.log(`   📺 Connected Displays: ${connectedDisplays.join(', ')}`);
  }
  
  if (totalClients === 0) {
    console.log(`   ⚠️  No active connections`);
  }
  
  console.log(''); // Empty line for better readability
};

// Start periodic logging
setInterval(logSystemStatus, 60000); // 60 seconds = 60000ms

// Socket.IO connection handling
io.on('connection', (socket) => {
  const connectionTime = new Date();
  connectedClients.set(socket.id, { connectionTime, displayId: null });
  
  logSocketEvent('connect', socket.id, `Total clients: ${connectedClients.size}`);

  // Handle display registration
  socket.on('register-display', async (displayId) => {
    try {
      const display = await Display.findOne({ displayId });
      if (display) {
        display.lastSeen = new Date();
        await display.save();
        socket.join(`display-${displayId}`);
        
        // Update client tracking
        const clientInfo = connectedClients.get(socket.id);
        if (clientInfo) {
          clientInfo.displayId = displayId;
          connectedClients.set(socket.id, clientInfo);
        }
        
        socket.emit('display-registered', { success: true, display });
        logSocketEvent('register-display', socket.id, `Display: ${displayId} | Name: ${display.name}`);
      } else {
        socket.emit('display-registered', { success: false, message: 'Display not found' });
        logSocketEvent('register-display', socket.id, `FAILED - Display not found: ${displayId}`);
      }
    } catch (error) {
      console.error('Display registration error:', error);
      socket.emit('display-registered', { success: false, message: 'Registration failed' });
      logSocketEvent('register-display', socket.id, `ERROR - ${error.message}`);
    }
  });

  // Handle admin updates
  socket.on('update-display', async (data) => {
    try {
      const { displayId, menuIds, slideshowInterval, transitionType } = data;
      const display = await Display.findOne({ displayId });
      if (display) {
        // Update menus with order
        display.currentMenus = menuIds.map((menuId, index) => ({
          menu: menuId,
          order: index
        }));
        
        if (slideshowInterval) {
          display.slideshowInterval = slideshowInterval;
        }
        
        if (transitionType) {
          display.transitionType = transitionType;
        }
        
        await display.save();
        
        // Emit to specific display
        io.to(`display-${displayId}`).emit('menus-updated', { menuIds, slideshowInterval, transitionType });
        
        // Emit to admin for confirmation
        socket.emit('update-success', { displayId, menuIds, slideshowInterval, transitionType });
        
        logSocketEvent('update-display', socket.id, `Display: ${displayId} | Menus: ${menuIds.length} | Interval: ${slideshowInterval}s`);
      }
    } catch (error) {
      console.error('Update display error:', error);
      socket.emit('update-error', { message: 'Update failed' });
      logSocketEvent('update-display', socket.id, `ERROR - ${error.message}`);
    }
  });

  socket.on('disconnect', () => {
    const clientInfo = connectedClients.get(socket.id);
    const connectionDuration = clientInfo ? Math.round((new Date() - clientInfo.connectionTime) / 1000) : 0;
    const displayInfo = clientInfo?.displayId ? ` | Display: ${clientInfo.displayId}` : '';
    
    connectedClients.delete(socket.id);
    
    logSocketEvent('disconnect', socket.id, `Duration: ${connectionDuration}s${displayInfo} | Remaining clients: ${connectedClients.size}`);
  });
});

// API Routes

// Authentication routes
app.use('/api/auth', authRoutes);

// Get all displays
app.get('/api/displays', async (req, res) => {
  try {
    const displays = await Display.find().populate({
      path: 'currentMenus.menu',
      model: 'Menu'
    });
    res.json(displays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new display
app.post('/api/displays', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, displayId, location, branch } = req.body;
    const display = new Display({ name, displayId, location, branch });
    await display.save();
    res.status(201).json(display);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a display
app.delete('/api/displays/:displayId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { displayId } = req.params;
    const display = await Display.findOne({ displayId });
    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }
    
    await Display.findByIdAndDelete(display._id);
    res.json({ message: 'Display deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all menus
app.get('/api/menus', async (req, res) => {
  try {
    const menus = await Menu.find({ isActive: true });
    res.json(menus);
  } catch (error) {
    console.error('Error in /api/menus:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get menu by ID
app.get('/api/menus/:id', async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update display's current menus
app.put('/api/displays/:displayId/menus', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { displayId } = req.params;
    const { menuIds, slideshowInterval, transitionType } = req.body;
    
    const display = await Display.findOne({ displayId });
    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }
    
    // Update menus with order
    display.currentMenus = menuIds.map((menuId, index) => ({
      menu: menuId,
      order: index
    }));
    
    if (slideshowInterval) {
      display.slideshowInterval = slideshowInterval;
    }
    
    if (transitionType) {
      display.transitionType = transitionType;
    }
    
    await display.save();
    
    // Emit real-time update
    io.to(`display-${displayId}`).emit('menus-updated', { menuIds, slideshowInterval, transitionType });
    
    res.json(display);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Base64 image upload middleware
const uploadBase64Multiple = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit (reduced for Base64 storage)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).array('menuImages', 10);

const uploadBase64Single = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).single('itemImage');

// Helper function to convert buffer to Base64
const bufferToBase64 = (buffer, mimeType) => {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

app.post('/api/upload-menu', authenticateToken, requireAdmin, (req, res) => {
  uploadBase64Multiple(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const { name, description, category, branch } = req.body;
      
      const images = req.files.map((file, index) => ({
        imageUrl: bufferToBase64(file.buffer, file.mimetype),
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        order: index
      }));

      const menu = new Menu({
        name,
        description,
        images,
        menuType: 'image',
        category: category || 'general',
        branch: branch || 'main'
      });

      await menu.save();
      res.status(201).json(menu);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Create custom menu
app.post('/api/create-custom-menu', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, category, branch, menuItems, design } = req.body;
    
    const menu = new Menu({
      name,
      description,
      menuType: 'custom',
      menuItems: menuItems || [],
      design: design || {},
      category: category || 'general',
      branch: branch || 'main'
    });

    await menu.save();
    res.status(201).json(menu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update text-based menu
app.put('/api/menus/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, category, branch, menuItems, design } = req.body;
    
    const updateData = {
      name,
      description,
      category,
      branch
    };

    if (menuItems) {
      updateData.menuItems = menuItems;
    }

    if (design) {
      updateData.design = design;
    }

    const menu = await Menu.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload image for menu item
app.post('/api/upload-item-image', authenticateToken, requireAdmin, (req, res) => {
  uploadBase64Single(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const imageData = {
        imageUrl: bufferToBase64(req.file.buffer, req.file.mimetype),
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      };

      res.status(201).json(imageData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Delete menu
app.delete('/api/menus/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    // Delete from database (images are stored as Base64, no file cleanup needed)
    await Menu.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Menu deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 