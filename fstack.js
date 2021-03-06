(function(fstack) {

	var fs = require('fs'),
		_path = require('path'),
		os = require('os'),
		constants = require('constants'),
		async = require('async'),
		statMode = function(mode) {
			switch (mode) {
				case constants.S_IFREG:
					return 'file';
				case constants.S_IFDIR:
					return 'directory';
				case constants.S_IFBLK:
					return 'block-device';
				case constants.S_IFCHR:
					return 'char-device';
				case constants.S_IFLNK:
					return 'link';
				case constants.S_IFIFO:
					return 'fifo';
				case constants.S_IFSOCK:
					return 'socket';
				default:
					return 'unknown';
			}
		},
		objectTypes = {
			'boolean': false,
			'function': true,
			'object': true,
			'number': false,
			'string': false,
			'undefined': false
		},
		objectProto = Object.prototype,
		toString = objectProto.toString,
		identity = function(value) {
			return value;
		},
		support = {
			funcNames: typeof Function.name == 'string'
		},
		reNative = new RegExp('^' +
			String(toString)
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			.replace(/toString| for [^\]]+/g, '.*?') + '$'
		),
		isObject = function(value) {
			return !!(value && objectTypes[typeof value]);
		},
		isNative = function(value) {
			return typeof value === 'function' && reNative.test(value);
		},
		nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
		shimKeys = function(object) {
			var index, iterable = object, result = [];
			if (!iterable) {
				return result;
			}
			if (!(objectTypes[typeof object])){
				return result;
			}
			for (index in iterable) {
				if (hasOwnProperty.call(iterable, index)) {
					result.push(index);
				}
			}
			return result;
		},
		keys = !nativeKeys ? shimKeys : function(object) {
			if (!isObject(object)) {
				return [];
			}
			return nativeKeys(object);
		},
		baseCreateCallback = function baseCreateCallback(func, thisArg, argCount) {
			if (typeof func !== 'function') {
				return identity;
			}
			if (typeof thisArg === 'undefined' || !('prototype' in func)) {
				return func;
			}
			var bindData = func.__bindData__;
			if (typeof bindData === 'undefined') {
				if (support.funcNames) {
					bindData = !func.name;
				}
				bindData = bindData || !support.funcDecomp;
				if (!bindData) {
					var source = fnToString.call(func);
					if (!support.funcNames) {
					bindData = !reFuncName.test(source);
					}
					if (!bindData) {
						bindData = reThis.test(source);
						setBindData(func, bindData);
					}
				}
			}
			if (bindData === false || (bindData !== true && bindData[1] & 1)) {
				return func;
			}
			switch (argCount) {
				case 1: return function(value) {
					return func.call(thisArg, value);
				};
				case 2: return function(a, b) {
					return func.call(thisArg, a, b);
				};
				case 3: return function(value, index, collection) {
					return func.call(thisArg, value, index, collection);
				};
				case 4: return function(accumulator, value, index, collection) {
					return func.call(thisArg, accumulator, value, index, collection);
				};
			}
			return bind(func, thisArg);
		};

	(function(object, source, guard) {
		var index, iterable = object, result = iterable;
		if (!iterable) {
			return result;
		}
		var args = arguments,
		argsIndex = 0,
		callback,
		argsLength = typeof guard === 'number' ? 2 : args.length;
		if (argsLength > 3 && typeof args[argsLength - 2] === 'function') {
			callback = baseCreateCallback(args[--argsLength - 1], args[argsLength--], 2);
		}
		else if (argsLength > 2 && typeof args[argsLength - 1] === 'function') {
			callback = args[--argsLength];
		}
		while (++argsIndex < argsLength) {
			iterable = args[argsIndex];
			if (iterable && objectTypes[typeof iterable]) {
				var ownIndex = -1,
				ownProps = objectTypes[typeof iterable] && keys(iterable),
				length = ownProps ? ownProps.length : 0;
				while (++ownIndex < length) {
					index = ownProps[ownIndex];
					result[index] = callback ? callback(result[index], iterable[index]) : iterable[index];
				}
			}
		}
		return result;
	})(fstack, {
		checkFile: function(path, callback) {
			fs.stat(path, function(err, stat) {
				if (stat && !stat.isDirectory()) {
					callback(err, stat);
				}
				else if (stat) {
					return callback(new Error('EISDIR'));
				}
				else {
					return callback(err);
				}
			});
		},
		checkDir: function(path, callback) {
			fs.stat(path, function(err, stat) {
				if (stat && stat.isDirectory()) {
					callback(err, stat);
				}
				else if (stat) {
					return callback(new Error('ENOTDIR'));
				}
				else {
					return callback(err);
				}
			});
		},
		ents: function(path, callback, stat) {
			fstack.checkDir(path, function(err) {
				if (err) {
					return callback(err);
				}
				fs.readdir(path, function(err, ents) {
					if (err) {
						return callback(err);
					}
					if (stat) {
						async.map(ents, function(ent, cb) {
							fs.stat(fstack.join(path, ent), cb);
						}, function(err, stats) {
							callback(err, ents, stats);
						});
					}
					else {
						callback(err, ents);
					}
				});
			});
		},
		dirs: function(path, callback) {
			fstack.ents(path, function(err, ents) {
				if (err) {
					return callback(err);
				}
				async.filter(ents, function(ent, next) {
					fs.stat(fstack.join(path, ent), function(err, stat) {
						next(stat.isDirectory());
					});
				}, function(dirs) {
					callback(err, dirs);
				});
			}, false);
		},
		files: function(path, callback) {
			fstack.ents(path, function(err, ents) {
				if (err) {
					return callback(err);
				}
				async.filter(ents, function(ent, next) {
					fs.stat(fstack.join(path, ent), function(err, stat) {
						next(!stat.isDirectory());
					});
				}, function(files) {
					callback(err, files);
				});
			}, false);
		},
		fst: function(path, callback, depth) {
			fstack.checkDir(path, function(err) {
				if (err) {
					return callback(err);
				}
				fstack._fst(path, function(err, o) {
					callback(err, o);
				}, depth);
			});
		},
		fso: fstack.fst,
		_fst: function(path, callback, depth) {
			var o = {};
			if (depth !== 0) {
				if (depth) {
					depth--;
				}
				async.parallel([
					function(next) {
						fstack.dirs(path, function(err, dirs) {
							async.each(dirs, function(dir, cb) {
								fstack._fst(fstack.join(path, dir), function(err, d) {
									o[dir] = d ;
									cb(err);
								}, depth);
							}, next);
						});
					},
					function(next) {
						fstack.files(path, function(err, files) {
							async.each(files, function(file, cb) {
								fstack.device(fstack.join(path, file), function(err, statmode) {
									o[file] = statmode;
									cb(err);
								});
							}, next);
						});
					}
				], function(err) {
					callback(err, o);
				});
			}
			else {
				callback(null, o);
			}
		},
		device: function(path, callback) {
			fs.stat(path, function(err, stat) {
				if (err) {
					return callback(err);
				}
				callback(err, statMode(stat.mode & constants.S_IFMT));
			});
		},
		mkdir: function(path, callback, force) {
			if (!force) {
				fs.mkdir(path, function(err) {
					if (!err || err.code === 'EEXIST') {
						callback(null, !err);
					}
					else {
						callback(err);
					}
				});
			}
			else {
				fs.mkdir(path, function(err) {
					callback(err, err || true);
				});
			}
		},
		mkdirp: function(path, callback, force) {
			var f = force || false;
			async.reduce(fstack.normalize(path).split(fstack.sep), '', function(parent, local, cb) {
				fstack.mkdir(fstack.join(parent, local), function(err, made) {
					if (f = made && err && (err.code === 'EEXIST')) {
						err = null;
					}
					cb(err, fstack.join(parent, local));
				}, f);
			}, function(err) {
				callback(err);
			});
		},
		read: function(path, callback) {
			fstack.checkFile(path, function(err) {
				if (err) {
					return callback(err);
				}
				fs.readFile(path, callback);
			});
		},
		readStream: function(path, callback) {
			fstack.checkFile(path, function(err) {
				if (err) {
					return callback(err);
				}
				callback(err, fs.createReadStream(path));
			});
		},
		write: function(path, data, callback) {
			fstack.checkFile(path, function(err) {
				if (err) {
					if (err.code === 'ENOENT') {
						err = null;
					}
					else {
						return callback(err);
					}
				}
				fs.writeFile(path, data, callback);
			});
		},
		writeStream: function(path, callback) {
			fstack.checkFile(path, function(err) {
				if (err) {
					if (err.code === 'ENOENT') {
						err = null;
					}
					else {
						return callback(err);
					}
				}
				callback(err, fs.createWriteStream(path));
			});
		},
		append: function(path, data, callback) {
			fstack.checkFile(path, function(err) {
				if (err) {
					if (err.code === 'ENOENT') {
						err = null;
					}
					else {
						return callback(err);
					}
				}
				fs.appendFile(path, data, callback);
			});
		},
		json: function(path, callback, explicit) {
			fstack.read(path, function(err, data) {
				if (err) {
					if (explicit) {
						return callback(err);
					}
					else {
						fstack.json(path + '.json', callback, true);
					}
				}
				else {
					callback(err, JSON.parse(data));
				}
			});
		},
		delete: function(path, callback) {
			fs.stat(path, function(err, stat) {
				if (err) {
					return callback(err);
				}
				if (stat.isDirectory()) {
					fstack._delete(path, callback);
				}
				else {
					fs.unlink(path, callback);
				}
			});
		},
		_delete: function(path, callback) {
			async.parallel([
				function(next) {
					fstack.dirs(path, function(err, dirs) {
						async.each(dirs, function(dir, n) {
							fstack._delete(fstack.join(path, dir), n);
						}, next);
					});
				},
				function(next) {
					fstack.files(path, function(err, files) {
						async.each(files, function(file, n) {
							fs.unlink(fstack.join(path, file), n);
						}, next);
					});
				}
			], function(err) {
				if (err) {
					return callback(err);
				}
				fs.rmdir(path, callback);
			});
		},
		copy: function(source, destination, callback) {
			fs.stat(source, function(err, stat) {
				if (err) {
					return callback(err);
				}
				if (stat.isDirectory()) {
					fstack.mkdirp(destination, function(err) {
						if (err) {
							return callback(err);
						}
						else {
							fstack._copy(source, destination, callback);
						}
					});
				}
				else {
					fstack.mkdirp(fstack.dirname(destination), function(err) {
						if (err) {
							return callback(err);
						}
						else {
							fs.createReadStream(source).pipe(fs.createWriteStream(destination));
							return callback(null);
						}
					});
				}
			});
		},
		_copy: function(source, destination, callback) {
			async.parallel([
				function(next) {
					fstack.dirs(source, function(err, dirs) {
						async.each(dirs, function(dir, n) {
							fstack.mkdir(fstack.join(destination, dir), function(err) {
								if (err) {
									return n(err);
								}
								fstack._copy(fstack.join(source, dir), fstack.join(destination, dir), n);
							});
						}, next);
					});
				},
				function(next) {
					fstack.files(source, function(err, files) {
						async.each(files, function(file, n) {
							fs.createReadStream(fstack.join(source, file)).pipe(fs.createWriteStream(fstack.join(destination, file)));
							n(null);
						}, next);
					});
				}
			], callback);
		},
		move: function(source, destination, callback) {
			fs.stat(source, function(err, stat) {
				if (err) {
					return callback(err);
				}
				if (stat.isDirectory()) {
					fstack._move(source, destination, callback);
				}
				else {
					fstack.mkdirp(fstack.dirname(destination), function(err) {
						if (err) {
							return callback(err);
						}
						fs.rename(source, destination, callback);
					});
				}
			});
		},
		_move: function(source, destination, callback) {
			fs.stat(destination, function(err) {
				if (err) {
					if (err.code === 'ENOENT') {
						return fs.rename(source, destination, callback);
					}
					else {
						return callback(err);
					}
				}
				else {
					async.parallel([
						function(next) {
							fstack.dirs(source, function(err, dirs) {
								async.each(dirs, function(dir, n) {
									fstack.move(fstack.join(source, dir), fstack.join(destination, dir), n);
								}, next);
							});
						},
						function(next) {
							fstack.files(source, function(err, files) {
								async.each(files, function(file, n) {
									fs.rename(fstack.join(source, file), fstack.join(destination, file), n);
								}, next);
							});
						}
					], function(err) {
						if (err) {
							return callback(err);
						}
						fs.rmdir(source, callback);
					});
				}
			});
		}
	}, _path, os);

})(module.exports);
