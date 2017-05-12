// Copyright (c) FeedHenry 2011

// Test suite for the Feedhenry DITCH Server
var sys = require('sys');
var util = require('util');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var fhmongodb = require("../lib/fhmongodb.js");
var mongodb = require('mongodb');
var Server = mongodb.Server;
var ditchhandler = require("../lib/ditcher.js");
var async = require('async');

var LOGLEVEL_ERROR = 0;
var LOGLEVEL_WARNING = 1;
var LOGLEVEL_INFO = 2;
var LOGLEVEL_DEBUG = 3;

var useOwnDatabase = false;

var loglevel = LOGLEVEL_INFO;

var logger = {
  info: (loglevel >= LOGLEVEL_INFO)?function (msg) {
    console.log("INFO   ", msg);
  }:function(){},
  debug: (loglevel >= LOGLEVEL_DEBUG)?function (msg) {
    console.log("DEBUG  ", msg);
  }:function(){},
  warning: (loglevel >= LOGLEVEL_WARNING)?function (msg) {
    console.log("WARNING", msg);
  }:function(){},
  error: (loglevel >= LOGLEVEL_ERROR)?function (msg) {
    console.log("ERROR  ", msg);
  }:function(){}
};
var importExportHelpers = require('../lib/importexport/helpers.js')(logger);

var ditch;

var config = require("./fixtures/base_config.json");

var own_app_config = {
  "database" : {
    "host" : "localhost",
    "port" : 27017,
    "name" : "testing-own-app-database",
    "adminauth" : {
          "user": "admin",
          "pass": "admin"
        },
    "auth" : {
      "user": "ditchuser",
      "pass": "ditchpassword",
      "source": "fh-ditch"
    },
    "driver_options": {w:1, j:1}
  },

  "logger" : {
    "loglevel" : 3
  }
};

//Database name is the same as the appName sent to ditcher for app with own database
var test_fhdb_name = "testing-123456789123456789012345-dev";
var ditcher_app_per_database = {
  "database" : {
    "host" : "localhost",
    "port" : 27017,
    "name" : test_fhdb_name,
    "adminauth" : {
          "user": "admin",
          "pass": "admin"
        },
    "auth" : {
      "user": "ditchuser",
      "pass": "ditchpassword",
      "source": "fh-ditch"
    },
    "driver_options": {w:1, j:1}
  },

  "logger" : {
    "loglevel" : 3
  }
};

var createData = {
  "__fhdb" : test_fhdb_name,
  "type" : "fh_test_collection",
  "fields" : {
    "firstName" : "Joe",
    "lastName" : "Bloggs",
    "address1" : "22 Bloggs Ville Road",
    "address2" : "Blog Land",
    "location" : {
      "lat" : 50.1234,
      "lon" : -7.987
    }
  }
};

var createDataOwnApp = {
  "__fhdb" : "testing-own-app-database",
  "__dbperapp" : true,
  "type" : "fh_test_collection",
  "fields" : {
    "firstName" : "Joe",
    "lastName" : "Bloggs",
    "address1" : "22 Bloggs Ville Road",
    "address2" : "Blog Land",
    "location" : {
      "lat" : 50.1234,
      "lon" : -7.987
    }
  }
};

var createDataDitchApp = {
  "__fhdb" : "testing-ditch-app-database",
  "type" : "TestingCollectionWithFHPrefix",
  "fields" : {
    "firstName" : "Joe",
    "lastName" : "Bloggs",
    "address1" : "22 Bloggs Ville Road",
    "address2" : "Blog Land",
    "location" : {
      "lat" : 50.1234,
      "lon" : -7.987
    }
  }
};

var createDataNoFields = {
  "__fhdb" : test_fhdb_name,
  "type" : "fh_test_collection"
}

var test_import_data = {
    fruit : [
      {"_id":"53724174c463b18116000004","name":"plums"}
    ],
    veg : [
      {"_id":"53724174c463b18116000005","name":"carrots"}
    ]
};

var testTopic = "test_topic";

function createDatabasesAndUsers(cfg, callback){
  var db = new mongodb.Db(cfg.database.name, new Server(cfg.database.host, cfg.database.port), {fsync:true});

  db.open(function(err, targetDb){
    if(err)
      return callback(err);

    targetDb.authenticate(cfg.database.adminauth.user, cfg.database.adminauth.pass, {authSource:"admin"}, function(err, result){
      if(err)
        return callback(err);

      targetDb.dropDatabase(function(err, result) {
        if(err)
          return callback(err);

        targetDb.removeUser(cfg.database.auth.user, function(){
          targetDb.addUser(cfg.database.auth.user, cfg.database.auth.pass, function(err, result){
            if(err)
              return callback(err);

            //Database created and user added. The rest of the tests will work as normal.
            targetDb.close();
            callback();
          });
        });
      });
    });
  });
}

