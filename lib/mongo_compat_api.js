var Promise = require("bluebird");
var assert = require("assert");
var fhditcher = require("./ditcher");
var logger = require("./logger");
var utils = require("./utils");
var MongoClient = require("mongodb").MongoClient;

/**
 * Create a ditcher instance in case we are working with a shared
 * database.
 *
 * @param mongoUrl Mongodb connection string to be used
 * @param callback result callback
 */
function createDitcherInstance(mongoUrl, callback) {
  // Default config used by ditcher if no connection string
  // is provided
  var config = {
    database: {
      host: '127.0.0.1',
      port: process.env.FH_LOCAL_DB_PORT || 27017,
      name: 'FH_LOCAL'
    }
  };

  if (mongoUrl) {
    try {
      config = utils.parseMongoConnectionURL(mongoUrl);
    } catch(e) {
      return callback(e);
    }
  }

  var versString = (mongoUrl) ? "db per app" : "shared db";
  var ditcher = new fhditcher.Ditcher(config, logger, versString, function () {
    return callback(null, ditcher);
  });
}

/**
 * Implements a MongoDB Node.js 2.0 driver compatible API that works for
 * both, shared and dedicated database.
 *
 * @param ditcher ditcher instance
 * @param params default params for the current app
 * @constructor
 */
var MongoCompatApi = function (params) {
  assert.ok(params.__fhdb, "__fhdb parameter required for shared database");

  /**
   * Copy the default options that are always required by ditcher
   * @param target The options object to copy them to
   * @returns The options object plus the default properties
   */
  this.copyDefaultOptions = function (target) {
    target.__fhdb = params.__fhdb;
    target.__dbperapp = params.__dbperapp;
    return target;
  };

  /**
   * Create a new collection
   * http://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#createCollection
   * @param name collection name
   * @param (optional) options
   * @param (optional) callback results callback
   * @returns Promise if no callback passed
   */
  this.createCollection = function (name, options, callback) {
    assert.ok(name, "collection name required");

    if (typeof options === "function") {
      callback = options;
      options = {};
    }

    options = this.copyDefaultOptions(options || {});
    options.type = name;

    if (callback) {
      params.ditcher.doCreate(options, callback);
    } else {
      return new Promise(function (resolve, reject) {
        params.ditcher.doCreate(options, function (err, collection) {
          if (err) {
            return reject(err);
          }

          resolve(collection);
        });
      });
    }
  };

  /**
   * Drop a collection
   * http://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#dropCollection
   * @param name
   * @param (optional) callback
   * @returns Promise if no callback passed
   */
  this.dropCollection = function (name, callback) {
    assert.ok(name, "collection name required");

    var options = {
      type: name
    };

    options = this.copyDefaultOptions(options || {});

    if (callback) {
      params.ditcher.doDropCollection(options, callback);
    } else {
      return new Promise(function (resolve, reject) {
        params.ditcher.doDropCollection(options, function (err, result) {
          if (err) {
            return reject(err);
          }

          resolve(result);
        });
      });
    }
  };

  /**
   * List all collections
   * http://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#listCollections
   * @param filter Query to filter collections by
   * @param options (optional) Optional settings
   * @returns Cursor
   */
  this.listCollections = function (filter, options) {
    options = this.copyDefaultOptions(options || {});
    return params.ditcher.doGetCollectionsListCursor(filter, options);
  };

  /**
   * Return collections instance
   * http://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#collection
   * @param name Query to filter collections by
   * @param options (optional) Optional settings
   * @param callback (optional) result callback
   * @returns Collection instance if no callback passed
   */
  this.collection = function (name, options, callback) {
    assert.ok(name, "collection name required");

    options = this.copyDefaultOptions(options || {});
    options.type = name;

    return params.ditcher.doGetCollectionInstance(options, callback);
  };

  /**
   * Create an index on collection
   * http://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#createIndex
   * @param name Name of the collection
   * @param fieldOrSpec Field to use for the index
   * @param options (optional) Options
   * @param callback (optional) result callback
   * @returns Promise if no callback passed
   */
  this.createIndex = function (name, fieldOrSpec, options, callback) {
    assert.ok(name, "collection name required");
    assert.ok(fieldOrSpec, "index spec required");

    if(typeof options === "function") {
      callback = options;
      options = {};
    }

    options = this.copyDefaultOptions(options || {});
    options.type = name;
    options.index = fieldOrSpec;

    if (callback) {
      params.ditcher.doIndex(options, callback);
    } else {
      return new Promise(function (resolve, reject) {
        params.ditcher.doIndex(options, function (err, result) {
          if (err) {
            return reject(err);
          }

          resolve(result);
        });
      });
    }
  };

  /**
   * Rename a collection
   * http://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#renameCollection
   * @param fromCollection Current name
   * @param toCollection New name
   * @param options (optional) Options
   * @param callback (optional) Result callback
   */
  this.renameCollection = function (fromCollection, toCollection, options, callback) {
    assert.ok(fromCollection, "current collection name required");
    assert.ok(toCollection, "new collection name required");

    if(typeof options === "function") {
      callback = options;
      options = {};
    }

    options = this.copyDefaultOptions(options || {});
    options.type = fromCollection;
    options.toCollection = toCollection;

    if (callback) {
      params.ditcher.doRenameCollection(options, callback);
    } else {
      return new Promise(function (resolve, reject) {
        params.ditcher.doRenameCollection(options, function (err, result) {
          if (err) {
            return reject(err);
          }

          resolve(result);
        });
      });
    }
  };

  /**
   * Close the database connection
   * http://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#close
   * @param force Force close, emitting no events
   * @param callback (optional) result callback
   */
  this.close = function (force, callback) {
    if (typeof force === "function") {
      callback = force;
      force = false;
    }

    return params.ditcher.database.close(force, callback);
  };
};

/**
 * The constructor function. Returns either an instance of the wrapper API
 * around ditcher or a MongoDB handle as a promise.
 *
 * @param params required and optional parameters. The following parameters are accepted:
 *        __dbperapp:       (required) decides if shared or dedicated database is used and determines
 *                          if an wrapper API instance of a native MongoDB connection is returned
 *        __fhdb:           (optional) Passed by fh-mbaas-api. The name of the MongoDB database to use
 *                          for a given app in shared mode
 *        connectionUrl:    (optional) MongoDB connection URL. Will be used in shared or dedicated mode. If no URL is
 *                          passed an attempt to connec to `localhost` on the default port will be made.
 *        options:          (optional) Connection options, used for native mongo connections
 * @returns Promise
 */
module.exports = function (params) {
  assert.ok(typeof params.__dbperapp !== "undefined", "__dbperapp parameter required");

  if (params.__dbperapp) {
    var options = params.options || {};
    // DB per app: each app has its own database. Create a direct connection to
    // this database and return the mongo handle
    return new Promise(function (resolve, reject) {
      MongoClient.connect(params.connectionUrl, options, function (err, db) {
        if (err) {
          return reject(err);
        }

        // Return the real thing
        return resolve(db);
      });
    });
  } else {
    // Shared DB: create ditcher instance and use it to access the collections
    // in the shared database. `params#connectionUrl` points to the shared database
    return new Promise(function (resolve, reject) {
      createDitcherInstance(params.connectionUrl, function (err, ditcher) {
        if (err) {
          return reject(err);
        }

        params.ditcher = ditcher;

        // Return an instance of the wrapper API around ditcher
        return resolve(new MongoCompatApi(params));
      });
    });
  }
};