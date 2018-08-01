# Module: Background Slideshow

Show a slideshow of images in the background. Great for a photo frame from instead of a mirror.

The `MMM-BackgroundSlideshow` module is designed to display images fullscreen, one at a time on a fixed interval, from one or many directories. These images can be shown in order or at random, one directory at a time or all at time. The images can transition from one to the other and be shown with no edge (cover) or the enter image(contain).

Based on <a href="MMM-ImageSlideshow">MMM-ImageSlideshow</a>.

<img src="https://github.com/darickc/MMM-BackgroundSlideshow/blob/master/screenshots/landscape.jpg" style="width: 300px;" />
<img src="https://github.com/darickc/MMM-BackgroundSlideshow/blob/master/screenshots/portait.jpg" style="width: 300px;" />

## Dependencies / Requirements

This module requires no special dependencies. The only requirement is that the image directories you path to are fixed paths accessible to the Magic Mirror instance.

## Operation

This module will take in a list of directory paths, one or more, containing image files. The module will display those images in either alphabetical or random order, across either each path one at time or across all the paths at once. Once all the images have been shown, it will loop back and start again.

Extra configurations include setting the amount of time an image is shown for, selecting which file extensions are valid, the transition speed from one image to another, the background sizing, whether or not to animate the transition from one to the other, the gradient used to make the text more readable, and the gradient opacity.

## Using the module

To use this module, add it to the modules array in the `config/config.js` file:

```javascript
modules: [
  {
    module: "MMM-BackgroundSlideshow",
    position: "fullscreen_below",
    config: {
      imagePaths: ["modules/MMM-BackgroundSlideshow/example1"],
      transitionImages: true,
      randomizeImageOrder: true
    }
  }
];
```

I also recommend adding the following to the custom.css to make the text a little brighter:

```
.normal,
.dimmed,
header,
body {
    color: #fff;
}
```

## Configuration options

The following properties can be configured:

<table width="100%">
	<!-- why, markdown... -->
	<thead>
		<tr>
			<th>Option</th>
			<th width="100%">Description</th>
		</tr>
	<thead>
	<tbody>
		<tr>
			<td><code>imagePaths</code></td>
			<td>Array value containing strings. Each string should be a path to a directory where image files can be found.<br>
				<br><b>Example:</b> <code>['modules/MMM-ImageSlideshow/example1']</code>
				<br>This value is <b>REQUIRED</b>
			</td>
		</tr>
		<tr>
			<td><code>slideshowSpeed</code></td>
			<td>Integer value, the length of time to show one image before switching to the next, in milliseconds.<br>
				<br><b>Example:</b> <code>6000</code> for 6 seconds
				<br><b>Default value:</b> <code>10000</code> or 10 seconds
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>randomizeImageOrder</code></td>
			<td>Boolean value, if true will randomize the order of the images, if false will use an alphabetical sorting by filename.<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
        <tr>
			<td><code>treatAllPathsAsOne</code></td>
			<td>Boolean value, if true will treat all the paths specified in <code>imagePaths</code> as one path. Otherwise, if false, images will only be shown from one path at a time in the order of <code>imagePaths</code>, until all the images in that path are exhausted, before continuing to the next path.<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
        <tr>
			<td><code>validImageFileExtensions</code></td>
			<td>String value, a list of image file extensions, seperated by commas, that should be included. Files found without one of the extensions will be ignored.<br>
				<br><b>Example:</b> <code>'png,jpg'</code>
				<br><b>Default value:</b> <code>'bmp,jpg,gif,png'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    <tr>
			<td><code>transitionSpeed</code></td>
			<td>Transition speed from one image to the other, transitionImages must be true. Must be a valid css transition duration.<br>
				<br><b>Example:</b> <code>'2s'</code>
				<br><b>Default value:</b> <code>'1s'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    <tr>
			<td><code>backgroundSize</code></td>
			<td>The sizing of the background image. Values can be:<br>
        cover: Resize the background image to cover the entire container, even if it has to stretch the image or cut a little bit off one of the edges.<br>
        contain: Resize the background image to make sure the image is fully visible<br>
				<br><b>Example:</b> <code>'contain'</code>
				<br><b>Default value:</b> <code>'cover'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    <tr>
			<td><code>transitionImages</code></td>
			<td>Transition from one image to the other (may be a bit choppy on slower devices, or if the images are too big).<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    <tr>
			<td><code>gradient</code></td>
			<td>The gradient to make the text more visible.  Enter gradient stops as an array.<br>
				<br><b>Example:</b> <code>[
      "rgba(0, 0, 0, 0.75) 0%",
      "rgba(0, 0, 0, 0) 40%"
    ]</code>
				<br><b>Default value:</b> <code>[
      "rgba(0, 0, 0, 0.75) 0%",
      "rgba(0, 0, 0, 0) 40%",
      "rgba(0, 0, 0, 0) 80%",
      "rgba(0, 0, 0, 0.75) 100%"
    ]</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    <tr>
			<td><code>gradientOpacity</code></td>
			<td>Overall opacity of the gradient<br>
				<br><b>Example:</b> <code>'.8'</code>
				<br><b>Default value:</b> <code>'0.6'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    </tbody>
</table>
