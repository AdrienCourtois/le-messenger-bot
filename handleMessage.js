const User = require('./user')
const Meme = require('./meme')
const Quizz = require('./quizz')
const request = require('request')
const pool = require('./mysqlpool').getPool()
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

class HandleMessage {
	constructor() {
		this.messages = { 
			'___': null, 'shut up': null, // if the user doesn't want any answer, just refer the keyword to null.
			
			'random_img': { type: 'random_img', val: ['random_img1.jpg', 'random_img2.jpg'] },
			'img': { type: 'img', val: 'img.png' },
			'anotherimg': { type: 'img', val: 'img2.png' },
			
			'msg': { type: 'msg', val: 'Your msg here.' }, 
			'msg2': { type: 'msg', val: 'As much msg as you want!' },

			'score': { type: 'func', val: this.getUserScore },
			'meme': { type: 'func', val: this.showMeme },
			'blague': { type: 'func', val: this.getJoke },
			'quizz': { type: 'func', val: this.getQuizz },
			
			'IGNORECASE': { type: 'msg', val: 'msg', spec: 'ignoreCase' }, // The user's message must contain the word "IGNORECASE" (with this particular case) for this to be triggered.
			'exactexample': { type: 'img', val: 'exactExample.jpg', spec: 'exact' } // The user's message must be exactly "exactexample" for this to be triggered.
		};

		// hidden keywords
		this.keywords = ["your keywords here"];

		for (var i = 0 ; i < keywords.length ; i++)
			this.messages[keywords[i]] = { type: 'func_spec', num: i, val: this.wordSurprise, spec: 'ignoreCase' };
	}
	
	/**
	 * Analyzes the message sent by the user and process it according to the informations in this.messages.
	 * @param {number} sender_psid The messenger ID of the user.
	 * @param {string} msg The content of the message sent by the user.
	 * @param body Informations about the user.
	 */
	handleMessage(sender_psid, msg, body){
		let found = false;
		
		for (var key in this.messages){
			if (key in this.messages){
				if (msg != null && msg.toLowerCase().indexOf(key.toLowerCase()) != -1){
					if (this.messages[key] != null && this.messages[key].hasOwnProperty('spec') && this.messages[key].spec == 'exact' && msg.toLowerCase() != key) continue;
					if (this.messages[key] != null && this.messages[key].hasOwnProperty('spec') && this.messages[key].spec == 'ignoreCase' && msg.indexOf(key) == -1) continue;
					
					if (this.messages[key] != null){
						switch (this.messages[key].type){
							case 'msg':
								HandleMessage.callSendAPI(sender_psid, { "text": this.messages[key].val });
								break;
							case 'img':
								HandleMessage.callSendAPI(sender_psid, { "attachment": { "type":"image", "payload": { "url":'https://messenger-webhook-bde.herokuapp.com/img/'+this.messages[key].val, "is_reusable":true } } });
								break;
							case 'random_img':
								HandleMessage.callSendAPI(sender_psid, { "attachment": { "type":"image", "payload": { "url":'https://messenger-webhook-bde.herokuapp.com/img/'+this.messages[key].val[Math.floor(Math.random() * Math.floor(this.messages[key].val.length))], "is_reusable":true } } });
								break;
							case 'func':
								this.messages[key].val(sender_psid, body);
								break;
							case 'func_spec':
								this.messages[key].val(sender_psid, this.messages[key].num);
								break;
						}
					}
					
					found = true;
					break;
				}
			}
		}
		
		if (!found)
			this.handleDefault(sender_psid, body);
	}
	
	/**
	 * Sends the default message to the user. 
	 * @param {number} sender_psid The messenger ID of the user.
	 * @param body Not used in this function.
	 */
	handleDefault(sender_psid, body){
		User.getUserByPSID(sender_psid, function(user){
			var reponses_possibles = [
				"Hi "+user.first_name+"! How can I help you?", 
				"What would you like to do?", 
				"السلام عليكم", 
				"你好"
			];
			var response_hidden = "Your own easter egg here.";

			let text_response = ""

			if (Math.random() <= 0.01)
				text_response = response_hidden;
			else 
				text_response = reponses_possibles[Math.floor(Math.random() * Math.floor(reponses_possibles.length))];

			let response = {
			  "text": text_response,
			  "quick_replies":[
				{
				  "content_type":"text",
				  "title":"My score",
				  "payload":"score"
				},
				{
					"content_type": "text",
					"title": "Meme",
					"payload": "meme"
				},
				{
					"content_type": "text",
					"title": "Quizz",
					"payload": "quizz"
				}
			  ]
			}
			
			HandleMessage.callSendAPI(sender_psid, response);
		});
	}
	
