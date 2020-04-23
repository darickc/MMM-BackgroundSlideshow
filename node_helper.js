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
    aL = a.path.toLowerCase();
    bL = b.path.toLowerCase();
    if (aL > bL) return 1;
    else return -1;
  },

  // sort by created attribute
  sortByCreated: function(a, b) {
    aL = a.created;
    bL = b.created;
    if (aL > bL) return 1;
    else return -1;
  },

  // sort by created attribute
  sortByModified: function(a, b) {
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
        sortedList = imageList.sort(this.sortByCreated);;
        break;
      case 'modified':
        // Log.log('Sorting by modified date...');
        sortedList = imageList.sort(this.sortByModified);;
        break;
      default: // sort by name
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
      : this.sortImageList(imageList, config.sortImagesBy, config.sortImagesDescending);

    // build the return payload
    const returnPayload = {
      identifier: config.identifier,
      imageList: imageList.map( item => item.path) // map the array to only extract the paths
    };
    // send the image list back
    this.sendSocketNotification(
      'BACKGROUNDSLIDESHOW_FILELIST',
      returnPayload
    );
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
          if (isValidImageFileExtension) {
            imageList.push({
              "path": currentItem, 
              "created": stats.ctimeMs, 
              "modified": stats.mtimeMs
            });
          }
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

      // Get the image list in a non-blocking way since large # of images would cause 
      // the MagicMirror startup banner to get stuck sometimes.
      setTimeout(() => {this.gatherImageList(config)}, 200);
    }
  }
});

//------------ end -------------
