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
    // required: [true, 'A thought should have some description.'],
    // minlength: [5, 'A thought should be atleast 5 characters long']
  },
  title: {
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
  tags: {
    type: Array,
    default: []
  },
  attachments: {
    type: Array,
    default: []
  },
  score: {
    type: mongoose.Schema.Types.Decimal,
    default: '0.0',
    set: function(score) {
      return parseFloat(score).toFixed(1);
    },
    get: function(score) {
      return parseFloat(score).toFixed(1);
    }
  }
});

thoughtSchema.plugin(mongoosePaginate);
var Thought = mongoose.model('Thought', thoughtSchema);

module.exports = { Thought };
