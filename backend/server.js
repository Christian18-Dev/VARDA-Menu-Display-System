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
  "https://varda-menu-display-system.onrender.com", // Your actual Render backend URL
  "https://christian18-dev.github.io/VARDA-Menu-Display-System" // GitHub Pages URL
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Track display status
const displayStatus = new Map();

// Helper function for formatted logging
const logSocketEvent = (event, socketId, additionalInfo = '') => {
  const timestamp = new Date().toISOString();
  const shortId = socketId.substring(0, 8);
  const eventEmoji = event === 'connect' ? '🔗' : event === 'disconnect' ? '🔌' : '📡';
  const eventText = event === 'connect' ? 'CONNECTED' : event === 'disconnect' ? 'DISCONNECTED' : event.toUpperCase();
  
  // Get display ID if available
  const clientInfo = connectedClients.get(socketId);
  const displayInfo = clientInfo?.displayId ? ` | Display: ${clientInfo.displayId}` : '';
  
  console.log(`${eventEmoji} [${timestamp}] ${eventText} | ID: ${shortId}...${displayInfo} | ${additionalInfo}`);
};

// Periodic status logging every 60 seconds
const logSystemStatus = async () => {
  const timestamp = new Date().toISOString();
  const totalClients = connectedClients.size;
  
  // Count displays vs admin clients
  let displayClients = 0;
  let adminClients = 0;
  const connectedDisplays = [];
  const displayStatuses = [];
  
  // Update display statuses
  const now = new Date();
  connectedClients.forEach((clientInfo, socketId) => {
    if (clientInfo.displayId) {
      displayClients++;
      const lastSeen = clientInfo.lastPing || clientInfo.connectionTime;
      const timeSinceLastSeen = Math.floor((now - lastSeen) / 1000); // in seconds
      const isHealthy = timeSinceLastSeen < 120; // 2 minutes threshold
      
      // Update display status
      displayStatus.set(clientInfo.displayId, {
        displayId: clientInfo.displayId,
        socketId: socketId,
        lastSeen: lastSeen.toISOString(),
        status: isHealthy ? 'online' : 'stale',
        uptime: Math.floor((now - clientInfo.connectionTime) / 1000) + 's',
        lastPing: timeSinceLastSeen + 's ago'
      });
      
      connectedDisplays.push(clientInfo.displayId);
    } else {
      adminClients++;
    }
  });
  
  // Get all displays from database to show their status
  try {
    const displays = await Display.find({}).sort({ displayId: 1 });
    
    // Log system status header
    console.log(`\n📊 [${timestamp}] ========== SYSTEM STATUS ==========`);
    console.log(`🌐 Connections: ${totalClients} total (${displayClients} displays, ${adminClients} admin)`);
    
    // Log each display status
    if (displays.length > 0) {
      console.log('\n📺 DISPLAY STATUS:');
      console.log(''.padEnd(80, '-'));
      console.log(
        'Display ID'.padEnd(15) + 
        'Status'.padStart(10).padEnd(12) + 
        'Last Seen'.padStart(19).padEnd(25) + 
        'Uptime'.padEnd(15) + 
        'Location'
      );
      console.log(''.padEnd(80, '-'));
      
      const now = new Date();
      
      for (const display of displays) {
        let status = {
          status: 'offline',
          lastSeen: display.lastSeen ? new Date(display.lastSeen) : null,
          uptime: 'N/A',
          lastPing: 'N/A'
        };
        
        // Check if display is in our connected clients
        const connectedClient = Array.from(connectedClients.entries())
          .find(([_, client]) => client.displayId === display.displayId);
          
        if (connectedClient) {
          const [socketId, clientInfo] = connectedClient;
          const lastPing = clientInfo.lastPing || clientInfo.connectionTime;
          const timeSinceLastPing = Math.floor((now - lastPing) / 1000);
          
          status = {
            status: timeSinceLastPing < 120 ? 'online' : 'stale',
            lastSeen: lastPing,
            uptime: Math.floor((now - clientInfo.connectionTime) / 1000) + 's',
            lastPing: timeSinceLastPing + 's ago'
          };
        } else if (status.lastSeen) {
          // For disconnected displays, use lastSeen from database
          const timeSinceLastSeen = Math.floor((now - status.lastSeen) / 1000);
          status.status = timeSinceLastSeen < 300 ? 'offline (recent)' : 'offline';
          status.uptime = 'N/A';
          status.lastPing = timeSinceLastSeen + 's ago';
        }
        
        const statusText = status.status.replace(' (recent)', '');
        const statusEmoji = status.status.includes('online') ? '🟢' : 
                          status.status.includes('stale') ? '🟡' : '🔴';
                          
        const lastSeenTime = status.lastSeen ? 
          status.lastSeen.toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : 'N/A';
        
        console.log(
          display.displayId.padEnd(15) +
          `${statusEmoji} ${statusText}`.padStart(11).padEnd(12) +
          lastSeenTime.padStart(19).padEnd(25) +
          status.uptime.padEnd(15) +
          (display.location || 'N/A')
        );
      }
    } else {
      console.log('\nℹ️  No displays registered in the system');
    }
    
    // Log system resources
    const memoryUsage = process.memoryUsage();
    console.log('\n💻 SYSTEM RESOURCES:');
    console.log(`   Memory Usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`   Uptime: ${Math.floor(process.uptime() / 60)} minutes`);
    
  } catch (error) {
    console.error('Error fetching display status:', error);
  }
  
  console.log(''.padEnd(80, '=') + '\n');
};

// Start periodic logging
setInterval(logSystemStatus, 60000); // 60 seconds = 60000ms

// Handle display pings
const handlePing = (socketId) => {
  const clientInfo = connectedClients.get(socketId);
  if (clientInfo) {
    clientInfo.lastPing = new Date();
    connectedClients.set(socketId, clientInfo);
  }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  const connectionTime = new Date();
  connectedClients.set(socket.id, { 
    connectionTime, 
    displayId: null,
    lastPing: connectionTime
  });
  
  logSocketEvent('connect', socket.id, `Total clients: ${connectedClients.size}`);
  
  // Set up ping handler
  socket.on('ping', () => handlePing(socket.id));

  // Add error handling for socket
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    logSocketEvent('error', socket.id, `Error: ${error.message}`);
  });

  // Add connection error handling
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    logSocketEvent('connect_error', socket.id, `Error: ${error.message}`);
  });

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
        const menusWithOrder = menuIds.map((menuId, index) => ({
          menu: menuId,
          order: index
        }));
        
        display.currentMenus = menusWithOrder;
        display.slideshowInterval = slideshowInterval || 5000;
        display.transitionType = transitionType || 'normal';
        display.lastUpdated = new Date();
        await display.save();
        
        // Emit update only to the specific display being updated
        // Find all sockets registered for this specific displayId
        const targetSockets = [];
        for (const [socketId, socketDisplayId] of connectedClients.entries()) {
          if (socketDisplayId === displayId) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              targetSockets.push(socket);
            }
          }
        }
        
        // Send update only to sockets connected to this display
        targetSockets.forEach(targetSocket => {
          targetSocket.emit('menus-updated', {
            displayId,
            menuIds: menusWithOrder,
            slideshowInterval: display.slideshowInterval,
            transitionType: display.transitionType
          });
        });
        
        logSocketEvent('update-display', socket.id, `TARGETED UPDATE - Display: ${displayId} | Sent to ${targetSockets.length} socket(s) | Menus: ${menuIds.length} | Interval: ${slideshowInterval}ms | Transition: ${transitionType}`);
        
        socket.emit('update-success', { message: 'Display updated successfully' });
        logSocketEvent('update-display', socket.id, `SUCCESS - Display: ${displayId} | Menus: ${menuIds.length} | Interval: ${slideshowInterval}ms | Transition: ${transitionType}`);
      } else {
        socket.emit('update-error', { message: 'Display not found' });
        logSocketEvent('update-display', socket.id, `ERROR - Display not found: ${displayId}`);
      }
    } catch (error) {
      console.error('Update display error:', error);
      socket.emit('update-error', { message: 'Update failed' });
      logSocketEvent('update-display', socket.id, `ERROR - ${error.message}`);
    }
  });

  // Handle sync/reset all displays
  socket.on('sync-all-displays', (data) => {
    console.log('🔄 SERVER: Received sync-all-displays request from admin');
    console.log('📊 SERVER: Current connected clients:', connectedClients.size);
    
    try {
      // Ensure delay is a safe primitive number to prevent serialization issues
      let delay = 5000; // Default 5 second delay to allow all clients to sync
      if (data && typeof data.delay === 'number' && data.delay > 0 && data.delay <= 30000) {
        delay = Math.floor(data.delay); // Ensure it's an integer
      } else if (data && data.delay) {
        const parsed = parseInt(data.delay);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 30000) {
          delay = parsed;
        }
      }
      
      const serverTime = Date.now();
      const targetTime = serverTime + delay;
      
      console.log(`⏱️ SERVER: Sync scheduled for ${new Date(targetTime).toISOString()} (in ${delay}ms)`);
      
      // Create sync payload with timing information
      const syncPayload = {
        serverTime: serverTime,
        targetTime: targetTime,
        delay: delay
      };
      
      // Broadcast sync event to all connected displays
      console.log('📡 SERVER: Broadcasting display-sync-refresh to all clients...');
      io.emit('display-sync-refresh', syncPayload);
      
      // Send success response with clean data
      socket.emit('sync-success', { 
        message: `All displays will sync at ${new Date(targetTime).toLocaleTimeString()}`,
        targetTime: targetTime
      });
      
      console.log(`✅ SERVER: Sync scheduled for ${new Date(targetTime).toLocaleTimeString()}`);
      logSocketEvent('sync-all-displays', socket.id, `SYNC SCHEDULED - Target: ${new Date(targetTime).toISOString()} | Clients: ${connectedClients.size}`);
    } catch (error) {
      console.error('❌ SERVER: Sync all displays error:', error);
      socket.emit('sync-error', { message: 'Sync failed' });
      logSocketEvent('sync-all-displays', socket.id, `ERROR - ${error.message}`);
    }
  });

  socket.on('disconnect', async () => {
    const clientInfo = connectedClients.get(socket.id);
    const connectionDuration = clientInfo ? Math.round((new Date() - clientInfo.connectionTime) / 1000) : 0;
    const displayId = clientInfo?.displayId;
    const displayInfo = displayId ? ` | Display: ${displayId}` : '';
    
    // Update the display's lastSeen timestamp in the database
    if (displayId) {
      try {
        await Display.updateOne(
          { displayId },
          { lastSeen: new Date() }
        );
        logSocketEvent('disconnect', socket.id, `Updated lastSeen for display: ${displayId}`);
      } catch (error) {
        console.error('Error updating display lastSeen:', error);
      }
    }
    
    // Clean up the client tracking
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

// Update menu (text or image)
app.put('/api/menus/:id', authenticateToken, requireAdmin, (req, res, next) => {
  uploadBase64Multiple(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('Updating menu with ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('Files:', req.files ? req.files.length : 0);
    
    // Get text fields from form data
    const { name, description, category, branch, menuItems, design } = req.body;
    let existingImages = req.body.existingImages;
    
    // Parse existingImages if it's a string
    if (existingImages && typeof existingImages === 'string') {
      try {
        existingImages = JSON.parse(existingImages);
      } catch (e) {
        console.error('Error parsing existingImages:', e);
        return res.status(400).json({ error: 'Invalid existingImages format' });
      }
    }
    
    const updateData = {
      name,
      description,
      category,
      branch,
      updatedAt: new Date()
    };

    // Handle menu type specific updates
    if (menuItems) {
      try {
        updateData.menuItems = typeof menuItems === 'string' ? JSON.parse(menuItems) : menuItems;
      } catch (e) {
        console.error('Error parsing menuItems:', e);
        return res.status(400).json({ error: 'Invalid menuItems format' });
      }
    }

    if (design) {
      try {
        updateData.design = typeof design === 'string' ? JSON.parse(design) : design;
      } catch (e) {
        console.error('Error parsing design:', e);
        return res.status(400).json({ error: 'Invalid design format' });
      }
    }

    // Handle image updates
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} new image(s)`);
      const newImages = req.files.map((file, index) => ({
        imageUrl: bufferToBase64(file.buffer, file.mimetype),
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        order: index,
        createdAt: new Date()
      }));
      
      // Combine existing images (if any) with new ones
      if (existingImages && existingImages.length > 0) {
        console.log(`Combining with ${existingImages.length} existing image(s)`);
        updateData.images = [...existingImages, ...newImages];
      } else {
        console.log('No existing images, using only new images');
        updateData.images = newImages;
      }
    } else if (existingImages && existingImages.length > 0) {
      console.log(`Updating order of ${existingImages.length} existing image(s)`);
      updateData.images = existingImages;
    } else {
      console.log('No images provided in the update');
      updateData.images = [];
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
    console.error('Update menu error:', error);
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