/* global Module */

/* MMM-BackgroundSlideshow.js
 * 
 * Magic Mirror
 * Module: MMM-ImageSlideshow
 * 
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 * 
 * Module MMM-Slideshow By Darick Carpenter
 * MIT Licensed.
 */

Module.register("MMM-BackgroundSlideshow", {
  // Default module config.
  defaults: {
    // an array of strings, each is a path to a directory with images
    imagePaths: ["modules/MMM-BackgroundSlideshow/exampleImages"],
    // the speed at which to switch between images, in milliseconds
    slideshowSpeed: 10 * 1000,
    // if true randomize image order, otherwise do alphabetical
    randomizeImageOrder: false,
    // if true combine all images in all the paths
    // if false each path with be viewed seperately in the order listed
    treatAllPathsAsOne: false,
    // list of valid file extensions, seperated by commas
    validImageFileExtensions: "bmp,jpg,gif,png",
    backgroundOpacity: "1",
    transitionSpeed: 1000,
    backgroundSize: "contain",
    transitionImages: false
  },
  // load function
  start: function() {
    // add identifier to the config
    this.config.identifier = this.identifier;
    // ensure file extensions are lower case
    this.config.validImageFileExtensions = this.config.validImageFileExtensions.toLowerCase();
    // set no error
    this.errorMessage = null;
    if (this.config.imagePaths.length == 0) {
      this.errorMessage =
        "MMM-BackgroundSlideshow: Missing required parameter.";
    } else {
      // create an empty image list
      this.imageList = [];
      // set beginning image index to 0, as it will auto increment on start
      this.imageIndex = 0;
      this.updateImageList();
    }
  },
  // Define required scripts.
  getStyles: function() {
    // the css contains the make grayscale code
    return ["BackgroundSlideshow.css"];
  },
  // the socket handler
  socketNotificationReceived: function(notification, payload) {
    // if an update was received
    if (notification === "BACKGROUNDSLIDESHOW_FILELIST") {
      // check this is for this module based on the woeid
      if (payload.identifier === this.identifier) {
        // set the image list
        this.imageList = payload.imageList;
        // if image list actually contains images
        // set loaded flag to true and update dom
        if (this.imageList.length > 0) {
          this.resume();
        }
      }
    }
  },
  // Override dom generator.
  getDom: function() {
    var wrapper = document.createElement("div");
    this.div1 = this.createDiv("big1");
    this.div2 = this.createDiv("big2");
    var div3 = document.createElement("div");
    div3.className = "gradient";

    wrapper.appendChild(this.div1);
    wrapper.appendChild(this.div2);
    wrapper.appendChild(div3);

    return wrapper;
  },

  createDiv: function(name) {
    var div = document.createElement("div");
    div.id = name + this.identifier;
    div.style.backgroundSize = this.config.backgroundSize;
    div.className = "backgroundSlideShow";
    return div;
  },

  updateImage: function() {
    if (this.imageList && this.imageList.length) {
      if (this.imageIndex < this.imageList.length) {
        if (this.config.transitionImages) {
          this.swapDivs();
        }
        var div1 = this.div1;
        var div2 = this.div2;

        // div2.style.backgroundImage = div1.style.backgroundImage;

        var image = new Image();
        image.onload = function() {
          div1.style.backgroundImage = "url('" + this.src + "')";
          div1.style.opacity = "1";
          div2.style.opacity = "0";
        };
        image.src = this.imageList[this.imageIndex];

        this.imageIndex += 1;
      } else {
        this.imageIndex = 0;
        this.updateImageList();
      }
    }
  },

  swapDivs: function() {
    var temp = this.div1;
    this.div1 = this.div2;
    this.div2 = temp;
  },

  suspend: function() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },
  resume: function() {
    this.updateImage();
    var self = this;
    this.timer = setInterval(function() {
      self.updateImage();
    }, self.config.slideshowSpeed);
  },
  updateImageList: function() {
    this.suspend();
    // ask helper function to get the image list
    this.sendSocketNotification(
      "BACKGROUNDSLIDESHOW_REGISTER_CONFIG",
      this.config
    );
  }
});
