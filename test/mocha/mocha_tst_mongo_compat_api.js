var createApi = require("../../lib/mongo_compat_api");
var fhmongodb = require("../../lib/fhmongodb");
var mongodb = require('mongodb');
var Server = mongodb.Server;
var assert = require('assert');
var config = require("./../fixtures/base_config.json");

var DB_PER_APP = process.env.DB_PER_APP === "true";

var TEST_DB_NAME = "testDB-123412341234123412341234-API";
var TEST_COL_NAME = "test_mongo_compat_api_col";

config.database.name = TEST_DB_NAME;
config.database.host = process.env.MONGODB_HOST || config.database.host;

var api = null;
var db = null;

function createDatabasesAndUsers(cfg, callback){
  var db = new mongodb.Db(cfg.database.name, new Server(cfg.database.host, cfg.database.port), {fsync:true});

  db.open(function(err, targetDb){
    if(err) return callback(err);

    targetDb.authenticate(cfg.database.adminauth.user, cfg.database.adminauth.pass, {authSource:"admin"}, function(err, result){
      if(err)
        return callback(err);

      targetDb.dropDatabase(function(err, result) {
        if(err) return callback(err);

        targetDb.removeUser(cfg.database.auth.user, function(){
          targetDb.addUser(cfg.database.auth.user, cfg.database.auth.pass, function(err, result){
            if(err) return callback(err);

            //Database created and user added. The rest of the tests will work as normal.
            targetDb.close();
            callback();
          });
        });
      });
    });
  });
}

describe(" (db per app: " + DB_PER_APP + ")", function () {
  beforeEach(function (done) {
    createDatabasesAndUsers(config, function () {
      createApi({
        __fhdb: TEST_DB_NAME,
        __dbperapp: DB_PER_APP,
        connectionUrl: DB_PER_APP ? `mongodb://${process.env.MONGODB_HOST || "localhost"}:27017` : undefined
      }).then(function (apiInstance) {
        api = apiInstance;
        done();
      });
    });
  });

  afterEach(function (done) {
    api.close().then(function () {
      done();
    }).catch(function () {
      throw new Error("Error closing the database connection");
    });
  });

  it("creates collection using callback", function (done) {
    // The `fields` object must be passed when the API is used with a shared
    // database. Otherwise the collection will not be created.
    api.createCollection(TEST_COL_NAME, {
      "fields": {
        "firstName" : "Joe",
        "lastName" : "Bloggs"
      }
    }, function (err, collection) {
      assert.ifError(err);
      assert.ok(collection, "Collection has not been created");
      done();
    });
  });

  it("drops collection using callback", function (done) {
    api.dropCollection(TEST_COL_NAME, function (err, result) {
      assert.ifError(err);
      assert.ok(result);
      done();
    });
  });

  it("creates collection using promise", function (done) {
    api.createCollection(TEST_COL_NAME, {
      "fields": {
        "firstName" : "Joe",
        "lastName" : "Bloggs"
      }
    }).then(function (collection) {
      assert.ok(collection, "Collection has not been created");
      done();
    }).catch(function (err) {
      throw new Error("Collection not created");
    });
  });

  it("drops collection using promise", function (done) {
    api.dropCollection(TEST_COL_NAME).then(function (result) {
      assert.ok(result);
      done();
    }).catch(function () {
      throw new Error("Collection not dropped");
    });
  });

  it("lists collections using cursor", function (done) {
    api.createCollection(TEST_COL_NAME, {
      "fields": {
        "firstName" : "Joe",
        "lastName" : "Bloggs"
      }
    }, function (err, collection) {
      assert.ifError(err);
      assert.ok(collection, "Collection has not been created");
      var cursor = api.listCollections();
      assert.ok(cursor, "No cursor returned");
      cursor.toArray(function (error, documents) {
        assert.ifError(error);
        for (var i = 0; i < documents.length; i++) {
          if (documents[i].name.indexOf(TEST_COL_NAME) >= 0) {
            return done();
          }
        }
        throw new Error("Collection not returned in `#listCollections`")
      });
    });
  });

  it("returns collection instance", function (done) {
    var col = api.collection(TEST_COL_NAME);
    assert.ok(col, "No collection returned");
    done();
  });

  it("returns collection with callback", function (done) {
    api.collection(TEST_COL_NAME, function (err, collection) {
      assert.ifError(err);
      assert.ok(collection, "No collection returned");
      done();
    });
  });

  it("creates index with callback", function (done) {
    api.createIndex(TEST_COL_NAME, "firstName", function (err, result) {
      assert.ifError(err);
      assert.ok(result, "Index not created");
      done();
    });
  });

  it("creates index with promise", function (done) {
    api.createIndex(TEST_COL_NAME, "firstName").then(function (result) {
      assert.ok(result, "Index not created");
      done();
    }).catch(function () {
      throw new Error("index not created");
    });
  });

  it("inserts document with callback", function (done) {
    api.collection(TEST_COL_NAME).insert({
      firstName: "dummy-callback",
      lastName: "user"
    }, function (err, result) {
      assert.ifError(err);
      assert.equal(result.insertedCount, 1, "No documents inserted");
      done();
    });
  });

  it("inserts document with promises", function (done) {
    api.collection(TEST_COL_NAME).insert({
      firstName: "dummy-promise",
      lastName: "user"
    }).then(function (result) {
      assert.equal(result.insertedCount, 1, "No documents inserted");
      done();
    }).catch(function () {
      throw new Error("No documents inserted")
    })
  });

  it("find document returning cursor", function (done) {
    api.collection(TEST_COL_NAME).find({"firstName": "dummy-callback"}).toArray(function (err, docs) {
      assert.ifError(err);
      assert.ok(docs);
      assert.equal(docs.length, 1);
      done();
    });
  });

  it("renames collection using callback", function (done) {
    api.renameCollection(TEST_COL_NAME, TEST_COL_NAME + "_2", function (err, collection) {
      assert.ifError(err);
      assert.ok(collection);
      done();
    });
  });

  it("renames collection using promise", function (done) {
    api.renameCollection(TEST_COL_NAME + "_2", TEST_COL_NAME).then(function (collection) {
      assert.ok(collection);
      done();
    }).catch(function () {
      throw new Error("Collection not renamed");
    });
  });
});
