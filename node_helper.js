/* global Module */

/* node_helper.js
 *
 * Magic Mirror
 * Module: MMM-BackgroundSlideshow
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-BackgroundSlideshow By Darick Carpenter
 * MIT Licensed.
 */

// call in the required classes
const Log = require('../../js/logger.js');
var NodeHelper = require('node_helper');
var FileSystemImageSlideshow = require('fs');
const Jimp = require('jimp');
const jo = require('jpeg-autorotate');
const { exec } = require('child_process');
var express = require('express');
const basePath = '/images/';

// the main module helper create
module.exports = NodeHelper.create({
  expressInstance: undefined,
  // subclass start method, clears the initial config array
  start: function () {
    this.excludePaths = new Set();
    this.validImageFileExtensions = new Set();
    this.expressInstance = this.expressApp;
    this.imageList = [];
    this.index = 0;
    this.config;
  },

  // shuffles an array at random and returns it
  shuffleArray: function (array) {
    for (let i = array.length - 1; i > 0; i--) {
      // j is a random index in [0, i].
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  // sort by filename attribute
  sortByFilename: function (a, b) {
    aL = a.path.toLowerCase();
    bL = b.path.toLowerCase();
    if (aL > bL) return 1;
    else return -1;
  },

  // sort by created attribute
  sortByCreated: function (a, b) {
    aL = a.created;
    bL = b.created;
    if (aL > bL) return 1;
    else return -1;
  },

  // sort by created attribute
  sortByModified: function (a, b) {
    aL = a.modified;
    bL = b.modified;
    if (aL > bL) return 1;
    else return -1;
  },

  sortImageList: function (imageList, sortBy, sortDescending) {
    let sortedList = imageList;
    switch (sortBy) {
      case 'created':
        // Log.log('Sorting by created date...');
        sortedList = imageList.sort(this.sortByCreated);
        break;
      case 'modified':
        // Log.log('Sorting by modified date...');
        sortedList = imageList.sort(this.sortByModified);
        break;
      default:
        // sort by name
        // Log.log('Sorting by name...');
        sortedList = imageList.sort(this.sortByFilename);
    }

    // If the user chose to sort in descending order then reverse the array
    if (sortDescending === true) {
      // Log.log('Reversing sort order...');
      sortedList = sortedList.reverse();
    }

    return sortedList;
  },

  // checks there's a valid image file extension
  checkValidImageFileExtension: function (filename) {
    if (!filename.includes('.')) {
      // No file extension.
      return false;
    }
    const fileExtension = filename.split('.').pop().toLowerCase();
    return this.validImageFileExtensions.has(fileExtension);
  },

  // gathers the image list
  gatherImageList: function (config, sendNotification) {
    // create an empty main image list
    this.imageList = [];
    for (let i = 0; i < config.imagePaths.length; i++) {
      this.getFiles(config.imagePaths[i], this.imageList, config);
    }

    this.imageList = config.randomizeImageOrder
      ? this.shuffleArray(this.imageList)
      : this.sortImageList(
          this.imageList,
          config.sortImagesBy,
          config.sortImagesDescending
        );
    Log.info('BACKGROUNDSLIDESHOW: ' + this.imageList.length + ' files found');
    this.index = 0;

    // let other modules know about slideshow images
    this.sendSocketNotification('BACKGROUNDSLIDESHOW_FILELIST', {
      imageList: this.imageList
    });

    // build the return payload
    const returnPayload = {
      identifier: config.identifier
    };

    // signal ready
    if (sendNotification) {
      this.sendSocketNotification('BACKGROUNDSLIDESHOW_READY', returnPayload);
    }
  },

  getNextImage: function () {
    if (!this.imageList.length || this.index >= this.imageList.length) {
      // if there are no images or all the images have been displayed, try loading the images again
      this.gatherImageList(this.config);
    }
    //
    if (!this.imageList.length) {
      // still no images, search again after 10 mins
      setTimeout(() => {
        this.getNextImage(config);
      }, 600000);
      return;
    }

    var image = this.imageList[this.index++];
    Log.info('BACKGROUNDSLIDESHOW: reading path "' + image.path + '"');
    self = this;
    this.readFile(image.path, function (data) {
      const returnPayload = {
        identifier: self.config.identifier,
        path: image.path,
        data: data,
        index: self.index,
        total: self.imageList.length
      };
      self.sendSocketNotification(
        'BACKGROUNDSLIDESHOW_DISPLAY_IMAGE',
        returnPayload
      );
    });
  },

  getPrevImage: function () {
    // imageIndex is incremented after displaying an image so -2 is needed to
    // get to previous image index.
    this.index -= 2;

    // Case of first image, go to end of array.
    if (this.index < 0) {
      this.index = 0;
    }
    this.getNextImage();
  },

  resizeImage: function (input, callback) {
    Jimp.read(input)
      .then((image) => {
        image
          .scaleToFit(
            parseInt(this.config.maxWidth),
            parseInt(this.config.maxHeight)
          )
          .getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
            callback('data:image/jpg;base64, ' + buffer.toString('base64'));
          });
      })
      .catch((err) => {
        console.log(err);
      });
  },

  readFile: function (filepath, callback) {
    if (this.config.resizeImages) {
      let ext = filepath.split('.').pop();
      if (ext === 'jpg' || ext === 'jpeg') {
        jo.rotate(
          filepath,
          { quality: 30 },
          (error, buffer, orientation, dimensions, quality) => {
            if (error) {
              // console.log(
              //   'An error occurred when rotating the file: ' + error.message
              // );
              this.resizeImage(filepath, callback);
            } else {
              this.resizeImage(buffer, callback);
            }
          }
        );
      } else {
        this.resizeImage(filepath, callback);
      }
    } else {
      var ext = filepath.split('.').pop();
      var data = FileSystemImageSlideshow.readFileSync(filepath, {
        encoding: 'base64'
      });
      callback('data:image/' + ext + ';base64, ' + data);
    }
  },

  getFiles(path, imageList, config) {
    Log.info(
      'BACKGROUNDSLIDESHOW: Reading directory "' + path + '" for images.'
    );
    const contents = FileSystemImageSlideshow.readdirSync(path);
    for (let i = 0; i < contents.length; i++) {
      if (this.excludePaths.has(contents[i])) {
        continue;
      }
      const currentItem = path + '/' + contents[i];
      const stats = FileSystemImageSlideshow.lstatSync(currentItem);
      if (stats.isDirectory() && config.recursiveSubDirectories) {
        this.getFiles(currentItem, imageList, config);
      } else if (stats.isFile()) {
        const isValidImageFileExtension =
          this.checkValidImageFileExtension(currentItem);
        if (isValidImageFileExtension) {
          imageList.push({
            path: currentItem,
            created: stats.ctimeMs,
            modified: stats.mtimeMs
          });
        }
      }
    }
  },

  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function (notification, payload) {
    if (notification === 'BACKGROUNDSLIDESHOW_REGISTER_CONFIG') {
      const config = payload;
      this.expressInstance.use(
        basePath + config.imagePaths[0],
        express.static(config.imagePaths[0], { maxAge: 3600000 })
      );

      // Create set of excluded subdirectories.
      this.excludePaths = new Set(config.excludePaths);

      // Create set of valid image extensions.
      const validExtensionsList = config.validImageFileExtensions
        .toLowerCase()
        .split(',');
      this.validImageFileExtensions = new Set(validExtensionsList);

      // Get the image list in a non-blocking way since large # of images would cause
      // the MagicMirror startup banner to get stuck sometimes.
      this.config = config;
      setTimeout(() => {
        this.gatherImageList(config, true);
      }, 200);
    } else if (notification === 'BACKGROUNDSLIDESHOW_PLAY_VIDEO') {
      Log.info('mw got BACKGROUNDSLIDESHOW_PLAY_VIDEO');
      Log.info(
        'cmd line:' + 'omxplayer --win 0,0,1920,1080 --alpha 180 ' + payload[0]
      );
      exec(
        'omxplayer --win 0,0,1920,1080 --alpha 180 ' + payload[0],
        (e, stdout, stderr) => {
          this.sendSocketNotification('BACKGROUNDSLIDESHOW_PLAY', null);
          Log.info('mw video done');
        }
      );
    } else if (notification === 'BACKGROUNDSLIDESHOW_NEXT_IMAGE') {
      Log.info('BACKGROUNDSLIDESHOW_NEXT_IMAGE');
      this.getNextImage();
    } else if (notification === 'BACKGROUNDSLIDESHOW_PREV_IMAGE') {
      Log.info('BACKGROUNDSLIDESHOW_PREV_IMAGE');
      this.getPrevImage();
    }
  }
});

//------------ end -------------
