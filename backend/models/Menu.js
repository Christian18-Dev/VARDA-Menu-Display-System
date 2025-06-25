const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  fileName: {
    type: String,
    trim: true
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  }
});

const menuSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  menuType: {
    type: String,
    enum: ['image', 'custom'],
    default: 'image'
  },
  images: [{
    imageUrl: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  menuItems: [menuItemSchema],
  design: {
    backgroundColor: {
      type: String,
      default: '#000000'
    },
    textColor: {
      type: String,
      default: '#FFFFFF'
    },
    titleColor: {
      type: String,
      default: '#FFD700'
    },
    priceColor: {
      type: String,
      default: '#FF6B6B'
    },
    fontFamily: {
      type: String,
      default: 'Arial, sans-serif'
    },
    titleFontSize: {
      type: String,
      default: '3rem'
    },
    itemFontSize: {
      type: String,
      default: '1.5rem'
    },
    priceFontSize: {
      type: String,
      default: '1.2rem'
    },
    showMenuName: {
      type: Boolean,
      default: true
    },
    menuNameFontSize: {
      type: String,
      default: '3rem'
    },
    backgroundImage: {
      type: String,
      default: ''
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    default: 'general'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Menu', menuSchema); 