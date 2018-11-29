/* global Module */

/* MMM-BackgroundSlideshow.js
 *
 * Magic Mirror
 * Module: MMM-BackgroundSlideshow
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-Slideshow By Darick Carpenter
 * MIT Licensed.
 */

Module.register('MMM-BackgroundSlideshow', {
  // Default module config.
  defaults: {
    // an array of strings, each is a path to a directory with images
    imagePaths: ['modules/MMM-BackgroundSlideshow/exampleImages'],
    // the speed at which to switch between images, in milliseconds
    slideshowSpeed: 10 * 1000,
    // if true randomize image order, otherwise do alphabetical
    randomizeImageOrder: false,
    // if false each path with be viewed seperately in the order listed
    recursiveSubDirectories: false,
    // list of valid file extensions, seperated by commas
    validImageFileExtensions: 'bmp,jpg,gif,png',
    // transition speed from one image to the other, transitionImages must be true
    transitionSpeed: '1s',
    // the sizing of the background image
    // cover: Resize the background image to cover the entire container, even if it has to stretch the image or cut a little bit off one of the edges
    // contain: Resize the background image to make sure the image is fully visible
    backgroundSize: 'cover', // cover or contain
    // transition from one image to the other (may be a bit choppy on slower devices, or if the images are too big)
    transitionImages: false,
    // the gradient to make the text more visible
    gradient: [
      'rgba(0, 0, 0, 0.75) 0%',
      'rgba(0, 0, 0, 0) 40%',
      'rgba(0, 0, 0, 0) 80%',
      'rgba(0, 0, 0, 0.75) 100%'
    ],
    horizontalGradient: [
      'rgba(0, 0, 0, 0.75) 0%',
      'rgba(0, 0, 0, 0) 40%',
      'rgba(0, 0, 0, 0) 80%',
      'rgba(0, 0, 0, 0.75) 100%'
    ],
    // the direction the gradient goes, vertical or horizontal
    gradientDirection: 'vertical'
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
        'MMM-BackgroundSlideshow: Missing required parameter.';
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
    return ['BackgroundSlideshow.css'];
  },
  // the socket handler
  socketNotificationReceived: function(notification, payload) {
    // if an update was received
    if (notification === 'BACKGROUNDSLIDESHOW_FILELIST') {
      // check this is for this module based on the woeid
      if (payload.identifier === this.identifier) {
        // console.info('Returning Images, payload:' + JSON.stringify(payload));
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
    var wrapper = document.createElement('div');
    this.div1 = this.createDiv('big1');
    this.div2 = this.createDiv('big2');

    wrapper.appendChild(this.div1);
    wrapper.appendChild(this.div2);

    if (
      this.config.gradientDirection === 'vertical' ||
      this.config.gradientDirection === 'both'
    ) {
      this.createGradientDiv('bottom', this.config.gradient, wrapper);
    }

    if (
      this.config.gradientDirection === 'horizontal' ||
      this.config.gradientDirection === 'both'
    ) {
      this.createGradientDiv('right', this.config.gradient, wrapper);
    }

    return wrapper;
  },

  createGradientDiv: function(direction, gradient, wrapper) {
    var div = document.createElement('div');
    div.style.backgroundImage =
      'linear-gradient( to ' + direction + ', ' + gradient.join() + ')';
    div.className = 'gradient';
    wrapper.appendChild(div);
  },

  createDiv: function(name) {
    var div = document.createElement('div');
    div.id = name + this.identifier;
    div.style.backgroundSize = this.config.backgroundSize;
    div.style.transition =
      'opacity ' + this.config.transitionSpeed + ' ease-in-out';
    div.className = 'backgroundSlideShow';
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
          div1.style.opacity = '1';
          div2.style.opacity = '0';
        };
        image.src = encodeURI(this.imageList[this.imageIndex]);

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
    // console.info('Getting Images');
    // ask helper function to get the image list
    this.sendSocketNotification(
      'BACKGROUNDSLIDESHOW_REGISTER_CONFIG',
      this.config
    );
  }
});
