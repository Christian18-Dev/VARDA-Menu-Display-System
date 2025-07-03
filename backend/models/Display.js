const mongoose = require('mongoose');

const displaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  displayId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  branch: {
    type: String,
    default: 'Ateneo'
  },
  currentMenus: [{
    menu: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu'
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  slideshowInterval: {
    type: Number,
    default: 5000 // 5 seconds default
  },
  transitionType: {
    type: String,
    enum: ['normal', 'scrolling', 'push'],
    default: 'normal'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Display', displaySchema); 