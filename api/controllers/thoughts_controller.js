'use strict';

var { Thought } = require('../models/thought_model');
var { User } = require('../models/user_model')
var mongoose = require('mongoose');
var _ = require('lodash');

var aws = require('aws-sdk'),
    multer = require('multer'),
    fs = require('fs'),
    multerS3 = require('multer-s3');

aws.config.update({
    secretAccessKey: process.env.S3_SECRET_ACCESSKEY,
    accessKeyId: process.env.S3_ACCESSKEY_ID,
    region: process.env.REGION
});

var  s3 = new aws.S3();


const uploadFile = function (file) {

  console.log('file name', file.originalname);

  var params = {
    Body: file.buffer,
    Key: file.originalname,
    ACL: 'public-read',
    Bucket: 'attachments.thoughtlog.thehelmet.life'
   };

  return new Promise(function(resolve, reject) {
    s3.upload(params, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data.Location);
        }
    });
  });
}

const newThought = ((req, res, next) => {
  let user_id = mongoose.Types.ObjectId(req.swagger.params.auth_payload._id);
  var thought = new Thought({user_id: user_id, status: 'drafted'});
  thought.save()
    .then((thought) => {
      res.status(200).send(_.pick(thought, ['_id']));
    }).catch((err) => {
      const messages = err.toString().replace('ValidationError: ', '').split(',');
      res.status(400).send({ errors: messages });
    });
});

const createThought = ((req, res, next) => {
  req.body.user = req.swagger.params.auth_payload._id;
  req.body.attachments = req.swagger.params.attachments.value;
  req.body.tags = req.swagger.params.tags.value;
  
  var thought = new Thought(req.body);
  thought.save()
    .then((thought_obj) => {
      // using lodash pick method to fetch only necessary fields
      res.status(200).send(_.pick(thought_obj, ['_id', 'title', 'description', 'user', 'category', 'status', 'tags', 'attachments', 'score', 'updated_at']));
    }).catch((err) => {
      console.log('errors', err);
      const messages = err.toString().replace('ValidationError: ', '').split(',');
      res.status(400).send({ errors: messages });
    });
});

const fetchAllThoughts = (req, res, next) => {
  var page = req.query.page || 1;
  var limit = +(req.query.limit) || 5;
  var query = {};
  var tags = [];
  var user_ids = [];
  var status = ''

  if(typeof req.query.tags !== 'undefined') {
    req.query.tags.split(',').forEach(function(tag) {
      tags.push(tag);
      tags.push('.+' + tag);
      tags.push(tag + '.+');
      tags.push('.+' + tag + '.$');
    });

    var regex = new RegExp(["^(", tags.join('|'), ")$"].join(""), "i")
    query.tags = { $all: [regex] };
  }
  if(typeof req.query.user_id !== 'undefined' ) {
    req.query.user_id.split(',').forEach(function(id) {
      user_ids.push(mongoose.Types.ObjectId(id.toString()));
    });
    query.user_id = { $in: user_ids }
  }
  
  if(req.query.status !== undefined && req.query.status.length > 0) {
    query.status = { $eq: req.query.status }
  }

  Thought.paginate(query, { page: page, limit: limit, populate: ['attachments', 'user'], sort: {updated_at: -1} })
    .then((result) => {
      let attachmentIds = result.docs.attachments;
      var docs = _.map(result.docs, function(o) { return _.pick(o, ['_id', 'title', 'description', 'user', 'category', 'status', 'tags', 'attachments', 'updated_at']); });
      res.status(200).send({thoughts: docs, all_thoughts: result.total, current_page: +(result.page), total_pages: result.pages, limit: result.limit })
    }).catch((err) => {
      res.status(400).send({ errors: err.toString().replace('MongoError: ', '').split('.')})
  });
}

const showThought = (req, res, next) => {
  var id = req.query.id
  Thought.find({_id: req.swagger.params.id.value})
    .populate('user', ['_id', 'email', 'username'])
    .populate('attachments')
    .then((thought) => {
      if(thought.length > 0) {
        res.status(200).send(_.pick(thought[0], ['_id', 'title', 'description', 'category', 'status', 'updated_at', 'user', 'attachments']))
      }
      res.status(404).send({ errors: ['Valid Id. But no thought found for the given Id'] })
    }).catch((err) => {
      res.status(400).send({errors: err.toString().replace('MongooseError: ', '').split(',')})
    })
};

const removeThought = (req, res, next) => {
  Thought.findOneAndUpdate({ _id: req.swagger.params.id.value }, { status: 'deleted' }, { new: true })
    .then((thought) => {
      if(thought) {
        res.status(200).send(_.pick(thought, ['_id', 'description', 'status', 'updated_at']))
      }
      res.status(404).send({ errors: ['No thought found for the given Id'] })
    }).catch((err) => {
      res.send(400).send({errors: []})
    });
}

const updateThought = (req, res, next) => {
  Thought.findOneAndUpdate({ _id: req.swagger.params.id.value }, req.body, { new: true, runValidators: true })
    .then((thought) => {
      if(thought) {
        res.status(200).send(_.pick(thought, ['_id', 'title', 'description', 'user_id', 'category', 'status', 'tags', 'score', 'updated_at']))
      }
      res.status(404).send({ errors: ['No thought found for the given Id'] })
    }).catch((err) => {
      const messages = err.toString().replace('ValidationError: ', '').split(',');
      res.status(400).send({ errors: messages });
    });
}

module.exports = { createThought, fetchAllThoughts, showThought, removeThought, updateThought, newThought };
