const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
mongoose.Promise = global.Promise;

// ------------------------------------------------------------------------------
//  Constants and other variables.
// ------------------------------------------------------------------------------
const STATUS = ['published', 'deleted', 'drafted'];
const CATEGORY = ['self', 'bookmark'];


// ------------------------------------------------------------------------------
//  Schema definition
// ------------------------------------------------------------------------------
const thoughtSchema = new mongoose.Schema({
  description: {
    type: String,
    trim: true,
  },
  title: {
    type: String,
    trim: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: STATUS,
    default: 'published'
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    enum: CATEGORY,
    default: 'self'
  },
  tags: [ {type: mongoose.Schema.Types.ObjectId, ref: 'Tag'} ],
  attachments: [ {type: mongoose.Schema.Types.ObjectId, ref: 'Attachment'} ]
});

thoughtSchema.plugin(mongoosePaginate);
var Thought = mongoose.model('Thought', thoughtSchema);

module.exports = { Thought };
