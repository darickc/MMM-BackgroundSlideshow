/* global Module */

/* node_helper.js
 * 
 * Magic Mirror
 * Module: MMM-ImageSlideshow
 * 
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 * 
 * Module MMM-BackgroundSlideshow By Darick Carpenter
 * MIT Licensed.
 */

// call in the required classes
var NodeHelper = require("node_helper");
var FileSystemImageSlideshow = require("fs");

// the main module helper create
module.exports = NodeHelper.create({
  // subclass start method, clears the initial config array
  start: function() {
    this.moduleConfigs = [];
  },
  // shuffles an array at random and returns it
  shuffleArray: function(array) {
    var currentIndex = array.length,
      temporaryValue,
      randomIndex;
    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  },
  // sort by filename attribute
  sortByFilename: function(a, b) {
    aL = a.filename.toLowerCase();
    bL = b.filename.toLowerCase();
    if (aL > bL) return 1;
    else return -1;
  },
  // checks there's a valid image file extension
  checkValidImageFileExtension: function(filename, extensions) {
    var extList = extensions.split(",");
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
    // for each of the paths specified
    for (var pathIndex = 0; pathIndex < config.imagePaths.length; pathIndex++) {
      var currentPath = config.imagePaths[pathIndex];
      var currentPathImageList = FileSystemImageSlideshow.readdirSync(
        (path = currentPath)
      );
      // for each file in the current path
      if (currentPathImageList.length > 0) {
        // create an empty list for images in the current path
        var currentImageList = [];
        // for each file
        for (
          var imageIndex = 0;
          imageIndex < currentPathImageList.length;
          imageIndex++
        ) {
          // seperate into path and filename
          var currentImage = {
            path: currentPath,
            filename: currentPathImageList[imageIndex]
          };
          // check if file has a valid image file extension
          var isValidImageFileExtension = this.checkValidImageFileExtension(
            currentImage.filename,
            config.validImageFileExtensions
          );
          //  if file is valid, add it to the list
          if (isValidImageFileExtension) currentImageList.push(currentImage);
        }
        // if not set to combine all paths, do random or alphabetical sort
        if (!config.treatAllPathsAsOne) {
          if (config.randomizeImageOrder)
            currentImageList = this.shuffleArray(currentImageList);
          else currentImageList = currentImageList.sort(this.sortByFilename);
        }
        // add current list main list
        imageList = imageList.concat(currentImageList);
      }
    }
    // if set to combine all paths, sort all images randomly or alphabetically by filename
    if (config.treatAllPathsAsOne) {
      if (config.randomizeImageOrder) imageList = this.shuffleArray(imageList);
      else imageList = imageList.sort(this.sortByFilename);
    }
    // create a file image list combining paths and filenames
    var imageListComplete = [];
    for (var index = 0; index < imageList.length; index++) {
      imageListComplete.push(
        imageList[index].path + "/" + imageList[index].filename
      );
    }
    // return final list
    return imageListComplete;
  },
  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function(notification, payload) {
    if (notification === "BACKGROUNDSLIDESHOW_REGISTER_CONFIG") {
      // add the current config to an array of all configs used by the helper
      this.moduleConfigs.push(payload);
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
        "BACKGROUNDSLIDESHOW_FILELIST",
        returnPayload
      );
    }
  }
});

//------------ end -------------
