// Copyright 2017 Selim Nahimi
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const util = require('util')
var config = require('../config/config.js');
var fs = require('fs');
var path = require('path');
var FB = require('fb');
var dateTime = require('node-datetime');
var request = require('request');
var im = require('imagemagick');

var markovFiles = [];
var markovBaseFolder = "../markov/";

var days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
var isEvent = false;
var graph = {};

var eventpriority = 1;

var nextpost = config.interval;

var accessToken = '';

var TESTING = (process.env.TESTING === '1' ? true : false)

/* 
 * Get all Markov JSON files and add them to a list.
 * Run concatAllJsons() after this.
 *
 * - ARGS -
 *   folder:   A string containing the path of the folder the function should look into
 *   priority: How many times should the found JSONs be added to the list. (higher->more probable)
 *
 * - RETURNS -
 *   True if finished
 *   False if failed
 */
function addMarkovFiles(folder=markovBaseFolder, priority=1) {
	if(fs.existsSync(folder)) {
		var dir = fs.readdirSync(folder);
		var count = 0;
		dir.forEach(file => {
			var stats = fs.statSync(folder+file);
			
			if(!stats.isDirectory()) {
				var ext = path.extname(folder+file).toLowerCase();
				
				// check if file is text, and does not end with -disabled
				if(ext === '.json' && !path.basename(folder+file).substring(0,file.length-ext.length).endsWith('-disabled')) {
					for(var i = 0; i < priority; i++) {
						markovFiles.push(folder.replace(markovBaseFolder, '') + file);
						count++;
					}
				}
			} else {
				if(file != 'special') {
					//Log('entering' + file);
					addMarkovFiles(folder+file+'/', priority);
					
				}
			}
		});
		
		Log("Added " + count + " JSONs from " + folder);
		return true;
	} else {
		Error("Folder doesn't exist: " + folder);
		return false;
	}
}

/* 
 * Concatenate all the JSON files.
 * Must run addMarkovFiles() before this!
 *
 * - ARGS -
 *   nothing
 *
 * - RETURNS -
 *   void
 */
function concatAllJsons() {
	Log('Beginning concat for ' + markovFiles.length + ' JSONs');
	var amount = 0;
	markovFiles.forEach(function(file, index) {
		
		//var obj = {};
		try {
			//obj = JSON.parse(fs.readFileSync('events.json', 'utf8'));
			var cObj = JSON.parse(fs.readFileSync(markovBaseFolder+file, 'utf8'));
			JsonConcat(graph, cObj);
			amount++;
		} catch(err) {
			Log('ERROR READING "' + markovBaseFolder+file + '": ' + err);
		}
	});
	Log('Concat complete');
}

/* 
 * Generates a random text
 *
 * - ARGS -
 *   nothing
 *
 * - RETURNS -
 *   A string containing the generated text
 *   False if failed
 */
function generateText() {
	var len = getRandomInt(2,15);
	Log('Text planned length: ' + len);
	if(TESTING) Log('TEST ENVIRONMENT DETECTED, SKIPPING FB');
	
	var graph_keys = Object.keys(graph);
	var index = getRandomInt(0,graph_keys.length);
	var result = [];
	
	var reverse = false;
	
	// increase/decrease index until it starts with a capital letter
	while(!graph_keys[index][0][0].match(/[A-Z]/g)) {
		if(reverse) {
			if(typeof graph_keys[index-1] !== 'undefined') {
				index--;
			} else {
				PostSystemMessageOnFacebook('An unexpected error has occurred while generating a text.', 'ERROR', 'state: "'+state+'"\nresult: "'+result.join(" ")+'"');
				return false;
			}
		} else if(typeof graph_keys[index+1] !== 'undefined') {
			index++;
		} else {
			index = getRandomInt(0,graph_keys.length);
			Log('New random index: ' + index);
			reverse = true;
		}
	}
	
	var start = graph_keys[index].split(" ");
	
	for(var i = 0; i < start.length; i++) {
		result.push(start[i]);
	}
	
	var c = 0;
	do
	{
		var state = "";
		
		for(var j = result.length - config.order; j < result.length; j++) {
			state += result[j];
			if( j < result.length - 1 )
				state += " ";
		}
		
		var next_word = "";
		
		if(Array.isArray(graph[state])) {
			if(c < len) {
				next_word = graph[state][getRandomInt(0,graph[state].length)];
			} else {
				
				// Word amount is over limit, try to search for word ending in a dot
				var endwords = [];
				graph[state].forEach(item => {
					if(item.endsWith('.') || item.endsWith('!') || item.endsWith('?')) {
						endwords.push(item);
					}
				});
				if(endwords.length > 0) {
					next_word = endwords[getRandomInt(0,endwords.length)];
				} else {
					next_word = graph[state][getRandomInt(0,graph[state].length)];
				}
			}
			result.push(next_word);
		} else {
			next_word = ".";
			PostSystemMessageOnFacebook('An unexpected error has occurred while generating a text.', 'ERROR', 'state: "'+state+'"\nresult: "'+result.join(" ")+'"');
			return false;
		}
		c++;
	// Make sure that the text actually ends with a ., so there are no anticlimatic cuts.
	} while(c < len || (!result[result.length-1].endsWith('.') && !result[result.length-1].endsWith('!') && !result[result.length-1].endsWith('?')) || result[result.length-1].endsWith('Dr.'));
	
	Log('End length: ' + c);
	
	var buffer = "";
	for(var i = 0; i < result.length; i++) {
		buffer += result[i] + " ";
	}
	
	buffer = buffer.substring(0,buffer.length-1);
	
	return buffer;
}

