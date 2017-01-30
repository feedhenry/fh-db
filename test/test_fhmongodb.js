//GLOBAL.DEBUG = true;

var assert = require("assert");
var async = require("async");
var Database = require("../lib/fhmongodb.js").Database;
var lodash = require("lodash");


var config = {
  "database" : {
    "host" : "localhost",
    "port" : 27017,
    "name" : "fh_ditch_test",
    "adminauth" : {
          "user": "admin",
          "pass": "admin"
        },
    "auth" : {
      "user": "ditchuser",
      "pass": "ditchpassword"
    },
    "driver_options": {w:1, j:1}
  }
}

//It is possible to create an array of ports as part of a replica set connection
var port_array_config = {
  "database" : {
    "host" : ["localhost"],
    "port" : [27017],
    "name" : "fh_ditch_test",
    "adminauth" : {
          "user": "admin",
          "pass": "admin"
        },
    "auth" : {
      "user": "ditchuser",
      "pass": "ditchpassword"
    },
    "driver_options": {w:1, j:1}
  }
}

var host_string_array_config = {
  "database" : {
    "host" : "localhost,127.0.0.1",
    "port" : 27017,
    "name" : "fh_ditch_test",
    "adminauth" : {
          "user": "admin",
          "pass": "admin"
        },
    "auth" : {
      "user": "ditchuser",
      "pass": "ditchpassword"
    },
    "driver_options": {w:1, j:1}
  }
};

exports['test Authentication'] = function(done) {
  var self = this;
  self.db = new Database();
  self.db.name = "admin";
  self.db.on('tearUp', function(){
    self.db.db.authenticate(config.database.adminauth.user, config.database.adminauth.pass, {authSource: 'admin'}, function(err, result) {
      assert.ok(!err);
      self.db.tearDown();
      done();
    });
  });
  self.db.tearUp();
};

exports['test configDriverOptions'] = function(){

  //Creating a new database connection with no config options
  var db = new Database(config.database.host, config.database.port, null);
  assert.ok(db);
  //Checking whether the default driver settings are applied
  assert.ok(lodash.isEqual(db.connectionUrlOptions, '?w=1&j=true&numberOfRetries=5&retryMiliSeconds=2000&native_parser=false'));

  var dbWithConfig = new Database(config.database.host, config.database.port, {w:3, j:false, "someOtherOption":"someOtherOptionValue"});
  assert.ok(dbWithConfig);

  assert.ok(lodash.isEqual(dbWithConfig.connectionUrlOptions, '?w=3&j=false&numberOfRetries=5&retryMiliSeconds=2000&native_parser=false&someOtherOption=someOtherOptionValue'));

};

exports['test portArray'] = function(done) {
  var self = this;
  self.db = new Database(config.database.host, config.database.port, {native_parser: false});
  self.db.name = "test-fhmongodb-testPort";

  self.db.on("tearUp", function(){
    self.db.db.authenticate(config.database.adminauth.user, config.database.adminauth.user, {authSource:"admin"}, function(err, result){
      assert.ok(!err);
      self.db.tearDown();
      done();
    });
  });

  self.db.tearUp();


};

// TODO: fix this.
//
// exports['test hostStringArray'] = function() {
//   var self = this;
//   self.db = new Database(host_string_array_config.database.host, host_string_array_config.database.port, {native_parser: false});
//   self.db.name = "test-fhmongodb-testPort";

//   self.db.on("tearUp", function(){
//     self.db.db.authenticate(host_string_array_config.database.adminauth.user, host_string_array_config.database.adminauth.user,{authSource:"admin"}, function(err, result){
//       assert.isNull(err);

//       self.db.tearDown();
//     });
//   });

//   self.db.tearUp();
// }


