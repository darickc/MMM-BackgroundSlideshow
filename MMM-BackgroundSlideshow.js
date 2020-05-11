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
    imageInfo: 'name, date, imagecount',
    // location of the info div
    imageInfoLocation: 'bottomRight', // Other possibilities are: bottomLeft, topLeft, topRight
    // transition speed from one image to the other, transitionImages must be true
    transitionSpeed: '2s',
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
    gradient: ['rgba(0, 0, 0, 0.75) 0%', 'rgba(0, 0, 0, 0) 40%', 'rgba(0, 0, 0, 0) 80%', 'rgba(0, 0, 0, 0.75) 100%'],
    horizontalGradient: ['rgba(0, 0, 0, 0.75) 0%', 'rgba(0, 0, 0, 0) 40%', 'rgba(0, 0, 0, 0) 80%', 'rgba(0, 0, 0, 0.75) 100%'],
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
    backgroundAnimationLoopCount: 'infinite',
    // Transitions to use
    transitions: [
      'opacity',
      'slideFromRight',
      'slideFromLeft',
      'slideFromTop',
      'slideFromBottom',
      'slideFromTopLeft',
      'slideFromTopRight',
      'slideFromBottomLeft',
      'slideFromBottomRight',
      'flipX',
      'flipY',
    ],
    transitionTimingFunction: 'cubic-bezier(.07,.71,.24,.97)',
    animations: ['slide', 'zoomOut', 'zoomIn'],
  },

  // load function
  start: function () {
    this.play = true;
    // add identifier to the config
    this.config.identifier = this.identifier;
    // ensure file extensions are lower case
    this.config.validImageFileExtensions = this.config.validImageFileExtensions.toLowerCase();
    // ensure image order is in lower case
    this.config.sortImagesBy = this.config.sortImagesBy.toLowerCase();

    //validate imageinfo property.  This will make sure we have at least 1 valid value
    const imageInfoRegex = /\bname\b|\bdate\b/gi;
    if (this.config.showImageInfo && !imageInfoRegex.test(this.config.imageInfo)) {
      Log.warn('MMM-BackgroundSlideshow: showImageInfo is set, but imageInfo does not have a valid value.');
      // Use name as the default
      this.config.imageInfo = ['name'];
    } else {
      // convert to lower case and replace any spaces with , to make sure we get an array back
      // even if the user provided space separated values
      this.config.imageInfo = this.config.imageInfo.toLowerCase().replace(/\s/g, ',').split(',');
      // now filter the array to only those that have values
      this.config.imageInfo = this.config.imageInfo.filter((n) => n);
    }

    if (!this.config.transitionImages) {
      this.config.transitionSpeed = '0';
    }

    if (this.config.transitionSpeed.includes('ms')) {
      this.transitionSpeed = this.config.transitionSpeed.replace('ms', '') * 1;
    } else if (this.config.transitionSpeed.includes('s')) {
      this.transitionSpeed = this.config.transitionSpeed.replace('s', '') * 1000;
    }

    // Lets make sure the backgroundAnimation duration matches the slideShowSpeed unless it has been
    // overriden
    if (this.config.backgroundAnimationDuration === '1s') {
      this.config.backgroundAnimationDuration = this.config.slideshowSpeed / 1000 + 's';
    }

    // Chrome versions < 81 do not support EXIF orientation natively. A CSS transformation
    // needs to be applied for the image to display correctly - see http://crbug.com/158753 .
    this.browserSupportsExifOrientationNatively = CSS.supports('image-orientation: from-image');

    if (this.config.imagePaths.length == 0) {
      Log.error('MMM-BackgroundSlideshow: Missing required parameter imagePaths.');
    } else {
      // create an empty image list
      this.imageList = [];
      // set beginning image index to 0, as it will auto increment on start
      this.imageIndex = 0;
      this.updateImageList();
    }
  },

  getScripts: function () {
    return [
      // 'modules/' + this.name + '/BackgroundSlideshow-webworker.js',
      'modules/' + this.name + '/node_modules/exif-js/exif.js',
      'modules/' + this.name + '/node_modules/lodash/lodash.js',
      'moment.js',
    ];
  },

  getStyles: function () {
    // the css contains the make grayscale code
    return ['BackgroundSlideshow.css'];
  },

  // generic notification handler
  notificationReceived: function (notification, payload, sender) {
    if (sender) {
      // Log.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
      if (notification === 'BACKGROUNDSLIDESHOW_IMAGE_UPDATE') {
        Log.log('MMM-BackgroundSlideshow: Changing Background');
        this.suspend();
        this.resume();
      } else if (notification === 'BACKGROUNDSLIDESHOW_NEXT') {
        // Change to next image
        if (!this.updateTimer) {
          this.imageIndex--;
        }
        this.clearTimer();
        this.imagePromise = null;
        this.nextImage();
      } else if (notification === 'BACKGROUNDSLIDESHOW_PREVIOUS') {
        // Change to previous image
        if (!this.updateTimer) {
          this.imageIndex--;
        }
        this.clearTimer();
        this.nextImage(true);
      } else if (notification === 'BACKGROUNDSLIDESHOW_PLAY') {
        // Change to next image and start timer.
        this.resume();
      } else if (notification === 'BACKGROUNDSLIDESHOW_PAUSE') {
        // Stop timer.
        this.suspend();
      } else if (notification === 'BACKGROUNDSLIDESHOW_URL') {
        if (payload && payload.url) {
          // Stop timer.
          this.suspend();
          if (payload.resume) {
            this.play = true;
          }
          this.nextImage(false, payload.url);
        }
      } else if (notification === 'BACKGROUNDSLIDESHOW_URLS') {
        if (payload && payload.urls && payload.urls.length) {
          // check if image list has been saved. If not, this is the first time the notification is received
          // save the image list and index.
          if (!this.savedImages) {
            this.savedImages = this.imageList;
            this.savedIndex = this.imageIndex;
            this.updateImageListWithArray(payload.urls);
          } else {
            // check if there the sent urls are the same, or different.
            let temp = _.union(payload.urls, this.imageList);
            // if they are the same length, then they haven't changed, so don't do anything.
            if (temp.length !== this.imageList.length) {
              this.updateImageListWithArray(payload.urls);
            }
          }
          // no urls sent, see if there is saved data.
        } else if (this.savedImages) {
          this.imageList = this.savedImages;
          this.imageIndex = this.savedIndex;
          this.savedImages = null;
          this.savedIndex = null;
          this.clearTimer();
          this.nextImage();
        }
      } else {
        // Log.log(this.name + " received a system notification: " + notification);
      }
    }
  },

  updateImageListWithArray: function (urls) {
    this.imageList = urls;
    this.imageIndex = 0;
    this.clearTimer();
    this.nextImage();
  },

  // the socket handler
  socketNotificationReceived: function (notification, payload) {
    // if an update was received
    if (notification === 'BACKGROUNDSLIDESHOW_FILELIST') {
      // check this is for this module based on the woeid
      if (payload.identifier === this.identifier) {
        // console.info('Returning Images, payload:' + JSON.stringify(payload));
        // set the image list
        if (this.savedImages) {
          this.savedImages = payload.imageList;
          this.savedIndex = 0;
        } else {
          this.imageList = payload.imageList;
          // if image list actually contains images
          // set loaded flag to true and update dom
          if (this.imageList.length > 0) {
            //this.updateImage(); //Added to show the image at least once, but not change it within this.resume()
            this.resume();
          }
        }
      }
    }
  },

  // Override dom generator.
  getDom: function () {
    var wrapper = document.createElement('div');
    this.imagesDiv = document.createElement('div');
    this.imagesDiv.className = 'images';
    wrapper.appendChild(this.imagesDiv);

    if (this.config.gradientDirection === 'vertical' || this.config.gradientDirection === 'both') {
      this.createGradientDiv('bottom', this.config.gradient, wrapper);
    }

    if (this.config.gradientDirection === 'horizontal' || this.config.gradientDirection === 'both') {
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

  createGradientDiv: function (direction, gradient, wrapper) {
    var div = document.createElement('div');
    div.style.backgroundImage = 'linear-gradient( to ' + direction + ', ' + gradient.join() + ')';
    div.className = 'gradient';
    wrapper.appendChild(div);
  },

  createDiv: function () {
    var div = document.createElement('div');
    div.style.backgroundSize = this.config.backgroundSize;
    div.style.backgroundPosition = this.config.backgroundPosition;
    div.className = 'image';
    return div;
  },

  createImageInfoDiv: function (wrapper) {
    const div = document.createElement('div');
    div.className = 'info ' + this.config.imageInfoLocation;
    wrapper.appendChild(div);
    return div;
  },

  createProgressbarDiv: function (wrapper, slideshowSpeed) {
    const div = document.createElement('div');
    div.className = 'progress';
    const inner = document.createElement('div');
    inner.className = 'progress-inner';
    inner.style.display = 'none';
    inner.style.animation = `move ${slideshowSpeed}ms linear`;
    div.appendChild(inner);
    wrapper.appendChild(div);
  },

  nextImage: function (backToPreviousImage = false, imageToDisplay = null) {
    let self = this;
    if (backToPreviousImage || imageToDisplay) {
      self.imagePromise = null;
    }

    if (!self.imagePromise) {
      self.updateImage(backToPreviousImage, imageToDisplay);
    }

    self.imagePromise.then(
      (imageData) => {
        if (self.imagesDiv.childNodes.length > 1) {
          self.imagesDiv.removeChild(this.imagesDiv.childNodes[0]);
        }
        if (self.imagesDiv.childNodes.length > 0) {
          self.imagesDiv.childNodes[0].style.opacity = '0';
        }
        if (self.config.showProgressBar) {
          // Restart css animation
          const oldDiv = document.getElementsByClassName('progress-inner')[0];
          const newDiv = oldDiv.cloneNode(true);
          oldDiv.parentNode.replaceChild(newDiv, oldDiv);
          newDiv.style.display = '';
        }
        if (self.config.showImageInfo) {
          self.updateImageInfo(imageData.url, imageData.dateTime);
        }
        self.imagesDiv.appendChild(imageData.div);
        URL.revokeObjectURL(imageData.objectURL);

        // don't try pre-loading a new image until the transition is done. It can make it jerky.
        self.updateTimer = setTimeout(() => {
          self.updateTimer = null;
          self.updateImage();
        }, this.transitionSpeed);
        if (self.play) {
          self.timer = setTimeout(() => {
            self.nextImage();
          }, self.config.slideshowSpeed);
        }
      },
      (error) => console.log(error.message)
    );
  },

  updateImage: function (backToPreviousImage = false, imageToDisplay = null) {
    let self = this;
    this.imagePromise = new Promise(function (resolve, reject) {
      let imageUrl = self.getNextImageUrl(backToPreviousImage, imageToDisplay);
      if (!imageUrl) {
        reject(new Error('No image to display'));
        return;
      }

      self.toDataURL(imageUrl, (image, objectUrl) => {
        var imageData = self.createImageDiv(imageUrl, image);
        imageData.objectUrl = objectUrl;
        imageData.image = image;
        resolve(imageData);
      });
    });
  },

  createImageDiv: function (url, image) {
    let imageData = { url };
    const transitionDiv = document.createElement('div');
    transitionDiv.className = 'transition';
    if (this.config.transitionImages && this.config.transitions.length > 0) {
      let randomNumber = Math.floor(Math.random() * this.config.transitions.length);
      transitionDiv.style.animationDuration = this.config.transitionSpeed;
      transitionDiv.style.transition = `opacity ${this.config.transitionSpeed} ease-in-out`;
      transitionDiv.style.animationName = this.config.transitions[randomNumber];
      transitionDiv.style.animationTimingFunction = this.config.transitionTimingFunction;
    }

    const imageDiv = this.createDiv();
    imageDiv.style.backgroundImage = `url("${image.src}")`;

    // Check to see if we need to animate the background
    if (this.config.backgroundAnimationEnabled && this.config.animations.length) {
      randomNumber = Math.floor(Math.random() * this.config.animations.length);
      const animation = this.config.animations[randomNumber];
      imageDiv.style.animationDuration = this.config.backgroundAnimationDuration;
      imageDiv.style.animationDelay = this.config.transitionSpeed;

      if (animation === 'slide') {
        // check to see if the width of the picture is larger or the height
        var width = image.width;
        var height = image.height;
        var adjustedWidth = (width * window.innerHeight) / height;
        var adjustedHeight = (height * window.innerWidth) / width;

        imageDiv.style.backgroundPosition = '';
        imageDiv.style.animationIterationCount = this.config.backgroundAnimationLoopCount;
        imageDiv.style.backgroundSize = 'cover';

        if (adjustedWidth / window.innerWidth > adjustedHeight / window.innerHeight) {
          // Scrolling horizontally...
          imageDiv.className += ' slideH';
        } else {
          // Scrolling vertically...
          imageDiv.className += ' slideV';
        }
      } else {
        imageDiv.className += ` ${animation}`;
      }
    }
    EXIF.getData(image, () => {
      if (this.config.showImageInfo) {
        let dateTime = EXIF.getTag(image, 'DateTimeOriginal');
        // attempt to parse the date if possible
        if (dateTime !== null) {
          try {
            dateTime = moment(dateTime, 'YYYY:MM:DD HH:mm:ss');
            dateTime = dateTime.format('dddd MMMM D, YYYY HH:mm');
            imageData.dateTime = dateTime;
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
      }

      if (!this.browserSupportsExifOrientationNatively) {
        const exifOrientation = EXIF.getTag(image, 'Orientation');
        imageDiv.style.transform = this.getImageTransformCss(exifOrientation);
      }
    });
    transitionDiv.appendChild(imageDiv);
    imageData.div = transitionDiv;
    return imageData;
  },

  getNextImageUrl(backToPreviousImage = false, imageToDisplay = null) {
    if (imageToDisplay) {
      return imageToDisplay;
    }
    if (!this.imageList || !this.imageList.length) {
      return null;
    }

    if (backToPreviousImage) {
      this.imageIndex -= 2;
      if (this.imageIndex < 0) {
        this.imageIndex = 0;
      }
    }

    if (this.imageIndex >= this.imageList.length) {
      this.imageIndex = 0;
      // only update the image list if one wasn't sent through notifications
      if (!this.savedImages && backToPreviousImage) {
        this.suspend();
        this.updateImageList();
        return null;
      }
    }
    return this.imageList[this.imageIndex++];
  },

  // preload image and convert to base64 encoded image for better performance
  toDataURL: function (url, callback) {
    const ImageLoaderWorker = new Worker('modules/' + this.name + '/BackgroundSlideshow-webworker.js');
    ImageLoaderWorker.addEventListener('message', (event) => {
      const imageData = event.data;
      const objectURL = URL.createObjectURL(imageData.blob);
      const image = new Image();
      image.onload = () => {
        callback(image, objectURL);
      };
      image.src = objectURL;
      ImageLoaderWorker.terminate();
    });
    if (!url.startsWith('http') && !url.startsWith('/')) {
      url = '/' + url;
    }
    ImageLoaderWorker.postMessage(encodeURI(url));
  },

  getImageTransformCss: function (exifOrientation) {
    switch (exifOrientation) {
      case 2:
        return 'scaleX(-1)';
      case 3:
        return 'scaleX(-1) scaleY(-1)';
      case 4:
        return 'scaleY(-1)';
      case 5:
        return 'scaleX(-1) rotate(90deg)';
      case 6:
        return 'rotate(90deg)';
      case 7:
        return 'scaleX(-1) rotate(-90deg)';
      case 8:
        return 'rotate(-90deg)';
      case 1: // Falls through.
      default:
        return 'rotate(0deg)';
    }
  },

  updateImageInfo: function (imageSrc, imageDate) {
    let imageProps = [];
    this.config.imageInfo.forEach((prop, idx) => {
      switch (prop) {
        case 'date':
          if (imageDate && imageDate != 'Invalid date') {
            imageProps.push(imageDate);
          }
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
        case 'imagecount':
          imageProps.push(`${this.imageIndex} of ${this.imageList.length}`);
          break;
        default:
          Log.warn(prop + ' is not a valid value for imageInfo.  Please check your configuration');
      }
    });

    let innerHTML = '<header class="infoDivHeader">Picture Info</header>';
    imageProps.forEach((val, idx) => {
      innerHTML += val + '<br/>';
    });

    this.imageInfoDiv.innerHTML = innerHTML;
  },

  suspend: function () {
    this.clearTimer();
    this.play = false;
  },

  resume: function () {
    this.play = true;
    this.nextImage();
  },

  clearTimer: function () {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },

  updateImageList: function () {
    // console.info('Getting Images');
    // ask helper function to get the image list
    this.sendSocketNotification('BACKGROUNDSLIDESHOW_REGISTER_CONFIG', this.config);
  },
});
