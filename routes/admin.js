const express = require('express')
const router = express.Router()
const urlencodedParser = require('body-parser').urlencoded({ extended: false })
const Cookies = require('cookies')
const pool = require('../mysqlpool').getPool();
const fileUpload = require('express-fileupload')
const path = require('path')
const thumb = require('node-thumbnail').thumb
const https = require('https')
const cloudinary = require('cloudinary')
const mkdirp = require('mkdirp')

cloudinary.config({ 
	cloud_name: 'your_cloud_name', 
	api_key: 'your_api_key', 
	api_secret: 'your_api_secret' 
});

const Meme = require('../meme')
const striptags = require('striptags')
const Code = require('../code')
const Quizz = require('../quizz')


// We get a conn and immediatly release it, just to check if the startup is alright
pool.getConnection(function(err, connection) {
    if (err) {
		console.log('fail to connect to MySQL Database');
		console.log(err);
	}else{
		console.log('connected to MySQL Database');
	}

});

function makeid() {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < 10; i++)
		text += possible.charAt(Math.floor(Math.random() * possible.length));

	return text;
}

router.use(fileUpload())

/**
 * Login System
 */
router.use(function(req, res, next){
	var cookies = new Cookies(req, res);

	if (cookies.get("username") && cookies.get("password")){

		/**
		 * You must change the code below
		 */

		LoginService.login(cookies.get("username"), cookies.get("password"), function(adminUserAccount){
			res.locals.adminUser = adminUserAccount;
			next();
		})
	} else {
		res.locals.adminUser = null;
		next();
	}
});

/**
 * [POST] Page called when a user tries to connect to the admin panel.
 */

router.post('/login', urlencodedParser, function(req, res){
	/**
	 * You must change the code below
	 */
	
	LoginService.login(req.body.username, req.body.password, function(acc){
		if (acc == null)
			res.render('admin/login', { logged: false, username: req.body.username, error: "Le nom de compte ou le mot de passe entré est incorrect." });
		else {
			var cookies = new Cookies(req, res);

			cookies.set("username", req.body.username);
			cookies.set("password", req.body.password);

			res.redirect('/admin');
		}
	});
});

/**
 * [GET] Page called when a user tries to access the admin panel without being connected.
 */
router.get('/login', function(req, res){
	if (res.locals.adminUser == null)
		res.render('admin/login')
	else
		res.redirect('/')
});

/**
 * Redirection if the user isn't logged in.
 */
router.use(function(req, res, next){
	if (res.locals.adminUser == null)
		res.redirect('/admin/login');
	else
		next();
});

router.get('/', function(req, res){
	res.redirect('/admin/1')
});

/**
 * [POST] Page called when the admin wants to delete a quizz question, after the confirmation request.
 */
router.post('/quizz/supprimer/:id', function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/quizz')
		return
	}
	
	Quizz.getQuizzByID(req.params.id, function(quizz){
		if (quizz == null){
			res.redirect('/quizz')
			return
		}
		
		quizz.delete();
		res.render('admin/quizz_del', { adminUser: res.locals.adminUser, success: true });
	});
});

/**
 * [GET] Page called when the admin tries to delete a quizz question, it shows a confirmation request.
 */
router.get('/quizz/supprimer/:id', function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/quizz');
		return;
	}
	
	Quizz.getQuizzByID(req.params.id, function(quizz){
		if (quizz == null){
			res.redirect('/quizz');
			return;
		}
		
		res.render('admin/quizz_del', { adminUser: res.locals.adminUser });
	});
});

/**
 * [POST] Page called when the admin modifies a quizz question.
 */
