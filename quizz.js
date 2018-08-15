const pool = require('./mysqlpool').getPool()
const User = require('./user')

class Quizz{
	constructor(id, question, rep, correct_answer, photo, points){
		this.id = id;
		this.question = question;
		this.rep = rep.split('{')[1].split('}')[0].split(';');
		this.correct_answer = parseInt(correct_answer);
		this.photo = photo;
		this.points = points;
	}

	/**
	 * Deletes the given quizz.
	 */
	delete(){
		pool.query("DELETE FROM quizz WHERE id = ?", [this.id]);
	}

	/**
	 * Modifies the given quizz.
	 * @arg {string} question The question.
	 * @arg {string} answer The answers in the format {string;string;string}
	 * @arg {number} correct_answer The index of the correct answer (0, 1 or 2)
	 */
	edit(question, answer, correct_answer, points){
		pool.query("UPDATE quizz SET question = ?, rep = ?, correct_answer = ?, points = ? WHERE id = ?", [question, answer, correct_answer, points, this.id]);
	}

	/**
	 * Returns an object of the Quizz class relatively to its data retrieved from the database contained in obj.
	 * @param obj The database object corresponding to the quizz.
	 */
	static getQuizz(obj) {
		return new Quizz(obj.id, obj.question, obj.rep, obj.correct_answer, obj.photo, obj.points);
	}
	
	/**
	 * Returns a random question out of the database that the user never answered.
	 * @param {number} fb_id The messenger ID of the user.
	 * @param callback The callback function taking the Quizz object as argument.
	 */
	static getRandomQuizz(fb_id, callback){
		pool.query("SELECT id FROM quizz WHERE id NOT IN (SELECT quizz_id FROM quizz_usage WHERE fb_id = ? AND answer_correct = 1)", [fb_id], function(err, quer){
			if (err === null || quer.length == 0)
				callback(null);
			else {
				var random_id = Math.floor(Math.random() * Math.floor(quer.length));
				Quizz.getQuizzByID(random_id, callback);
			}
		});
	}
	
	/**
	 * Returns the Quizz object corresponding to the given ID.
	 * @param {number} quizz_id The ID of the quizz.
	 * @param callback The callback function taking the quizz as argument. If it is null, the ID doesn't correspond to any known quizz.
	 */
	static getQuizzByID(quizz_id, callback){
		pool.query("SELECT * FROM quizz WHERE id = ?", [quizz_id], function(err, quer){
			if (err === null || quer.length == 0)
				callback(null);
			else
				callback(Quizz.getQuizz(quer[0]));
		});
	}
	
	/**
	 * Checks if an answer given by a user is correct.
	 * The response is a dictionnary with param success and error. 
	 * In case of error, success is false, and check the throws informations.
	 * In case of success, error is 0 the number of won points is given.
	 * 
	 * Note: The points earned decrease with the increase of wrong answer given.
	 * @param {number} fb_id The messenger ID of the user.
	 * @param {number} quizz_id The quizz ID the user answered.
	 * @param {number} answer The answser's ID the user chose.
	 * @param callback The callback function taking the response as argument.
	 * @throws 1: The quizz doesn't exist
	 * @throws 2: The quizz has already been answered by user.
	 * @throws 3: The answer is wrong
	 */
	static processAnswer(fb_id, quizz_id, answer, callback){
		Quizz.getQuizzByID(quizz_id, function(quizz){
			if (quizz == null) {
				callback({ success: false, error: 1, message: 'This quizz doesn\'t exist.' });
				return;
			}
				
			pool.query("SELECT COUNT(*) AS nb FROM quizz_usage WHERE quizz_id = ? AND fb_id = ? AND answer_correct = 1", [quizz_id, fb_id], function(err, quer){
				if (quer[0].nb == 1){
					callback({ success: false, error: 2, message: 'You already answered this quizz.' });
					return; 
				}
				
				pool.query("SELECT COUNT(*) AS nb FROM quizz_usage WHERE quizz_id = ? AND fb_id = ?", [quizz_id, fb_id], function(err, quer){
					(function(){
						var nb = quer[0].nb;
						
						pool.query("INSERT INTO quizz_usage (fb_id, quizz_id, answer, answer_correct) VALUES (?,?,?,?)", [fb_id, quizz_id, answer,(answer == quizz.correct_answer)?1:0], function(err, quer){
							if (answer == quizz.correct_answer){
								User.getUserByPSID(fb_id, function(user){
									var given_xp = Math.floor(quizz.points/(nb+1));

									user.addXP(given_xp);
									callback({ success: true, given_xp: given_xp, message: 'Well done! You just earned ' + given_xp + ' points!' });
								});
							} else {
								callback({ success: false, error: 3, message: 'Sorry, wrong answer!' });
							}
						});
					})();
				});
			});
		});
	}
	
	/**
	 * Adds a quizz question into the database.
	 * @param {string} question The question.
	 * @param {string} answers The answers in the format {string;string;string}
	 * @param {number} correct_answer The index of the correct answer (0, 1 or 2)
	 * @param {string} url The URL to the photo associated with the question if there is one.
	 * @param {number} points The number of points given to the user if he answers the question correctly.
	 */
	static add(question, answers, correct_answer, url, points){
		pool.query("INSERT INTO quizz (question, rep, correct_answer, photo, points) VALUES (?,?,?,?,?)", [question, answers, correct_answer, url, points]);
	}
}

module.exports = Quizz;