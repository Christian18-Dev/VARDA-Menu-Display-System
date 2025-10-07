const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  left: { type: Number, default: 0 },
  top: { type: Number, default: 0 }
}, { _id: false })

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
  },
  layout: {
    namePos: { type: positionSchema, default: undefined },
    descPos: { type: positionSchema, default: undefined },
    pricePos: { type: positionSchema, default: undefined },
    imagePos: { type: positionSchema, default: undefined },
    imageWidth: { type: Number, default: undefined },
    imageHeight: { type: Number, default: undefined }
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
    descriptionFontSize: {
      type: String,
      default: '16px'
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
    },
    titlePos: { type: positionSchema, default: undefined },
    menuDescriptionPos: { type: positionSchema, default: undefined }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    default: 'general'
  },
  branch: {
    type: String,
    default: 'ateneo'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Menu', menuSchema); 