router.post('/quizz/editer/:id', function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/quizz');
		return;
	}
	
	Quizz.getQuizzByID(req.params.id, function(quizz){
		if (quizz == null){
			res.redirect('/quizz');
			return;
		}
		
		let question = striptags(req.body.question);
		let rep1 = striptags(req.body.rep1).replace(/;/g, '');
		let rep2 = striptags(req.body.rep2).replace(/;/g, '');
		let rep3 = striptags(req.body.rep3).replace(/;/g, '');
		let correct_answer = req.body.correct_answer;
		let points = req.body.points;
		
		var error = {};
		
		if (isNaN(correct_answer) || parseInt(correct_answer) > 3 || parseInt(correct_answer) < 1) error['correct_answer'] = 'The correct answer entered is incorrect.';
		if (points.length == 0 || isNaN(points) || parseInt(points) < 0) error['points'] = 'The amount of points entered is incorrect.';
		if (question.length == 0) error['question'] = 'The question is too short.';
		if (rep1.length == 0) error['rep1'] = 'The answer 1 is too short.';
		if (rep2.length == 0) error['rep2'] = 'The answer 2 is too short.';
		if (rep3.length == 0) error['rep3'] = 'The answer 3 is too short.';

		if (Object.keys(error).length == 0){
			quizz.edit(question, '{'+rep1+';'+rep2+';'+rep3+'}', correct_answer, points);
			res.render('admin/quizz_add', { adminUser: res.locals.adminUser, success: true, edit: true });
		} else {
			res.render('admin/quizz_add', { adminUser: res.locals.adminUser, edit: true, error: error, question: question, rep1: rep1, rep2: rep2, rep3: rep3, correct_answer: correct_answer, points: points })
		}
	});
});

/**
 * [GET] Page called when the user tries to modify a quizz question.
 */
router.get('/quizz/editer/:id', function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/quizz');
		return;
	}
	
	Quizz.getQuizzByID(req.params.id, function(quizz){
		if (quizz == null){
			res.redirect('/quizz');
			return;
		}
		
		res.render('admin/quizz_add', { adminUser: res.locals.adminUser, edit: true, question: quizz.question, rep1: quizz.rep[0], rep2: quizz.rep[1], rep3: quizz.rep[2], correct_answer: quizz.correct_answer, points: (quizz.points == 0) ? "0" : quizz.points });
	});
});

/**
 * [POST] Page called when the user adds a quizz question.
 */
router.post('/quizz/ajouter', function(req, res){
	let question = striptags(req.body.question);
	let rep1 = striptags(req.body.rep1).replace(/;/g, '');
	let rep2 = striptags(req.body.rep2).replace(/;/g, '');
	let rep3 = striptags(req.body.rep3).replace(/;/g, '');
	let correct_answer = req.body.correct_answer;
	let file = req.files.file;
	let points = req.body.points;
	let new_name = makeid();
	
	var error = {};
	var extensions = ['jpg', 'png', 'jpeg'];
	
	if (isNaN(correct_answer) || parseInt(correct_answer) > 3 || parseInt(correct_answer) < 1) error['correct_answer'] = 'The correct answer entered is incorrect.';
	if (points.length == 0 || isNaN(points) || parseInt(points) < 0) error['points'] = 'The amount of points entered is incorrect';
	if (question.length == 0) error['question'] = 'The question is too short.';
	if (rep1.length == 0) error['rep1'] = 'The answer 1 entered is too short.';
	if (rep2.length == 0) error['rep2'] = 'The answer 2 entered is too short.';
	if (rep3.length == 0) error['rep3'] = 'The answer 3 entered is too short.';
	if (file && extensions.indexOf(path.extname(file.name)) == -1) error['file'] = 'The type of the file uploaded is incorrect.';

	if (Object.keys(error).length == 0){
		if (file){
			mkdirp(__dirname+'/../public/uploads/quizz/', function(err) { 
				file.mv(__dirname+'/../public/uploads/quizz/'+new_name+path.extname(file.name), function(err){
					cloudinary.uploader.upload(__dirname+'/../public/uploads/quizz/'+new_name+path.extname(file.name), function(result) {
						var url = result.url
						
						Quizz.add(question, '{'+rep1+';'+rep2+';'+rep3+'}', correct_answer, url, points);
						res.render('admin/quizz_add', { adminUser: res.locals.adminUser, success: true });
					});
				});
			});
		} else {
			Quizz.add(question, '{'+rep1+';'+rep2+';'+rep3+'}', correct_answer, '', points);
			res.render('admin/quizz_add', { adminUser: res.locals.adminUser, success: true })
		}
	} else {
		res.render('admin/quizz_add', { adminUser: res.locals.adminUser, error: error, question: question, rep1: rep1, rep2: rep2, rep3: rep3, correct_answer: correct_answer, points: points })
	}
});

/**
 * [GET] Page called when a user wants to add a quizz.
 */
router.get('/quizz/ajouter', function(req, res){
	res.render('admin/quizz_add', { adminUser: res.locals.adminUser })
});

/**
 * [GET] Page showing all the quizzes matching the query after a research.
 */