function createTestData(cfg, testTopic, callback) {
  var db = new fhmongodb.Database();
  db.name = cfg.database.name;


  db.on("tearUp", function() {
    db.createCollectionWithIndex(testTopic, 'idx', function(err) {

      if (err)
        return callback(err, null);
      db.create(testTopic, [
        {
          idx : 1,
          foo : 'foo',
          num1 : 100,
          num2 : 300,
          liker : '123'
        }, {
          idx : 2,
          foo : 'bar',
          num1 : 110,
          num2 : 600,
          liker : 'abcdef'
        }, {
          idx : 3,
          foo : 'foobar',
          num1 : 120,
          num2 : 200,
          liker : 'abc123def'
        }, {
          idx : 4,
          foo : 'bar',
          num1 : 130,
          num2 : 500,
          liker : 'abcdef123'
        }, {
          idx : 5,
          foo : 'foo',
          num1 : 140,
          num2 : 400,
      liker : '123abcdef'
        }
      ], function(err, data) {
        assert.ok(!err, "Received error hen setting up test data: " + err);
        if (err)
          return callback(err);
        db.tearDown();
        callback(err, data);
      });
    });
  });

  db.addListener("error", function(err) {
    logger.error("createTestData database error: " + err);
  });

  db.tearUp(cfg.database.auth);
};

function getDocs(collection, checkDocs) {
  var params = {
    "__fhdb" : test_fhdb_name,
    "__dbperapp": useOwnDatabase,
    "type" : collection
  };

  ditch.doGetCollectionInstance(params, function(err, collection) {
    collection.find().toArray(function(err, docs) {
      assert.ok(!err);
      checkDocs(err,docs);
    });
  });
}


var testCollectionOwnAppDatabase = function(cb){

  logger.info("test testCollectionOwnAppDatabase()");
  var databaseName = "testing-own-app-database";
  var collectionName = "testCollection";

  var db = new mongodb.Db(databaseName, new Server(own_app_config.database.host, own_app_config.database.port), {fsync:true});


    db.open(function(err, targetDb){
      assert.ok(!err);


      targetDb.authenticate(own_app_config.database.adminauth.user, own_app_config.database.adminauth.pass,{authSource:"admin"}, function(err, result){
        assert.ok(!err);

        targetDb.dropDatabase(function(err, result) {
          assert.ok(!err);

          targetDb.removeUser(own_app_config.database.auth.user, function(){
            targetDb.addUser(own_app_config.database.auth.user, own_app_config.database.auth.pass, function(err, result){
              assert.ok(!err);

              var ownAppDitch = new ditchhandler.Ditcher(own_app_config, logger, "9.8.7-Test Version", function() {

                //Database created again, now I create a request to ditch
                logger.info("test testCreate()");
                var testData = JSON.parse(JSON.stringify(createDataOwnApp));
                var expectedResult = JSON.parse(JSON.stringify(testData.fields));
                ownAppDitch.doCreate(testData, function(err, res) {
                  logger.debug("Create = " + JSON.stringify(res));
                  logger.debug("Excpct = " + JSON.stringify(expectedResult));
                  logger.debug("data.guid = " + res.guid);
                  assert.equal(res.fields.firstName, "Joe");
                  assert.equal(JSON.stringify(res.fields), JSON.stringify(expectedResult));

                  //Now that the creation has returned as expected, a query to the apps own database should show a collection without any of the feedhenry prefixes
                  targetDb.listCollections().toArray(function(err, collections){
                    logger.error(err);
                    assert.ok(!err);
                    logger.info(collections);


                    var collNames = collections.filter(function(collection){
                      return collection.name === createDataOwnApp.type;
                    });
                    assert.equal(collNames.length, 1);
                    assert.equal(collNames[0].name, createDataOwnApp.type);

                    targetDb.close();
                    ownAppDitch.tearDown();

                    cb();

                  });
                });
              });
            });
          });
        });
      });
    });
}


