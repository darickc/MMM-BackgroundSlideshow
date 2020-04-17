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
var NodeHelper = require('node_helper');
var FileSystemImageSlideshow = require('fs');

// the main module helper create
module.exports = NodeHelper.create({
  // subclass start method, clears the initial config array
  start: function() {
    this.validImageFileExtensions = new Set();
  },
  
  // shuffles an array at random and returns it
  shuffleArray: function(array) {
    for (let i = array.length - 1; i > 0; i--) {
      // j is a random index in [0, i].
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },
  
  // sort by filename attribute
  sortByFilename: function(a, b) {
    aL = a.toLowerCase();
    bL = b.toLowerCase();
    if (aL > bL) return 1;
    else return -1;
  },

  // checks there's a valid image file extension
  checkValidImageFileExtension: function(filename) {
    if (!filename.includes('.')) {
      // No file extension.
      return false;
    }
    const fileExtension = filename.split('.').pop().toLowerCase();
    return this.validImageFileExtensions.has(fileExtension);
  },

  // gathers the image list
  gatherImageList: function(config) {
    // create an empty main image list
    let imageList = [];
    for (let i = 0; i < config.imagePaths.length; i++) {
      this.getFiles(config.imagePaths[i], imageList, config);
    }

    imageList = config.randomizeImageOrder
      ? this.shuffleArray(imageList)
      : imageList.sort(this.sortByFilename);

    return imageList;
  },

  getFiles(path, imageList, config) {
    const contents = FileSystemImageSlideshow.readdirSync(path);
    for (let i = 0; i < contents.length; i++) {
      const currentItem = path + '/' + contents[i];
      const stats = FileSystemImageSlideshow.lstatSync(currentItem);
      if (stats.isDirectory() && config.recursiveSubDirectories) {
        this.getFiles(currentItem, imageList, config);
      } else if (stats.isFile()) {
        const isValidImageFileExtension =
          this.checkValidImageFileExtension(currentItem);
        if (isValidImageFileExtension) imageList.push(currentItem);
      }
    }
  },

  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function(notification, payload) {
    if (notification === 'BACKGROUNDSLIDESHOW_REGISTER_CONFIG') {
      const config = payload;

      // Create set of valid image extensions.
      const validExtensionsList = config.validImageFileExtensions.toLowerCase().split(',');
      this.validImageFileExtensions = new Set(validExtensionsList);

      // get the image list
      const imageList = this.gatherImageList(config);
      // build the return payload
      const returnPayload = {
        identifier: config.identifier,
        imageList: imageList
      };
      // send the image list back
      this.sendSocketNotification(
        'BACKGROUNDSLIDESHOW_FILELIST',
        returnPayload
      );
    }
  }
});

//------------ end -------------