router.post('/quizz/:page', urlencodedParser, function(req, res){
	if (isNaN(req.params.page) || parseInt(req.params.page) == 0){
		res.redirect('/admin/quizz')
		return;
	}

	var quer = "1=0"
	var parser = req.body.query.split(' ');

	for (var i = 0 ; i < parser.length ; i++)
		quer += " OR question LIKE "+pool.escape('%'+parser[i]+'%')

	pool.query("SELECT * FROM quizz WHERE "+quer+" ORDER BY id DESC LIMIT 20 OFFSET "+(20*(parseInt(req.params.page)-1)), function(err, quer){
		var t = []

		for (var i = 0 ; i < quer.length ; i++)
			t.push(Quizz.getQuizz(quer[i]));

		pool.query("SELECT COUNT(*) AS nb FROM quizz WHERE "+quer, function(err, quer){
			res.render('admin/quizz', { quizz: t, adminUser: res.locals.adminUser, page: req.params.page, pageTotal: Math.ceil(quer[0].nb/20) })
		});
	});
});

/**
 * [GET] Page showing all the quizzes.
 */
router.get('/quizz/:page', function(req, res){
	if (isNaN(req.params.page) || parseInt(req.params.page) == 0){
		res.redirect('/admin/quizz/1')
		return
	}

	pool.query("SELECT * FROM quizz ORDER BY id DESC LIMIT 20 OFFSET "+(20*(parseInt(req.params.page)-1)), function(err, quer){
		var t = []

		for (var i = 0 ; i < quer.length ; i++)
			t.push(Quizz.getQuizz(quer[i]));

		pool.query("SELECT COUNT(*) AS nb FROM quizz", function(err, quer){
			res.render('admin/quizz', { adminUser: res.locals.adminUser, quizz: t, page: req.params.page, pageTotal: (Math.ceil(quer[0].nb/20)) })
		});
	});
});

router.get('/quizz', function(req, res){
	res.redirect('/admin/quizz/1');
});


/**
 * [POST] Page called when the admin user wants to delete a code.
 */
router.post('/codes/supprimer/:id', urlencodedParser, function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/admin/codes');
		return;
	}

	Code.getCodeByID(req.params.id, function(code){
		if (code == null){
			res.redirect('/admin/codes');
			return;
		}

		code.delete();
		res.render('admin/code_del', { adminUser: res.locals.adminUser, success: true });
	});
});

/**
 * [GET] Page called when the admin user tries to delete a code.
 */
router.get('/codes/supprimer/:id', function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/codes')
		return
	}

	Code.getCodeByID(req.params.id, function(code){
		if (code == null){
			res.redirect('/codes');
			return;
		}

		res.render('admin/code_del', { adminUser: res.locals.adminUser });
	});
});

/**
 * [POST] Page called when the admin wants to edit a code.
 */
router.post('/codes/editer/:id', urlencodedParser, function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/codes');
		return;
	}

	Code.getCodeByID(req.params.id, function(code){
		if (code == null){
			res.redirect('/codes');
			return;
		}

		let name = striptags(req.body.name);
		let nb = req.body.nb;
		let points = req.body.points;

		var error = {}

		if (isNaN(nb) || (parseInt(nb) != -1 && parseInt(nb) <= 0)) error['nb'] = 'The number of usage is incorrect.';
		if (isNaN(points) || parseInt(points) <= 0) error['nb'] = 'The number of points entered is incorrect.';
		if (name.length == 0) error['name'] = 'The name entered is incorrect.';

		if (Object.keys(error).length == 0){
			var left_usage = (nb < 0) ? -1-(code.total_usage-code.left_usage) : nb - (code.total_usage-code.left_usage);

			code.edit(name, points, nb, left_usage);
			res.render('admin/code_add', { adminUser: res.locals.adminUser, edit: true, success: true });
		} else
			res.render('admin/code_add', { adminUser: res.locals.adminUser, name: code.name, error: error, points: code.points, nb: code.total_usage, edit: true })
	});
});

/**
 * [GET] Page called when the admin tries to edit a code.
 */
router.get('/codes/editer/:id', function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/codes');
		return;
	}

	Code.getCodeByID(req.params.id, function(code){
		if (code == null){
			res.redirect('/codes');
			return;
		}

		res.render('admin/code_add', { adminUser: res.locals.adminUser, name: code.name, points: code.points, nb: code.total_usage, edit: true })
	});
});

