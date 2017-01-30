var _ = require('lodash');
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var ObjectID = mongodb.ObjectID;
var util = require("util");
var EventEmitter = require('events').EventEmitter;
var parseConnectionUrl = require("./utils").parseConnectionUrl;
var parseConnectionUrlOptions = require("./utils").parseConnectionUrlOptions;

var Database = function (host, port, pDriverOptions, retryWaitTime, dbname) {
  EventEmitter.call(this);
  this.queue = [];
  this.name = dbname;
  this.db = null;
  this.ready = false;
  this.connectionUrl = null;

  this.connectionUrlOptions = null;

  this.retryInternval = 1000;
  this.retryTimes = 30;
  if (retryWaitTime) {
    this.retryInternval = retryWaitTime.interval;
    this.retryTimes = retryWaitTime.limit;
  }

  this.connectionUrl = parseConnectionUrl(host, port);
  this.connectionUrlOptions = parseConnectionUrlOptions(pDriverOptions);
};

util.inherits(Database, EventEmitter);

/**
 * Get the MongoDB database instance.
 *
 * Will return `null` if connection has not been established.
 *
 * @returns {mongodb.Db} - The MongoDB database instance.
 */
Database.prototype.getMongoClient = function() {
  return this.db;
};

Database.prototype.createObjectIdFromHexString = function (str) {
  return ObjectID.createFromHexString(str);
};

Database.prototype.tearUp = function (auth) {
  var self = this;
  var retryCount = 0;
  var interval = null;
  var connectionString = "mongodb://";
  if(auth && auth.user && auth.pass){
    connectionString += auth.user + ":" + auth.pass + "@";
  }
  connectionString += this.connectionUrl + "/" + this.name;

  // Removed the auth.source parameter from here, it should be part
  // of the connectionOptions. See also:
  // http://api.mongodb.com/python/current/examples/authentication.html#delegated-authentication
  connectionString += this.connectionUrlOptions;

  function connectToDb() {
    if (retryCount < self.retryTimes) {
      MongoClient.connect(connectionString, {}, function(err, db){
        if (null != err) {
          retryCount++;
          if(!interval){
            interval = setInterval(connectToDb, self.retryInternval);
          }
          console.warn("Failed to connect to db: " + err + " . Attempt: " + retryCount);
        } else {
          retryCount = 0;
          if (interval) {
            clearInterval(interval);
          }

          db.on('error', function (err) {
            console.warn('Mongo connection error:'  + err);
            self.emit('error', err);
          });

          db.on('close', function() {
            var message = 'Mongo connection closed';
            console.warn(message);
            self.emit('close', message);
          });

          self.db = db.db(self.name);
          authenticateUser(auth);
        }
      });
    } else {
      if (!self.ready) {
        self.emit('dbconnectionerror', "Can not connect to MongoDB after " + self.retryTimes + " attempts.");
      }
    }
  }

  function notifyUp() {
    console.info("Database connection established");
    self.ready = true;
    self.emit('tearUp');
  }

  function authenticateUser(auth) {
    if (auth && auth.user && auth.pass) {
      console.info("Authenticate user...");
      self.db.authenticate(auth.user, auth.pass, function (err, result) {
        if (err) return self.emit('dbconnectionerror', err);
        notifyUp();
      });
    } else {
      notifyUp();
    }
  }

  if (undefined == this.db || null == this.db) {
    connectToDb();
  }

};

Database.prototype.tearDown = function () {
  if (null !== this.db) {
    var olddb = this.db;
    this.db = null;
    this.ready = false;
    olddb.close();
  }

  this.emit('tearDown');
};

Database.prototype.close = function (force, callback) {
  return this.db.close(force, callback);
};

