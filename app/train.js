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

var config = require('../config/config.js');
var fs = require('fs');
var path = require('path');

var markovFiles = [];
var markovBaseFolder = "../markov/";

///////////////////////
// F U N C T I O N S //
///////////////////////
//

// FUNCTION: Read all markov text files
// - RETURNS: BOOL->If the function finished
// - ARGS: folder->the folder it should look into

function addMarkovFiles(folder=markovBaseFolder) {
	if(fs.existsSync(folder)) {
		var dir = fs.readdirSync(folder);
		dir.forEach(file => {
			console.log('checking ' + folder+file);
			var stats = fs.statSync(folder+file);
			
			if(!stats.isDirectory()) {
				var ext = path.extname(folder+file).toLowerCase();
				var noext = path.basename(folder+file).substring(0,file.length-ext.length); // filename, with no extension
				
				// check if file is text, and does not end with -disabled, and has no json with it
				if(ext === '.txt' && !noext.endsWith('-disabled') && !fs.existsSync(folder+noext+".json")) {
					console.log('adding ' + file);
					markovFiles.push(folder.replace(markovBaseFolder, '') + file);
				}
			} else {
				console.log('entering' + file);
				addMarkovFiles(folder+file+'/');
			}
		});
		
		return true;
	} else {
		Error("The Markov training folder doesn't exist: " + folder);
		return false;
	}
}

function train() {
	markovFiles.forEach(function(file) {
		console.log('Learning: ' + file);
		
		var ext = path.extname(file).toLowerCase();
		var fileName = markovBaseFolder+file.substring(0,file.length-ext.length); // filename and relative path, without the extension.
		
		var graph = {};
		var group_size = config.order+1;
		
		// The entire markov learn file, stored in a string
		var txt = fs.readFileSync(markovBaseFolder+file, 'utf-8').replace(/\n|\r/g, ' ');
		
		// strip wiki indexes or whatever
		if(config.wikistrip)
			txt = txt.replace(/\[[0-9]\]|\[[a-zA-Z]\]|\[citation needed\]/g, '');
		
		txt = txt.replace(/\t/g, '');
		
		// Replace 2 or more spaces with 1
		txt = txt.replace(/ {2,}/g, ' ');
		
		// remove last space
		txt = txt.substring(0, txt.length-1);
		
		var text = txt.split(" ");
		
		// Add the beginning of the text to the end, so the
		// bot will never find something it can't continue
		for(var i = 0; i < config.order+1; i++) {
			text.push(text[i]);
		}
		
		for(var i = 0; i < text.length - group_size; i++) {
			var key = "";
			var val = text[i + config.order];
			
			for(var j = i; j < i+config.order;j++) {
				key += text[j];
				if(j < i + config.order - 1)
					key += " ";
			}
			
			if(typeof graph[key] !== 'undefined') {
				graph[key].push(val);
			} else {
				graph[key] = [val];
			}
		}
		
		console.log("Done, writing JSON...");
		var textJSON = JSON.stringify(graph, null, 4);
		
		fs.writeFile(fileName + ".json", textJSON, 'utf8', function (err) {
			if (err) {
				return console.log(err);
			}

			console.log("JSON saved: " + fileName + ".json");
		});
	});
}

// FUNCTION: Prints an error
// - RETURNS: nothing
// - ARGS: err->error message

function Error(err) {
	console.log('An error has occurred: ' + err);
}

/////////////////////////////
// R U N   T R A I N I N G //
/////////////////////////////

addMarkovFiles();
console.log('---- READING COMPLETE, TRAINING ----');
train();