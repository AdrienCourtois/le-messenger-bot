const mysql = require('mysql')

var pool;

module.exports = {
    getPool: function () {
      if (pool)
        return pool;

      pool = mysql.createPool({
      	connectionLimit : 4,
      	host: 'localhost',
      	user: 'root',
      	password: 'your_password',
      	database: 'your_db'
      });
      
      return pool;
    }
};
