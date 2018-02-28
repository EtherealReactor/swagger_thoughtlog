const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

// ------------------------------------------------------------------------------
//  Constants and other variables.
// ------------------------------------------------------------------------------
const STATUS = ['saved', 'errored', 'syncing', 'deleted', 'drafted'];


// ------------------------------------------------------------------------------
//  Schema definition
// ------------------------------------------------------------------------------
const attachmentsSchema = new mongoose.Schema({
  s3_url: {
    type: String,
    trim: true,
  },
  name: {
    type: String,
    trim: true,
  },
  mime_type: {
    type: String,
    trim: true,
  },    
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: STATUS,
    default: 'syncing'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

var Attachment = mongoose.model('Attachment', attachmentsSchema);

module.exports = { Attachment };
