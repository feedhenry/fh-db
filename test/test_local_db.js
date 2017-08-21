var assert = require("assert");
var async = require("async");
var proxyquire = require('proxyquire').noPreserveCache();
var env = require('env-var');
var mongodb = require("mongodb");
var MongoClient = mongodb.MongoClient;
var Server = mongodb.Server;
var createRequestLocal = {"__fhdb": "someAppThing", "act": "create", "type": "LocalType", "fields": [
  {"_id": 1, "LocalField1": "LocalField1Data"}
]};
var createRequestRemote = {"__dbperapp": "someRemoteApp", "__fhdb": "someRemoteApp", "act": "create", "type": "RemoteType", "fields": [
  {"_id": 1, "RemoteField1": "RemoteField1Data"}
]};
var createRequestReplica = {"__dbperapp": "someRemoteApp", "__fhdb": "someReplicaApp", "act": "create", "type": "ReplicaType", "fields": [
  {"_id": 1, "ReplicaField1": "ReplicaField1Data"}
]};

var LOCAL_URL = 'mongodb://localhost:27017/FH_LOCAL';

exports['test local mongo instance'] = function (cb) {
  assert.ok(!process.env['FH_MONGODB_CONN_URL']);

  var localdb = require("../lib/localdb.js");
  var local_db = localdb.local_db;
  var local_db_no_mongo_string = local_db;
  //Setting no environment variable, should default to localhost

  console.log('test local database no mongo string');

  MongoClient.connect("mongodb://admin:admin@localhost:27017/admin?fsync=true", {}, function(err, db){
    var targetDb = db.db("FH_LOCAL");

    targetDb.dropDatabase(function (err, result) {
      assert.ok(!err);
      targetDb.close();

      assert.ok(!process.env['FH_MONGODB_CONN_URL']);
      local_db_no_mongo_string(createRequestLocal, function (err, result) {
        assert.ok(!err);

        assert.equal(JSON.stringify(result.fields), JSON.stringify({"LocalField1": "LocalField1Data"}));

        //Now need to connect to the database and verify that the data in the FH_LOCAL database is the same as the data passed (with feedhenry prefixes)
        targetDb.open(function (err, targetDb) {
          assert.ok(!err);

          targetDb.listCollections().toArray(function (err, collections) {
            assert.ok(!err);

            collections = collections.filter(function (collection) {
              return (collection.name.indexOf("system.") == -1);
            });

            //Should only have 1 collection
            assert.equal(collections.length, 1);
            //Now to get the collection to get the data
            assert.equal(collections[0].name, "fh_someAppThing_LocalType");
            targetDb.close();

            //Tearing down the ditch connection
            localdb.tearDownDitch();
            cb();
          });
        });
      });
    });
  });
}

exports['test single mongo instance'] = function (cb) {


  console.log('test local database single mongo instance');
  process.env['FH_MONGODB_CONN_URL'] = "mongodb://user1:pass1@localhost:27017/someRemoteApp";
  var localdb = require("../lib/localdb.js");
  var local_db = localdb.local_db;
  var local_db_single_mongo_string = local_db;
  //Setting no environment variable, should default to localhost

  console.log('test local database no mongo string');

  MongoClient.connect("mongodb://admin:admin@localhost:27017/admin?fsync=true", {}, function(err, db){
    var targetDb = db.db("someRemoteApp");
    targetDb.dropDatabase(function (err, result) {
      assert.ok(!err);

      targetDb.removeUser('user1', function(){
        targetDb.addUser("user1", "pass1", {roles: 'readWrite'}, function (err, result) {
          assert.ok(!err);
          targetDb.close();

          assert.ok(process.env['FH_MONGODB_CONN_URL']);
          local_db_single_mongo_string(createRequestRemote, function (err, result) {
            assert.ok(!err);

            assert.equal(JSON.stringify(result.fields), JSON.stringify({"RemoteField1": "RemoteField1Data"}));


            //Now need to connect to the database and verify that the data in the FH_LOCAL database is the same as the data passed (with feedhenry prefixes)
            targetDb.open(function (err, targetDb) {
              assert.ok(!err);

              targetDb.listCollections().toArray(function (err, collections) {
                assert.ok(!err);

                collections = collections.filter(function (collection) {
                  return (collection.name.indexOf("system.") == -1);
                });

                //Should only have 1 collection
                assert.equal(collections.length, 1);
                //Now to get the collection to get the data
                assert.equal(collections[0].name, "RemoteType");
                targetDb.close();

                //Tearing down the ditch connection
                localdb.tearDownDitch();
                cb();

              });
            });
          });
        });
      });
    });
  });
}


