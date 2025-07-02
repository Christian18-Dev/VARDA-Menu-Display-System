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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

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

// Utility function to fix image URLs for existing data
const fixImageUrls = (data) => {
  try {
    const backendUrl = process.env.BACKEND_URL || 'https://varda-menu-display-system.onrender.com';
    
    // Handle null/undefined data
    if (!data) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => fixImageUrls(item));
    }
    
    if (data && typeof data === 'object') {
      const fixed = { ...data };
      
      // Fix menu images
      if (fixed.images && Array.isArray(fixed.images)) {
        fixed.images = fixed.images.map(image => {
          if (!image || typeof image !== 'object') return image;
          return {
            ...image,
            imageUrl: image.imageUrl && typeof image.imageUrl === 'string' && !image.imageUrl.startsWith('http') 
              ? `${backendUrl}${image.imageUrl}` 
              : image.imageUrl
          };
        });
      }
      
      // Fix menu items with images
      if (fixed.menuItems && Array.isArray(fixed.menuItems)) {
        fixed.menuItems = fixed.menuItems.map(item => {
          if (!item || typeof item !== 'object') return item;
          return {
            ...item,
            imageUrl: item.imageUrl && typeof item.imageUrl === 'string' && !item.imageUrl.startsWith('http') 
              ? `${backendUrl}${item.imageUrl}` 
              : item.imageUrl
          };
        });
      }
      
      // Fix background image
      if (fixed.design && fixed.design.backgroundImage && typeof fixed.design.backgroundImage === 'string' && !fixed.design.backgroundImage.startsWith('http')) {
        fixed.design.backgroundImage = `${backendUrl}${fixed.design.backgroundImage}`;
      }
      
      return fixed;
    }
    
    return data;
  } catch (error) {
    console.error('Error in fixImageUrls:', error);
    return data; // Return original data if there's an error
  }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle display registration
  socket.on('register-display', async (displayId) => {
    try {
      const display = await Display.findOne({ displayId });
      if (display) {
        display.lastSeen = new Date();
        await display.save();
        socket.join(`display-${displayId}`);
        socket.emit('display-registered', { success: true, display });
      } else {
        socket.emit('display-registered', { success: false, message: 'Display not found' });
      }
    } catch (error) {
      console.error('Display registration error:', error);
      socket.emit('display-registered', { success: false, message: 'Registration failed' });
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
      }
    } catch (error) {
      console.error('Update display error:', error);
      socket.emit('update-error', { message: 'Update failed' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
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

// File upload endpoint for multiple images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadMultiple = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).array('menuImages', 10); // Allow up to 10 images

const uploadSingle = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).single('itemImage');

app.post('/api/upload-menu', authenticateToken, requireAdmin, (req, res) => {
  uploadMultiple(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const { name, description, category, branch } = req.body;
      
      const images = req.files.map((file, index) => ({
        imageUrl: `${process.env.BACKEND_URL || 'https://varda-menu-display-system.onrender.com'}/uploads/${file.filename}`,
        fileName: file.filename,
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
  uploadSingle(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const imageData = {
        imageUrl: `${process.env.BACKEND_URL || 'https://varda-menu-display-system.onrender.com'}/uploads/${req.file.filename}`,
        fileName: req.file.filename,
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

    // Delete all image files from filesystem
    if (menu.images && menu.images.length > 0) {
      const deletePromises = menu.images.map(async (image) => {
        const filePath = path.join(uploadsDir, image.fileName);
        try {
          await fs.remove(filePath);
        } catch (error) {
          console.error(`Error deleting file ${image.fileName}:`, error);
        }
      });
      await Promise.all(deletePromises);
    }

    // Delete from database
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