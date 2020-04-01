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
    //this.moduleConfigs = [];
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
  checkValidImageFileExtension: function(filename, extensions) {
    var extList = extensions.split(',');
    for (var extIndex = 0; extIndex < extList.length; extIndex++) {
      if (filename.toLowerCase().endsWith(extList[extIndex])) return true;
    }
    return false;
  },
  // gathers the image list
  gatherImageList: function(config) {
    var self = this;
    // create an empty main image list
    var imageList = [];
    for (var i = 0; i < config.imagePaths.length; i++) {
      this.getFiles(config.imagePaths[i], imageList, config);
    }

    imageList = config.randomizeImageOrder
      ? this.shuffleArray(imageList)
      : imageList.sort(this.sortByFilename);

    return imageList;
  },

  getFiles(path, imageList, config) {
    var contents = FileSystemImageSlideshow.readdirSync(path);
    for (let i = 0; i < contents.length; i++) {
      var currentItem = path + '/' + contents[i];
      var stats = FileSystemImageSlideshow.lstatSync(currentItem);
      if (stats.isDirectory() && config.recursiveSubDirectories) {
        this.getFiles(currentItem, imageList, config);
      } else if (stats.isFile()) {
        var isValidImageFileExtension = this.checkValidImageFileExtension(
          currentItem,
          config.validImageFileExtensions
        );
        if (isValidImageFileExtension) imageList.push(currentItem);
      }
    }
  },
  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function(notification, payload) {
    if (notification === 'BACKGROUNDSLIDESHOW_REGISTER_CONFIG') {
      // this to self
      var self = this;
      // get the image list
      var imageList = this.gatherImageList(payload);
      // build the return payload
      var returnPayload = {
        identifier: payload.identifier,
        imageList: imageList
      };
      // send the image list back
      self.sendSocketNotification(
        'BACKGROUNDSLIDESHOW_FILELIST',
        returnPayload
      );
    }
  }
});

//------------ end -------------