exports['test removeAll'] = function (done) {
  var self = this;

  self.db = new Database();
  self.db.name = "test-fhmongodb-database2-removeall";
  self.test_collection = "testremoveall";
  self.test_initial_data = [
    {id: '1', type: 't1'},
    {id: '2', type: 't2'},
    {id: '3', type: 't1'},
    {id: '4', type: 't2'},
    {id: '5', type: 't3'}
  ];
  self.db.on('tearUp', function () {
    self.db.db.authenticate(config.database.adminauth.user, config.database.adminauth.user, {authSource: 'admin'}, function(err, result){
      assert.ok(!err);
      self.db.dropDatabase(function(err) {
        assert.ok(!err, JSON.stringify(err));

        self.db.create(self.test_collection, self.test_initial_data, function (err, docs) {
          assert.ok(!err, JSON.stringify(err));

          self.db.find(self.test_collection, {}, function(err, items) {
            assert.ok(!err, JSON.stringify(err));
            assert.strictEqual(items.length, 5);

            self.db.removeAll(self.test_collection, function (err, numDeleted) {
              assert.ok(!err, JSON.stringify(err));
              assert.strictEqual(numDeleted, 5);

              self.db.find(self.test_collection, {}, function(err, items) {
                assert.ok(!err, JSON.stringify(err));
                assert.strictEqual(items.length, 0);
                self.db.tearDown();
                return done();
              });
            });
          });
        });
      });
    });

  });

  self.db.tearUp(); // no proceed by opening db
};


exports['test Distinct'] = function (done) {

  var self = this;
  self.db = new Database();
  self.db.name = "test-fhmongodb-database2";
  self.test_collection = "testdistinked";
  self.test_initial_data = [
    {id: '1', type: 't1'},
    {id: '2', type: 't2'},
    {id: '3', type: 't1'},
    {id: '4', type: 't2'},
    {id: '5', type: 't3'}
  ];
  self.db.on('tearUp', function () {

    self.db.db.authenticate(config.database.adminauth.user, config.database.adminauth.pass, {authSource:"admin"}, function(err, result){
      assert.ok(!err);
      self.db.dropDatabase(function(err) {
        assert.ok(!err, JSON.stringify(err));
        self.db.removeAll(self.test_collection, function (err) {
          assert.ok(!err, JSON.stringify(err));
          self.db.create(self.test_collection, self.test_initial_data, function (err, docs) {
            assert.ok(!err, JSON.stringify(err));
            self.db.distinct(self.test_collection, 'type', {}, function (err, items) {
              assert.ok(!err, JSON.stringify(err));
              assert.strictEqual(items.length, 3, "Invalid items length, expected 3, items was: " + JSON.stringify(items));
                self.db.tearDown();
                return done();
            });
          });
        });
      });

    });

  });

  self.db.distinct(self.test_collection, 'type', {}, function (err, items) {
    assert.ok(err, 'should signal error, since no db open');
    self.db.tearUp(); // no proceed by opening db
  });
};


exports[ 'test basic database ops' ] = function (done) {
  var foundItems = false;
  var test_collection_name1 = "testcollection1";
  var test_collection_name2 = "testcollection2";
  var self = this;
  self.db = new Database();
  self.db.name = "test-fhmongodb-database";

  self.db.on('tearUp', do_ops);

  function do_ops() {
    self.db.db.authenticate(config.database.adminauth.user, config.database.adminauth.user, {authSource:"admin"}, function(err, result){
      assert.ok(!err);
      self.db.dropDatabase(function(err) {
        assert.equal(err, null);

        async.series([function(cb) {
          self.db.removeAll(test_collection_name2, function(err, items) {
            assert.ok(!err);
            self.db.create(test_collection_name2, [{
              id: '1',
              type: 't1'
            },{
              id: '2',
              type: 't1'
            },{
              id: '3',
              type: 't2'
            }], function(err, docs) {
              assert.ok(!err, JSON.stringify(err));

              var query = {
                keys : ['type'],
                initial: { count : 0 },
                reduce: "function (obj, prev) {prev.count++;}"
              };

              self.db.group(test_collection_name2, query, function (err, results) {
                assert.ok(!err, JSON.stringify(err));
                // expected response [{"type":"t1","count":2},{"type":"t2","count":1}]
                assert.equal(2, results.length);
                var g0 = results[0];
                assert.equal('t1', g0.type);
                assert.equal(2, g0.count);
                var g1 = results[1];
                assert.equal('t2', g1.type);
                assert.equal(1, g1.count);
                return cb()
              });
            });
          });
        }, function(cb) {
          self.db.removeAll(test_collection_name1, function(err, items) {
            assert.equal(err, null);
            self.db.create(test_collection_name1, {
              test1 : "test value1",
              test2 : "test value2"
            }, function(err, docs) {
              assert.ok(!err, JSON.stringify(err));
              self.db.find(test_collection_name1, {}, function(err, items) {
                assert.ok(!err, JSON.stringify(err));
                var numItems = items.length;
                assert.equal(1, numItems);
                items.forEach(function(item) {
                  foundItems = true;
                  numItems--;
                  if (numItems < 1) {
                  }
                });


              });

              var tc2 = test_collection_name1 + "2";
              self.db.collectionExists(test_collection_name1, function(err, exists) {
                assert.equal(exists, true);
                self.db.createCollectionWithIndex(tc2, 'MD5', function(err) {
                  assert.equal(err, null);
                  async.series([
                    function (cb) {
                      self.db.countCollection(test_collection_name1,
                        function(err, count) {
                          assert.equal(count, 1);
                          return cb();
                        });
                    },
                    function(cb) {
                      self.db.collectionNames(function(err, names) {
                        assert.notEqual(names.length, 0);
                        return cb();
                      });
                    },
                    function(cb) {
                      self.db.findOne(test_collection_name1, {
                        test1 : 'test value1'
                      }, {}, function(err, item) {
                        assert.equal(item.test1, 'test value1');
                        return cb();
                    });
                    }, function(cb) {
                      self.db.dropCollection(test_collection_name1, function(err, item) {
                        assert.equal(err, null);
                        return cb();
                      });
                    }, function(cb) {
                      self.db.collectionExists(test_collection_name1, function(err, exists) {
                        assert.equal(exists, false);
                        return cb();
                      });
                    }
                  ], function(err, results) {
                    self.db.tearDown();
                    assert.ok(!err);
                    return cb();
                  });
                });
              });
            });
          });
        }], done);
      });
    });
  }
  self.db.tearUp();
};

