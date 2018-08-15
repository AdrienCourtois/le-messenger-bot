const pool = require('./mysqlpool').getPool()

class Meme {
	constructor(id, url, thumb_url, title, date){
		this.id = id;
		this.url = url;
		this.thumb_url = thumb_url;
		this.title = title;
		this.date = date;
	}

	/**
	 * Deletes the meme from the database.
	 */
	delete(){
		pool.query("DELETE FROM memes WHERE id = ?", [this.id]);
	}

	/**
	 * Modifies the meme.
	 * @param title The title of the meme.
	 */
	edit(title){
		pool.query("UPDATE memes SET title = ? WHERE id = ?", [title, this.id]);
	}

	/**
	 * Returns an object of the Meme class relatively to its data retrieved from the database contained in obj.
	 * @param obj The database object corresponding to the meme.
	 */
	static getMeme(obj){
		return new Meme(obj.id, obj.url, obj.thumb_url, obj.title, obj.date);
	}
	
	/**
	 * Returns the Meme object associated with the given ID.
	 * @param {number} id The ID of the meme.
	 * @param callback The callback function taking the Meme object as argument.
	 */
	static getMemeByID(id, callback){
		pool.query("SELECT * FROM memes WHERE id = ?", [id], function(err, quer){
			if (quer.length == 1)
				callback(Meme.getMeme(quer[0]));
			else
				callback(null);
		});
	}
	
	/**
	 * Returns a randomnly selected meme out of the database.
	 * @param callback The callback function taking the random meme as argument.
	 */
	static getRandomMeme(callback){
		pool.query("SELECT * FROM memes", function(err, quer){
			var nb = Math.floor(Math.random() * Math.floor(quer.length));

			if (quer.length != 0)
				callback(Meme.getMeme(quer[nb]));
			else
				callback(null);
		});
	}

	/**
	 * Adds a meme to the database.
	 * @param {string} url The URL to the meme.
	 * @param {string} thumb_url The URL to the shortened version of the meme.
	 * @param {string} title The title going with the meme.
	 */
	static add(url, thumb_url, title){
		pool.query("INSERT INTO memes (url, thumb_url, title) VALUES (?, ?, ?)", [url, thumb_url, title]);
	}
}

module.exports = Meme;