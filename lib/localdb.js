var fhdb = require('./fhmongodb.js');
var fhditcher = require('./ditcher.js');
var assert = require('assert');
var permission_map = require('./permission_map');
var parseMongoConnectionURL = require('./utils').parseMongoConnectionURL;
var my_db_logger = require("./logger");

var ditch;

function getDitchHandle(cb) {

  //The ditch handle will depend on whether there is a mongo connection url in the parameters
  var my_db_config = {
    database: {
      host: '127.0.0.1',
      port: process.env.FH_LOCAL_DB_PORT || 27017,
      name: 'FH_LOCAL'
    }
  };

  if(process.env.FH_MONGODB_CONN_URL && ! process.env.FH_USE_LOCAL_DB ){
    var mongoConnectionURL = process.env.FH_MONGODB_CONN_URL;
    my_db_logger.debug(mongoConnectionURL);
  }

  if (mongoConnectionURL) {
    //parse the url
    //build the connection structure for ditch
    try {
      my_db_config = parseMongoConnectionURL(mongoConnectionURL);
    }
    catch (e) {
      var errMessage = new Error("Incorrect format for database connection string.");
      my_db_logger.error(errMessage);
      return cb(errMessage);
    }
  }

  if (!ditch) {
    var versString = (mongoConnectionURL) ? "direct mongo connection" : "fhc local data";
    var ditcher = new fhditcher.Ditcher(my_db_config, my_db_logger, versString, function () {
      my_db_logger.debug("Ditcher initialised");
      ditch = ditcher;
      return cb();
    });
  } else {
    return cb();
  }
}

var tearDownDitch = function () {

  my_db_logger.debug("tearingDownDitch");

  if (ditch)
    ditch.tearDown();
  ditch = null;
};

var local_db = function (params, cb) {
  var action = params.act;

  getDitchHandle(function (err) {
    if (err) {
      return cb(err);
    }
    my_db_logger.debug("DBACTION: " + action);

    // Using the `name` property from the permission map here to make
    // sure this one gets updated as new actions are added.
    if ('getDitcher' === action) {
      return cb(null, ditch);
    } else if (permission_map.db.create.name === action) {
      my_db_logger.debug('about to: create');
      ditch.doCreate(params, function (err, id) {
        my_db_logger.debug('back from create: err', err, "id:", id);
        if (err) return cb(err);
        return cb(undefined, id);
      });
    } else if (permission_map.db.list.name === action) {
      ditch.doList(params, function (err, id) {
        if (err) return cb(err);
        var listResp = {count: id.length, list: id};
        return cb(undefined, listResp);
      });
    } else if (permission_map.db.read.name === action) {
      my_db_logger.debug('about to: read, params: ', params);
      ditch.doRead(params, function (err, doc) {
        my_db_logger.debug('back from create: err', err, "doc:", doc);
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if (permission_map.db.delete.name === action) {
      ditch.doDelete(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if (permission_map.db.deleteAll.name === action) {
      ditch.doDeleteAll(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if (permission_map.db.drop.name === action) {
      ditch.doDropCollection(params, function(err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if (permission_map.db.update.name === action) {
      ditch.doUpdate(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if (permission_map.db.index.name === action) {
      ditch.doIndex(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if (permission_map.db.export.name === action) {
      ditch.doExport(params, function (err, zip) {
        if (err) return cb(err);
        return cb(undefined, zip);
      });
    } else if (permission_map.db.import.name === action) {
      ditch.doImport(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if (permission_map.db.close.name === action) {
      tearDownDitch();
      return cb();
    } else {
      return cb(new Error("Unknown fh.db action"));
    }
  });
};

exports.local_db = local_db;
exports.tearDownDitch = tearDownDitch;
exports.Ditcher = fhditcher.Ditcher;
exports.Database = fhdb.Database;
exports.parseMongoConnectionURL = parseMongoConnectionURL;
exports.permission_map = permission_map;

/**
 * Node.js MongoDB 2.0 driver compatible API that works with shared and
 * dedicated databases. Returns either a wrapper API instance around
 * ditcher or a MongoDB connection handle.
 *
 * Example usage:
 *
 * var localdb = require('fh-db');
 * localdb.createMongoCompatApi({
 *   __fhdb: <CURRENT FH-DB>,
 *   __dbperapp: <TRUE|FALSE>,
 *   connectionUrl: <MONGODB CONNECTION URL>
 * }).then(function (api) {
 *  api.collection("users").find(...);
 * }).catch(function (err) {
 *   logger.error({err: err}, "Api could not be created");
 * });
 */
exports.createMongoCompatApi = require("./mongo_compat_api");
