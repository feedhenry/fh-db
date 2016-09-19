var assert = require("assert");
var permission_map = require('../lib/permission_map');

exports['test permission map present'] = function() {
  assert.ok(permission_map);
  assert.ok(permission_map.db);
  assert.ok(permission_map.db.create);
  assert.ok(permission_map.db.list);
  assert.ok(permission_map.db.delete);
  assert.ok(permission_map.db.deleteAll);
  assert.ok(permission_map.db.drop);
  assert.ok(permission_map.db.update);
  assert.ok(permission_map.db.export);
  assert.ok(permission_map.db.import);
  assert.ok(permission_map.db.close);
};

exports['test default permissions'] = function() {
  assert.ok(permission_map.db.create.requires === "write");
  assert.ok(permission_map.db.list.requires === "read");
  assert.ok(permission_map.db.delete.requires === "write");
  assert.ok(permission_map.db.deleteAll.requires === "write");
  assert.ok(permission_map.db.drop.requires === "write");
  assert.ok(permission_map.db.update.requires === "write");
  assert.ok(permission_map.db.export.requires === "read");
  assert.ok(permission_map.db.import.requires === "write");
  assert.ok(permission_map.db.close.requires === "read");
};