var testCollectionDitchAppDatabase = function(cb){

  //Database created again, now I create a request to ditch
  logger.info("test testCollectionDitchAppDatabase");


  var testData = JSON.parse(JSON.stringify(createDataDitchApp));
  var expectedResult = JSON.parse(JSON.stringify(testData.fields));
  ditch.doCreate(testData, function(err, res) {
    logger.debug("Create = " + JSON.stringify(res));
    logger.debug("Excpct = " + JSON.stringify(expectedResult));
    logger.debug("data.guid = " + res.guid);
    assert.equal(res.fields.firstName, "Joe");
    assert.equal(JSON.stringify(res.fields), JSON.stringify(expectedResult));

    //Now that the creation has returned as expected, a query to the apps own database should show a collection with the feedhenry prefixes
    var db = new mongodb.Db(config.database.name, new Server(config.database.host, config.database.port), {fsync:true});

    db.open(function(err, targetDb){
      assert.ok(!err);


      targetDb.authenticate(config.database.adminauth.user, config.database.adminauth.pass,{authSource:"admin"}, function(err, result){
        assert.ok(!err);

        targetDb.listCollections().toArray(function(err, collections){
          assert.ok(!err);
          logger.info(collections);
          var expectedCollectionName = "fh_" + createDataDitchApp.__fhdb + "_" + createDataDitchApp.type;

          var collNames = collections.filter(function(collection){
            return collection.name === expectedCollectionName;
          });
          assert.equal(collNames.length, 1);
          assert.equal(collNames[0].name,expectedCollectionName);

          targetDb.close();

          cb();
        });
      });
    });
  });
}

var testBasicOperationsOwnDatabase = function(cb){

  logger.info("test testBasicOperationsOwnDatabase()");
  //tearing down ditch and setting up a new one to own database
  ditch.tearDown();
  useOwnDatabase = true;
  //Create new database for tests
  var db = new mongodb.Db(ditcher_app_per_database.database.name, new Server(ditcher_app_per_database.database.host, ditcher_app_per_database.database.port), {fsync:true});

  db.open(function(err, targetDb){
    assert.ok(!err);


    targetDb.authenticate(ditcher_app_per_database.database.adminauth.user, ditcher_app_per_database.database.adminauth.pass, {authSource: "admin"}, function(err, result){
      assert.ok(!err);

      targetDb.dropDatabase(function(err, result){
        assert.ok(!err);

        targetDb.removeUser(ditcher_app_per_database.database.auth.user, function(){
          targetDb.addUser(ditcher_app_per_database.database.auth.user, ditcher_app_per_database.database.auth.pass, function(err, result){
            assert.ok(!err);
            targetDb.close();
            ditch = new ditchhandler.Ditcher(ditcher_app_per_database, logger, "9.8.7-Test Version", function() {
              //With the new database for this app, all of these tests should be correct also
              createTestData(ditcher_app_per_database, "fh_test_list", function() {
                async.waterfall([
                  testCreate,
                  testRead,
                  testUpdate,
                  testImport,
                  testImportMacOS,
                  testExport,
                  testDelete,
                  testListCollections,
                  testDeleteAgain,
                  testDeleteNonHexGuid,
                  testList1,
                  testList2,
                  testList3,
                  testList4,
                  testList5,
                  testList6,
                  testList7,
                  testList8,
                  testList9,
                  testList10,
                  testList11,
                  testListLimit,
                  testListSkip,
                  testListSort,
                  testBadCreate,
                  testBadCreate3,
                  testBadCreate4,
                  testBadCreate5,
                  testBadCreate6,
                  testBadCreate7,
                  testBadUpdate,
                  testParallelCreate,
                  async.apply(testDeleteAll, 5),
                  testListAfterDelete,
                  async.apply(testDeleteAll, 0)
                ], function (err, result) {
                  assert.ok(!err);
                  cb(err);
                });
              });
            });
          });
        });
      });
    });
  });
}

var testCreate = function(cb) {
  logger.info("test testCreate()");
  var testData = useOwnDatabase ? JSON.parse(JSON.stringify(createDataOwnApp)) : JSON.parse(JSON.stringify(createData));



  var expectedResult = JSON.parse(JSON.stringify(testData.fields));
  ditch.doCreate(testData, function(err, res) {
    logger.debug("Create = " + JSON.stringify(res));
    logger.debug("Excpct = " + JSON.stringify(expectedResult));
    logger.debug("data.guid = " + res.guid);
    assert.equal(res.fields.firstName, "Joe");
    assert.equal(JSON.stringify(res.fields), JSON.stringify(expectedResult));
    cb(undefined, res);
  });
};

