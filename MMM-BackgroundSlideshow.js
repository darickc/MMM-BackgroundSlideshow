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
    // if true randomize image order, otherwise use sortImagesBy and sortImagesDescending
    randomizeImageOrder: false,
    // how to sort images: name, random, created, modified
    sortImagesBy: 'created',
    // whether to sort in ascending (default) or descending order
    sortImagesDescending: false,
    // if false each path with be viewed separately in the order listed
    recursiveSubDirectories: false,
    // list of valid file extensions, separated by commas
    validImageFileExtensions: 'bmp,jpg,jpeg,gif,png',
    // show a panel containing information about the image currently displayed.
    showImageInfo: false,
    // a comma separated list of values to display: name, date, geo (TODO)
    imageInfo: 'name, date',
    // location of the info div
    imageInfoLocation: 'bottomRight', // Other possibilities are: bottomLeft, topLeft, topRight
    // transition speed from one image to the other, transitionImages must be true
    transitionSpeed: '1s',
    // show a progress bar indicating how long till the next image is displayed.
    showProgressBar: false,
    // the sizing of the background image
    // cover: Resize the background image to cover the entire container, even if it has to stretch the image or cut a little bit off one of the edges
    // contain: Resize the background image to make sure the image is fully visible
    backgroundSize: 'cover', // cover or contain
    // if backgroundSize contain, determine where to zoom the picture. Towards top, center or bottom
    backgroundPosition: 'center', // Most useful options: "top" or "center" or "bottom"
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
    gradientDirection: 'vertical',
    // Whether to scroll larger pictures rather than cut them off
    backgroundAnimationEnabled: false,
    // How long the scrolling animation should take - if this is more than slideshowSpeed, then images do not scroll fully. 
    // If it is too fast, then the image may apear gittery. For best result, by default we match this to slideshowSpeed.
    // For now, it is not documented and will default to match slideshowSpeed.
    backgroundAnimationDuration: '1s', 
    // How many times to loop the scrolling back and forth.  If the value is set to anything other than infinite, the
    // scrolling will stop at some point since we reuse the same div1.
    // For now, it is not documentd and is defaulted to infinite.
    backgroundAnimationLoopCount: 'infinite'
  },

  // load function
  start: function() {
    // add identifier to the config
    this.config.identifier = this.identifier;
    // ensure file extensions are lower case
    this.config.validImageFileExtensions = this.config.validImageFileExtensions.toLowerCase();
    // ensure image order is in lower case
    this.config.sortImagesBy = this.config.sortImagesBy.toLowerCase();
    // commented out since this was not doing anything
    // set no error 
    // this.errorMessage = null;
    if (this.config.imagePaths.length == 0) {
      Log.error('MMM-BackgroundSlideshow: Missing required parameter imagePaths.');
    } else {
      // create an empty image list
      this.imageList = [];
      // set beginning image index to 0, as it will auto increment on start
      this.imageIndex = 0;
      this.updateImageList();
    }
    //validate imageinfo property.  This will make sure we have at least 1 valid value
    const imageInfoRegex = /\bname\b|\bdate\b/gi;
    if (this.config.showImageInfo && !imageInfoRegex.test(this.config.imageInfo)) {
      Log.warn('MMM-BackgroundSlideshow: showImageInfo is set, but imageInfo does not have a valid value.');
      // Use name as the default
      this.config.imageInfo = ['name'];
    } else {
      // convert to lower case and replace any spaces with , to make sure we get an array back
      // even if the user provided space separated values
      this.config.imageInfo = this.config.imageInfo.toLowerCase().replace(/\s/g,',').split(',');
      // now filter the array to only those that have values
      this.config.imageInfo = this.config.imageInfo.filter(n => n);
    }
    // Lets make sure the backgroundAnimation duration matches the slideShowSpeed unless it has been
    // overriden
    if (this.config.backgroundAnimationDuration === '1s') {
      this.config.backgroundAnimationDuration = (this.config.slideshowSpeed/1000) + 's';
    }
  },

  getScripts: function() {
    return [
      "modules/" + this.name + "/node_modules/exif-js/exif.js",
      "modules/" + this.name + "/node_modules/moment/moment.js"
    ];
  },

  getStyles: function() {
    // the css contains the make grayscale code
    return ['BackgroundSlideshow.css'];
  },

  // generic notification handler
  notificationReceived: function(notification, payload, sender) {
    if (sender) {
      // Log.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
      if (notification === 'BACKGROUNDSLIDESHOW_IMAGE_UPDATE'){
        Log.log("MMM-BackgroundSlideshow: Changing Background");
        this.suspend();
        this.updateImage();
        this.resume();
      }
      else if (notification === 'BACKGROUNDSLIDESHOW_NEXT') { // Change to next image
        this.updateImage();
        if (this.timer) {   // Restart timer only if timer was already running
          this.resume();
        }
      }
      else if (notification === 'BACKGROUNDSLIDESHOW_PREVIOUS'){ // Change to previous image
        this.updateImage(/* skipToPrevious= */true);
        if(this.timer){   // Restart timer only if timer was already running
          this.resume();
        }
      }
      else if (notification === 'BACKGROUNDSLIDESHOW_PLAY') { // Change to next image and start timer.
        this.updateImage();
        this.resume();
      }
      else if (notification === 'BACKGROUNDSLIDESHOW_PAUSE') { // Stop timer.
        this.suspend();
      }
      else {
        // Log.log(this.name + " received a system notification: " + notification);
      }
    }
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
          this.updateImage(); //Added to show the image at least once, but not change it within this.resume()
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

    if (this.config.showImageInfo) {
        this.imageInfoDiv = this.createImageInfoDiv(wrapper);
    }
                
    if (this.config.showProgressBar) {
        this.createProgressbarDiv(wrapper, this.config.slideshowSpeed);
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
    div.style.backgroundPosition = this.config.backgroundPosition;
    div.style.transition =
      'opacity ' + this.config.transitionSpeed + ' ease-in-out';
    div.className = 'backgroundSlideShow';
    return div;
  },

  createImageInfoDiv: function(wrapper) {
    const div = document.createElement('div');
    div.className = 'info ' + this.config.imageInfoLocation;
    wrapper.appendChild(div);
    return div;
  },

  createProgressbarDiv: function(wrapper, slideshowSpeed) {
    const div = document.createElement('div');
    div.className = 'progress';
    const inner = document.createElement('div');
    inner.className = 'progress-inner';
    inner.style.display = 'none';
    inner.style.animation = `move ${slideshowSpeed}ms linear`;
    div.appendChild(inner);
    wrapper.appendChild(div);
  },

  updateImage: function(backToPreviousImage = false) {
    if (!this.imageList || !this.imageList.length) {
      return;
    }

    if (backToPreviousImage) {
      // imageIndex is incremented after displaying an image so -2 is needed to
      // get to previous image index.
      this.imageIndex -= 2;

      // Case of first image, do not drop off start of list.
      if (this.imageIndex < 0) {
        this.imageIndex = 0;
      }
    }
    
    if (this.imageIndex >= this.imageList.length) {
      this.imageIndex = 0;
      this.updateImageList();
      return;
    }

    if (this.config.transitionImages) {
      this.swapDivs();
    }

    const image = new Image();
    image.onload = () => {
      this.div1.style.backgroundImage = `url("${image.src}")`;
      this.div1.style.opacity = '1';
      this.div1.style.transform="rotate(0deg)";

      if (this.config.showProgressBar) {
        // Restart css animation
        const oldDiv = document.getElementsByClassName('progress-inner')[0];
        const newDiv = oldDiv.cloneNode(true);
        oldDiv.parentNode.replaceChild(newDiv, oldDiv);
        newDiv.style.display = '';
      }

      // Check to see if we need to animate the background
      if (this.config.backgroundAnimationEnabled && this.config.backgroundSize.toLowerCase() === 'cover') {
        // check to see if the width of the picture is larger or the height
        var width = image.width;
        var height = image.height;
        var adjustedWidth = width*window.innerHeight/height;
        var adjustedHeight = height*window.innerWidth/width;

        this.div1.style.animationDuration = this.config.backgroundAnimationDuration;
        this.div1.style.animationIterationCount = this.config.backgroundAnimationLoopCount;

        if (adjustedWidth/innerWidth > adjustedHeight/window.innerHeight) {
          // Scrolling horizontally...
          this.div1.className = 'backgroundSlideShowH';
        } else {
          // Scrolling vertically...
          this.div1.className = 'backgroundSlideShowV';
        }
      }

      EXIF.getData(image, () => {
        if (this.config.showImageInfo) {
          let dateTime = EXIF.getTag(image, "DateTimeOriginal");
          // attempt to parse the date if possible
          if (dateTime !== null) {
            try {
              dateTime = moment(dateTime, 'YYYY:MM:DD HH:mm:ss');
              dateTime = dateTime.format("dddd MMMM D, YYYY HH:mm");
            } catch (e) {
              console.log('Failed to parse dateTime: ' + dateTime + ' to format YYYY:MM:DD HH:mm:ss');
              dateTime = '';
            }
          }
          // TODO: allow for location lookup via openMaps
          // let lat = EXIF.getTag(this, "GPSLatitude");
          // let lon = EXIF.getTag(this, "GPSLongitude");
          // // Only display the location if we have both longitute and lattitude
          // if (lat && lon) {
          //   // Get small map of location
          // }
          this.updateImageInfo(decodeURI(image.src), dateTime);
          
        }
        const exifOrientation = EXIF.getTag(image, "Orientation");
        this.div1.style.transform = this.getImageTransformCss(exifOrientation);
      });
      this.div2.style.opacity = '0';
    };
    image.src = encodeURI(this.imageList[this.imageIndex]);
    this.sendNotification('BACKGROUNDSLIDESHOW_IMAGE_UPDATED', {url:image.src});
    // console.info('Updating image, source:' + image.src);
    this.imageIndex += 1;
  },

  getImageTransformCss: function(exifOrientation) {
    switch(exifOrientation) {
      case 2:
        return "scaleX(-1)";
      case 3:
        return "scaleX(-1) scaleY(-1)";
      case 4:
        return "scaleY(-1)";
      case 5:
        return "scaleX(-1) rotate(90deg)";
      case 6:
        return "rotate(90deg)";
      case 7:
        return "scaleX(-1) rotate(-90deg)";
      case 8:
        return "rotate(-90deg)";
      case 1:  // Falls through.
      default:
        return "rotate(0deg)";
    }
  },

  updateImageInfo: function(imageSrc, imageDate) {
    let imageProps = [];
    this.config.imageInfo.forEach((prop, idx) => {
      switch (prop) {
        case 'date':
          imageProps.push(imageDate);
          break;
          
        case 'name': // default is name
          // Only display last path component as image name if recurseSubDirectories is not set.
          let imageName = imageSrc.split('/').pop();

          // Otherwise display path relative to the path in configuration.
          if (this.config.recursiveSubDirectories) {
            for (const path of this.config.imagePaths) {
              if (!imageSrc.includes(path)) {
                continue;
              }

              imageName = imageSrc.split(path).pop();
              if (imageName.startsWith('/')) {
                imageName = imageName.substr(1);
              }
              break;
            }
          }
          imageProps.push(imageName);
          break;
        default:
          Log.warn(prop + ' is not a valid value for imageInfo.  Please check your configuration');
      }
    });

    let innerHTML = '<header class="infoDivHeader">Picture Info</header>';
    imageProps.forEach( (val, idx) => {
      innerHTML += val + '<br/>';
    });
    
    this.imageInfoDiv.innerHTML = innerHTML;
  },

  swapDivs: function() {
    var temp = this.div1;
    this.div1 = this.div2;
    this.div2 = temp;
  },

  suspend: function() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  resume: function() {
    //this.updateImage(); //Removed to prevent image change whenever MMM-Carousel changes slides
    this.suspend();
    var self = this;
    this.timer = setInterval(function() {
		// console.info('MMM-BackgroundSlideshow updating from resume');
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
