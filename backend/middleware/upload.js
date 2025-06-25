const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    fs.ensureDirSync(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img-${uniqueSuffix}${ext}`);
  }
});

// File filter with enhanced security
const fileFilter = (req, file, cb) => {
  // Check MIME type
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
  
  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('Invalid file extension'), false);
  }
  
  // Additional security checks
  if (file.size > (process.env.MAX_FILE_SIZE || 5 * 1024 * 1024)) { // 5MB default
    return cb(new Error('File size too large'), false);
  }
  
  cb(null, true);
};

// Configure multer with security settings
const uploadMultiple = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    files: parseInt(process.env.MAX_FILES_PER_UPLOAD) || 10
  },
  fileFilter
}).array('menuImages', parseInt(process.env.MAX_FILES_PER_UPLOAD) || 10);

const uploadSingle = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
  },
  fileFilter
}).single('itemImage');

// Wrapper functions with error handling
const uploadMultipleFiles = (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected file field' });
      }
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

const uploadSingleFile = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large' });
      }
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

module.exports = {
  uploadMultipleFiles,
  uploadSingleFile
}; 