	/**
	 * Gives the user some points if they found a hidden keyword. 
	 * Note that the keyword must be added in the constructor.
	 * @param {number} sender_psid The messenger ID of the user.
	 * @param {number} num The index of the hidden keyword.
	 */
	wordSurprise(sender_psid, num){
		User.getUserByPSID(sender_psid, function(user){
			// check usage
			pool.query("SELECT COUNT(*) AS nb FROM chat_usage WHERE fb_id = ? AND num = ?", [sender_psid, num], function(err, quer){
				if (quer[0].nb == 0){
					pool.query("INSERT INTO chat_usage (fb_id, num) VALUES (?, ?)", [sender_psid, num], function(err,quer){
						user.addXP(100);
						HandleMessage.callSendAPI(sender_psid, { "text": "Well done, the keyword \"" + this.keywords[num] + "\" made you earn 100 points! :)" });
					});
				} else 
					HandleMessage.callSendAPI(sender_psid, { "text": "Sorry you already used this keyword :/" });
			});
		});
	}
	
	/**
	 * Sends a random joke to the user.
	 * @param {number} sender_psid The messenger ID of the user.
	 * @param body The user informations. Here we use the profile pic URL.
	 */
	getJoke(sender_psid, body){
		var jokes = [
			"pdp",
			"Your own jokes here"
		];

		var id = Math.floor(Math.random() * Math.floor(jokes.length));

		// Returns the profile pic of the user.
		if (jokes[id] == 'pdp'){
			HandleMessage.callSendAPI(sender_psid, {
				"attachment": {
					"type":"image",
					"payload": {
						"url":JSON.parse(body).profile_pic,
						"is_reusable":true
					}
				}
			});
		} else 
			HandleMessage.callSendAPI(sender_psid, { "text": jokes[id] });
	}
	
	/**
	 * Sends a quizz to the user or an apology message when there's no more.
	 * @param {number} sender_psid The messenger ID of the user.
	 * @param body Not used in this function.
	 */
	getQuizz(sender_psid, body){
		Quizz.getRandomQuizz(sender_psid, function(quizz){
			if (quizz == null)
				HandleMessage.callSendAPI(sender_psid, { "text": "We don't have any questions left for you. :/" });
			else {
				let link = (quizz.photo != null) ? quizz.photo : '';
				
				HandleMessage.callSendAPI(
					sender_psid, 
					{ 
						"text": quizz.question+link+"\n\nA. "+quizz.rep[0]+"\nB. "+quizz.rep[1]+"\nC. "+quizz.rep[2], 
						"quick_replies": [
							{ "content_type": "text", "title": "A", "payload": "quizz"+quizz.id+"_1" },
							{ "content_type": "text", "title": "B", "payload": "quizz"+quizz.id+"_2" },
							{ "content_type": "text", "title": "C", "payload": "quizz"+quizz.id+"_3" }
						] 
					}
				);
			}
		});
	}
	
	/**
	 * Sends a Meme to the user.
	 * @param {number} sender_psid The messenger ID of the user.
	 * @param body Not used in this function.
	 */
	showMeme(sender_psid, body){ 
		Meme.getRandomMeme(function(meme){
			if (meme == null)
				HandleMessage.callSendAPI(sender_psid, { "text": "There's no meme for now." });
			else {
				HandleMessage.callSendAPI(sender_psid, { "text": meme.title });
				HandleMessage.callSendAPI(sender_psid, {
					"attachment": {
						"type":"image",
						"payload": {
							"url": meme.url,
							"is_reusable": true
						}
					}
				});
			}
		});
	}
	
	/**
	 * Sends the user its XP.
	 * @param {number} sender_psid The messenger ID of the user.
	 * @param body Not used in this function.
	 */
	getUserScore(sender_psid, body){
		User.getUserByPSID(sender_psid, function(user){
			  user.computeRank(function(rank) {
				var s = (user.xp > 1) ? 's' : '';

				HandleMessage.callSendAPI(sender_psid, { "text": "Congrats! You have " + user.xp +" point"+s+" (level " + user.computeLvl() + "), your rank is " + rank });
			});
		});
	}
	
	/**
	 * Actually sends the message to the Messenger API. 
	 * Wraps the given message with the ID of the user and process to the query..
	 * @param {number} sender_psid The messenger ID of the user.
	 * @param response The message to be sent to the user.
	 */
	static callSendAPI(sender_psid, response) {
		let request_body = {
			"recipient": {
				"id": sender_psid
			},
			"message": response
		};

		request({
			"uri": "https://graph.facebook.com/v2.6/me/messages",
			"qs": { "access_token": PAGE_ACCESS_TOKEN },
			"method": "POST",
			"json": request_body
		}, (err, res, body) => {
			if (err)
				console.error("Unable to send message:" + err);
		});
	}
}

module.exports = HandleMessage;