var testRead = function(created, cb) {
  logger.info("test testRead()");
  var readReq = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_collection",
    "guid" : created.guid
  };

  if(useOwnDatabase){
    readReq.__dbperapp = true;
  }

  logger.debug("readReq", readReq);
  ditch.doRead(readReq, function(err, res) {
    logger.debug("Read = ",res);
    assert.equal(res.fields.firstName, "Joe");
    assert.equal(res.fields.address1, "22 Bloggs Ville Road");
    assert.equal(JSON.stringify(res.fields), JSON.stringify(created.fields));
    cb(undefined, created);
  });
};


var testUpdate = function(created, cb) {
  logger.info("test testUpdate()");
  var updateReq = JSON.parse(JSON.stringify(created));
  updateReq.fields.firstName = 'Jane';
  updateReq["__fhdb"] = test_fhdb_name;

  if(useOwnDatabase){
    updateReq.__dbperapp = true;
  }

  ditch.doUpdate(updateReq, function(err, res) {
    logger.debug("updateRes = " + JSON.stringify(res));

    // firstName should have changed - other fields still the
    // same
    assert.equal(res.fields.firstName, "Jane");
    assert.equal(res.fields.address1, "22 Bloggs Ville Road");
    cb(undefined, created);
  });
};

var testListCollections = function(created, cb) {
  logger.info("test testListCollections()");
  // We're just passing created thru to the delete test...
  ditch.doList({
    "__fhdb" : test_fhdb_name,
    "__dbperapp" : useOwnDatabase
  }, function(err, res) {
    assert.ok(!err);
    assert.ok(res);
    assert.ok(res.length > 0);
    var aCollectionsStats = res[0];
    assert.ok(aCollectionsStats.name);
    assert.ok(aCollectionsStats.size);
    assert.ok(aCollectionsStats.count);
    cb(undefined, created);
  });
};

var testDelete = function(created, cb) {
  logger.info("test testDelete()");
  var deleteReq = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_collection",
    "guid" : created.guid
  };

  if(useOwnDatabase){
    deleteReq.__dbperapp = true;
  }

  ditch.doDelete(deleteReq, function(err, deleteRes) {
    assert.equal(deleteRes.fields.firstName, "Jane");
    assert.equal(deleteRes.fields.address1, "22 Bloggs Ville Road");
    cb(undefined, created);
  });
};

var testDeleteAgain = function (created, cb) {
  logger.info("test testDeleteAgain()");

  // Try deleting again - should just get an empty
  // response.
  var deleteReq = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_collection",
    "guid" : created.guid
  };

  if(useOwnDatabase){
    deleteReq.__dbperapp = true;
  }

  ditch.doDelete(deleteReq, function(err, res) {
    assert.ok(!err);
    assert.equal(JSON.stringify(res), "{}");
    cb(undefined, created);
  });
};

var testDeleteNonHexGuid = function(created, cb) {
  logger.info("test testDeleteNonHexGuid()");
  var deleteReq = {
    "__fhdb" : "123456789",
    "type" : "fh_test_collection",
    "guid" : created.guid + "3333"
  };

  if(useOwnDatabase){
    deleteReq.__dbperapp = true;
  }

  ditch.doDelete(deleteReq, function(err, deleteRes) {
    assert.ok(!err);
    assert.equal(JSON.stringify(deleteRes), "{}");
    cb();
  });
};

var testList1 = function(cb) {
  logger.info("test testList1()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "eq" : {
      "foo" : {value: "foo", type: "String"}
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function(err, listEqRes) {
    assert.ok(!err);
    logger.debug("listEqRes", listEqRes);
    assert.equal(listEqRes.length, 2);
    cb();
  });
};

var testList2 = function (cb) {
  logger.info("test testList2()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "ne" : {
      "foo": { value: "foo", type: "String" }
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function(err, listNeqRes) {
    assert.equal(listNeqRes.length, 3);
    cb();
  });
};

var testList3 = function (cb) {
  logger.info("test testList3()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "gt" : {
      "num2" : {value: 400, type: "Number"}
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function(err, listNeqRes) {
    assert.equal(listNeqRes.length, 2);
    cb();
  });
};

var testList4 = function (cb) {
  logger.info("test testList4()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "ge" : {
      "num2": { value: 400, type: "Number" }
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function(err, listNeqRes) {
    assert.equal(listNeqRes.length, 3);
    cb();
  });
};

