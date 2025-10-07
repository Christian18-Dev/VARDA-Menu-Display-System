const { body, param, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

// User registration validation
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters, alphanumeric and underscore only'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
  validate
];

// Login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

// Display validation
const validateDisplay = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name must be 1-100 characters'),
  body('displayId')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Display ID must be 3-50 characters, alphanumeric, underscore, and dash only'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must be less than 200 characters'),
  body('branch')
    .optional()
    .isIn(['ateneo', 'lpudavao', 'mapuadavao', 'mapuamakati', 'dlsulipa'])
    .withMessage('Invalid branch selection'),
  validate
];

// Menu validation
const validateMenu = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Menu name must be 1-100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must be less than 50 characters'),
  body('branch')
    .optional()
    .isIn(['ateneo', 'lpudavao', 'mapuadavao', 'mapuamakati', 'dlsulipa'])
    .withMessage('Invalid branch selection'),
  validate
];

// ObjectId validation
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  validate
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateDisplay,
  validateMenu,
  validateObjectId
}; 