exports[ 'test update and delete item with an id that is not hex' ] = function (done) {
  var test_collection_name = "testcollection_forinvaliddocid";
  var self = this;
  self.db = new Database();
  self.db.name = "test-fhmongodb-database";

  self.db.on('tearUp', do_ops);
  
  var sampleData = { _id : "foobar", test2 : "test value2"};

  function do_ops() {
    self.db.db.authenticate(config.database.adminauth.user, config.database.adminauth.user, {authSource:"admin"}, function(err, result){
      assert.ok(!err);
      self.db.dropDatabase(function(err) {
        assert.equal(err, null);
      
        self.db.removeAll(test_collection_name, function(err, items) {
          assert.equal(err, null);
        
          self.db.create(test_collection_name, sampleData, function(err, docs) {
            assert.ok(!err, JSON.stringify(err));
         
            async.series([
              function(cb){
                self.db.find(test_collection_name, {"_id": sampleData._id}, function(err, items) {
                  assert.ok(!err, JSON.stringify(err));

                  var numItems = items.length;
                  assert.equal(1, numItems);
                  return cb();
                });
              },
              function (cb) {
                self.db.countCollection(test_collection_name, function(err, count) {
                    assert.equal(count, 1);
                    return cb();
                  });
              },
              function(cb) {
                self.db.update(
                    test_collection_name,
                    {"_id": sampleData._id},
                    { _id : sampleData._id, test2 : "updated test value2"},
                    false,
                    function(err) {
                      assert.ok(!err, JSON.stringify(err));
                      return cb();
                    });
              },
              function(cb) {
                self.db.remove(
                    test_collection_name,
                    sampleData._id,
                    function(err) {
                      assert.ok(!err, JSON.stringify(err));
                      return cb();
                    });
              },
              function(cb) {
                self.db.dropCollection(test_collection_name, function(err, item) {
                  assert.equal(err, null);
                  return cb();
                });
              }
            ], function(err, results) {
              self.db.tearDown();
              assert.ok(!err);
              return done();
            });
          });
        });
      });
    });
  }
  self.db.tearUp();
};

exports['test getMongoClient'] = function (done) {
  var test_collection_name = 'testcollection_getMongoClient';
  var self = this;
  self.db = new Database();
  self.db.name = 'test-fhmongodb-database';

  self.db.on('tearUp', do_ops);
  // Should be null before tearUp.
  assert(!self.db.getMongoClient());

  function do_ops() {
    self.db.db.authenticate(config.database.adminauth.user, config.database.adminauth.user, { authSource: 'admin' }, function(err, result) {
      // Should not be null after tearUp.
      assert(self.db.db, self.db.getMongoClient());

      done();
    });
  }

  self.db.tearUp();
};