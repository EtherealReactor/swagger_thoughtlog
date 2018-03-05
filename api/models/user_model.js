const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
var UAParser = require('ua-parser-js');
var Utilities = require('./../helpers/utilities');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');
var bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

// ------------------------------------------------------------------------------
//  Schema definition
// ------------------------------------------------------------------------------
var userSchema = new mongoose.Schema({
  email: {
    type: String,
    index: true,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: [true, "Invalid Password"],
    minlength: [6, 'must be at least {MINLENGTH} characters long']
  },
  username: {
    type: String,
    required: "Username is required and has to be unique",
    minlength: [3, 'must be at least {MINLENGTH} characters long'],
    unique: true
  },
  api_keys: [
    {
    select: false,
    platform: {
      type: String,
      required: true,
      select: false
    },
    token: {
      type: String,
      required: true,
      select: false
    }
  }]
});


// ------------------------------------------------------------------------------
//  Pre validation method for hashing password of a user
// ------------------------------------------------------------------------------
userSchema.pre("save", true, function(next, callback) {
  var user = this;

  if(user.isModified('password')) {
    bcrypt.genSalt(10, function(err, salt) {
      bcrypt.hash(user.password, salt, function(err, hash) {
        user.password = hash;
        callback()
      });
    });
  };
  next();
});

// ------------------------------------------------------------------------------
//  INSTANCE METHODS
// ------------------------------------------------------------------------------
userSchema.methods.generateAuthToken = function(req) {
  var user = this;
  var secret = process.env.SECRET;
  var token = jwt.sign({ _id: user._id.toHexString() }, secret).toString();
  // defined in ../helpers/utilities.js
  var platform = Utilities.platform(req.headers['user-agent'])
  // Push the token into user api_keys
  user.api_keys.push({ platform: platform, token: token })
  // this will return a new promise with token in promise resolve
  return user.save()
    .then((user) => {
      return Promise.resolve(token);
    });
}

userSchema.methods.createOrUpdateToken = function(req) {
  var user = this;
  var platform = Utilities.platform(req.headers['user-agent'])
  var query = {'api_keys.platform': platform, email: user.email}
  var secret = process.env.SECRET;
  var token = jwt.sign({ _id: user._id.toHexString() }, secret).toString();
  var update = { $set: { 'api_keys.$.platform': platform, 'api_keys.$.token': token } };
  // var update = { $push: {api_keys: { platform: platform, token: token}} };

  // return mongoose.model('User').findOneAndUpdate(query, update, {new: true}).select('api_keys')
  return mongoose.model('User').update(query, update, {new: true})
    .then((writeResult) => {
      if (!writeResult.nModified) {
        // var nested_query = { 'api_keys.platform': { $ne: platform } };
        var nested_query = { email: user.email, 'api_keys.platform': { $ne: platform } };
        var create_new = { $push: { api_keys: { 'platform': platform, 'token': token } } };
        return mongoose.model('User').update(nested_query, create_new, {new: true})
          .then((res) => {
            return Promise.resolve(token);
          }).catch((err) => {
            return Promise.reject(err);
          })
      } else {
      // If the token already exists for a platform, just pluck that and return
        return mongoose.model('User').findOne({ "api_keys.platform": platform}).select('api_keys')
          .then((user) => {
            if(user) {
              var api_keys = user.api_keys.filter((e) => {
                return e.platform === platform;
              });
              return Promise.resolve(api_keys[0].token)
            } else {
              return Promise.reject();
            }
          }).catch((err) => {
            return Promise.reject(err);
          })
      }
    }).catch((err) => {
      return Promsise.reject(err);
    });
}


// ------------------------------------------------------------------------------
//  MODEL METHODS
// ------------------------------------------------------------------------------
userSchema.statics.findByToken = function(token) {
  var User = this;
  var decoded;

  try {
    decoded = jwt.verify(token, process.env.SECRET);
  } catch (e) {
    return Promise.reject()
  }

  return User.findOne({
    _id: decoded._id,
    'api_keys.token': token
  })
}

userSchema.statics.findByCredentials = function(email, password, req) {
  var User = this;

  return User.findOne({email: email})
    .then((user) => {
      if(!user) {
        return Promise.reject({email: 'User with email is not found'})
      }
      return bcrypt.compare(password, user.password)
        .then((res) => {
          if(!res) {
            return Promise.reject({password: 'Invalid password'});
          }
          return user.createOrUpdateToken(req)
            .then((token) => {
              return Promise.resolve({user: user, token: token})
            }).catch((err) => {
              return Promise.reject(err);
            })
        });
    }).catch((err) => {
      return Promise.reject(err);
    });
};

userSchema.statics.logout = function(token) {
  var User = this;
  return mongoose.model('User').findOneAndUpdate(
    { 'api_keys.token': token },
    { $pull: { api_keys: { token: token } } },
    { new: true }
  )
}

userSchema.plugin(uniqueValidator);

const User = mongoose.model('User', userSchema);

module.exports = { User }
