/*
 * node_helper.js
 *
 * MagicMirror²
 * Module: MMM-BackgroundSlideshow
 *
 * MagicMirror² By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-BackgroundSlideshow By Darick Carpenter
 * MIT Licensed.
 */

// call in the required classes
const NodeHelper = require('node_helper');
const FileSystemImageSlideshow = require('fs');
const os = require('os');
const {exec} = require('child_process');
const express = require('express');
const Log = require('../../js/logger.js');
const basePath = '/images/';
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// the main module helper create
module.exports = NodeHelper.create({

  // subclass start method, clears the initial config array
  start () {
    this.excludePaths = new Set();
    this.validImageFileExtensions = new Set();
    this.expressInstance = this.expressApp;
    this.imageList = [];
    this.alreadyShownSet = new Set();
    this.index = 0;
    this.timer = null;
    self = this;

    this.cacheFilePath = path.resolve(__dirname, 'geoCache.json');
    this.geoCache = {};

    // Load cache on startup if file exists
    this.loadCache();
  },

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const content = fs.readFileSync(this.cacheFilePath, 'utf-8');
        this.geoCache = JSON.parse(content);
        Log.info('Geo cache loaded');
      }
    } catch (e) {
      Log.warn('Failed to load geo cache:', e);
      this.geoCache = {};
    }
  },

  saveCache() {
    try {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.geoCache, null, 2), 'utf-8');
      Log.info('Geo cache saved');
    } catch (e) {
      Log.warn('Failed to save geo cache:', e);
    }
  },

  async fetchReverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'YourAppName/1.0 (rgroppa@gmail.com)'
      }
    });
    if (!response.ok) {
      throw new Error(`Reverse geocode failed: ${response.statusText}`);
    }
    const data = await response.json();
    return data.name || '';
  },

  // shuffles an array at random and returns it
  shuffleArray (array) {
    for (let i = array.length - 1; i > 0; i--) {
      // j is a random index in [0, i].
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  // sort by filename attribute
  sortByFilename (a, b) {
    const aL = a.path.toLowerCase();
    const bL = b.path.toLowerCase();
    if (aL > bL) return 1;
    return -1;
  },

  // sort by created attribute
  sortByCreated (a, b) {
    const aL = a.created;
    const bL = b.created;
    if (aL > bL) return 1;
    return -1;
  },

  // sort by created attribute
  sortByModified (a, b) {
    const aL = a.modified;
    const bL = b.modified;
    if (aL > bL) return 1;
    return -1;
  },

  sortImageList (imageList, sortBy, sortDescending) {
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
  checkValidImageFileExtension (filename) {
    if (!filename.includes('.')) {
      // No file extension.
      return false;
    }
    const fileExtension = filename.split('.').pop()
      .toLowerCase();
    return this.validImageFileExtensions.has(fileExtension);
  },
  excludedFiles (currentDir) {
    try {
	  const excludedFile = FileSystemImageSlideshow.readFileSync(`${currentDir}/excludeImages.txt`, 'utf8');
	  const listOfExcludedFiles = excludedFile.split(/\r?\n/u);
	  Log.info(`found excluded images list: in dir: ${currentDir} containing: ${listOfExcludedFiles.length} files`);
	  return listOfExcludedFiles;
    } catch (err) {
	  // no excludeImages.txt in current folder
	  return [];
    }
  },
  isExcluded (filename, excludedImagesList) {
	  if (excludedImagesList.includes(filename.replace(/\.[a-zA-Z]{3,4}$/u, ''))) {
		  Log.info(`${filename} is excluded in excludedImages.txt!`);
		  return true;
	  }
		  return false;
  },
	readEntireShownFile ( ) {
	  const filepath = 'modules/MMM-BackgroundSlideshow/filesShownTracker.txt';
		try {
			const filesShown = FileSystemImageSlideshow.readFileSync(filepath, 'utf8');
			const listOfShownFiles = filesShown.split(/\r?\n/u).filter(line => line.trim() !== '');
			Log.info(`found filesShownTracker: in path: ${filepath} containing: ${listOfShownFiles.length} files`)
			return new Set(listOfShownFiles);
		} catch (err) {
			Log.info(`error reading filesShownTracker: in path: ${filepath}`)
			//no excludeImages.txt in current folder
			return new Set();
		}
	},
	addImageToShown ( imgPath ) {
	  self.alreadyShownSet.add(imgPath)
	  const filePath = 'modules/MMM-BackgroundSlideshow/filesShownTracker.txt';
		if (!FileSystemImageSlideshow.existsSync(filePath)) {
			FileSystemImageSlideshow.writeFileSync(filePath, imgPath + '\n', { flag: 'wx' });
		} else {
			FileSystemImageSlideshow.appendFileSync(filePath, imgPath + '\n');
		}
	},
  resetShownImagesFile(){
    try {
      FileSystemImageSlideshow.writeFileSync('modules/MMM-BackgroundSlideshow/filesShownTracker.txt', '', 'utf8');
    } catch (err) {
      console.error('Error writing empty filesShownTracker.txt', err);
    }
  },
  // gathers the image list
  gatherImageList (config, sendNotification) {
    // Invalid config. retrieve it again
    if (typeof config === 'undefined' || !Object.hasOwn(Object(config), 'imagePaths')) {
      this.sendSocketNotification('BACKGROUNDSLIDESHOW_REGISTER_CONFIG');
      return;
    }
    // create an empty main image list
    this.imageList = [];
	if(config.showAllImagesBeforeRestart){
		this.alreadyShownSet = this.readEntireShownFile()
	}
    for (let i = 0; i < config.imagePaths.length; i++) {
	  const excludedImagesList = this.excludedFiles(config.imagePaths[i]);
      this.getFiles(config.imagePaths[i], this.imageList, excludedImagesList, config);
    }
	const imageListToUse = config.showAllImagesBeforeRestart
	  ? this.imageList.filter(image => !this.alreadyShownSet.has(image.path))
		: this.imageList;

	Log.info(`skipped ${this.imageList.length - imageListToUse.length} files since allready seen!`)
	this.imageList = config.randomizeImageOrder
	  ? this.shuffleArray(imageListToUse)
	  : this.sortImageList(
		  imageListToUse,
		  config.sortImagesBy,
		  config.sortImagesDescending
	  );
    Log.info(`BACKGROUNDSLIDESHOW: ${this.imageList.length} files found`);
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

  getNextImage () {
    if (!this.imageList.length || this.index >= this.imageList.length) {
      // if there are no images or all the images have been displayed, try loading the images again
      if(this.config.showAllImagesBeforeRestart){
        this.resetShownImagesFile()
      }
      this.gatherImageList(this.config);
    }
    //
    if (!this.imageList.length) {
      // still no images, search again after 10 mins
      setTimeout(() => {
        this.getNextImage(this.config);
      }, 600000);
      return;
    }

    const image = this.imageList[this.index++];
    Log.info(`BACKGROUNDSLIDESHOW: reading path "${image.path}"`);
    self = this;
    this.readFile(image.path, (data) => {
      const returnPayload = {
        identifier: self.config.identifier,
        path: image.path,
        data,
        index: self.index,
        total: self.imageList.length
      };
      self.sendSocketNotification(
        'BACKGROUNDSLIDESHOW_DISPLAY_IMAGE',
        returnPayload
      );
    });

    // (re)set the update timer
    this.startOrRestartTimer();
  	if(this.config.showAllImagesBeforeRestart) {
	  this.addImageToShown(image.path)
	}
  },

  // stop timer if it's running
  stopTimer () {
    if (this.timer) {
      Log.debug('BACKGROUNDSLIDESHOW: stopping update timer');
      const it = this.timer;
      this.timer = null;
      clearTimeout(it);
    }
  },
  // resume timer if it's not running; reset if it is
  startOrRestartTimer () {
    this.stopTimer();
    Log.debug('BACKGROUNDSLIDESHOW: restarting update timer');
    this.timer = setTimeout(() => {
      self.getNextImage();
    }, self.config?.slideshowSpeed || 10000);
  },

  getPrevImage () {
    // imageIndex is incremented after displaying an image so -2 is needed to
    // get to previous image index.
    this.index -= 2;

    // Case of first image, go to end of array.
    if (this.index < 0) {
      this.index = 0;
    }
    this.getNextImage();
  },
  resizeImage (input, callback) {
    Log.log(`resizing image to max: ${this.config.maxWidth}x${this.config.maxHeight}`);
    const transformer = sharp()
      .rotate()
      .resize({
        width: parseInt(this.config.maxWidth, 10),
        height: parseInt(this.config.maxHeight, 10),
        fit: 'inside',
      })
      .keepMetadata()
      .jpeg({quality: 80});

    // Streama image data from file to transformation and finally to buffer
    const outputStream = [];

    FileSystemImageSlideshow.createReadStream(input)
      .pipe(transformer) // Stream to Sharp för att resizea
      .on('data', (chunk) => {
        outputStream.push(chunk); // add chunks in a buffer array
      })
      .on('end', () => {
        const buffer = Buffer.concat(outputStream);
        callback(`data:image/jpg;base64, ${buffer.toString('base64')}`);
        Log.log('resizing done!');
      })
      .on('error', (err) => {
        Log.error('Error resizing image:', err);
      });
  },

  readFile (filepath, callback) {
    const ext = filepath.split('.').pop();

    if (this.config.resizeImages) {
      this.resizeImage(filepath, callback);
    } else {
      Log.log('resizeImages: false');
      // const data = FileSystemImageSlideshow.readFileSync(filepath, { encoding: 'base64' });
      // callback(`data:image/${ext};base64, ${data}`);
      const chunks = [];
      FileSystemImageSlideshow.createReadStream(filepath)
        .on('data', (chunk) => {
          chunks.push(chunk); // Samla chunkar av data
        })
        .on('end', () => {
          const buffer = Buffer.concat(chunks);
          callback(`data:image/${ext.slice(1)};base64, ${buffer.toString('base64')}`);
        })
        .on('error', (err) => {
          Log.error('Error reading file:', err);
        })
        .on('close', () => {
          Log.log('Stream closed.');
        });
    }
  },

  getFiles (imagePath, imageList, excludedImagesList, config) {
    const contents = FileSystemImageSlideshow.readdirSync(imagePath);
    Log.info(`BACKGROUNDSLIDESHOW: Reading directory "${imagePath}" for images, found ${contents.length} files and directories`);
    for (let i = 0; i < contents.length; i++) {
      if (this.excludePaths.has(contents[i])) {
        continue;
      }
      const currentItem = `${imagePath}/${contents[i]}`;
      const stats = FileSystemImageSlideshow.lstatSync(currentItem);
      if (stats.isDirectory() && config.recursiveSubDirectories) {
        this.getFiles(currentItem, imageList, this.excludedFiles(currentItem), config);
      } else if (stats.isFile()) {
        const isValidImageFileExtension = this.checkValidImageFileExtension(currentItem);
        const isExcluded = this.isExcluded(contents[i], excludedImagesList);
        if (isValidImageFileExtension && !isExcluded) {
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
  socketNotificationReceived (notification, payload) {
    if (notification === 'IMAGE_GEO_REQUEST') {
      const { key, lat, lon } = payload;
      Log.info(payload)
      if (this.geoCache[key]) {
        Log.info("Returned cached results")
        this.sendSocketNotification('IMAGE_GEO_RESULT', {
          key,
          lat,
          lon,
          location: this.geoCache[key]
        });
      } else {
        this.fetchReverseGeocode(lat, lon)
          .then(location => {
            this.geoCache[key] = location;
            this.saveCache();
            this.sendSocketNotification('IMAGE_GEO_RESULT', {
              key,
              lat,
              lon,
              location
            });
          })
          .catch(error => {
            this.sendSocketNotification('IMAGE_GEO_RESULT', {
              key,
              lat,
              lon,
              error: error.message
            });
          });
      }
    } else if (notification === 'BACKGROUNDSLIDESHOW_REGISTER_CONFIG') {
      const config = payload;
      this.expressInstance.use(
        basePath + config.imagePaths[0],
        express.static(config.imagePaths[0], {maxAge: 3600000})
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
        this.getNextImage();
      }, 200);
    } else if (notification === 'BACKGROUNDSLIDESHOW_PLAY_VIDEO') {
      Log.info('mw got BACKGROUNDSLIDESHOW_PLAY_VIDEO');
      Log.info(`cmd line: omxplayer --win 0,0,1920,1080 --alpha 180 ${payload[0]}`);
      exec(
        `omxplayer --win 0,0,1920,1080 --alpha 180 ${payload[0]}`,
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
    } else if (notification === 'BACKGROUNDSLIDESHOW_PAUSE') {
      this.stopTimer();
    } else if (notification === 'BACKGROUNDSLIDESHOW_PLAY') {
      this.startOrRestartTimer();
    }
  }
});
