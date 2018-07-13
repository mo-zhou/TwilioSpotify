//Play music through Spotify preview by user request
//'Response' is Twilio's Twiml Response, 'res' is HTTP response
//A Twilio number is configureed for the incoming voice webhook

const express = require('express');
const request = require('request');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const session = require('express-session');
const urlencoded = require('body-parser').urlencoded;
const PORT = process.env.PORT || 8000;
const Spotify = require('node-spotify-api');

const clientId = process.env.SPOTIFY_CLIENT; //Register your own app to get a Spotify client ID and secret
const clientSecret = process.env.SPOTIFY_SECRET;

let spotify = new Spotify({
	id: clientId,
	secret: clientSecret
});


const app = express();

// use session middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true
}));

app.use(urlencoded({ extended: false }));

//Voice webhook to collect the song request from caller
app.post('/voice', (req, res) => {
  // Use the Twilio Node.js SDK to build an XML response
  const response = new VoiceResponse();

  // Use the <Gather> verb to collect user input
  const gather =  response.gather({
  	input: 'speech',
  	timeout: 5, //5 seconds of waiting
    action: '/result'
    });

  gather.say({voice: 'woman'}, 'Tell me which song you want to hear.');
  //gather.play('https://www.soundjay.com/button/sounds/beep-01a.mp3'); this beep is really annoying...
  
  // If the user doesn't enter input, loop
  response.redirect('/voice');

  // Render the response as XML in reply to the webhook request
  res.type('text/xml');
  res.send(response.toString());

});

//retrieve the song name from speech recogntion result 
//do some error handling
app.post('/result', (req, res) => {

	const response = new VoiceResponse();

	if (req.body.SpeechResult) {
		var requestedTrack = req.body.SpeechResult.toLowerCase();
		//console.log('confidence score is ' + req.body.Confidence);
		response.say({voice: 'woman'}, `You requested ${requestedTrack}`); //say the requested song name back
		req.session.requestedTrack = requestedTrack; //store the speech result to a session data to refer later
		response.redirect('/play');
	}

	else {
		console.log('You did not request a song')
		response.say({voice: 'woman'}, 'You did not request a song');
		response.redirect('/voice');
	}

	res.type('text/xml');
	res.send(response.toString());
	

});


//playing the requested song
app.post('/play', (req, res) => {
	
	const response = new VoiceResponse();
	let trackName = req.session.requestedTrack; 
	
	getTrack(trackName) 
	.then(song => {
		console.log('the song url is ' + song);
		response.play(song);
		response.pause({
			length: 2
		});
		response.say({voice: 'woman'}, 'Now try another song!');
		response.redirect('/voice'); //redirect to hear another song
		res.type('text/xml');
		res.send(response.toString());	
	})
	.catch(err => {
		response.say(err.message);

		response.redirect('/voice'); //doesn't redirect it seems!
		res.type('text/xml');
		res.send(response.toString());	
	})

});

//utility function to get a Spotify track using the helper function
//use Promise to avoid callback hell
//return the url of the song
function getTrack(track) {
	return new Promise((resolve, reject) => {
		spotify.search({ 
			type: 'track', //asking to search for a track
			query: track,  //track name
			limit: 1, //return only the first matching result
			market: 'US' //available market is the US
		})
		.then(function(body) {
			try {
				console.log('your song name is ' + track);
				let song_url = body.tracks.items[0].preview_url
				if (song_url != null) {
					return resolve(song_url);
				}
				else {
					console.log('Your song request is currently unavailable for preview, listening to My House by Flo Rida instead...');
					return resolve(getTrack('My House')); //known preview url that exists
				}
			}
			catch (e) {
				console.log('Your requested song does not exist, please try another one.');
				return reject(new Error('Your requested song does not exist, please try another one.'))
			}
		})
		.catch(function(err) {
			console.log(err);
			return (err);
		});
	})
}


app.listen(PORT, () => console.log(`listening on port ${ PORT }`));