exports['test replica instance usage'] = function (cb) {

  console.log('test local database replica mongo instance');
  process.env['FH_MONGODB_CONN_URL'] = "mongodb://user2:pass2@localhost:27017,localhost:27017/someReplicaApp";
  var localdb = require("../lib/localdb.js");
  var local_db = localdb.local_db;
  var local_db_replica_mongo_string = local_db;
  //Setting no environment variable, should default to localhost

  console.log('test local database no mongo string');

  MongoClient.connect("mongodb://admin:admin@localhost:27017/admin?fsync=true", {}, function(err, db){
    var targetDb = db.db("someReplicaApp");
    targetDb.dropDatabase(function (err, result) {
      assert.ok(!err);

      targetDb.removeUser('user2', function(){
        targetDb.addUser("user2", "pass2", {roles: ['readWrite']}, function (err, result) {
          assert.ok(!err);
          targetDb.close();


          assert.ok(process.env['FH_MONGODB_CONN_URL']);
          local_db_replica_mongo_string(createRequestReplica, function (err, result) {
            assert.ok(!err);

            assert.equal(JSON.stringify(result.fields), JSON.stringify({"ReplicaField1": "ReplicaField1Data"}));


            //Now need to connect to the database and verify that the data in the FH_LOCAL database is the same as the data passed (with feedhenry prefixes)
            targetDb.open(function (err, targetDb) {
              assert.ok(!err);

              targetDb.listCollections().toArray(function (err, collections) {
                assert.ok(!err);

                collections = collections.filter(function (collection) {
                  return (collection.name.indexOf("system.") == -1);
                });

                //Should only have 1 collection
                assert.equal(collections.length, 1);
                //Now to get the collection to get the data
                assert.equal(collections[0].name, "ReplicaType");
                targetDb.close();

                //Tearing down the ditch connection
                localdb.tearDownDitch();
                cb();

              });
            });
          });
        });
      });
    });
  });
}

exports['test replica with invalid auth string'] = function (cb) {

  console.log('test local database replica mongo instance');
  process.env['FH_MONGODB_CONN_URL'] = "mongodb://:pass2@localhost:27017,localhost:27017/someReplicaApp";
  var localdb = require("../lib/localdb.js");
  var local_db = localdb.local_db;
  var local_db_replica_mongo_string = local_db;
  //Setting no environment variable, should default to localhost

  console.log('test local database no mongo string');
  MongoClient.connect("mongodb://admin:admin@localhost:27017/admin?fsync=true", {}, function(err, db){
    var targetDb = db.db("someReplicaApp");

    targetDb.dropDatabase(function (err, result) {
      assert.ok(!err);

      targetDb.removeUser('user2', function(){
        targetDb.addUser("user2", "pass2", {roles: ['readWrite']}, function (err, result) {
          assert.ok(!err);
          targetDb.close();


          assert.ok(process.env['FH_MONGODB_CONN_URL']);
          local_db_replica_mongo_string(createRequestReplica, function (err, result) {
            assert.ok(err);
            assert.ok(!result);

            assert.equal(err.message, "Incorrect format for database connection string.");
            localdb.tearDownDitch();
            cb();

          });
        });
      });
    });
  });
}