var testList5 = function(cb) {
  logger.info("test testList5()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "lt" : {
      "num2": { value: 400, type: "Number" }
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function(err, listNeqRes) {
    assert.equal(listNeqRes.length, 2);
    cb();
  });
};

var testList6 = function(cb) {
  logger.info("test testList6()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "le" : {
      "num2": { value: 400, type: "Number" }
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }


  ditch.doList(doListRequest, function(err, listNeqRes) {
      assert.equal(listNeqRes.length, 3);
      cb();
  });
};

var testList7 = function(cb) {
  logger.info("test testList7()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "like" : {
      "liker" : {value: "^123$", type: "String"}
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }


  ditch.doList(doListRequest, function(err, listNeqRes) {
      assert.equal(listNeqRes.length, 1);
      listNeqRes[0].idx = 1;
      cb();
  });
};

var testList8 = function(cb) {
  logger.info("test testList8()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "like" : {
      "liker" : {value: "123", type: "String"}
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function(err, listNeqRes) {
      assert.equal(listNeqRes.length, 4);
      listNeqRes[0].idx = 1;
      cb();
  });
};

var testList9 = function(cb) {
  logger.info("test testList9()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "like" : {
      "liker" : {value: "def", type: "String"}
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function(err, listNeqRes) {
      assert.equal(listNeqRes.length, 4);
      listNeqRes[0].idx = 1;
      cb();
  });
};

var testList10 = function(cb) {
  logger.info("test testList10()");

  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "like" : {
      "liker" : {value: "def$", type: "String"}
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function(err, listNeqRes) {
      assert.equal(listNeqRes.length, 3);
      listNeqRes[0].idx = 1;
      cb();
  });
};


var testList11 = function (cb) {
  logger.info("test testList11()");


  var doListRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list",
    "gt" : {
      "num1" : {value: 100, type: "Number"},
      "num2" : {value: 400, type: "Number"}
    },
    "lt" : {
      "num1" : {value: 130, type: "Number"}
    }
  };

  if(useOwnDatabase){
    doListRequest.__dbperapp = true;
  }

  ditch.doList(doListRequest, function (err, listGtltRes) {
    assert.equal(listGtltRes.length, 1);
    assert.equal(listGtltRes[0].fields.idx, 2);
    cb();
  });
};

var testListLimit = function (cb){
  logger.info("test testListLimit()");

  var testLimitRequest = {
    "__fhdb": test_fhdb_name,
    "type": 'fh_test_list',
    "limit" : 1
  };

  if(useOwnDatabase){
    testLimitRequest.__dbperapp = true;
  }

  ditch.doList(testLimitRequest, function (err, limitRes) {
    assert.ok(!err);
    assert.equal(limitRes.length, 1);
    cb();
  });
}

var testListSkip = function (cb){
  logger.info("test testListSkip()");

  var testListSkipRequest = {
    "__fhdb": test_fhdb_name,
    "type": 'fh_test_list'
  };

  if(useOwnDatabase){
    testListSkipRequest.__dbperapp = true;
  }

  ditch.doList(testListSkipRequest, function (err, fullRes) {
    var fullLength = fullRes.length;

    var doListSkipRequest2 = {
      "__fhdb": test_fhdb_name,
      "type": 'fh_test_list',
      "skip" : 1
    };

    if(useOwnDatabase){
      doListSkipRequest2.__dbperapp = true;
    }

    ditch.doList(doListSkipRequest2, function (err, skipRes) {
      assert.ok(!err);
      assert.equal(skipRes.length, fullLength-1);
      cb();
    });
  });
};

var testListSort = function(cb){
  logger.info("test testListSort()");


  var testListSortRequest = {
    "__fhdb": test_fhdb_name,
    "type": 'fh_test_list',
    "sort" : {
      'idx' : -1
    }
  };

  if(useOwnDatabase){
    testListSortRequest.__dbperapp = true;
  }

  ditch.doList(testListSortRequest, function (err, descSortedRes) {
    assert.ok(descSortedRes.length);
    // Verify the list is sorted by IDX field desc
    for (var i=0; i<descSortedRes.length-1; i++){
      assert.ok(descSortedRes[i].fields.idx > descSortedRes[i+1].fields.idx);
    }

    var doListRequest = {
      "__fhdb": test_fhdb_name,
      "type": 'fh_test_list',
      "sort" : [[ 'idx' , 'asc' ]] // specify sort in the other horrible awful 2D array MongoDB Format what were they thinking
    };

    if(useOwnDatabase){
      doListRequest.__dbperapp = true;
    }

    ditch.doList(doListRequest, function (err, ascSortedRes) {
      assert.ok(ascSortedRes.length);
      for (var i=0; i<ascSortedRes.length-1; i++){
        assert.ok(ascSortedRes[i].fields.idx < ascSortedRes[i+1].fields.idx);
      }
      cb();
    });
  });
};