/* 
 * Generates a random integer
 *
 * - ARGS -
 *   min:      A number representing the minimum value
 *   max:      A number representing the maximum
 *
 * - RETURNS -
 *   A random number between min and max
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

/* 
 * Adds caption to an image
 *
 * - ARGS -
 *   text:     A string containing the text
 *   img:      A string containing the path and filename of the image
 *   callback: Function to call after the proccess is finished. format: function(err)
 *
 * - RETURNS -
 *   void
 */
function addCaption(text, img, callback) {
	if(fs.existsSync(img)) {
		try {
			if(!TESTING) {
				im.identify(img, function(err, features){
					if(err) {
						callback(err);
						return;
					}
					//var f = features.split(" ")[2].split("x");
					var width = features.width;
					var height = Math.floor(features.height/4);
					Log('features: ' + features + ', width: ' + width + ', height: ' + height); 
					var args = ['-background', 'none', '-gravity', 'south', '-size', width+'x'+height, '-font', 'DejaVu-Sans', '-strokewidth', '5', '-stroke', 'black', '-fill', 'white', 'caption:'+text, img, '+swap', '-gravity', 'south', '-composite', '-stroke', 'none', 'caption:'+text, '-composite', 'done.jpg'];
					
					im.convert(args, function(err, stdout) {
						if(err) {
							callback(err);
							return;
						}
						
						Log('convert: ' + stdout);
						callback(false);
					});
				});
			} else {
				Log("TESTING MODE, skipping imagemagick");
			}
		} catch (err) {
			callback(err);
		}
	} else {
		err = "The file '" + img + "' doesn't exist";
		callback(err);
	}
	
}

/* 
 * Picks a random image from the picture folder in the config,
 * or the current event's folder
 *
 * - ARGS -
 *   text:     A string containing a text for finding tags
 *
 * - RETURNS -
 *   A string containing the path of the image
 *   False if failed/None found
 */
