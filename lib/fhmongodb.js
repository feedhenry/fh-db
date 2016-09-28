var _ = require('lodash');
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var ObjectID = mongodb.ObjectID;
var util = require("util");
var EventEmitter = require('events').EventEmitter;

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
 * This will return a connection URL like:
 * host1[:port1][,host2[:port2],...[,hostN[:portN]]]
 *
 * With the intention that it can be prepended with "mongodb://[username]:[password]@"
 * and appended with "/[database][?options]
 *
 * @param host This is expected in the format: "host1" or "host1,host2" or ["host1", "host2"]
 * @param port This is expected in the format: 123 or "123" or "123,456" or ["123", "456"] or [123, 456]
 *
 * @returns {string} host1[:port1][,host2[:port2],...[,hostN[:portN]]]
 */
function parseConnectionUrl(host, port){
  var hosts = [];
  var ports = [];

  //normalise host to an array
  if(! host) {
    hosts  = ['localhost'];
  } else if('string' === typeof host && host.split(',').length <= 1){
    hosts = [host];
  } else if ('string' === typeof host && host.split(',').length > 1){
    hosts = host.split(',');
  } else if (Array.isArray(host)){
    hosts = host;
  }

  //normalise port to an array
  if(! port){
    ports = [27017];
  } else if('string' === typeof port && port.split(',').length <= 1 || 'number' === typeof port){
    ports = [port];
  } else if ('string' === typeof port && port.split(',').length > 1){
    ports = port.split(',');
  } else if (Array.isArray(port)){
    ports = port;
  }

  var connectionHosts = [];

  for( var hostIndex=0; hostIndex < hosts.length; hostIndex++ ){
    connectionHosts[hostIndex] = hosts[hostIndex];

    //if only one port specified, use it on all hosts, otherwise assume number of ports and hosts are equal
    if(ports.length === 1){
      connectionHosts[hostIndex] += ":" + ports[0];
    } else {
      connectionHosts[hostIndex] += ":" + ports[hostIndex];
    }
  }

  return connectionHosts.join(',');
}


/**
 * Returns the driver options URL encoded for the connection string; e.g.: w=1&j=true
 *
 * @param options an Array of options
 *
 * @returns {string}
 */
function parseConnectionUrlOptions(options){
  //set default values
  var retOptions = { w: 1, j: true, numberOfRetries: 5, retryMiliSeconds: 2000, native_parser:false};

  //override defaults
  if (options) {
    for (var field in options) {
      // RHMAP-9817 if a field (more explicitly replicaSet) is empty don't include it in the options
      // The reason that the comparator to an empty string was used is that the options[field] value can be set to false
      // and hence not get included
      if (options[field] !== "") {
        retOptions[field] = options[field];
      }
    }
  }
  var argParts = [];

  //convert options to arg string
  for(var opt in retOptions) {
    if (retOptions.hasOwnProperty(opt)) {
      argParts.push(encodeURIComponent(opt) + "=" + encodeURIComponent(retOptions[opt]));
    }
  }
  if(argParts.length) {
    return "?" + argParts.join("&");
  }
  return "";
}

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
          self.db = db.db(self.name);
          authenticateUser(auth);

          self.db.on('error', function (err) {
            console.warn("mongodb emits error: " + err);
            self.emit('error', err);
          });
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
    if (null !== err) return callback(err, null);

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
    return callback(err);
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
    if (err) return callback(err, null);
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

exports.Database = Database;
