'use strict';

var { Attachment } = require('../models/attachment_model');
var mongoose = require('mongoose');
var _ = require('lodash');

var aws = require('aws-sdk'),
    multer = require('multer'),
    // fs = require('fs'),
    multerS3 = require('multer-s3');

aws.config.update({
    secretAccessKey: process.env.S3_SECRET_ACCESSKEY,
    accessKeyId: process.env.S3_ACCESSKEY_ID,
    region: process.env.REGION
});

var  s3 = new aws.S3();

const uploadFile = function (file) {
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

const save_attachment = (attachment, res) => {
  attachment.save()
    .then((data) => {
      res.status(200).send(_.pick(data, ['_id', 'name', 's3_url', 'mime_type', 'status', 'user', 'created_at', 'updated_at']));
    })
    .catch((err) => {
      res.status(400).send({errors: err.toString().replace('MongooseError: ', '').split(',')})
    })
}

const createAttachment = ((req, res, next) => {
  let user_id = mongoose.Types.ObjectId(req.swagger.params.auth_payload._id);
  let file = req.files['attachment'][0]  
  let attachment = new Attachment({name: file.originalname, mime_type: file.mimetype, status: 'syncing', user: user_id });
  
  uploadFile(file)
    .then((url) => {
      attachment.s3_url = url
      attachment.status = 'saved'
      save_attachment(attachment, res)
    })
    .catch((err) => {
      attachment.status = 'errored'
      save_attachment(attachment, res)
    })
});

const showAttachment = (req, res, next) => {
  let id = req.swagger.params.id.value;
  Attachment.find({_id: id}).populate('user', ['_id', 'username', 'email'])
  .then((attachment) => {
    if(attachment.length > 0) {
      res.status(200).send(_.pick(attachment[0], ['_id', 'name', 's3_url', 'mime_type', 'status', 'user', 'created_at', 'updated_at']));
    }
    res.status(404).send({ errors: ['No Attachments found with the given Id'] })
  }).catch((err) => {
    res.status(400).send({errors: err.toString().replace('MongooseError: ', '').split(',')})
  })
};

const removeAttachment = (req, res, next) => {
  Attachment
    .findOneAndUpdate({ _id: req.swagger.params.id.value }, { status: 'deleted' }, { new: true })
    .populate('user', ['_id', 'username', 'email'])
    .then((attachment) => {
      if(attachment) {
        res.status(200).send(_.pick(attachment, ['_id', 'name', 's3_url', 'mime_type', 'status', 'user', 'created_at', 'updated_at']));
      }
      res.status(404).send({ errors: ['No Attachment found for the given Id'] })
    }).catch((err) => {
      res.send(400).send({errors: []})
    });
};

const updateAttachment = (req, res, next) => {
  Attachment
    .findOneAndUpdate({ _id: req.swagger.params.id.value }, req.body, { new: true, runValidators: true })
    .populate('user', ['_id', 'username', 'email'])
    .then((attachment) => {
      console.log('success', attachment);
      if(attachment) {
        res.status(200).send(_.pick(attachment, ['_id', 'name', 's3_url', 'mime_type', 'status', 'user', 'created_at', 'updated_at']));
      }
      res.status(404).send({ errors: ['No attachment found for the given Id'] })
    }).catch((err) => {
      console.log('error', err);
      const messages = err.toString().replace('ValidationError: ', '').split(',');
      res.status(400).send({ errors: messages });
    });
}

module.exports = { createAttachment, showAttachment, removeAttachment, updateAttachment };