function randomImg(text) {
	result = text.split(" ");
	var images = {};
	var day = days[ new Date().getDay() ];
	Log('Loading images.json');
	
	var obj = {};
	try {
		obj = JSON.parse(fs.readFileSync('images.json', 'utf8'));
	} catch(err) {
		Log('ERROR while reading used images list: ' + err);
		PostSystemMessageOnFacebook('ERROR while reading used images list', 'ERROR');
		return false;
	}
	
	result.forEach(item => {
		if(fs.existsSync(config.picfolder)) {
			var dir = fs.readdirSync(config.picfolder);
			dir.forEach(file => {
				var fstats = fs.statSync(config.picfolder+file);
				
				if(!fstats.isDirectory()) {
					var ext = path.extname(config.picfolder+file);
					var tags = file.substring(0,file.length-ext.length).toLowerCase().split("_");
					
					// Remove special characters, then separate _ and -
					var items = item.toLowerCase().replace(/\?|\.|!|:|,|;|\(|\)|{|}|\[|\]|<|>|'s?/g, '').replace(/_/g, ' ').split(" ");
					
					// filename has the current word
					items.forEach(item2 => {
						if(!item2.match(/^[0-9]+$/g)) {
							if(tags.includes(item2) || (item2.endsWith('s') && tags.includes(item2.substring(0,item2.length-1)))) {
								if(typeof obj[config.picfolder+file] === 'undefined') {
									Log('added: ' + file + ', because it contains: ' + item2);
									if(typeof images[config.picfolder+file] === 'undefined') {
										images[config.picfolder+file] = [item2];
									} else {
										images[config.picfolder+file].push(item2);
									}
								} else {
									Log(config.picfolder+file + ' was already used, skipping');
								}
							}
						}
					});
				}
			});
		} else Log("pic folder doesn't exist");
		var eventfolder = '../images/events/'+day+'/';
		if(isEvent && fs.existsSync(eventfolder)) {
			var dir = fs.readdirSync(eventfolder);
			dir.forEach(file => {
				var fstats = fs.statSync(eventfolder+file);
				
				if(!fstats.isDirectory()) {
					var ext = path.extname(config.picfolder+file);
					var tags = file.substring(0,file.length-ext.length).toLowerCase().split("_");
					
					// Remove special characters, then separate _ and -
					var items = item.toLowerCase().replace(/\?|\.|!|:|,|;|\(|\)|{|}|\[|\]|<|>|'s?/g, '').replace(/_/g, ' ').split(" ");
					
					// filename has the current word
					items.forEach(item2 => {
						if(!item2.match(/^[0-9]+$/g)) {
							if(tags.includes(item2) || (item2.endsWith('s') && tags.includes(item2.substring(0,item2.length-1)))) {
								if(typeof obj[eventfolder+file] === 'undefined') {
									Log('added (event): ' + file + ', because it contains: ' + item2);
									if(typeof images[eventfolder+file] === 'undefined') {
										images[eventfolder+file] = [item2];
									} else {
										images[eventfolder+file].push(item2);
									}
								} else {
									Log(config.picfolder+file + ' was already used, skipping');
								}
							}
						}
					});
				}
			});
		}
	});
	
	var keys = Object.keys(images);
	Log('Object keys length: ' + keys.length);
	if(keys.length > 0) {
		var randomimg = keys[Math.floor(Math.random() * keys.length)];
		Log('Chosen: ' + randomimg);
		obj[randomimg] = 1;
		
		fs.writeFile("images.json", JSON.stringify(obj, null, 4), 'utf8', function (err) {
			if (err) {
				return Log('Error writing into images.json: ' + err);
			}

			Log("JSON saved: images.json");
		});
		
		var chosen = images[randomimg];
		chosen.unshift(randomimg);
		
		return chosen;
	} else {
		return false;
	}
}

/* 
 * Concatenate 2 objects/JSONs
 *
 * - ARGS -
 *   o1:     Object to concatenate to
 *   o2:     Object to concatenate with
 *
 * - RETURNS -
 *   The concatenated object
 */
function JsonConcat(o1, o2) {
	for (var key in o2) {
		if(typeof o1[key] === 'undefined') {
			o1[key] = o2[key];
		} else {
			for(var key2 in o2[key])
				o1[key].push(o2[key][key2]);
		}
	}
}

/* 
 * Post on Facebook using the Facebook API
 *
 * - ARGS -
 *   text:     A string containing the text to post
 *   img:      A string representing the path of the image to upload (empty for no image)
 *
 * - RETURNS -
 *   post ID as a string, false if failed
 */
function PostOnFacebook(text, img=false, comment=false, commentimg=false) {
	// CHECK IF TESTING ENVIRONMENT
	var body = text;
	if(!img) {
		Log('FB: "' + body + '"');
		if(!TESTING) {
			FB.api('me/feed', 'post', { message: body }, function (res) {
				if(!res || res.error) {
					Log(!res ? 'fb error occurred' : 'fb error: ' + res.error);
					return false;
				}
				
				Log('Post Id: ' + res.id);
				//if(comment) {
					//CommentOnFacebook(res.id, comment, false, "Original image", commentimg);
				//}
				return res.id;
			});
		} else return false;
	} else {
		var ext = path.extname(img).toLowerCase();
		var photoBuffer = fs.createReadStream(img);
		
		// Image is gif, upload to fileserver
		if(ext == ".gif") {
			
			var obj = {};
			try {
				obj = JSON.parse(fs.readFileSync('uploads.json', 'utf8'));
			} catch(err) {
				Log('ERROR while reading GIF upload links: ' + err);
				PostSystemMessageOnFacebook('ERROR while reading GIF upload links', 'ERROR');
				return false;
			}
			var url = false;
			
			for (file in obj) {
				if(file === img) {
					Log('Found saved link for ' + img);
					url = obj[file];
				}
			}
			
			// No URL was saved in uploads.json
			if(!url) {
				Log('No link present for ' + img);
				var options = {
					url: config.uploadurl,
					headers: {
						'api': config.uploadapi
					}
				}
				
				var req = request.post(options, function (err, resp, link) {
					if(resp.statusCode != 200) {
						Log('GIF upload error: ' + resp.statusCode + ': ' + link + ', posting text only...');
						return PostOnFacebook(body);
					}
					if (err) {
						// In case GIF upload fails, post text only
						Log('GIF upload error: ' + err + ', posting text only...');
						return PostOnFacebook(body);
					} else {
						Log('URL: ' + link);
						url = link;
						
						
						Log('FB: "' + body + '", link: "' + url + '"');
						if(!TESTING) {
							FB.api('me/feed/', 'post', {message: body,link: url},function(res) {
								if(!res || res.error) {
									Log(!res ? 'fb error occurred' : 'fb error: ' + res.error);
									return false;
								}
								
								Log('Post Id: ' + res.id);
								if(comment) {
									CommentOnFacebook(res.id, comment);
								}
								return res.id;
							});
						} else return false;
						
						obj[img] = link;
						fs.writeFile("uploads.json", JSON.stringify(obj, null, 4), 'utf8', function (err) {
							if (err) {
								Log('Error writing into uploads.json: ' + err);
								return false;
							}

							Log("JSON saved: uploads.json");
						});
					}
				});
				var form = req.form();
				form.append('files[]', photoBuffer);
			} else {
				Log('FB: "' + body + '", link: "' + url + '"');
				if(!TESTING) {
					FB.api('me/feed/', 'post', {message: body,link: url},function(res) {
						if(!res || res.error) {
							Log(!res ? 'fb error occurred' : 'fb error: ' + res.error);
							return false;
						}
						
						Log('Post Id: ' + res.id);
						if(comment) {
							CommentOnFacebook(res.id, comment);
						}
						return res.id;
					});
				} else return false;
			}
			
		// Image is JPG or PNG, upload directly to facebook
		} else if(ext == ".jpg" || ext == ".jpeg" || ext == ".png") {
			Log('FB: "' + body + '", img: "' + img + '"');
			if(!TESTING) {
				FB.api('me/photos', 'post', { source: photoBuffer, caption: body }, function (res) {
					if(!res || res.error) {
						Log(!res ? 'JPG/PNG upload unexpected error' : 'fb error ' + res.error);
						return false;
					}
					
					Log('Post Id: ' + res.post_id);
					if(comment) {
						CommentOnFacebook(res.post_id, comment, false, "Original image", commentimg);
					}
					return res.post_id;
				});
			} else return false;
		} else {
			// Image is invalid, posting only text
			Log("WARNING image invalid: " + img + ", skipping...");
			return PostOnFacebook(body, false);
		}
		
		
	}
}

/* 
 * Comment on a Facebook post using the Facebook API
 *
 * - ARGS -
 *   postid:   A string representing the post's/comment's ID to comment on
 *   text:     A string containing the text to post
 *   img:      A string representing the path of the image to upload (empty for no image)
 *
 * - RETURNS -
 *   comment ID as a string, false if failed
 */
function CommentOnFacebook(postid, text, img=false, text2=false, img2=false) {
	var body = text;
	if(img) Log('Image commenting is not yet done. Commenting text only');
	
	Log('FB COMMENT: "' + body + '"');
	if(!TESTING) {
		if(img) {
			if(fs.existsSync(img)) {
				var photoBuffer = fs.createReadStream(img);
				FB.api('/'+postid+'/comments', 'post', { source: photoBuffer, message: body }, function (res) {
					if(!res || res.error) {
						Log(!res ? 'fb unknown error occurred' : 'fb error: ' + res.error);
						return false;
					}
					
					Log('Comment Id: ' + res.id);
					
					if(text2 && img2) {
						CommentOnFacebook(res.id, text2, img2);
					}
					return res.id;
				});
			} else {
				Log("FB comment warning: '" + img + "' doesn't exist. Skipping image...");
				CommentOnFacebook(postid, text);
			}
		} else {
			FB.api('/'+postid+'/comments', 'post', { message: body }, function (res) {
				if(!res || res.error) {
					Log(!res ? 'fb unknown error occurred' : 'fb error: ' + res.error);
					return false;
				}
				
				Log('Comment Id: ' + res.id);
				
				if(text2 && img2) {
					CommentOnFacebook(res.id, text2, img2);
				}
				return res.id;
			});
		}
	} else return false;
}


/* 
 * Check Facebook token, check day, generate text, pick random image
 * and post it on Facebook
 *
 * - ARGS -
 *   nothing
 *
 * - RETURNS -
 *   void
 */
function generateAndPost() {
	if(!TESTING) {
		if(fs.existsSync('token.json')) {
			
			var obj = {};
			try {
				obj = JSON.parse(fs.readFileSync('token.json', 'utf8'));
			} catch(err) {
				Log('ERROR while reading token: ' + err);
				PostSystemMessageOnFacebook('ERROR while reading token', 'ERROR');
				return false;
			}
			
			var currtime = Math.floor(Date.now() / 1000);
			Log('Current time: ' + currtime);
			
			if(obj.token === '') {
				Log('ERROR: Please put your token into token.json!');
				return;
			} else if(!obj.token.match(/[0-9a-zA-Z]/g)) {
				Log('ERROR: Your token is invalid');
				return;
			} else if(typeof obj.created === 'undefined' || typeof obj.expire === 'undefined') {
				Log('ERROR: creation and expiration time not found! Please re-download this json for the correct format.');
				return;
			} else if(obj.created+obj.expire-432000 < currtime) { // 5 days prior to expiration
				refreshToken(obj.token);
			} else {
				accessToken = obj.token;
				FB.setAccessToken(accessToken);
			}
			
			
		} else {
			Log('ERROR: token.json not found!!!');
			return;
		}

	} else {
		Log("TESTING MODE, skipping token");
	}
	
	var obj = {};
	try {
		obj = JSON.parse(fs.readFileSync('events.json', 'utf8'));
	} catch(err) {
		Log('ERROR while reading events: ' + err);
		return PostSystemMessageOnFacebook('ERROR while reading events', 'ERROR');
	}
	
	var day = days[ new Date().getDay() ];
	
	checkDay();
	
	markovFiles = [];
	graph = {};
	addMarkovFiles();
	if(obj.events[day].name != "" && fs.existsSync('../markov/special/events/'+day+'/'))
		Log("EVENT PRIORITY: " + eventpriority);
		addMarkovFiles('../markov/special/events/'+day+'/', eventpriority);
	concatAllJsons();
	
	var postText = generateText();
	
	if(postText) {
		
		//var needimage = Math.round(Math.random());
		
		// needimage randomization currently
		// disabled as it's better to have images.
		var needimage = 1;
		var img = false;
		//Log('needimage: ' + needimage);
		if(needimage == 1) {
			var randomimg = randomImg(postText);
			if(typeof randomimg !== 'undefined') {
				if(randomimg) img = randomimg[0];
				else Log('ERROR: randomimg is NOT an array! Skipping');
			} else Log('No image found, skipping...');
		}
		
		Log('Generated: "' + postText + '"');
		Log('img is: ' + img);
		
		var tags = false;
		if(img) {
			tags = "'";
			// Remove first element, because it's the image's path
			randomimg.shift();
			tags += randomimg.join("', '");
			tags += "'";
			
			if(!img.endsWith('.gif') && postText.split(" ").length < 30) {
				addCaption(postText, img, function(err) {
					if(err) {
						Log('error while converting: ' + err + ', posting unchanged image instead');
						PostOnFacebook(postText, img, 'The image was chosen because the following tag(s) were found: ' + tags);
					} else PostOnFacebook("", './done.jpg', 'Text: ' + postText + '\nThe image was chosen because the following tag(s) were found: ' + tags, img);
				});
			} else {
				PostOnFacebook(postText, img, 'The image was chosen because the following tag(s) were found: ' + tags);
			}
		} else {
			PostOnFacebook(postText);
		}
	}
}

// FUNCTION: Get extended token from Facebook API (usually lasts for 60 days)
// - RETURNS: extended token
// - ARGS: token->current active token
/* 
 * Get extended token from Facebook API (usually lasts for 60 days)
 *
 * - ARGS -
 *   token:    A string representing the token that has to be converted to an extended one
 *
 * - RETURNS -
 *   void
 */
function refreshToken(token=accessToken) {
	FB.api('oauth/access_token', {
		client_id: config.appid,
		client_secret: config.appsecret,
		grant_type: 'fb_exchange_token',
		fb_exchange_token: token
	}, function (res) {
		if(!res || res.error) {
			Log(!res ? 'error occurred' : res.error);
			return;
		}
		
		accessToken = res.access_token;
		FB.setAccessToken(accessToken);
		Log('new token acquired: ' + accessToken);
		expires_in = res.expires_in ? res.expires_in : 0;
		var currtime = Math.floor(Date.now() / 1000);
		
		var json = {};
		
		json.token = accessToken;
		json.created = currtime;
		json.expire = expires_in;
		
		fs.writeFile("token.json", JSON.stringify(json, null, 4), 'utf8', function (err) {
			if (err) {
				return Log('Error writing into token.json: ' + err);
			}

			Log("JSON saved: token.json");
		});
	});
}

// FUNCTION: Check the current day, and do special actions for it (eg. events)
// - RETURNS: nothing
// - ARGS: nothing
function checkDay() {
	var obj = {};
	try {
		obj = JSON.parse(fs.readFileSync('events.json', 'utf8'));
	} catch(err) {
		Log('ERROR while reading events: ' + err);
		PostSystemMessageOnFacebook('ERROR while reading events', 'ERROR');
		return false;
	}
	
	var day = days[ new Date().getDay() ];
	Log('current day: ' + day);
	eventpriority = obj.events[day].priority;
	
	if(obj.events[day].name != "" && fs.existsSync('../markov/special/events/'+day+'/'))
		isEvent = true;
	else
		isEvent = false;
	
	if(obj.currentday != day) {
		if(day == config.clearday) {
			var imgs = {};
			
			// Using synchronous writefile because otherwise it overlaps in a
			// different function, making the file be read while it's being written.
			// Seems to be a special case.
			try {
				fs.writeFileSync("images.json", JSON.stringify(imgs, null, 4), 'utf8');
			} catch(err) {
				Log('ERROR while saving used images list: ' + err);
				PostSystemMessageOnFacebook('ERROR while saving used images list', 'ERROR');
				return false;
			}
		}
		if(obj.events[day].name != "" && fs.existsSync('../markov/special/events/'+day+'/')) {
			var img = false;
			if(obj.events[day].img != "") {
				if(fs.existsSync(obj.events[day].img)) {
					img = obj.events[day].img;
				} else {
					Log('WARNING event image not valid, skipping...');
				}
			}
			
			var desc = obj.events[day].desc;
			
			//isEvent = true;
			
			PostSystemMessageOnFacebook(obj.events[day].name + ' is now live!', 'EVENT', desc, img);
		} else if(obj.events[obj.currentday].name != "" && fs.existsSync('../markov/special/events/'+obj.currentday+'/')) {
			
			PostSystemMessageOnFacebook(obj.events[obj.currentday].name + ' has ended. Rolling back to normal posting.', 'EVENT');
			//isEvent = false;
		}
		
		obj.currentday = day;
		
		Log("writing JSON for events...");
		var textJSON = JSON.stringify(obj, null, 4);
		
		fs.writeFile("events.json", textJSON, 'utf8', function (err) {
			if (err) {
				return Log('Error writing into events.json: ' + err);
			}

			Log("JSON saved: events.json");
		});
	}
}

function Log(text) {
	var dt = dateTime.create();
	var time = dt.format('Y-m-d H:M:S');
	var date = dt.format('Y-m-d');
	text = '['+time+'] ' + text;
	
	console.log(text);
	
	if(config.logtofile) {
		var file = '../logs/'+date+'.txt';
		if(!fs.existsSync(file)) {
			fs.closeSync(fs.openSync(file, 'w'));
		}
		fs.appendFile(file, text+'\r\n', function(err) {
			if(err) {
				console.log('['+time+'] ERROR SAVING INTO LOG FILE: ' + err);
			}
		});
	}
}

function PostSystemMessageOnFacebook(text, type=false, info=false, img=false) {
	var dt = dateTime.create();
	var time = dt.format('Y-m-d H:M:S');
	text = "[SYSTEM MESSAGE]"+(type ? "["+type+"]" : "")+"\n["+time+"]\n\n"+text+(info ? "\n\n[Information]\n"+info : "");
	PostOnFacebook(text, img);
}

///////////////
// M A G I C //
///////////////

generateAndPost();