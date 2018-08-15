'use strict';
const request = require('request')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const session = require('express-session')

const User = require('./user')
const Code = require('./code')
const Quizz = require('./quizz')

app.use(express.static('public'))
app.use(bodyParser.json()) // creates express http server, allows input encoded in json
app.set('view engine', 'ejs')
app.set('trust proxy', 1)

app.use(session({
  secret: 'banana',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));



// ROUTING
var admin_routes = require('./routes/admin');

app.use('/admin', admin_routes)



// MESSENGER BOT

var messageHandler = require('./handleMessage')
messageHandler = new messageHandler()

// Creates the endpoint for our webhook
app.post('/webhook', (req, res) => {
	
	console.log(req.headers['x-forwarded-for']);

  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

  	  // Get the sender PSID
  	  let sender_psid = webhook_event.sender.id;
  	  console.log('Sender PSID: ' + sender_psid);

  	  // Check if the event is a message or postback and
  	  // pass the event to the appropriate handler function
      if (webhook_event.referral)
  			handleReferral(sender_psid, webhook_event.referral);
			
			else if (webhook_event.message.quick_reply)
				handlePostback(sender_psid, webhook_event.message.quick_reply);
				
  	  else if (webhook_event.message)
				handleMessage(sender_psid, webhook_event.message);
				
  	  else if (webhook_event.postback) {
        if (webhook_event.postback.referral)
					handleReferral(sender_psid, webhook_event.postback.referral);
					
        else
          handlePostback(sender_psid, webhook_event.postback);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = "";

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {

    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Handles referral events
// Handles the scan of codes
function handleReferral(sender_psid, received_message) {
  request({
    "uri": "https://graph.facebook.com/v2.6/" + sender_psid,
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "GET"
  }, (err, res, body) => {
    if(err){
      console.error(err);
      return;
    }

    var args = received_message.ref.split(":")

	Code.getCodeByKey(args[0], function(code){
		if (code == null){
			let response = { "text": "The code doesn't exist." };
			callSendAPI(sender_psid, response);

			return;
		}

		if (code.left_usage == 0){
			let response = { "text": "The code you scanned has been used too much time and can't be scanned anymore." };
			callSendAPI(sender_psid, response);

			return;
		}

		code.userUsage(sender_psid, function(used){
			if (used){
				let response = { "text": "You already scanned this code!" };
				callSendAPI(sender_psid, response);

				return;
			}

			User.getUserByPSID(sender_psid, function(user){
				user.addXP(parseInt(code.points))
			});

			code.updateUsage();
			code.registerUsage(sender_psid);

			let response = {
			  "text": "Well done, you scanned the code named "+code.name+" ! You earned " + code.points + " points."
			};

			// Sends the response message
			callSendAPI(sender_psid, response);
		});
	});
  });
}

// Handles message events
function handleMessage(sender_psid, received_message) {
	request({
		"uri": "https://graph.facebook.com/v2.6/" + sender_psid,
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "GET"
	}, (err, res, body) => {
		if(err){
			console.error(err);
			return;
		}

		messageHandler.handleMessage(sender_psid, received_message.text, body);
  });
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
	let payload = received_postback.payload;

	if (payload === 'score')
		messageHandler.getUserScore(sender_psid, null);

	else if (payload === "meme")
		messageHandler.showMeme(sender_psid, null);

	else if (payload === "quizz")
		messageHandler.getQuizz(sender_psid, null);

	else if (payload.substr(0, 5) == "quizz"){
		var quizz_id = parseInt(payload.split('quizz')[1].split('_')[0]);
		var answer_id = parseInt(payload.split('_')[1]);

		Quizz.processAnswer(sender_psid, quizz_id, answer_id, function(answer){
			callSendAPI(sender_psid, { "text": answer.message });

			setTimeout(function(){ messageHandler.getQuizz(sender_psid, null) }, 300);
		});
	}
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
	// Construct the message body
	let request_body = {
		"recipient": {
			"id": sender_psid
		},
		"message": response
	}

	// Send the HTTP request to the Messenger Platform
	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
	}, (err, res, body) => {
		if (!err) {
			console.log('message sent!')
		} else {
			console.error("Unable to send message:" + err);
		}
	});
}
