// Config for the bot

var config = {};

// ORDER
// How many words are remembered as a phrase
// Default: 2
config.order = 2;

// WIKIPEDIA STRIP
// If true, the bot will strip Wikipedia indexes (eg. [1], [a], [23], [citation needed], etc)
// Default: true
config.wikistrip = true;

// FACEBOOK APP ID
// Your facebook App's ID
// Default: ''
config.appid = '';

// FACEBOOK APP SECRET
// Your Facebook App's SECRET
// Default: ''
config.appsecret = '';

// PICTURE FOLDER
// The folder where all the HL-related pictures are stored.
// Default: '../images/hl2/'
config.picfolder = '../images/hl2/';

// CLEAR DAY
// On what day should the bot clear the used images list? (images.json)
// Default: 'sunday'
config.clearday = 'sunday';

// EVENT MARKOV PRIORITY
// How many times should the event text be added
// Default: 8
config.eventpriority = 8;

// GIF UPLOAD URL
// Currently only works with sharez.me, so don't change.
// Default: 'https://sharez.me/upload'
config.uploadurl = 'https://sharez.me/upload';

// SHAREZ API KEY
// Sharez API key
// Default: ''
config.uploadapi = '';

/*
 * - LOG TO FILE -
 * If true, the bot will save logs into /logs/<date>.txt
 * Default: true
 */
config.logtofile = true;

module.exports = config;