exports['test connection string parsing'] = function (cb) {
  var localdb = require("../lib/localdb.js");

  function testGoodStrings(cb) {
    var goodSingle = "mongodb://user2:pass2@localhost:27017/someReplicaApp";
    var goodSingleRes = {"database": {"auth": {"user": "user2", "pass": "pass2"}, name: "someReplicaApp", port: 27017, host: "localhost", "driver_options": {}}};

    var goodReplica = "mongodb://user2:pass2@localhost:27017,localhost:27018/someReplicaApp";
    var goodReplicaRes = {"database": {"auth": {"user": "user2", "pass": "pass2"}, name: "someReplicaApp", port: [27017, 27018], host: ["localhost", "localhost"], "driver_options": {}}};

    var goodReplica2 = "mongodb://user2:pass2@localhost,localhost:27018/someReplicaApp";
    var goodReplica2Res = {"database": {"auth": {"user": "user2", "pass": "pass2"}, name: "someReplicaApp", port: [27017, 27018], host: ["localhost", "localhost"], "driver_options": {}}};

    var goodReplicaOption = "mongodb://user2:pass2@localhost,localhost:27018/someReplicaApp?someOption=someValue";
    var goodReplicaOptionRes = {"database": {"auth": {"user": "user2", "pass": "pass2"}, name: "someReplicaApp", port: [27017, 27018], host: ["localhost", "localhost"], "driver_options": {"someOption": "someValue"}}};

    var goodReplicaOptions = "mongodb://user2:pass2@localhost,localhost:27018/someReplicaApp?someOption=someValue,someOption2=someValue2";
    var goodReplicaOptionsRes = {"database": {"auth": {"user": "user2", "pass": "pass2"}, name: "someReplicaApp", port: [27017, 27018], host: ["localhost", "localhost"], "driver_options": {"someOption": "someValue", "someOption2": "someValue2"}}};


    var goodReplicaOptionsDifferentAddresses = "mongodb://user2:pass2@localhost,10.25.10.10:27018/someReplicaApp?someOption=someValue,someOption2=someValue2";
    var goodReplicaOptionsDifferentAddressesRes = {"database": {"auth": {"user": "user2", "pass": "pass2"}, name: "someReplicaApp", port: [27017, 27018], host: ["localhost", "10.25.10.10"], "driver_options": {"someOption": "someValue", "someOption2": "someValue2"}}};


    var testGoodArray = [goodSingle, goodReplica, goodReplica2, goodReplicaOption, goodReplicaOptions, goodReplicaOptionsDifferentAddresses];


    async.eachSeries(testGoodArray, function (testString, cb) {
      var compareVal = undefined;

      assert.doesNotThrow(function () {
        compareVal = localdb.parseMongoConnectionURL(testString)
      }, `parsing string "${testString}" should be successful`);

      assert.ok(compareVal);

      cb();
    }, function (e) {
      cb(e);
    });
  }

  async.series([testGoodStrings], function () {
    cb();
  });
};

exports['test errors should be thrown for invalid connection strings'] = function () {
  var localdb = require("../lib/localdb.js");

  var BAD_STRINGS = {
    MISSING_AUTH_SECTION: 'mongodb://user2@localhost:27017,localhost:27017/someReplicaApp',
    NO_DATABASE: 'mongodb://user2:pass2@localhost:27017,localhost:27017',
    NO_HOST: 'mongodb://user2:pass2@/someReplicaApp',
    GARBAGE: 'afgadf ga dfg adfg adfg asd ag:;;////',
    NOTHING: ''
  };

  Object.keys(BAD_STRINGS).forEach(function (key) {
    assert.throws(
      () => localdb.parseMongoConnectionURL(BAD_STRINGS[key]),
      Error,
      `Expected an error to be thrown for BAD_STRINGS.${key} ("${BAD_STRINGS[key]}")`
    );
  });
}

exports['should not require auth string when run locally'] = function () {
  var utils = proxyquire('../lib/utils.js', {
    'env-var': env.mock({
      'FH_USE_LOCAL_DB': 'true'
    })
  });

  assert.doesNotThrow(
    () => utils.parseMongoConnectionURL(LOCAL_URL),
    `parseMongoConnectioURL should not throw for ${LOCAL_URL} when FH_USE_LOCAL_DB is true`
  );
}

exports['should require auth string when run on RHMAP'] = function () {
  var utils = require('../lib/utils.js');

  assert.throws(
    () => localdb.parseMongoConnectionURL(LOCAL_URL),
    `parseMongoConnectioURL should not throw for ${LOCAL_URL} when FH_USE_LOCAL_DB is falsy`
  );
}