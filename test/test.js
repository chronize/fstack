var fstack = require('../fstack'),
	async = require('async');

async.series([
	function(next) {
		fstack.ents('.', function(err, ents) {
			console.log('ents: ');
			console.log(ents);
			next();
		});
	},
	function(next) {
		fstack.files('.', function(err, files) {
			console.log('files:');
			console.log(files);
			next();
		});
	},
	function(next) {
		fstack.dirs('.', function(err, dirs) {
			console.log('dirs: ');
			console.log(dirs);
			next();
		});
	},
	function(next) {
		fstack.readStream('fstack.js', function(err, stream) {
			stream.pipe(process.stdout);
			next();
		});
	},
	function(next) {
		fstack.read('fstack.js', function(err, data) {
			console.log(data.toString());
			next();
		});
	},
	function(next) {
		console.log(fstack.tmpdir());
		next();
	},
	function(next) {
		fstack.fst('.', function(err, fso) {
			if (err)
				console.log(err);
			console.log(JSON.stringify(fso, null, 4));
			next();
		});
	},
	function(next) {
		fstack.fst('.', function(err, fso) {
			if (err)
				console.log(err);
			console.log(JSON.stringify(fso, null, 4));
			next();
		}, 1);
	},
	function(next) {
		fstack.mkdirp('b/c/d/e', function(err) {
			
		});
	}
]);



