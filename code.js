const pool = require('./mysqlpool').getPool()

class Code {
	constructor(id, url, keygen, name, points, total_usage, left_usage){
		this.id = id;
		this.url = url;
		this.keygen = keygen;
		this.name = name;
		this.points = points;
		this.total_usage = total_usage;
		this.left_usage = left_usage;
	}

	/**
	 * Deletes the code from the database.
	 */
	delete(){
		pool.query("DELETE FROM codes WHERE id = ?", [this.id]);
	}

	/**
	 * Modifies the code.
	 */
	edit(name, points, total_usage, left_usage) {
		pool.query("UPDATE codes SET name = ?, points = ?, total_usage = ?, left_usage = left_usage+? WHERE id = ?", [name, points, total_usage, left_usage, this.id]);
	}
	
	/**
	 * Marks the code as used. Which means its total of usage left is reduced by one.
	 */
	updateUsage(){
		pool.query("UPDATE codes SET left_usage = left_usage - 1 WHERE id = ?", [this.id]);
	}
	
	/**
	 * Marks this code as used by the given user.
	 * @param {number} fb_id The messenger ID of the user.
	 */
	registerUsage(fb_id){
		pool.query("INSERT INTO code_usage (fb_id, code_id, points) VALUES (?, ?, ?)", [fb_id, this.id, this.points]);
	}
	
	/**
	 * Returns as a boolean if wether or not the user already used this code.
	 * @param {number} fb_id The messenger ID of the user.
	 * @param callback The callback function taking the boolean as argument.
	 */
	userUsage(fb_id, callback){
		pool.query("SELECT COUNT(*) AS nb FROM code_usage WHERE fb_id = ? AND code_id = ?", [fb_id, this.id], function(err, quer){
			if (quer[0].nb > 0)
				callback(true)
			else
				callback(false)
		});
	}

	/**
	 * Returns an object of the Code class relatively to its data retrieved from the database contained in obj.
	 * @param obj The database object corresponding to the quizz.
	 */
	static getCode(obj){
		return new Code(obj.id, obj.url, obj.keygen, obj.name, obj.points, obj.total_usage, obj.left_usage);
	}
	
	/**
	 * Returns the Code object corresponding to the given ID.
	 * @param {number} id The ID of the code.
	 * @param callback The callback function taking the code as argument.
	 */
	static getCodeByID(id, callback){
		pool.query("SELECT * FROM codes WHERE id = ?", [id], function(err, quer){
			if (quer.length == 0)
				callback(null);
			else
				callback(Code.getCode(quer[0]));
		});
	}
	
	/**
	 * Returns the Code object corresponding to the given unique key.
	 * @param {string} key The key corresponding to the code.
	 * @param callback The callback function taking the code as argument.
	 */
	static getCodeByKey(key, callback){
		pool.query("SELECT * FROM codes WHERE keygen = ?", [key], function(err, quer){
			if (quer.length == 0){
				callback(null)
				console.log('Unable to retrieve code keygen='+key)
			} else
				callback(Code.getCode(quer[0]));
		});
	}
	
	/**
	 * Adds a code to the database.
	 * @param {string} url The URL to the image.
	 * @param {string} key The unique key referenced by the code.
	 * @param {string} name The name of the code.
	 * @param {number} points The points recieved by the user when he scans the code.
	 * @param {number} total_usage The total amount of time the code can be used.
	 */
	static add(url, key, name, points, total_usage){
		pool.query("INSERT INTO codes (url, keygen, name, points, account_id, total_usage, left_usage, fete_foraine) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [url, key, name, points, total_usage, total_usage]);
	}
}

module.exports = Code;