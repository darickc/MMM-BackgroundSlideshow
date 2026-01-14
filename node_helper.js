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

const FileSystemImageSlideshow = require('node:fs');
const {exec} = require('node:child_process');
const NodeHelper = require('node_helper');
const express = require('express');
const Log = require('../../js/logger.js');
const basePath = '/images/';
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { json } = require('node:stream/consumers');

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
  shuffleImagesLoopFolders (filePaths) {
    Log.log('[MMM-BackgroundSlideshow] shuffleImagesLoopFolders = true!');
    Log.debug(`[MMM-BackgroundSlideshow] filePaths: \n${filePaths.map((img) => `${img.path}\n`)}`);
    const groupedByFolder = new Map();
    for (const imgobject of filePaths) {
      const parts = imgobject.path.split('/');
      const folder = parts[parts.length - 2]; // or use the config.imagePaths?
      if (!groupedByFolder.has(folder)) {
        groupedByFolder.set(folder, []);
      }
      groupedByFolder.get(folder).push(imgobject);
    }
    // find subfolder with max amount of images:
    let maxLength = 0;
    for (const imageArray of groupedByFolder.values()) {
      maxLength = Math.max(maxLength, imageArray.length);
    }

    // shuffle all subfolders individually
    for (const folderPaths of groupedByFolder.values()) {
      this.shuffleArray(folderPaths);
    }

    const result = [];
    const folderKeys = Array.from(groupedByFolder.keys());
    // map of pointers to keep track of image index for subfolders
    const pointers = new Map(folderKeys.map((key) => [key, 0]));
    let lastPickedFolder = null;

    for (let i = 0; i < maxLength; i++) {
      // re-shuffle subfolders so that the order is not the same
      const pickableFolders = this.shuffleArray(folderKeys);
      if (pickableFolders[0] === lastPickedFolder) {
        // simply swap first/last if lastpickedfolder happened to be first
        [pickableFolders[0], pickableFolders[pickableFolders.length - 1]] =
          [pickableFolders[pickableFolders.length - 1], pickableFolders[0]];
      }
      for (const nextFolder of pickableFolders) {
        const imagePointer = pointers.get(nextFolder);
        const image = groupedByFolder.get(nextFolder)[imagePointer];

        result.push(image);

        if (imagePointer + 1 === groupedByFolder.get(nextFolder).length) {
          // current folder has run out of images, restart this folder
          this.shuffleArray(groupedByFolder.get(nextFolder));
          pointers.set(nextFolder, 0);
        } else {
          pointers.set(nextFolder, imagePointer + 1);
        }
        lastPickedFolder = nextFolder; // we dont want the same folder in a row
      }
    }
    return result;
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
    let sortedList;
    switch (sortBy) {
      case 'created':
        Log.debug('[MMM-BackgroundSlideshow] Sorting by created date...');
        sortedList = imageList.sort(this.sortByCreated);
        break;
      case 'modified':
        Log.debug('[MMM-BackgroundSlideshow] Sorting by modified date...');
        sortedList = imageList.sort(this.sortByModified);
        break;
      default:
        Log.debug('[MMM-BackgroundSlideshow] Sorting by name...');
        sortedList = imageList.sort(this.sortByFilename);
    }

    // If the user chose to sort in descending order then reverse the array
    if (sortDescending === true) {
      Log.debug('[MMM-BackgroundSlideshow] Reversing sort order...');
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
      Log.info(`[MMM-BackgroundSlideshow] Found excluded images list: in dir: ${currentDir} containing: ${listOfExcludedFiles.length} files`);
      return listOfExcludedFiles;
    } catch {
      Log.debug('[MMM-BackgroundSlideshow] No "excludeImages.txt" in current folder.');
      return [];
    }
  },
  isExcluded (filename, excludedImagesList) {
    if (excludedImagesList.includes(filename.replace(/\.[a-zA-Z]{3,4}$/u, ''))) {
      Log.info(`[MMM-BackgroundSlideshow] ${filename} is excluded in excludedImages.txt!`);
      return true;
    }
    return false;
  },
  readEntireShownFile () {
    const filepath = 'modules/MMM-BackgroundSlideshow/filesShownTracker.txt';
    try {
      const filesShown = FileSystemImageSlideshow.readFileSync(filepath, 'utf8');
      const listOfShownFiles = filesShown.split(/\r?\n/u).filter((line) => line.trim() !== '');
      Log.info(`[MMM-BackgroundSlideshow] Found filesShownTracker: in path: ${filepath} containing: ${listOfShownFiles.length} files`);
      return new Set(listOfShownFiles);
    } catch {
      Log.info(`[MMM-BackgroundSlideshow] Error reading filesShownTracker: in path: ${filepath}`);
      return new Set();
    }
  },
  addImageToShown (imgPath) {
    self.alreadyShownSet.add(imgPath);
    const filePath = 'modules/MMM-BackgroundSlideshow/filesShownTracker.txt';
    if (FileSystemImageSlideshow.existsSync(filePath)) {
      FileSystemImageSlideshow.appendFileSync(filePath, `${imgPath}\n`);
    } else {
      FileSystemImageSlideshow.writeFileSync(filePath, `${imgPath}\n`, {flag: 'wx'});
    }
  },
  resetShownImagesFile () {
    try {
      FileSystemImageSlideshow.writeFileSync('modules/MMM-BackgroundSlideshow/filesShownTracker.txt', '', 'utf8');
    } catch (err) {
      Log.error('[MMM-BackgroundSlideshow] Error writing empty filesShownTracker.txt', err);
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
    if (config.showAllImagesBeforeRestart) {
      this.alreadyShownSet = this.readEntireShownFile();
    }
    for (let i = 0; i < config.imagePaths.length; i++) {
      const excludedImagesList = this.excludedFiles(config.imagePaths[i]);
      this.getFiles(config.imagePaths[i], this.imageList, excludedImagesList, config);
    }
    const imageListToUse = config.showAllImagesBeforeRestart
      ? this.imageList.filter((image) => !this.alreadyShownSet.has(image.path))
      : this.imageList;

    Log.info(`[MMM-BackgroundSlideshow] Skipped ${this.imageList.length - imageListToUse.length} files since already seen!`);
    let finalImageList;
    if (config.randomizeImagesLoopFolders) {
      finalImageList = this.shuffleImagesLoopFolders(imageListToUse);
    } else if (config.randomizeImageOrder) {
      finalImageList = this.shuffleArray(imageListToUse);
    } else {
      finalImageList = this.sortImageList(
        imageListToUse,
        config.sortImagesBy,
        config.sortImagesDescending
      );
    }

    this.imageList = finalImageList;
    Log.info(`[MMM-BackgroundSlideshow] ${this.imageList.length} files found`);
    Log.log(`[MMM-BackgroundSlideshow] ${this.imageList.map((img) => `${img.path}\n`)}`);
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
      if (this.config.showAllImagesBeforeRestart) {
        this.resetShownImagesFile();
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
    Log.info(`[MMM-BackgroundSlideshow] Reading path "${image.path}"`);
    self = this;

    const imageDirectory = path.dirname(image.path);
    const imageFilename = path.basename(image.path);

    let filesArray = [];
    let jsonFilePath = '';
    let json_metadata = {};

    try {
      if (fs.existsSync(imageDirectory)) {
        const files = fs.readdirSync(imageDirectory);

        filesArray = files.filter(file => {
          return file.startsWith(imageFilename) && path.extname(file).toLowerCase() === '.json';
        });
        // actually, there is only one file expected
        jsonFilePath = path.join(imageDirectory, filesArray[0]);
        console.log('JSON:', jsonFilePath);
        const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
        json_metadata = JSON.parse(jsonData);
      } else {
        console.log('Directory does not exist:', directoryPath);
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }
    let metadata = {};
    let latitude = null;
    let longitude = null;
    if (jsonFilePath !== '') {
      if (json_metadata.description && !json_metadata.description.toLowerCase().includes('uploader')) {
        console.log('Image description:', json_metadata.description);
        metadata.description = json_metadata.description;
      }
      if (json_metadata.photoTakenTime && json_metadata.photoTakenTime.formatted) {
        console.log('Image photoTakenTime:', json_metadata.photoTakenTime.formatted);
        metadata.photoTakenTime = json_metadata.photoTakenTime.formatted;
      } else if (json_metadata.creationTime && json_metadata.creationTime.formatted) {
        console.log('Image creationTime:', json_metadata.creationTime.formatted);
        metadata.creationTime = json_metadata.creationTime.formatted;
      }
      if (json_metadata.geoDataExif && json_metadata.geoDataExif.latitude && json_metadata.geoDataExif.longitude) {
        console.log('Image Exif position:', json_metadata.geoDataExif.longitude, json_metadata.geoDataExif.latitude);
        latitude = json_metadata.geoDataExif.latitude;
        longitude = json_metadata.geoDataExif.longitude;
      } else if (json_metadata.geoData && json_metadata.geoData.latitude && json_metadata.geoData.longitude) {
        console.log('Image position:', json_metadata.geoData.longitude, json_metadata.geoData.latitude);
        latitude = json_metadata.geoData.latitude;
        longitude = json_metadata.geoData.longitude;
      }
      if (json_metadata.url) {
        console.log('Image URL:', json_metadata.url);
        metadata.url = json_metadata.url;
      }
      // now let us search the friendly position name
      if (latitude && longitude) {
        let address = this.getAddressFromCoordinates(latitude, longitude);
        if (address) {
          metadata.address = address;
        } else {
          metadata.position = `${latitude}, ${longitude}`;
        }
      }
    }

    this.readFile(image.path, (data) => {
      const returnPayload = {
        identifier: self.config.identifier,
        path: image.path,
        data,
        index: self.index,
        total: self.imageList.length,
        metadata: metadata
      };
      self.sendSocketNotification(
        'BACKGROUNDSLIDESHOW_DISPLAY_IMAGE',
        returnPayload
      );
    });

    // (re)set the update timer
    this.startOrRestartTimer();
    if (this.config.showAllImagesBeforeRestart) {
      this.addImageToShown(image.path);
    }
  },

  getAddressFromCoordinates (latitude, longitude) {
    // Read the address cache from file if it exists
    let addressCache = {};
    try {
      const cacheData = fs.readFileSync('modules/MMM-BackgroundSlideshow/addressCache.json', 'utf8');
      addressCache = JSON.parse(cacheData);
    } catch (error) {
      // File doesn't exist or is invalid, use empty cache
      addressCache = {};
    }
    // Check if the address is already cached
    const cacheKey = `${latitude},${longitude}`;
    if (addressCache[cacheKey]) {
      console.log('Address found in cache:', addressCache[cacheKey]);
      return addressCache[cacheKey];
    }
    // If not cached, make a request to Google Maps Geocoding API
    const mapsApiKey = this.config.googleMapsApiKey || '';
    if (mapsApiKey === '') {
      console.log('No Google Maps API key provided.');
      return null;
    }
    const mapsApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${mapsApiKey}`;
    const https = require('https');
    https.get(mapsApiUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const geoData = JSON.parse(data);
          if (geoData.status === 'OK' && geoData.results.length > 0) {
            const address = geoData.results[0].formatted_address;
            console.log('Resolved address:', address);
            // Update the address cache and write it back to file
            addressCache[`${latitude},${longitude}`] = address;
            fs.writeFileSync('modules/MMM-BackgroundSlideshow/addressCache.json', JSON.stringify(addressCache), 'utf8');  

            return address;
          } else {
            console.log('No address found for the given coordinates.');
          }
        }
        catch (error) {
          console.error('Error parsing geocode response:', error);
        }
      });
    });
  return null;
  },


  // stop timer if it's running
  stopTimer () {
    if (this.timer) {
      Log.debug('[MMM-BackgroundSlideshow] Stopping update timer');
      const it = this.timer;
      this.timer = null;
      clearTimeout(it);
    }
  },
  // resume timer if it's not running; reset if it is
  startOrRestartTimer () {
    this.stopTimer();
    Log.debug('[MMM-BackgroundSlideshow] Restarting update timer');
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
    Log.log(`[MMM-BackgroundSlideshow] Resizing image to max: ${this.config.maxWidth}x${this.config.maxHeight}`);
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
        Log.log('[MMM-BackgroundSlideshow] Resizing done!');
      })
      .on('error', (err) => {
        Log.error('[MMM-BackgroundSlideshow] Error resizing image:', err);
      });
  },

  readFile (filepath, callback) {
    const ext = filepath.split('.').pop();

    if (this.config.resizeImages) {
      this.resizeImage(filepath, callback);
    } else {
      Log.log('[MMM-BackgroundSlideshow] ResizeImages: false');
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
          Log.error('[MMM-BackgroundSlideshow] Error reading file:', err);
        })
        .on('close', () => {
          Log.log('[MMM-BackgroundSlideshow] Stream closed.');
        });
    }
  },

  getFiles (imagePath, imageList, excludedImagesList, config) {
    const contents = FileSystemImageSlideshow.readdirSync(imagePath);
    Log.info(`[MMM-BackgroundSlideshow] Reading directory "${imagePath}" for images, found ${contents.length} files and directories`);
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
    if (notification === 'BACKGROUNDSLIDESHOW_REGISTER_CONFIG') {
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
      Log.info('[MMM-BackgroundSlideshow] mw got BACKGROUNDSLIDESHOW_PLAY_VIDEO');
      Log.info(`[MMM-BackgroundSlideshow] cmd line: omxplayer --win 0,0,1920,1080 --alpha 180 ${payload[0]}`);
      exec(
        `omxplayer --win 0,0,1920,1080 --alpha 180 ${payload[0]}`,
        () => {
          this.sendSocketNotification('BACKGROUNDSLIDESHOW_PLAY', null);
          Log.info('[MMM-BackgroundSlideshow] mw video done');
        }
      );
    } else if (notification === 'BACKGROUNDSLIDESHOW_NEXT_IMAGE') {
      Log.debug('[MMM-BackgroundSlideshow] BACKGROUNDSLIDESHOW_NEXT_IMAGE');
      this.getNextImage();
    } else if (notification === 'BACKGROUNDSLIDESHOW_PREV_IMAGE') {
      Log.debug('[MMM-BackgroundSlideshow] BACKGROUNDSLIDESHOW_PREV_IMAGE');
      this.getPrevImage();
    } else if (notification === 'BACKGROUNDSLIDESHOW_PAUSE') {
      this.stopTimer();
    } else if (notification === 'BACKGROUNDSLIDESHOW_PLAY') {
      this.startOrRestartTimer();
    }
  }
});