var testBadCreateGeneric = function(name, data, cb) {
  logger.info("testing " + name);
  ditch.doCreate(data, function(err, res) {
    assert.ok(err, "Should return error for invalid params");
    cb();
  });
};

var testBadCreate = function(cb) {
  testBadCreateGeneric("testBadCreate", JSON.stringify({}), cb)
};

var testBadCreateNoFields = function(cb) {
  testBadCreateGeneric("testBadCreateNoFields", JSON.stringify(createDataNoFields), cb);
};

var testBadCreate2 = function(cb) {
  testBadCreateGeneric("testBadCreate2", JSON.stringify({
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_collection"
  }), cb);
};

var testBadCreate3 = function(cb) {

  var badCreate3Request = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_collection",
    "fields" : "hello world"
  };

  if(useOwnDatabase){
    badCreate3Request.__dbperapp = true;
  }
  testBadCreateGeneric("testBadCreate3", JSON.stringify(badCreate3Request), cb);
};

var testBadCreate4 = function(cb) {

  var badCreate4Request = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_collection",
    "fields" : "{\"field1\":\"create1\", \"field2\": \"create2\",\"field3\":\"create3\"}"
  };

  if(useOwnDatabase){
    badCreate4Request.__dbperapp = true;
  }
  testBadCreateGeneric("testBadCreate4", JSON.stringify(badCreate4Request), cb);
};

var testBadCreate5 = function(cb) {
  var testBadCreate5Request = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_collection",
    "fields" : 451
  };

  if(useOwnDatabase){
    testBadCreate5Request.__dbperapp = true;
  }
  testBadCreateGeneric("testBadCreate5", JSON.stringify(testBadCreate5Request), cb);
};

var testBadCreate6 = function(cb) {

  var testBadCreate6Request = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_collection",
    "fields" : []
  };


  if(useOwnDatabase){
    testBadCreate6Request.__dbperapp = true;
  }
  testBadCreateGeneric("testBadCreate6", JSON.stringify(testBadCreate6Request), cb);
};

var testBadCreate7 = function(cb) {
  var data = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_fhdb_name_too_long_11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
    "fields" : {
      "firstName" : "Joe"
    }
  };

  testBadCreateGeneric("testBadCreate7", data, cb);
};


var testBadUpdate = function(cb) {
  var badUpdateReq = {
    "__fhdb" : "NOT_EXISTS",
    "type" : "fh_test_collection",
    "guid" : "bad-guid--not-here"
  };

  if(useOwnDatabase){
    badUpdateReq.__dbperapp = true;
  }

  logger.info("test testBadUpdate()");
  ditch.doUpdate(badUpdateReq, function(err, res) {
    assert.ok(err, "Should return error on bad Update params");
    cb();
  });
};

var testParallelCreate = function(cb) {
  logger.info("test testParallelCreate()");
  var testData1 = useOwnDatabase ? JSON.parse(JSON.stringify(createDataOwnApp)) : JSON.parse(JSON.stringify(createData));
  var testData2 = useOwnDatabase ? JSON.parse(JSON.stringify(createDataOwnApp)) : JSON.parse(JSON.stringify(createData));
  var testData3 = useOwnDatabase ? JSON.parse(JSON.stringify(createDataOwnApp)) : JSON.parse(JSON.stringify(createData));
  var testData4 = useOwnDatabase ? JSON.parse(JSON.stringify(createDataOwnApp)) : JSON.parse(JSON.stringify(createData));
  testData1.fields.field1 = "value1";
  testData2.fields.field2 = "value2";
  testData3.fields.field3 = "value3";
  testData4.fields.field4 = "value4";

  logger.debug(JSON.stringify(testData1));

  async.parallel([
    function (testCallback) {
      ditch.doCreate(testData1, function(err, res) {
        testCallback(err, res);
      });
    },
    function (testCallback) {
      ditch.doCreate(testData2, function(err, res) {
        testCallback(err, res);
      });
    },
    function (testCallback) {
      ditch.doCreate(testData3, function(err, res) {
        testCallback(err, res);
      });
    },
    function (testCallback) {
      ditch.doCreate(testData4, function(err, res) {
        testCallback(err, res);
      });
    }
  ], function (err, results) {
    assert.equal(err, null);
    assert.equal(results.length, 4);
    cb();
  });

};

