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
// / ? FIXME const {json} = require('node:stream/consumers');

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
    Log.log('shuffleImagesLoopFolders = true!');
    Log.debug(`filePaths: \n${filePaths.map((img) => `${img.path}\n`)}`);
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
        Log.debug('Sorting by created date...');
        sortedList = imageList.sort(this.sortByCreated);
        break;
      case 'modified':
        Log.debug('Sorting by modified date...');
        sortedList = imageList.sort(this.sortByModified);
        break;
      default:
        Log.debug('Sorting by name...');
        sortedList = imageList.sort(this.sortByFilename);
    }

    // If the user chose to sort in descending order then reverse the array
    if (sortDescending === true) {
      Log.debug('Reversing sort order...');
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
      Log.info(`Found excluded images list: in dir: ${currentDir} containing: ${listOfExcludedFiles.length} files`);
      return listOfExcludedFiles;
    } catch {
      Log.debug('No "excludeImages.txt" in current folder.');
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
  readEntireShownFile () {
    const filepath = 'modules/MMM-BackgroundSlideshow/filesShownTracker.txt';
    try {
      const filesShown = FileSystemImageSlideshow.readFileSync(filepath, 'utf8');
      const listOfShownFiles = filesShown.split(/\r?\n/u).filter((line) => line.trim() !== '');
      Log.info(`Found filesShownTracker: in path: ${filepath} containing: ${listOfShownFiles.length} files`);
      return new Set(listOfShownFiles);
    } catch {
      Log.info(`Error reading filesShownTracker: in path: ${filepath}`);
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
      Log.error('Error writing empty filesShownTracker.txt', err);
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

    Log.info(`Skipped ${this.imageList.length - imageListToUse.length} files since already seen!`);
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
    Log.info(`${this.imageList.length} files found`);
    Log.log(`${this.imageList.map((img) => `${img.path}\n`)}`);
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
    Log.info(`Reading path "${image.path}"`);
    self = this;

    const imageDirectory = path.dirname(image.path);
    const imageFilename = path.basename(image.path);

    // get infos from Google TakeOut JSON file
    let filesArray = [];
    let jsonFilePath = '';
    let json_metadata = {};

    try {
      if (fs.existsSync(imageDirectory)) {
        const files = fs.readdirSync(imageDirectory);

        // when 2 images with same name in album, Google TakeOut will save the second as
        // 'Google Photos/2009/p2200111(1).jpg', and the json like
        // 'Google Photos/2009/p2200111.jpg.supplemental-metadata(1).json'
        // so let us handle these cases, also

        const match = imageFilename.replace(/\.[^.]+$/, '').match(/^(.+?)\s*\((\d+)\)$/);
        const baseFilename = match
          ? match[1]
          : imageFilename.replace(/\.[^.]+$/, '');
        const imageFilenameEnumeratedEnd = match
          ? `(${match[2]})`
          : '';

        filesArray = files.filter((file) => file.startsWith(baseFilename) && path.extname(file).toLowerCase() === `${imageFilenameEnumeratedEnd}.json`);
        // actually, there is only one file expected
        jsonFilePath = path.join(imageDirectory, filesArray[0]);
        Log.log('JSON:', jsonFilePath);
        const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
        json_metadata = JSON.parse(jsonData);
      } else {
        Log.warn('Directory does not exist:', imageDirectory);
      }
    } catch (error) {
      Log.error('Error reading directory ', imageDirectory, ':', error);
    }
    const metadata = {};
    let latitude = null;
    let longitude = null;
    if (jsonFilePath !== '') {
      if (
        json_metadata.description &&
        !this.config.excludeDescriptionsRegexps?.some((regexp) => new RegExp(regexp).test(json_metadata.description))
      ) {
        Log.debug('Image description:', json_metadata.description);
        metadata.description = json_metadata.description;
      }
      if (json_metadata.photoTakenTime && json_metadata.photoTakenTime.timestamp) {
        let {timestamp} = json_metadata.photoTakenTime;
        // Convert to number and handle both seconds and milliseconds timestamps
        timestamp = typeof timestamp === 'string'
          ? parseFloat(timestamp)
          : timestamp;
        // If timestamp is in seconds (typical for Unix timestamps), convert to milliseconds
        if (timestamp < 10000000000) {
          timestamp *= 1000;
        }
        const dateTime = new Date(timestamp);
        metadata.photoTakenTime = dateTime.toISOString().slice(0, 16)
          .replace('T', ' ');
        Log.debug('Photo taken time:', metadata.photoTakenTime, json_metadata.photoTakenTime.formatted);
      } else if (json_metadata.creationTime && json_metadata.creationTime.timestamp) {
        let {timestamp} = json_metadata.creationTime;
        // Convert to number and handle both seconds and milliseconds timestamps
        timestamp = typeof timestamp === 'string'
          ? parseFloat(timestamp)
          : timestamp;
        // If timestamp is in seconds (typical for Unix timestamps), convert to milliseconds
        if (timestamp < 10000000000) {
          timestamp *= 1000;
        }
        const dateTime = new Date(timestamp);
        metadata.creationTime = dateTime.toISOString().slice(0, 16)
          .replace('T', ' ');
        Log.debug('Photo creation time:', metadata.creationTime, json_metadata.creationTime.formatted);
      }
      if (json_metadata.geoDataExif && json_metadata.geoDataExif.latitude && json_metadata.geoDataExif.longitude) {
        Log.debug('Image Exif position:', json_metadata.geoDataExif.longitude, json_metadata.geoDataExif.latitude);
        latitude = json_metadata.geoDataExif.latitude;
        longitude = json_metadata.geoDataExif.longitude;
      } else if (json_metadata.geoData && json_metadata.geoData.latitude && json_metadata.geoData.longitude) {
        Log.debug('Image position:', json_metadata.geoData.longitude, json_metadata.geoData.latitude);
        latitude = json_metadata.geoData.latitude;
        longitude = json_metadata.geoData.longitude;
      }
      if (json_metadata.url) {
        Log.debug('Image URL:', json_metadata.url);
        metadata.url = json_metadata.url;
      }
      // now let us search the friendly position name
      if (latitude && longitude) {
        const address = this.getAddressFromCoordinates(latitude, longitude);
        if (address) {
          metadata.position = address;
          // clean the first part of address if its a street number (numbers + space, or numbers+comma+space, or numbers + bis,ter + space)
          metadata.position = metadata.position.replace(/^[0-9]+(,[ ]|[ ]|(bis|ter)[ ])+/u, '');
          // clean the first part of address if its a "Plus Code Google" (4 alphanum + space + 3 alphanum + space)
          metadata.position = metadata.position.replace(/^[A-Za-z0-9]{4}[ \+][A-Za-z0-9]+[ ]+/u, '');
        } else {
          metadata.position = `${Math.round(latitude * 100) / 100}, ${Math.round(longitude * 100) / 100}`;
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
        metadata
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
      const cacheData = fs.readFileSync(this.config.addressCacheFile, 'utf8');
      addressCache = JSON.parse(cacheData);
    } catch (error) {
      // File doesn't exist or is invalid, use empty cache
      addressCache = {};
    }
    // Check if the address is already cached
    const cacheKey = `${latitude},${longitude}`;
    if (addressCache[cacheKey]) {
      Log.log('Address found in cache:', addressCache[cacheKey]);
      return addressCache[cacheKey];
    }
    // If not cached, make a request to Google Maps Geocoding API
    const mapsApiKey = this.config.googleMapsApiKey || '';
    if (mapsApiKey === '') {
      Log.log('No Google Maps API key provided.');
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
            Log.log('Resolved address with Google Maps API:', address);
            // Update the address cache and write it back to file
            addressCache[`${latitude},${longitude}`] = address;
            fs.writeFileSync(this.config.addressCacheFile, JSON.stringify(addressCache), 'utf8');

            return address;
          }
          Log.debug('No address found for the given coordinates.');
        } catch (error) {
          Log.error('Error parsing geocode response:', error);
        }
      });
    });
    return null;
  },

  // stop timer if it's running
  stopTimer () {
    if (this.timer) {
      Log.debug('Stopping update timer');
      const it = this.timer;
      this.timer = null;
      clearTimeout(it);
    }
  },
  // resume timer if it's not running; reset if it is
  startOrRestartTimer () {
    this.stopTimer();
    Log.debug('Restarting update timer');
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
    Log.log(`Resizing image to max: ${this.config.maxWidth}x${this.config.maxHeight}`);
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
        Log.log('Resizing done!');
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
      Log.log('ResizeImages: false');
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
    Log.info(`Reading directory "${imagePath}" for images, found ${contents.length} files and directories`);
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

  // Function to signal a photo as not interesting
  signalPhoto (payload) {
    // todo
    // savoir quelle image est affichée actuellement
    // récupérer l'url de l'image courante, et le filename
    Log.log(`Signaling photo: ${payload.path} on URL: ${this.config.photoSignalUrl}`);
    // Log.log(`metadata: ${JSON.stringify(payload.metadata)}`);
    if (!payload.metadata || !payload.metadata.url) {
      Log.error('No photo URL found in metadata, cannot signal photo');
      // FIXME je ne comprends pas pourquoi parfois l'URL n'est pas là
      return;
    }
    const formData = new FormData();
    formData.append('photoUrl', payload.metadata.url || '');
    formData.append('filename', payload.metadata.displayedName || '');
    formData.append('creationTime', payload.metadata.displayedTime || '');
    fetch(this.config.photoSignalUrl, {
      method: 'POST',
      body: formData
    })
      .then((response) => {
        Log.log('Success signaling photo');
      })
      .catch((error) => {
        Log.error('Error signaling photo', error);
      });
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
      Log.info('mw got BACKGROUNDSLIDESHOW_PLAY_VIDEO');
      Log.info(`cmd line: omxplayer --win 0,0,1920,1080 --alpha 180 ${payload[0]}`);
      exec(
        `omxplayer --win 0,0,1920,1080 --alpha 180 ${payload[0]}`,
        () => {
          this.sendSocketNotification('BACKGROUNDSLIDESHOW_PLAY', null);
          Log.info('mw video done');
        }
      );
    } else if (notification === 'BACKGROUNDSLIDESHOW_NEXT_IMAGE') {
      Log.debug('BACKGROUNDSLIDESHOW_NEXT_IMAGE');
      this.getNextImage();
    } else if (notification === 'BACKGROUNDSLIDESHOW_PREV_IMAGE') {
      Log.debug('BACKGROUNDSLIDESHOW_PREV_IMAGE');
      this.getPrevImage();
    } else if (notification === 'BACKGROUNDSLIDESHOW_PAUSE') {
      this.stopTimer();
    } else if (notification === 'BACKGROUNDSLIDESHOW_PLAY') {
      this.startOrRestartTimer();
    } else if (notification === 'BACKGROUNDSLIDESHOW_SIGNAL_PHOTO_HANDLER') {
      this.signalPhoto(payload);
    }
  }
});
