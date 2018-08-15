const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN
const request = require('request')
const pool = require('./mysqlpool').getPool()

class User {
	constructor(psid, first_name, last_name, xp){
		this.psid = psid;
		this.first_name = first_name;
		this.last_name = last_name;
		this.xp = xp;
	}

	/**
	 * Returns the rank of the current user.
	 * @param callback The callback function taking the rank as argument. The rank is null when an error occured.
	 */
	computeRank(callback){
		pool.query("SELECT FIND_IN_SET( xp, (\
								SELECT GROUP_CONCAT( xp ORDER BY xp DESC ) FROM accounts ))\
								AS rank FROM accounts WHERE fb_id = ?;", [this.psid], function(err, res){
			if (err !== null)
				callback(null);
			else
				callback(res[0].rank);
		});
	}

	/**
	 * Returns the level of the user considering its XP.
	 */
	computeLvl(){
		if(this.xp <= 0)
			return 1;
		
		return Math.ceil(0.10118857348*Math.pow(Math.log(this.xp), 1.5))+1;
	}
	
	/**
	 * Adds addedXP XP points to the user.
	 * @param {number} addedXP The amount of XP to be given to the user.
	 */
	addXP(addedXP){
		this.setXP(this.xp + addedXP);
	}

	/**
	 * Sets the XP of the user to be newXP.
	 * @param {number} newXP The XP to be set to the user.
	 */
	setXP(newXP){
		var self = this;
		this.xp = newXP;

		if(newXP < 0)
			return;

		pool.query("UPDATE accounts SET xp = ? WHERE fb_id = ?", [this.xp, this.psid]);
	}

	/**
	 * Returns an object of the User class relatively to its data retrieved from the database contained in obj.
	 * @param obj The database object corresponding to the user.
	 */
	static getUser(obj) {
		return new User(obj.fb_id, obj.first_name, obj.last_name, obj.xp);
	}

	/**
	 * Returns a User object relatively to the given messenger ID. 
	 * Creates a new user in the database if the user has never used this tool before.
	 * @param {number} psid The messenger ID of the user.
	 * @param callback The callback function taking the User object as argument.
	 */
	static getUserByPSID(psid, callback){
		pool.query("SELECT * FROM accounts WHERE fb_id = ?", [psid], function(err, res){
			if(err){
				console.error(err);
				return;
			}

			// If the user has no account
			if (res.length == 0){
				request({
					"uri": "https://graph.facebook.com/v2.6/" + psid,
					"qs": { "access_token": PAGE_ACCESS_TOKEN },
					"method": "GET"
				}, (err, res, body) => {
					if (err) {
						console.error(err);
						return;
					}

					var jsonResponse = JSON.parse(body);
					var first_name = jsonResponse.first_name;
					var last_name = jsonResponse.last_name;

					pool.query("INSERT INTO accounts (fb_id,first_name,last_name, xp) VALUES(?,?,?,0)", [psid, first_name, last_name], function(err,res){
						if (err){
							console.error(err);
							return;
						}

						callback(new User(psid, first_name, last_name, 0));
					});
				});
			} else {
				callback(User.getUser(res[0]));
			}
		});
	}
	
	/**
	 * Returns all the users in the database as an array.
	 * @param callback The callback function taking the list of User objects as argument.
	 */
	static getAllUsers(callback){
		pool.query("SELECT * FROM accounts", function(err, quer){
			var t = [];

			for (var i = 0 ; i < quer.length ; i++)
				t.push(User.getUser(quer[i]));
			
			callback(t);
		});
	}
}

module.exports = User;