var testDeleteAll = function(expectedDeleteCount, cb) {
  logger.info("test testDeleteAll(" + expectedDeleteCount + ")");


  var testDeleteAllRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list"
  };

  if(useOwnDatabase){
    testDeleteAllRequest.__dbperapp = true;
  }

  ditch.doDeleteAll(testDeleteAllRequest, function(err, deleteAllRes) {
      assert.equal(deleteAllRes.status, "ok");
      assert.equal(deleteAllRes.count, expectedDeleteCount);
      return cb();
  });
};

var testListAfterDelete = function(cb) {
  logger.info("test testListAfterDelete()");

  var testListAfterDeleteRequest = {
    "__fhdb" : test_fhdb_name,
    "type" : "fh_test_list"
  };

  if(useOwnDatabase){
    testListAfterDeleteRequest.__dbperapp = true;
  }

  ditch.doList(testListAfterDeleteRequest, function(err, listEqRes) {
      assert.equal(listEqRes.length, 0);
      return cb();
  });
};

var testExport = function(created, cb) {
  logger.info("test testExport()");
  ditch.doExport({
    "__fhdb" : test_fhdb_name,
    "__dbperapp" : useOwnDatabase
  }, function(err, res) {
    assert.ok(!err);
    assert.ok(res);
    assert.ok(res instanceof Buffer);

    var filePath = '/tmp/testZip.zip',
    mockParams = {
      filename : 'testZip.zip',
      files : {
        toimport : {
          path : filePath,
          name : 'testZip.zip'
        }
      }
    };
    // let's write the exported file to disk to immitate an incoming import request
    // then crack open the zip to verify all OK
    fs.writeFile(filePath, res, 'binary', function(err, succ){
      assert.ok(!err);
      importExportHelpers.importFile(mockParams, function(err, res){
        assert.ok(!err);
        assert.ok(res);
        assert.ok(typeof res === 'object');
        assert.ok(res.fh_test_list);
        cb(undefined, created);
      });

    }); // end fs.writeFile
  });
};

var testImport = function(created, cb) {
  logger.info("test testImport()");

  ditch.doImport({
    "__fhdb" : test_fhdb_name,
    collections : test_import_data,
    filename : 'import.zip',
    files : {
      toimport : {
        path : __dirname + '/fixtures/import.zip',
        name : 'import.zip'
      }
    },
    "__dbperapp" : useOwnDatabase
  }, function(err, res) {
    assert.ok(!err);
    assert.ok(res);
    assert.ok(res.ok);
    assert.ok(res.imported);
    assert.ok(res.imported.length === 2);
    assert.ok(res.imported.indexOf('fruit')>-1);
    assert.ok(res.imported.indexOf('veg')>-1);

    async.series([
      function(callback) {
        getDocs('fruit', function(err, docs) {
          assert.equal(docs.length,1);
          assert.equal(docs[0].name,'plums');

          callback(err);
        });
      },
      function(callback) {
        getDocs('veg', function(err, docs) {
          assert.equal(docs.length,2);
          assert.equal(docs[0].field,'onions');
          assert.equal(docs[1].field,'carrots');

          callback(err);
        });
      }
    ], function (err) {
      assert.ok(!err);
      return cb(undefined, created);
    });
  });
};

var testImportMacOS = function(created, cb) {
  logger.info("test testImport()");

  ditch.doImport({
    "__fhdb" : test_fhdb_name,
    collections : test_import_data,
    filename : 'import-MacOS.zip',
    files : {
      toimport : {
        path : __dirname + '/fixtures/import-MacOS.zip',
        name : 'import-MacOS.zip'
      }
    },
    "__dbperapp" : useOwnDatabase
  }, function(err, res) {
    assert.ok(!err);
    assert.ok(res);
    assert.ok(res.ok);
    assert.ok(res.imported);
    assert.ok(res.imported.length === 3);
    assert.ok(res.imported.indexOf('collection01')>-1);
    assert.ok(res.imported.indexOf('collection02')>-1);
    assert.ok(res.imported.indexOf('collection03')>-1);

    getDocs('collection01', function(err, docs) {
      assert.ok(!err);
      assert.equal(docs.length,3);
      assert.equal(docs[0].field,'value01');
      assert.equal(docs[1].field,'value02');
      assert.equal(docs[2].field,'value03');

      return cb(undefined, created);
    });
  });
};