Database.prototype.create = function (collectionName, data, callback) {
  if (null === this.db) {
    return callback(new Error("no database open"), null);
  }
  var self = this;
  self.db.collection(collectionName, function (err, collection) {
    if (err) {
      return callback(err, null);
    }
    if (null === collection) return callback(new Error("Collection doesn't exist"), null);
    // if we're being supplied GUID _ids make them into objectIDs
    if (data instanceof Array){
      data.forEach(function(doc){
        if (doc.hasOwnProperty('_id') && doc._id.length === 24){
          try{
             doc._id= self.createObjectIdFromHexString(doc._id);
          }catch(err){
            // We can step over these - it'll still get created OK
          }
        }
      });
    }
    collection.insert(data, function (err, objects) {
      if (err) return callback(err, null);

      return callback(null, objects.ops);
    });
  });
};

Database.prototype.find = function (collectionName, query, callback) {
  return this.findWithSelection(collectionName, query, {}, {}, callback);
};

Database.prototype.findWithSelectionCursor = function (collectionName, query, selection, options, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.collection(collectionName, function (err, collection) {
    if (null !== err) return callback(err, null);

    collection.find(query, selection, options, callback);
  });
};

Database.prototype.findWithSelection = function (collectionName, query, selection, options, callback) {
  this.findWithSelectionCursor(collectionName, query, selection, options, function (err, cursor) {
    if (null !== err) return callback(err, null);

    cursor.toArray(function (err, items) {
      return callback(err, items);
    });
  });
};

Database.prototype.group = function (collectionName, query, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.collection(collectionName, function (err, collection) {
    if (null !== err) return callback(err, null);

    //keys, condition, initial, reduce, command, callback
    collection.group(query.keys, query.cond, query.initial, query.reduce, true, function (err, results) {
      if (null !== err) return callback(err, null);
      return callback(err, results);
    });
  });
};

Database.prototype.distinct = function (collectionName, key, query, callback) {
  if (null === this.db) {
    return callback(new Error("no database open"), null);
  }
  this.db.collection(collectionName, function (err, collection) {
    if (null !== err) {
      return callback(err, null);
    }
    collection.distinct(key, query, callback);
  });
};

Database.prototype.update = function (collectionName, criteria, data, upsert, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.collection(collectionName, function (err, collection) {
    if (null !== err) return callback(err, null);
    collection.update(criteria, data, {
      upsert: upsert
    }, function (err, docs) {
      callback(err, docs);
    });
  });
};

Database.prototype.remove = function (collectionName, id, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  var self = this;

  this.db.collection(collectionName, function (err, collection) {
    if (null !== err){
      return callback(err, null);
    }

    // if a GUID id is passed as strings, convert it to an ObjectID
    try{
      id = self.createObjectIdFromHexString(id);
    }catch(err){
      // if not, use the id as is
    }

    collection.remove({
      _id: id
    }, function (err, docs) {
      return callback(err, docs);
    });
  });
};

Database.prototype.removeAll = function (collectionName, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.collection(collectionName, function(err, collection){
    if(null !== err) return callback(err, null);
    collection.remove({}, {safe: true}, function(err, response){  // need safe mode to get number of docs deleted
      callback(err, response.result.n);
    });
  });
};

Database.prototype.collectionExists = function (collectionName, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.listCollections({name: collectionName}).toArray(function (err, collections) {
    if (err) {
      return callback(err, null);
    }
    if (collections.length === 0) {
      return callback(null, false);
    } else {
      return callback(null, true);
    }
  });
};

Database.prototype.createCollectionWithIndex = function (collectionName, index, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.createCollection(collectionName, function (err, collection) {
    if (err) {
      console.log("Error from createCollection(): " + JSON.stringify(err));
      return callback(err);
    }
    collection.ensureIndex([
      [index, 1]
    ], true, function (err, indexName) {
      callback(err);
    });
  });
};

Database.prototype.createCollectionWithOptions = function (collectionName, options, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.createCollection(collectionName, options, function (err, collection) {
    if (err) {
      console.log("Error from createCollection(): " + JSON.stringify(err));
    }
    return callback(err, collection);
  });
};

Database.prototype.findOne = function (collectionName, selector, fields, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.collection(collectionName, function (err, collection) {
    if (err) return callback(err, null);
    collection.findOne(selector, fields, callback);
  });
};

Database.prototype.countCollection = function (collectionName, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);

  this.db.collection(collectionName, function (err, collection) {
    if (err){
      return callback(err, null);
    }
    collection.count(callback);
  });
};

