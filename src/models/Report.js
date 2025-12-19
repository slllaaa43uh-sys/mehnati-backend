const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportType: {
    type: String,
    enum: ['post', 'comment', 'reply', 'video', 'user', 'story'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  reason: {
    type: String,
    required: [true, 'سبب البلاغ مطلوب'],
    maxlength: 1000
  },
  details: {
    type: String,
    maxlength: 1000
  },
  media: [{
    url: String,
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ status: 1 });
reportSchema.index({ reportType: 1, targetId: 1 });

module.exports = mongoose.model('Report', reportSchema);
