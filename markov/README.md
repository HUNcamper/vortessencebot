Put your text files here which are ready to be learnt by the bot.

The bot will automatically strip Wikipedia indexes (eg. [1], [a], [23], [citation needed], etc), this can be disabled in config.js

The bot will automatically generate a JSON file from the text.
To temporarily disable a JSON from including in the bot, add -disabled to the filename (eg. base-disabled.json)
Same with text files, in case you don't want them being generated upon launch.

To re-generate the JSONs, just run train.js again.

the special folder, as it says, is special.
It contains "events" for each day or the weekend. You can put event-only text there, and those will be included on the corresponding day only. If there is text in the folder of a specific day, the bot will automatically announce the event when generating for the first time.
