/*
 * Some code testing the CSV converting functionality.
 *
 */

var assert = require("assert");

var csvImporter = require("../../lib/importexport/csv").importer;

exports['should convert simple csv to json'] = function () {
  var str = "";
  str += "a,b,c" + "\n";
  str += "1,2,3" + "\n";
  str += "4,5,6" + "\n";

  csvImporter(str, function (err, json) {
    assert.ok(!err);
    assert.deepEqual(json, [{a: 1, b: 2, c: 3}, {a: 4, b: 5, c: 6}]);
  });
};

exports['should convert csv to json w/o EOL at the end'] = function () {
  var str = "";
  str += "a,b,c" + "\n";
  str += "1,2,3" + "\n";
  str += "4,5,6";

  csvImporter(str, function (err, json) {
    assert.ok(!err);
    assert.deepEqual(json, [{a: 1, b: 2, c: 3}, {a: 4, b: 5, c: 6}]);
  });
};

exports['should convert csv to json w/ unquoted strings '] = function () {
  var str = "";
  str += "a,b,c" + "\n";
  str += "1,2,3" + "\n";
  str += "x,y,z" + "\n";

  csvImporter(str, function (err, json) {
    assert.ok(!err);
    assert.deepEqual(json, [{a: 1, b: 2, c: 3}, {a: "x", b: "y", c: "z"}]);
  });
};

exports['should convert csv to json w/ quotes'] = function () {
  var str = "";
  str += "a,b,c" + "\n";
  str += "1,2,3" + "\n";
  str += "4,5,6" + "\n";
  str += '"x,p","y",z' + "\n";

  csvImporter(str, function (err, json) {
    assert.ok(!err);
    assert.deepEqual(json, [{a: 1, b: 2, c: 3}, {a: 4, b: 5, c: 6}, {a: "x,p", b: "y", c: "z"}]);
  });
};