var testNonHexId = function(done) {
  logger.info("BEGIN testNonHexId...");
  
  var collectionName = "fh_test_collection_non_hex_id";
  var createData = {
    "__fhdb" : test_fhdb_name,
    "type" : collectionName,
    "fields" : {
      "_id": "foobar",
      "firstName" : "Foo",
      "lastName" : "Bar"
    }
  };

  async.waterfall([
    function(cb) {
      logger.info("test testCreate()");

      var testData = JSON.parse(JSON.stringify(createData));
      var expectedResult = JSON.parse(JSON.stringify(testData.fields));

      ditch.doCreate(testData, function(err, res) {
        assert.equal(res.guid, createData.fields._id);
        assert.equal(res.fields.firstName, createData.fields.firstName);
        assert.equal(res.fields.lastName, createData.fields.lastName);
        cb(undefined, res);
      });
    },
    function(created, cb) {
      logger.info("test testRead()");
      var readReq = {
        "__fhdb" : test_fhdb_name,
        "type" : collectionName,
        "guid" : created.guid
      };

      logger.debug("readReq", readReq);
      ditch.doRead(readReq, function(err, res) {
        assert.equal(res.guid, createData.fields._id);
        assert.equal(res.fields.firstName, createData.fields.firstName);
        assert.equal(res.fields.lastName, createData.fields.lastName);
        cb(undefined, created);
      });
    },
    function(created, cb) {
      logger.info("test testUpdate()");
      var updateReq = JSON.parse(JSON.stringify(created));
      updateReq.fields.firstName = 'Fizz';
      updateReq["__fhdb"] = test_fhdb_name;

      ditch.doUpdate(updateReq, function(err, res) {
        logger.debug("updateRes = " + JSON.stringify(res));

        // firstName should have changed - other fields still the
        // same
        assert.equal(res.guid, createData.fields._id);
        assert.equal(res.fields.firstName, "Fizz");
        assert.equal(res.fields.lastName, createData.fields.lastName);
        cb(undefined, created);
      });
    },
    function(created, cb) {
      logger.info("test testDelete()");
      var deleteReq = {
        "__fhdb" : test_fhdb_name,
        "type" : collectionName,
        "guid" : created.guid
      };

      ditch.doDelete(deleteReq, function(err, deleteRes) {
        assert.equal(deleteRes.guid, createData.fields._id);
        assert.equal(deleteRes.fields.firstName, "Fizz");
        assert.equal(deleteRes.fields.lastName, createData.fields.lastName);
        cb(undefined, created);
      });
    }
  ], function (err, result) {
    assert.ok(!err);
    ditch.tearDown();
    return done();
  });

};


exports.testDbActions = function(done) {
  logger.info("BEGIN testDbActions...");

  //As databases are now password secured, all tests should reflect this.
  //Admin user will set up a username and password for the test database
  createDatabasesAndUsers(config, function(err){
    if(err)
      logger.error(err);
    ditch = new ditchhandler.Ditcher(config, logger, "9.8.7-Test Version", function() {

    createTestData(config, "fh_" + test_fhdb_name + "_fh_test_list", function() {
      async.waterfall([
        testCreate,
        testRead,
        testUpdate,
        testImport,
        testImportMacOS,
        testExport,
        testListCollections,
        testDelete,
        testDeleteAgain,
        testDeleteNonHexGuid,
        testList1,
        testList2,
        testList3,
        testList4,
        testList5,
        testList6,
        testList7,
        testList8,
        testList9,
        testList10,
        testList11,
        testBadCreate,
        testBadCreateNoFields,
        testBadCreate2,
        testBadCreate3,
        testBadCreate4,
        testBadCreate5,
        testBadCreate6,
        testBadCreate7,
        testBadUpdate,
        async.apply(testDeleteAll, 5),
        testListAfterDelete,
        async.apply(testDeleteAll, 0),
        testCollectionOwnAppDatabase,
        testCollectionDitchAppDatabase,
        testBasicOperationsOwnDatabase,
        testNonHexId
        ], function (err, result) {
          assert.ok(!err);
          ditch.tearDown();
          done();
        });
      });
    });
  });
};