/**
 * [POST] Page called when the admin adds a code.
 */
router.post('/codes/ajouter', urlencodedParser, function(req, res){
	let name = striptags(req.body.name);
	let nb = req.body.nb;
	let points = (req.body.points) ? req.body.points : "0";

	var error = {}

	if (isNaN(nb) || (parseInt(nb) != -1 && parseInt(nb) <= 0)) error['nb'] = 'The number of usage is incorrect.';
	if (isNaN(points) || (parseInt(points) <= 0)) error['nb'] = 'The number of points is incorrect.';
	if (name.length == 0) error['name'] = 'The name entered is too short.';

	if (Object.keys(error).length == 0){
		let keygen = makeid();

		// SERVER USED TO GENERATE THE CODES
		https.get('https://codegen-bde.herokuapp.com/'+keygen+'/'+points, function(resp){
			let data = '';

			resp.on('data', function(chunk){
				data += chunk;
			});

			resp.on('end', function(){
				Code.add(data, keygen, name, points,  parseInt(nb));
				res.render('admin/code_add', { adminUser: res.locals.adminUser, success: true });
			});
		});
	} else
		res.render('admin/code_add', { adminUser: res.locals.adminUser, error: error, name: name, nb: nb })
});

/**
 * [GET] The page called when the admin wants to add a code.
 */
router.get('/codes/ajouter', function(req, res){
	res.render('admin/code_add', { adminUser: res.locals.adminUser })
});

router.get('/codes', function(req, res){
	res.redirect('/admin/codes/1')
});

/**
 * [GET] Page showing all the available codes.
 */
router.get('/codes/:page', function(req, res){
	if (isNaN(req.params.page) || parseInt(req.params.page) == 0){
		res.redirect('/admin/codes/1');
		return;
	}

	pool.query("SELECT * FROM codes WHERE left_usage != 0 ORDER BY id DESC LIMIT 20 OFFSET "+(20*(parseInt(req.params.page)-1)), function(err, quer){
		var t = []

		for (var i = 0 ; i < quer.length ; i++)
			t.push(Code.getCode(quer[i]));

		pool.query("SELECT COUNT(*) AS nb FROM codes WHERE left_usage != 0", function(err, quer){
			res.render('admin/codes', { adminUser: res.locals.adminUser, codes: t, page: req.params.page, pageTotal: (Math.ceil(quer[0].nb/20)) })
		});
	});
});


/**
 * [POST] Page called when the admin deletes a meme.
 */
router.post('/memes/supprimer/:id', function(req, res){
	if (isNaN(req.params.id) || parseInt(req.params.id) == 0){
		res.redirect('/admin/memes');
		return;
	}

	Meme.getMemeByID(req.params.id, function(meme){
		if (meme == null){
			res.redirect('/admin/memes');
			return;
		}

		meme.delete();
		res.render('admin/meme_del', { adminUser: res.locals.adminUser, success: true });
	});
});

/**
 * [GET] Page called when the admin tries to delete a meme. Shows confirmation request.
 */
router.get('/memes/supprimer/:id', function(req, res){
	if (isNaN(req.params.id) || req.params.id == 0){
		res.redirect('/admin/memes');
		return;
	}

	Meme.getMemeByID(req.params.id, function(meme){
		if (meme == null){
			res.redirect('/admin/memes');
			return;
		}

		res.render('admin/meme_del', { adminUser: res.locals.adminUser });
	});
});

/**
 * [POST] Page called when the admin modifies a meme.
 */
router.post('/memes/editer/:id', urlencodedParser, function(req, res){
	if (isNaN(req.params.id) || req.params.id == 0){
		res.redirect('/admin/memes');
		return;
	}

	Meme.getMemeByID(req.params.id, function(meme){
		if (meme == null){
			res.redirect('/admin/memes')
			return;
		}

		let error = {};

		let title = striptags(req.body.title, ['a', 'strong', 'em', 'b', 'i']);
		if (title.length < 3) error['title'] = 'The title entered is too short.';

		if (Object.keys(error).length == 0){
			meme.edit(title);
			res.render('admin/meme_add', {adminUser: res.locals.adminUser, edit: true, success: true })
		} else
			res.render('admin/meme_add', { adminUser: res.locals.adminUser, title: title, edit: true, error: error });
	});
});

/**
 * [GET] Page called when the user wants to edit a meme.
 */