Database.prototype.collectionNames = function collectionNames(callback) {
  if (null === this.db) {
    return callback(new Error("No database open"), null);
  }

  var databaseName = this.db.databaseName;
  this.db.listCollections().toArray(function wrappedCallback(error, documents) {

    documents = _.map(documents, function mapDocumentsToOldApi(document) {
      return _.mapValues(document, function prefixNameWithDb(val, key) {
        return key === "name" ? databaseName + "." + val : val;
      });
    });
    return callback(error, documents);
  });
};

Database.prototype.collectionInfo = function (collectionName, callback) {
  if (null === this.db) {
    return callback(new Error("no database open"), null);
  }
  var coll = this.db.collection(collectionName);
  if (!coll) {
    return callback(new Error("No collection found with name " + collectionName), null);
  }
  return coll.stats(callback);
};

Database.prototype.dropDatabase = function (callback) {
  if (null === this.db) return callback(new Error("no database open"), null);
  this.db.dropDatabase(callback);
};

Database.prototype.dropCollection = function (collectionName,callback) {
  if (null === this.db) {
    return callback(new Error("no database open"), null);
  }
  this.db.collection(collectionName, function(err, collection){
    if(err) {
      return callback(err, null);
    }
    collection.drop(callback);
  });
};

/**
 * Add an index to  field/fields
 * @param indexes : it could be single index or mixed indexes. {"name":1} | {"name.firstname":-1} | {"location":"2d"} |{"location":"2d","name":1}
 */
Database.prototype.index = function (collectionName, indexes, callback) {
  if (null === this.db) return callback(new Error("no database open"), null);
  this.db.collection(collectionName, function (err, collection) {
    if (null === collection) return callback(new Error("Collection doesn't exist"), null);
    if (err) {
      return callback(err);
    }
    collection.ensureIndex(indexes, function (err, indexName) {
      callback(err, indexName);
    });
  });
};

/**
 * Same as `#index` but works on DB level instead of collection level. Also passes
 * extra options parameter to the MongoDB driver
 */
Database.prototype.createIndex = function (name, fieldOrSpec, options, callback) {
  if (!this.db) {
    if (callback) {
      return callback(new Error("no database open"));
    }
    throw new Error("no database open");
  }

  return this.db.createIndex(name, fieldOrSpec, options, callback);
};

Database.prototype.checkStatus = function (cb) {
  if (null == this.db) return cb(new Error("no database open"));
  this.db.collections(function (err, result) {
    if (err) return cb(err);
    return cb();
  });
};

Database.prototype.collection = function (name, cb) {
  if (null == this.db) return cb(new Error("no database open"));
  this.db.collection(name, cb);
};

// Same as `collection` but returns a collection instance if no callback is
// passed and also accepts extra options
Database.prototype.getCollectionInstance = function (name, options, callback) {
  if (!this.db) {
    if (callback) {
      return callback(new Error("no database open"));
    }
    throw new Error("no database open");
  }

  return this.db.collection(name, options, callback);
};

Database.prototype.renameCollection = function (fromCollection, toCollection, options, callback) {
  if (!this.db) {
    if (callback) {
      return callback(new Error("no database open"));
    }
    throw new Error("no database open");
  }

  return this.db.renameCollection(fromCollection, toCollection, options, callback);
};

// Raw MongoDB `listCollections` returning a CommandCursor like object
Database.prototype.listCollections = function (filter, options) {
  if (!this.db) {
    throw new Error("no database open");
  }

  var cursor = this.db.listCollections(filter, options);
  var databaseName = this.db.databaseName;

  // MongoDB `CommandCursor` like object
  function CommandCursor(cursor) {
    this.toArray = function (callback) {
      cursor.toArray(function (error, documents) {
        documents = _.map(documents, function (document) {
          return _.mapValues(document, function (val, key) {
            return key === "name" ? databaseName + "." + val : val;
          });
        });
        return callback(error, documents);
      });
    };
  }

  return new CommandCursor(cursor);
};

exports.Database = Database;