router.get('/memes/editer/:id', function(req, res){
	if (isNaN(req.params.id) || req.params.id == 0){
		res.redirect('/admin/memes');
		return;
	}

	Meme.getMemeByID(req.params.id, function(meme){
		if (meme == null){
			res.redirect('/admin/memes');
			return;
		}

		res.render('admin/meme_add', { adminUser: res.locals.adminUser, title: meme.title, edit: true })
	});
});

/**
 * [POST] Page called when the admin wants to add a meme.
 */
router.post('/memes/ajouter', function(req, res){
	var error = {};
	var extensions = ['.jpg', '.jpeg', '.png'];

	if (!req.files || !req.files.file) error['file'] = 'No file has been chosen.';

	let file = req.files.file;
	let title = striptags(req.body.title, ['a', 'strong', 'em', 'b', 'i']);
	let new_name = makeid();

	if (file && extensions.indexOf(path.extname(file.name)) == -1) error['file'] = 'The type of the file is incorrect.';
	if (title.length < 3) error['title'] = 'The title entered is too short.';

	if (Object.keys(error).length == 0){
		mkdirp(__dirname+'/../public/uploads/memes/', function(err) { 
			file.mv(__dirname+'/../public/uploads/memes/'+new_name+path.extname(file.name), function(err){
				cloudinary.uploader.upload(__dirname+'/../public/uploads/memes/'+new_name+path.extname(file.name), function(result) {
					var url = result.url
					
					thumb({
						source: __dirname+'/../public/uploads/memes/'+new_name+path.extname(file.name),
						destination: __dirname+'/../public/uploads/memes/',
						concurrency: 4,
						width: 450
					}, function(files, err, stdout, stderr) {
						cloudinary.uploader.upload(__dirname+'/../public/uploads/memes/'+new_name+"_thumb"+path.extname(file.name), function(result) { 
							var thumb_url = result.url;
							
							Meme.add(url, thumb_url, title);
							res.render('admin/meme_add', { adminUser: res.locals.adminUser, success: true });
						});
					});
				});
			});
		});
	} else
		res.render('admin/meme_add', { adminUser: res.locals.adminUser, error: error, title: title })
});

/**
 * [GET] Page called by the admin when wanting to add a meme.
 */
router.get('/memes/ajouter', function(req, res){
	res.render('admin/meme_add', { adminUser: res.locals.adminUser });
});

/**
 * [POST] Page showing all the meme after a research.
 */
router.post('/memes/:page', urlencodedParser, function(req, res){
	if (isNaN(req.params.page) || parseInt(req.params.page) == 0){
		res.redirect('/admin/memes');
		return;
	}

	var quer = "1=0"
	var parser = req.body.query.split(' ');

	for (var i = 0 ; i < parser.length ; i++)
		quer += " OR title LIKE "+pool.escape('%'+parser[i]+'%')

	pool.query("SELECT * FROM memes WHERE "+quer+" ORDER BY id DESC LIMIT 20 OFFSET "+(20*(parseInt(req.params.page)-1)), function(err, quer){
		var t = []

		for (var i = 0 ; i < quer.length ; i++)
			t.push(Meme.getMeme(quer[i]));

		pool.query("SELECT COUNT(*) AS nb FROM memes WHERE "+quer, function(err, quer){
			res.render('admin/meme', { memes: t, adminUser: res.locals.adminUser, page: req.params.page, pageTotal: Math.ceil(quer[0].nb/20) })
		});
	});
});

/**
 * [GET] Page showing all the memes.
 */
router.get('/memes/:page', function(req, res){
	if (isNaN(req.params.page) || parseInt(req.params.page) == 0) {
		res.redirect('/admin/memes/1')
		return;
	}

	pool.query("SELECT * FROM memes ORDER BY id DESC LIMIT 20 OFFSET "+(20*(parseInt(req.params.page)-1)), function(err, quer){
		var t = [];

		for (var i = 0 ; i < quer.length ; i++)
			t.push(Meme.getMeme(quer[i]));

		pool.query("SELECT COUNT(*) AS nb FROM memes", function(err, quer){
			res.render('admin/meme', { memes: t, adminUser: res.locals.adminUser, page: req.params.page, pageTotal: Math.ceil(quer[0].nb/20) })
		});
	});
});

router.get('/memes', function(req, res){
	res.redirect('/admin/memes/1')
});

module.exports = router;
